# mzakka UI/UX 教訓 → Ohya2.0 落地執行表

> 日期：2026-09-18｜對照 `docs/mzakka-uiux-audit-20260918.md`
> 結論：Ohya2.0 架構已遠勝 mzakka，重點係補少數 P0 缺口 + 一個 production 技術債。

## A. 已做到、唔使郁（架構贏緊）
| mzakka 死穴 | Ohya2.0 現況 |
|---|---|
| 雙站 /pc + /sp、UA 302 分流 | ✅ 一套 EJS，內置 `sm/md/lg/xl` 響應式 |
| 寫死 viewport 1065、零 media query | ✅ `width=device-width,initial-scale=1`、Tailwind 斷點 |
| table + float、152px 瘦長卡、高度參差 | ✅ `grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4`、`aspect-square`、統一卡 |
| 冇 h1 / 冇 landmark | ✅ 每頁一個 h1、有 header/nav/footer、sticky header |
| 12px 細字、純紅硬銷 | ✅ 16px 基底、紅/orange 階層、Noto Sans TC |
| 手機冇分類入口 | ✅ `category-mobile-drawer`（P9 已存在）|
| 年齡 modal 冇 Esc/aria/焦點 | ✅ P8 已補 role/aria/Esc/開啟聚焦一次/reduced-motion |
| 375px 購物車擠一橫行 | ✅ P10 已改響應式直排列 |
| 假人氣／缺貨照賣／假加車 | ✅ 真銷量聚合、缺貨 disabled、共享 cart client（P1–P4）|

## B. 要 apply 嘅缺口（按優先級）

### P0 — 手機轉化 & 效能（低成本、即做）
1. **商品卡 CTA tap target 唔夠 44px**
   - 現況：`products.ejs` / `index.ejs` 卡片掣用 `py-2 text-xs`（實際約 32px），同 mzakka 一樣細。
   - 改：卡片「詳情/加車」掣手機 `min-h-[44px]`；細 icon 加車掣擴大可點面（`min-w-[44px]`）。桌面可維持觀感。
2. **全部 `<img>` 冇 lazy-load**（同 mzakka 一樣 0 張）
   - 改：列表/首頁/related/縮圖一律 `loading="lazy"` + `decoding="async"`；**只係詳情頁主圖（LCP）用 `fetchpriority="high"` 唔好 lazy**。
3. **圖片冇明確 width/height → CLS**
   - 已用 `aspect-square` + `h-full w-full`，再補容器 `overflow-hidden`（大部份已有）；確認外接圖唔會跳版。
4. **全站可點最小尺寸保險**
   - theme CSS 加 `@media (pointer:coarse)` 微調（只對真手機），避免純文字連結過密誤觸（選擇性，唔好濫用令版面鬆）。

### P1 — Production 技術債（要你拍板）
5. **用緊 Tailwind Play CDN（`cdn.tailwindcss.com`），11 頁全部載入**
   - 官方明言「not for production」：要落整個 Tailwind + 瀏覽器即時編譯（~400KB JS、阻塞、FOUC、閃一下無樣式）。
   - 方案：改用 **Tailwind CLI 建靜態 `tailwind.css`**（build 時 purge，最終十幾 KB），CI/Zeabur build 跑一次；或短期先咁（流量細可接受，但 Core Web Vitals 會扣分）。
   - 取捨：要加一個 build step。建議上線流量起量前做。

### P2 — 無障礙 / SEO（跟進）
6. 淺灰小字對比：`text-gray-400`（#9ca3af 白底 2.6:1）用喺售價/積分/補充，未達 WCAG AA 4.5:1 → 呢類**有意義文字**轉 `gray-500/600`；純裝飾先准留 400。
7. 商品卡 `<a>` 包住成張卡、內層又有「詳情」連結 → 巢狀互動元素，屏幕閱讀器/語義不佳；改外層卡 div、圖標題一條連結、按鈕獨立。
8. 表單 label / icon 掣 `aria-label`（加車 emoji 掣已有 title 概念，補 `aria-label="加入購物車"`）。

### P3 — 資訊架構（選擇性強化）
9. 篩選/排序：而家一個 sort select（已好過 mzakka 6 個神秘下拉）；日後可加 facet（品牌/價格區間）+ 結果數。
10. 保留並強化 mzakka 證實有效嘅轉化模組：真・排行榜（已有）、最近瀏覽、出貨/到貨日程、原價/特價對比（已有）。

## C. 建議執行批次
- **Batch A（今輪，純模板/CSS，零風險）**：P0 第 1–4 項（lazy、tap 44、圖片穩定、coarse 微調）。
- **Batch B（要決定）**：P1 Tailwind 靜態 build pipeline。
- **Batch C（下輪）**：P2 a11y/SEO（gray 對比、卡巢狀、aria-label）。
