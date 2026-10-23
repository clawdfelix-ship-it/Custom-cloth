const { Pool } = require('pg');

let cachedPool;
let cachedConnectionString;

function getConnectionString() {
  if (cachedConnectionString !== undefined) return cachedConnectionString;
  cachedConnectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || null;
  return cachedConnectionString;
}

function getPool() {
  if (cachedPool !== undefined) return cachedPool;

  const connectionString = getConnectionString();
  if (!connectionString) {
    cachedPool = null;
    return cachedPool;
  }

  // SSL config:
  // Neon pooler endpoints (`*-pooler.c-N.us-east-X.aws.neon.tech`) terminate
  // SSL at the proxy; pg client must NOT set `ssl: { ... }` or it will fail
  // negotiation with "server does not support SSL connections".
  //
  // For direct (non-pooler) Neon endpoints, SSL IS required — controlled
  // by `?sslmode=require` in the connection string. pg respects that
  // automatically when `ssl` is not set in client options.
  //
  // Fix 2026-10-02: remove forced `ssl` flag in production. Let the
  // connection string's `sslmode=require` drive behavior end-to-end
  // (pg handles pooler + non-pooler transparently).
  const isPoolerEndpoint = connectionString.includes('-pooler.');
  const useSsl = !isPoolerEndpoint && /sslmode=require|sslmode=verify-full/i.test(connectionString);

  cachedPool = new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  return cachedPool;
}

module.exports = { getConnectionString, getPool };
