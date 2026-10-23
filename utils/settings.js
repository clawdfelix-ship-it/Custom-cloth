/**
 * 全店 key/value 設定（app_settings 表）
 * 目前用於 JPY→HKD 匯率；將來其他可調參數都可放呢度。
 */

async function getSetting(pool, key) {
  const r = await pool.query('SELECT value, updated_at, updated_by FROM app_settings WHERE key = $1', [key]);
  return r.rows[0] || null;
}

async function setSetting(pool, key, value, updatedBy) {
  const r = await pool.query(
    `INSERT INTO app_settings (key, value, updated_at, updated_by)
     VALUES ($1, $2, NOW(), $3)
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by
     RETURNING value, updated_at`,
    [key, value === null || value === undefined ? null : String(value), updatedBy || null]
  );
  return r.rows[0];
}

module.exports = { getSetting, setSetting };
