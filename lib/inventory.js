function computeNewStock({ previousStock, delta }) {
  const prev = Number(previousStock);
  const d = Number(delta);
  if (!Number.isInteger(prev) || prev < 0) throw new Error('invalid previousStock');
  if (!Number.isInteger(d)) throw new Error('invalid delta');
  const next = prev + d;
  if (next < 0) throw new Error('stock cannot go below 0');
  return { previousStock: prev, newStock: next };
}

module.exports = { computeNewStock };

