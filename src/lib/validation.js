function requiredString(v, name) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) throw new Error(`${name} required`);
  return s;
}

function requiredEnum(v, allowed, name) {
  if (!allowed.includes(v)) throw new Error(`${name} invalid`);
  return v;
}

function requiredYmd(v, name) {
  const s = requiredString(v, name);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`${name} invalid`);
  return s;
}

function requiredSizeRatio(v) {
  if (!Array.isArray(v) || v.length === 0) throw new Error('sizeRatio required');
  return v.map((r) => {
    const size = requiredString(r && r.size, 'size');
    const qty = Number(r && r.qty);
    if (!Number.isFinite(qty) || qty <= 0) throw new Error('qty invalid');
    return { size, qty };
  });
}

function requiredQtyJson(v) {
  if (!v || typeof v !== 'object') throw new Error('qty required');
  const keys = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
  const out = {};
  for (const k of keys) {
    const n = Number(v[k] || 0);
    if (!Number.isFinite(n) || n < 0) throw new Error('qty invalid');
    out[k] = n;
  }
  if (Object.values(out).reduce((a, b) => a + b, 0) <= 0) throw new Error('qty empty');
  return out;
}

module.exports = {
  requiredString,
  requiredEnum,
  requiredYmd,
  requiredSizeRatio,
  requiredQtyJson
};
