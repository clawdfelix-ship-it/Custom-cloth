/**
 * 按 JPY→HKD 匯率重算 mzakka 商品價格。
 * 原始日元存喺 products.raw_payload.priceYen；DB price 單位 = HKD 元。
 * admin 一鍵更新匯率同 CLI script 共用呢段邏輯。
 *
 * @returns {{scanned:number, changed:number, skipped:number, examples:Array}}
 */
const { yenToHkd } = require('./currency');

async function recomputePrices(pool, rate, options = {}) {
  const apply = options.apply !== false; // 預設真正寫入
  const { rows } = await pool.query(`
    SELECT id, name, price, original_price, source, raw_payload
    FROM products
    WHERE source = 'mzakka'
    ORDER BY id
  `);

  let scanned = 0;
  let changed = 0;
  let skipped = 0;
  const examples = [];

  for (const r of rows) {
    scanned++;
    const payload = r.raw_payload || {};
    const yen = Number(payload.priceYen);
    if (!Number.isFinite(yen) || yen <= 0) { skipped++; continue; }

    const newPrice = yenToHkd(yen, rate);
    const origYen = Number(payload.originalPriceYen);
    const newOrig = Number.isFinite(origYen) && origYen > 0 ? yenToHkd(origYen, rate) : null;

    const isChanged =
      Number(r.price) !== newPrice ||
      (newOrig !== null && Number(r.original_price || 0) !== newOrig);

    if (isChanged) {
      changed++;
      if (examples.length < 10) {
        examples.push({ id: r.id, name: r.name, yen, old: Number(r.price), next: newPrice });
      }
      if (apply) {
        await pool.query(
          'UPDATE products SET price = $1, original_price = $2, updated_at = NOW() WHERE id = $3',
          [newPrice, newOrig, r.id]
        );
      }
    }
  }

  return { scanned, changed, skipped, examples };
}

/** 由免費、無金鑰 Frankfurter API（歐洲央行數據）攞最新 JPY→HKD */
async function fetchLiveJpyHkdRate(fetchImpl) {
  const doFetch = fetchImpl || global.fetch;
  if (typeof doFetch !== 'function') {
    throw new Error('此環境不支援 fetch，無法取得線上匯率');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await doFetch(
      'https://api.frankfurter.app/latest?from=JPY&to=HKD',
      { signal: controller.signal, headers: { accept: 'application/json' } }
    );
    if (!res.ok) {
      throw new Error(`匯率服務回應 ${res.status}`);
    }
    const data = await res.json();
    const rate = Number(data && data.rates && data.rates.HKD);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error('匯率服務回傳格式異常');
    }
    return { rate, date: data.date || null, source: 'frankfurter.app (ECB)' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 規則：匯率以較高者為準。自動/一鍵拉到嘅新匯率若低過現行生效值，
 * 保留現行值（唔自動減價）。手動輸入唔經呢度，如實採用。
 */
function higherRate(fetched, current) {
  const f = Number(fetched);
  const c = Number(current);
  if (!Number.isFinite(f) || f <= 0) return c;
  if (!Number.isFinite(c) || c <= 0) return f;
  return f >= c ? f : c;
}

module.exports = { recomputePrices, fetchLiveJpyHkdRate, higherRate };
