function createPreviewsModel(db) {
  return {
    async savePreviewRefs(sessionId, previews = {}) {
      const entries = Object.entries(previews).filter(([, preview]) => preview && preview.storageKey);
      const saved = [];

      for (const [side, preview] of entries) {
        const result = await db.query(
          `INSERT INTO customizer_session_previews (session_id, preview_side, storage_key, mime_type, meta_json)
           VALUES ($1, $2, $3, $4, $5::jsonb)
           RETURNING *`,
          [
            sessionId,
            side,
            preview.storageKey,
            preview.mimeType || 'image/png',
            JSON.stringify(preview.meta || {}),
          ]
        );
        saved.push(result.rows[0]);
      }

      return saved;
    },

    async getLatestPreviews(sessionId) {
      const result = await db.query(
        `SELECT DISTINCT ON (preview_side) *
           FROM customizer_session_previews
          WHERE session_id = $1
          ORDER BY preview_side, created_at DESC, id DESC`,
        [sessionId]
      );
      return result.rows;
    },
  };
}

module.exports = {
  createPreviewsModel,
};
