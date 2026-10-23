function buildDesignSession(input = {}) {
  const selection = input.selection && typeof input.selection === 'object' ? input.selection : {};
  const design = input.design && typeof input.design === 'object' ? input.design : {};
  const parts = design.parts && typeof design.parts === 'object' ? design.parts : {};
  const colorZones = design.colorZones && typeof design.colorZones === 'object' ? design.colorZones : {};

  return {
    status: String(input.status || 'draft'),
    selection: {
      productTypeId: selection.productTypeId ?? selection.product_type_id ?? null,
      templateId: selection.templateId ?? selection.template_id ?? null,
    },
    design: {
      templateFamilyId: selection.templateId ?? selection.template_id ?? null,
      parts: {
        body: parts.body ?? null,
        sleeve: parts.sleeve ?? null,
        collar: parts.collar ?? null,
      },
      colorZones: {
        primary: typeof colorZones.primary === 'string' ? colorZones.primary : '#f4f4f5',
        secondary: typeof colorZones.secondary === 'string' ? colorZones.secondary : '#7f1d45',
        trim: typeof colorZones.trim === 'string' ? colorZones.trim : '#fbbf24',
      },
      currentView: String(design.currentView || 'front') === 'back' ? 'back' : 'front',
      texts: design.texts && typeof design.texts === 'object' ? { ...design.texts } : {},
      logos: Array.isArray(design.logos) ? design.logos : [],
      notes: String(design.notes || ''),
    },
    roster: input.roster && typeof input.roster === 'object' ? { ...input.roster } : {},
    uploadedAssets: Array.isArray(input.uploadedAssets) ? input.uploadedAssets : [],
    pricing: input.pricing && typeof input.pricing === 'object' ? { ...input.pricing } : {},
  };
}

function createSessionsModel(db) {
  return {
    async createSession({ sessionToken, productTypeId = null, templateId = null, fulfillmentPath = null }) {
      const result = await db.query(
        `INSERT INTO customizer_sessions
          (session_token, product_type_id, template_id, fulfillment_path)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [sessionToken, productTypeId, templateId, fulfillmentPath]
      );
      return result.rows[0];
    },

    async getSessionById(sessionId) {
      const result = await db.query(
        `SELECT *
           FROM customizer_sessions
          WHERE id = $1`,
        [sessionId]
      );
      return result.rows[0] || null;
    },

    async getLatestDesign(sessionId) {
      const result = await db.query(
        `SELECT *
           FROM customizer_session_designs
          WHERE session_id = $1`,
        [sessionId]
      );
      return result.rows[0] || null;
    },

    async getRoster(sessionId) {
      const rosterResult = await db.query(
        `SELECT *
           FROM customizer_rosters
          WHERE session_id = $1`,
        [sessionId]
      );
      const roster = rosterResult.rows[0] || null;
      if (!roster) return null;

      const itemsResult = await db.query(
        `SELECT player_name, player_number, size_code, quantity, sort_order, meta_json
           FROM customizer_roster_items
          WHERE roster_id = $1
          ORDER BY sort_order ASC, id ASC`,
        [roster.id]
      );

      return {
        ...roster,
        items: itemsResult.rows.map((item) => ({
          playerName: item.player_name,
          playerNumber: item.player_number,
          sizeCode: item.size_code,
          quantity: item.quantity,
          sortOrder: item.sort_order,
          meta: item.meta_json || {},
        })),
      };
    },

    async updateSessionSelection(sessionId, { productTypeId = null, templateId = null } = {}) {
      const result = await db.query(
        `UPDATE customizer_sessions
            SET product_type_id = $2,
                template_id = $3,
                updated_at = NOW()
          WHERE id = $1
        RETURNING *`,
        [sessionId, productTypeId, templateId]
      );
      return result.rows[0] || null;
    },

    async updateSessionCommerce(sessionId, { fulfillmentPath = null, latestPricing = {} } = {}) {
      const result = await db.query(
        `UPDATE customizer_sessions
            SET fulfillment_path = $2,
                latest_pricing_json = $3::jsonb,
                updated_at = NOW()
          WHERE id = $1
        RETURNING *`,
        [sessionId, fulfillmentPath, JSON.stringify(latestPricing || {})]
      );
      return result.rows[0] || null;
    },

    async saveDesign(sessionId, design) {
      const result = await db.query(
        `INSERT INTO customizer_session_designs (session_id, design_json)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (session_id)
         DO UPDATE SET design_json = EXCLUDED.design_json, updated_at = NOW()
         RETURNING *`,
        [sessionId, JSON.stringify(design || {})]
      );
      return result.rows[0];
    },

    async saveRoster(sessionId, totalQuantity, meta = {}) {
      const result = await db.query(
        `INSERT INTO customizer_rosters (session_id, total_quantity, meta_json)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (session_id)
         DO UPDATE SET total_quantity = EXCLUDED.total_quantity, meta_json = EXCLUDED.meta_json, updated_at = NOW()
         RETURNING *`,
        [sessionId, totalQuantity, JSON.stringify(meta || {})]
      );
      const roster = result.rows[0];
      const items = Array.isArray(meta.items) ? meta.items : [];

      await db.query(
        `DELETE FROM customizer_roster_items
          WHERE roster_id = $1`,
        [roster.id]
      );

      for (const item of items) {
        await db.query(
          `INSERT INTO customizer_roster_items
            (roster_id, player_name, player_number, size_code, quantity, sort_order, meta_json)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
          [
            roster.id,
            item.playerName,
            item.playerNumber,
            item.sizeCode,
            item.quantity,
            item.sortOrder || 0,
            JSON.stringify(item.meta || {}),
          ]
        );
      }

      return this.getRoster(sessionId);
    },

    async attachAssets(sessionId, uploadedAssetIds = []) {
      const ids = Array.isArray(uploadedAssetIds) ? uploadedAssetIds.filter(Boolean) : [];
      if (ids.length === 0) return [];
      const result = await db.query(
        `SELECT id, session_id, asset_role, storage_key, preview_storage_key
           FROM customizer_uploaded_assets
          WHERE session_id = $1
            AND id = ANY($2::bigint[])`,
        [sessionId, ids]
      );
      return result.rows;
    },
  };
}

module.exports = {
  buildDesignSession,
  createSessionsModel,
};
