// 訂單狀態時間軸：根據 orders 表已存在嘅 created_at / paid_at / shipped_at / delivered_at
// 算出 4 個節點（已下單 / 已付款 / 已出貨 / 已送達）嘅狀態 + 時間字串。
// 取消狀態 (status='cancelled') 整個時間軸標灰 + 加 banner。
//
// status 值：done | current | pending | cancelled
// - done:    已完成並有時間戳
// - current: 步驟正在進行（適用於「出貨」狀態 awaiting 收貨、「付款」等待核實等）
// - pending: 仲未到
// - cancelled: 訂單被取消

const fmt = (s) => {
  if (!s) return null;
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString('zh-HK', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch (_) {
    return null;
  }
};

const fmtShort = (s) => {
  if (!s) return null;
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString('zh-HK', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch (_) {
    return null;
  }
};

function buildTimeline(order) {
  if (!order) return null;
  const status = String(order.status || '');
  const payment = String(order.payment_status || 'pending');
  const isCancelled = status === 'cancelled';

  const steps = [
    { key: 'placed',   label: '已下單', at: order.created_at },
    { key: 'paid',     label: '已付款', at: order.paid_at },
    { key: 'shipped',  label: '已出貨', at: order.shipped_at },
    { key: 'delivered',label: '已送達', at: order.delivered_at },
  ];

  // 判斷每步 status
  // 已送達 = delivered_at 有 OR status in (delivered, completed)
  // 已出貨 = shipped_at 有 OR status in (shipped, shipping)
  // 已付款 = paid_at 有 OR payment_status = 'paid'
  // 已下單 = 一定 done（訂單本身存在）

  const paidDone     = !!order.paid_at || payment === 'paid';
  const shippedDone  = !!order.shipped_at || status === 'shipped' || status === 'shipping' || status === 'delivered' || status === 'completed';
  const deliveredDone= !!order.delivered_at || status === 'delivered' || status === 'completed';

  steps[0].status = 'done';
  steps[0].time   = fmt(order.created_at);

  steps[1].status = paidDone ? 'done' : 'pending';
  steps[1].time   = paidDone ? (fmt(order.paid_at) || '已確認收款') : '等待付款 / 核實';

  steps[2].status = shippedDone ? (deliveredDone ? 'done' : 'current') : 'pending';
  steps[2].time   = shippedDone
    ? (deliveredDone ? (fmt(order.shipped_at) || '已出貨') : (fmt(order.shipped_at) || '配送中'))
    : '未出貨';

  steps[3].status = deliveredDone ? 'done' : (shippedDone ? 'current' : 'pending');
  steps[3].time   = deliveredDone ? (fmt(order.delivered_at) || '已完成') : (shippedDone ? '等待送達' : '未送達');

  if (isCancelled) {
    steps.forEach((s) => {
      s.status = 'cancelled';
      if (s.key === 'placed') {
        s.time = fmt(order.created_at);
      } else {
        s.time = '訂單已取消';
      }
    });
  }

  return {
    isCancelled,
    summary: isCancelled
      ? '訂單已取消'
      : (deliveredDone ? '已完成'
        : (shippedDone ? '配送中'
          : (paidDone ? '待出貨' : '待付款'))),
    steps,
    shortCreated: fmtShort(order.created_at),
  };
}

function attachTimeline(rows) {
  if (!Array.isArray(rows)) return rows;
  rows.forEach((r) => { r.timeline = buildTimeline(r); });
  return rows;
}

module.exports = { buildTimeline, attachTimeline };
