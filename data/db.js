const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'mzakka.db');

class MzakkaDB {
  constructor() {
    this.db = new sqlite3.Database(DB_PATH);
    this.db.run('PRAGMA journal_mode = WAL');
    this.db.run('PRAGMA foreign_keys = ON');
  }

  /**
   * Search products using FTS5 full-text search with pagination
   * @param {string} query - Search query
   * @param {number} page - Page number (1-based)
   * @param {number} limit - Items per page
   * @param {string} categoryFilter - Optional category filter
   * @returns {Promise<{products: Array, total: number, page: number, totalPages: number}>}
   */
  async searchProducts(query, page = 1, limit = 24, categoryFilter = null) {
    const offset = (page - 1) * limit;
    
    let whereClause = '';
    let params = [];
    
    if (query && query.trim()) {
      whereClause = `products_fts MATCH ?`;
      params.push(query.trim());
    }
    
    if (categoryFilter && categoryFilter.trim()) {
      if (whereClause) whereClause += ' AND ';
      whereClause += `p.category LIKE ?`;
      params.push(`%${categoryFilter.trim()}%`);
    }
    
    const where = whereClause ? `WHERE ${whereClause}` : '';
    
    // Get total count
    const countSql = `
      SELECT COUNT(*) as total 
      FROM products p
      ${query ? 'JOIN products_fts ON p.rowid = products_fts.rowid' : ''}
      ${where}
    `;
    
    const totalResult = await this.getAsync(countSql, params);
    const total = totalResult.total;
    const totalPages = Math.ceil(total / limit);
    
    // Get paginated results with ranking
    const sql = `
      SELECT p.*, 
             ${query ? 'rank' : '0 as rank'}
      FROM products p
      ${query ? 'JOIN products_fts ON p.rowid = products_fts.rowid' : ''}
      ${where}
      ${query ? 'ORDER BY rank ASC' : 'ORDER BY p.id'}
      LIMIT ? OFFSET ?
    `;
    
    const products = await this.allAsync(sql, [...params, limit, offset]);
    
    return {
      products,
      total,
      page,
      totalPages,
      limit
    };
  }

  /**
   * Get a single product by ID with its images
   * @param {string} id - Product ID
   * @returns {Promise<object|null>}
   */
  async getProductById(id) {
    const product = await this.getAsync('SELECT * FROM products WHERE id = ?', [id]);
    
    if (!product) return null;
    
    const images = await this.allAsync(
      'SELECT url, isMain FROM product_images WHERE productId = ? ORDER BY isMain DESC',
      [id]
    );
    
    return {
      ...product,
      images
    };
  }

  /**
   * Get categories (flat list, ordered by product count)
   * @returns {Promise<Array>}
   */
  async getCategories() {
    return await this.allAsync(`
      SELECT * FROM categories
      ORDER BY productCount DESC, name ASC
    `);
  }

  /**
   * Get products by category with pagination
   * @param {string} category - Category name or path
   * @param {number} page - Page number (1-based)
   * @param {number} limit - Items per page
   * @returns {Promise<{products: Array, total: number, page: number, totalPages: number}>}
   */
  async getProductsByCategory(category, page = 1, limit = 24) {
    const offset = (page - 1) * limit;
    
    // Get total count
    const countResult = await this.getAsync(
      'SELECT COUNT(*) as total FROM products WHERE category LIKE ?',
      [`%${category}%`]
    );
    
    const total = countResult.total;
    const totalPages = Math.ceil(total / limit);
    
    // Get paginated results
    const products = await this.allAsync(
      'SELECT * FROM products WHERE category LIKE ? ORDER BY id LIMIT ? OFFSET ?',
      [`%${category}%`, limit, offset]
    );
    
    return {
      products,
      total,
      page,
      totalPages,
      limit
    };
  }

  /**
   * Get featured products
   * @param {number} limit - Maximum number of products to return
   * @returns {Promise<Array>}
   */
  async getFeaturedProducts(limit = 20) {
    return await this.allAsync(
      'SELECT * FROM products WHERE featured = 1 ORDER BY RANDOM() LIMIT ?',
      [limit]
    );
  }

  /**
   * Get products by price range
   * @param {number} minPrice - Minimum price
   * @param {number} maxPrice - Maximum price
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @returns {Promise<{products: Array, total: number, page: number, totalPages: number}>}
   */
  async getProductsByPriceRange(minPrice, maxPrice, page = 1, limit = 24) {
    const offset = (page - 1) * limit;
    
    const countResult = await this.getAsync(
      'SELECT COUNT(*) as total FROM products WHERE priceYen BETWEEN ? AND ?',
      [minPrice, maxPrice]
    );
    
    const total = countResult.total;
    const totalPages = Math.ceil(total / limit);
    
    const products = await this.allAsync(
      'SELECT * FROM products WHERE priceYen BETWEEN ? AND ? ORDER BY priceYen LIMIT ? OFFSET ?',
      [minPrice, maxPrice, limit, offset]
    );
    
    return {
      products,
      total,
      page,
      totalPages,
      limit
    };
  }

  /**
   * Get all images for a product
   * @param {string} productId - Product ID
   * @returns {Promise<Array>}
   */
  async getProductImages(productId) {
    return await this.allAsync(
      'SELECT url, isMain FROM product_images WHERE productId = ? ORDER BY isMain DESC',
      [productId]
    );
  }

  /**
   * Get database statistics
   * @returns {Promise<object>}
   */
  async getStats() {
    const productCount = await this.getAsync('SELECT COUNT(*) as count FROM products');
    const categoryCount = await this.getAsync('SELECT COUNT(*) as count FROM categories');
    const imageCount = await this.getAsync('SELECT COUNT(*) as count FROM product_images');
    const featuredCount = await this.getAsync('SELECT COUNT(*) as count FROM products WHERE featured = 1');
    
    return {
      products: productCount.count,
      categories: categoryCount.count,
      images: imageCount.count,
      featured: featuredCount.count
    };
  }

  // Helper methods for promisified sqlite3 calls
  getAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  allAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

// Export singleton instance
module.exports = new MzakkaDB();
module.exports.MzakkaDB = MzakkaDB;
