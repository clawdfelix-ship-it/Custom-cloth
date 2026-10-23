-- mzakka "標準" (order=0) category ordering
-- A product can be listed under several taxonomy nodes (a root page lists the
-- whole subtree), so the rank is per (category, product). Storefront category
-- pages join the rank of the exact node being browsed to reproduce mzakka order.
CREATE TABLE IF NOT EXISTS mzakka_category_rank (
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  rank        INTEGER NOT NULL,
  PRIMARY KEY (category_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_mzakka_rank_product ON mzakka_category_rank(product_id);
CREATE INDEX IF NOT EXISTS idx_mzakka_rank_cat_rank ON mzakka_category_rank(category_id, rank);
