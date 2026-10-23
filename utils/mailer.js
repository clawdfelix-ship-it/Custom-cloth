// Zoho Mail SMTP client (single shared transporter).
//
// Why env-based + fail-open: Vercel/local both run the same code; credentials
// live in environment (never committed). Every caller must check
// isMailConfigured() and treat email as best-effort — an SMTP failure must
// never break checkout or surface a 500 to the customer.
'use strict';

const nodemailer = require('nodemailer');

let cachedTransporter = null;
let configWarned = false;

function getConfig() {
  return {
    host: process.env.ZOHO_SMTP_HOST || 'smtp.zoho.com',
    port: parseInt(process.env.ZOHO_SMTP_PORT || '465', 10),
    secure: String(process.env.ZOHO_SMTP_SECURE || 'true') !== 'false', // 465 → true (SSL), 587 → false (STARTTLS)
    user: process.env.ZOHO_MAIL_USER || '',
    pass: process.env.ZOHO_MAIL_PASS || '',
    fromName: process.env.ZOHO_MAIL_FROM_NAME || 'Ohya',
    fromAddress: process.env.ZOHO_MAIL_FROM_ADDRESS || process.env.ZOHO_MAIL_USER || '',
    // Optional override for where admin order notifications go
    notifyAddress: process.env.ZOHO_ORDER_NOTIFY_ADDRESS || process.env.ZOHO_MAIL_USER || '',
  };
}

function isMailConfigured() {
  const cfg = getConfig();
  return Boolean(cfg.user && cfg.pass && cfg.fromAddress);
}

function getTransporter() {
  if (!isMailConfigured()) return null;
  if (cachedTransporter) return cachedTransporter;

  const cfg = getConfig();
  cachedTransporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    // Serverless egress to Zoho is occasionally flaky: bound every phase so a
    // stalled socket fails fast and our retry loop can open a fresh connection.
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 15000,
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
  });
  return cachedTransporter;
}

function resetTransporter() {
  if (cachedTransporter) {
    try { cachedTransporter.close(); } catch (_) {}
  }
  cachedTransporter = null;
}

// Errors worth a fresh-connection retry (network / TLS / handshake), versus a
// hard reject (auth or bad address) where retrying cannot help.
function isRetryableError(err) {
  if (!err) return false;
  const code = err.code || '';
  const retryableCodes = [
    'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EPIPE',
    'EHOSTUNREACH', 'ENETUNREACH', 'EAI_AGAIN', 'ESOCKET',
  ];
  if (retryableCodes.includes(code)) return true;
  const msg = String(err.message || '').toLowerCase();
  return msg.includes('timeout') || msg.includes('greeting') || msg.includes('socket');
}

/**
 * Send an email. Returns the nodemailer info, or null when mail is not
 * configured / sending failed (error is logged, never thrown — callers are in
 * request paths that must not fail because of SMTP).
 *
 * @param {{to:string, subject:string, html:string, text?:string, cc?:string, bcc?:string}} message
 */
async function sendMail(message) {
  const cfg = getConfig();
  const transporter = getTransporter();
  if (!transporter) {
    if (!configWarned) {
      console.warn('[mailer] Zoho SMTP not configured (set ZOHO_MAIL_USER / ZOHO_MAIL_PASS); skipping email.');
      configWarned = true;
    }
    return null;
  }

  const ATTEMPTS = 3;
  let lastErr = null;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const transporter = getTransporter();
      const info = await transporter.sendMail({
        from: `"${cfg.fromName}" <${cfg.fromAddress}>`,
        to: message.to,
        cc: message.cc,
        bcc: message.bcc,
        subject: message.subject,
        text: message.text || '',
        html: message.html || '',
      });
      return info;
    } catch (err) {
      lastErr = err;
      // Drop the (possibly half-open) pool before retrying on a fresh socket.
      if (isRetryableError(err) && attempt < ATTEMPTS) {
        resetTransporter();
        await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
        continue;
      }
      break;
    }
  }
  console.error('[mailer] send failed after', ATTEMPTS, 'attempts:',
    lastErr && lastErr.message ? `${lastErr.code || ''} ${lastErr.message}` : String(lastErr));
  return null;
}

/**
 * Verify SMTP credentials (admin/diagnostic use only, not per-request).
 * Throws when unconfigured or verification fails.
 */
async function verifyConnection() {
  const transporter = getTransporter();
  if (!transporter) {
    throw new Error('Zoho SMTP not configured');
  }
  await transporter.verify();
  return getConfig();
}

module.exports = {
  sendMail,
  isMailConfigured,
  verifyConnection,
  getConfig,
};
