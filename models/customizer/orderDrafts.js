function createOrderDraftsModel(db) {
  return {
    async createOrderDraft({ sessionId, deliverable = {}, note = '' }) {
      const result = await db.query(
        `INSERT INTO customizer_order_drafts (session_id, deliverable_json, note)
         VALUES ($1, $2::jsonb, $3)
         RETURNING *`,
        [sessionId, JSON.stringify(deliverable || {}), note]
      );
      return result.rows[0];
    },
  };
}

module.exports = {
  createOrderDraftsModel,
};
