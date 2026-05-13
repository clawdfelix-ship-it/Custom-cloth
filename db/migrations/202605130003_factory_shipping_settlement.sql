-- Phase 4: 工廠接單/拒單、快遞信息、工廠結算、儀表板統計

-- ============================================
-- 1. 訂單表擴展：快遞信息 + 工廠接單/拒單
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'factory_accepted_at') THEN
        ALTER TABLE orders ADD COLUMN factory_accepted_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'factory_rejected_at') THEN
        ALTER TABLE orders ADD COLUMN factory_rejected_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'factory_reject_reason') THEN
        ALTER TABLE orders ADD COLUMN factory_reject_reason TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'express_company') THEN
        ALTER TABLE orders ADD COLUMN express_company VARCHAR(100);  -- 快遞公司
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'tracking_number') THEN
        ALTER TABLE orders ADD COLUMN tracking_number VARCHAR(100);  -- 運單號
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'shipped_at') THEN
        ALTER TABLE orders ADD COLUMN shipped_at TIMESTAMPTZ;        -- 發貨時間
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'received_at') THEN
        ALTER TABLE orders ADD COLUMN received_at TIMESTAMPTZ;       -- 客戶收貨時間
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'paid') THEN
        ALTER TABLE orders ADD COLUMN paid SMALLINT NOT NULL DEFAULT 0;  -- 0=未付款, 1=已付款
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'paid_at') THEN
        ALTER TABLE orders ADD COLUMN paid_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'paid_method') THEN
        ALTER TABLE orders ADD COLUMN paid_method VARCHAR(50);  -- 銀行轉帳/轉數快/其他
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'factory_quote_amount') THEN
        ALTER TABLE orders ADD COLUMN factory_quote_amount NUMERIC(12,2);  -- 工廠報價金額
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'quote_accepted_at') THEN
        ALTER TABLE orders ADD COLUMN quote_accepted_at TIMESTAMPTZ;       -- 客戶確認報價時間
    END IF;
END$$;

-- ============================================
-- 2. QC 記錄表（新生產環節）
-- ============================================
CREATE TABLE IF NOT EXISTS qc_records (
    id              SERIAL PRIMARY KEY,
    order_id        UUID NOT NULL REFERENCES orders(id),
    qc_stage        VARCHAR(50) NOT NULL,   -- '備料'/'裁剪'/'印刷'/'車縫'/'QC'/'包裝'
    qc_result       VARCHAR(20) NOT NULL,   -- '合格'/'不合格'/'返工'
    qc_note         TEXT,
    qc_photos       JSONB DEFAULT '[]'::jsonb,
    inspector       VARCHAR(100),            -- 質檢員名稱
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS qc_records_order_idx ON qc_records(order_id);

-- ============================================
-- 3. 登入日誌表
-- ============================================
CREATE TABLE IF NOT EXISTS login_logs (
    id              SERIAL PRIMARY KEY,
    user_id         UUID REFERENCES users(id),
    customer_id     UUID REFERENCES customers(id),
    role            VARCHAR(20) NOT NULL,
    ip_address      VARCHAR(45),
    user_agent      TEXT,
    login_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    success         BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS login_logs_user_idx ON login_logs(user_id);
CREATE INDEX IF NOT EXISTS login_logs_customer_idx ON login_logs(customer_id);
CREATE INDEX IF NOT EXISTS login_logs_login_at_idx ON login_logs(login_at DESC);

-- ============================================
-- 4. 操作日誌表（擴展審計）
-- ============================================
CREATE TABLE IF NOT EXISTS operation_logs (
    id              SERIAL PRIMARY KEY,
    user_id         UUID,
    customer_id     UUID,
    role            VARCHAR(20),
    action          VARCHAR(100) NOT NULL,   -- 'style.create'/'order.status_change'/'style.update'
    target_type     VARCHAR(50),             -- 'style'/'order'/'size_table'/'user'
    target_id       VARCHAR(100),
    before_value    JSONB,
    after_value     JSONB,
    ip_address      VARCHAR(45),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS operation_logs_user_idx ON operation_logs(user_id);
CREATE INDEX IF NOT EXISTS operation_logs_action_idx ON operation_logs(action);
CREATE INDEX IF NOT EXISTS operation_logs_created_idx ON operation_logs(created_at DESC);
