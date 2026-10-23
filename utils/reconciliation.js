function toNumber(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : null;
}

function reconcileDaily({ orders, transactions }) {
  const paidOrders = (orders || []).filter((o) => o && o.payment_status === 'paid');
  const successTx = (transactions || []).filter((t) => t && t.status === 'success');

  const txByOrderId = new Map();
  for (const t of successTx) {
    if (t.order_id == null) continue;
    if (!txByOrderId.has(t.order_id)) txByOrderId.set(t.order_id, []);
    txByOrderId.get(t.order_id).push(t);
  }

  const matched = [];
  const missing_transaction = [];
  const amount_mismatch = [];

  for (const o of paidOrders) {
    const txs = txByOrderId.get(o.id) || [];
    if (txs.length === 0) {
      missing_transaction.push({ order: o });
      continue;
    }
    const orderAmount = toNumber(o.total_amount);
    const ok = txs.some((t) => toNumber(t.amount) === orderAmount);
    if (ok) matched.push({ order: o, transactions: txs });
    else amount_mismatch.push({ order: o, transactions: txs });
  }

  const paidOrderIds = new Set(paidOrders.map((o) => o.id));
  const missing_order = successTx
    .filter((t) => t.order_id != null && !paidOrderIds.has(t.order_id))
    .map((t) => ({ transaction: t }));

  return { matched, missing_transaction, amount_mismatch, missing_order };
}

module.exports = { reconcileDaily };

