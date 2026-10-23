# Ohya2.0 前台 UI/UX 出廠審查

> 2026-09-18 · 靜態範本/CSS 審查（冇 live/冇起 server）· 總判決：**🔴 HOLD，未出得廠**
> 原因唔係樣靚唔靚，而係「用戶行唔成交易」+「講大話 UI」。下列關鍵項已由主 agent 核實屬真。

## 🔴 阻塞級

| # | 問題 | 位置（已核實） |
|---|---|---|
| P1 | **貨幣符號顯示 ¥（日圓）唔係 HK$**，香港客唔知係港紙定日圓 | `app.js:447`、`views/cart.ejs:56,136` |
| P2 | **列表頁「🛒加購物車」係假按鈕**：只將 header 數字 +1 同彈 alert，冇寫 localStorage、冇打 API → 彈「已加入」但入車係空 | `views/products.ejs:183-190`（首頁/product 頁嘅加購先係真） |
| P3 | **缺貨（stock=0）照樣可加車落單**：列表照出「存貨緊張」、詳情頁主掣冇 disabled、數量最少 1 | products.ejs:78,102；product.ejs:123,169,175 |
| P4 | **「人氣排行」係假**：同「最新上架」食同一組數據，後端只 `ORDER BY created_at DESC`，根本冇銷量排名 | index.ejs:92,95,125；app.js:631-635 |
| P5 | **用戶界面出現開發者備註**：hero 副文、列表「將分類留喺左欄…」、排序 filler 等內部重構筆記當咗門面文案 | index.ejs:47；products.ejs:41,54 |
| P6 | **結帳只得一版 form**：冇步驟、冇運費、冇付款流程、冇確認頁；但商品頁擺咗「🚚免運費」「🔒安全付款」徽章（講咗做唔到）；提交後喺原位彈一句，refresh 就唔見 | cart.ejs:54-65；orders.js:99-102；product.ejs:182-184 |
| P7 | **成個會員中心/訂單查詢/地址簿/積分 UI 唔存在**：後台 JSON API 齊（members.js、GET /api/orders）但零頁面；header「會員中心」係死鏈 `href="#"`；客戶端冇登出。用戶落單後搵唔返張單 | views/ 只有 admin/cart/index/login/partials/product/products/register，**冇 member/account/order 範本**；header.ejs:31 |
| P8 | **全站零 focus style，11 處主動剷 focus ring**；年齡 modal / 手機分類抽屜冇 focus trap、`role=dialog`、`aria-modal`、`aria-expanded` | 全站 `:focus-visible` = 0；`focus:outline-none` ×11；age-modal.ejs |
| P9 | **手機首頁冇分類入口**（mobile drawer 只喺 products/product include，index 冇）；<640px 連「會員中心/登入」連結都 `hidden sm:inline` 消失，header 冇漢堡 | index.ejs 冇 include drawer；header.ejs:31,33 |
| P10 | **購物車列 375px 會擠爆**：80px 圖+名+120px 增減器+金額塞一行冇 wrap；增減掣 32px 低於 44px 觸控建議 | cart.ejs renderCart ~255-285,271-273 |

## 🟡 建議級

- **P11 Tailwind Play CDN 用於生產**，每頁重複貼 head；`partials/head.ejs` 存在但從未被 include → 已漂移（`.jpn-bracket` 兩款樣：products.ejs:13-19 vs index.ejs:11-13）。改真 Tailwind build + 共享 head。
- **P12 冇設計 token**：`mzakka-theme.css` 只得 13 行/356 bytes；主 CTA 紅有 red-600/red-700 兩隻，圓角 rounded-lg/xl/2xl/3xl、shadow-sm/lg 亂用。定 `--color-brand` 等 token。
- **P13 對比度唔達 WCAG AA**：`text-gray-400`(#9ca3af) on white ≈ 2.6:1，用於分類計數等細字；需 ≥4.5:1。
- **XSS 介面**：product.ejs 用 `<%- contentHtml %>` 渲染爬返嚟嘅 HTML（同安全報告 P1 呼應）。
- 死模組：最近瀏覽、收藏愛心掣、footer 一堆 `#` 連結都無功能；建議未做好先刪，唔好擺樣。

## ✅ 做得好，唔好亂改
- 商品詳情頁完成度最高：gallery、breadcrumb、積分、相關商品齊
- guest cart → 登入合併 server cart 嘅設計有諗過（cart.ejs:140-167 `syncGuestCartToServer`）
- 列表頁有空結果、排序、pagination
- 卡片骨架、紅色 accent、圓角、留白整體整齊

## 🔝 PASS 條件（最優先）
1. P1 貨幣統一 HK$（一個共享 formatter，全站 grep `¥` 歸零）
2. P2 三頁統一真加購車 client（localStorage + 登入後 API 雙寫），alert 改 toast
3. P3 缺貨全路徑禁買
4. P6/P7 最小結帳+訂單確認頁+會員三頁（account/orders/addresses），header 落真連結
5. P8/P9/P10 手機可達性：focus ring、漢堡/分類入口、375px 購物車佈局

> 配套：呢份同 `SECURITY-REMEDIATION-2026-09-18.md` 一齊睇。安全決定「收唔收到錢/會唔會俾人呃」，UI 決定「客買唔買到/信唔信你」。
