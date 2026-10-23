function parseAllowedOrigins(envValue) {
  const raw = (envValue || '').trim();
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function isLocalhostOrigin(origin) {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function buildCorsOptions({ nodeEnv, allowedOriginsEnv }) {
  const allowedOrigins = parseAllowedOrigins(allowedOriginsEnv);
  const isProd = nodeEnv === 'production';
  return {
    credentials: true,
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (!isProd && isLocalhostOrigin(origin)) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
  };
}

module.exports = { parseAllowedOrigins, buildCorsOptions };

