function computeShippingFee(method, totalAmount) {
  const total = Number(totalAmount);
  const fee = Number(method.shipping_fee);
  const min = method.min_order_amount === null || method.min_order_amount === undefined ? null : Number(method.min_order_amount);
  const free = method.free_shipping_threshold === null || method.free_shipping_threshold === undefined ? null : Number(method.free_shipping_threshold);

  if (min !== null && Number.isFinite(min) && Number.isFinite(total) && total < min) return null;
  if (free !== null && Number.isFinite(free) && Number.isFinite(total) && total >= free) return 0;
  return Number.isFinite(fee) ? fee : null;
}

module.exports = { computeShippingFee };

