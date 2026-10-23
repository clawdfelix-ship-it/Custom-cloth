const fs = require('fs');
const path = require('path');
const { toProxyUrl } = require('./imageUtils');
const { yenToHkdCents } = require('./currency');

const PRODUCTS_FILE = path.join(__dirname, '../data/sample-products.jsonl');

let products = [];
let categories = new Map();

function normalizeProduct(item, index) {
  const name = typeof item.name_zh_hk === 'string' ? item.name_zh_hk.trim() : '';
  const category = typeof item.category_zh_hk === 'string' ? item.category_zh_hk.trim() : '';
  const description = typeof item.description_zh_hk === 'string' ? item.description_zh_hk.trim() : '';
  if (!name || !category || !description) return null;

  // 前台 product 價格單位為 HKD cents；日元先用統一匯率轉港幣再 ×100
  const priceYen = typeof item.price === 'number' ? item.price : 29900;
  const originalPriceYen = typeof item.originalPrice === 'number' ? item.originalPrice : 39900;

  return {
    id: index + 1,
    name,
    category,
    price: yenToHkdCents(priceYen),
    originalPrice: yenToHkdCents(originalPriceYen),
    priceYen,
    originalPriceYen,
    description,
    stock: typeof item.stock === 'number' ? item.stock : Math.floor(Math.random() * 100) + 10,
    images: (item.images || []).map(url => toProxyUrl(url)),
    image: (item.images && item.images[0]) ? toProxyUrl(item.images[0]) : null,
    points: Math.floor(priceYen * 0.1),
    isSale: originalPriceYen > priceYen,
    isLimited: typeof item.isLimited === 'boolean' ? item.isLimited : Math.random() > 0.7
  };
}

function buildCategoryMap(list) {
  const map = new Map();
  list.forEach(p => {
    const count = map.get(p.category) || 0;
    map.set(p.category, count + 1);
  });
  return map;
}

function loadProductsFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    const fallback = getFallbackProducts();
    return { products: fallback, categories: buildCategoryMap(fallback) };
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const trimmed = raw.trim();
  if (!trimmed) {
    const fallback = getFallbackProducts();
    return { products: fallback, categories: buildCategoryMap(fallback) };
  }

  const lines = trimmed.split('\n');
  const loaded = lines.map((line, index) => {
    try {
      return normalizeProduct(JSON.parse(line), index);
    } catch (e) {
      return null;
    }
  }).filter(Boolean);

  if (loaded.length === 0) {
    const fallback = getFallbackProducts();
    return { products: fallback, categories: buildCategoryMap(fallback) };
  }

  return { products: loaded, categories: buildCategoryMap(loaded) };
}

function loadProducts() {
  const result = loadProductsFromFile(PRODUCTS_FILE);
  products = result.products;
  categories = result.categories;
  console.log(`✅ Loaded ${products.length} products, ${categories.size} categories`);
  return products;
}

function getFallbackProducts() {
  return [
    {
      id: 1,
      name: 'PRO-E 經典系列',
      category: 'PRO-E 系列',
      price: yenToHkdCents(29900),
      originalPrice: yenToHkdCents(39900),
      priceYen: 29900,
      originalPriceYen: 39900,
      description: '獨特滑動設計，帶來更細緻的觸感體驗；適合追求層次感的用家。',
      stock: 50,
      images: [],
      image: 'https://placehold.co/400x400/222/fff?text=PRO-E',
      points: 2990,
      isSale: true,
      isLimited: false
    },
    {
      id: 2,
      name: 'PRO-E 專用潤滑液',
      category: '護理配件',
      price: yenToHkdCents(15900),
      originalPrice: yenToHkdCents(19900),
      priceYen: 15900,
      originalPriceYen: 19900,
      description: '清爽易沖，黏膩感較低；日常搭配使用更順暢。',
      stock: 80,
      images: [],
      image: 'https://placehold.co/400x400/222/fff?text=LUBE',
      points: 1590,
      isSale: true,
      isLimited: false
    }
  ];
}

// Initialize
loadProducts();

module.exports = {
  loadProductsFromFile,
  getAllProducts: (page = 1, limit = 24) => {
    const start = (page - 1) * limit;
    const end = start + limit;
    return {
      products: products.slice(start, end),
      total: products.length,
      page,
      totalPages: Math.ceil(products.length / limit)
    };
  },

  getProductById: (id) => {
    return products.find(p => p.id === parseInt(id));
  },

  getProductsByCategory: (category, page = 1, limit = 24) => {
    const filtered = products.filter(p => p.category === category);
    const start = (page - 1) * limit;
    const end = start + limit;
    return {
      products: filtered.slice(start, end),
      total: filtered.length,
      page,
      totalPages: Math.ceil(filtered.length / limit)
    };
  },

  searchProducts: (query, page = 1, limit = 24) => {
    const q = query.toLowerCase();
    const filtered = products.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.description.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
    const start = (page - 1) * limit;
    const end = start + limit;
    return {
      products: filtered.slice(start, end),
      total: filtered.length,
      page,
      totalPages: Math.ceil(filtered.length / limit)
    };
  },

  getCategories: () => {
    return Array.from(categories.entries()).map(([name, count]) => ({ name, count }));
  },

  getFeaturedProducts: (limit = 12) => {
    return products.slice(0, limit);
  }
};
