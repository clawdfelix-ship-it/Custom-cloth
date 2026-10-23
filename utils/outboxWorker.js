// Email outbox worker: claims due pending rows and delivers via Zoho SMTP.
// Called by Vercel cron and (best-effort) right after checkout on a warm
// instance. Exponential backoff between attempts; gives up after max_attempts.
'use strict';

const { sendMail, isMailConfigured } = require('./mailer');

// Exponential backoff (seconds) by the attempt number about to happen.
function backoffSeconds(attempt) {
  // 1→immediate-ish(5s), then 30s, 1m, 2m, 5m, 10m, 30m
  const table = [0, 5, 30, 60, 120, 300, 600, 1800];
  return table[attempt] != null ? table[attempt] : 1800;
}

/**
 * Deliver due outbox messages.
 * @param {object} dbPool pg Pool
 * @param {{limit?:number, maxRuntimeMs?:number}} opts
 */
async function flushOutbox(dbPool, opts = {}) {
  const limit = opts.limit || 20;
  const maxRuntimeMs = opts.maxRuntimeMs || 50000;
  const deadline = Date.now() + maxRuntimeMs;

  const result = { processed: 0, sent: 0, failed: 0, deferred: 0, skipped: false };
  if (!dbPool || !isMailConfigured()) {
    result.skipped = true;
    return result;
  }

  // Phase 1 — claim a batch (short transaction, SKIP LOCKED), bump attempts and
  // park the rows so a concurrent/overlapping run can't grab them too.
  let ids = [];
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    const claim = await client.query(
      `
        SELECT id FROM email_outbox
        WHERE status = 'pending' AND available_at <= now()
        ORDER BY available_at
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      `,
      [limit]
    );
    ids = claim.rows.map((r) => r.id);
    if (ids.length === 0) {
      await client.query('ROLLBACK');
      return result;
    }
    await client.query(
      `
        UPDATE email_outbox
        SET attempts = attempts + 1,
            available_at = now() + interval '1 second' * 600
        WHERE id = ANY($1)
      `,
      [ids]
    );
    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }

  // Phase 2 — deliver outside any lock.
  const { rows } = await dbPool.query(
    `SELECT * FROM email_outbox WHERE id = ANY($1) ORDER BY id`,
    [ids]
  );

  for (const row of rows) {
    if (Date.now() > deadline) {
      await dbPool.query(
        `UPDATE email_outbox SET available_at = now()
         WHERE id = $1 AND status = 'pending'`,
        [row.id]
      );
      result.deferred += 1;
      continue;
    }

    result.processed += 1;
    const info = await sendMail({
      to: row.to_address,
      cc: row.cc_address,
      bcc: row.bcc_address,
      subject: row.subject,
      html: row.html_body,
      text: row.text_body,
    });

    if (info && info.messageId) {
      await dbPool.query(
        `UPDATE email_outbox
         SET status = 'sent', sent_at = now(), last_error = NULL, available_at = now()
         WHERE id = $1`,
        [row.id]
      );
      result.sent += 1;
    } else if (row.attempts >= row.max_attempts) {
      await dbPool.query(
        `UPDATE email_outbox SET status = 'failed', last_error = $2
         WHERE id = $1`,
        [row.id, 'exceeded max attempts']
      );
      result.failed += 1;
    } else {
      const wait = backoffSeconds(row.attempts);
      await dbPool.query(
        `UPDATE email_outbox
         SET available_at = now() + interval '1 second' * $2, last_error = $3
         WHERE id = $1`,
        [row.id, wait, 'send returned null']
      );
      result.deferred += 1;
    }
  }

  return result;
}

module.exports = {
  flushOutbox,
  backoffSeconds,
};
