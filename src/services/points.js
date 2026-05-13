/**
 * 積分服務
 * 
 * 功能：
 * - 積分增減（消費/退款/簽到/活動獎勵）
 * - 積分兌換
 * - 積分抵扣（訂單支付時使用）
 * - 積分过期處理
 */
const { sql } = require('../lib/db');
const { emit, EVENTS } = require('../lib/events');

/** 積分配置 */
const POINTS_CONFIGS = {
  // 消費返積分比例（1元 = ? 積分）
  POINTS_PER_DOLLAR: 10,       // 1元 = 10積分
  // 積分抵扣比例（100積分 = 1元）
  DOLLAR_PER_100_POINTS: 1,    // 100積分 = HK$1
  // 訂單積分抵扣上限（不超過訂單金額的 X%）
  MAX_DEDUCTION_RATIO: 0.10,   // 10%
  // 積分過期期限（天），0=不過期
  EXPIRE_DAYS: 365,
  // 簽到獎勵
  SIGN_POINTS: 5,
};

/**
 * 計算訂單可獲取的積分
 * @param {number} orderAmount
 * @param {number} [pointsRate=1.0] - 會員積分倍率
 */
function computeOrderPoints(orderAmount, pointsRate = 1.0) {
  const points = Math.floor(orderAmount * POINTS_CONFIGS.POINTS_PER_DOLLAR * pointsRate);
  return points;
}

/**
 * 計算積分可抵扣的金額
 * @param {number} points
 * @param {number} [maxDeduction] - 最大抵扣金額（通常等於訂單金額）
 */
function computePointsDeduction(points, maxDeduction = null) {
  const deduction = (points / 100) * POINTS_CONFIGS.DOLLAR_PER_100_POINTS;
  if (maxDeduction !== null) {
    return Math.min(deduction, maxDeduction);
  }
  return deduction;
}

/**
 * 添加積分（通用）
 * @param {string} customerId
 * @param {number} points - 正數=增加，負數=扣減
 * @param {string} type - 類型：'order_pay'|'order_refund'|'sign'|'promotion'|'expire'|'adjust'
 * @param {string} title - 說明
 * @param {object} [extra]
 */
async function addPoints(customerId, points, type, title, extra = {}) {
  const pm = points >= 0 ? 1 : 0;
  const absPoints = Math.abs(points);

  // 查詢當前積分
  const current = await sql`
    SELECT total_points FROM customers WHERE id = ${customerId}
  `;
  const currentPoints = Number(current.rows[0]?.total_points || 0);
  const newTotal = pm === 1 ? currentPoints + absPoints : Math.max(0, currentPoints - absPoints);

  // 計算過期時間
  let expireTime = null;
  if (POINTS_CONFIGS.EXPIRE_DAYS > 0 && points > 0) {
    expireTime = new Date(Date.now() + POINTS_CONFIGS.EXPIRE_DAYS * 24 * 60 * 60 * 1000);
  }

  // 寫入 customers 表
  await sql`
    UPDATE customers SET total_points = ${newTotal} WHERE id = ${customerId}
  `;

  // 寫入積分流水（可選，如果有單獨的積分流水表）
  // 目前用 ledger 表記錄所有資金變動
  const { createLedgerEntry, LEDGER_TYPES } = require('../lib/ledger');
  await createLedgerEntry({
    accountId: customerId,
    accountType: 'customer',
    type: LEDGER_TYPES.INTEGRAL[type.toUpperCase()] || `integral_${type}`,
    amount: points,
    balanceAfter: newTotal,
    title,
    orderId: extra.orderId || null,
    mark: extra.mark || ''
  });

  return { added: absPoints, newTotal, pm, expireTime };
}

/**
 * 積分支付（訂單抵扣）
 * @param {string} customerId
 * @param {number} pointsToUse - 使用的積分
 * @param {string} orderId
 * @param {number} maxDeduction - 最大抵扣金額（防超扣）
 */
async function usePointsForOrder(customerId, pointsToUse, orderId, maxDeduction) {
  // 先計算可抵扣金額
  const deduction = computePointsDeduction(pointsToUse, maxDeduction);

  // 扣減積分
  return await addPoints(customerId, -pointsToUse, 'order_pay', `訂單抵扣`, {
    orderId,
    mark: `${pointsToUse} 積分抵扣 HK$${deduction.toFixed(2)}`
  });
}

/**
 * 退還積分（訂單退款）
 * @param {string} customerId
 * @param {number} pointsToRefund - 退還積分
 * @param {string} orderId
 */
async function refundPoints(customerId, pointsToRefund, orderId) {
  return await addPoints(customerId, pointsToRefund, 'order_refund', `訂單退款退還積分`, {
    orderId
  });
}

/**
 * 簽到獎勵
 * @param {string} customerId
 */
async function signIn(customerId) {
  // 檢查今日是否已簽到（避免重複）
  // 這裡預留介面，未來可在 ledger 中增加 type='sign' 且日期校驗

  const { addPoints } = require('../src/services/points');
  return await addPoints(
    customerId,
    POINTS_CONFIGS.SIGN_POINTS,
    'sign',
    `每日簽到獎勵`,
    { mark: `連續簽到獎勵` }
  );
}

/**
 * 查詢積分餘額
 * @param {string} customerId
 */
async function getPointsBalance(customerId) {
  const result = await sql`
    SELECT total_points FROM customers WHERE id = ${customerId}
  `;
  return Number(result.rows[0]?.total_points || 0);
}

/**
 * 積分排行榜
 * @param {number} [limit=10]
 */
async function getPointsLeaderboard(limit = 10) {
  const result = await sql`
    SELECT c.id, c.company_name, c.contact_name, c.total_points,
           cl.display_name as level_name
    FROM customers c
    LEFT JOIN customer_levels cl ON cl.id = c.level_id
    WHERE c.total_points > 0
    ORDER BY c.total_points DESC
    LIMIT ${limit}
  `;
  return result.rows;
}

module.exports = {
  POINTS_CONFIGS,
  computeOrderPoints,
  computePointsDeduction,
  addPoints,
  usePointsForOrder,
  refundPoints,
  signIn,
  getPointsBalance,
  getPointsLeaderboard
};
