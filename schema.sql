-- Mzakka E-Commerce Database Schema
-- Created: 2026-04-23
-- Full-featured Hong Kong local e-commerce

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- 1. Core Base Tables
-- ===========================================

-- Users table
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
  -- Member system
  member_level_id INTEGER, -- references member_levels.id
  points INTEGER DEFAULT 0 NOT NULL,
  total_spent DECIMAL(10,2) DEFAULT 0 NOT NULL,
  total_orders INTEGER DEFAULT 0 NOT NULL,
  entries_count INTEGER DEFAULT 0 NOT NULL,
  -- Social login
  facebook_id VARCHAR(100) UNIQUE,
  google_id VARCHAR(100) UNIQUE,
  -- Status
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true NOT NULL,
  is_blacklisted BOOLEAN DEFAULT false NOT NULL,
  is_admin BOOLEAN DEFAULT false NOT NULL,
  -- Privacy consent
  marketing_consent BOOLEAN DEFAULT false NOT NULL, -- For PDPO compliance
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP WITH TIME ZONE
);

-- Member levels
CREATE TABLE IF NOT EXISTS member_levels (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL, -- 普通會員、銀卡、金卡、鑽石
  min_spent DECIMAL(10,2) NOT NULL, -- 累計消費達到呢個金額升級
  discount_percent DECIMAL(5,2) DEFAULT 0 NOT NULL, -- 會員專屬折扣
  free_shipping_threshold DECIMAL(10,2), -- 滿呢個金額免運費
  birthday_bonus_points INTEGER DEFAULT 0,
  priority_shipping BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User tags for customer segmentation
CREATE TABLE IF NOT EXISTS user_tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  color VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User tag assignments
CREATE TABLE IF NOT EXISTS user_tag_assignments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES user_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, tag_id)
);

-- User addresses
CREATE TABLE IF NOT EXISTS user_addresses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  district VARCHAR(50), -- 港島/九龍/新界
  area VARCHAR(50),
  postcode VARCHAR(10),
  is_default BOOLEAN DEFAULT false NOT NULL,
  type VARCHAR(20) DEFAULT 'home', -- home/office/locker/pickup
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Points transaction log
CREATE TABLE IF NOT EXISTS points_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL, -- positive = earn, negative = redeem
  type VARCHAR(50) NOT NULL, -- purchase/signin/invite/redeem/birthday/refund
  description TEXT,
  order_id INTEGER, -- references orders.id
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Admin roles and permissions
CREATE TABLE IF NOT EXISTS admin_roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL, -- superadmin/operations/finance/warehouse/cs
  description TEXT,
  permissions JSON NOT NULL, -- list of allowed permissions
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Admin permissions assignment
CREATE TABLE IF NOT EXISTS admin_permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Admin operation log (for audit trail)
CREATE TABLE IF NOT EXISTS admin_operation_logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL, -- product/order/user/category
  entity_id INTEGER NOT NULL,
  old_data JSON,
  new_data JSON,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Login logs (security audit)
CREATE TABLE IF NOT EXISTS login_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  username VARCHAR(100),
  success BOOLEAN NOT NULL,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Brands
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

-- Product tags
CREATE TABLE IF NOT EXISTS product_tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  name_zh_hk VARCHAR(100),
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  description_zh_hk TEXT,
  parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active' NOT NULL, -- active, inactive
  -- SEO
  meta_title VARCHAR(255),
  meta_description TEXT,
  meta_keywords TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- 1. Product & Inventory Management
-- ===========================================

-- Products (main product)
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  name_zh_hk VARCHAR(255),
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT, -- main description
  description_zh_hk TEXT,
  short_description TEXT,
  short_description_zh_hk TEXT,
  -- Brand & Category & Tags
  brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  -- Pricing
  cost_price DECIMAL(10,2), -- cost
  price DECIMAL(10,2) NOT NULL, -- regular selling price
  original_price DECIMAL(10,2), -- compare at price / original price
  member_price DECIMAL(10,2), -- member exclusive price
  -- Status & visibility
  status VARCHAR(20) DEFAULT 'active' NOT NULL, -- active/inactive/draft/archived
  is_featured BOOLEAN DEFAULT false,
  -- Scheduling
  publish_at TIMESTAMP WITH TIME ZONE, -- scheduled publish
  unpublish_at TIMESTAMP WITH TIME ZONE, -- scheduled unpublish
  -- SEO
  meta_title VARCHAR(255),
  meta_description TEXT,
  -- Media
  image_url VARCHAR(500),
  gallery_images JSON, -- array of image URLs
  video_url VARCHAR(500), -- product video
  -- Digital product
  is_digital BOOLEAN DEFAULT false,
  digital_file_url VARCHAR(500),
  -- Product type
  product_type VARCHAR(20) DEFAULT 'physical', -- physical/digital/virtual/bundle
  -- Batch/expiry (for food/cosmetics)
  has_batch_expiry BOOLEAN DEFAULT false,
  -- Reviews
  enable_reviews BOOLEAN DEFAULT true,
  average_rating DECIMAL(2,1) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE -- soft delete for recycle bin
);

-- Product SKUs (multi-variation)
CREATE TABLE IF NOT EXISTS product_skus (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku VARCHAR(100) UNIQUE,
  barcode VARCHAR(100),
  manufacturer_code VARCHAR(100), -- 廠方型號（メーカー型番 / MPN）
  -- Variation attributes: size/color etc.
  attributes JSON NOT NULL, -- {"size": "M", "color": "Red"}
  -- Pricing
  price DECIMAL(10,2), -- if different from base product
  cost_price DECIMAL(10,2),
  original_price DECIMAL(10,2),
  -- Inventory
  stock INTEGER DEFAULT 0 NOT NULL,
  weight DECIMAL(10,2),
  weight_unit VARCHAR(10) DEFAULT 'g',
  -- Status
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Product tag assignments
CREATE TABLE IF NOT EXISTS product_tag_assignments (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES product_tags(id) ON DELETE CASCADE,
  UNIQUE(product_id, tag_id)
);

-- Related products
CREATE TABLE IF NOT EXISTS related_products (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  related_product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  UNIQUE(product_id, related_product_id)
);

-- Product reviews
CREATE TABLE IF NOT EXISTS product_reviews (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title VARCHAR(255),
  content TEXT,
  images JSON,
  is_verified BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'pending', -- pending/approved/rejected
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Warehouses
CREATE TABLE IF NOT EXISTS warehouses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  address TEXT,
  contact_name VARCHAR(50),
  contact_phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Inventory transactions (stock movement log)
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku_id INTEGER REFERENCES product_skus(id) ON DELETE CASCADE,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- purchase/sale/return/adjustment/transfer/cancel
  quantity INTEGER NOT NULL, -- positive = in, negative = out
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  reference_id INTEGER, -- order_id / purchase_order_id
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- 2. Marketing & Promotions
-- ===========================================

-- Coupons / Promotion codes
CREATE TABLE IF NOT EXISTS coupons (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  type VARCHAR(20) NOT NULL, -- percentage/fixed/free_shipping
  value DECIMAL(10,2) NOT NULL, -- discount percentage or fixed amount
  -- Conditions
  min_order_amount DECIMAL(10,2),
  max_discount_amount DECIMAL(10,2),
  -- Usage limits
  usage_limit INTEGER, -- max total uses
  usage_limit_per_user INTEGER, -- max uses per customer
  used_count INTEGER DEFAULT 0,
  -- Eligibility
  allowed_categories JSON, -- allowed category ids
  allowed_products JSON, -- allowed product ids
  allowed_member_levels JSON, -- allowed member levels
  -- Time
  starts_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  -- Status
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Coupon usage history
CREATE TABLE IF NOT EXISTS coupon_usages (
  id SERIAL PRIMARY KEY,
  coupon_id INTEGER NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  discount_amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Flash sales / Limited time promotions
CREATE TABLE IF NOT EXISTS flash_sales (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Flash sale products
CREATE TABLE IF NOT EXISTS flash_sale_products (
  id SERIAL PRIMARY KEY,
  flash_sale_id INTEGER NOT NULL REFERENCES flash_sales(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sale_price DECIMAL(10,2) NOT NULL,
  original_price DECIMAL(10,2) NOT NULL,
  stock_limit INTEGER, -- limited quantity
  sold_count INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

-- Affiliate / Distribution partners
CREATE TABLE IF NOT EXISTS affiliates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(50) UNIQUE NOT NULL, -- affiliate tracking code
  commission_rate DECIMAL(5,2) NOT NULL, -- percentage
  total_commission DECIMAL(10,2) DEFAULT 0,
  paid_commission DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending', -- pending/active/suspended
  payment_method VARCHAR(50),
  payment_details JSON,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Affiliate clicks / conversions
CREATE TABLE IF NOT EXISTS affiliate_conversions (
  id SERIAL PRIMARY KEY,
  affiliate_id INTEGER NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  commission_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending/approved/paid
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Abandoned cart recovery
CREATE TABLE IF NOT EXISTS abandoned_carts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(100) UNIQUE NOT NULL,
  cart_data JSON NOT NULL, -- items, total
  email VARCHAR(100),
  phone VARCHAR(20),
  whatsapp VARCHAR(20),
  reminder_sent INTEGER DEFAULT 0, -- how many reminders sent
  last_reminder_sent_at TIMESTAMP WITH TIME ZONE,
  recovered BOOLEAN DEFAULT false,
  recovered_order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  coupon_id INTEGER REFERENCES coupons(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- 3. Shipping & Hong Kong Local
-- ===========================================

-- Shipping zones / Hong Kong districts
CREATE TABLE IF NOT EXISTS shipping_zones (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL, -- 港島 / 九龍 / 新界 / 離島
  districts JSON NOT NULL, -- list of districts
  -- Shipping methods available in this zone
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Shipping methods
CREATE TABLE IF NOT EXISTS shipping_methods (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL, -- 順豐速運 / 香港郵政 / 嘉里物流 / 智能櫃自取 / 店鋪自取
  type VARCHAR(20) NOT NULL, -- courier/pickup/self_pickup
  zone_id INTEGER REFERENCES shipping_zones(id) ON DELETE CASCADE,
  -- Pricing
  min_order_amount DECIMAL(10,2),
  shipping_fee DECIMAL(10,2) NOT NULL,
  free_shipping_threshold DECIMAL(10,2), -- free shipping over this amount
  -- HK specific
  provider VARCHAR(50), -- sf_express/hongkong_post/kerry/pickup
  tracking_url_template VARCHAR(500), -- for tracking
  is_active BOOLEAN DEFAULT true NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Pickup points (lokocko / 7-11 / etc)
CREATE TABLE IF NOT EXISTS pickup_points (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  address TEXT NOT NULL,
  district VARCHAR(50) NOT NULL,
  provider VARCHAR(50) NOT NULL, -- lokocker/711/circlek/alfamart/store
  latitude DECIMAL(10,6),
  longitude DECIMAL(10,6),
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- 4. Payment
-- ===========================================

-- Payment methods (Hong Kong)
CREATE TABLE IF NOT EXISTS payment_methods (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL, -- FPS / PayMe / AlipayHK / WeChat Pay HK / Visa / MasterCard / PayPal / COD
  code VARCHAR(50) UNIQUE NOT NULL,
  provider VARCHAR(50),
  fee_percent DECIMAL(5,2), -- transaction fee percentage
  fee_fixed DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Payment transactions
CREATE TABLE IF NOT EXISTS payment_transactions (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_method_code VARCHAR(50) NOT NULL,
  transaction_id VARCHAR(100), -- gateway transaction id
  amount DECIMAL(10,2) NOT NULL,
  fee_amount DECIMAL(10,2),
  status VARCHAR(20) NOT NULL, -- pending/success/failed/cancelled/refunded
  gateway_raw_response JSON,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Refunds
CREATE TABLE IF NOT EXISTS refunds (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL, -- amount to refund
  type VARCHAR(20) NOT NULL, -- full/partial
  status VARCHAR(20) NOT NULL, -- pending/approved/processing/completed/rejected
  payment_transaction_id VARCHAR(100),
  refund_transaction_id VARCHAR(100),
  processed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- 5. Orders (extended)
-- ===========================================

-- Orders table (already defined, extended version below)

  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  original_price DECIMAL(10,2),
  stock INTEGER DEFAULT 0 NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  image_url VARCHAR(500),
  gallery_images JSON,
  status VARCHAR(20) DEFAULT 'active' NOT NULL, -- active, inactive
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Cart items table
CREATE TABLE IF NOT EXISTS cart_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, product_id)
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_name VARCHAR(100) NOT NULL,
  contact_phone VARCHAR(20) NOT NULL,
  contact_address TEXT NOT NULL,
  note TEXT,
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' NOT NULL, -- pending, paid, shipping, completed, cancelled
  tracking_number VARCHAR(100), -- 物流追蹤編號
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_status ON categories(status);

-- Sessions table (for connect-pg-simple)
-- This table will be auto-created by connect-pg-simple, but defined here for reference
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
) WITH (OIDS=FALSE);
ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;

-- Create initial admin user (change password after first login!)
-- Password: admin123 (hash generated with bcrypt 10 rounds)
-- INSERT INTO users (username, password_hash, is_admin) VALUES (
--   'admin',
--   '$2a$10$R9Qc5yYd1JwGxQfNvqKvHe9vZpXyYcXaZbYcXaZbYcXaZbYcXaZb',
--   true
-- );
