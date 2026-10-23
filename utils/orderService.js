/**
 * orderService.js — 統一訂單轉態入口（旁車）
 *
 * 所有 order 狀態改變應行呢度，唔再周圍直接 UPDATE status。
 * 職責：
 *   1. 用 orderStateMachine 驗證子狀態轉態
 *   2. 集中推导 order.state，一次過寫 orders.status
 *   3. 每次轉態自動寫 order_status_history（審計）
 *
 * 向後兼容：保留 orders.status / payment_status，同步同舊代碼仍可讀。
 * mzakka 同步唔會經呢度（import 預設 stock:0），故唔影響同步。
 */

const sm = require('./orderStateMachine');

/** 建立包裹喺一個 client/transaction 內嘅 order service。傳 pg Pool 或 Client 均可。 */
function createOrderService(db) {
  async function getOrderSnapshot(orderId) {
    const r = await db.query('SELECT id, status, payment_status FROM orders WHERE id=$1', [orderId]);
    if (!r.rows.length) {
      const e = new Error('訂單不存在'); e.code = 'ORDER_NOT_FOUND'; throw e;
    }
    return r.rows[0];
  }

  async function writeHistory(orderId, fromStatus, toStatus, note, processedBy) {
    await db.query(
      `INSERT INTO order_status_history
         (order_id, from_status, to_status, note, processed_by, created_at)
       VALUES ($1,$2,$3,$4,$5,NOW())`,
      [orderId, fromStatus, toStatus, note || null, processedBy || null]
    );
  }

  /** 內部：依新子狀態重算並持久化 order.status，必要時寫 history。 */
  async function persistDerived(orderId, next, ctx) {
    const before = await getOrderSnapshot(orderId);
    const legacy = sm.fromLegacyRow(before);

    const derivedState = sm.deriveOrderState({
      cancelled: next.cancelled ?? legacy.cancelled,
      payment: next.payment ?? legacy.payment,
      fulfillment: next.fulfillment ?? legacy.fulfillment,
    });

    if (derivedState !== before.status) {
      await db.query('UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2', [derivedState, orderId]);
      await writeHistory(orderId, before.status, derivedState, ctx && ctx.note, ctx && ctx.processedBy);
    }
    return derivedState;
  }

  /** 付款子狀態轉換（例如 confirm 收款、退款後回寫）。 */
  async function transitionPayment(orderId, toPayment, ctx) {
    const before = await getOrderSnapshot(orderId);
    const legacy = sm.fromLegacyRow(before);
    sm.transitionPayment(legacy.payment, toPayment); // 非法會 throw

    // payment_status 向後兼容寫入
    const legacyPayment = {
      unpaid: 'pending',
      proof_pending: 'proof_pending',
      paid: 'paid',
      failed: 'failed',
      partially_refunded: 'partially_refunded',
      refunded: 'refunded',
    }[toPayment];
    await db.query('UPDATE orders SET payment_status=$1, updated_at=NOW() WHERE id=$2',
      [legacyPayment, orderId]);

    return persistDerived(orderId, { payment: toPayment }, ctx);
  }

  /** 建立一張出貨單（可分批）。items = [{ order_item_id, quantity }]。 */
  async function createFulfillment(orderId, items, input = {}, ctx) {
    if (!Array.isArray(items) || !items.length) {
      throw Object.assign(new Error('出貨要有最少一項'), { code: 'EMPTY_FULFILLMENT' });
    }
    // 先標記一次 shipping，由推导反映
    // 建立出貨單
    const fr = await db.query(
      `INSERT INTO order_fulfillments
         (order_id, state, shipping_method_code, tracking_number, handler_admin_id, note, shipped_at)
       VALUES ($1,'shipped',$2,$3,$4,$5,NOW()) RETURNING id`,
      [orderId, input.shipping_method_code || null, input.tracking_number || null,
       (ctx && ctx.processedBy) || null, input.note || null]
    );
    const fulfillmentId = fr.rows[0].id;
    for (const it of items) {
      await db.query(
        `INSERT INTO order_fulfillment_items (fulfillment_id, order_item_id, quantity)
         VALUES ($1,$2,$3)`,
        [fulfillmentId, it.order_item_id, it.quantity]
      );
    }

    // 判斷 partial / shipped：比較總出貨量同訂單量
    const agg = await db.query(
      `SELECT
         (SELECT COALESCE(SUM(quantity),0) FROM order_items WHERE order_id=$1) AS ordered,
         (SELECT COALESCE(SUM(quantity),0) FROM order_fulfillment_items offi
            JOIN order_fulfillments f ON f.id=offi.fulfillment_id
            WHERE f.order_id=$1 AND f.state<>'cancelled') AS fulfilled`,
      [orderId]
    );
    const ordered = Number(agg.rows[0].ordered);
    const fulfilled = Number(agg.rows[0].fulfilled);
    const fulfillment = fulfilled >= ordered
      ? sm.FULFILLMENT_STATES.SHIPPED
      : sm.FULFILLMENT_STATES.PARTIALLY_SHIPPED;

    return persistDerived(orderId, { fulfillment }, ctx);
  }

  /** 取消訂單（顯式；未出貨先可以）。 */
  async function cancelOrder(orderId, ctx) {
    const before = await getOrderSnapshot(orderId);
    const legacy = sm.fromLegacyRow(before);
    if (legacy.cancelled) return 'cancelled';
    if (legacy.fulfillment !== sm.FULFILLMENT_STATES.UNFULFILLED) {
      throw Object.assign(new Error('已出貨訂單唔可以直接取消，請安排退貨'), { code: 'INVALID_ORDER_TRANSITION' });
    }
    return persistDerived(orderId, { cancelled: true }, ctx);
  }

  /** 標記完成（買家已收貨／確認交付）。 */
  async function completeOrder(orderId, ctx) {
    const before = await getOrderSnapshot(orderId);
    const legacy = sm.fromLegacyRow(before);
    if (legacy.fulfillment === sm.FULFILLMENT_STATES.DELIVERED) return 'completed';
    if (legacy.fulfillment === sm.FULFILLMENT_STATES.PARTIALLY_SHIPPED) {
      throw Object.assign(new Error('尚有商品未出齊，唔可以標記完成'), { code: 'INVALID_ORDER_TRANSITION' });
    }
    if (legacy.fulfillment === sm.FULFILLMENT_STATES.UNFULFILLED) {
      // 面交／到店自取：補建一張已交付出貨記錄（含全部明細）
      const fr = await db.query(
        `INSERT INTO order_fulfillments (order_id, state, handler_admin_id, note, shipped_at, delivered_at)
         VALUES ($1,'delivered',$2,'面交／自取直接完成',NOW(),NOW()) RETURNING id`,
        [orderId, (ctx && ctx.processedBy) || null]
      );
      const itemsR = await db.query('SELECT id, quantity FROM order_items WHERE order_id=$1', [orderId]);
      for (const r of itemsR.rows) {
        await db.query(
          'INSERT INTO order_fulfillment_items (fulfillment_id, order_item_id, quantity) VALUES ($1,$2,$3)',
          [fr.rows[0].id, r.id, r.quantity]
        );
      }
    } else {
      // shipped → delivered：更新現有出貨單
      sm.transitionFulfillment(legacy.fulfillment, sm.FULFILLMENT_STATES.DELIVERED);
      await db.query(
        `UPDATE order_fulfillments SET state='delivered', delivered_at=NOW(), updated_at=NOW()
         WHERE order_id=$1 AND state='shipped'`, [orderId]
      );
    }
    return persistDerived(orderId, { fulfillment: sm.FULFILLMENT_STATES.DELIVERED }, ctx);
  }

  return {
    transitionPayment,
    createFulfillment,
    cancelOrder,
    completeOrder,
    getOrderSnapshot,
  };
}

module.exports = { createOrderService };
