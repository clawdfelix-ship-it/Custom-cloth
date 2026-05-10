const crypto = require('node:crypto');
const path = require('node:path');
const { put } = require('@vercel/blob');

function parseDataUrl(dataUrl) {
  const raw = typeof dataUrl === 'string' ? dataUrl.trim() : '';
  const m = raw.match(/^data:([^;]+);base64,(.*)$/);
  if (!m) return null;
  const contentType = m[1];
  const b64 = m[2];
  const buf = Buffer.from(b64, 'base64');
  return { contentType, buf };
}

function buildBlobPath(prefix, filename) {
  const ext = filename ? path.extname(filename).toLowerCase() : '';
  const safeExt = ext && ext.length <= 10 ? ext : '';
  return `${prefix}/${Date.now()}_${crypto.randomBytes(8).toString('hex')}${safeExt}`;
}

async function uploadDataUrl(prefix, filename, dataUrl) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;
  const key = buildBlobPath(prefix, filename);
  const r = await put(key, parsed.buf, { access: 'public', contentType: parsed.contentType });
  return { url: r.url, pathname: r.pathname, contentType: parsed.contentType };
}

module.exports = { uploadDataUrl };

