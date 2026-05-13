/**
 * 傭金/分銷服務
 * 
 * 借鑒 CRMEB UserBrokerageServices + UserSpreadServices
 * 
 * 功能：
 * - 傭金帳戶管理
 * - 推廣關係建立（首次下單時綁定上下線）
 * - 訂單完成後結算傭金（一級 + 二級）
 * - 傭金提現申請
 * - 工廠傭金結算
 */
const { sql } = require('../lib/db');
const { emit, EVENTS } = require('../lib/events');

/** 推廣員成為條件：消費滿足以下任一 */
const PROMOTER_CONFIGS = {
  MIN_ORDER_COUNT: 3,         // 最少消費訂單數
  MIN_TOTAL_AMOUNT: 2000,      // 或累計消費滿 HK$2000
};

/** 傭金結算配置 */
const BROKERAGE_CONFIGS = {
  // 一級推薦傭金（直接推薦）
  LEVEL_1_RATE: 0.05,         // 5%
  // 二級推薦傭金（間接推薦）
  LEVEL_2_RATE: 0.02,          // 2%
  // 工廠傭金（工廠完成訂單）
  FACTORY_RATE: 0.03,          // 3%
  // 結算週期（天）
  SETTLEMENT_DAYS: 30,
  // 提現最低金額
  WITHDRAW_MIN: 100,
};

/**
 * 創建傭金帳戶
 * @param {string} accountId - customer_id 或 factory_user_id
 * @param {string} accountType - 'customer' | 'factory'
 * @param {object} [options]
 */
async function createBrokerageAccount(accountId, accountType = 'customer', options = {}) {
  const { commissionRate = 0.05, secondRate = 0.02, agentLevel = null } = options;

  try {
    await sql`
      INSERT INTO brokerage_accounts (account_id, account_type, agent_level, commission_rate, second_rate)
      VALUES (${accountId}, ${accountType}, ${agentLevel}, ${commissionRate}, ${secondRate})
      ON CONFLICT (account_id, account_type) DO NOTHING
    `;
  } catch (e) {
    // 已存在，忽略
  }
}

/**
 * 獲取傭金帳戶
 * @param {string} accountId
 * @param {string} [accountType='customer']
 */
async function getBrokerageAccount(accountId, accountType = 'customer') {
  const result = await sql`
    SELECT * FROM brokerage_accounts
    WHERE account_id = ${accountId} AND account_type = ${accountType}
  `;
  return result.rows[0] || null;
}

/**
 * 綁定推廣關係（只能在首次下單時建立）
 * 
 * 流程：
 * 1. 檢查 customer 是否已有 spread_uid（只能建立一次）
 * 2. 檢查是否循環推廣（A 不能推薦 B，B 不能推薦 A）
 * 3. 寫入 spread_records 表
 * 4. 更新 customers.spread_uid
 * 
 * @param {string} customerId - 被推薦的客戶ID
 * @param {string} spreadUid - 推廣員的 customer_id
 * @param {string} [orderId] - 關聯訂單
 */
async function bindSpreadRelation(customerId, spreadUid, orderId = null) {
  // 不能推薦自己
  if (customerId === spreadUid) {
    throw new Error('不能推薦自己');
  }

  // 檢查是否已有上級
  const existing = await sql`
    SELECT spread_uid FROM customers WHERE id = ${customerId}
  `;
  if (existing.rows[0]?.spread_uid) {
    return { bound: false, reason: 'already_bound' };
  }

  // 檢查循環推廣
  const hasCircle = await checkSpreadCircle(customerId, spreadUid);
  if (hasCircle) {
    throw new Error('推廣關係非法（檢測到循環）');
  }

  // 寫入 spread_records
  await sql`
    INSERT INTO spread_records (inviter_id, invitee_id, order_id, level)
    VALUES (${spreadUid}, ${customerId}, ${orderId}, 1)
    ON CONFLICT (invitee_id) DO NOTHING
  `;

  // 更新 customers
  await sql`
    UPDATE customers
    SET spread_uid = ${spreadUid}, spread_time = NOW()
    WHERE id = ${customerId}
  `;

  // 發送事件
  emit(EVENTS.USER_SPREAD_BINDING, {
    inviterId: spreadUid,
    inviteeId: customerId,
    orderId
  });

  return { bound: true, inviterId: spreadUid, inviteeId: customerId };
}

/**
 * 檢查是否形成循環推廣
 */
async function checkSpreadCircle(customerId, spreadUid) {
  let currentId = spreadUid;
  const visited = new Set();

  while (currentId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const result = await sql`
      SELECT spread_uid FROM customers WHERE id = ${currentId}
    `;
    currentId = result.rows[0]?.spread_uid;

    if (currentId === customerId) return true;  // 發現循環
  }
  return false;
}

/**
 * 結算訂單傭金（訂單完成後調用）
 * 
 * 流程：
 * 1. 查找 customer 的上級（level_1）
 * 2. 查找上上級（level_2）
 * 3. 計算傭金金額
 * 4. 寫入 brokerage_ledger
 * 5. 更新 brokerage_accounts 余額
 * 
 * @param {object} order - 訂單對象
 * @param {number} orderAmount - 訂單金額（用於計算傭金基數）
 */
async function settleOrderBrokerage(order, orderAmount) {
  const customerId = order.customer_id;

  // 查找一級推廣人
  const level1Result = await sql`
    SELECT c.id, c.spread_uid, c.is_promoter, ba.commission_rate
    FROM customers c
    LEFT JOIN brokerage_accounts ba ON ba.account_id = c.id AND ba.account_type = 'customer'
    WHERE c.id = ${customerId}
  `;

  const level1Id = level1Result.rows[0]?.spread_uid;
  if (!level1Id) {
    console.log(`[Brokerage] 客戶 ${customerId} 無上級推廣人，跳過傭金結算`);
    return;
  }

  const level1Rate = Number(level1Result.rows[0]?.commission_rate || BROKERAGE_CONFIGS.LEVEL_1_RATE);
  const level1Amount = Number((orderAmount * level1Rate).toFixed(2));

  // ===== 一級傭金 =====
  await addBrokerageLedger({
    accountId: level1Id,
    orderId: order.id,
    fromCustomerId: customerId,
    ledgerType: 'earn',
    amount: level1Amount,
    title: `推薦訂單獎勵（一級）`,
    orderSn: order.order_sn
  });

  // ===== 二級傭金 =====
  const level2Result = await sql`
    SELECT c.spread_uid, ba.commission_rate
    FROM customers c
    LEFT JOIN brokerage_accounts ba ON ba.account_id = c.id AND ba.account_type = 'customer'
    WHERE c.id = ${level1Id}
  `;

  const level2Id = level2Result.rows[0]?.spread_uid;
  if (level2Id) {
    const level2Rate = Number(level2Result.rows[0]?.commission_rate || BROKERAGE_CONFIGS.LEVEL_2_RATE);
    const level2Amount = Number((orderAmount * level2Rate).toFixed(2));

    await addBrokerageLedger({
      accountId: level2Id,
      orderId: order.id,
      fromCustomerId: customerId,
      ledgerType: 'earn',
      amount: level2Amount,
      title: `推薦訂單獎勵（二級）`,
      orderSn: order.order_sn
    });
  }

  // ===== 工廠傭金 =====
  if (order.factory_user_id) {
    const factoryResult = await sql`
      SELECT commission_rate FROM brokerage_accounts
      WHERE account_id = ${order.factory_user_id} AND account_type = 'factory'
    `;
    const factoryRate = Number(factoryResult.rows[0]?.commission_rate || BROKERAGE_CONFIGS.FACTORY_RATE);
    const factoryAmount = Number((orderAmount * factoryRate).toFixed(2));

    await addBrokerageLedger({
      accountId: order.factory_user_id,
      orderId: order.id,
      fromCustomerId: customerId,
      ledgerType: 'earn',
      amount: factoryAmount,
      title: `訂單完成傭金`,
      orderSn: order.order_sn
    });
  }
}

/**
 * 添加傭金流水
 */
async function addBrokerageLedger({
  accountId,
  orderId = null,
  fromCustomerId = null,
  ledgerType,
  amount,
  title,
  orderSn = null,
  mark = ''
}) {
  const account = await getBrokerageAccount(accountId);
  if (!account) {
    console.log(`[Brokerage] 帳戶不存在: ${accountId}，跳過`);
    return;
  }

  const newAvailable = bcAdd(account.available_amount, amount);
  const newFrozen = account.frozen_amount;
  const newTotalEarned = bcAdd(account.total_earned, amount);

  await sql`
    INSERT INTO brokerage_ledger (
      account_id, order_id, from_customer_id, ledger_type, pm, amount,
      balance_after, frozen_after, title, order_sn, mark
    )
    VALUES (
      ${accountId}, ${orderId}, ${fromCustomerId}, ${ledgerType}, 1, ${amount},
      ${newAvailable}, ${newFrozen}, ${title}, ${orderSn}, ${mark}
    )
  `;

  // 更新帳戶余額
  await sql`
    UPDATE brokerage_accounts
    SET available_amount = ${newAvailable},
        total_earned = ${newTotalEarned},
        updated_at = NOW()
    WHERE account_id = ${accountId}
  `;
}

/**
 * 申請提現
 * @param {string} accountId
 * @param {number} amount - 提現金額
 */
async function applyWithdraw(accountId, amount) {
  const account = await getBrokerageAccount(accountId);
  if (!account) throw new Error('brokerage_account_not_found');

  if (Number(account.available_amount) < amount) {
    throw new Error(`可提現餘額不足：${account.available_amount}`);
  }

  if (amount < BROKERAGE_CONFIGS.WITHDRAW_MIN) {
    throw new Error(`最低提現金額：HK$${BROKERAGE_CONFIGS.WITHDRAW_MIN}`);
  }

  // 凍結金額
  const newAvailable = bcAdd(account.available_amount, -amount);
  const newFrozen = bcAdd(account.frozen_amount, amount);

  await sql`
    UPDATE brokerage_accounts
    SET available_amount = ${newAvailable},
        frozen_amount = ${newFrozen},
        updated_at = NOW()
    WHERE account_id = ${accountId}
  `;

  // 記錄流水
  await sql`
    INSERT INTO brokerage_ledger (account_id, ledger_type, pm, amount, balance_after, frozen_after, title)
    VALUES (${accountId}, 'withdraw', 0, ${amount}, ${newAvailable}, ${newFrozen}, '提現申請')
  `;

  return { success: true, amount, newAvailable, newFrozen };
}

/**
 * 獲取傭金流水（分頁）
 * @param {string} accountId
 * @param {number} [page=1]
 * @param {number} [limit=20]
 */
async function getBrokerageLedger(accountId, page = 1, limit = 20) {
  const offset = (page - 1) * limit;

  const countResult = await sql`
    SELECT COUNT(*) as total FROM brokerage_ledger WHERE account_id = ${accountId}
  `;
  const total = Number(countResult.rows[0].total);

  const entries = await sql`
    SELECT * FROM brokerage_ledger
    WHERE account_id = ${accountId}
    ORDER BY created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  return {
    entries: entries.rows,
    total,
    page,
    limit,
    available: await getBrokerageAccount(accountId)
  };
}

/**
 * 獲取推廣下線列表
 * @param {string} inviterId - 推廣員ID
 * @param {number} [page=1]
 */
async function getMyInvites(inviterId, page = 1, limit = 20) {
  const offset = (page - 1) * limit;

  const countResult = await sql`
    SELECT COUNT(*) as total FROM spread_records WHERE inviter_id = ${inviterId}
  `;
  const total = Number(countResult.rows[0].total);

  const invites = await sql`
    SELECT sr.*, c.company_name, c.contact_name, c.phone, c.spread_time,
           o.order_sn, o.create_time as order_time
    FROM spread_records sr
    JOIN customers c ON c.id = sr.invitee_id
    LEFT JOIN orders o ON o.id = sr.order_id
    WHERE sr.inviter_id = ${inviterId}
    ORDER BY sr.created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  return { invites: invites.rows, total, page, limit };
}

/**
 * 檢查客戶是否滿足成為推廣員的條件
 * @param {string} customerId
 */
async function checkPromoterQualification(customerId) {
  const customer = await sql`
    SELECT c.total_amount, c.total_points,
           (SELECT COUNT(*) FROM orders WHERE customer_id = ${customerId} AND status NOT IN ('已取消', '退款中')) as order_count
    FROM customers c
    WHERE c.id = ${customerId}
  `;

  if (!customer.rows[0]) return { qualified: false, reason: 'customer_not_found' };

  const { total_amount, total_points, order_count } = customer.rows[0];

  const orderCountOk = Number(order_count) >= PROMOTER_CONFIGS.MIN_ORDER_COUNT;
  const amountOk = Number(total_amount) >= PROMOTER_CONFIGS.MIN_TOTAL_AMOUNT;

  return {
    qualified: orderCountOk || amountOk,
    orderCount: Number(order_count),
    totalAmount: Number(total_amount),
    configs: PROMOTER_CONFIGS
  };
}

module.exports = {
  BROKERAGE_CONFIGS,
  PROMOTER_CONFIGS,
  createBrokerageAccount,
  getBrokerageAccount,
  bindSpreadRelation,
  checkSpreadCircle,
  settleOrderBrokerage,
  addBrokerageLedger,
  applyWithdraw,
  getBrokerageLedger,
  getMyInvites,
  checkPromoterQualification
};
