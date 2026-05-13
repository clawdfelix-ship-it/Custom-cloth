/**
 * 事件系統
 * 借鑒 Laravel Events + CRMEB 的 CustomEventListener 設計
 *
 * 優勢：
 * - 解耦業務邏輯（發送短信/郵件/推送 不用寫在 Order Services 裡）
 * - 方便測試（Mock Event Listener）
 * - 可異步處理（隊列）
 */

/** @type {Map<string, Set<Function>>} */
const listeners = new Map();

/**
 * 註冊事件監聽器
 * @param {string} eventName - 事件名
 * @param {Function} handler - 處理函數
 * @returns {Function} 取消監聽的函數
 */
function on(eventName, handler) {
  if (!listeners.has(eventName)) {
    listeners.set(eventName, new Set());
  }
  listeners.get(eventName).add(handler);

  // 返回取消監聽函數
  return () => {
    listeners.get(eventName)?.delete(handler);
  };
}

/**
 * 觸發事件（同步）
 * @param {string} eventName
 * @param  {...any} args
 */
function emit(eventName, ...args) {
  const handlers = listeners.get(eventName);
  if (!handlers) return;

  for (const handler of handlers) {
    try {
      handler(...args);
    } catch (err) {
      console.error(`[Event] Handler error for "${eventName}":`, err);
    }
  }
}

/**
 * 觸發事件（異步，靜默忽略錯誤）
 * @param {string} eventName
 * @param  {...any} args
 */
async function emitAsync(eventName, ...args) {
  const handlers = listeners.get(eventName);
  if (!handlers) return;

  await Promise.allSettled(
    [...handlers].map(async (handler) => {
      try {
        await handler(...args);
      } catch (err) {
        console.error(`[Event] Async handler error for "${eventName}":`, err);
      }
    })
  );
}

/**
 * 一次性監聽器
 * @param {string} eventName
 * @param {Function} handler
 */
function once(eventName, handler) {
  const wrapper = (...args) => {
    off(eventName, wrapper);
    handler(...args);
  };
  on(eventName, wrapper);
}

/**
 * 移除監聽器
 * @param {string} eventName
 * @param {Function} handler
 */
function off(eventName, handler) {
  listeners.get(eventName)?.delete(handler);
}

/**
 * 清除所有監聽器
 * @param {string} [eventName] - 不傳則清除所有
 */
function clearAll(eventName) {
  if (eventName) {
    listeners.delete(eventName);
  } else {
    listeners.clear();
  }
}

/**
 * 獲取事件監聽器數量（調試用）
 * @param {string} eventName
 */
function listenerCount(eventName) {
  return listeners.get(eventName)?.size ?? 0;
}

// ==================== 內置事件常量 ====================

const EVENTS = {
  // 訂單事件
  ORDER_CREATED: 'order.created',
  ORDER_PAID: 'order.paid',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_COMPLETED: 'order.completed',
  ORDER_STATUS_CHANGED: 'order.status_changed',

  // 工廠事件
  FACTORY_ASSIGNED: 'factory.assigned',
  FACTORY_ACCEPTED: 'factory.accepted',
  FACTORY_COMPLETED: 'factory.completed',

  // 用戶事件
  USER_REGISTERED: 'user.registered',
  USER_LOGIN: 'user.login',
  USER_SPREAD_BINDING: 'user.spread_binding',

  // 支付事件
  PAY_SUCCESS: 'pay.success',
  PAY_FAILED: 'pay.failed',
  REFUND_SUCCESS: 'refund.success',

  // 營銷事件
  COUPON_RECEIVED: 'coupon.received',
  COUPON_USED: 'coupon.used',

  // 系統事件
  SYSTEM_NOTIFICATION: 'system.notification',
};

/**
 * 內置監聽器工廠（可按需啟用）
 */
function registerBuiltinListeners() {
  // 訂單創建時記錄審計日誌
  on(EVENTS.ORDER_CREATED, async (order) => {
    console.log(`[Event] 訂單創建: ${order.orderSn}`);
  });

  // 訂單狀態變更時記錄日誌
  on(EVENTS.ORDER_STATUS_CHANGED, async ({ orderId, oldStatus, newStatus }) => {
    console.log(`[Event] 訂單狀態變更: ${orderId} ${oldStatus} → ${newStatus}`);
  });

  // 工廠分配時通知工廠
  on(EVENTS.FACTORY_ASSIGNED, async ({ order, factory }) => {
    console.log(`[Event] 訂單 ${order.orderSn} 已分配給工廠 ${factory.name}`);
  });
}

module.exports = {
  EVENTS,
  on,
  emit,
  emitAsync,
  once,
  off,
  clearAll,
  listenerCount,
  registerBuiltinListeners
};
