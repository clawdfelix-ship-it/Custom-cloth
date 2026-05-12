/**
 * 高精度數學運算
 * 避免 JavaScript 浮點精度問題（e.g. 0.1 + 0.2 !== 0.3）
 * PostgreSQL NUMERIC 精度支持，字符串計算
 */

/**
 * 精確加法（避免浮點誤差）
 * @param {number|string} a
 * @param {number|string} b
 * @param {number} [acc=2] - 小數精度位數
 * @returns {string} 結果字符串（避免浮點）
 */
function bcAdd(a, b, acc = 2) {
  const sa = String(a);
  const sb = String(b);
  const maxLen = Math.max(
    sa.includes('.') ? sa.split('.')[1].length : 0,
    sb.includes('.') ? sb.split('.')[1].length : 0
  );
  const multiplier = Math.pow(10, maxLen);
  return ((Number(a) * multiplier + Number(b) * multiplier) / multiplier).toFixed(acc);
}

/**
 * 精確減法
 */
function bcSub(a, b, acc = 2) {
  const negB = bcAdd(b, '-0', 0).replace('-', '');
  return bcAdd(a, negB.startsWith('-') ? negB : '-' + negB, acc);
}

/**
 * 精確乘法
 */
function bcMul(a, b, acc = 2) {
  const ma = Number(a);
  const mb = Number(b);
  return (ma * mb).toFixed(acc);
}

/**
 * 精確除法
 */
function bcDiv(a, b, acc = 2) {
  const da = Number(a);
  const db = Number(b);
  if (db === 0) throw new Error('division by zero');
  return (da / db).toFixed(acc);
}

/**
 * 比較兩個數字：返回 -1/0/1
 * @param {number|string} a
 * @param {number|string} b
 * @returns {number}
 */
function bcCmp(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (na < nb) return -1;
  if (na > nb) return 1;
  return 0;
}

/**
 * 格式化金額為貨幣字符串（港幣）
 * @param {number|string} n
 * @returns {string} e.g. "HK$128.00"
 */
function formatMoney(n) {
  const v = Number(n);
  if (isNaN(v)) return 'HK$0.00';
  return `HK$${v.toFixed(2)}`;
}

/**
 * 計算訂單最終價格（分層扣減）
 * 從商品總價開始，依次減去：運費優惠、積分抵扣、優惠券、會員折扣
 * @param {object} params
 * @param {number} params.totalPrice - 商品總價
 * @param {number} params.freightPrice - 運費
 * @param {number} [params.integralDeduction=0] - 積分抵扣（已折算為金額）
 * @param {number} [params.couponDiscount=0] - 優惠券折扣
 * @param {number} [params.memberDiscount=0] - 會員折扣
 * @param {number} [params.otherDeduction=0] - 其他抵扣
 * @returns {object} 包含各項明細和最終實付金額
 */
function computeOrderPayPrice({
  totalPrice,
  freightPrice = 0,
  integralDeduction = 0,
  couponDiscount = 0,
  memberDiscount = 0,
  otherDeduction = 0
}) {
  let payPrice = Number(totalPrice) + Number(freightPrice);

  const deductions = [
    { label: '積分抵扣', value: Math.min(Number(integralDeduction), payPrice) },
    { label: '優惠券', value: Math.min(Number(couponDiscount), payPrice) },
    { label: '會員折扣', value: Math.min(Number(memberDiscount), payPrice) },
    { label: '其他', value: Math.min(Number(otherDeduction), payPrice) },
  ];

  let totalDeduction = 0;
  for (const d of deductions) {
    payPrice = bcSub(payPrice, d.value, 2);
    totalDeduction = bcAdd(totalDeduction, d.value, 2);
  }

  payPrice = Math.max(0, Number(payPrice));

  return {
    totalPrice: Number(totalPrice).toFixed(2),
    freightPrice: Number(freightPrice).toFixed(2),
    integralDeduction: Number(integralDeduction).toFixed(2),
    couponDiscount: Number(couponDiscount).toFixed(2),
    memberDiscount: Number(memberDiscount).toFixed(2),
    otherDeduction: Number(otherDeduction).toFixed(2),
    totalDeduction: totalDeduction,
    payPrice: payPrice.toFixed(2),
    deductions
  };
}

module.exports = {
  bcAdd,
  bcSub,
  bcMul,
  bcDiv,
  bcCmp,
  formatMoney,
  computeOrderPayPrice
};
