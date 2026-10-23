-- 2026-10-03 新增動態專區「最新上架」
-- 與「新到推介」分別：新到推介 = mzakka 1789 完整排行榜（含舊品重新上榜）；
-- 最新上架 = 店內真正最近上架頭 200 件（new_arrival_rank.rank <= 200）。
INSERT INTO categories (name, name_zh_hk, slug, status, source, sort_order, created_at, updated_at)
VALUES ('最新上架', '最新上架', 'storefront-latest', 'active', 'storefront', 5, NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;
