/**
 * 積分核心服務
 * - 設定讀取（app_settings，帶預設）
 * - 賺分 / 扣分 / 人手調整（一律落 points_transactions 流水 + 更新 users.points）
 * - 訂單完成自動發分、取消/退款自動扣返（冪等：order_id+type 唯一）
 *
 * users.points 係權威結餘；member_points 表係舊設計，呢度唔依賴佢，
 * 統一用 users.points + points_transactions，避免兩邊唔一致。
 */

const DEFAULTS = {
  points_enabled: true,
  points_earn_hkd: 100,   // 每 100 HKD 賺 1 分
  points_redeem_hkd: 100, // 每 100 分 = 1 HKD
  points_min_redeem: 100,
  points_expiry_days: 0,
};

async function loadConfig(pool) {
  const keys = Object.keys(DEFAULTS);
  const r = await pool.query(
    'SELECT key, value FROM app_settings WHERE key = ANY($1)',
    [keys]
  );
  const map = {};
  r.rows.forEach((row) => { map[row.key] = row.value; });

  return {
    enabled: (map.points_enabled == null ? DEFAULTS.points_enabled : map.points_enabled !== '0'),
    earnHkd: Number(map.points_earn_hkd) || DEFAULTS.points_earn_hkd,
    redeemHkd: Number(map.points_redeem_hkd) || DEFAULTS.points_redeem_hkd,
    minRedeem: Number(map.points_min_redeem) || DEFAULTS.points_min_redeem,
    expiryDays: Number(map.points_expiry_days) || 0,
  };
}

// 賺幾多分：消費 HKD / earnHkd，向下取整，唔出負數
function pointsForSpend(hkd, cfg) {
  const h = Number(hkd) || 0;
  const denom = Number(cfg.earnHkd) || DEFAULTS.points_earn_hkd;
  if (h <= 0 || denom <= 0) return 0;
  return Math.floor(h / denom);
}

// N 分值幾多 HKD 折扣
function pointsToHkd(points, cfg) {
  const p = Number(points) || 0;
  const denom = Number(cfg.redeemHkd) || DEFAULTS.points_redeem_hkd;
  if (p <= 0 || denom <= 0) return 0;
  return p / denom;
}

// HKD 折扣要幾多分（向上取整，俾前台預覽用）
function hkdToPoints(hkd, cfg) {
  const h = Number(hkd) || 0;
  const denom = Number(cfg.redeemHkd) || DEFAULTS.points_redeem_hkd;
  if (h <= 0) return 0;
  return Math.ceil(h * denom);
}

/**
 * 內用：喺已有 client/transaction 入面過一筆積分帳。
 * entry = { userId, points(+/-), type, description, orderId, expiresAt }
 * 冪等：orderId+type 唯一；若已存在就當成功並回傳 alreadyApplied。
 */
async function postEntry(client, entry) {
  const pts = parseInt(entry.points, 10);
  if (!Number.isInteger(pts) || pts === 0) {
    throw new Error('points must be a non-zero integer');
  }
  if (!entry.userId) throw new Error('userId required');

  // 冪等檢查（有 orderId 先做）
  if (entry.orderId != null && entry.type) {
    const exist = await client.query(
      'SELECT id FROM points_transactions WHERE order_id = $1 AND type = $2 LIMIT 1',
      [entry.orderId, entry.type]
    );
    if (exist.rows.length) return { applied: false, alreadyApplied: true };
  }

  // 扣分前檢查結餘
  if (pts < 0) {
    const u = await client.query('SELECT points FROM users WHERE id = $1 FOR UPDATE', [entry.userId]);
    const balance = parseInt((u.rows[0] && u.rows[0].points) || 0, 10);
    if (balance + pts < 0) {
      throw Object.assign(new Error('積分結餘不足'), { code: 'POINTS_INSUFFICIENT' });
    }
  }

  await client.query(
    `INSERT INTO points_transactions
       (user_id, points, type, description, order_id, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      entry.userId, pts, entry.type, entry.description || null,
      entry.orderId == null ? null : entry.orderId,
      entry.expiresAt || null,
    ]
  );

  await client.query(
    'UPDATE users SET points = GREATEST(0, points + $1), updated_at = NOW() WHERE id = $2',
    [pts, entry.userId]
  );

  return { applied: true, alreadyApplied: false, points: pts };
}

/**
 * 訂單完成 → 發分。用 order.total_amount（實際消費；若有兌換折扣，
 * total_amount 已係折後，自然唔會對折扣部分再發分）。
 * 必須喺調用方嘅 DB transaction 內呼叫（傳 client）。
 */
async function awardOrderPoints(client, order, cfg) {
  if (!cfg.enabled) return { skipped: true, reason: 'disabled' };
  if (!order || order.user_id == null) return { skipped: true, reason: 'no_user' };

  const pts = pointsForSpend(order.total_amount, cfg);
  if (pts <= 0) return { skipped: true, reason: 'zero_points' };

  const res = await postEntry(client, {
    userId: order.user_id,
    points: pts,
    type: 'earn',
    description: '訂單完成賺分 ' + (order.order_number || '#' + order.id),
    orderId: order.id,
  });
  return Object.assign({ points: pts }, res);
}

/**
 * 訂單取消 / 全單退款 → 扣返之前發嘅分。
 * 若從未發分（例如未完成就取消），就冇也需要扣。
 * reclaim=要扣嘅分；預設搵返該 order 嘅 earn 流水全數追回。
 */
async function revokeOrderPoints(client, order /*, cfg */) {
  if (!order || order.user_id == null) return { skipped: true, reason: 'no_user' };

  const earnRows = await client.query(
    "SELECT id, points FROM points_transactions WHERE order_id = $1 AND type = 'earn'",
    [order.id]
  );
  if (!earnRows.rows.length) return { skipped: true, reason: 'never_awarded' };

  const totalEarned = earnRows.rows.reduce((s, r) => s + parseInt(r.points, 10), 0);
  if (totalEarned <= 0) return { skipped: true, reason: 'nothing_to_revoke' };

  // 用 type='revoke'，同 earn 唔同，唔會撞唯一約束；order+revoke 自身亦冪等。
  const res = await postEntry(client, {
    userId: order.user_id,
    points: -totalEarned,
    type: 'revoke',
    description: '訂單取消/退款追回積分 ' + (order.order_number || '#' + order.id),
    orderId: order.id,
  });
  return Object.assign({ revoked: totalEarned }, res);
}

/**
 * 後台人手調整（獨立事務，可 + / -）。
 */
async function adjustPoints(pool, { userId, points, reason, adminId }) {
  const pts = parseInt(points, 10);
  if (!Number.isInteger(pts) || pts === 0) {
    throw Object.assign(new Error('請輸入非零整數'), { code: 'POINTS_INVALID' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await postEntry(client, {
      userId,
      points: pts,
      type: 'adjust',
      description:
        (pts > 0 ? '後台手動加分：' : '後台手動扣分：') +
        (reason || '冇提供原因') +
        (adminId ? '（admin #' + adminId + '）' : ''),
    });
    await client.query('COMMIT');

    const u = await pool.query('SELECT points FROM users WHERE id = $1', [userId]);
    return { result: res, balance: parseInt(u.rows[0].points, 10) };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function getHistory(pool, userId, { page = 1, pageSize = 20 } = {}) {
  const p = Math.max(1, page);
  const ps = Math.min(100, pageSize);
  const countR = await pool.query(
    'SELECT COUNT(*)::int AS n FROM points_transactions WHERE user_id = $1',
    [userId]
  );
  const rowsR = await pool.query(
    `SELECT points, type, description, order_id, created_at
     FROM points_transactions WHERE user_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT $2 OFFSET $3`,
    [userId, ps, (p - 1) * ps]
  );
  return {
    total: countR.rows[0].n,
    page: p,
    pageSize: ps,
    totalPages: Math.max(1, Math.ceil(countR.rows[0].n / ps)),
    rows: rowsR.rows,
  };
}

module.exports = {
  loadConfig,
  pointsForSpend,
  pointsToHkd,
  hkdToPoints,
  postEntry,
  awardOrderPoints,
  revokeOrderPoints,
  adjustPoints,
  getHistory,
};
