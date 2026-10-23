const { mapDbProductToStorefrontProduct } = require('./storefrontDbMapper');

function mapRowsToRankingProducts(rows, { toProxyUrl }) {
  return (rows || []).map(r => mapDbProductToStorefrontProduct(r, { toProxyUrl }));
}

module.exports = { mapRowsToRankingProducts };

