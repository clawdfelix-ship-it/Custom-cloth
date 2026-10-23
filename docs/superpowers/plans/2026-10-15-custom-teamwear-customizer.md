# 團體服／球衣訂製子系統（Phase 1）Implementation Plan

> **For agentic workers:** Follow this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在現有 `Node.js + Express + EJS + Postgres` repo 內落地一個可獨立上線嘅 `團體服／球衣訂製子系統`，支援 `足球、籃球、排球、背心、Polo`，並以 `asset registry -> design session -> preview pipeline -> deliverable layer -> commerce decision` 作為第一版主骨架。

**Architecture:** 以 `Express` 提供 page shell 同 JSON API，前台採用 `EJS shell + public/js/customizer/* + Canvas compositor`。`Asset registry` 管品類、模板、zones、官方素材；`Design session` 管每次客製狀態；`Preview pipeline` 將 session 轉成前後幅效果圖；`Deliverable layer` 將 session、snapshots、roster、pricing 組成可落單資料；`Commerce decision layer` 負責 direct order / quote required 分流。第一版唔引入第二套大型 frontend build system，但會預留之後遷移至 React/Vue 嘅 API 邊界。

**Tech Stack:** Node.js（CommonJS）+ Express + EJS + Postgres + multer + 原生 Canvas 合成策略（瀏覽器端）+ node:test

---

## File Map（預計新增／修改）

**Create（DB / core data）**
- `db/migrations/20261015_customizer_phase1.sql`
- `models/customizer/catalog.js`
- `models/customizer/sessions.js`
- `models/customizer/previews.js`
- `models/customizer/pricing.js`
- `models/customizer/quotes.js`
- `models/customizer/deliverables.js`
- `models/customizer/uploads.js`
- `utils/customizer/validation.js`
- `utils/customizer/snapshot.js`

**Create（routes / pages / API）**
- `routes/customizerPages.js`
- `routes/customizerApi.js`
- `routes/adminCustomizerPages.js`

**Create（views）**
- `views/customizer/index.ejs`
- `views/customizer/editor.ejs`
- `views/customizer/quote-success.ejs`
- `views/admin/customizer-templates.ejs`
- `views/admin/customizer-pricing.ejs`
- `views/admin/customizer-quotes.ejs`

**Create（public JS / CSS）**
- `public/css/customizer.css`
- `public/js/customizer/app.js`
- `public/js/customizer/state.js`
- `public/js/customizer/api.js`
- `public/js/customizer/catalog.js`
- `public/js/customizer/editor.js`
- `public/js/customizer/compositor.js`
- `public/js/customizer/deliverables.js`
- `public/js/customizer/panels-colors.js`
- `public/js/customizer/panels-text.js`
- `public/js/customizer/panels-logo.js`
- `public/js/customizer/panels-roster.js`
- `public/js/customizer/pricing.js`
- `public/js/customizer/uploads.js`
- `public/js/admin/customizer-templates.js`
- `public/js/admin/customizer-pricing.js`
- `public/js/admin/customizer-quotes.js`

**Create（tests）**
- `test/customizer-models.test.js`
- `test/customizer-pages.test.js`
- `test/customizer-pricing.test.js`
- `test/customizer-api.test.js`
- `test/customizer-deliverables.test.js`

**Modify（app wiring / shared infra）**
- `app.js`（mount page/API/admin routes，static/upload path，若需要加 body/upload limits）
- `views/partials/head.ejs`（customizer page 專用 CSS/JS hook，如需要）
- `views/admin/layout.ejs`（加入 customizer admin nav）

---

## Delivery Strategy

### 實作原則

- 先做好 `schema / contracts / data boundaries`，再做 UI 細節。
- `Design session` 永遠係主資料；preview 只係 session 嘅投影。
- `價格規則缺失` 唔當錯誤，而係 `quote required`。
- `preview 生成失敗` 唔應阻止提交；只要 session 仲在，就可以之後重產。
- 先支援 `足球、籃球` 做完整驗證，再補 `排球、背心、Polo`。

### 完成定義

- 使用者可從 `/customizer` 進入訂製器。
- 可選品類、模板開始、空白款開始。
- 可建立一份完整 `design session`。
- 可完成基本區域配色、圖案、文字、logo 上傳與前後幅 preview。
- 可輸入全隊名單。
- 系統可產生 `deliverable package`。
- 系統可判斷 `direct order` 或 `quote required`。
- 後台可查看模板、價格規則與報價請求。

---

### Task 1: 建立核心 schema，同步鎖定資料邊界

**目標:** 先將 `asset registry / design session / deliverable / commerce` 幾層資料結構鎖死，避免之後用 blob 亂塞。

**Files:**
- Create: `db/migrations/20261015_customizer_phase1.sql`
- Create: `models/customizer/catalog.js`
- Create: `models/customizer/sessions.js`
- Create: `models/customizer/previews.js`
- Create: `models/customizer/pricing.js`
- Create: `models/customizer/quotes.js`
- Create: `models/customizer/deliverables.js`
- Create: `utils/customizer/validation.js`
- Create: `test/customizer-models.test.js`
- Create: `test/customizer-pricing.test.js`
- Create: `test/customizer-deliverables.test.js`

- [ ] **Step 1: 先寫 failing tests，鎖定核心 contract**

最低限度覆蓋：
- `buildDesignSession()` 會輸出穩定 session shape
- `normalizeTemplateZone()` 會補齊 zone 預設欄位
- `validateRosterItems()` 會檢查姓名 / 號碼 / 尺碼
- `calculatePriceBreakdown()` 可輸出基本價、階梯價、附加費
- `decideFulfillmentPath()` 可回傳 `direct_order` 或 `quote_required`
- `buildDeliverablePackage()` 可組出 session + previews + roster + pricing

- [ ] **Step 2: 建 migration**

建立以下資料表：
- `customizer_product_types`
- `customizer_templates`
- `customizer_template_zones`
- `customizer_design_assets`
- `customizer_sessions`
- `customizer_session_designs`
- `customizer_session_previews`
- `customizer_rosters`
- `customizer_roster_items`
- `customizer_pricing_rules`
- `customizer_quote_requests`
- `customizer_quote_request_assets`
- `customizer_order_drafts`

最低欄位原則：
- registry 資料與 session 資料分表
- session / quote / order draft 要有 `status`
- 設計 JSON、preview 路徑、roster 分開保存
- `created_at / updated_at` 一律存在

- [ ] **Step 3: 實作最小 model helpers**

需要有：
- catalog：讀品類、模板、zone、素材
- sessions：create / get / saveDesign / saveRoster / attachAssets
- previews：savePreviewRefs / getLatestPreviews
- pricing：讀規則、計價、判斷 direct vs quote
- deliverables：組裝可提交 package
- quotes：建立報價請求、附帶 deliverable metadata

- [ ] **Step 4: 跑 tests 轉 GREEN**

Run:
```bash
npm test
```

---

### Task 2: 建立 asset registry 與 catalog API

**目標:** 先令前台可以可靠讀到「可設計乜嘢」，再做「點設計」。

**Files:**
- Create: `routes/customizerApi.js`
- Create: `public/js/customizer/api.js`
- Create: `test/customizer-api.test.js`
- Modify: `app.js`

- [ ] **Step 1: 寫 catalog API tests**

至少覆蓋：
- `GET /api/customizer/catalog`
- `GET /api/customizer/product-types/:id/templates`
- `GET /api/customizer/templates/:id`
- `GET /api/customizer/assets`

- [ ] **Step 2: 實作 catalog endpoints**

回傳最少包括：
- product types
- templates
- template zones
- official assets
- palettes
- blank template markers

- [ ] **Step 3: 前端 API wrapper**

`public/js/customizer/api.js` 提供：
- `fetchCatalog()`
- `fetchTemplates(productTypeId)`
- `fetchTemplate(id)`
- `fetchAssets(filters)`

- [ ] **Step 4: 在 `app.js` mount API**

建議路徑：
```js
app.use('/api/customizer', require('./routes/customizerApi'));
```

- [ ] **Step 5: 跑 tests**

Run:
```bash
npm test
```

---

### Task 3: 建立 page shell 與 design session 生命週期

**目標:** 先把訂製器入口與 session lifecycle 定清楚。

**Files:**
- Create: `routes/customizerPages.js`
- Create: `views/customizer/index.ejs`
- Create: `views/customizer/editor.ejs`
- Create: `views/customizer/quote-success.ejs`
- Create: `test/customizer-pages.test.js`
- Modify: `app.js`

- [ ] **Step 1: 寫 page routing tests**

至少覆蓋：
- `GET /customizer`
- `GET /customizer/editor`
- `GET /customizer/editor` 包含 `id="customizer-app"`
- `GET /customizer/quote-success`

- [ ] **Step 2: 建 page router**

頁面規格：
- `/customizer`
  - 顯示品類入口、模板開始、空白款開始 CTA
- `/customizer/editor`
  - 只 render shell、bootstrap payload、root 容器
- `/customizer/quote-success`
  - 顯示提交成功訊息

- [ ] **Step 3: 建 design session endpoints**

需求：
- 建立匿名 session
- 保存設計 JSON
- 保存 roster
- 可讀回 bootstrap payload
- session 狀態至少有 `draft / submitted`

- [ ] **Step 4: 將 editor shell 接上 session bootstrap**

要求：
- 用 query 或 payload 指定 product type / template start
- 進頁即建立或恢復 session
- 不污染現有 storefront

- [ ] **Step 5: 跑 tests**

Run:
```bash
npm test
```

---

### Task 4: 建前端 state，令編輯器以 session 為中心

**Files:**
- Create: `public/js/customizer/app.js`
- Create: `public/js/customizer/state.js`
- Create: `public/js/customizer/catalog.js`
- Create: `public/js/customizer/editor.js`
- Create: `public/css/customizer.css`
- Modify: `views/customizer/editor.ejs`

- [ ] **Step 1: 建 state container**

最少 state slice：
- `catalog`
- `selectedProductType`
- `selectedTemplate`
- `design`
- `zones`
- `roster`
- `uploadedAssets`
- `previews`
- `pricing`
- `deliverable`
- `submission`

- [ ] **Step 2: 建 session-first 初始化流程**

流程：
1. 讀 query / bootstrap
2. 拉 catalog
3. 建 session
4. 套用 template defaults
5. render 左中右三欄
6. 建立 autosave

- [ ] **Step 3: 建基本 UI 區塊**

包括：
- 品類切換
- 模板列表
- 前後幅切換
- 摘要卡
- 提交按鈕區

- [ ] **Step 4: 確保狀態改變不會刷新頁面**

要求：
- 所有編輯行為在 client-side 完成
- autosave 可先做 debounce，失敗時只提示，不重置本地狀態

---

### Task 5: 實作 preview pipeline，同步分離 session 同 preview

**Files:**
- Create: `public/js/customizer/compositor.js`
- Create: `models/customizer/previews.js`
- Modify: `public/js/customizer/editor.js`
- Modify: `routes/customizerApi.js`
- Modify: `public/css/customizer.css`

- [ ] **Step 1: 定義 template asset contract**

每個模板至少支援：
- `frontBase`
- `backBase`
- `frontShadow`
- `backShadow`
- `zoneMasks`
- `logoSlots`
- `textSlots`

- [ ] **Step 2: 實作前端 compositing pipeline**

順序固定：
1. base image
2. zone fills
3. pattern overlays
4. logo images
5. text rendering
6. shadow / highlight overlay

- [ ] **Step 3: 保存 preview reference，而唔將 preview 混入 session blob**

要求：
- session 保存 design data
- previews 表保存 snapshot 路徑或 blob reference
- submit 前可取最新 preview refs

- [ ] **Step 4: 支援前後幅切換**

要求：
- 切換不重建整個 editor
- 保持相同設計 state

- [ ] **Step 5: 建錯誤降級**

若某個 layer 資產載入失敗：
- 顯示 warning
- 保持其餘 layer 正常 render
- 仍可儲存設計 JSON

---

### Task 6: 實作 asset-driven 面板能力

**Files:**
- Create: `public/js/customizer/panels-colors.js`
- Create: `public/js/customizer/panels-text.js`
- Create: `public/js/customizer/panels-logo.js`
- Create: `public/js/customizer/panels-roster.js`
- Create: `public/js/customizer/uploads.js`
- Create: `models/customizer/uploads.js`
- Modify: `routes/customizerApi.js`

- [ ] **Step 1: 顏色 / 圖案面板依 registry 規則顯示**

需求：
- zone 可選顏色
- zone 可選 pattern
- 非允許 zone 不顯示控制項

- [ ] **Step 2: 文字面板**

需求：
- 隊名
- 球員名
- 號碼
- 字色
- 基本字型選擇

- [ ] **Step 3: logo 面板 + 上傳**

需求：
- 官方素材可選
- 客戶上傳 PNG / JPG / SVG（如系統可支援）
- 後端記錄解像度與 mime type
- 不合格素材要回傳具體錯誤

- [ ] **Step 4: roster 面板**

需求：
- 可新增 / 刪除球員列
- 每列有姓名、號碼、尺碼
- 可計算總數量與尺碼分佈

- [ ] **Step 5: autosave 接上 session API**

規則：
- 編輯 design 時 debounce save
- 編輯 roster 時 debounce save
- uploaded assets 只保存 reference，唔直接塞入 session blob

---

### Task 7: 建立 deliverable layer 與 commerce decision layer

**目標:** 將編輯器輸出轉成真正可落單資料，而唔係只停留喺 preview。

**Files:**
- Create: `public/js/customizer/deliverables.js`
- Create: `models/customizer/deliverables.js`
- Modify: `models/customizer/pricing.js`
- Modify: `routes/customizerApi.js`
- Modify: `public/js/customizer/pricing.js`
- Modify: `public/js/customizer/editor.js`
- Modify: `test/customizer-pricing.test.js`
- Modify: `test/customizer-deliverables.test.js`

- [ ] **Step 1: 固定 deliverable package shape**

最少包括：
- session id
- selected template
- selected product type
- front / back preview refs
- roster summary
- uploaded asset refs
- pricing breakdown
- fulfillment path

- [ ] **Step 2: 固定 pricing breakdown shape**

至少包括：
- 基本價
- 數量階梯調整
- 印名費
- 印號費
- logo 附加費
- 其他附加費
- 小計
- `fulfillmentPath`

- [ ] **Step 3: 建 direct / quote decision**

邏輯：
- 若所有規則齊備且符合 direct 條件，建立 `order draft`
- 其餘情況建立 `quote request`

- [ ] **Step 4: 覆蓋邊界情況**

至少測試：
- 大數量自動轉報價
- 缺價格規則自動轉報價
- 特殊模板自動轉報價
- 標準單可直接產生 order draft

- [ ] **Step 5: submit endpoint 回傳最終 deliverable 結果**

要求：
- 回傳 `direct_order` 或 `quote_required`
- 回傳建立後嘅 `orderDraftId` 或 `quoteRequestId`

---

### Task 8: 建立最小後台，管理 registry / pricing / quotes

**Files:**
- Create: `routes/adminCustomizerPages.js`
- Create: `views/admin/customizer-templates.ejs`
- Create: `views/admin/customizer-pricing.ejs`
- Create: `views/admin/customizer-quotes.ejs`
- Create: `public/js/admin/customizer-templates.js`
- Create: `public/js/admin/customizer-pricing.js`
- Create: `public/js/admin/customizer-quotes.js`
- Modify: `views/admin/layout.ejs`
- Modify: `app.js`

- [ ] **Step 1: 建 admin nav entry**

新增入口：
- 模板 / registry
- 價格規則
- 報價單

- [ ] **Step 2: Registry 頁**

第一版最少支援：
- list templates
- 啟用 / 停用
- 查看 zone 摘要
- 查看 asset coverage

- [ ] **Step 3: Pricing 頁**

第一版最少支援：
- list rules
- 新增 / 編輯基本價與階梯
- 設 direct / quote 條件

- [ ] **Step 4: Quotes 頁**

第一版最少支援：
- list quote requests
- 查看 previews
- 查看 roster
- 查看上傳素材
- 更新報價狀態與人工價格

---

### Task 9: 補齊最小模板種子資料與驗收

**Files:**
- Modify: `db/migrations/20261015_customizer_phase1.sql` 或新增 seed script
- Create if needed: `scripts/seed-customizer-phase1.js`
- Modify: `models/customizer/catalog.js`
- Modify: `test/customizer-*.test.js`

- [ ] **Step 1: 落最少可演示模板**

建議最少：
- 足球：2 款
- 籃球：2 款
- 排球：1 款
- 背心：1 款
- Polo：1 款

- [ ] **Step 2: 每款模板有完整 asset contract**

必須有：
- front/back base
- shadow
- 至少 3 個可編輯 zones
- 至少 1 個 logo slot
- 至少 1 個 text slot

- [ ] **Step 3: 每個品類最少一個 blank template**

- [ ] **Step 4: 跑全量測試**

Run:
```bash
npm test
```

- [ ] **Step 5: 手動驗收**

至少覆蓋：
- `/customizer`
- `/customizer/editor`
- 模板開始流程
- 空白款開始流程
- 足球 / 籃球完整提交一次
- 一張 direct order
- 一張 quote request
- admin 查看 quote

---

## Key Decisions Locked

- 第一版以 `asset registry -> design session -> preview -> deliverable -> commerce` 做主線。
- `Design session` 永遠係主資料；preview 唔可反客為主。
- `價格算唔到` 係 `quote required`，唔係 fatal error。
- 第一版唔引入第二套大型前端 toolchain。
- 模板、session、roster、preview、pricing、submit 結果必須分層。

## Out Of Scope For This Plan

- 真 3D 模型與自由旋轉
- 多圖層自由拖放編輯器
- AI 圖案生成
- 社群展示 / remix / competition
- 與現有商城共用購物車 / 支付 / 會員登入
- 工廠排產與生產工單
