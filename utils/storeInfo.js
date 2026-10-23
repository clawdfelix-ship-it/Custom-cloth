// 商店對外公開資料（聯絡 / 收款 / 公司 / 送貨）
// 呢啲係需要喺資訊頁同結帳頁公開俾顧客嘅收款同聯絡資料，統一一個 source of truth。
// 敏感程度低（等同 Diutionary / Lexy 直接喺頁面公開收款戶口），但仍可用環境變數覆蓋。

const env = process.env;

const storeInfo = {
  company: {
    nameEn: 'Hao Yang HK Intl Co Ltd',
    nameZh: '香港浩洋商品代理有限公司',
  },
  contact: {
    whatsappDisplay: '9551 4133',
    whatsappRaw: '85295514133', // wa.me 要用（國碼 852 + 號碼）
    email: 'f.chan@hy-toy.com',
    // 營業性質：以批發分銷為主
  },
  payment: {
    bankName: 'HSBC 滙豐銀行',
    accountName: 'Hao Yang Hong Kong International Co Ltd',
    accountNumber: '741-536536-838',
    fpsId: '100384072',
    // 截圖/入數證明要喺 48 小時內連訂單號 WhatsApp / email 提交
    proofWindowHours: 48,
  },
  shipping: {
    // 日本供港：先到香港倉庫，再本地順豐到付
    originNote: '日本入口，貨到香港倉庫後轉本地順豐派送',
    localCarrier: '順豐速運（運費到付）',
    etaDays: '10–14',
    freightCollect: true,
  },
};

// 環境變數覆蓋（如有需要）
storeInfo.contact.whatsappDisplay = env.STORE_WHATSAPP_DISPLAY || storeInfo.contact.whatsappDisplay;
storeInfo.contact.whatsappRaw = env.STORE_WHATSAPP_RAW || storeInfo.contact.whatsappRaw;
storeInfo.contact.email = env.STORE_EMAIL || storeInfo.contact.email;
storeInfo.payment.bankName = env.PAYMENT_BANK_NAME || storeInfo.payment.bankName;
storeInfo.payment.accountName = env.PAYMENT_BANK_ACCOUNT_NAME || storeInfo.payment.accountName;
storeInfo.payment.accountNumber = env.PAYMENT_BANK_ACCOUNT_NUMBER || storeInfo.payment.accountNumber;
storeInfo.payment.fpsId = env.PAYMENT_FPS_ID || storeInfo.payment.fpsId;

storeInfo.contact.whatsappLink = `https://wa.me/${storeInfo.contact.whatsappRaw}`;

module.exports = { storeInfo };
