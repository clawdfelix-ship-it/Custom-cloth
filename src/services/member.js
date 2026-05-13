/**
 * 會員等級服務
 * 
 * 借鑒 CRMEB UserLevelServices
 * 
 * 功能：
 * - 等級計算（根據累計消費自動升級）
 * - 等級折扣計算（商品價格 × 等級折扣率）
 * - 等級權益查詢
 */
const { sql } = require('../src/lib/db');
const { bcAdd, bcMul, bcCmp } = require('../src/lib/math');

/**
 * 獲取所有啟用的會員等級
 */
async function getAllLevels() {
  const result = await sql`
    SELECT id, name, display_name, discount_rate, points_rate, 
           min_amount, max_amount, is_default
    FROM customer_levels
    WHERE is_active = TRUE
    ORDER BY sort_order ASC
  `;
  return result.rows;
}

/**
 * 根據累計消費金額計算會員等級
 * @param {number} totalAmount - 累計消費金額
 */
async function calculateLevelByAmount(totalAmount) {
  const levels = await getAllLevels();

  // 從最高等級往低查找
  for (const level of levels.reverse()) {
    if (totalAmount >= Number(level.min_amount)) {
      if (level.max_amount === null || totalAmount <= Number(level.max_amount)) {
        return level;
      }
    }
  }

  // 返回預設等級
  const defaultLevel = levels.find(l => l.is_default);
  return defaultLevel || levels[0];
}

/**
 * 獲取客戶當前等級
 * @param {string} customerId
 */
async function getCustomerLevel(customerId) {
  const result = await sql`
    SELECT c.level_id, cl.*
    FROM customers c
    JOIN customer_levels cl ON cl.id = c.level_id
    WHERE c.id = ${customerId}
  `;
  return result.rows[0] || null;
}

/**
 * 計算商品會員價
 * @param {string} customerId - 客戶ID
 * @param {number} originalPrice - 原始價格
 * @param {string} [productId] - 商品ID（預留，未來按商品獨立設置會員價）
 */
async function computeMemberPrice(customerId, originalPrice, productId = null) {
  const level = await getCustomerLevel(customerId);
  if (!level) return originalPrice;

  const discountRate = Number(level.discount_rate);
  if (discountRate >= 1) return originalPrice;

  const memberPrice = Number((originalPrice * discountRate).toFixed(2));
  return memberPrice;
}

/**
 * 計算訂單的會員折扣金額
 * @param {string} customerId
 * @param {number} totalAmount - 訂單總金額
 */
async function computeOrderMemberDiscount(customerId, totalAmount) {
  const level = await getCustomerLevel(customerId);
  if (!level) return 0;

  const discountRate = Number(level.discount_rate);
  if (discountRate >= 1) return 0;

  const discount = Number((totalAmount * (1 - discountRate)).toFixed(2));
  return discount;
}

/**
 * 升級客戶會員等級
 * @param {string} customerId
 * @param {number} [newLevelId] - 指定等級ID（不傳則自動計算）
 */
async function upgradeCustomerLevel(customerId, newLevelId = null) {
  // 查詢客戶累計消費
  const customer = await sql`
    SELECT id, level_id, total_amount FROM customers WHERE id = ${customerId}
  `;
  if (!customer.rows[0]) throw new Error('customer_not_found');

  const { level_id: currentLevelId, total_amount: totalAmount } = customer.rows[0];

  // 計算應該的等級
  const targetLevel = newLevelId
    ? await getLevelById(newLevelId)
    : await calculateLevelByAmount(Number(totalAmount));

  if (!targetLevel) return { upgraded: false, reason: 'no_level_found' };

  // 如果目標等級更低或相同，不升級
  if (targetLevel.sort_order <= currentLevelId) {
    return { upgraded: false, reason: 'no_upgrade_needed' };
  }

  // 執行升級
  await sql`
    UPDATE customers SET level_id = ${targetLevel.id} WHERE id = ${customerId}
  `;

  return {
    upgraded: true,
    fromLevelId: currentLevelId,
    toLevelId: targetLevel.id,
    toLevelName: targetLevel.display_name
  };
}

/**
 * 根據ID獲取等級
 */
async function getLevelById(levelId) {
  const result = await sql`
    SELECT * FROM customer_levels WHERE id = ${levelId} AND is_active = TRUE
  `;
  return result.rows[0] || null;
}

/**
 * 添加客戶累計消費金額（訂單完成後調用）
 * @param {string} customerId
 * @param {number} amount - 消費金額
 */
async function addCustomerAmount(customerId, amount) {
  // 更新累計金額
  const updated = await sql`
    UPDATE customers
    SET total_amount = COALESCE(total_amount, 0) + ${amount}
    WHERE id = ${customerId}
    RETURNING total_amount
  `;

  // 檢查是否需要升級
  const newAmount = Number(updated.rows[0]?.total_amount || 0);
  const upgradeResult = await upgradeCustomerLevel(customerId);

  return {
    newTotalAmount: newAmount,
    upgradeResult
  };
}

/**
 * 設置客戶為推廣員（成為分銷代理）
 * @param {string} customerId
 * @param {number} [commissionRate=0.05] - 傭金比例，默認5%
 */
async function becomePromoter(customerId, commissionRate = 0.05) {
  const customer = await sql`SELECT is_promoter FROM customers WHERE id = ${customerId}`;
  if (!customer.rows[0]) throw new Error('customer_not_found');

  if (customer.rows[0].is_promoter) {
    return { already: true, message: '已是推廣員' };
  }

  await sql`
    UPDATE customers
    SET is_promoter = TRUE, promoter_time = NOW()
    WHERE id = ${customerId}
  `;

  // 創建傭金帳戶
  const { createBrokerageAccount } = require('./brokerage');
  await createBrokerageAccount(customerId, 'customer', {
    commissionRate,
    secondRate: 0.02
  });

  return { success: true, message: '已成為推廣員' };
}

/**
 * 獲取推廣員列表
 * @param {object} options
 */
async function getPromoterList({ page = 1, limit = 20, keyword = '' } = {}) {
  const offset = (page - 1) * limit;

  let whereClause = sql`WHERE c.is_promoter = TRUE`;
  if (keyword) {
    whereClause = sql`${whereClause} AND (c.company_name ILIKE ${'%' + keyword + '%'} OR c.contact_name ILIKE ${'%' + keyword + '%'})`;
  }

  const countResult = await sql`
    SELECT COUNT(*) as total FROM customers c ${whereClause}
  `;
  const total = Number(countResult.rows[0].total);

  const promoters = await sql`
    SELECT c.id, c.company_name, c.contact_name, c.phone, c.total_amount,
           c.promoter_time, c.level_id,
           cl.display_name as level_name,
           COALESCE(ba.available_amount, 0) as available_amount,
           COALESCE(ba.total_earned, 0) as total_earned
    FROM customers c
    LEFT JOIN customer_levels cl ON cl.id = c.level_id
    LEFT JOIN brokerage_accounts ba ON ba.account_id = c.id AND ba.account_type = 'customer'
    ${whereClause}
    ORDER BY c.promoter_time DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  return { promoters: promoters.rows, total, page, limit };
}

module.exports = {
  getAllLevels,
  calculateLevelByAmount,
  getCustomerLevel,
  computeMemberPrice,
  computeOrderMemberDiscount,
  upgradeCustomerLevel,
  addCustomerAmount,
  becomePromoter,
  getPromoterList
};
