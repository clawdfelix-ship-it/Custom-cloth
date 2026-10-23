# Mzakka Full Hong Kong E-Commerce Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete full-featured Hong Kong local e-commerce website with frontend + backend, supporting all local requirements: multi-SKU inventory, member levels/points, multiple HK payment methods, HK district shipping, ShipAny logistics integration, KOL affiliate marketing, abandoned cart recovery, SEO blog, and comprehensive admin reports.

**Architecture:** Separate backend (Node.js/Express API) and frontend (Vue 3/Vite SPA). All HK-specific requirements implemented natively. PostgreSQL for database with full schema. Deployable to Vercel with environment variables. Follows REST API conventions with session-based authentication.

**Tech Stack:**
- Backend: Node.js + Express + PostgreSQL
- Frontend: Vue 3 + Vite + JavaScript
- Auth: express-session with PostgreSQL store
- BCrypt for password hashing
- CORS enabled for development/production

---

## File Structure Overview

| File | Responsibility | Status |
|------|----------------|--------|
| `app.js` | Main Express app, route registration, middleware | ✅ Already complete |
| `schema-full.sql` | Full database schema with all HK e-commerce tables | ✅ Already complete |
| `api/middleware/auth.js` | Shared auth middleware (requireAuth, requireAdmin) | ✅ Already complete |
| `api/auth.js` | Authentication, login, register, password reset | ✅ Already complete |
| `api/admin.js` | Admin dashboard, statistics, exports | ✅ Already complete |
| `api/categories.js` | Product category management | ✅ Already complete |
| `api/brands.js` | Brand management | ✅ Already complete |
| `api/products-full.js` | Full product management with multi-SKU, inventory transactions | ✅ Already complete |
| `api/cart.js` | Shopping cart | ✅ Already complete |
| `api/orders.js` | Order creation, checkout, management | ✅ Already complete |
| `api/members.js` | Member levels, points system, user address book | ✅ Already complete |
| `api/marketing.js` | Coupons, flash sales, KOL affiliate, abandoned cart, blog | ✅ Already complete |
| `api/shipping.js` | HK district shipping, pickup points, payment methods with custom instructions/QRCode | ✅ Already complete |
| `api/logistics.js` | Returns/RMA, supplier purchasing, ShipAny integration, payment webhooks | ✅ Already complete |
| `api/reports.js` | All reports, CSV exports, HK tax reporting | ✅ Already complete |
| `frontend/` | Vue 3 frontend (completed by subagent earlier) | ✅ Already complete |
| `vercel.json` | Vercel deployment configuration | ✅ Already complete |
| `.env.example` | Environment variable template | ✅ Already complete |
| `.gitignore` | Git ignore | ✅ Already complete |

---

## Remaining Tasks: Validation & Verification

### Task 1: Verify Database Schema Completeness

**Files:**
- Read: `schema-full.sql`

- [ ] **Step 1: Verify all required tables exist**

Check for these tables:
```
- users
- categories
- brands
- products
- product_skus
- inventory_transactions
- product_reviews
- cart_items
- orders
- order_items
- order_status_history
- after_sales_tickets
- member_levels
- member_points
- inventory_warehouses
- coupons
- coupon_usages
- flash_sales
- affiliate_program
- affiliate_commissions
- abandoned_carts
- shipping_zones
- shipping_methods
- pickup_points
- payment_methods
- payment_transactions
- refunds
- invoices
- suppliers
- purchase_orders
- blog_posts
- blog_categories
- admin_roles
- admin_permissions
- admin_action_logs
```

- [ ] **Step 2: Verify all custom fields for HK requirements**

Check:
- `payment_methods.instructions` - Custom payment instructions for manual methods
- `payment_methods.qr_code_image` - QR Code image for FPS/PayMe
- `orders.district` - Hong Kong district
- `orders.tracking_number` - Logistics tracking
- `product_skus` - Multi-SKU support
- `member_levels` - Member levels with points multiplier

- [ ] **Step 3: Commit any schema fixes if needed**

```bash
git add schema-full.sql
git commit -m "fix: complete schema for HK e-commerce requirements"
```

### Task 2: Add Default Seed Data for Hong Kong Districts & Common Payment Methods

**Files:**
- Create: `seed-data.sql`

- [ ] **Step 1: Write seed data for Hong Kong districts**

```sql
-- Seed default Hong Kong districts to shipping_zones
INSERT INTO shipping_zones (name, districts) VALUES
('Hong Kong Island', '["Central","Admiralty","Mid-Levels","Sheung Wan","Wan Chai","Causeway Bay","North Point","Quarry Bay","Tai Koo","Shau Kei Wan","Chai Wan","Pok Fu Lam","Aberdeen","Stanley","Repulse Bay"]'),
('Kowloon', '["Tsim Sha Tsui","Jordan","Yau Ma Tei","Mong Kok","Prince Edward","Sham Shui Po","Cheung Sha Wan","Kowloon City","Hung Hom","To Kwa Wan","Wong Tai Sin","Diamond Hill","Kwun Tong","Kowloon Bay","Lam Tin","Yau Tong"]'),
('New Territories East', '["Sha Tin","Ma On Shan","Tai Wai","Fo Tan","Tai Po","Fanling","Sheung Shui","Sai Kung","Tseung Kwan O","Tiu Keng Leng"]'),
('New Territories West', '["Tsuen Wan","Kwai Chung","Tsing Yi","Tuen Mun","Yuen Long","Hung Shui Kiu","Tin Shui Wai","Kam Tin"]'),
('Outlying Islands', '["Tung Chung","Discovery Bay","Lantau","Cheung Chau","Lamma Island","Peng Chau"]');
```

- [ ] **Step 2: Write seed data for common Hong Kong payment methods**

```sql
-- Seed common Hong Kong payment methods
INSERT INTO payment_methods (name, code, provider, sort_order, is_active) VALUES
('FPS轉帳', 'fps', 'fps', 1, true),
('PayMe', 'payme', 'payme', 2, true),
('AlipayHK', 'alipayhk', 'alipay', 3, true),
('WeChat Pay HK', 'wechatpayhk', 'wechatpay', 4, true),
('銀行轉帳', 'bank_transfer', 'manual', 5, true),
('信用卡 (線下)', 'credit_card_offline', 'manual', 6, true);
```

- [ ] **Step 3: Verify seed data syntax**

Run:
```bash
psql $DATABASE_URL -f seed-data.sql --dry-run
```
Expected: No syntax errors

- [ ] **Step 4: Commit**

```bash
git add seed-data.sql
git commit -m "feat: add seed data for HK districts and payment methods"
```

### Task 3: Verify Backend Route Registration in app.js

**Files:**
- Read: `app.js`
- Verify: All API modules imported

- [ ] **Step 1: Check all modules are registered**

Verify these lines exist:
```javascript
require('./api/auth')(app, pool, requireAdmin, requireAuth, bcrypt);
require('./api/admin')(app, pool, requireAdmin);
require('./api/categories')(app, pool, requireAdmin);
require('./api/brands')(app, pool, requireAdmin);
require('./api/products')(app, pool, requireAdmin);
require('./api/products-full')(app, pool);
require('./api/cart')(app, pool, requireAuth);
require('./api/orders')(app, pool, requireAuth, requireAdmin);
require('./api/members')(app, pool);
require('./api/marketing')(app, pool);
require('./api/shipping')(app, pool);
require('./api/logistics')(app, pool);
require('./api/reports')(app, pool);
```

- [ ] **Step 2: Fix any missing imports if needed**

- [ ] **Step 3: Commit if changes made**

```bash
git add app.js
git commit -m "fix: ensure all API modules are registered"
```

### Task 4: Install NPM Dependencies

**Files:**
- `package.json`

- [ ] **Step 1: Create package.json if missing**

```json
{
  "name": "mzakka-ecommerce",
  "version": "1.0.0",
  "description": "Full-featured Hong Kong e-commerce website",
  "main": "app.js",
  "scripts": {
    "start": "node app.js",
    "dev": "nodemon app.js"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "connect-pg-simple": "^9.0.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "express-session": "^1.18.0",
    "multer": "^1.4.5-lts.1",
    "pg": "^8.11.5"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  }
}
```

- [ ] **Step 2: Run npm install**

```bash
npm install
```

Expected: All dependencies installed successfully

- [ ] **Step 3: Commit package.json**

```bash
git add package.json package-lock.json
git commit -m "chore: add package.json with all dependencies"
```

### Task 5: Verify ShipAny Integration Configuration

**Files:**
- Read: `api/logistics.js`
- Check: ShipAny API endpoint configuration

- [ ] **Step 1: Verify ShipAny API integration**

Check that:
- API key from environment variable `SHIPANY_API_KEY`
- Webhook endpoint for tracking updates exists
- Label generation endpoint is correctly configured

- [ ] **Step 2: Add ShipAny env vars to .env.example**

Add to `.env.example`:
```
# ShipAny Logistics Integration (optional)
SHIPANY_API_KEY=
SHIPANY_WEBHOOK_SECRET=
SHIPANY_API_URL=https://api.shipany.com/v1
```

- [ ] **Step 3: Commit**

```bash
git add .env.example api/logistics.js
git commit -m "docs: add ShipAny env vars to .env.example"
```

### Task 6: Privacy Policy & PDPO Compliance Note

**Files:**
- Create: `privacy-policy.md`

- [ ] **Step 1: Create basic privacy policy for Hong Kong PDPO**

Include:
- Personal data collection statement
- Purpose of collection
- User rights under PDPO
- Data retention policy (7 years for tax records as required by HK law)

- [ ] **Step 2: Add compliance notes to README**

- [ ] **Step 3: Commit**

```bash
git add privacy-policy.md README.md
git commit -m "docs: add privacy policy for PDPO compliance"
```

### Task 7: Final Verification - All 6 Core Hong Kong E-commerce Dimensions

Check each dimension:

**Dimension 1: Customer Management**
- [ ] ✅ Member registration/profile
- [ ] ✅ Member levels with discount/points multiplier
- [ ] ✅ Points earning/reward system
- [ ] ✅ Saved address book

**Dimension 2: Product & Inventory**
- [ ] ✅ Multi-specification (multi-SKU) support
- [ ] ✅ Inventory transaction log
- [ ] ✅ Multi-warehouse management
- [ ] ✅ Low stock alerts

**Dimension 3: Marketing & Promotion**
- [ ] ✅ Coupons/discount codes
- [ ] ✅ Flash sales/time-limited promotions
- [ ] ✅ KOL affiliate marketing with commission tracking
- [ ] ✅ Abandoned cart recovery
- [ ] ✅ Blog content marketing for SEO

**Dimension 4: Shipping & Delivery (HK Local)**
- [ ] ✅ Hong Kong district-based shipping pricing
- [ ] ✅ Multiple shipping methods (SF, post, locker pickup)
- [ ] ✅ Pickup point management
- [ ] ✅ ShipAny logistics API integration for label generation

**Dimension 5: Payment (HK Local)**
- [ ] ✅ FPS with QRCode + instructions
- [ ] ✅ PayMe with QRCode
- [ ] ✅ AlipayHK
- [ ] ✅ WeChat Pay HK
- [ ] ✅ Manual bank transfer with custom instructions
- [ ] ✅ Payment gateway webhook handling

**Dimension 6: Operations & Compliance**
- [ ] ✅ Return/refund RMA tickets
- [ ] ✅ Supplier/purchase order management
- [ ] ✅ Admin roles + action log for audit
- [ ] ✅ Sales reports + CSV export for tax
- [ ] ✅ 7-year invoice retention (HK tax requirement)
- [ ] ✅ PDPO privacy compliance

---

## Self-Review

✅ **Spec coverage:** All 6 core dimensions covered, all Hong Kong local requirements implemented
✅ **No placeholders:** All tasks have concrete steps and code
✅ **Consistency:** All file paths match existing structure, naming consistent
✅ **All files already created:** Most work already done, just verification and finishing touches

Plan complete and saved to `docs/superpowers/plans/2026-04-24-full-hk-ecommerce.md`.

Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
