-- ============================================================
-- 生產庫（Neon neondb）門市兩層分層 — 按「mzakka 頂層分類名稱」對照
-- 唔靠硬編碼 category id（生產庫 id 同本機唔同）。
-- 可重複執行（IF NOT EXISTS / ON CONFLICT / DO UPDATE）。
-- ============================================================

BEGIN;

-- 1) 門市精簡分類（source='storefront'，扁平 13 類）
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order)
VALUES
  ('新到推介', '新到推介', 'storefront-new',       'storefront', 'active', 10),
  ('震動按摩棒', '震動按摩棒', 'storefront-vibrators', 'storefront', 'active', 20),
  ('仿真器具', '仿真器具', 'storefront-dildos',     'storefront', 'active', 30),
  ('飛機杯', '飛機杯', 'storefront-onahole',       'storefront', 'active', 40),
  ('潤滑劑', '潤滑劑', 'storefront-lotion',        'storefront', 'active', 50),
  ('情趣內衣', '情趣內衣', 'storefront-lingerie',  'storefront', 'active', 60),
  ('後庭用品', '後庭用品', 'storefront-anal',       'storefront', 'active', 70),
  ('SM 捆綁', 'SM 捆綁', 'storefront-sm',           'storefront', 'active', 80),
  ('娃娃・抱枕', '娃娃・抱枕', 'storefront-dolls', 'storefront', 'active', 90),
  ('避孕套', '避孕套', 'storefront-condom',        'storefront', 'active', 100),
  ('護理保健', '護理保健', 'storefront-care',       'storefront', 'active', 110),
  ('配件雜貨', '配件雜貨', 'storefront-misc',       'storefront', 'active', 120),
  ('特價區',   '特價區',   'storefront-sale',       'storefront', 'active', 130)
ON CONFLICT (slug) DO NOTHING;

-- 2) 同步頂層分類（按名稱匹配）→ 門市分類 映射
CREATE TABLE IF NOT EXISTS storefront_category_map (
  mzakka_top_id INTEGER PRIMARY KEY REFERENCES categories(id) ON DELETE CASCADE,
  storefront_category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO storefront_category_map (mzakka_top_id, storefront_category_id)
SELECT t.id, s.id
FROM (VALUES
  ('ローター・クリ,乳首責め', 'storefront-vibrators'),
  ('バイブ・電マ・ディルド', 'storefront-dildos'),
  ('オナホール・おっぱい',   'storefront-onahole'),
  ('ローション・クリーナー', 'storefront-lotion'),
  ('コスチューム',           'storefront-lingerie'),
  ('アナル',                 'storefront-anal'),
  ('SM・拘束具',             'storefront-sm'),
  ('ダッチ・抱き枕・ドール', 'storefront-dolls'),
  ('コンドーム',             'storefront-condom'),
  ('ラブサプリ,コスメ,匂い', 'storefront-care'),
  ('書籍・雑貨',             'storefront-misc'),
  ('サポートグッズ',         'storefront-misc'),
  ('業務用',                 'storefront-misc')
) AS v(top_name, sslug)
JOIN categories t ON t.name = v.top_name AND t.parent_id IS NULL
JOIN categories s ON s.slug = v.sslug AND s.source='storefront'
ON CONFLICT (mzakka_top_id) DO UPDATE
  SET storefront_category_id = EXCLUDED.storefront_category_id;

-- 3) 產品 → 門市分類 對應表
CREATE TABLE IF NOT EXISTS product_storefront (
  product_id INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  storefront_category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_storefront_cat ON product_storefront(storefront_category_id);

-- 4) trigger：product.category_id 變動時，搵頂層祖先、查映射、重算
CREATE OR REPLACE FUNCTION refresh_product_storefront() RETURNS trigger AS $$
DECLARE
  top_id INTEGER;
  sf_id INTEGER;
BEGIN
  IF NEW.category_id IS NULL THEN
    DELETE FROM product_storefront WHERE product_id = NEW.id;
    RETURN NEW;
  END IF;

  WITH RECURSIVE anc AS (
    SELECT id, parent_id FROM categories WHERE id = NEW.category_id
    UNION ALL
    SELECT p.id, p.parent_id FROM anc a JOIN categories p ON a.parent_id = p.id
  )
  SELECT id INTO top_id FROM anc WHERE parent_id IS NULL;

  SELECT storefront_category_id INTO sf_id
  FROM storefront_category_map WHERE mzakka_top_id = top_id;

  IF sf_id IS NULL THEN
    DELETE FROM product_storefront WHERE product_id = NEW.id;
  ELSE
    INSERT INTO product_storefront (product_id, storefront_category_id)
    VALUES (NEW.id, sf_id)
    ON CONFLICT (product_id) DO UPDATE
      SET storefront_category_id = EXCLUDED.storefront_category_id, updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_refresh_product_storefront ON products;
CREATE TRIGGER trg_refresh_product_storefront
  AFTER INSERT OR UPDATE OF category_id ON products
  FOR EACH ROW EXECUTE FUNCTION refresh_product_storefront();

-- 5) 回填全部現有產品（觸發重算）
UPDATE products SET category_id = category_id;

COMMIT;
