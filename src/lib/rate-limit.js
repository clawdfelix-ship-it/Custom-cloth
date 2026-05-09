function shouldBlockLogin(failCount) {
  return Number(failCount) >= 5;
}

function getClientIp(req) {
  const h = req && req.headers ? req.headers['x-forwarded-for'] : '';
  const raw = typeof h === 'string' ? h : Array.isArray(h) ? h[0] : '';
  const ip = raw ? raw.split(',')[0].trim() : '';
  return ip || (req && req.socket && req.socket.remoteAddress) || '';
}

module.exports = { shouldBlockLogin, getClientIp };

