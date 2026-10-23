const CORE_BOOTSTRAP_STEPS = [
  {
    name: 'uuid extension',
    sql: 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',
  },
  {
    name: 'users',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100),
        phone VARCHAR(20),
        whatsapp VARCHAR(20),
        contact VARCHAR(255),
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(50),
        last_name VARCHAR(50),
        date_of_birth DATE,
        avatar_url VARCHAR(500),
        is_verified BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true NOT NULL,
        is_blacklisted BOOLEAN DEFAULT false NOT NULL,
        is_admin BOOLEAN DEFAULT false NOT NULL,
        marketing_consent BOOLEAN DEFAULT false NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP WITH TIME ZONE
      );
    `,
  },
  {
    name: 'admin roles',
    sql: `
      CREATE TABLE IF NOT EXISTS admin_roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        description TEXT,
        permissions JSON NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS admin_roles_name_uniq_idx
        ON admin_roles (name);
    `,
  },
  {
    name: 'admin permissions',
    sql: `
      CREATE TABLE IF NOT EXISTS admin_permissions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role_id INTEGER NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `,
  },
  {
    name: 'brands',
    sql: `
      CREATE TABLE IF NOT EXISTS brands (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        name_zh_hk VARCHAR(100),
        slug VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        description_zh_hk TEXT,
        image_url VARCHAR(500),
        website VARCHAR(500),
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `,
  },
  {
    name: 'categories',
    sql: `
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        name_zh_hk VARCHAR(100),
        slug VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        description_zh_hk TEXT,
        parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        sort_order INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'active' NOT NULL,
        meta_title VARCHAR(255),
        meta_description TEXT,
        meta_keywords TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
      CREATE INDEX IF NOT EXISTS idx_categories_status ON categories(status);
    `,
  },
  {
    name: 'categories source columns',
    sql: `
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS source VARCHAR(50);
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS source_key TEXT;
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS source_parent_key TEXT;
      ALTER TABLE categories ALTER COLUMN source_key TYPE TEXT;
      ALTER TABLE categories ALTER COLUMN source_parent_key TYPE TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_categories_source_key
        ON categories (source, source_key)
        WHERE source IS NOT NULL AND source_key IS NOT NULL;
    `,
  },
  {
    name: 'products',
    sql: `
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        name_zh_hk VARCHAR(255),
        slug VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        description_zh_hk TEXT,
        short_description TEXT,
        short_description_zh_hk TEXT,
        brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        cost_price DECIMAL(10,2),
        price DECIMAL(10,2) NOT NULL DEFAULT 0,
        original_price DECIMAL(10,2),
        member_price DECIMAL(10,2),
        status VARCHAR(20) DEFAULT 'active' NOT NULL,
        is_featured BOOLEAN DEFAULT false,
        publish_at TIMESTAMP WITH TIME ZONE,
        unpublish_at TIMESTAMP WITH TIME ZONE,
        meta_title VARCHAR(255),
        meta_description TEXT,
        meta_keywords TEXT,
        image_url VARCHAR(500),
        gallery_images JSON,
        video_url VARCHAR(500),
        product_type VARCHAR(20) DEFAULT 'physical',
        is_digital BOOLEAN DEFAULT false,
        digital_file_url VARCHAR(500),
        has_batch_expiry BOOLEAN DEFAULT false,
        enable_reviews BOOLEAN DEFAULT true,
        average_rating DECIMAL(2,1) DEFAULT 0,
        review_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP WITH TIME ZONE
      );
      CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
      CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);
      CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
    `,
  },
  {
    name: 'products source columns',
    sql: `
      ALTER TABLE products ADD COLUMN IF NOT EXISTS source VARCHAR(50);
      ALTER TABLE products ADD COLUMN IF NOT EXISTS source_key VARCHAR(255);
      ALTER TABLE products ADD COLUMN IF NOT EXISTS source_url VARCHAR(1000);
      ALTER TABLE products ADD COLUMN IF NOT EXISTS sync_status VARCHAR(30) DEFAULT 'pending' NOT NULL;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS raw_payload JSON;
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_products_source_key
        ON products (source, source_key)
        WHERE source IS NOT NULL AND source_key IS NOT NULL;
    `,
  },
  {
    name: 'mzakka product media',
    sql: `
      CREATE TABLE IF NOT EXISTS mzakka_product_media (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        media_url VARCHAR(1000) NOT NULL,
        media_type VARCHAR(30) NOT NULL DEFAULT 'image',
        alt_text TEXT,
        sort_order INTEGER DEFAULT 0 NOT NULL,
        source_key VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_mzakka_product_media_product_id
        ON mzakka_product_media(product_id);
    `,
  },
  {
    name: 'mzakka product sections',
    sql: `
      CREATE TABLE IF NOT EXISTS mzakka_product_sections (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        section_type VARCHAR(50) NOT NULL,
        title VARCHAR(255),
        sort_order INTEGER DEFAULT 0 NOT NULL,
        content_html TEXT,
        content_text TEXT,
        content_json JSON,
        source_anchor VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_mzakka_product_sections_product_id
        ON mzakka_product_sections(product_id);
    `,
  },
  {
    name: 'mzakka home modules',
    sql: `
      CREATE TABLE IF NOT EXISTS mzakka_home_modules (
        id SERIAL PRIMARY KEY,
        module_key VARCHAR(255) NOT NULL,
        module_type VARCHAR(50) NOT NULL,
        title TEXT,
        subtitle TEXT,
        image_url VARCHAR(1000),
        target_url VARCHAR(1000),
        payload_json JSON,
        sort_order INTEGER DEFAULT 0 NOT NULL,
        is_active BOOLEAN DEFAULT true NOT NULL,
        source_url VARCHAR(1000),
        last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_mzakka_home_modules_key
        ON mzakka_home_modules(module_key);
    `,
  },
  {
    name: 'mzakka sync snapshots',
    sql: `
      CREATE TABLE IF NOT EXISTS mzakka_sync_snapshots (
        id SERIAL PRIMARY KEY,
        snapshot_type VARCHAR(50) NOT NULL,
        source_key VARCHAR(255),
        source_url VARCHAR(1000),
        raw_html TEXT,
        parsed_json JSON,
        error_text TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_mzakka_sync_snapshots_type_created_at
        ON mzakka_sync_snapshots(snapshot_type, created_at DESC);
    `,
  },
  {
    name: 'product skus',
    sql: `
      CREATE TABLE IF NOT EXISTS product_skus (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        sku VARCHAR(100) UNIQUE,
        barcode VARCHAR(100),
        attributes JSON NOT NULL,
        price DECIMAL(10,2),
        cost_price DECIMAL(10,2),
        original_price DECIMAL(10,2),
        stock INTEGER DEFAULT 0 NOT NULL,
        weight DECIMAL(10,2),
        weight_unit VARCHAR(10) DEFAULT 'g',
        is_active BOOLEAN DEFAULT true NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_product_skus_product_id ON product_skus(product_id);
    `,
  },
  {
    name: 'inventory warehouses',
    sql: `
      CREATE TABLE IF NOT EXISTS inventory_warehouses (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        address TEXT,
        contact_name VARCHAR(50),
        contact_phone VARCHAR(20),
        is_active BOOLEAN DEFAULT true NOT NULL,
        is_default BOOLEAN DEFAULT false NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS inventory_warehouses_one_default_idx
        ON inventory_warehouses ((is_default))
        WHERE is_default = true;
      INSERT INTO inventory_warehouses (name, address, contact_name, contact_phone, is_active, is_default)
      SELECT '預設倉庫', NULL, NULL, NULL, true, true
      WHERE NOT EXISTS (SELECT 1 FROM inventory_warehouses);
    `,
  },
  {
    name: 'inventory transactions',
    sql: `
      CREATE TABLE IF NOT EXISTS inventory_transactions (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        sku_id INTEGER REFERENCES product_skus(id) ON DELETE CASCADE,
        warehouse_id INTEGER NOT NULL REFERENCES inventory_warehouses(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        quantity INTEGER NOT NULL,
        previous_stock INTEGER NOT NULL,
        new_stock INTEGER NOT NULL,
        reference_id INTEGER,
        note TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_inventory_transactions_product_id
        ON inventory_transactions(product_id);
    `,
  },
  {
    name: 'inventory levels',
    sql: `
      CREATE TABLE IF NOT EXISTS inventory_levels (
        warehouse_id INTEGER NOT NULL REFERENCES inventory_warehouses(id) ON DELETE CASCADE,
        sku_id INTEGER NOT NULL REFERENCES product_skus(id) ON DELETE CASCADE,
        stock INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (warehouse_id, sku_id)
      );
      CREATE INDEX IF NOT EXISTS idx_inventory_levels_sku_id ON inventory_levels(sku_id);
      INSERT INTO inventory_levels (warehouse_id, sku_id, stock)
      SELECT w.id, s.id, s.stock
      FROM product_skus s
      CROSS JOIN LATERAL (
        SELECT id
        FROM inventory_warehouses
        WHERE is_active = true
        ORDER BY is_default DESC, id ASC
        LIMIT 1
      ) w
      ON CONFLICT (warehouse_id, sku_id) DO NOTHING;
    `,
  },
  {
    name: 'sku cost history',
    sql: `
      CREATE TABLE IF NOT EXISTS sku_cost_history (
        id SERIAL PRIMARY KEY,
        sku_id INTEGER NOT NULL REFERENCES product_skus(id) ON DELETE CASCADE,
        old_cost_price DECIMAL(10,2),
        new_cost_price DECIMAL(10,2),
        changed_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        reason TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `,
  },
  {
    name: 'shipping zones',
    sql: `
      CREATE TABLE IF NOT EXISTS shipping_zones (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        districts JSON NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `,
  },
  {
    name: 'shipping methods',
    sql: `
      CREATE TABLE IF NOT EXISTS shipping_methods (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(20) NOT NULL,
        zone_id INTEGER REFERENCES shipping_zones(id) ON DELETE CASCADE,
        min_order_amount DECIMAL(10,2),
        shipping_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
        free_shipping_threshold DECIMAL(10,2),
        provider VARCHAR(50),
        tracking_url_template VARCHAR(500),
        is_active BOOLEAN DEFAULT true NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `,
  },
  {
    name: 'pickup points',
    sql: `
      CREATE TABLE IF NOT EXISTS pickup_points (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        address TEXT NOT NULL,
        district VARCHAR(50) NOT NULL,
        provider VARCHAR(50) NOT NULL,
        latitude DECIMAL(10,6),
        longitude DECIMAL(10,6),
        is_active BOOLEAN DEFAULT true NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `,
  },
  {
    name: 'payment methods',
    sql: `
      CREATE TABLE IF NOT EXISTS payment_methods (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        provider VARCHAR(50),
        fee_percent DECIMAL(5,2),
        fee_fixed DECIMAL(10,2),
        instructions TEXT,
        qr_code_image VARCHAR(500),
        is_active BOOLEAN DEFAULT true NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `,
  },
  {
    name: 'orders',
    sql: `
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        order_number VARCHAR(50) UNIQUE,
        contact_name VARCHAR(100) NOT NULL DEFAULT '',
        contact_phone VARCHAR(20) NOT NULL DEFAULT '',
        contact_email VARCHAR(100),
        contact_address TEXT NOT NULL DEFAULT '',
        pickup_point_id INTEGER REFERENCES pickup_points(id) ON DELETE SET NULL,
        district VARCHAR(50),
        note TEXT,
        subtotal_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        shipping_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
        discount_amount DECIMAL(10,2) DEFAULT 0,
        coupon_discount DECIMAL(10,2) DEFAULT 0,
        total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        payment_method_code VARCHAR(50),
        payment_status VARCHAR(20) DEFAULT 'pending',
        shipping_method_id INTEGER REFERENCES shipping_methods(id) ON DELETE SET NULL,
        status VARCHAR(20) DEFAULT 'pending' NOT NULL,
        tracking_number VARCHAR(100),
        shipped_at TIMESTAMP WITH TIME ZONE,
        delivered_at TIMESTAMP WITH TIME ZONE,
        is_cod BOOLEAN DEFAULT false,
        invoice_requested BOOLEAN DEFAULT false,
        invoice_title VARCHAR(255),
        affiliate_id INTEGER,
        affiliate_commission DECIMAL(10,2),
        payment_transaction_id VARCHAR(100),
        paid_at TIMESTAMP WITH TIME ZONE,
        shipany_label_url VARCHAR(500),
        tracking_status VARCHAR(50),
        tracking_updated_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
    `,
  },
  {
    name: 'order items',
    sql: `
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        sku_id INTEGER REFERENCES product_skus(id) ON DELETE SET NULL,
        product_name VARCHAR(255),
        sku_attributes JSON,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
        subtotal DECIMAL(10,2),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `,
  },
  {
    name: 'cart items',
    sql: `
      CREATE TABLE IF NOT EXISTS cart_items (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        sku_id INTEGER REFERENCES product_skus(id) ON DELETE CASCADE,
        quantity INTEGER DEFAULT 1 NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);
    `,
  },
  {
    name: 'refunds',
    sql: `
      CREATE TABLE IF NOT EXISTS refunds (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        type VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL,
        payment_transaction_id VARCHAR(100),
        refund_transaction_id VARCHAR(100),
        processed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        processed_at TIMESTAMP WITH TIME ZONE,
        approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        approved_at TIMESTAMP WITH TIME ZONE,
        rejected_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        rejected_at TIMESTAMP WITH TIME ZONE,
        note TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `,
  },
  {
    name: 'payment transactions',
    sql: `
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        payment_method_code VARCHAR(50) NOT NULL,
        transaction_id VARCHAR(100),
        amount DECIMAL(10,2) NOT NULL,
        fee_amount DECIMAL(10,2),
        status VARCHAR(20) NOT NULL,
        gateway_raw_response JSON,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_payment_transactions_method_tx
        ON payment_transactions(payment_method_code, transaction_id);
      CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON payment_transactions(order_id);
    `,
  },
  {
    name: 'session table',
    sql: `
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL,
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        PRIMARY KEY ("sid")
      );
    `,
  },
  {
    name: 'email_outbox',
    sql: `
      CREATE TABLE IF NOT EXISTS email_outbox (
        id              BIGSERIAL PRIMARY KEY,
        to_address      TEXT NOT NULL,
        cc_address      TEXT,
        bcc_address     TEXT,
        subject         TEXT NOT NULL,
        html_body       TEXT NOT NULL,
        text_body       TEXT NOT NULL DEFAULT '',
        status          TEXT NOT NULL DEFAULT 'pending',
        attempts        INTEGER NOT NULL DEFAULT 0,
        max_attempts    INTEGER NOT NULL DEFAULT 6,
        last_error      TEXT,
        available_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        sent_at         TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        related_type    TEXT,
        related_id      BIGINT
      );
      CREATE INDEX IF NOT EXISTS idx_email_outbox_pending
        ON email_outbox (available_at)
        WHERE status = 'pending';
    `,
  },
  {
    name: 'seed payment methods',
    sql: `
      INSERT INTO payment_methods (name, code, is_active, sort_order)
      VALUES
        ('FPS 轉數快', 'fps', true, 1),
        ('PayMe by HSBC', 'payme', true, 2),
        ('Alipay HK', 'alipayhk', true, 3),
        ('WeChat Pay HK', 'wechathk', true, 4),
        ('Visa / Mastercard', 'card', true, 5),
        ('PayPal', 'paypal', true, 6),
        ('Cash on Delivery 貨到付款', 'cod', true, 7)
      ON CONFLICT (code) DO NOTHING;
    `,
  },
  {
    name: 'seed shipping methods',
    sql: `
      INSERT INTO shipping_methods (name, type, provider, shipping_fee, is_active, sort_order)
      VALUES
        ('順豐速運', 'courier', 'sf_express', 20, true, 1),
        ('香港郵政', 'courier', 'hongkong_post', 15, true, 2),
        ('嘉里物流', 'courier', 'kerry', 18, true, 3),
        ('智能櫃自取', 'pickup', 'locker', 0, true, 4),
        ('店鋪自取', 'pickup', 'store', 0, true, 5)
      ON CONFLICT DO NOTHING;
    `,
  },
];

async function bootstrapCoreSchema(pool) {
  if (!pool) {
    throw new Error('DATABASE_URL not configured');
  }

  const client = await pool.connect();
  const applied = [];
  try {
    for (const step of CORE_BOOTSTRAP_STEPS) {
      await client.query(step.sql);
      applied.push(step.name);
    }
    return {
      stepsApplied: applied.length,
      stepNames: applied,
    };
  } finally {
    client.release();
  }
}

module.exports = {
  CORE_BOOTSTRAP_STEPS,
  bootstrapCoreSchema,
};
