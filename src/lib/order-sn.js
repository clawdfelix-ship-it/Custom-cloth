const crypto = require('node:crypto');

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatYmdHms(d) {
  return [
    d.getUTCFullYear(),
    pad(d.getUTCMonth() + 1),
    pad(d.getUTCDate()),
    pad(d.getUTCHours()),
    pad(d.getUTCMinutes()),
    pad(d.getUTCSeconds())
  ].join('');
}

function generateOrderSn(now = new Date()) {
  const ts = formatYmdHms(now);
  const suffix = crypto.randomBytes(3).toString('hex');
  return `ORD${ts}-${suffix}`;
}

module.exports = { generateOrderSn };

