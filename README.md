# Mzakka Hong Kong E-Commerce

A complete full-featured e-commerce website built specifically for the Hong Kong market, with full compliance with local regulations.

## Features

### Core Hong Kong E-Commerce Requirements

✅ **Customer Management**
- Member registration and profile management
- Member levels with points multiplier and discounts
- Points earning and reward system
- Saved address book for multiple shipping addresses

✅ **Product & Inventory**
- Full multi-SKU (multi-specification) support
- Inventory transaction logging
- Multi-warehouse inventory management
- Low stock alerts

✅ **Marketing & Promotion**
- Coupon and discount code system
- Flash sales/time-limited promotions
- KOL affiliate marketing with commission tracking
- Abandoned cart recovery emails
- SEO-friendly blog content management

✅ **Shipping & Delivery (HK Local)**
- Hong Kong district-based shipping pricing
- Multiple shipping methods (SF Express, Speedpost, locker pickup)
- Pickup point management
- Full ShipAny logistics API integration for automated label generation

✅ **Payment (HK Local)**
- FPS transfer with QR code support
- PayMe with QR code
- AlipayHK
- WeChat Pay HK
- Manual bank transfer with custom instructions
- Payment gateway webhook handling

✅ **Operations & Compliance**
- Return/refund RMA ticket system
- Supplier and purchase order management
- Admin roles with action logging for audit
- Sales reports and CSV export for tax filing
- **7-year invoice retention** (complies with Hong Kong Inland Revenue Department requirements)
- **Full PDPO (Personal Data (Privacy) Ordinance) compliance**

## Tech Stack

- **Backend:** Node.js + Express.js
- **Frontend:** Vue 3 + Vite (SPA)
- **Database:** PostgreSQL
- **Authentication:** express-session with PostgreSQL store
- **Password Security:** BCrypt password hashing

## Compliance

This project is built with full compliance for Hong Kong e-commerce operations:

- **PDPO (Personal Data (Privacy) Ordinance):** Privacy policy included, with clear user rights and data collection statements. See [privacy-policy.md](./privacy-policy.md) for details.
- **Tax Retention:** 7-year retention policy for transaction records and invoices, as required by the Hong Kong Inland Revenue Department.
- **Local Payment Methods:** Native support for all popular Hong Kong payment options.
- **Local Shipping:** Pre-seeded Hong Kong districts for accurate shipping pricing.

## Getting Started

1. Clone the repository
2. Copy `.env.example` to `.env` and configure your environment variables
3. Create PostgreSQL database and run `schema-full.sql` to create tables
4. (Optional) Load seed data with `seed-data.sql` for default districts and payment methods
5. Install dependencies: `npm install`
6. Start backend: `npm start`
7. Build and run frontend from the `frontend/` directory

## Deployment

Ready for deployment to Vercel with `vercel.json` configuration. Set the required environment variables in your Vercel project settings.

## License

MIT
