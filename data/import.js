const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const readline = require('readline');

const DB_PATH = '/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/data/mzakka.db';
const JSONL_PATH = '/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-clone/products-metadata.jsonl';

// Create database connection
const db = new sqlite3.Database(DB_PATH);

// Enable WAL mode for better performance and foreign keys
db.serialize(() => {
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');
  db.run('PRAGMA synchronous = NORMAL');
  db.run('PRAGMA cache_size = -20000'); // 20MB cache
  db.run('PRAGMA temp_store = MEMORY');
  db.run('PRAGMA mmap_size = 30000000000');
});

// Create tables
function createTables() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Drop existing tables for clean import
      db.run('DROP TABLE IF EXISTS product_images');
      db.run('DROP TABLE IF EXISTS products_fts');
      db.run('DROP TABLE IF EXISTS products');
      db.run('DROP TABLE IF EXISTS categories');
      
      // Products table
      db.run(`
        CREATE TABLE products (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          price INTEGER NOT NULL,
          priceYen INTEGER NOT NULL,
          originalPrice INTEGER NOT NULL,
          originalPriceYen INTEGER NOT NULL,
          description TEXT,
          category TEXT,
          url TEXT,
          imageCount INTEGER,
          scrapedAt TEXT,
          featured INTEGER DEFAULT 0
        )
      `);

      // Categories table (hierarchical)
      db.run(`
        CREATE TABLE categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          parentId INTEGER,
          slug TEXT,
          productCount INTEGER DEFAULT 0,
          FOREIGN KEY (parentId) REFERENCES categories(id),
          UNIQUE(name, parentId)
        )
      `);

      // Product images table
      db.run(`
        CREATE TABLE product_images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          productId TEXT NOT NULL,
          url TEXT NOT NULL,
          isMain INTEGER DEFAULT 0,
          FOREIGN KEY (productId) REFERENCES products(id)
        )
      `);

      // Create FTS5 virtual table for full-text search
      db.run(`
        CREATE VIRTUAL TABLE products_fts 
        USING fts5(name, description, category, content='products', content_rowid='rowid')
      `);

      // Indexes for performance
      db.run('CREATE INDEX idx_products_price ON products(priceYen)');
      db.run('CREATE INDEX idx_products_category ON products(category)');
      db.run('CREATE INDEX idx_products_featured ON products(featured) WHERE featured = 1');
      db.run('CREATE INDEX idx_categories_parent ON categories(parentId)');
      db.run('CREATE INDEX idx_product_images_product ON product_images(productId)');

      resolve();
    });
  });
}

// Process categories from a single product's category breadcrumb
function processProductCategories(categoryPath, categoryMap, categoryStmt) {
  if (!categoryPath) return;
  
  const categories = categoryPath.split(' > ').filter(c => c.trim());
  let currentPath = '';
  let parentId = null;
  
  for (let i = 0; i < categories.length; i++) {
    const categoryName = categories[i].trim();
    const parentPath = currentPath;
    currentPath = currentPath ? `${currentPath} > ${categoryName}` : categoryName;
    
    if (!categoryMap.has(currentPath)) {
      categoryMap.set(currentPath, { name: categoryName, parentId, path: currentPath });
      
      const slug = categoryName.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      categoryStmt.run(categoryName, parentId, slug);
      
      // Update parentId for next level
      parentId = categoryMap.size;
    } else {
      parentId = categoryMap.get(currentPath).id || null;
    }
  }
}

// Import products using streaming approach
async function importProducts() {
  let count = 0;
  const categoryMap = new Map();
  const BATCH_SIZE = 1000;
  let productBatch = [];
  let imageBatch = [];
  
  const rl = readline.createInterface({
    input: fs.createReadStream(JSONL_PATH, { encoding: 'utf8', highWaterMark: 1024 * 1024 }),
    crlfDelay: Infinity
  });

  // Begin transaction
  await new Promise((resolve, reject) => {
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  // Prepare statements
  const productStmt = db.prepare(`
    INSERT INTO products 
    (id, name, price, priceYen, originalPrice, originalPriceYen, description, category, url, imageCount, scrapedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const imageStmt = db.prepare(`
    INSERT INTO product_images (productId, url, isMain) VALUES (?, ?, ?)
  `);

  const categoryStmt = db.prepare(`
    INSERT OR IGNORE INTO categories (name, parentId, slug) VALUES (?, ?, ?)
  `);

  // Process each line
  for await (const line of rl) {
    if (!line.trim()) continue;
    
    try {
      const product = JSON.parse(line);
      
      // Insert product
      productStmt.run(
        product.id,
        product.name,
        product.price || 0,
        product.priceYen || 0,
        product.originalPrice || 0,
        product.originalPriceYen || 0,
        product.description || '',
        product.category || '',
        product.url || '',
        product.imageCount || 0,
        product.scrapedAt || ''
      );

      // Process categories from this product
      processProductCategories(product.category, categoryMap, categoryStmt);

      // Insert product images (filter to only include product images)
      if (product.images && product.images.length > 0) {
        for (let i = 0; i < product.images.length; i++) {
          const imageUrl = product.images[i];
          if (imageUrl && imageUrl.includes('/item/') && 
              !imageUrl.includes('/btn_') && 
              !imageUrl.includes('/free/') &&
              !imageUrl.includes('/list.') &&
              !imageUrl.includes('/head_')) {
            const isMain = i === 0 && imageUrl.includes('/main.jpg') ? 1 : 0;
            imageStmt.run(product.id, imageUrl, isMain);
          }
        }
      }

      count++;
      
      if (count % 5000 === 0) {
        console.log(`Imported ${count} products...`);
      }
    } catch (e) {
      console.error('Error processing product:', e.message);
    }
  }

  // Finalize statements
  await new Promise((resolve, reject) => {
    productStmt.finalize((err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  await new Promise((resolve, reject) => {
    imageStmt.finalize((err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  await new Promise((resolve, reject) => {
    categoryStmt.finalize((err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  // Commit transaction
  await new Promise((resolve, reject) => {
    db.run('COMMIT', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  console.log(`Successfully imported ${count} products`);
  console.log(`Extracted ${categoryMap.size} unique categories`);
  return count;
}

// Populate FTS5 index
async function populateFTS() {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO products_fts (rowid, name, description, category)
      SELECT rowid, name, description, category FROM products
    `, (err) => {
      if (err) reject(err);
      else {
        console.log('FTS5 index populated');
        resolve();
      }
    });
  });
}

// Update category product counts
async function updateCategoryCounts() {
  return new Promise((resolve, reject) => {
    db.run(`
      UPDATE categories 
      SET productCount = (
        SELECT COUNT(*) FROM products 
        WHERE products.category LIKE '%' || categories.name || '%'
      )
    `, (err) => {
      if (err) reject(err);
      else {
        console.log('Category product counts updated');
        resolve();
      }
    });
  });
}

// Set some featured products
async function setFeaturedProducts() {
  return new Promise((resolve, reject) => {
    db.run(`
      UPDATE products 
      SET featured = 1 
      WHERE id IN (
        SELECT id FROM products ORDER BY RANDOM() LIMIT 50
      )
    `, (err) => {
      if (err) reject(err);
      else {
        console.log('Featured products set');
        resolve();
      }
    });
  });
}

// Run the import process
async function main() {
  console.log('Starting database import...');
  console.log('Creating tables...');
  await createTables();
  
  console.log('Importing products (streaming)...');
  const count = await importProducts();
  
  console.log('Populating FTS5 search index...');
  await populateFTS();
  
  console.log('Updating category product counts...');
  await updateCategoryCounts();
  
  console.log('Setting featured products...');
  await setFeaturedProducts();
  
  console.log('Database import complete!');
  console.log(`Total products: ${count}`);
  
  // Verify counts
  db.get('SELECT COUNT(*) as count FROM product_images', (err, row) => {
    console.log(`Total product images: ${row.count}`);
  });
  
  db.get('SELECT COUNT(*) as count FROM categories', (err, row) => {
    console.log(`Total categories: ${row.count}`);
    db.close();
  });
}

main().catch(console.error);
