function createQuotesModel(db) {
  return {
    async createQuoteRequest({ sessionId, deliverable = {}, note = '', uploadedAssetIds = [] }) {
      const quoteResult = await db.query(
        `INSERT INTO customizer_quote_requests (session_id, deliverable_json, note)
         VALUES ($1, $2::jsonb, $3)
         RETURNING *`,
        [sessionId, JSON.stringify(deliverable || {}), note]
      );

      const quote = quoteResult.rows[0];
      const ids = Array.isArray(uploadedAssetIds) ? uploadedAssetIds.filter(Boolean) : [];

      for (const uploadedAssetId of ids) {
        await db.query(
          `INSERT INTO customizer_quote_request_assets (quote_request_id, uploaded_asset_id)
           VALUES ($1, $2)`,
          [quote.id, uploadedAssetId]
        );
      }

      return quote;
    },
  };
}

module.exports = {
  createQuotesModel,
};
