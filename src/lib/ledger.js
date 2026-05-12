/**
 * 資金流水帳單（Ledger）
 * 借鑒 CRMEB 的 UserBill 設計
 * 所有資金變動（餘額/積分/傭金）都必須記錄流水
 *
 * 優勢：
 * - 收支一目了然
 * - 方便對帳
 * - 可追溯每筆變動原因
 * - 餘額 = Σ(收入 - 支出)
 */
const { sql } = require('./db');

/**
 * 流水類型定義
 * @object LEDGER_TYPES
 */
const LEDGER_TYPES = {
  // 餘額相關
  BALANCE: {
    RECHARGE: 'balance_recharge',        // 餘額充值
    ORDER_PAY: 'balance_order_pay',       // 訂單支付
    ORDER_REFUND: 'balance_order_refund', // 訂單退款
    WITHDRAW: 'balance_withdraw',        // 提現
    WITHDRAW_REJECT: 'balance_withdraw_reject', // 提現退回
    ADJUST: 'balance_adjust',            // 後台調整
  },
  // 積分相關
  INTEGRAL: {
    ORDER_PAY: 'integral_order_pay',     // 訂單積分抵扣
    ORDER_REFUND: 'integral_order_refund',// 退還積分
    SIGN: 'integral_sign',               // 簽到獎勵
    REGISTER: 'integral_register',        // 註冊獎勵
    ADJUST: 'integral_adjust',          // 後台調整
  },
  // 傭金相關
  BROKERAGE: {
    EARN: 'brokerage_earn',             // 獲得傭金
    WITHDRAW: 'brokerage_withdraw',      // 傭金提現
    FROZEN: 'brokerage_frozen',          // 傭金凍結
    UNFREEZE: 'brokerage_unfreeze',      // 解凍
    ORDER_REFUND: 'brokerage_order_refund',// 訂單退款扣回傭金
  },
  // 優惠券相關
  COUPON: {
    RECEIVE: 'coupon_receive',           // 領取優惠券
    USE: 'coupon_use',                   // 使用優惠券
    EXPIRE: 'coupon_expire',             // 優惠券過期
    REFUND: 'coupon_refund',             // 退還優惠券
  }
};

/**
 * 創建流水記錄
 * @param {object} params
 * @param {string} params.accountId - 帳戶ID（customer_id 或 factory_user_id）
 * @param {string} params.accountType - 'customer' | 'factory'
 * @param {string} params.type - 流水類型（如 LEDGER_TYPES.BALANCE.RECHARGE）
 * @param {number} params.amount - 變動金額（正數=收入，負數=支出）
 * @param {number} params.balanceAfter - 變動後餘額
 * @param {string} params.title - 流水標題（如 "訂單支付"）
 * @param {string} [params.orderId] - 關聯訂單ID
 * @param {string} [params.linkId] - 關聯ID（如優惠券ID）
 * @param {string} [params.mark] - 備註
 * @param {object} [params.extra] - 額外JSON數據
 */
async function createLedgerEntry({
  accountId,
  accountType,
  type,
  amount,
  balanceAfter,
  title,
  orderId = null,
  linkId = null,
  mark = '',
  extra = null
}) {
  const pm = amount >= 0 ? 1 : 0; // 1=收入, 0=支出
  const absAmount = Math.abs(Number(amount));

  const result = await sql`
    INSERT INTO ledger (
      account_id, account_type, type, pm, amount,
      balance_after, title, order_id, link_id, mark, extra, created_at
    ) VALUES (
      ${accountId},
      ${accountType},
      ${type},
      ${pm},
      ${absAmount},
      ${Number(balanceAfter).toFixed(2)},
      ${title},
      ${orderId},
      ${linkId},
      ${mark},
      ${extra ? JSON.stringify(extra) : null},
      NOW()
    )
    RETURNING id
  `;
  return result.rows[0];
}

/**
 * 獲取帳戶流水列表（分頁）
 * @param {object} params
 * @param {string} params.accountId
 * @param {string} [params.accountType] - 過濾類型
 * @param {string} [params.type] - 過濾流水類型（前綴匹配）
 * @param {number} [params.page=1]
 * @param {number} [params.limit=20]
 * @returns {object} { entries, total, page, limit }
 */
async function getLedgerEntries({
  accountId,
  accountType = null,
  type = null,
  page = 1,
  limit = 20
}) {
  const offset = (page - 1) * limit;

  let whereClause = sql`WHERE account_id = ${accountId}`;
  if (accountType) {
    whereClause = sql`${whereClause} AND account_type = ${accountType}`;
  }
  if (type) {
    whereClause = sql`${whereClause} AND type LIKE ${type + '%'}`;
  }

  const countResult = await sql`
    SELECT COUNT(*) as total FROM ledger ${whereClause}
  `;
  const total = Number(countResult.rows[0].total);

  const entries = await sql`
    SELECT * FROM ledger
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  return {
    entries: entries.rows,
    total,
    page,
    limit
  };
}

/**
 * 獲取帳戶最新餘額
 * @param {string} accountId
 * @param {string} [accountType='customer']
 * @returns {number}
 */
async function getAccountBalance(accountId, accountType = 'customer') {
  const result = await sql`
    SELECT COALESCE(SUM(CASE WHEN pm = 1 THEN amount ELSE -amount END), 0) as balance
    FROM ledger
    WHERE account_id = ${accountId}
      AND account_type = ${accountType}
  `;
  return Number(result.rows[0].balance);
}

/**
 * 初始化帳戶餘額（後台調整）
 * 設置一個確定的初始值
 */
async function initAccountBalance(accountId, accountType, initialBalance, adminId, reason) {
  const { createLedgerEntry } = require('./ledger');

  // 先讀取當前餘額
  const current = await getAccountBalance(accountId, accountType);
  const diff = Number(initialBalance) - Number(current);

  if (Math.abs(diff) < 0.01) return { ok: true, balance: Number(current).toFixed(2) };

  return await createLedgerEntry({
    accountId,
    accountType,
    type: LEDGER_TYPES.BALANCE.ADJUST,
    amount: diff,
    balanceAfter: initialBalance,
    title: diff >= 0 ? '後台初始化餘額' : '後台調整餘額',
    mark: `原因: ${reason}，操作管理員: ${adminId}，變動: ${diff}`
  });
}

/**
 * 確保 ledger 表存在（migration）
 */
async function ensureLedgerTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS ledger (
      id              SERIAL PRIMARY KEY,
      account_id      VARCHAR(36) NOT NULL,
      account_type    VARCHAR(20) NOT NULL DEFAULT 'customer',
      type            VARCHAR(50) NOT NULL,
      pm              SMALLINT NOT NULL DEFAULT 1,
      amount          NUMERIC(12,2) NOT NULL,
      balance_after   NUMERIC(12,2) NOT NULL DEFAULT 0,
      title           VARCHAR(100) NOT NULL,
      order_id        VARCHAR(36),
      link_id         VARCHAR(36),
      mark            TEXT,
      extra           JSONB,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // 索引
  await sql`
    CREATE INDEX IF NOT EXISTS ledger_account_idx ON ledger(account_id, account_type)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS ledger_type_idx ON ledger(type)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS ledger_created_idx ON ledger(created_at DESC)
  `;
}

module.exports = {
  LEDGER_TYPES,
  createLedgerEntry,
  getLedgerEntries,
  getAccountBalance,
  initAccountBalance,
  ensureLedgerTable
};
