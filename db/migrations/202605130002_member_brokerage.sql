-- Phase 3: 會員等級 + 分銷傭金系統

-- ============================================
-- 會員等級表
-- ============================================
CREATE TABLE IF NOT EXISTS customer_levels (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(50) NOT NULL,
    display_name    VARCHAR(100) NOT NULL,
    discount_rate   NUMERIC(5,4) NOT NULL DEFAULT 1.0000,  -- 折扣率：0.9500 = 9.5折，1.0000 = 無折扣
    points_rate     NUMERIC(5,4) NOT NULL DEFAULT 1.0000,   -- 積分倍率：1.0 = 1倍，1.5 = 1.5倍
    min_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,       -- 成為此等級的累計消費門檻
    max_amount      NUMERIC(12,2),                           -- 等級上限（NULL=無上限）
    sort_order      SMALLINT NOT NULL DEFAULT 0,             -- 排序
    is_default      BOOLEAN NOT NULL DEFAULT FALSE,          -- 是否為預設等級
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 預設等級
INSERT INTO customer_levels (name, display_name, discount_rate, points_rate, min_amount, sort_order, is_default) VALUES
    ('member', '普通會員', 1.0000, 1.0000, 0, 0, TRUE),
    ('silver', '銀卡會員', 0.9800, 1.2000, 5000.00, 1, FALSE),
    ('gold', '金卡會員', 0.9500, 1.5000, 20000.00, 2, FALSE),
    ('platinum', '白金會員', 0.9200, 2.0000, 50000.00, 3, FALSE)
ON CONFLICT DO NOTHING;

-- ============================================
-- 升級規則表
-- ============================================
CREATE TABLE IF NOT EXISTS level_upgrade_rules (
    id              SERIAL PRIMARY KEY,
    from_level_id   INTEGER REFERENCES customer_levels(id),
    to_level_id     INTEGER REFERENCES customer_levels(id),
    condition_type  VARCHAR(30) NOT NULL,  -- 'total_amount' | 'order_count' | 'points'
    condition_value NUMERIC(12,2) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

-- ============================================
-- 更新 customers 表：增加等級和分銷字段
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'level_id') THEN
        ALTER TABLE customers ADD COLUMN level_id INTEGER REFERENCES customer_levels(id) DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'total_amount') THEN
        ALTER TABLE customers ADD COLUMN total_amount NUMERIC(12,2) NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'total_points') THEN
        ALTER TABLE customers ADD COLUMN total_points INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'spread_uid') THEN
        ALTER TABLE customers ADD COLUMN spread_uid UUID REFERENCES customers(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'spread_time') THEN
        ALTER TABLE customers ADD COLUMN spread_time TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'is_promoter') THEN
        ALTER TABLE customers ADD COLUMN is_promoter BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'promoter_time') THEN
        ALTER TABLE customers ADD COLUMN promoter_time TIMESTAMPTZ;
    END IF;
END$$;

-- ============================================
-- 傭金/代理帳戶表（一個客戶可以有多個角色）
-- ============================================
CREATE TABLE IF NOT EXISTS brokerage_accounts (
    id              SERIAL PRIMARY KEY,
    account_id      UUID NOT NULL,                          -- customer_id
    account_type    VARCHAR(20) NOT NULL DEFAULT 'customer', -- 'customer' | 'factory'
    agent_level     VARCHAR(30),                              -- 'agent' | 'vip_agent' | 'partner'
    commission_rate  NUMERIC(5,4) NOT NULL DEFAULT 0.0500,  -- 傭金比例：0.05 = 5%
    second_rate      NUMERIC(5,4) NOT NULL DEFAULT 0.0200,   -- 二級推薦傭金比例
    frozen_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,       -- 凍結金額（提現審核中）
    available_amount NUMERIC(12,2) NOT NULL DEFAULT 0,       -- 可提現餘額
    total_earned    NUMERIC(12,2) NOT NULL DEFAULT 0,       -- 累計收益
    total_withdrawn NUMERIC(12,2) NOT NULL DEFAULT 0,       -- 累計提現
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, account_type)
);

-- ============================================
-- 傭金流水表（Ledger）- 記錄所有傭金變動
-- ============================================
CREATE TABLE IF NOT EXISTS brokerage_ledger (
    id              SERIAL PRIMARY KEY,
    account_id      UUID NOT NULL,                          -- brokerage_accounts.account_id
    order_id        UUID REFERENCES orders(id),              -- 關聯訂單
    from_customer_id UUID REFERENCES customers(id),          -- 下單的客戶（用於計算誰推薦的）
    ledger_type     VARCHAR(50) NOT NULL,                     -- earn/freeze/unfreeze/withdraw/adjust
    pm              SMALLINT NOT NULL DEFAULT 1,             -- 1=收入, 0=支出
    amount          NUMERIC(12,2) NOT NULL,                 -- 變動金額
    balance_after   NUMERIC(12,2) NOT NULL DEFAULT 0,       -- 變動後餘額（可提現）
    frozen_after    NUMERIC(12,2) NOT NULL DEFAULT 0,      -- 變動後凍結金額
    title           VARCHAR(100) NOT NULL,
    order_sn        VARCHAR(50),
    mark            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS brokerage_ledger_account_idx ON brokerage_ledger(account_id);
CREATE INDEX IF NOT EXISTS brokerage_ledger_order_idx ON brokerage_ledger(order_id);
CREATE INDEX IF NOT EXISTS brokerage_ledger_created_idx ON brokerage_ledger(created_at DESC);

-- ============================================
-- 分銷關係表（記錄誰推薦了誰）
-- ============================================
CREATE TABLE IF NOT EXISTS spread_records (
    id              SERIAL PRIMARY KEY,
    inviter_id      UUID NOT NULL REFERENCES customers(id),  -- 邀請人
    invitee_id      UUID NOT NULL REFERENCES customers(id),   -- 被邀請人
    order_id        UUID REFERENCES orders(id),              -- 綁定此關係的訂單（只能在首次消費時建立）
    level           SMALLINT NOT NULL DEFAULT 1,             -- 1=一級推薦, 2=二級推薦
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(invitee_id)  -- 每個客戶只能被一個上級推薦
);

CREATE INDEX IF NOT EXISTS spread_records_inviter_idx ON spread_records(inviter_id);
CREATE INDEX IF NOT EXISTS spread_records_invitee_idx ON spread_records(invitee_id);

-- ============================================
-- 工廠傭金結算表
-- ============================================
CREATE TABLE IF NOT EXISTS factory_settlements (
    id              SERIAL PRIMARY KEY,
    factory_user_id UUID NOT NULL,                           -- 工廠用戶ID
    period_start    DATE NOT NULL,                           -- 結算周期開始
    period_end      DATE NOT NULL,                           -- 結算周期結束
    order_count     INTEGER NOT NULL DEFAULT 0,               -- 完成訂單數
    total_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,        -- 結算金額
    commission_rate  NUMERIC(5,4) NOT NULL,                 -- 傭金比例
    commission      NUMERIC(12,2) NOT NULL DEFAULT 0,        -- 應得傭金
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending/settled/paid
    settled_at      TIMESTAMPTZ,
    paid_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS factory_settlements_factory_idx ON factory_settlements(factory_user_id);
CREATE INDEX IF NOT EXISTS factory_settlements_period_idx ON factory_settlements(period_start, period_end);
