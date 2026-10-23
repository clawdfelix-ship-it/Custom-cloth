/**
 * orderStateMachine.js — 訂單狀態機（旁車模組，向後兼容）
 *
 * 目的：取代「order.status + payment_status 兩條自由字串各自 UPDATE」。
 * 設計：payment / fulfillment 兩條子狀態，order 總狀態由子狀態「推导」。
 *       全部 transition 宣告式定義，非法轉態會被 reject。
 *
 * 向後兼容：接受現有 DB 嘅 status 值（pending/paid/shipping/completed/cancelled）
 * 及 payment_status 值（pending/proof_pending/paid/failed）。
 * 本模組係純函數，唔接 DB、唔經 mzakka 同步，可獨立測試。
 */

// ---- Payment（付款）子狀態 ----
const PAYMENT_STATES = Object.freeze({
  UNPAID: 'unpaid',               // 未落數
  PROOF_PENDING: 'proof_pending', // 已遞入數證明、待審
  PAID: 'paid',                   // 已確認收款
  PARTIALLY_REFUNDED: 'partially_refunded',
  REFUNDED: 'refunded',
  FAILED: 'failed',
});

// ---- Fulfillment（出貨）子狀態 ----
const FULFILLMENT_STATES = Object.freeze({
  UNFULFILLED: 'unfulfilled',
  PARTIALLY_SHIPPED: 'partially_shipped',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
});

// ---- Order（訂單總）狀態 ----
const ORDER_STATES = Object.freeze({
  PENDING: 'pending',
  PAID: 'paid',
  SHIPPING: 'shipping',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

// Payment transition map：from -> [allowed to...]
const PAYMENT_TRANSITIONS = Object.freeze({
  unpaid:            ['proof_pending', 'paid', 'failed'],
  proof_pending:     ['paid', 'unpaid', 'failed'],
  paid:              ['partially_refunded', 'refunded'],
  partially_refunded:['refunded', 'partially_refunded'],
  refunded:          [],
  failed:            ['unpaid'],
});

// Fulfillment transition map
const FULFILLMENT_TRANSITIONS = Object.freeze({
  unfulfilled:       ['partially_shipped', 'shipped'],
  partially_shipped: ['shipped'],
  shipped:           ['delivered'],
  delivered:         [],
});

function canTransition(map, from, to) {
  if (from === to) return true;
  return Array.isArray(map[from]) && map[from].includes(to);
}

function transition(map, from, to) {
  if (!canTransition(map, from, to)) {
    const err = new Error(`非法狀態轉換：${from} → ${to}`);
    err.code = 'INVALID_ORDER_TRANSITION';
    throw err;
  }
  return to;
}

/**
 * 由子狀態推导 order 總狀態（集中一處，唔再各自 UPDATE）。
 * 取消係顯式標記，唔由子狀態推导。
 */
function deriveOrderState(input) {
  const { cancelled, payment, fulfillment } = input || {};
  if (cancelled) return ORDER_STATES.CANCELLED;

  if (fulfillment === FULFILLMENT_STATES.DELIVERED) return ORDER_STATES.COMPLETED;
  if (fulfillment === FULFILLMENT_STATES.SHIPPED ||
      fulfillment === FULFILLMENT_STATES.PARTIALLY_SHIPPED) return ORDER_STATES.SHIPPING;

  if (payment === PAYMENT_STATES.PAID ||
      payment === PAYMENT_STATES.PARTIALLY_REFUNDED) return ORDER_STATES.PAID;

  return ORDER_STATES.PENDING;
}

/**
 * 將現有 DB row（status + payment_status）映射成新子狀態。
 * 用於一次性/按需回填，唔改任何資料。
 */
function fromLegacyRow(row) {
  const r = row || {};
  const cancelled = r.status === 'cancelled';

  let payment = PAYMENT_STATES.UNPAID;
  if (r.payment_status === 'paid') payment = PAYMENT_STATES.PAID;
  else if (r.payment_status === 'proof_pending') payment = PAYMENT_STATES.PROOF_PENDING;
  else if (r.payment_status === 'failed') payment = PAYMENT_STATES.FAILED;

  let fulfillment = FULFILLMENT_STATES.UNFULFILLED;
  if (r.status === 'completed') fulfillment = FULFILLMENT_STATES.DELIVERED;
  else if (r.status === 'shipping') fulfillment = FULFILLMENT_STATES.SHIPPED;
  // 注：legacy status='paid' 只反映付款，出貨仍 unfulfilled

  return { cancelled, payment, fulfillment, state: deriveOrderState({ cancelled, payment, fulfillment }) };
}

module.exports = {
  PAYMENT_STATES,
  FULFILLMENT_STATES,
  ORDER_STATES,
  canTransitionPayment: (from, to) => canTransition(PAYMENT_TRANSITIONS, from, to),
  canTransitionFulfillment: (from, to) => canTransition(FULFILLMENT_TRANSITIONS, from, to),
  transitionPayment: (from, to) => transition(PAYMENT_TRANSITIONS, from, to),
  transitionFulfillment: (from, to) => transition(FULFILLMENT_TRANSITIONS, from, to),
  deriveOrderState,
  fromLegacyRow,
};
