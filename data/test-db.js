const db = require('./db.js');

async function test() {
    console.log('Testing database module...\n');
    
    // Test 1: Get stats
    console.log('1. Database Stats:');
    const stats = await db.getStats();
    console.log(stats);
    console.log();
    
    // Test 2: Search products
    console.log('2. Search for "バイブ":');
    const searchResult = await db.searchProducts('バイブ', 1, 5);
    console.log(`Found ${searchResult.total} results, showing ${searchResult.products.length}`);
    console.log(`Total pages: ${searchResult.totalPages}`);
    console.log();
    
    // Test 3: Get product by ID
    console.log('3. Get product by ID (first product from search):');
    if (searchResult.products.length > 0) {
        const product = await db.getProductById(searchResult.products[0].id);
        console.log(`Name: ${product.name}`);
        console.log(`Price: ¥${product.priceYen}`);
        console.log(`Images: ${product.images ? product.images.length : 0}`);
        if (product.images && product.images.length > 0) {
            console.log(`Main image: ${product.images[0].url}`);
        }
        console.log();
    }
    
    // Test 4: Get categories
    console.log('4. Categories (top 10):');
    const categories = await db.getCategories();
    categories.slice(0, 10).forEach((cat, i) => {
        console.log(`  ${i+1}. ${cat.name} (${cat.productCount} products)`);
    });
    console.log(`  ... total ${categories.length} categories`);
    console.log();
    
    // Test 5: Get products by category
    console.log('5. Products in category "オナホール":');
    const catProducts = await db.getProductsByCategory('オナホール', 1, 5);
    console.log(`Found ${catProducts.total} products`);
    catProducts.products.forEach(p => {
        console.log(`  - ${p.name.substring(0, 50)}...`);
    });
    console.log();
    
    // Test 6: Get featured products
    console.log('6. Featured products (3 random):');
    const featured = await db.getFeaturedProducts(3);
    featured.forEach(p => {
        console.log(`  - ${p.name.substring(0, 50)}... (¥${p.priceYen})`);
    });
    console.log();
    
    // Test 7: Pagination test
    console.log('7. Pagination test (page 2, 10 per page):');
    const page2 = await db.searchProducts('', 2, 10);
    console.log(`Page ${page2.page} of ${page2.totalPages}, showing ${page2.products.length} of ${page2.total}`);
    console.log();
    
    console.log('All tests passed! ✓');
    process.exit(0);
}

test().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
