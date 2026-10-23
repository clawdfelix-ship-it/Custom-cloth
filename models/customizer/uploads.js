function createUploadsModel(db) {
  return {
    async createUploadedAsset(payload) {
      const result = await db.query(
        `INSERT INTO customizer_uploaded_assets
          (session_id, asset_role, original_filename, mime_type, file_size, width_px, height_px, storage_key, preview_storage_key, status, meta_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
         RETURNING *`,
        [
          payload.sessionId || null,
          payload.assetRole || 'logo',
          payload.originalFilename,
          payload.mimeType,
          payload.fileSize || 0,
          payload.widthPx || null,
          payload.heightPx || null,
          payload.storageKey,
          payload.previewStorageKey || null,
          payload.status || 'active',
          JSON.stringify(payload.meta || {}),
        ]
      );
      return result.rows[0];
    },

    async listSessionAssets(sessionId) {
      const result = await db.query(
        `SELECT *
           FROM customizer_uploaded_assets
          WHERE session_id = $1
          ORDER BY id ASC`,
        [sessionId]
      );
      return result.rows;
    },
  };
}

module.exports = {
  createUploadsModel,
};
