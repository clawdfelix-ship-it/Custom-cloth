/**
 * 貨幣換算（單一真相源）
 * ---------------------------------------------
 * 上游 mzakka 商品價格係日元（JPY）。本店以港幣（HKD）標價：
 *   - DB products.price            單位 = HKD 元（DECIMAL）
 *   - 前台 storefront product.price 單位 = HKD 仙（cents，HKD 元 × 100）
 *
 * 匯率優先序：DB app_settings.jpy_hkd_rate（後台可一鍵更新）
 *          > env JPY_HKD_RATE
 *          > 預設 0.052（100 円 ≈ HK$5.2）
 */

const DEFAULT_JPY_HKD_RATE = 0.052;

// 後台更新後寫入嘅 runtime 值（由 app 啟動 / admin endpoint 同步）
let runtimeRate = null;

function isValidRate(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}

/** 設定由 DB 載入嘅匯率（null = 清除，退回 env/預設） */
function setRuntimeRate(rate) {
  runtimeRate = isValidRate(rate) ? Number(rate) : null;
}

function getRuntimeRate() {
  return runtimeRate;
}

function jpyToHkdRate() {
  if (isValidRate(runtimeRate)) return runtimeRate;
  const raw = process.env.JPY_HKD_RATE;
  const parsed = raw !== undefined && raw !== '' ? parseFloat(raw) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return DEFAULT_JPY_HKD_RATE;
}

/** 匯率來源：db | env | default */
function jpyToHkdRateSource() {
  if (isValidRate(runtimeRate)) return 'db';
  const raw = process.env.JPY_HKD_RATE;
  const parsed = raw !== undefined && raw !== '' ? parseFloat(raw) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) return 'env';
  return 'default';
}

/** 日元（元）→ 港幣（元），四捨五入到 2 位小數 */
function yenToHkd(yen, rate) {
  const y = Number(yen);
  if (!Number.isFinite(y) || y <= 0) return 0;
  const r = isValidRate(rate) ? Number(rate) : jpyToHkdRate();
  return Math.round(y * r * 100) / 100;
}

/** 日元（元）→ 港幣仙（cents），整數 */
function yenToHkdCents(yen, rate) {
  const y = Number(yen);
  if (!Number.isFinite(y) || y <= 0) return 0;
  const r = isValidRate(rate) ? Number(rate) : jpyToHkdRate();
  return Math.round(y * r * 100);
}

module.exports = {
  DEFAULT_JPY_HKD_RATE,
  setRuntimeRate,
  getRuntimeRate,
  jpyToHkdRate,
  jpyToHkdRateSource,
  yenToHkd,
  yenToHkdCents,
};
