# -*- coding: utf-8 -*-
"""生成 production migration 003：
- 將 13 個 mzakka 頂層之下的 L2/L3 子樹翻譯成中文，接落現有門市頂層
- mzakka 分類（任意層）1:1 對應 storefront 分類
- product_storefront 改為對應商品實際所屬（最深層）分類
輸出: migrations/003_storefront_three_layer.sql
"""
import sys, io
sys.path.insert(0, 'tmp')
from translations import TRANSLATIONS

# mzakka 頂層名 -> 門市頂層 slug
TOP_MAP = {
    'ローター・クリ,乳首責め': 'storefront-vibrators',
    'バイブ・電マ・ディルド': 'storefront-dildos',
    'オナホール・おっぱい': 'storefront-onahole',
    'ローション・クリーナー': 'storefront-lotion',
    'コスチューム': 'storefront-lingerie',
    'アナル': 'storefront-anal',
    'SM・拘束具': 'storefront-sm',
    'ダッチ・抱き枕・ドール': 'storefront-dolls',
    'コンドーム': 'storefront-condom',
    'ラブサプリ,コスメ,匂い': 'storefront-care',
    '書籍・雑貨': 'storefront-misc',
    'サポートグッズ': 'storefront-misc',
    '業務用': 'storefront-misc',
}

# 讀 raw: lvl|id|parent_id|count|name
rows = {}
order = []
for line in open('tmp/prod-tree-raw.txt'):
    p = line.rstrip('\n').split('|')
    if len(p) < 5:
        continue
    lvl, cid, par, cnt, name = int(p[0]), int(p[1]), p[2], int(p[3]), '|'.join(p[4:])
    par = int(par) if par else None
    rows[cid] = dict(lvl=lvl, par=par, name=name)
    order.append(cid)

# 選出 13 個 mzakka 頂層（名稱喺 TOP_MAP、無 parent）
mz_tops = [cid for cid in order
           if rows[cid]['lvl'] == 1 and rows[cid]['par'] is None
           and rows[cid]['name'] in TOP_MAP]
assert len(mz_tops) == 13, len(mz_tops)

# 建 children 索引
children = {}
for cid, d in rows.items():
    if d['par'] is not None:
        children.setdefault(d['par'], []).append(cid)
# 按 raw 出現順序（反映 sort_order）
for k in children:
    children[k].sort(key=lambda c: order.index(c))

# DFS：產生 storefront 節點
# sf_slug_for[mzakka_id]
sf_slug = {}
new_nodes = []  # (slug, zh_name, parent_sf_slug, sort_order, mzakka_id, lvl)

for top in mz_tops:
    top_sf = TOP_MAP[rows[top]['name']]
    sf_slug[top] = top_sf
    seq = 0
    stack = [(top, 1)]
    # iterative DFS preserving order, assign sort_order at each level
    def walk(mid, lvl):
        global seq
        for ch in children.get(mid, []):
            if ch not in rows:
                continue
            jp = rows[ch]['name']
            zh = TRANSLATIONS[jp]
            short = top_sf.replace('storefront-', '')
            slug = 'sf-%s-%d' % (short, ch)
            par_sf = sf_slug[mid]
            new_nodes.append((slug, zh, par_sf, rows[ch]['lvl'], ch))
            sf_slug[ch] = slug
            walk(ch, lvl + 1)
    walk(top, 1)

# 驗證每個有商品嘅 mzakka 分類（含頂層直屬）都有 sf slug
direct_count = {}
for line in open('tmp/prod-tree-raw.txt'):
    p = line.rstrip('\n').split('|')
    if len(p) >= 4:
        direct_count[int(p[1])] = int(p[3])

covered = sum(c for mid, c in direct_count.items() if mid in sf_slug)
print('mzakka tops:', len(mz_tops), 'new L2/L3 nodes:', len(new_nodes),
      'products covered by direct map:', covered)

def q(s):
    return "'" + s.replace("'", "''") + "'"

out = io.StringIO()
w = out.write
w("-- 門市三層分類（中文）— 由 mzakka active 子樹翻譯生成；可重複執行\n\n")
w("BEGIN;\n\n")
w("-- 1) 新增 L2/L3 門市分類（parent 按 parent slug 對回）\n")
for slug, zh, par_sf, lvl, mid in new_nodes:
    w(("INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)\n"
       "SELECT {n},{n},{s},'storefront','active',{so},id FROM categories WHERE slug={p}\n"
       "ON CONFLICT (slug) DO NOTHING;\n").format(n=q(zh), s=q(slug), so=mid % 100000, p=q(par_sf)))
w("\n-- 2) 直接映射表：mzakka 分類（任意層）-> storefront 分類\n")
w("DROP TABLE IF EXISTS storefront_category_map CASCADE;\n")
w("CREATE TABLE storefront_category_map (\n"
  "  mzakka_category_id INTEGER PRIMARY KEY REFERENCES categories(id) ON DELETE CASCADE,\n"
  "  storefront_category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE\n"
  ");\n")
# top mappings
for mid in mz_tops:
    w("INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)\n"
      "SELECT %d, id FROM categories WHERE slug=%s ON CONFLICT DO NOTHING;\n" % (mid, q(sf_slug[mid])))
for slug, zh, par_sf, lvl, mid in new_nodes:
    w("INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)\n"
      "SELECT %d, id FROM categories WHERE slug=%s ON CONFLICT DO NOTHING;\n" % (mid, q(slug)))
w("\n-- 3) trigger：商品 category_id 直接查映射，對應到實際所屬門市分類\n")
w("""CREATE OR REPLACE FUNCTION refresh_product_storefront() RETURNS trigger AS $$
DECLARE sf_id INTEGER;
BEGIN
  IF NEW.category_id IS NULL THEN
    DELETE FROM product_storefront WHERE product_id = NEW.id;
    RETURN NEW;
  END IF;
  SELECT storefront_category_id INTO sf_id
  FROM storefront_category_map WHERE mzakka_category_id = NEW.category_id;
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

""")
w("-- 4) 回填：清空再由映射重建\n")
w("DELETE FROM product_storefront;\n")
w("INSERT INTO product_storefront (product_id, storefront_category_id)\n"
  "SELECT p.id, m.storefront_category_id\n"
  "FROM products p JOIN storefront_category_map m ON m.mzakka_category_id = p.category_id\n"
  "WHERE p.status='active';\n\n")
w("COMMIT;\n")

open('migrations/003_storefront_three_layer.sql', 'w').write(out.getvalue())
print('migration bytes:', len(out.getvalue()))
