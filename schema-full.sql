-- Mzakka E-Commerce Database Schema
-- Full-featured Hong Kong Local E-Commerce
-- Created: 2026-04-23

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- 1. Core Base & User/Member System
-- ===========================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100),
  phone VARCHAR(20),
  whatsapp VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  date_of_birth DATE,
  avatar_url VARCHAR(500),
  -- Member system
  member_level_id INTEGER,
  points INTEGER DEFAULT 0 NOT NULL,
  total_spent DECIMAL(10,2) DEFAULT 0 NOT NULL,
  total_orders INTEGER DEFAULT 0 NOT NULL,
  -- Social login
  facebook_id VARCHAR(100) UNIQUE,
  google_id VARCHAR(100) UNIQUE,
  -- Status
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true NOT NULL,
  is_blacklisted BOOLEAN DEFAULT false NOT NULL,
  is_admin BOOLEAN DEFAULT false NOT NULL,
  -- Privacy consent (PDPO compliance)
  marketing_consent BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP WITH TIME ZONE
);

-- Member levels (tiered membership)
CREATE TABLE IF NOT EXISTS member_levels (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  min_spent DECIMAL(10,2) NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0 NOT NULL,
  points_multiplier DECIMAL(3,2) DEFAULT 1.0 NOT NULL, -- Points earning multiplier for this member level
  free_shipping_threshold DECIMAL(10,2),
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

-- User saved addresses
CREATE TABLE IF NOT EXISTS user_addresses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  district VARCHAR(50),
  area VARCHAR(50),
  postcode VARCHAR(10),
  type VARCHAR(20) DEFAULT 'home',
  is_default BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Member points (user's current point balance)
CREATE TABLE IF NOT EXISTS member_points (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_balance INTEGER DEFAULT 0 NOT NULL,
  total_earned INTEGER DEFAULT 0 NOT NULL,
  total_spent INTEGER DEFAULT 0 NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Points transaction log
CREATE TABLE IF NOT EXISTS points_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT,
  order_id INTEGER,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Admin roles and permissions
CREATE TABLE IF NOT EXISTS admin_roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  permissions JSON NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Admin permissions assignment
CREATE TABLE IF NOT EXISTS admin_permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Admin action logs (audit trail - all operations traceable)
CREATE TABLE IF NOT EXISTS admin_action_logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER NOT NULL,
  old_data JSON,
  new_data JSON,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Keep admin_operation_logs as alias for backward compatibility
CREATE VIEW admin_operation_logs AS SELECT * FROM admin_action_logs;

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

-- ===========================================
-- 2. Product Catalog & Inventory Management
-- ===========================================

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

-- Product Categories
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
  -- SEO
  meta_title VARCHAR(255),
  meta_description TEXT,
  meta_keywords TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Product Tags
CREATE TABLE IF NOT EXISTS product_tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Products (main product)
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  name_zh_hk VARCHAR(255),
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  description_zh_hk TEXT,
  short_description TEXT,
  short_description_zh_hk TEXT,
  -- Relations
  brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  -- Pricing
  cost_price DECIMAL(10,2),
  price DECIMAL(10,2) NOT NULL,
  original_price DECIMAL(10,2),
  member_price DECIMAL(10,2),
  -- Status & visibility
  status VARCHAR(20) DEFAULT 'active' NOT NULL,
  is_featured BOOLEAN DEFAULT false,
  -- Scheduling
  publish_at TIMESTAMP WITH TIME ZONE,
  unpublish_at TIMESTAMP WITH TIME ZONE,
  -- SEO
  meta_title VARCHAR(255),
  meta_description TEXT,
  meta_keywords TEXT,
  -- Media
  image_url VARCHAR(500),
  gallery_images JSON,
  video_url VARCHAR(500),
  -- Product type
  product_type VARCHAR(20) DEFAULT 'physical',
  is_digital BOOLEAN DEFAULT false,
  digital_file_url VARCHAR(500),
  -- Batch/expiry for food/cosmetics
  has_batch_expiry BOOLEAN DEFAULT false,
  -- Reviews
  enable_reviews BOOLEAN DEFAULT true,
  average_rating DECIMAL(2,1) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Product SKUs (multi-variation / multi-spec)
CREATE TABLE IF NOT EXISTS product_skus (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku VARCHAR(100) UNIQUE,
  barcode VARCHAR(100),
  manufacturer_code VARCHAR(100),
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

-- Product tag assignments
CREATE TABLE IF NOT EXISTS product_tag_assignments (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES product_tags(id) ON DELETE CASCADE,
  UNIQUE(product_id, tag_id)
);

-- Related / Recommended products
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
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Inventory warehouses (multi-warehouse support)
CREATE TABLE IF NOT EXISTS inventory_warehouses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  address TEXT,
  contact_name VARCHAR(50),
  contact_phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Inventory transactions (full stock movement log)
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

-- ===========================================
-- 3. Marketing & Promotions
-- ===========================================

-- Coupons / Promotion codes
CREATE TABLE IF NOT EXISTS coupons (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  type VARCHAR(20) NOT NULL,
  value DECIMAL(10,2) NOT NULL,
  min_order_amount DECIMAL(10,2),
  max_discount_amount DECIMAL(10,2),
  usage_limit INTEGER,
  usage_limit_per_user INTEGER,
  used_count INTEGER DEFAULT 0,
  allowed_categories JSON,
  allowed_products JSON,
  allowed_member_levels JSON,
  starts_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
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

-- Flash sales / limited time promotions
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
  stock_limit INTEGER,
  sold_count INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

-- Affiliate / Distribution partners (KOL/influencer program)
CREATE TABLE IF NOT EXISTS affiliate_program (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(50) UNIQUE NOT NULL,
  commission_rate DECIMAL(5,2) NOT NULL,
  total_commission DECIMAL(10,2) DEFAULT 0,
  paid_commission DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  payment_method VARCHAR(50),
  payment_details JSON,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Affiliate commissions
CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id SERIAL PRIMARY KEY,
  affiliate_id INTEGER NOT NULL REFERENCES affiliate_program(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  commission_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Abandoned cart recovery
CREATE TABLE IF NOT EXISTS abandoned_carts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(100) UNIQUE NOT NULL,
  cart_data JSON NOT NULL,
  email VARCHAR(100),
  phone VARCHAR(20),
  whatsapp VARCHAR(20),
  reminder_sent INTEGER DEFAULT 0,
  last_reminder_sent_at TIMESTAMP WITH TIME ZONE,
  recovered BOOLEAN DEFAULT false,
  recovered_order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  coupon_id INTEGER REFERENCES coupons(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- Blog Categories
-- ===========================================

-- Blog categories
CREATE TABLE IF NOT EXISTS blog_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Blog category assignments
CREATE TABLE IF NOT EXISTS blog_category_assignments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES blog_categories(id) ON DELETE CASCADE,
  UNIQUE(post_id, category_id)
);

-- ===========================================
-- 4. Shipping & Hong Kong Local Adaptation
-- ===========================================

-- Shipping zones (by HK districts)
CREATE TABLE IF NOT EXISTS shipping_zones (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  districts JSON NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Shipping methods (supports all HK couriers + pickup
CREATE TABLE IF NOT EXISTS shipping_methods (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL,
  zone_id INTEGER REFERENCES shipping_zones(id) ON DELETE CASCADE,
  min_order_amount DECIMAL(10,2),
  shipping_fee DECIMAL(10,2) NOT NULL,
  free_shipping_threshold DECIMAL(10,2),
  provider VARCHAR(50),
  tracking_url_template VARCHAR(500),
  is_active BOOLEAN DEFAULT true NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Pickup points (Locker / convenience store / store pickup)
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

-- ===========================================
-- 5. Payment & Financial
-- ===========================================

-- Payment methods (HK all popular methods: FPS/PayMe/AlipayHK/WeChat Pay/Bank Transfer
CREATE TABLE IF NOT EXISTS payment_methods (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  provider VARCHAR(50),
  fee_percent DECIMAL(5,2),
  fee_fixed DECIMAL(10,2),
  instructions TEXT, -- Custom instructions for manual payment (bank transfer FPS details)
  qr_code_image VARCHAR(500), -- PayMe/FPS QR code image URL
  is_active BOOLEAN DEFAULT true NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Payment transactions
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

-- Refunds
CREATE TABLE IF NOT EXISTS refunds (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  type VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  refund_transaction_id VARCHAR(100),
  processed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Invoices (HK tax compliance - 7 years retention)
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  invoice_number VARCHAR(100) UNIQUE,
  title VARCHAR(255),
  company_name VARCHAR(255),
  address TEXT,
  tax_id VARCHAR(50),
  total_amount DECIMAL(10,2) NOT NULL,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  file_url VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- 6. Orders & After Sales
-- ===========================================

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  order_number VARCHAR(50) UNIQUE,
  contact_name VARCHAR(100) NOT NULL,
  contact_phone VARCHAR(20) NOT NULL,
  contact_email VARCHAR(100),
  contact_address TEXT NOT NULL,
  pickup_point_id INTEGER REFERENCES pickup_points(id) ON DELETE SET NULL,
  district VARCHAR(50),
  note TEXT,
  subtotal_amount DECIMAL(10,2) NOT NULL,
  shipping_fee DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  coupon_discount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  payment_method_code VARCHAR(50) NOT NULL,
  payment_status VARCHAR(20) DEFAULT 'pending',
  shipping_method_id INTEGER REFERENCES shipping_methods(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  tracking_number VARCHAR(100),
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  is_cod BOOLEAN DEFAULT false,
  invoice_requested BOOLEAN DEFAULT false,
  invoice_title VARCHAR(255),
  affiliate_id INTEGER REFERENCES affiliate_program(id) ON DELETE SET NULL,
  affiliate_commission DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Order items
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku_id INTEGER REFERENCES product_skus(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  sku_attributes JSON,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Order status history (audit trail)
CREATE TABLE IF NOT EXISTS order_status_history (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status VARCHAR(20),
  to_status VARCHAR(20) NOT NULL,
  note TEXT,
  processed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- After sales / RMA tickets
CREATE TABLE IF NOT EXISTS after_sales_tickets (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL,
  images JSON,
  processed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  resolution_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Cart items
CREATE TABLE IF NOT EXISTS cart_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku_id INTEGER REFERENCES product_skus(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, product_id, sku_id)
);

-- ===========================================
-- 7. Suppliers & Purchasing
-- ===========================================

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  contact_name VARCHAR(50),
  contact_phone VARCHAR(20),
  email VARCHAR(100),
  address TEXT,
  payment_terms VARCHAR(50),
  notes TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Purchase orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id SERIAL PRIMARY KEY,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  po_number VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  total_amount DECIMAL(10,2),
  expected_arrival_date DATE,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Purchase order items
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id SERIAL PRIMARY KEY,
  po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku_id INTEGER REFERENCES product_skus(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  cost_price DECIMAL(10,2) NOT NULL,
  received_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- 8. Content Management & SEO
-- ===========================================

-- Blog posts / content marketing
CREATE TABLE IF NOT EXISTS blog_posts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  featured_image VARCHAR(500),
  status VARCHAR(20) DEFAULT 'draft',
  publish_at TIMESTAMP WITH TIME ZONE,
  meta_title VARCHAR(255),
  meta_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- Indexes for performance
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_product_skus_product_id ON product_skus(product_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_status ON categories(status);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_member_level_id ON users(member_level_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_product_id ON inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_admin_id ON admin_action_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_created_at ON login_logs(created_at);

-- Sessions table (for connect-pg-simple)
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
) WITH (OIDS=FALSE);
ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;

-- ===========================================
-- Initial data
-- ===========================================

-- Insert default Hong Kong shipping zones
INSERT INTO shipping_zones (name, districts) VALUES
('Hong Kong Island', '["Central and Western", "Eastern", "Southern", "Wan Chai"]'),
('Kowloon', "['Yau Tsim Mong', 'Sham Shui Po', 'Kowloon City', 'Wong Tai Sin', 'Kwun Tong']"),
('New Territories East', "['North', 'Sai Kung', 'Sha Tin', 'Tai Po']"),
('New Territories West', "['Kwai Tsing', 'Tsuen Wan', 'Tuen Mun', 'Yuen Long', 'Islands']"),
('Outlying Islands', '["Lantau", "Cheung Chau", "Lamma"]')
ON CONFLICT DO NOTHING;

-- Insert default payment methods (all popular HK options)
INSERT INTO payment_methods (name, code, is_active, sort_order) VALUES
('FPS 轉數快', 'fps', true, 1),
('PayMe by HSBC', 'payme', true, 2),
('Alipay HK', 'alipayhk', true, 3),
('WeChat Pay HK', 'wechathk', true, 4),
('Visa / Mastercard', 'card', true, 5),
('PayPal', 'paypal', true, 6),
('Cash on Delivery 貨到付款', 'cod', true, 7)
ON CONFLICT DO NOTHING;

-- Insert default shipping methods for HK
INSERT INTO shipping_methods (name, type, provider, shipping_fee, is_active, sort_order) VALUES
('順豐速運', 'courier', 'sf_express', 20, true, 1),
('香港郵政', 'courier', 'hongkong_post', 15, true, 2),
('嘉里物流', 'courier', 'kerry', 18, true, 3),
('智能櫃自取', 'pickup', 'locker', 0, true, 4),
('店鋪自取', 'pickup', 'store', 0, true, 5)
ON CONFLICT DO NOTHING;

-- Insert default admin role
-- Super admin has all permissions
INSERT INTO admin_roles (name, description, permissions) VALUES
('Super Admin', 'Full system access', '["*"]')
ON CONFLICT DO NOTHING;
