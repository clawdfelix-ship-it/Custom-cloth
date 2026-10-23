#!/usr/bin/env python3
import sqlite3
import json
import os
import re

DB_PATH = '/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/data/mzakka.db'
JSONL_PATH = '/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-clone/products-metadata.jsonl'

def create_tables(conn):
    """Create database tables"""
    cursor = conn.cursor()
    
    # Drop existing tables for clean import
    cursor.execute('DROP TABLE IF EXISTS product_images')
    cursor.execute('DROP TABLE IF EXISTS products_fts')
    cursor.execute('DROP TABLE IF EXISTS products')
    cursor.execute('DROP TABLE IF EXISTS categories')
    
    # Products table
    cursor.execute('''
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
    ''')

    # Categories table (simplified flat list for now)
    cursor.execute('''
        CREATE TABLE categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          slug TEXT,
          productCount INTEGER DEFAULT 0
        )
    ''')

    # Product images table
    cursor.execute('''
        CREATE TABLE product_images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          productId TEXT NOT NULL,
          url TEXT NOT NULL,
          isMain INTEGER DEFAULT 0,
          FOREIGN KEY (productId) REFERENCES products(id)
        )
    ''')

    # Create FTS5 virtual table for full-text search
    cursor.execute('''
        CREATE VIRTUAL TABLE products_fts 
        USING fts5(name, description, category, content='products', content_rowid='rowid')
    ''')

    # Indexes for performance
    cursor.execute('CREATE INDEX idx_products_price ON products(priceYen)')
    cursor.execute('CREATE INDEX idx_products_category ON products(category)')
    cursor.execute('CREATE INDEX idx_products_featured ON products(featured) WHERE featured = 1')
    cursor.execute('CREATE INDEX idx_product_images_product ON product_images(productId)')
    
    conn.commit()
    print("Tables created")

def slugify(name):
    """Create a slug from category name"""
    name = name.lower()
    name = re.sub(r'[^\w\s-]', '', name)
    name = re.sub(r'\s+', '-', name)
    return name

def import_products(conn):
    """Import products from JSONL file"""
    cursor = conn.cursor()
    
    # Use a set to track unique category names
    categories = set()
    
    # Process file line by line
    count = 0
    
    print("Importing products...")
    
    with open(JSONL_PATH, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
                
            try:
                product = json.loads(line)
                
                # Insert product
                cursor.execute('''
                    INSERT OR IGNORE INTO products 
                    (id, name, price, priceYen, originalPrice, originalPriceYen, 
                     description, category, url, imageCount, scrapedAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    product.get('id', ''),
                    product.get('name', ''),
                    product.get('price', 0),
                    product.get('priceYen', 0),
                    product.get('originalPrice', 0),
                    product.get('originalPriceYen', 0),
                    product.get('description', '') or '',
                    product.get('category', '') or '',
                    product.get('url', ''),
                    product.get('imageCount', 0),
                    product.get('scrapedAt', '')
                ))
                
                # Extract unique category names from breadcrumb (first level only)
                category_path = product.get('category', '')
                if category_path:
                    # Get first 2-3 levels of categories
                    cats = [c.strip() for c in category_path.split(' > ') if c.strip()][:3]
                    for cat in cats:
                        if len(cat) > 1 and len(cat) < 100:  # reasonable category name
                            categories.add(cat)
                
                # Insert product images - filter very carefully!
                images = product.get('images', [])
                if images:
                    # Only take up to 5 images per product (main product images)
                    product_images_added = 0
                    for i, img_url in enumerate(images):
                        if product_images_added >= 5:
                            break
                        # Filter to only include actual product item images, not banners/etc
                        if (img_url and '/item/' in img_url and 
                            not any(x in img_url.lower() for x in [
                                '/btn_', '/free/', '/list.', '/head_', 'mobi.jpg', 
                                '.png', '.gif', 'banner', 'mzakka', 'icon', 
                                'btn-', 'button', 'logo'
                            ]) and
                            (img_url.endswith('.jpg') or img_url.endswith('.jpeg'))):
                            
                            is_main = 1 if '/main.jpg' in img_url else 0
                            cursor.execute('''
                                INSERT INTO product_images (productId, url, isMain)
                                VALUES (?, ?, ?)
                            ''', (product.get('id'), img_url, is_main))
                            product_images_added += 1
                
                count += 1
                if count % 5000 == 0:
                    print(f"Imported {count} products...")
                    conn.commit()  # Commit periodically
                    
            except Exception as e:
                print(f"Error processing product {count}: {e}")
                continue
    
    conn.commit()
    
    # Insert unique categories
    print(f"Inserting {len(categories)} unique categories...")
    for cat_name in categories:
        cursor.execute('''
            INSERT OR IGNORE INTO categories (name, slug) VALUES (?, ?)
        ''', (cat_name, slugify(cat_name)))
    conn.commit()
    
    print(f"Total products imported: {count}")
    print(f"Unique categories: {len(categories)}")
    return count

def populate_fts(conn):
    """Populate FTS5 search index"""
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO products_fts (rowid, name, description, category)
        SELECT rowid, name, description, category FROM products
    ''')
    conn.commit()
    print("FTS5 index populated")

def update_category_counts(conn):
    """Update product counts for categories"""
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE categories 
        SET productCount = (
            SELECT COUNT(*) FROM products 
            WHERE products.category LIKE '%' || categories.name || '%'
        )
    ''')
    conn.commit()
    print("Category product counts updated")

def set_featured_products(conn):
    """Set some products as featured"""
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE products 
        SET featured = 1 
        WHERE id IN (
            SELECT id FROM products ORDER BY RANDOM() LIMIT 50
        )
    ''')
    conn.commit()
    print("Featured products set")

def main():
    print("Starting database import...")
    
    # Remove existing database
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    
    # Create database connection with WAL mode
    conn = sqlite3.connect(DB_PATH, isolation_level=None)
    conn.execute('PRAGMA journal_mode = WAL')
    conn.execute('PRAGMA foreign_keys = ON')
    conn.execute('PRAGMA synchronous = NORMAL')
    conn.execute('PRAGMA cache_size = -50000')
    conn.execute('PRAGMA temp_store = MEMORY')
    conn.execute('PRAGMA mmap_size = 30000000000')
    
    create_tables(conn)
    
    count = import_products(conn)
    
    populate_fts(conn)
    update_category_counts(conn)
    set_featured_products(conn)
    
    # Verify counts
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM product_images')
    img_count = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM categories')
    cat_count = cursor.fetchone()[0]
    
    print(f"\nFinal Database Summary:")
    print(f"Total products: {count}")
    print(f"Total product images: {img_count}")
    print(f"Total categories: {cat_count}")
    print("Database import complete!")
    
    conn.close()

if __name__ == '__main__':
    main()
