const crypto = require('node:crypto');

function generateLookupCode() {
  return crypto.randomBytes(4).toString('hex');
}

module.exports = { generateLookupCode };

