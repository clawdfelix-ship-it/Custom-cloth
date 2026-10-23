-- 門市三層分類（中文）— 由 mzakka active 子樹翻譯生成；可重複執行

BEGIN;

-- 1) 新增 L2/L3 門市分類（parent 按 parent slug 對回）
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '標準','標準','sf-lotion-69882','storefront','active',69882,id FROM categories WHERE slug='storefront-lotion'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '溫熱・清涼','溫熱・清涼','sf-lotion-69885','storefront','active',69885,id FROM categories WHERE slug='storefront-lotion'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '特殊','特殊','sf-lotion-69902','storefront','active',69902,id FROM categories WHERE slug='storefront-lotion'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '後庭用','後庭用','sf-lotion-69884','storefront','active',69884,id FROM categories WHERE slug='storefront-lotion'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '浴室用','浴室用','sf-lotion-69894','storefront','active',69894,id FROM categories WHERE slug='storefront-lotion'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '飛機杯用','飛機杯用','sf-lotion-69883','storefront','active',69883,id FROM categories WHERE slug='storefront-lotion'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '清潔劑・保養粉','清潔劑・保養粉','sf-lotion-69903','storefront','active',69903,id FROM categories WHERE slug='storefront-lotion'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '大容量（1公升或以上）','大容量（1公升或以上）','sf-lotion-69898','storefront','active',69898,id FROM categories WHERE slug='storefront-lotion'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '免洗潤滑液','免洗潤滑液','sf-lotion-69886','storefront','active',69886,id FROM categories WHERE slug='storefront-lotion'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '愛液型潤滑液','愛液型潤滑液','sf-lotion-69889','storefront','active',69889,id FROM categories WHERE slug='storefront-lotion'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '便攜裝','便攜裝','sf-lotion-69899','storefront','active',69899,id FROM categories WHERE slug='storefront-lotion'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '提升敏感度','提升敏感度','sf-lotion-69887','storefront','active',69887,id FROM categories WHERE slug='storefront-lotion'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '高黏度','高黏度','sf-lotion-69895','storefront','active',69895,id FROM categories WHERE slug='storefront-lotion'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '私處護理','私處護理','sf-lotion-69900','storefront','active',69900,id FROM categories WHERE slug='storefront-lotion'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '親膚','親膚','sf-lotion-69891','storefront','active',69891,id FROM categories WHERE slug='storefront-lotion'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '柔軟','柔軟','sf-lotion-69896','storefront','active',69896,id FROM categories WHERE slug='storefront-lotion'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '活力型','活力型','sf-lotion-69888','storefront','active',69888,id FROM categories WHERE slug='storefront-lotion'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '高黏度・持久保濕','高黏度・持久保濕','sf-lotion-69897','storefront','active',69897,id FROM categories WHERE slug='storefront-lotion'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '注入式','注入式','sf-lotion-69901','storefront','active',69901,id FROM categories WHERE slug='storefront-lotion'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '除臭・抗菌','除臭・抗菌','sf-lotion-69892','storefront','active',69892,id FROM categories WHERE slug='storefront-lotion'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '主題潤滑液','主題潤滑液','sf-lotion-69893','storefront','active',69893,id FROM categories WHERE slug='storefront-lotion'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '唾液型潤滑液','唾液型潤滑液','sf-lotion-69890','storefront','active',69890,id FROM categories WHERE slug='storefront-lotion'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '按類型・尺寸','按類型・尺寸','sf-onahole-69905','storefront','active',69905,id FROM categories WHERE slug='storefront-onahole'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '中・大型半身飛機杯','中・大型半身飛機杯','sf-onahole-69906','storefront','active',69906,id FROM categories WHERE slug='sf-onahole-69905'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '座枱型飛機杯','座枱型飛機杯','sf-onahole-69907','storefront','active',69907,id FROM categories WHERE slug='sf-onahole-69905'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '大型飛機杯','大型飛機杯','sf-onahole-69908','storefront','active',69908,id FROM categories WHERE slug='sf-onahole-69905'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '中型飛機杯','中型飛機杯','sf-onahole-69909','storefront','active',69909,id FROM categories WHERE slug='sf-onahole-69905'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '小型飛機杯','小型飛機杯','sf-onahole-69910','storefront','active',69910,id FROM categories WHERE slug='sf-onahole-69905'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '迷你飛機杯','迷你飛機杯','sf-onahole-69911','storefront','active',69911,id FROM categories WHERE slug='sf-onahole-69905'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '杯型飛機杯','杯型飛機杯','sf-onahole-69912','storefront','active',69912,id FROM categories WHERE slug='sf-onahole-69905'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '電動飛機杯','電動飛機杯','sf-onahole-69913','storefront','active',69913,id FROM categories WHERE slug='sf-onahole-69905'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '娃娃專用飛機杯','娃娃專用飛機杯','sf-onahole-69914','storefront','active',69914,id FROM categories WHERE slug='sf-onahole-69905'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '乳房','乳房','sf-onahole-69915','storefront','active',69915,id FROM categories WHERE slug='sf-onahole-69905'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '保養配件','保養配件','sf-onahole-69916','storefront','active',69916,id FROM categories WHERE slug='sf-onahole-69905'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '充氣娃娃','充氣娃娃','sf-dolls-69921','storefront','active',69921,id FROM categories WHERE slug='storefront-dolls'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '充氣娃娃','充氣娃娃','sf-dolls-69922','storefront','active',69922,id FROM categories WHERE slug='sf-dolls-69921'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '高級充氣娃娃','高級充氣娃娃','sf-dolls-69923','storefront','active',69923,id FROM categories WHERE slug='sf-dolls-69921'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '娃娃專用飛機杯','娃娃專用飛機杯','sf-dolls-69925','storefront','active',69925,id FROM categories WHERE slug='sf-dolls-69921'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '臀部自慰器','臀部自慰器','sf-dolls-69924','storefront','active',69924,id FROM categories WHERE slug='sf-dolls-69921'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '抱枕','抱枕','sf-dolls-69918','storefront','active',69918,id FROM categories WHERE slug='storefront-dolls'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '抱枕套','抱枕套','sf-dolls-69920','storefront','active',69920,id FROM categories WHERE slug='sf-dolls-69918'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '抱枕芯','抱枕芯','sf-dolls-69919','storefront','active',69919,id FROM categories WHERE slug='sf-dolls-69918'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '娃娃','娃娃','sf-dolls-69926','storefront','active',69926,id FROM categories WHERE slug='storefront-dolls'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '矽膠娃娃','矽膠娃娃','sf-dolls-69927','storefront','active',69927,id FROM categories WHERE slug='sf-dolls-69926'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '毛公仔娃娃','毛公仔娃娃','sf-dolls-69928','storefront','active',69928,id FROM categories WHERE slug='sf-dolls-69926'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '震動棒：細碼','震動棒：細碼','sf-dildos-69944','storefront','active',69944,id FROM categories WHERE slug='storefront-dildos'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '震動棒：中碼','震動棒：中碼','sf-dildos-69945','storefront','active',69945,id FROM categories WHERE slug='storefront-dildos'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '震動棒：大碼','震動棒：大碼','sf-dildos-69946','storefront','active',69946,id FROM categories WHERE slug='storefront-dildos'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '電動按摩棒','電動按摩棒','sf-dildos-69930','storefront','active',69930,id FROM categories WHERE slug='storefront-dildos'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '手持型','手持型','sf-dildos-69934','storefront','active',69934,id FROM categories WHERE slug='sf-dildos-69930'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '按摩器','按摩器','sf-dildos-69933','storefront','active',69933,id FROM categories WHERE slug='sf-dildos-69930'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '主機本體','主機本體','sf-dildos-69931','storefront','active',69931,id FROM categories WHERE slug='sf-dildos-69930'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '替換配件頭','替換配件頭','sf-dildos-69932','storefront','active',69932,id FROM categories WHERE slug='sf-dildos-69930'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '假陽具','假陽具','sf-dildos-69935','storefront','active',69935,id FROM categories WHERE slug='storefront-dildos'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '單頭','單頭','sf-dildos-69936','storefront','active',69936,id FROM categories WHERE slug='sf-dildos-69935'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '雙頭','雙頭','sf-dildos-69937','storefront','active',69937,id FROM categories WHERE slug='sf-dildos-69935'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '電動假陽具','電動假陽具','sf-dildos-69938','storefront','active',69938,id FROM categories WHERE slug='sf-dildos-69935'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '穿戴式假陽具','穿戴式假陽具','sf-dildos-69939','storefront','active',69939,id FROM categories WHERE slug='sf-dildos-69935'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '帶吸盤','帶吸盤','sf-dildos-69940','storefront','active',69940,id FROM categories WHERE slug='sf-dildos-69935'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '玻璃假陽具','玻璃假陽具','sf-dildos-69942','storefront','active',69942,id FROM categories WHERE slug='sf-dildos-69935'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '雙穴插入用','雙穴插入用','sf-dildos-69943','storefront','active',69943,id FROM categories WHERE slug='sf-dildos-69935'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '帶骨架・雙層結構','帶骨架・雙層結構','sf-dildos-69941','storefront','active',69941,id FROM categories WHERE slug='sf-dildos-69935'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '單頭震動棒','單頭震動棒','sf-dildos-69948','storefront','active',69948,id FROM categories WHERE slug='storefront-dildos'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '震動棒固定器','震動棒固定器','sf-dildos-69954','storefront','active',69954,id FROM categories WHERE slug='storefront-dildos'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '帶陰蒂震動','帶陰蒂震動','sf-dildos-69949','storefront','active',69949,id FROM categories WHERE slug='storefront-dildos'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT 'G點刺激','G點刺激','sf-dildos-69947','storefront','active',69947,id FROM categories WHERE slug='storefront-dildos'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '防水','防水','sf-dildos-69952','storefront','active',69952,id FROM categories WHERE slug='storefront-dildos'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '活塞震動棒','活塞震動棒','sf-dildos-69951','storefront','active',69951,id FROM categories WHERE slug='storefront-dildos'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '內置轉珠','內置轉珠','sf-dildos-69950','storefront','active',69950,id FROM categories WHERE slug='storefront-dildos'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '溫感震動棒','溫感震動棒','sf-dildos-69953','storefront','active',69953,id FROM categories WHERE slug='storefront-dildos'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '蛋型跳蛋','蛋型跳蛋','sf-vibrators-69956','storefront','active',69956,id FROM categories WHERE slug='storefront-vibrators'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '單件','單件','sf-vibrators-69957','storefront','active',69957,id FROM categories WHERE slug='sf-vibrators-69956'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '棒型跳蛋','棒型跳蛋','sf-vibrators-69958','storefront','active',69958,id FROM categories WHERE slug='storefront-vibrators'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '無線遙控跳蛋','無線遙控跳蛋','sf-vibrators-69959','storefront','active',69959,id FROM categories WHERE slug='storefront-vibrators'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '無線','無線','sf-vibrators-69960','storefront','active',69960,id FROM categories WHERE slug='sf-vibrators-69959'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '特殊跳蛋','特殊跳蛋','sf-vibrators-69966','storefront','active',69966,id FROM categories WHERE slug='storefront-vibrators'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '防水跳蛋','防水跳蛋','sf-vibrators-69964','storefront','active',69964,id FROM categories WHERE slug='storefront-vibrators'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '雙頭・三頭跳蛋','雙頭・三頭跳蛋','sf-vibrators-69961','storefront','active',69961,id FROM categories WHERE slug='storefront-vibrators'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '乳頭跳蛋','乳頭跳蛋','sf-vibrators-69962','storefront','active',69962,id FROM categories WHERE slug='storefront-vibrators'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '手指跳蛋','手指跳蛋','sf-vibrators-69965','storefront','active',69965,id FROM categories WHERE slug='storefront-vibrators'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '陰蒂吸吮','陰蒂吸吮','sf-vibrators-69963','storefront','active',69963,id FROM categories WHERE slug='storefront-vibrators'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '標準','標準','sf-condom-69972','storefront','active',69972,id FROM categories WHERE slug='storefront-condom'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '溫熱與清涼','溫熱與清涼','sf-condom-69973','storefront','active',69973,id FROM categories WHERE slug='storefront-condom'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '溫熱','溫熱','sf-condom-69974','storefront','active',69974,id FROM categories WHERE slug='sf-condom-69973'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '清涼','清涼','sf-condom-69975','storefront','active',69975,id FROM categories WHERE slug='sf-condom-69973'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '凸點螺紋','凸點螺紋','sf-condom-69976','storefront','active',69976,id FROM categories WHERE slug='storefront-condom'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '大碼與細碼','大碼與細碼','sf-condom-69977','storefront','active',69977,id FROM categories WHERE slug='storefront-condom'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '耐力持久型','耐力持久型','sf-condom-69978','storefront','active',69978,id FROM categories WHERE slug='storefront-condom'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '營業用','營業用','sf-condom-69980','storefront','active',69980,id FROM categories WHERE slug='storefront-condom'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '貼身型','貼身型','sf-condom-69979','storefront','active',69979,id FROM categories WHERE slug='storefront-condom'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '超薄型','超薄型','sf-condom-69968','storefront','active',69968,id FROM categories WHERE slug='storefront-condom'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '0.01毫米','0.01毫米','sf-condom-69969','storefront','active',69969,id FROM categories WHERE slug='sf-condom-69968'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '0.02毫米','0.02毫米','sf-condom-69970','storefront','active',69970,id FROM categories WHERE slug='sf-condom-69968'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '0.03毫米','0.03毫米','sf-condom-69971','storefront','active',69971,id FROM categories WHERE slug='sf-condom-69968'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '後庭潤滑液・清洗器','後庭潤滑液・清洗器','sf-anal-69982','storefront','active',69982,id FROM categories WHERE slug='storefront-anal'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '灌腸系列','灌腸系列','sf-anal-69991','storefront','active',69991,id FROM categories WHERE slug='storefront-anal'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '電動灌腸器','電動灌腸器','sf-anal-69992','storefront','active',69992,id FROM categories WHERE slug='sf-anal-69991'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '棒型震動','棒型震動','sf-anal-69984','storefront','active',69984,id FROM categories WHERE slug='storefront-anal'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '後庭拉珠','後庭拉珠','sf-anal-69985','storefront','active',69985,id FROM categories WHERE slug='sf-anal-69984'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '肛塞','肛塞','sf-anal-69986','storefront','active',69986,id FROM categories WHERE slug='storefront-anal'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '電動','電動','sf-anal-69987','storefront','active',69987,id FROM categories WHERE slug='sf-anal-69986'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '帶尾巴','帶尾巴','sf-anal-69989','storefront','active',69989,id FROM categories WHERE slug='sf-anal-69986'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '擴張型','擴張型','sf-anal-69988','storefront','active',69988,id FROM categories WHERE slug='sf-anal-69986'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '指套','指套','sf-anal-69990','storefront','active',69990,id FROM categories WHERE slug='storefront-anal'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '跳蛋','跳蛋','sf-anal-69983','storefront','active',69983,id FROM categories WHERE slug='storefront-anal'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '環・套','環・套','sf-misc-69994','storefront','active',69994,id FROM categories WHERE slug='storefront-misc'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '飛機杯套','飛機杯套','sf-misc-69995','storefront','active',69995,id FROM categories WHERE slug='sf-misc-69994'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '情趣環','情趣環','sf-misc-69997','storefront','active',69997,id FROM categories WHERE slug='sf-misc-69994'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '震動環','震動環','sf-misc-69998','storefront','active',69998,id FROM categories WHERE slug='sf-misc-69994'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '睾丸束縛','睾丸束縛','sf-misc-69999','storefront','active',69999,id FROM categories WHERE slug='sf-misc-69994'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '帶跳蛋套','帶跳蛋套','sf-misc-69996','storefront','active',69996,id FROM categories WHERE slug='sf-misc-69994'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '增大器・泵','增大器・泵','sf-misc-70000','storefront','active',70000,id FROM categories WHERE slug='storefront-misc'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '泵','泵','sf-misc-70001','storefront','active',70001,id FROM categories WHERE slug='sf-misc-70000'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '包皮改善','包皮改善','sf-misc-70002','storefront','active',70002,id FROM categories WHERE slug='storefront-misc'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '女性輔助用品','女性輔助用品','sf-misc-70003','storefront','active',70003,id FROM categories WHERE slug='storefront-misc'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '凱格爾訓練','凱格爾訓練','sf-misc-70004','storefront','active',70004,id FROM categories WHERE slug='sf-misc-70003'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '眼罩','眼罩','sf-sm-70007','storefront','active',70007,id FROM categories WHERE slug='storefront-sm'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '乳頭夾','乳頭夾','sf-sm-70008','storefront','active',70008,id FROM categories WHERE slug='storefront-sm'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '醫療','醫療','sf-sm-70009','storefront','active',70009,id FROM categories WHERE slug='storefront-sm'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '口枷','口枷','sf-sm-70010','storefront','active',70010,id FROM categories WHERE slug='storefront-sm'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '口球','口球','sf-sm-70011','storefront','active',70011,id FROM categories WHERE slug='sf-sm-70010'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '環形口枷','環形口枷','sf-sm-70012','storefront','active',70012,id FROM categories WHERE slug='sf-sm-70010'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '手銬','手銬','sf-sm-70013','storefront','active',70013,id FROM categories WHERE slug='storefront-sm'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '頸枷・項圈','頸枷・項圈','sf-sm-70014','storefront','active',70014,id FROM categories WHERE slug='storefront-sm'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '全身・多重拘束','全身・多重拘束','sf-sm-70015','storefront','active',70015,id FROM categories WHERE slug='storefront-sm'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '腳銬・腿枷','腳銬・腿枷','sf-sm-70016','storefront','active',70016,id FROM categories WHERE slug='storefront-sm'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '繩・鎖鏈','繩・鎖鏈','sf-sm-70017','storefront','active',70017,id FROM categories WHERE slug='storefront-sm'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '大型器具','大型器具','sf-sm-70025','storefront','active',70025,id FROM categories WHERE slug='storefront-sm'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '鞭子','鞭子','sf-sm-70019','storefront','active',70019,id FROM categories WHERE slug='storefront-sm'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '散鞭','散鞭','sf-sm-70020','storefront','active',70020,id FROM categories WHERE slug='sf-sm-70019'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '其他','其他','sf-sm-70026','storefront','active',70026,id FROM categories WHERE slug='storefront-sm'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '貞操鎖','貞操鎖','sf-sm-70022','storefront','active',70022,id FROM categories WHERE slug='storefront-sm'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '拘束膠帶','拘束膠帶','sf-sm-70018','storefront','active',70018,id FROM categories WHERE slug='storefront-sm'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT 'SM束縛服','SM束縛服','sf-sm-70024','storefront','active',70024,id FROM categories WHERE slug='storefront-sm'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '鼻鉤','鼻鉤','sf-sm-70021','storefront','active',70021,id FROM categories WHERE slug='storefront-sm'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '尿道刺激・CBT','尿道刺激・CBT','sf-sm-70023','storefront','active',70023,id FROM categories WHERE slug='storefront-sm'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT 'SM套裝','SM套裝','sf-sm-70006','storefront','active',70006,id FROM categories WHERE slug='storefront-sm'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '戀物氣味用品','戀物氣味用品','sf-care-70040','storefront','active',70040,id FROM categories WHERE slug='storefront-care'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '淫味氣味','淫味氣味','sf-care-70041','storefront','active',70041,id FROM categories WHERE slug='sf-care-70040'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '女生氣味','女生氣味','sf-care-70042','storefront','active',70042,id FROM categories WHERE slug='sf-care-70040'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '男士保健品','男士保健品','sf-care-70033','storefront','active',70033,id FROM categories WHERE slug='storefront-care'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '飲品','飲品','sf-care-70034','storefront','active',70034,id FROM categories WHERE slug='sf-care-70033'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '藥丸型','藥丸型','sf-care-70035','storefront','active',70035,id FROM categories WHERE slug='sf-care-70033'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '活力型','活力型','sf-care-70036','storefront','active',70036,id FROM categories WHERE slug='sf-care-70033'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '持久型','持久型','sf-care-70037','storefront','active',70037,id FROM categories WHERE slug='sf-care-70033'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '陰莖護理膏','陰莖護理膏','sf-care-70038','storefront','active',70038,id FROM categories WHERE slug='sf-care-70033'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '乳頭用','乳頭用','sf-care-70039','storefront','active',70039,id FROM categories WHERE slug='sf-care-70033'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '女性保健品','女性保健品','sf-care-70028','storefront','active',70028,id FROM categories WHERE slug='storefront-care'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '塗抹型','塗抹型','sf-care-70031','storefront','active',70031,id FROM categories WHERE slug='sf-care-70028'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '提升敏感度','提升敏感度','sf-care-70029','storefront','active',70029,id FROM categories WHERE slug='sf-care-70028'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '催情','催情','sf-care-70030','storefront','active',70030,id FROM categories WHERE slug='sf-care-70028'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '乳頭用','乳頭用','sf-care-70032','storefront','active',70032,id FROM categories WHERE slug='sf-care-70028'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '香皂・沐浴用品','香皂・沐浴用品','sf-care-70043','storefront','active',70043,id FROM categories WHERE slug='storefront-care'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '費洛蒙','費洛蒙','sf-care-70044','storefront','active',70044,id FROM categories WHERE slug='storefront-care'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '情趣內衣','情趣內衣','sf-lingerie-70059','storefront','active',70059,id FROM categories WHERE slug='storefront-lingerie'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '內置跳蛋內衣','內置跳蛋內衣','sf-lingerie-70071','storefront','active',70071,id FROM categories WHERE slug='sf-lingerie-70059'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '全包臀內褲','全包臀內褲','sf-lingerie-70060','storefront','active',70060,id FROM categories WHERE slug='sf-lingerie-70059'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '丁字褲','丁字褲','sf-lingerie-70062','storefront','active',70062,id FROM categories WHERE slug='sf-lingerie-70059'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '條紋內褲','條紋內褲','sf-lingerie-70066','storefront','active',70066,id FROM categories WHERE slug='sf-lingerie-70059'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '毛巾布內褲','毛巾布內褲','sf-lingerie-70067','storefront','active',70067,id FROM categories WHERE slug='sf-lingerie-70059'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT 'L碼或以上','L碼或以上','sf-lingerie-70082','storefront','active',70082,id FROM categories WHERE slug='sf-lingerie-70059'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '男士用','男士用','sf-lingerie-70064','storefront','active',70064,id FROM categories WHERE slug='sf-lingerie-70059'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '開洞內褲','開洞內褲','sf-lingerie-70069','storefront','active',70069,id FROM categories WHERE slug='sf-lingerie-70059'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '運動胸圍','運動胸圍','sf-lingerie-70074','storefront','active',70074,id FROM categories WHERE slug='sf-lingerie-70059'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '胸圍內褲套裝','胸圍內褲套裝','sf-lingerie-70076','storefront','active',70076,id FROM categories WHERE slug='sf-lingerie-70059'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '胸圍（標準）','胸圍（標準）','sf-lingerie-70073','storefront','active',70073,id FROM categories WHERE slug='sf-lingerie-70059'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '半包臀內褲','半包臀內褲','sf-lingerie-70061','storefront','active',70061,id FROM categories WHERE slug='sf-lingerie-70059'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '開放式胸圍','開放式胸圍','sf-lingerie-70075','storefront','active',70075,id FROM categories WHERE slug='sf-lingerie-70059'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '吊襪帶','吊襪帶','sf-lingerie-70072','storefront','active',70072,id FROM categories WHERE slug='sf-lingerie-70059'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '透視','透視','sf-lingerie-70081','storefront','active',70081,id FROM categories WHERE slug='sf-lingerie-70059'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '連體情趣內衣','連體情趣內衣','sf-lingerie-70077','storefront','active',70077,id FROM categories WHERE slug='sf-lingerie-70059'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '吊帶背心・性感睡裙','吊帶背心・性感睡裙','sf-lingerie-70078','storefront','active',70078,id FROM categories WHERE slug='sf-lingerie-70059'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '微型比堅尼・彈弓衣','微型比堅尼・彈弓衣','sf-lingerie-70083','storefront','active',70083,id FROM categories WHERE slug='sf-lingerie-70059'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '馬甲胸衣','馬甲胸衣','sf-lingerie-70079','storefront','active',70079,id FROM categories WHERE slug='sf-lingerie-70059'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '晨褸','晨褸','sf-lingerie-70080','storefront','active',70080,id FROM categories WHERE slug='sf-lingerie-70059'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '帶珠子','帶珠子','sf-lingerie-70070','storefront','active',70070,id FROM categories WHERE slug='sf-lingerie-70059'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '花紋內褲','花紋內褲','sf-lingerie-70068','storefront','active',70068,id FROM categories WHERE slug='sf-lingerie-70059'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '綁帶內褲','綁帶內褲','sf-lingerie-70065','storefront','active',70065,id FROM categories WHERE slug='sf-lingerie-70059'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT 'O字褲','O字褲','sf-lingerie-70063','storefront','active',70063,id FROM categories WHERE slug='sf-lingerie-70059'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '體操服・啦啦隊','體操服・啦啦隊','sf-lingerie-70084','storefront','active',70084,id FROM categories WHERE slug='storefront-lingerie'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '護士','護士','sf-lingerie-70085','storefront','active',70085,id FROM categories WHERE slug='storefront-lingerie'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '水手服・制服','水手服・制服','sf-lingerie-70086','storefront','active',70086,id FROM categories WHERE slug='storefront-lingerie'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '水手上衣','水手上衣','sf-lingerie-70087','storefront','active',70087,id FROM categories WHERE slug='sf-lingerie-70086'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '西裝外套','西裝外套','sf-lingerie-70088','storefront','active',70088,id FROM categories WHERE slug='sf-lingerie-70086'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '職業裝','職業裝','sf-lingerie-70089','storefront','active',70089,id FROM categories WHERE slug='sf-lingerie-70086'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '兔女郎・緊身衣','兔女郎・緊身衣','sf-lingerie-70090','storefront','active',70090,id FROM categories WHERE slug='storefront-lingerie'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '女僕裝・圍裙','女僕裝・圍裙','sf-lingerie-70091','storefront','active',70091,id FROM categories WHERE slug='storefront-lingerie'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '圍裙','圍裙','sf-lingerie-70093','storefront','active',70093,id FROM categories WHERE slug='sf-lingerie-70091'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '女僕裝','女僕裝','sf-lingerie-70092','storefront','active',70092,id FROM categories WHERE slug='sf-lingerie-70091'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '動漫・遊戲','動漫・遊戲','sf-lingerie-70094','storefront','active',70094,id FROM categories WHERE slug='storefront-lingerie'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '風俗店營業用','風俗店營業用','sf-lingerie-70116','storefront','active',70116,id FROM categories WHERE slug='storefront-lingerie'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '泳衣','泳衣','sf-lingerie-70055','storefront','active',70055,id FROM categories WHERE slug='storefront-lingerie'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '學校泳衣','學校泳衣','sf-lingerie-70056','storefront','active',70056,id FROM categories WHERE slug='sf-lingerie-70055'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '比堅尼','比堅尼','sf-lingerie-70057','storefront','active',70057,id FROM categories WHERE slug='sf-lingerie-70055'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '競賽泳衣・一件頭','競賽泳衣・一件頭','sf-lingerie-70058','storefront','active',70058,id FROM categories WHERE slug='sf-lingerie-70055'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '其他','其他','sf-lingerie-70117','storefront','active',70117,id FROM categories WHERE slug='storefront-lingerie'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '和服','和服','sf-lingerie-70118','storefront','active',70118,id FROM categories WHERE slug='sf-lingerie-70117'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '襪・絲襪','襪・絲襪','sf-lingerie-70101','storefront','active',70101,id FROM categories WHERE slug='storefront-lingerie'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '連體絲襪','連體絲襪','sf-lingerie-70102','storefront','active',70102,id FROM categories WHERE slug='sf-lingerie-70101'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '長筒襪・膝上襪','長筒襪・膝上襪','sf-lingerie-70103','storefront','active',70103,id FROM categories WHERE slug='sf-lingerie-70101'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '褲襪','褲襪','sf-lingerie-70104','storefront','active',70104,id FROM categories WHERE slug='sf-lingerie-70101'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '二手感服飾','二手感服飾','sf-lingerie-70107','storefront','active',70107,id FROM categories WHERE slug='storefront-lingerie'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '貼身內衣','貼身內衣','sf-lingerie-70108','storefront','active',70108,id FROM categories WHERE slug='sf-lingerie-70107'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '絲襪','絲襪','sf-lingerie-70109','storefront','active',70109,id FROM categories WHERE slug='sf-lingerie-70107'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '衣服','衣服','sf-lingerie-70110','storefront','active',70110,id FROM categories WHERE slug='sf-lingerie-70107'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '充氣娃娃・公仔用','充氣娃娃・公仔用','sf-lingerie-70114','storefront','active',70114,id FROM categories WHERE slug='storefront-lingerie'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '男士用','男士用','sf-lingerie-70046','storefront','active',70046,id FROM categories WHERE slug='storefront-lingerie'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '偽娘','偽娘','sf-lingerie-70047','storefront','active',70047,id FROM categories WHERE slug='sf-lingerie-70046'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '內褲','內褲','sf-lingerie-70049','storefront','active',70049,id FROM categories WHERE slug='sf-lingerie-70046'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '胸圍','胸圍','sf-lingerie-70048','storefront','active',70048,id FROM categories WHERE slug='sf-lingerie-70046'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '絲襪','絲襪','sf-lingerie-70052','storefront','active',70052,id FROM categories WHERE slug='sf-lingerie-70046'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '性感睡裙','性感睡裙','sf-lingerie-70051','storefront','active',70051,id FROM categories WHERE slug='sf-lingerie-70046'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '胸圍內褲套裝','胸圍內褲套裝','sf-lingerie-70050','storefront','active',70050,id FROM categories WHERE slug='sf-lingerie-70046'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '帶環內衣','帶環內衣','sf-lingerie-70053','storefront','active',70053,id FROM categories WHERE slug='sf-lingerie-70046'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '帶陰莖套','帶陰莖套','sf-lingerie-70054','storefront','active',70054,id FROM categories WHERE slug='sf-lingerie-70046'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '聖誕・巫女','聖誕・巫女','sf-lingerie-70095','storefront','active',70095,id FROM categories WHERE slug='storefront-lingerie'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '聖誕老人','聖誕老人','sf-lingerie-70096','storefront','active',70096,id FROM categories WHERE slug='sf-lingerie-70095'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT 'OL辦公室系列','OL辦公室系列','sf-lingerie-70097','storefront','active',70097,id FROM categories WHERE slug='storefront-lingerie'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '飾物配件','飾物配件','sf-lingerie-70112','storefront','active',70112,id FROM categories WHERE slug='storefront-lingerie'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '睡衣・家居服','睡衣・家居服','sf-lingerie-70099','storefront','active',70099,id FROM categories WHERE slug='storefront-lingerie'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '連身裙・中式公主','連身裙・中式公主','sf-lingerie-70098','storefront','active',70098,id FROM categories WHERE slug='storefront-lingerie'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '假髮','假髮','sf-lingerie-70113','storefront','active',70113,id FROM categories WHERE slug='storefront-lingerie'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '紋身貼紙','紋身貼紙','sf-lingerie-70115','storefront','active',70115,id FROM categories WHERE slug='storefront-lingerie'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '手套','手套','sf-lingerie-70105','storefront','active',70105,id FROM categories WHERE slug='storefront-lingerie'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT 'SM束縛服','SM束縛服','sf-lingerie-70106','storefront','active',70106,id FROM categories WHERE slug='storefront-lingerie'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '超薄全透布料','超薄全透布料','sf-lingerie-70111','storefront','active',70111,id FROM categories WHERE slug='storefront-lingerie'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '萬聖節','萬聖節','sf-lingerie-70100','storefront','active',70100,id FROM categories WHERE slug='storefront-lingerie'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '書籍','書籍','sf-misc-70120','storefront','active',70120,id FROM categories WHERE slug='storefront-misc'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '雜貨','雜貨','sf-misc-70121','storefront','active',70121,id FROM categories WHERE slug='storefront-misc'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '風俗店營業用','風俗店營業用','sf-misc-70123','storefront','active',70123,id FROM categories WHERE slug='storefront-misc'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '液體消耗品','液體消耗品','sf-misc-70124','storefront','active',70124,id FROM categories WHERE slug='storefront-misc'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '潤滑液','潤滑液','sf-misc-70125','storefront','active',70125,id FROM categories WHERE slug='sf-misc-70124'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '香皂','香皂','sf-misc-70126','storefront','active',70126,id FROM categories WHERE slug='sf-misc-70124'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '漱口・口腔清潔','漱口・口腔清潔','sf-misc-70128','storefront','active',70128,id FROM categories WHERE slug='sf-misc-70124'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '補充空瓶','補充空瓶','sf-misc-70129','storefront','active',70129,id FROM categories WHERE slug='sf-misc-70124'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '其他','其他','sf-misc-70130','storefront','active',70130,id FROM categories WHERE slug='sf-misc-70124'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '精油','精油','sf-misc-70127','storefront','active',70127,id FROM categories WHERE slug='sf-misc-70124'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '店舖消耗品','店舖消耗品','sf-misc-70131','storefront','active',70131,id FROM categories WHERE slug='storefront-misc'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '其他','其他','sf-misc-70133','storefront','active',70133,id FROM categories WHERE slug='sf-misc-70131'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '手套・指套','手套・指套','sf-misc-70132','storefront','active',70132,id FROM categories WHERE slug='sf-misc-70131'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '店舖雜貨・設備','店舖雜貨・設備','sf-misc-70134','storefront','active',70134,id FROM categories WHERE slug='storefront-misc'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '其他','其他','sf-misc-70137','storefront','active',70137,id FROM categories WHERE slug='sf-misc-70134'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '情趣墊','情趣墊','sf-misc-70135','storefront','active',70135,id FROM categories WHERE slug='sf-misc-70134'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (name, name_zh_hk, slug, source, status, sort_order, parent_id)
SELECT '情趣椅','情趣椅','sf-misc-70136','storefront','active',70136,id FROM categories WHERE slug='sf-misc-70134'
ON CONFLICT (slug) DO NOTHING;

-- 2) 直接映射表：mzakka 分類（任意層）-> storefront 分類
DROP TABLE IF EXISTS storefront_category_map CASCADE;
CREATE TABLE storefront_category_map (
  mzakka_category_id INTEGER PRIMARY KEY REFERENCES categories(id) ON DELETE CASCADE,
  storefront_category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE
);
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69881, id FROM categories WHERE slug='storefront-lotion' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69904, id FROM categories WHERE slug='storefront-onahole' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69917, id FROM categories WHERE slug='storefront-dolls' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69929, id FROM categories WHERE slug='storefront-dildos' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69955, id FROM categories WHERE slug='storefront-vibrators' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69967, id FROM categories WHERE slug='storefront-condom' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69981, id FROM categories WHERE slug='storefront-anal' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69993, id FROM categories WHERE slug='storefront-misc' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70005, id FROM categories WHERE slug='storefront-sm' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70027, id FROM categories WHERE slug='storefront-care' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70045, id FROM categories WHERE slug='storefront-lingerie' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70119, id FROM categories WHERE slug='storefront-misc' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70122, id FROM categories WHERE slug='storefront-misc' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69882, id FROM categories WHERE slug='sf-lotion-69882' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69885, id FROM categories WHERE slug='sf-lotion-69885' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69902, id FROM categories WHERE slug='sf-lotion-69902' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69884, id FROM categories WHERE slug='sf-lotion-69884' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69894, id FROM categories WHERE slug='sf-lotion-69894' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69883, id FROM categories WHERE slug='sf-lotion-69883' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69903, id FROM categories WHERE slug='sf-lotion-69903' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69898, id FROM categories WHERE slug='sf-lotion-69898' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69886, id FROM categories WHERE slug='sf-lotion-69886' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69889, id FROM categories WHERE slug='sf-lotion-69889' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69899, id FROM categories WHERE slug='sf-lotion-69899' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69887, id FROM categories WHERE slug='sf-lotion-69887' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69895, id FROM categories WHERE slug='sf-lotion-69895' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69900, id FROM categories WHERE slug='sf-lotion-69900' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69891, id FROM categories WHERE slug='sf-lotion-69891' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69896, id FROM categories WHERE slug='sf-lotion-69896' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69888, id FROM categories WHERE slug='sf-lotion-69888' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69897, id FROM categories WHERE slug='sf-lotion-69897' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69901, id FROM categories WHERE slug='sf-lotion-69901' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69892, id FROM categories WHERE slug='sf-lotion-69892' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69893, id FROM categories WHERE slug='sf-lotion-69893' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69890, id FROM categories WHERE slug='sf-lotion-69890' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69905, id FROM categories WHERE slug='sf-onahole-69905' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69906, id FROM categories WHERE slug='sf-onahole-69906' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69907, id FROM categories WHERE slug='sf-onahole-69907' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69908, id FROM categories WHERE slug='sf-onahole-69908' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69909, id FROM categories WHERE slug='sf-onahole-69909' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69910, id FROM categories WHERE slug='sf-onahole-69910' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69911, id FROM categories WHERE slug='sf-onahole-69911' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69912, id FROM categories WHERE slug='sf-onahole-69912' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69913, id FROM categories WHERE slug='sf-onahole-69913' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69914, id FROM categories WHERE slug='sf-onahole-69914' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69915, id FROM categories WHERE slug='sf-onahole-69915' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69916, id FROM categories WHERE slug='sf-onahole-69916' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69921, id FROM categories WHERE slug='sf-dolls-69921' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69922, id FROM categories WHERE slug='sf-dolls-69922' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69923, id FROM categories WHERE slug='sf-dolls-69923' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69925, id FROM categories WHERE slug='sf-dolls-69925' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69924, id FROM categories WHERE slug='sf-dolls-69924' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69918, id FROM categories WHERE slug='sf-dolls-69918' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69920, id FROM categories WHERE slug='sf-dolls-69920' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69919, id FROM categories WHERE slug='sf-dolls-69919' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69926, id FROM categories WHERE slug='sf-dolls-69926' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69927, id FROM categories WHERE slug='sf-dolls-69927' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69928, id FROM categories WHERE slug='sf-dolls-69928' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69944, id FROM categories WHERE slug='sf-dildos-69944' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69945, id FROM categories WHERE slug='sf-dildos-69945' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69946, id FROM categories WHERE slug='sf-dildos-69946' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69930, id FROM categories WHERE slug='sf-dildos-69930' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69934, id FROM categories WHERE slug='sf-dildos-69934' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69933, id FROM categories WHERE slug='sf-dildos-69933' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69931, id FROM categories WHERE slug='sf-dildos-69931' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69932, id FROM categories WHERE slug='sf-dildos-69932' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69935, id FROM categories WHERE slug='sf-dildos-69935' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69936, id FROM categories WHERE slug='sf-dildos-69936' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69937, id FROM categories WHERE slug='sf-dildos-69937' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69938, id FROM categories WHERE slug='sf-dildos-69938' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69939, id FROM categories WHERE slug='sf-dildos-69939' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69940, id FROM categories WHERE slug='sf-dildos-69940' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69942, id FROM categories WHERE slug='sf-dildos-69942' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69943, id FROM categories WHERE slug='sf-dildos-69943' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69941, id FROM categories WHERE slug='sf-dildos-69941' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69948, id FROM categories WHERE slug='sf-dildos-69948' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69954, id FROM categories WHERE slug='sf-dildos-69954' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69949, id FROM categories WHERE slug='sf-dildos-69949' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69947, id FROM categories WHERE slug='sf-dildos-69947' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69952, id FROM categories WHERE slug='sf-dildos-69952' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69951, id FROM categories WHERE slug='sf-dildos-69951' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69950, id FROM categories WHERE slug='sf-dildos-69950' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69953, id FROM categories WHERE slug='sf-dildos-69953' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69956, id FROM categories WHERE slug='sf-vibrators-69956' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69957, id FROM categories WHERE slug='sf-vibrators-69957' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69958, id FROM categories WHERE slug='sf-vibrators-69958' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69959, id FROM categories WHERE slug='sf-vibrators-69959' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69960, id FROM categories WHERE slug='sf-vibrators-69960' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69966, id FROM categories WHERE slug='sf-vibrators-69966' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69964, id FROM categories WHERE slug='sf-vibrators-69964' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69961, id FROM categories WHERE slug='sf-vibrators-69961' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69962, id FROM categories WHERE slug='sf-vibrators-69962' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69965, id FROM categories WHERE slug='sf-vibrators-69965' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69963, id FROM categories WHERE slug='sf-vibrators-69963' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69972, id FROM categories WHERE slug='sf-condom-69972' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69973, id FROM categories WHERE slug='sf-condom-69973' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69974, id FROM categories WHERE slug='sf-condom-69974' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69975, id FROM categories WHERE slug='sf-condom-69975' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69976, id FROM categories WHERE slug='sf-condom-69976' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69977, id FROM categories WHERE slug='sf-condom-69977' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69978, id FROM categories WHERE slug='sf-condom-69978' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69980, id FROM categories WHERE slug='sf-condom-69980' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69979, id FROM categories WHERE slug='sf-condom-69979' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69968, id FROM categories WHERE slug='sf-condom-69968' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69969, id FROM categories WHERE slug='sf-condom-69969' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69970, id FROM categories WHERE slug='sf-condom-69970' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69971, id FROM categories WHERE slug='sf-condom-69971' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69982, id FROM categories WHERE slug='sf-anal-69982' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69991, id FROM categories WHERE slug='sf-anal-69991' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69992, id FROM categories WHERE slug='sf-anal-69992' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69984, id FROM categories WHERE slug='sf-anal-69984' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69985, id FROM categories WHERE slug='sf-anal-69985' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69986, id FROM categories WHERE slug='sf-anal-69986' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69987, id FROM categories WHERE slug='sf-anal-69987' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69989, id FROM categories WHERE slug='sf-anal-69989' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69988, id FROM categories WHERE slug='sf-anal-69988' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69990, id FROM categories WHERE slug='sf-anal-69990' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69983, id FROM categories WHERE slug='sf-anal-69983' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69994, id FROM categories WHERE slug='sf-misc-69994' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69995, id FROM categories WHERE slug='sf-misc-69995' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69997, id FROM categories WHERE slug='sf-misc-69997' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69998, id FROM categories WHERE slug='sf-misc-69998' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69999, id FROM categories WHERE slug='sf-misc-69999' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 69996, id FROM categories WHERE slug='sf-misc-69996' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70000, id FROM categories WHERE slug='sf-misc-70000' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70001, id FROM categories WHERE slug='sf-misc-70001' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70002, id FROM categories WHERE slug='sf-misc-70002' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70003, id FROM categories WHERE slug='sf-misc-70003' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70004, id FROM categories WHERE slug='sf-misc-70004' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70007, id FROM categories WHERE slug='sf-sm-70007' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70008, id FROM categories WHERE slug='sf-sm-70008' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70009, id FROM categories WHERE slug='sf-sm-70009' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70010, id FROM categories WHERE slug='sf-sm-70010' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70011, id FROM categories WHERE slug='sf-sm-70011' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70012, id FROM categories WHERE slug='sf-sm-70012' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70013, id FROM categories WHERE slug='sf-sm-70013' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70014, id FROM categories WHERE slug='sf-sm-70014' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70015, id FROM categories WHERE slug='sf-sm-70015' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70016, id FROM categories WHERE slug='sf-sm-70016' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70017, id FROM categories WHERE slug='sf-sm-70017' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70025, id FROM categories WHERE slug='sf-sm-70025' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70019, id FROM categories WHERE slug='sf-sm-70019' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70020, id FROM categories WHERE slug='sf-sm-70020' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70026, id FROM categories WHERE slug='sf-sm-70026' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70022, id FROM categories WHERE slug='sf-sm-70022' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70018, id FROM categories WHERE slug='sf-sm-70018' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70024, id FROM categories WHERE slug='sf-sm-70024' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70021, id FROM categories WHERE slug='sf-sm-70021' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70023, id FROM categories WHERE slug='sf-sm-70023' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70006, id FROM categories WHERE slug='sf-sm-70006' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70040, id FROM categories WHERE slug='sf-care-70040' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70041, id FROM categories WHERE slug='sf-care-70041' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70042, id FROM categories WHERE slug='sf-care-70042' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70033, id FROM categories WHERE slug='sf-care-70033' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70034, id FROM categories WHERE slug='sf-care-70034' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70035, id FROM categories WHERE slug='sf-care-70035' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70036, id FROM categories WHERE slug='sf-care-70036' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70037, id FROM categories WHERE slug='sf-care-70037' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70038, id FROM categories WHERE slug='sf-care-70038' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70039, id FROM categories WHERE slug='sf-care-70039' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70028, id FROM categories WHERE slug='sf-care-70028' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70031, id FROM categories WHERE slug='sf-care-70031' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70029, id FROM categories WHERE slug='sf-care-70029' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70030, id FROM categories WHERE slug='sf-care-70030' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70032, id FROM categories WHERE slug='sf-care-70032' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70043, id FROM categories WHERE slug='sf-care-70043' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70044, id FROM categories WHERE slug='sf-care-70044' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70059, id FROM categories WHERE slug='sf-lingerie-70059' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70071, id FROM categories WHERE slug='sf-lingerie-70071' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70060, id FROM categories WHERE slug='sf-lingerie-70060' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70062, id FROM categories WHERE slug='sf-lingerie-70062' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70066, id FROM categories WHERE slug='sf-lingerie-70066' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70067, id FROM categories WHERE slug='sf-lingerie-70067' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70082, id FROM categories WHERE slug='sf-lingerie-70082' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70064, id FROM categories WHERE slug='sf-lingerie-70064' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70069, id FROM categories WHERE slug='sf-lingerie-70069' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70074, id FROM categories WHERE slug='sf-lingerie-70074' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70076, id FROM categories WHERE slug='sf-lingerie-70076' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70073, id FROM categories WHERE slug='sf-lingerie-70073' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70061, id FROM categories WHERE slug='sf-lingerie-70061' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70075, id FROM categories WHERE slug='sf-lingerie-70075' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70072, id FROM categories WHERE slug='sf-lingerie-70072' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70081, id FROM categories WHERE slug='sf-lingerie-70081' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70077, id FROM categories WHERE slug='sf-lingerie-70077' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70078, id FROM categories WHERE slug='sf-lingerie-70078' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70083, id FROM categories WHERE slug='sf-lingerie-70083' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70079, id FROM categories WHERE slug='sf-lingerie-70079' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70080, id FROM categories WHERE slug='sf-lingerie-70080' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70070, id FROM categories WHERE slug='sf-lingerie-70070' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70068, id FROM categories WHERE slug='sf-lingerie-70068' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70065, id FROM categories WHERE slug='sf-lingerie-70065' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70063, id FROM categories WHERE slug='sf-lingerie-70063' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70084, id FROM categories WHERE slug='sf-lingerie-70084' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70085, id FROM categories WHERE slug='sf-lingerie-70085' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70086, id FROM categories WHERE slug='sf-lingerie-70086' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70087, id FROM categories WHERE slug='sf-lingerie-70087' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70088, id FROM categories WHERE slug='sf-lingerie-70088' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70089, id FROM categories WHERE slug='sf-lingerie-70089' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70090, id FROM categories WHERE slug='sf-lingerie-70090' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70091, id FROM categories WHERE slug='sf-lingerie-70091' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70093, id FROM categories WHERE slug='sf-lingerie-70093' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70092, id FROM categories WHERE slug='sf-lingerie-70092' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70094, id FROM categories WHERE slug='sf-lingerie-70094' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70116, id FROM categories WHERE slug='sf-lingerie-70116' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70055, id FROM categories WHERE slug='sf-lingerie-70055' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70056, id FROM categories WHERE slug='sf-lingerie-70056' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70057, id FROM categories WHERE slug='sf-lingerie-70057' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70058, id FROM categories WHERE slug='sf-lingerie-70058' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70117, id FROM categories WHERE slug='sf-lingerie-70117' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70118, id FROM categories WHERE slug='sf-lingerie-70118' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70101, id FROM categories WHERE slug='sf-lingerie-70101' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70102, id FROM categories WHERE slug='sf-lingerie-70102' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70103, id FROM categories WHERE slug='sf-lingerie-70103' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70104, id FROM categories WHERE slug='sf-lingerie-70104' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70107, id FROM categories WHERE slug='sf-lingerie-70107' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70108, id FROM categories WHERE slug='sf-lingerie-70108' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70109, id FROM categories WHERE slug='sf-lingerie-70109' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70110, id FROM categories WHERE slug='sf-lingerie-70110' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70114, id FROM categories WHERE slug='sf-lingerie-70114' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70046, id FROM categories WHERE slug='sf-lingerie-70046' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70047, id FROM categories WHERE slug='sf-lingerie-70047' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70049, id FROM categories WHERE slug='sf-lingerie-70049' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70048, id FROM categories WHERE slug='sf-lingerie-70048' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70052, id FROM categories WHERE slug='sf-lingerie-70052' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70051, id FROM categories WHERE slug='sf-lingerie-70051' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70050, id FROM categories WHERE slug='sf-lingerie-70050' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70053, id FROM categories WHERE slug='sf-lingerie-70053' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70054, id FROM categories WHERE slug='sf-lingerie-70054' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70095, id FROM categories WHERE slug='sf-lingerie-70095' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70096, id FROM categories WHERE slug='sf-lingerie-70096' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70097, id FROM categories WHERE slug='sf-lingerie-70097' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70112, id FROM categories WHERE slug='sf-lingerie-70112' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70099, id FROM categories WHERE slug='sf-lingerie-70099' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70098, id FROM categories WHERE slug='sf-lingerie-70098' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70113, id FROM categories WHERE slug='sf-lingerie-70113' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70115, id FROM categories WHERE slug='sf-lingerie-70115' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70105, id FROM categories WHERE slug='sf-lingerie-70105' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70106, id FROM categories WHERE slug='sf-lingerie-70106' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70111, id FROM categories WHERE slug='sf-lingerie-70111' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70100, id FROM categories WHERE slug='sf-lingerie-70100' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70120, id FROM categories WHERE slug='sf-misc-70120' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70121, id FROM categories WHERE slug='sf-misc-70121' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70123, id FROM categories WHERE slug='sf-misc-70123' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70124, id FROM categories WHERE slug='sf-misc-70124' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70125, id FROM categories WHERE slug='sf-misc-70125' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70126, id FROM categories WHERE slug='sf-misc-70126' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70128, id FROM categories WHERE slug='sf-misc-70128' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70129, id FROM categories WHERE slug='sf-misc-70129' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70130, id FROM categories WHERE slug='sf-misc-70130' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70127, id FROM categories WHERE slug='sf-misc-70127' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70131, id FROM categories WHERE slug='sf-misc-70131' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70133, id FROM categories WHERE slug='sf-misc-70133' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70132, id FROM categories WHERE slug='sf-misc-70132' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70134, id FROM categories WHERE slug='sf-misc-70134' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70137, id FROM categories WHERE slug='sf-misc-70137' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70135, id FROM categories WHERE slug='sf-misc-70135' ON CONFLICT DO NOTHING;
INSERT INTO storefront_category_map (mzakka_category_id, storefront_category_id)
SELECT 70136, id FROM categories WHERE slug='sf-misc-70136' ON CONFLICT DO NOTHING;

-- 3) trigger：商品 category_id 直接查映射，對應到實際所屬門市分類
CREATE OR REPLACE FUNCTION refresh_product_storefront() RETURNS trigger AS $$
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

-- 4) 回填：清空再由映射重建
DELETE FROM product_storefront;
INSERT INTO product_storefront (product_id, storefront_category_id)
SELECT p.id, m.storefront_category_id
FROM products p JOIN storefront_category_map m ON m.mzakka_category_id = p.category_id
WHERE p.status='active';

ROLLBACK;
