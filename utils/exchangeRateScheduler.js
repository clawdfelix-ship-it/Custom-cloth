/**
 * 匯率自動更新排程（每月 1 號）
 * ============================================================
 * 唔依賴外部 cron 套件：用 setTimeout 對準下一個「香港時間每月 1 號
 * AUTO_RATE_DAY_HOUR（預設 09:00）」，到時拉線上 JPY→HKD 匯率，
 * 存入 app_settings 並重算全店 mzakka 價格。
 *
 * 防重複：app_settings.jpy_rate_last_auto_at 記低上次自動成功時間；
 * 若當月已跑過（無論係開機補跑、其他實例或舊進程），就跳過。
 * 重算係冪等，雙跑都唔會壞數據，但呢個 guard 可避免無謂寫入。
 *
 * 可用環境變數：
 *   AUTO_RATE_ENABLED   設 '0'/'false' 可關閉（預設開）
 *   AUTO_RATE_DAY_HOUR  每月 1 號幾點跑（HKT，預設 9）
 */
const { getSetting, setSetting } = require('./settings');
const { fetchLiveJpyHkdRate, recomputePrices, higherRate } = require('./reprice');
const { setRuntimeRate, jpyToHkdRate } = require('./currency');

const LAST_RUN_KEY = '***';
let timer = null;

function hkParts(date) {
  // 用 Intl 攞香港時間年月日（唔靠主機時區）
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = {};
  for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;
  return {
    year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    hour: Number(parts.hour === '24' ? '00' : parts.hour),
    minute: Number(parts.minute), second: Number(parts.second),
  };
}

/** 下一次「每月 1 號 hour:00 HKT」嘅 Date（絕對時刻） */
function nextFirstOfMonth(hour, from = new Date()) {
  const now = hkParts(from);
  // 候選：本月 1 號
  let candidate = new Date(Date.UTC(now.year, now.month - 1, 1, hour - 8, 0, 0));
  if (candidate.getTime() <= from.getTime()) {
    // 過咗就下月 1 號（month 參數 0-indexed，now.month 已係下個月 index）
    candidate = new Date(Date.UTC(now.year, now.month, 1, hour - 8, 0, 0));
  }
  return candidate;
}

async function alreadyRanThisMonth(pool) {
  try {
    const row = await getSetting(pool, LAST_RUN_KEY);
    if (!row || !row.updated_at) return false;
    const last = hkParts(new Date(row.updated_at));
    const now = hkParts(new Date());
    return last.year === now.year && last.month === now.month;
  } catch (_) {
    return false; // 讀唔到就當未跑（reprice 冪等，安全）
  }
}

async function runMonthlyUpdate(pool, { reason } = {}) {
  const live = await fetchLiveJpyHkdRate();
  const fetched = Number(live.rate);
  // 規則：匯率以較高者為準——新拉到嘅匯率唔可以低過現行生效值（避免自動減價）
  const current = jpyToHkdRate();
  const rate = higherRate(fetched, current);
  const appliedSource = fetched >= current ? 'live' : 'existing-kept';
  setRuntimeRate(rate);
  const result = await recomputePrices(pool, rate, { apply: true });
  await setSetting(pool, 'jpy_hkd_rate', rate, null);
  await setSetting(pool, LAST_RUN_KEY, new Date().toISOString(), null);
  console.log(
    `💱 每月匯率自動更新（${reason || 'scheduled'}，${live.date || '?'}）：` +
    `線上 ${fetched}，現行 ${current}，採用較高者 ${rate}（${appliedSource}），` +
    `重算 ${result.changed}/${result.scanned} 件商品`
  );
  return { rate, fetched, current, appliedSource, date: live.date, ...result };
}

/** 啟動排程；回傳控制代碼（主要畀測試/graceful shutdown） */
function startExchangeRateScheduler(pool) {
  if (String(process.env.AUTO_RATE_ENABLED || '').toLowerCase() === '0' ||
      String(process.env.AUTO_RATE_ENABLED || '').toLowerCase() === 'false') {
    console.log('💱 匯率自動更新已關閉（AUTO_RATE_ENABLED=0）');
    return { stop() { clearTimeout(timer); } };
  }
  const hour = Math.min(23, Math.max(0, parseInt(process.env.AUTO_RATE_DAY_HOUR || '9', 10) || 9));

  async function tick() {
    try {
      if (!(await alreadyRanThisMonth(pool))) {
        await runMonthlyUpdate(pool, { reason: 'monthly' });
      } else {
        console.log('💱 今月匯率已自動更新過，跳過');
      }
    } catch (err) {
      console.error('💱 每月匯率自動更新失敗：', err.message);
    } finally {
      scheduleNext();
    }
  }

  function scheduleNext() {
    const at = nextFirstOfMonth(hour);
    const delay = Math.max(1000, at.getTime() - Date.now());
    // setTimeout 上限係 32-bit int（約 24.8 日）；每月 delay 會超出被夾做 1ms。
    // 超出就分段：先排到上限前，到時重新計算目標時刻。
    const MAX_TIMER_MS = 2147483000;
    const fireDelay = Math.min(delay, MAX_TIMER_MS);
    timer = setTimeout(delay > MAX_TIMER_MS ? scheduleNext : tick, fireDelay);
    // unref：唔好因為呢個 timer 卡住进程退出
    if (typeof timer.unref === 'function') timer.unref();
  }

  // 開機補跑：若今日已過咗每月 1 號嘅指定時間、但今月未跑過 → 即刻補一次
  (async () => {
    try {
      const now = hkParts(new Date());
      const due = (now.day >= 1 && (now.day > 1 || now.hour >= hour)) &&
        !(await alreadyRanThisMonth(pool));
      if (due) {
        await runMonthlyUpdate(pool, { reason: 'startup-catchup' });
      }
    } catch (err) {
      console.error('💱 開機補跑匯率失敗：', err.message);
    } finally {
      scheduleNext();
    }
  })();

  return {
    stop() { clearTimeout(timer); },
    runNow: () => runMonthlyUpdate(pool, { reason: 'manual' }),
    nextRun: () => nextFirstOfMonth(hour),
  };
}

module.exports = {
  startExchangeRateScheduler,
  runMonthlyUpdate,
  nextFirstOfMonth,
  hkParts,
};
