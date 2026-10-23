# mzakka 商品 → 真正 leaf 分類歸類方案

> 研究日期：2026-09-19　配套產物：`data/mzakka-taxonomy.json`（13 roots / 257 nodes / maxDepth 3）、
> parser `scripts/lib/mzakka-taxonomy.js`、爬取 CLI `scripts/build-mzakka-taxonomy.js`、
> 覆蓋率探針 `scripts/probe-mzakka-category-coverage.js`、測試 `test/mzakka-taxonomy.test.js`（10/10 pass）。
> 全部結論均來自真實抓取（HTML cache：`tmp/mzakka-tax-cache/cat-*.html`、`item-*.html`）。

## 1. mzakka 分類系統嘅實際結構（已驗證）

商品頁/分類頁上其實混住四類嘢，舊 parser 全部當分類，先搞出 25,550 個假分類：

| 類別 | 例子 | 處理 |
|---|---|---|
| **真正商品分類樹** | 13 個 root（1792 ローション … 1865 業務用）→ L2 → L3，最多 3 層 | ✅ 保留（257 節點） |
| **屬性 facet（多值標籤）** | 1801 下 `特徴・内部構造別`(2811, ヒダ系/子宮系…)、`素材別`(2812)、`パッケージタイプ別`(2813)、1792 `色・味・香り` | ❌ 剔除 |
| **品牌 facet** | 全站 `メーカー別`(1957, #makert1 內 140 個品牌 id)；根頁 #sub 內嘅 オカモト/サガミ/TENGA/LELO/ペペ/紅椿シリーズ/メテオール 等品牌或品牌系列節點 | ❌ 剔除 |
| **促銷/時間 pseudo 類** | ランキング(2108…)、年間ランキング、新商品(1789/1894)、注目商品、セール(st1=1862)、実演販売(1791)、軽減税率(2736) | ❌ 剔除 |

分辨規則（parser 實際使用，見 `classifyChild()`）：
1. **固定 13 root**（嚟自每頁 `#menu`），加 special id 黑名單（1789/1790/1791/1957/1862）。
2. **facet 群組/促銷 id 黑名單**（`CURATED_FACET_IDS`，逐個用真機頁面驗證過）＋**facet 名稱 pattern**（ランキング/メーカー別/素材別/…別/セール/新商品/年上半期…）。
3. **全站品牌字典**：由任何一頁嘅 `<select id="makert1">` 動態抽 140 個品牌 id；喺 #sub 出現呢啲 id 就算品牌 facet（例如 1826 コンドーム 下 4 個避孕套品牌）。
4. **#sub 以外嘅品牌/系列線**：#makert1 涵蓋唔到嘅 root 專屬品牌線（紅椿/黒猫館/メテオール/PRO-E/オルガスター/飛っ子/LOVE BODY/DANDY CLUB/空気少女…），用樣本商品 breadcrumb 驗證「該節點商品全部同時屬同一 maker」後列入 curated facet；`名器シリーズ`(2348) 呢類真產品類型則列入 curated-real。
5. **breadcrumb 父子校驗**：257 個節點逐個抓頁面，`#breadcrumb` 解析出嘅 chain 同 taxonomy 父子關係 **244/244 一致、0 mismatch**；全部節點均有商品（0 個空節點）。
6. 1801 特殊處理：佢個 #sub 係一袋新舊混雜嘅 legacy id（2635 ヒダ系 同 facet 2825 重複呢類），只保留 mzakka 自己編輯區承認嘅 `タイプ・サイズ別`(2810)，真 leaf 由 2810 頁嘅 #sub 取（11 個：2814–2824）。

> 註：1801 頁 HTML 註解入面段 `<p><b>タイプ・サイズ別</b>…` 係**過期**內容（得 7 個 leaf 2814/2815/2820..2824）；live 2810 頁有 11 個（多咗 2816 大型/2817 中型/2818 小型/2819 ミニ）。parser 保留 `extractOnaholeIntroGroups()` 僅供測試/診斷，唔用嚟建樹。

商品頁 breadcrumb 係**多行**（每個分類路徑一行，`<br>` 分隔），facet chain 同真 chain 並列。例：`M12500` 同時有
`1801 > 1934 メーカー別 > 1948 マジックアイズ`、`1801 > 2810 タイプ・サイズ別 > 2816 大型ホール`、
`1801 > 2811 特徴… > 2825 ヒダ系`、`1801 > 2812 素材別` 等十幾行——舊 parser 將佢哋當一條巢狀路徑係災難根源。

## 2. 本地商品點對到 item_id

- import 程式 `utils/mzakkaImport.js`：`makeProductSlug(id) = "mzakka-" + id.toLowerCase()`，
  且 `products.source_key` 直接存 mzakka item id（`source_key: String(item.id).trim()`）。
- 即係話 **item_id = slug 去掉 `mzakka-` 前綴**（或直接用 source_key，更穩陣）。
  mzakka id 形態為前綴字母＋數字：`M12500 / W9432 / L6452 / F12724 / S10121 / A5314 / D1049`。
- 建議用 `source_key` 做主鍵對照，slug 做 fallback；兩者都唔使掂商品頁 HTML。

## 3. 推薦歸類方案：爬「真分類列表頁」做 item_id → leaf 映射（A 方案，主）

**做法**：對 taxonomy 每個真節點（257 個）由淺到深翻佢嘅商品列表頁：
- URL：`/pc/detail/category.php?category=NNN&p1=<0-indexed page>`；分頁連結「最後」可直接拎總頁數（`extractPaging()`：`N件中` + `&p1=K">最後` ⇒ K+1 頁），每頁 200 件。
- 每頁 item link 形如 `item.php?item_id=XXXX&category=NNN`，NNN 必係**當前分類頁自己**（已驗證多頁 400/200 link 全部一致），所以可以直接信。
- 只爬真分類節點（唔爬 facet/品牌/ranking/セール 頁），每件商品喺邊個最深節點頁出現，就歸嗰個 node（depth 3 > 2 > 1）。跨 root 商品（例：避孕套同時喺 1826 同 1865 業務用）會得到多過一個候選——見 §5 仲裁。

**點解好過爬 12,448 個商品頁**：列表頁 1 頁 200 件、分頁總數已知、request 量細兩個數量級，且唔會引入任何品牌/屬性 facet。

### 抓取量估算（全部 257 節點第一頁已抓，數字為實測）

| root | 節點數 | 列表 item 次數（含跨類重複） | 估算頁數(200/頁) |
|---|---:|---:|---:|
| 1792 ローション | 23 | 9,058 | 56 |
| 1801 オナホ | 13 | 18,231 | 97 |
| 1808 ダッチ | 12 | 6,086 | 37 |
| 1811 バイブ | 26 | 17,337 | 100 |
| 1820 ローター | 12 | 11,497 | 62 |
| 1826 コンドーム | 14 | 1,448 | 18 |
| 1831 アナル | 12 | 7,160 | 41 |
| 1837 サポート | 12 | 5,594 | 36 |
| 1841 SM | 22 | 7,643 | 50 |
| 1851 サプリ | 18 | 7,129 | 44 |
| 1852 コスチューム | 74 | 42,284 | 252 |
| 1861 書籍雑貨 | 3 | 2,108 | 12 |
| 1865 業務用 | 16 | 2,251 | 22 |
| **合計（上限）** | **257** | **137,826** | **827** |

- 827 頁 × 0.85s ≈ **12 分鐘** sequential 行得完（禮貌、可 resume，cache 已就緒）；商品去重後實際要寫嘅映射約 1.2–1.3 萬條。
- 日後 refresh 只需重跑 `--refresh`（taxonomy）＋列表翻頁，可只行商品有變動嘅 root。

### 樣本實測覆蓋率（`probe-mzakka-category-coverage.js`，全翻頁真爬）

| root | 見到商品數 | L3 | L2 | 僅 root | **L2/L3 覆蓋率** | 頁數 |
|---|---:|---:|---:|---:|---:|---:|
| 1826 コンドーム | 545 | 115 | 383 | 47 | **91.4%** | 16 |
| 1837 サポート | 1,921 | 1,369 | 453 | 99 | **94.8%** | 36 |
| 1861 書籍・雑貨 | 1,077 | 0 | 1,031 | 46 | **95.7%** | 12 |

即 **~92–96% 商品可自動落到 L2 或 L3 leaf**；餘下 4–8% 只喺 root 頁出現（root 本身就係佢嘅 leaf，語義上都算成功掛類，只係深度=1）。
保守估計全店：**≥90% 有 L2+ 分類，≈100% 最少掕到 root**（13 個 root 覆蓋全站，呢點由每個商品 breadcrumb 第一行總係 1789 promos 之後接一個真 root 可證）。

## 4. B 方案（補充/驗證）：商品頁多行 breadcrumb

對每件商品（或抽樣）抓 `item.php?item_id=X`，用 `extractItemBreadcrumbChains()` 拆行，
只保留「每個 id 都喺真 taxonomy、且始於 13 root」嘅 chain，再用 `resolveCanonicalLeaf()` 仲裁：

1. 剔除 `業務用`(1865) 呢類跨切面 B2B root（除非商品只得 1865 一條真 chain）；
2. **取 breadcrumb 入面第一條真 chain 所屬 root**（實測 mzakka 將主產品類別排最前，
   假髮/備品/通用「その他」等次要目錄排後；例 S10121 第一真 chain 係 1801>2810>2822，唔係後面嘅 1852 ウィッグ）；
3. 喺同一 root 內取**最深** chain（1801 額外優先 2810 タイプ・サイズ別，避開 legacy 平行 id）。

49 個跨 13 root 樣本商品：**49/49（100%）可解出唯一真 leaf**（test 覆蓋 M12500→2816、S10121→2822、L6452→2506 等）。
代價：12,448 個商品頁 × 0.85s ≈ 3 小時（可用於事後 QC 或 A 方案有歧義時嘅 tie-breaker，唔建議做主力）。

## 5. 跨類/多候選仲裁（A、B 共用）

- 同一商品喺多個真 leaf 出現時：**優先最深**；同深時：
  1. 1865 業務用 永遠讓位俾產品類 root；
  2. 1852 コスチューム vs SM 2487/2488 呢類真正重疊：以商品頁第一條真 chain（B 方案）或者列表頁「喺較細/較專屬節點出現」為準，其餘候選存入 `alternate_category_ids`（唔好嘢信息，frontend 可做 secondary tag）。
- 真係冇任何真分類訊號（停售/異常頁）：fallback 順序
  `source 舊資料嘅 root 名 → 人手 review queue → 「未分類」`，預計 <1%。

## 6. 落地方案建議（唔在今次研究範圍內改庫，只列步驟）

1. `data/mzakka-taxonomy.json` 入 categories 表（id 保留 mzakka 數字 id 做 `source_category_id`，257 列、parent_id、depth）。
2. 跑一個約 12 分鐘嘅列表爬取（可寫成新 script，重用 `createFetcher` + `extractItemLinks` + `extractPaging`，逐 root 全翻頁），產 `tmp/item-leaf-map.jsonl`（item_id, leaf_id, depth, alternates）。
3. 用 source_key/slug join 12,448 商品，逐件取最深 leaf；預期 ≥90% L2+、近乎 100% 有 root。
4. B 方案抽 5–10%（或只抽多候選/root-only 商品）做 QC；對唔到嘅入 review queue。
5. 之後每月/新品 crawl 時增量更新映射；taxonomy 半年重 build 一次就得（mzakka 大類好穩定，2018 年 ranking id 都仲喺度）。

## 7. 風險與結構特殊頁

- **1801 オナホ係全站最亂一頁**：#sub 有 33 個 id 混雜 facet 群組、品牌（TENGA 1807）、同埋一組 legacy 平行分類 id（1802 非貫通、2635 ヒダ系…）。呢啲 legacy id 喺商品 breadcrumb 仍會出現（例如 M8480 同時列 1802 同 2822），故 1801 只採 2810 一條權威類型樹；若將來想保留「非貫通/貫通」呢類傳統切法，要另開平行 taxonomy 而唔好同 2810 混埋。
- **品牌線偽裝成分類**：メテオール/オルガスター/飛っ子/紅椿/LOVE BODY/フェアリー/シルフィー/DANDY CLUB 等喺 #sub 同名稱同樣式，全部已逐個用商品 breadcrumb + maker chain 驗證係單一品牌/系列並列入黑名單；若 mzakka 新增同類節點，curated 黑名單要更新（run 完 build 後人工睇一次每層輸出即可，build log 會逐個印 dropped 原因）。
- **跨切面 root 1865 業務用**：773 件鋪頭貨入面大量同 1792/1820/1852/1826 重複，必須喺仲裁階段讓位，否則會成錯類。
- **コスチューム(1852) 係最大 root**（42,284 列表次/74 節點/252 頁），同 1841 SM（2487/2488）有雙掛；「男性用」(2095) 同「ランジェリー>男性用」(2168) 並存，列表法自然取較深嘅 2168。
- 分類頁全部係 server-rendered HTML，**冇搵到動態載入子類**（cat5 常駐 disabled，冇 AJAX tree endpoint）；sitemap（`/sitemap.xml`，976 個 category URL）存在但係**扁平、無父子關係**，只適合用做 id 宇宙核對，唔可以用嚟建樹。
