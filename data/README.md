# M-ZAKKA Database Module

SQLite database for the M-ZAKKA e-commerce site with 36,178 products.

## Database Stats

- **Total Products:** 36,178
- **Product Images:** 100,308
- **Categories:** 525
- **Database Size:** 1.6 GB
- **Featured Products:** 50

## Schema

### `products` table
- `id` (TEXT, PRIMARY KEY) - Product ID
- `name` (TEXT) - Product name
- `price`, `priceYen` (INTEGER) - Price in yen
- `originalPrice`, `originalPriceYen` (INTEGER) - Original price
- `description` (TEXT) - Product description
- `category` (TEXT) - Category breadcrumb path
- `url` (TEXT) - Product URL
- `imageCount` (INTEGER) - Number of images
- `scrapedAt` (TEXT) - Scraping timestamp
- `featured` (INTEGER) - 1 = featured product

### `product_images` table
- `id` (INTEGER, PRIMARY KEY)
- `productId` (TEXT, FOREIGN KEY) - Reference to products.id
- `url` (TEXT) - Image URL
- `isMain` (INTEGER) - 1 = main product image

### `categories` table
- `id` (INTEGER, PRIMARY KEY)
- `name` (TEXT, UNIQUE) - Category name
- `slug` (TEXT) - URL-friendly slug
- `productCount` (INTEGER) - Number of products in category

### `products_fts` (FTS5 Virtual Table)
Full-text search index on:
- `name`
- `description`
- `category`

## Usage

```javascript
const db = require('./db.js');

// Search products with pagination
const results = await db.searchProducts('バイブ', 1, 24);
// Returns: { products: Array, total: Number, page: Number, totalPages: Number }

// Get single product with images
const product = await db.getProductById('452');
// Returns: { ...productData, images: Array }

// Get all categories
const categories = await db.getCategories();

// Get products by category with pagination
const catProducts = await db.getProductsByCategory('オナホール', 1, 24);

// Get featured products
const featured = await db.getFeaturedProducts(20);

// Get database stats
const stats = await db.getStats();
```

## Files

- `mzakka.db` - Main SQLite database file
- `db.js` - Node.js database module (promisified API)
- `import.py` - Original Python import script
- `import-simple.py` - Simplified Python import script
- `update-cat-img.py` - Category and image update script
