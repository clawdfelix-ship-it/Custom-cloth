/**
 * DTO (Data Transfer Object) 層
 * 
 * 借鑒 Laravel FormRequest + DTO Pattern
 * 
 * 優勢：
 * - 明確的數據結構（IDE 類型提示）
 * - 校驗邏輯與業務邏輯分離
 * - 不可變性（Immutable）
 * - 更容易測試
 */

/**
 * DTO 基類
 */
class BaseDto {
  constructor(data = {}) {
    Object.assign(this, data);
  }

  /**
   * 驗證並轉換為 DTO 實例
   * @static
   * @param {object} data
   * @returns {BaseDto}
   * @throws {ValidationError}
   */
  static from(data) {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('data', 'Invalid DTO data');
    }
    return new this(data);
  }

  /**
   * 安全克隆
   */
  clone() {
    return new this.constructor({ ...this });
  }

  /**
   * 轉為 plain object
   */
  toObject() {
    return { ...this };
  }
}

/**
 * 創建訂單 DTO
 */
class CreateOrderDto extends BaseDto {
  constructor({
    mode = 'new',
    cate1 = '',
    cate2 = '',
    cate3 = '',
    cate4 = '',
    companyName = '',
    contactName = '',
    phone = '',
    address = '',
    requestedDeliveryDate = '',
    sourceOrderId = null,
    items = [],
    // 可選優惠/積分
    useIntegral = false,
    couponId = null,
    // 客戶提供款式
    customText = '',
    customImages = [],
    customAttachments = []
  } = {}) {
    super(arguments[0]);
  }

  static from(data) {
    const dto = new CreateOrderDto({
      mode: data.mode || 'new',
      cate1: String(data.cate1 || '').trim(),
      cate2: String(data.cate2 || '').trim(),
      cate3: String(data.cate3 || '').trim(),
      cate4: String(data.cate4 || '').trim(),
      companyName: String(data.companyName || '').trim(),
      contactName: String(data.contactName || '').trim(),
      phone: String(data.phone || '').trim(),
      address: String(data.address || '').trim(),
      requestedDeliveryDate: String(data.requestedDeliveryDate || '').trim(),
      sourceOrderId: data.sourceOrderId || null,
      items: Array.isArray(data.items) ? data.items.map(i => CreateOrderItemDto.from(i)) : [],
      useIntegral: Boolean(data.useIntegral),
      couponId: data.couponId || null,
      customText: String(data.customText || '').trim(),
      customImages: Array.isArray(data.customImages) ? data.customImages : [],
      customAttachments: Array.isArray(data.customAttachments) ? data.customAttachments : []
    });

    dto.validate();
    return dto;
  }

  validate() {
    if (!this.cate1) throw new ValidationError('cate1', '產品分類必填');
    if (!this.cate2) throw new ValidationError('cate2', '產品子分類必填');
    if (!this.companyName) throw new ValidationError('companyName', '公司名必填');
    if (!this.phone) throw new ValidationError('phone', '電話必填');
    if (!this.address) throw new ValidationError('address', '送貨地址必填');
    if (!this.requestedDeliveryDate) throw new ValidationError('requestedDeliveryDate', '交貨日期必填');
    if (!this.items || this.items.length === 0) {
      throw new ValidationError('items', '至少選擇一個款式');
    }
    return true;
  }
}

/**
 * 訂單商品項 DTO
 */
class CreateOrderItemDto extends BaseDto {
  constructor({ styleId = '', qty = [], customText = '', customImages = [], customAttachments = [] } = {}) {
    super(arguments[0]);
  }

  static from(data) {
    return new CreateOrderItemDto({
      styleId: String(data.styleId || '').trim(),
      qty: data.qty || [],
      customText: String(data.customText || '').trim(),
      customImages: Array.isArray(data.customImages) ? data.customImages : [],
      customAttachments: Array.isArray(data.customAttachments) ? data.customAttachments : []
    });
  }

  validate() {
    if (!this.styleId) throw new ValidationError('styleId', '款式ID必填');
    if (!this.qty || this.qty.length === 0) {
      throw new ValidationError('qty', '尺碼數量必填');
    }
    // 驗證 qty 格式
    for (const item of this.qty) {
      if (!item.size) throw new ValidationError('qty.size', '尺碼必填');
      if (typeof item.qty !== 'number' || item.qty < 0) {
        throw new ValidationError('qty.qty', '數量必須是大於等於0的數字');
      }
    }
    return true;
  }
}

/**
 * 客戶登入 DTO
 */
class LoginDto extends BaseDto {
  constructor({ email = '', password = '' } = {}) {
    super(arguments[0]);
  }

  static from(data) {
    const dto = new LoginDto({
      email: String(data.email || '').trim().toLowerCase(),
      password: String(data.password || '')
    });
    dto.validate();
    return dto;
  }

  validate() {
    if (!this.email) throw new ValidationError('email', 'email必填');
    // 簡單 email 格式校驗
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) {
      throw new ValidationError('email', 'email格式錯誤');
    }
    if (!this.password) throw new ValidationError('password', '密碼必填');
    return true;
  }
}

/**
 * 廠分配 DTO
 */
class AssignFactoryDto extends BaseDto {
  constructor({ orderId = '', factoryUserId = '' } = {}) {
    super(arguments[0]);
  }

  static from(data) {
    const dto = new AssignFactoryDto({
      orderId: String(data.orderId || '').trim(),
      factoryUserId: String(data.factoryUserId || '').trim()
    });
    dto.validate();
    return dto;
  }

  validate() {
    if (!this.orderId) throw new ValidationError('orderId', '訂單ID必填');
    if (!this.factoryUserId) throw new ValidationError('factoryUserId', '工廠ID必填');
    return true;
  }
}

/**
 * 響應 DTO（標準化 API 響應格式）
 */
class ApiResponseDto {
  constructor({ ok = true, data = null, error = null, message = '', meta = null } = {}) {
    this.ok = ok;
    this.data = data;
    this.error = error;
    this.message = message;
    this.meta = meta;
    this.timestamp = new Date().toISOString();
  }

  static success(data, message = '', meta = null) {
    return new ApiResponseDto({ ok: true, data, message, meta });
  }

  static error(error, message = '', meta = null) {
    return new ApiResponseDto({ ok: false, error, message, meta });
  }

  static paginated(data, pagination) {
    return new ApiResponseDto({
      ok: true,
      data,
      meta: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: Math.ceil(pagination.total / pagination.limit)
      }
    });
  }

  toObject() {
    return { ...this };
  }
}

module.exports = {
  BaseDto,
  CreateOrderDto,
  CreateOrderItemDto,
  LoginDto,
  AssignFactoryDto,
  ApiResponseDto
};
