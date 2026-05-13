/**
 * 自定義錯誤類層次
 * 借鑒 Laravel Exceptions 設計
 * 所有業務異常都應該是 ApiError 的子類
 */

class AppError extends Error {
  constructor(message, code = 'INTERNAL_ERROR', statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      ok: false,
      error: this.code,
      message: this.message,
      ...(this.details && { details: this.details })
    };
  }
}

// 400 Bad Request
class BadRequestError extends AppError {
  constructor(message = '請求格式錯誤', code = 'BAD_REQUEST', details = null) {
    super(message, code, 400, details);
  }
}

class ValidationError extends BadRequestError {
  constructor(field, message) {
    super(message, 'VALIDATION_ERROR', 400, { field });
  }
}

class UnauthorizedError extends AppError {
  constructor(message = '未授權', code = 'UNAUTHORIZED') {
    super(message, code, 401);
  }
}

class ForbiddenError extends AppError {
  constructor(message = '無權限訪問', code = 'FORBIDDEN') {
    super(message, code, 403);
  }
}

class NotFoundError extends AppError {
  constructor(resource = '資源', code = 'NOT_FOUND') {
    super(`${resource}不存在或已刪除`, code, 404);
  }
}

class ConflictError extends AppError {
  constructor(message, code = 'CONFLICT') {
    super(message, code, 409);
  }
}

// 422 Unprocessable Entity（業務邏輯錯誤）
class UnprocessableError extends AppError {
  constructor(message, code = 'UNPROCESSABLE') {
    super(message, code, 422);
  }
}

// 429 Too Many Requests
class RateLimitError extends AppError {
  constructor(retryAfter = 60) {
    super('操作太頻繁，請稍後再試', 'RATE_LIMITED', 429, { retryAfter });
  }
}

/**
 * 訂單相關錯誤
 */
class OrderError extends AppError {
  constructor(message, code = 'ORDER_ERROR') {
    super(message, code, 422);
  }
}

class OrderNotFoundError extends OrderError {
  constructor() {
    super('訂單不存在', 'ORDER_NOT_FOUND');
  }
}

class OrderStatusTransitionError extends OrderError {
  constructor(from, to) {
    super(`訂單狀態不能從 ${from} 變更為 ${to}`, 'INVALID_STATUS_TRANSITION');
    this.details = { from, to };
  }
}

class OrderAlreadyPaidError extends OrderError {
  constructor() {
    super('訂單已支付，不能重複操作', 'ALREADY_PAID');
  }
}

class OrderExpiredError extends OrderError {
  constructor() {
    super('訂單已過期或已被取消', 'ORDER_EXPIRED');
  }
}

/**
 * 庫存相關錯誤
 */
class StockError extends AppError {
  constructor(message, code = 'STOCK_ERROR') {
    super(message, code, 422);
  }
}

class InsufficientStockError extends StockError {
  constructor(sku, requested, available) {
    super(`SKU ${sku} 庫存不足，請求${requested}，可用${available}`, 'INSUFFICIENT_STOCK');
    this.details = { sku, requested, available };
  }
}

/**
 * 工廠相關錯誤
 */
class FactoryError extends AppError {
  constructor(message, code = 'FACTORY_ERROR') {
    super(message, code, 422);
  }
}

class FactoryNotAssignedError extends FactoryError {
  constructor() {
    super('訂單尚未分配工廠', 'FACTORY_NOT_ASSIGNED');
  }
}

class FactoryCapacityError extends FactoryError {
  constructor() {
    super('工廠產能已滿，請選擇其他工廠', 'FACTORY_CAPACITY_FULL');
  }
}

module.exports = {
  AppError,
  BadRequestError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  UnprocessableError,
  RateLimitError,
  OrderError,
  OrderNotFoundError,
  OrderStatusTransitionError,
  OrderAlreadyPaidError,
  OrderExpiredError,
  StockError,
  InsufficientStockError,
  FactoryError,
  FactoryNotAssignedError,
  FactoryCapacityError
};
