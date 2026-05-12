-- 資金流水帳單表
CREATE TABLE IF NOT EXISTS ledger (
    id              SERIAL PRIMARY KEY,
    account_id      VARCHAR(36) NOT NULL,
    account_type    VARCHAR(20) NOT NULL DEFAULT 'customer',
    type            VARCHAR(50) NOT NULL,
    pm              SMALLINT NOT NULL DEFAULT 1,
    amount          NUMERIC(12,2) NOT NULL,
    balance_after   NUMERIC(12,2) NOT NULL DEFAULT 0,
    title           VARCHAR(100) NOT NULL,
    order_id        VARCHAR(36),
    link_id         VARCHAR(36),
    mark            TEXT,
    extra           JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ledger_account_idx ON ledger(account_id, account_type);
CREATE INDEX IF NOT EXISTS ledger_type_idx ON ledger(type);
CREATE INDEX IF NOT EXISTS ledger_created_idx ON ledger(created_at DESC);

-- 訂單狀態變更日誌表
CREATE TABLE IF NOT EXISTS order_status_log (
    id              SERIAL PRIMARY KEY,
    order_id        VARCHAR(36) NOT NULL,
    old_status      VARCHAR(50),
    new_status      VARCHAR(50) NOT NULL,
    operator_type   VARCHAR(20) NOT NULL DEFAULT 'system',
    operator_id     VARCHAR(36),
    mark            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS order_status_log_order_idx ON order_status_log(order_id);
CREATE INDEX IF NOT EXISTS order_status_log_created_idx ON order_status_log(created_at DESC);
