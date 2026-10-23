#!/usr/bin/env python3
import sqlite3
import json
import re

DB_PATH = '/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-ecommerce/data/mzakka.db'
JSONL_PATH = '/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/mzakka-clone/products-metadata.jsonl'

def slugify(name):
    name = name.lower()
    name = re.sub(r'[^\w\s-]', '', name)
    name = re.sub(r'\s+', '-', name)
    return name

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Clear existing categories and images
    cursor.execute('DELETE FROM categories')
    cursor.execute('DELETE FROM product_images')
    
    # Extract meaningful categories from all products
    # Look at top-level categories from breadcrumbs and common ones
    category_set = set()
    
    print("Analyzing categories from products...")
    
    # Common meaningful categories in adult product sites
    common_categories = [
        'オナホール・おっぱい', 'バイブ・電マ・ディルド', 'ローター', 
        'アナル', 'コンドーム', 'SM・拘束具', 'コスチューム',
        'ダッチ・抱き枕・ドール', 'ローション・クリーナー',
        'サポートグッズ', 'ラブサプリ', '書籍・雑貨', '業務用'
    ]
    
    for cat in common_categories:
        category_set.add(cat)
    
    # Also extract from the first few products to understand structure
    count = 0
    with open(JSONL_PATH, 'r', encoding='utf-8') as f:
        for line in f:
            if count >= 100:  # Sample first 100 products to understand categories
                break
            line = line.strip()
            if not line:
                continue
            product = json.loads(line)
            cat_path = product.get('category', '')
            if cat_path:
                cats = [c.strip() for c in cat_path.split(' > ') if c.strip()]
                # Add reasonable length category names
                for cat in cats:
                    if 2 < len(cat) < 50:  # Reasonable length
                        category_set.add(cat)
            count += 1
    
    print(f"Inserting {len(category_set)} categories...")
    for cat in category_set:
        cursor.execute('INSERT OR IGNORE INTO categories (name, slug) VALUES (?, ?)',
                      (cat, slugify(cat)))
    
    conn.commit()
    
    # Now insert images - loosening the filter a bit
    print("Inserting product images...")
    
    count = 0
    images_inserted = 0
    with open(JSONL_PATH, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
                
            product = json.loads(line)
            product_id = product.get('id', '')
            
            images = product.get('images', [])
            if images:
                added_for_product = 0
                for i, img_url in enumerate(images):
                    if added_for_product >= 3:  # Max 3 images per product
                        break
                    
                    # Filter for actual product images
                    if (img_url and '/item/' in img_url and 
                        not any(x in img_url.lower() for x in [
                            '/btn_', '/free/', '/list.', '/head_', 'mobi.', 
                            '.png', '.gif', 'banner', 'icon'
                        ])):
                        
                        is_main = 1 if '/main.jpg' in img_url else 0
                        cursor.execute('''
                            INSERT INTO product_images (productId, url, isMain)
                            VALUES (?, ?, ?)
                        ''', (product_id, img_url, is_main))
                        added_for_product += 1
                        images_inserted += 1
            
            count += 1
            if count % 5000 == 0:
                print(f"Processed {count} products, {images_inserted} images...")
                conn.commit()
    
    conn.commit()
    
    # Update category counts
    print("Updating category product counts...")
    cursor.execute('''
        UPDATE categories 
        SET productCount = (
            SELECT COUNT(*) FROM products 
            WHERE products.category LIKE '%' || categories.name || '%'
        )
    ''')
    conn.commit()
    
    # Final stats
    cursor.execute('SELECT COUNT(*) FROM categories')
    cat_count = cursor.fetchone()[0]
    cursor.execute('SELECT COUNT(*) FROM product_images')
    img_count = cursor.fetchone()[0]
    
    print(f"\nFinal Update:")
    print(f"Total categories: {cat_count}")
    print(f"Total product images: {img_count}")
    
    conn.close()
    print("Done!")

if __name__ == '__main__':
    main()
