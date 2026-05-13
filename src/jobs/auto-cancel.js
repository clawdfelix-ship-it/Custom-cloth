/**
 * 自動取消未付款訂單 Job
 * 
 * 流程：
 * 1. 查詢所有"客戶已提交"狀態且創建時間 > 30分鐘的訂單
 * 2. 對每個訂單：
 *    a. 校驗是否仍是"客戶已提交"（避免並發問題）
 *    b. 釋放預扣庫存
 *    c. 更新狀態為"已取消"
 *    d. 記錄狀態日誌
 *    e. 發送事件通知
 * 
 * 使用方式（在 Vercel Cron 或 API endpoint 中調用）：
 *   import { runAutoCancelJob } from './jobs/auto-cancel'
 *   await runAutoCancelJob()
 */
const { sql } = require('../lib/db');
const { emit, EVENTS } = require('../lib/events');
const { updateOrderStatus } = require('../lib/order-dao');

/** 訂單自動取消時長（分鐘） */
const AUTO_CANCEL_MINUTES = parseInt(process.env.ORDER_AUTO_CANCEL_MINUTES || '30', 10);

/**
 * 查找需要自動取消的訂單
 * @returns {Promise<Array>}
 */
async function findUnpaidOrdersToCancel() {
  const cutoff = new Date(Date.now() - AUTO_CANCEL_MINUTES * 60 * 1000);

  const result = await sql`
    SELECT 
      o.id, o.order_sn, o.status, o.create_time,
      o.customer_id,
      c.email as customer_email,
      c.contact_name as customer_name
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    WHERE o.status = '客戶已提交'
      AND o.paid = 0
      AND o.create_time < ${cutoff.toISOString()}
      
    ORDER BY o.create_time ASC
    LIMIT 100
  `;

  return result.rows;
}

/**
 * 釋放訂單預扣的庫存
 * @param {object} order
 */
async function releaseOrderStock(order) {
  // 查詢訂單商品
  const items = await sql`
    SELECT oi.style_id, oi.qty, oi.style_id as attr_id
    FROM order_items oi
    WHERE oi.order_id = ${order.id}
  `;

  // 這裡調用庫存服務（如果有獨立的庫存管理）
  // 目前訂單創建時是直接扣減，這裡需要回加
  // 預留接口，未來獨立庫存模組時實現
  console.log(`[AutoCancel] 釋放訂單 ${order.order_sn} 庫存:`, items.rows.length, '項');

  // TODO: 調用庫存服務回加庫存
  // await stockService.incStock(order.id)
}

/**
 * 發送取消通知（短信/郵件）
 * @param {object} order
 */
async function sendCancelNotification(order) {
  // 預留接口，未來接入短信/郵件服務
  console.log(`[AutoCancel] 通知客戶 ${order.customer_email} 訂單已自動取消: ${order.order_sn}`);

  // TODO: 接入短信服務
  // await smsService.send(order.customer_phone, `您的訂單 ${order.order_sn} 已自動取消`)
}

/**
 * 執行自動取消
 * @param {object} options
 * @param {boolean} [options.dryRun=false] - 是否 dry run（不實際修改）
 * @param {number} [options.limit=100] - 最大處理數量
 * @returns {object} 處理結果統計
 */
async function runAutoCancelJob({ dryRun = false, limit = 100 } = {}) {
  const startTime = Date.now();
  let processed = 0;
  let success = 0;
  let skipped = 0;
  let errors = [];

  const orders = await findUnpaidOrdersToCancel();
  console.log(`[AutoCancel] 找到 ${orders.length} 個待取消訂單`);

  for (const order of orders) {
    if (processed >= limit) break;
    processed++;

    try {
      if (dryRun) {
        console.log(`[DryRun] 將取消訂單: ${order.order_sn} (創建於 ${order.create_time})`);
        success++;
        continue;
      }

      // 再次校驗狀態（並發保護）
      const current = await sql`
        SELECT status FROM orders WHERE id = ${order.id}
      `;
      if (current.rows[0]?.status !== '客戶已提交') {
        skipped++;
        console.log(`[Skip] 訂單 ${order.order_sn} 狀態已變更: ${current.rows[0]?.status}`);
        continue;
      }

      // 釋放庫存
      await releaseOrderStock(order);

      // 更新狀態（使用狀態機）
      await updateOrderStatus(order.id, '已取消', 'system');

      // 發送通知
      await sendCancelNotification(order);

      // 發送事件
      emit(EVENTS.ORDER_CANCELLED, {
        orderId: order.id,
        orderSn: order.order_sn,
        reason: 'auto_cancel',
        cancelledAt: new Date().toISOString()
      });

      success++;
      console.log(`[OK] 已自動取消訂單: ${order.order_sn}`);

    } catch (err) {
      errors.push({ orderId: order.id, orderSn: order.order_sn, error: err.message });
      console.error(`[Error] 取消訂單 ${order.order_sn} 失敗:`, err.message);
    }
  }

  const duration = Date.now() - startTime;
  const result = { processed, success, skipped, errors, duration, dryRun };

  console.log(`[AutoCancel] 完成: ${JSON.stringify(result)}`);
  return result;
}

// Vercel Cron Job 入口
// Vercel Cron 調用 GET/POST /api/jobs/auto-cancel
// Cron schedule 在 vercel.json crons 配置
async function handleCronRequest(req, res) {
  // 簡單的安全校驗（Production 應用環境變量 token）
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.CRON_SECRET;

  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }

  try {
    const result = await runAutoCancelJob();
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[AutoCancel] Job failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = {
  runAutoCancelJob,
  findUnpaidOrdersToCancel,
  releaseOrderStock,
  sendCancelNotification,
  handleCronRequest,
  AUTO_CANCEL_MINUTES
};
