const fs = require('fs');
const path = require('path');

const ROOT = '/Users/chansiulungfelix/.openclaw/workspace-coding-qwen/Ohya2.0';
const dir = path.join(ROOT, 'routes');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
const txtAll = files.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');

// also app.js
const appTxt = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const all = txtAll + '\n' + appTxt;

const candidates = ["abandoned_carts","admin_action_logs","admin_operation_logs","affiliate_commissions",
"affiliate_conversions","affiliate_program","affiliates","after_sales_tickets","blog_categories",
"blog_category_assignments","blog_posts","coupon_usages","coupons","flash_sale_products","flash_sales",
"invoices","login_logs","member_levels","member_points","order_status_history","points_transactions",
"product_reviews","product_tag_assignments","product_tags","purchase_order_items","purchase_orders",
"related_products","suppliers","user_addresses","user_tag_assignments","user_tags","warehouses"];

// 檢查每個表名有冇喺 SQL DML 語境出現
for (const t of candidates) {
  const re = new RegExp('(?:FROM|JOIN|INTO|UPDATE)\\s+' + t + '\\b', 'i');
  const used = re.test(all);
  // 喺邊個檔
  let where = [];
  for (const f of files) {
    const txt = fs.readFileSync(path.join(dir, f), 'utf8');
    if (re.test(txt)) where.push(f);
  }
  if (re.test(appTxt)) where.push('app.js');
  console.log((used ? '❌ NEEDED  ' : '⚪ unused  ') + t.padEnd(28) + where.join(','));
}
