function getBearerToken(authorizationHeader) {
  const h = typeof authorizationHeader === 'string' ? authorizationHeader : '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

module.exports = { getBearerToken };

