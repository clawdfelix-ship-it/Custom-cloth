/**
 * 後台設定：JPY→HKD 匯率（一鍵更新）
 *  - GET  /api/admin/settings/exchange-rate        睇現行匯率/來源/影響商品數
 *  - POST /api/admin/settings/exchange-rate/fetch  拉線上最新匯率（可選重算全店價格）
 *  - POST /api/admin/settings/exchange-rate/manual 手動設匯率（可選重算）
 *
 * 匯率一經更新寫入 app_settings 並同步 runtime；recompute=true 時順手重算
 * 所有 source='mzakka' 商品（由 raw_payload.priceYen）。
 */
const { getSetting, setSetting } = require('../utils/settings');
const {
  jpyToHkdRate,
  jpyToHkdRateSource,
  setRuntimeRate,
} = require('../utils/currency');
const { recomputePrices, fetchLiveJpyHkdRate, higherRate } = require('../utils/reprice');

const RATE_KEY = 'jpy_hkd_rate';

function rateIsValid(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n < 1; // 1 JPY 一定 < 1 HKD，擋明顯錯誤
}

module.exports = function (app, pool, requireAdmin) {
  // 現行匯率狀態
  app.get('/api/admin/settings/exchange-rate', requireAdmin, async (req, res) => {
    try {
      const stored = await getSetting(pool, RATE_KEY);
      const countRes = await pool.query(
        "SELECT COUNT(*)::int AS n FROM products WHERE source = 'mzakka'"
      );
      res.json({
        rate: jpyToHkdRate(),
        source: jpyToHkdRateSource(),
        storedRate: stored && stored.value !== null ? Number(stored.value) : null,
        updatedAt: stored ? stored.updated_at : null,
        affectedProducts: countRes.rows[0].n,
      });
    } catch (err) {
      console.error('GET exchange-rate settings failed:', err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // 共用：實際保存匯率 + 選擇性重算（回傳資料，唔直接回應）
  async function persistRate(req, rate) {
    const recompute = req.body && req.body.recompute !== false;
    let repriceResult = null;

    // 1) 先存匯率並即時同步 runtime（失敗就整單中斷）
    const saved = await setSetting(pool, RATE_KEY, Number(rate), req.session.userId);
    setRuntimeRate(Number(rate));

    // 2) 可選：transaction 重算全店價格（失敗 rollback，但新匯率仍保留）
    if (recompute) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        repriceResult = await recomputePrices(client, Number(rate), { apply: true });
        await client.query('COMMIT');
      } catch (e) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        throw e;
      } finally {
        client.release();
      }
    }

    return {
      success: true,
      rate: Number(rate),
      source: 'db',
      updatedAt: saved.updated_at,
      recomputed: recompute,
      reprice: repriceResult,
    };
  }

  // 手動儲存入口：先驗證，再保存並回應
  async function saveRate(req, res, rate) {
    if (!rateIsValid(rate)) {
      return res.status(400).json({ error: '匯率無效，請輸入 0 至 1 之間嘅數字（例如 0.052）' });
    }
    try {
      const payload = await persistRate(req, rate);
      return res.json(payload);
    } catch (err) {
      console.error('SAVE exchange-rate failed:', err);
      return res.status(500).json({ error: '服務器錯誤' });
    }
  }

  // 一鍵：拉線上最新匯率（規則：同現行生效值比，取較高者，唔會自動減價）
  app.post('/api/admin/settings/exchange-rate/fetch', requireAdmin, async (req, res) => {
    try {
      const live = await fetchLiveJpyHkdRate();
      const fetched = Number(live.rate);
      const current = jpyToHkdRate();
      const rate = higherRate(fetched, current);
      const keptExisting = fetched < current;
      const response = await persistRate(req, rate);
      res.json({
        ...response,
        fetchedRate: fetched,
        currentRateBefore: current,
        keptExisting,
        liveDate: live.date || null,
        message: keptExisting
          ? `線上匯率 ${fetched} 低過現行 ${current}，已保留較高者 ${current}`
          : `已更新至較高匯率 ${rate}`,
      });
    } catch (err) {
      console.error('Fetch live rate failed:', err);
      return res.status(502).json({ error: '取得線上匯率失敗：' + (err.message || '未知錯誤') });
    }
  });

  // 手動設定（管理員明確輸入，如實採用，唔做較高者夾取）
  app.post('/api/admin/settings/exchange-rate/manual', requireAdmin, async (req, res) => {
    const rate = req.body && req.body.rate;
    return saveRate(req, res, rate);
  });

  // =========================================================================
  // 積分系統設定
  //  GET  /api/admin/settings/points
  //  POST /api/admin/settings/points
  // =========================================================================
  const pointsService = require('../lib/pointsService');

  app.get('/api/admin/settings/points', requireAdmin, async (req, res) => {
    try {
      const cfg = await pointsService.loadConfig(pool);
      res.json(cfg);
    } catch (err) {
      console.error('Load points settings failed:', err);
      res.status(500).json({ error: '讀取積分設定失敗' });
    }
  });

  app.post('/api/admin/settings/points', requireAdmin, async (req, res) => {
    try {
      const b = req.body || {};
      const adminId = req.session.userId;

      const toInt = (v, { min = 0 } = {}) => {
        const n = parseInt(v, 10);
        if (!Number.isInteger(n) || n < min) return null;
        return n;
      };

      const earnHkd   = toInt(b.earnHkd, { min: 1 });
      const redeemHkd = toInt(b.redeemHkd, { min: 1 });
      const minRedeem = toInt(b.minRedeem, { min: 0 });
      const expiryDays= toInt(b.expiryDays, { min: 0 });
      const enabled   = b.enabled === true || b.enabled === 'true' || b.enabled === 1 || b.enabled === '1';

      const errors = [];
      if (earnHkd == null) errors.push('「每幾多港幣賺 1 分」要係 ≥1 嘅整數');
      if (redeemHkd == null) errors.push('「每幾多分兌 HK$1」要係 ≥1 嘅整數');
      if (minRedeem == null) errors.push('最低兌換分數要係 ≥0 嘅整數');
      if (expiryDays == null) errors.push('過期日數要係 ≥0 嘅整數（0 = 唔過期）');
      if (errors.length) return res.status(400).json({ error: errors.join('；') });

      await setSetting(pool, 'points_enabled',    enabled ? '1' : '0', adminId);
      await setSetting(pool, 'points_earn_hkd',   String(earnHkd), adminId);
      await setSetting(pool, 'points_redeem_hkd', String(redeemHkd), adminId);
      await setSetting(pool, 'points_min_redeem', String(minRedeem), adminId);
      await setSetting(pool, 'points_expiry_days',String(expiryDays), adminId);

      const cfg = await pointsService.loadConfig(pool);
      res.json({ success: true, config: cfg });
    } catch (err) {
      console.error('Save points settings failed:', err);
      res.status(500).json({ error: '儲存積分設定失敗' });
    }
  });
};
