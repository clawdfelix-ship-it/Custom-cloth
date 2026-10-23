// Transactional email content + sending for order lifecycle (Zoho SMTP).
// Content builders are pure (return {to, subject, html, text}); they are used
// to enqueue into the email_outbox so delivery can be retried reliably.
'use strict';

const { sendMail, getConfig } = require('./mailer');

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(n) {
  return `HK$${Number(n || 0).toFixed(2)}`;
}

function renderItemsText(items) {
  return items
    .map((it) => `  ${it.quantity} x ${it.name} — ${money(Number(it.unit_price) * Number(it.quantity))}`)
    .join('\n');
}

function renderItemsHtml(items) {
  return items
    .map(
      (it) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;">${esc(it.name)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center;">${esc(it.quantity)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;">${money(Number(it.unit_price) * Number(it.quantity))}</td>
        </tr>`
    )
    .join('');
}

function layout(title, bodyHtml, bodyText) {
  return {
    html: `<!doctype html>
<html lang="zh-HK">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f6f4;font-family:-apple-system,'PingFang HK','Helvetica Neue',Arial,sans-serif;color:#222;">
  <div style="max-width:560px;margin:0 auto;padding:24px 12px;">
    <div style="background:#fff;border-radius:14px;overflow:hidden;border:1px solid #eee;">
      <div style="background:#1f2a44;padding:20px 24px;">
        <span style="color:#fff;font-size:18px;font-weight:600;letter-spacing:.5px;">Ohya</span>
      </div>
      <div style="padding:24px;">
        <h1 style="font-size:19px;margin:0 0 16px;">${esc(title)}</h1>
        ${bodyHtml}
      </div>
      <div style="padding:16px 24px;background:#fafaf8;border-top:1px solid #eee;font-size:12px;color:#888;">
        此電郵由系統自動發出，請勿直接回覆。<br>© Ohya
      </div>
    </div>
  </div>
</body>
</html>`,
    text: `${title}\n\n${bodyText}\n\n—\n此電郵由系統自動發出，請勿直接回覆。\n© Ohya`,
  };
}

/** Build the customer confirmation message; returns null when no recipient. */
function buildOrderConfirmation(order, items) {
  if (!order.email) return null;

  const bodyText = [
    `${order.contact_name || '顧客'}，你好：`,
    '',
    `多謝落單！訂單 ${order.order_number} 已確認，我們正在安排。`,
    '',
    '訂單項目：',
    renderItemsText(items),
    '',
    `訂單總額：${money(order.total_amount)}`,
    `付款方式：${order.payment_method_code === 'fps' ? 'FPS 轉數快' : (order.payment_method_label || '銀行轉帳')}`,
    '',
    order.note ? `訂單備註：${order.note}\n` : '',
    '如有查詢，可於會員中心查看訂單或聯絡我們。',
  ]
    .filter(Boolean)
    .join('\n');

  const bodyHtml = `
    <p style="margin:0 0 12px;">${esc(order.contact_name || '顧客')}，你好：</p>
    <p style="margin:0 0 20px;">多謝落單！訂單 <strong>${esc(order.order_number)}</strong> 已確認，我們正在安排。</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
      <thead>
        <tr style="background:#fafaf8;">
          <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #eee;">商品</th>
          <th style="padding:10px 12px;border-bottom:2px solid #eee;">數量</th>
          <th style="padding:10px 12px;text-align:right;border-bottom:2px solid #eee;">小計</th>
        </tr>
      </thead>
      <tbody>${renderItemsHtml(items)}</tbody>
    </table>
    <table style="width:100%;font-size:14px;margin-bottom:8px;">
      <tr><td style="padding:4px 0;color:#666;">訂單總額</td><td style="padding:4px 0;text-align:right;font-weight:600;">${money(order.total_amount)}</td></tr>
      <tr><td style="padding:4px 0;color:#666;">付款方式</td><td style="padding:4px 0;text-align:right;">${order.payment_method_code === 'fps' ? 'FPS 轉數快' : esc(order.payment_method_label || '銀行轉帳')}</td></tr>
    </table>
    ${order.note ? `<p style="font-size:13px;color:#666;margin:16px 0 0;">訂單備註：${esc(order.note)}</p>` : ''}
  `;

  const tpl = layout(`訂單確認｜${order.order_number}`, bodyHtml, bodyText);
  return {
    to: order.email,
    subject: `【Ohya】訂單確認 ${order.order_number}`,
    html: tpl.html,
    text: tpl.text,
  };
}

/** Build the admin new-order notification; returns null when no recipient. */
function buildAdminNewOrder(order, items) {
  const cfg = getConfig();
  if (!cfg.notifyAddress) return null;

  const bodyText = [
    `新訂單：${order.order_number}`,
    `客戶：${order.contact_name}｜${order.contact_phone}`,
    `地址：${order.contact_address || ''}`,
    `總額：${money(order.total_amount)}｜付款：${order.payment_method_code}`,
    '',
    renderItemsText(items),
  ].join('\n');

  const bodyHtml = `
    <p style="margin:0 0 12px;">新訂單 <strong>${esc(order.order_number)}</strong></p>
    <table style="width:100%;font-size:14px;margin-bottom:16px;">
      <tr><td style="padding:3px 0;color:#666;">客戶</td><td style="padding:3px 0;">${esc(order.contact_name)}｜${esc(order.contact_phone)}</td></tr>
      <tr><td style="padding:3px 0;color:#666;">地址</td><td style="padding:3px 0;">${esc(order.contact_address || '')}</td></tr>
      <tr><td style="padding:3px 0;color:#666;">總額</td><td style="padding:3px 0;"><strong>${money(order.total_amount)}</strong></td></tr>
      <tr><td style="padding:3px 0;color:#666;">付款</td><td style="padding:3px 0;">${esc(order.payment_method_code)}</td></tr>
    </table>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">${renderItemsHtml(items)}</table>
  `;

  const tpl = layout(`新訂單通知｜${order.order_number}`, bodyHtml, bodyText);
  return {
    to: cfg.notifyAddress,
    subject: `【Ohya 新訂單】${order.order_number} — ${money(order.total_amount)}`,
    html: tpl.html,
    text: tpl.text,
  };
}

async function sendOrderConfirmation(order, items) {
  const msg = buildOrderConfirmation(order, items);
  return msg ? sendMail(msg) : null;
}

async function sendAdminNewOrder(emailOrder, itemRows) {
  const msg = buildAdminNewOrder(emailOrder, itemRows);
  return msg ? sendMail(msg) : null;
}

module.exports = {
  buildOrderConfirmation,
  buildAdminNewOrder,
  sendOrderConfirmation,
  sendAdminNewOrder,
};
