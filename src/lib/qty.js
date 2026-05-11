function normalizeQtyToSizeRatio(qty) {
  if (Array.isArray(qty)) {
    const out = qty.map((x) => {
      const size = x && typeof x.size === 'string' ? x.size.trim() : '';
      const n = Number(x && x.qty);
      if (!size) throw new Error('size required');
      if (!Number.isFinite(n) || n < 0) throw new Error('qty invalid');
      return { size, qty: n };
    });
    if (out.reduce((a, b) => a + b.qty, 0) <= 0) throw new Error('qty empty');
    return out;
  }

  if (qty && typeof qty === 'object') {
    const keys = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
    const out = [];
    for (const k of keys) {
      const n = Number(qty[k] || 0);
      if (!Number.isFinite(n) || n < 0) throw new Error('qty invalid');
      if (n > 0) out.push({ size: k, qty: n });
    }
    if (out.reduce((a, b) => a + b.qty, 0) <= 0) throw new Error('qty empty');
    return out;
  }

  throw new Error('qty required');
}

module.exports = { normalizeQtyToSizeRatio };

