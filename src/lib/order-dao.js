/**
 * 訂單數據訪問層（DAO）
 * 借鑒 CRMEB 的 Dao 搜索器模式
 *
 * 所有訂單相關的複雜查詢都集中在這裡
 * Model 只定義結構，DAO 封裝查詢邏輯
 */
const { sql } = require('./db');

/**
 * 訂單狀態常量
 */
const ORDER_STATUS = {
  PENDING_PAY: '客戶已提交',    // 0: 待付款
  PAID: '已確認',              // 1: 已付款/已確認
  PROCESSING: '工廠已接單',    // 2: 工廠已接單
  PRODUCING: '生產中',         // 3: 生產中
  QC: 'QC中',                 // 4: 質檢中
  SHIPPED: '已發貨',          // 5: 已發貨
  COMPLETED: '已完成',        // 6: 已完成
  CANCELLED: '已取消',        // -1: 已取消
  REFUND: '退款中',           // -2: 退款中
  REFUNDED: '已退款',          // -3: 已退款
};

/**
 * 解析狀態字符串為數字
 */
function parseStatusNum(status) {
  const map = {
    '客戶已提交': 0,
    '已確認': 1,
    '工廠已接單': 2,
    '生產中': 3,
    'QC中': 4,
    '已發貨': 5,
    '已完成': 6,
    '已取消': -1,
    '退款中': -2,
    '已退款': -3,
  };
  return map[status] ?? 0;
}

/**
 * 構建訂單列表查詢條件
 * @param {object} params
 * @returns {object} { whereSQL, params, countSQL }
 */
function buildOrderWhere({ status, factoryId, customerId, orderSn, dateFrom, dateTo, factoryStatus }) {
  const conditions = [];
  const params = {};

  if (customerId) {
    conditions.push(`customer_id = @customerId`);
    params.customerId = customerId;
  }
  if (factoryId) {
    conditions.push(`factory_user_id = @factoryId`);
    params.factoryId = factoryId;
  }
  if (orderSn) {
    conditions.push(`order_sn ILIKE @orderSn`);
    params.orderSn = `%${orderSn}%`;
  }
  if (dateFrom) {
    conditions.push(`create_time >= @dateFrom`);
    params.dateFrom = dateFrom;
  }
  if (dateTo) {
    conditions.push(`create_time < @dateTo::date + interval '1 day'`);
    params.dateTo = dateTo;
  }
  if (status && status !== 'all') {
    conditions.push(`status = @status`);
    params.status = status;
  }
  if (factoryStatus) {
    // 工廠視角的狀態（對應工廠專用的狀態映射）
    conditions.push(`factory_status = @factoryStatus`);
    params.factoryStatus = factoryStatus;
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  return { whereClause, params };
}

/**
 * 獲取訂單列表（分頁）
 * @param {object} params
 * @returns {object} { orders, total, page, limit }
 */
async function getOrderList({
  customerId = null,
  factoryId = null,
  status = null,
  orderSn = '',
  dateFrom = '',
  dateTo = '',
  page = 1,
  limit = 20,
  factoryStatus = null,
  selectFields = '*'
}) {
  const offset = (page - 1) * limit;

  // 避免 SQL 注入：使用 tagged template 安全參數
  const whereParts = [];
  const queryParams = {};

  if (customerId) {
    whereParts.push(`o.customer_id = @customerId`);
    queryParams.customerId = customerId;
  }
  if (factoryId) {
    whereParts.push(`o.factory_user_id = @factoryId`);
    queryParams.factoryId = factoryId;
  }
  if (orderSn) {
    whereParts.push(`o.order_sn ILIKE @orderSn`);
    queryParams.orderSn = `%${orderSn}%`;
  }
  if (dateFrom) {
    whereParts.push(`o.create_time >= @dateFrom::date`);
    queryParams.dateFrom = dateFrom;
  }
  if (dateTo) {
    whereParts.push(`o.create_time < (@dateTo::date + interval '1 day')`);
    queryParams.dateTo = dateTo;
  }
  if (status && status !== 'all') {
    whereParts.push(`o.status = @status`);
    queryParams.status = status;
  }

  const whereClause = whereParts.length > 0
    ? `WHERE ${whereParts.join(' AND ')}`
    : '';

  // 總數
  const countResult = await sql`
    SELECT COUNT(*) as total
    FROM orders o
    ${sql.unsafe(whereClause)}
  `.parameters(queryParams);

  // 查詢列表
  const orders = await sql`
    SELECT o.id, o.order_sn, o.status, o.create_time,
           o.requested_delivery_date, o.suggested_delivery_date,
           o.factory_name, o.order_type, o.cate1, o.cate2,
           o.cust_name, o.cust_phone, o.cust_address,
           o.factory_user_id, o.lookup_code
    FROM orders o
    ${sql.unsafe(whereClause)}
    ORDER BY o.create_time DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `.parameters(queryParams);

  return {
    orders: orders.rows,
    total: Number(countResult.rows[0].total),
    page,
    limit
  };
}

/**
 * 獲取訂單詳情（包含 items）
 * @param {string} orderId
 * @param {string} [requestorId] - 校驗：customer_id 或 factory_user_id
 * @param {string} [requestorType] - 'customer' | 'factory' | 'admin'
 */
async function getOrderDetail(orderId, requestorId = null, requestorType = 'admin') {
  const order = await sql`
    SELECT o.*,
           u.nickname as factory_user_name,
           u.phone as factory_user_phone
    FROM orders o
    LEFT JOIN users u ON u.id = o.factory_user_id
    WHERE o.id = ${orderId}
  `;

  if (!order.rows[0]) return null;

  const orderData = order.rows[0];

  // 權限校驗
  if (requestorType === 'customer' && requestorId && orderData.customer_id !== requestorId) {
    return null;
  }
  if (requestorType === 'factory' && requestorId && orderData.factory_user_id !== requestorId) {
    return null;
  }

  // 查詢 items
  const items = await sql`
    SELECT oi.*, s.name as style_name, s.code as style_code, s.img_url as style_img
    FROM order_items oi
    LEFT JOIN styles s ON s.id = oi.style_id
    WHERE oi.order_id = ${orderId}
  `;

  return {
    ...orderData,
    items: items.rows
  };
}

/**
 * 更新訂單狀態（帶校驗和狀態機）
 * @param {string} orderId
 * @param {string} newStatus
 * @param {string} operatorType - 'customer' | 'factory' | 'admin' | 'system'
 * @param {object} [extra] - 額外更新字段
 */
async function updateOrderStatus(orderId, newStatus, operatorType = 'system', extra = {}) {
  const { parseStatus } = require('./order-dao');

  const order = await sql`SELECT id, status FROM orders WHERE id = ${orderId}`;
  if (!order.rows[0]) throw new Error('order_not_found');

  const oldStatus = order.rows[0].status;

  // 狀態機校驗
  const validTransitions = {
    '客戶已提交': ['已確認', '已取消'],
    '已確認': ['工廠已接單', '已取消'],
    '工廠已接單': ['生產中', '已取消'],
    '生產中': ['QC中', '已取消'],
    'QC中': ['已發貨'],
    '已發貨': ['已完成'],
    '已完成': [],
    '已取消': [],
    '退款中': ['已退款', '已確認'],
    '已退款': [],
  };

  const allowed = validTransitions[oldStatus] || [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`invalid_transition: ${oldStatus} -> ${newStatus}`);
  }

  const updateData = {
    status: newStatus,
    updated_at: new Date().toISOString(),
    ...extra
  };

  // 如果是工廠接單，記錄工廠接單時間
  if (newStatus === '工廠已接單') {
    updateData.factory_accept_time = new Date().toISOString();
  }
  if (newStatus === '已發貨') {
    updateData.ship_time = new Date().toISOString();
  }
  if (newStatus === '已完成') {
    updateData.complete_time = new Date().toISOString();
  }

  await sql`UPDATE orders SET ${sql(updateData)} WHERE id = ${orderId}`;

  // 記錄狀態變更日誌
  await sql`
    INSERT INTO order_status_log (order_id, old_status, new_status, operator_type, created_at)
    VALUES (${orderId}, ${oldStatus}, ${newStatus}, ${operatorType}, NOW())
  `;

  return { oldStatus, newStatus };
}

/**
 * 獲取工廠儀表板統計
 * @param {string} factoryId
 */
async function getFactoryStats(factoryId) {
  const stats = await sql`
    SELECT
      COUNT(*) FILTER (WHERE status = '工廠已接單') as pending_count,
      COUNT(*) FILTER (WHERE status = '生產中') as producing_count,
      COUNT(*) FILTER (WHERE status = 'QC中') as qc_count,
      COUNT(*) FILTER (WHERE status = '已發貨') as shipped_count,
      COUNT(*) FILTER (WHERE create_time > NOW() - interval '7 days') as new_orders_7d,
      COUNT(*) FILTER (WHERE create_time > NOW() - interval '30 days') as new_orders_30d
    FROM orders
    WHERE factory_user_id = ${factoryId}
  `;

  return stats.rows[0];
}

/**
 * 計算訂單銷售統計
 * @param {object} params
 */
async function getSalesStats({ dateFrom, dateTo, factoryId }) {
  const whereParts = [`status IN ('已完成', '已發貨', 'QC中', '生產中')`];
  const params = {};

  if (dateFrom) {
    whereParts.push(`create_time >= @dateFrom`);
    params.dateFrom = dateFrom;
  }
  if (dateTo) {
    whereParts.push(`create_time < @dateTo::date + interval '1 day'`);
    params.dateTo = dateTo;
  }
  if (factoryId) {
    whereParts.push(`factory_user_id = @factoryId`);
    params.factoryId = factoryId;
  }

  const whereClause = whereParts.join(' AND ');

  const stats = await sql`
    SELECT
      COUNT(*) as total_orders,
      SUM(COALESCE(total_amount, 0)) as total_amount,
      COUNT(*) FILTER (WHERE status = '已完成') as completed_orders,
      COUNT(*) FILTER (WHERE status = '已發貨') as shipped_orders,
      COUNT(*) FILTER (WHERE status = 'QC中') as qc_orders,
      COUNT(*) FILTER (WHERE status = '生產中') as producing_orders
    FROM orders
    WHERE ${sql.unsafe(whereClause)}
  `.parameters(params);

  return stats.rows[0];
}

module.exports = {
  ORDER_STATUS,
  parseStatusNum,
  buildOrderWhere,
  getOrderList,
  getOrderDetail,
  updateOrderStatus,
  getFactoryStats,
  getSalesStats
};
