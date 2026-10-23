function computePaymentStatusAfterRefund({ orderTotal, refundAmount }) {
  const total = Number(orderTotal);
  const refund = Number(refundAmount);
  if (!Number.isFinite(total) || !Number.isFinite(refund)) return 'partial_refunded';
  if (refund >= total) return 'refunded';
  return 'partial_refunded';
}

module.exports = { computePaymentStatusAfterRefund };

