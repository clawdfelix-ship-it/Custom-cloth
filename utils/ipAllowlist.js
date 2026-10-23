function parseAllowedIps(value) {
  const raw = String(value || '');
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return new Set(parts);
}

function normalizeIp(ip) {
  const s = String(ip || '').trim();
  if (!s) return '';
  if (s.startsWith('::ffff:')) return s.slice('::ffff:'.length);
  return s;
}

function extractClientIp({ xForwardedFor, remoteAddress }) {
  const xff = String(xForwardedFor || '').trim();
  if (xff) {
    const first = xff.split(',')[0].trim();
    return normalizeIp(first);
  }
  return normalizeIp(remoteAddress);
}

function isIpAllowed(allowedSet, ip) {
  if (!allowedSet || allowedSet.size === 0) return true;
  const v = normalizeIp(ip);
  if (!v) return false;
  return allowedSet.has(v);
}

module.exports = { parseAllowedIps, extractClientIp, isIpAllowed };

