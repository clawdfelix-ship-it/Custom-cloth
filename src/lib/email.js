const nodemailer = require('nodemailer');

function getSmtpConfig() {
  const host = process.env.SMTP_HOST || '';
  const port = Number(process.env.SMTP_PORT || 0);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  const from = process.env.SMTP_FROM || '';
  if (!host || !port || !user || !pass || !from) return null;
  return { host, port, secure, auth: { user, pass }, from };
}

async function sendMail({ to, subject, html, text }) {
  const cfg = getSmtpConfig();
  if (!cfg) return { ok: false, error: 'email_not_configured' };
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.auth
  });
  await transporter.sendMail({ from: cfg.from, to, subject, html, text });
  return { ok: true };
}

module.exports = { sendMail };
