const { sql } = require('./db');

async function audit(actorUserId, action, entityType, entityId, payload) {
  await sql`
    insert into audit_logs (actor_user_id, action, entity_type, entity_id, payload)
    values (${actorUserId || null}::uuid, ${action}, ${entityType}, ${entityId || null}, ${payload ? JSON.stringify(payload) : null}::jsonb)
  `;
}

module.exports = { audit };

