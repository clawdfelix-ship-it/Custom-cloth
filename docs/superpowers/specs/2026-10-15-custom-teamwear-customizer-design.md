# 團體服／球衣訂製子系統（Phase 1）設計

## 設計前提

- 呢份 spec 係根據重新拆解 `fifakitcreator` 後再整理。
- 參考重點唔係照抄 UI，而係學佢個產品骨架：
  - `asset registry`
  - `design session`
  - `preview pipeline`
  - `deliverable / export`
  - `membership / 商業規則`
- 你個產品唔係做遊戲 mod 工具，所以要借佢架構思路，但交付物應改成 `效果圖 + 生產資料 + roster + 訂單 / 報價資料`。

## 目標

- 建立一個可獨立上線嘅 `團體服訂製子系統`，支援 `足球、籃球、排球、背心、Polo`。
- 提供接近 `fifakitcreator` 的即時設計感，但第一版採用 `半自由編輯器`，唔做完全自由拖放。
- 支援 `模板開始` 同 `空白款開始`。
- 支援 `即時效果圖 + 提交 roster + 直接下單 / 提交報價`。
- 將整個系統設計成 `session-first`，即每一次設計都有一份清晰、可保存、可重用嘅 `design session`。
- 第一版先獨立上線，之後再整合返現有商城。

## 非目標

- 不做真 3D 模型旋轉或 PBR 級材質系統。
- 不做設計軟件級 `多圖層自由拖放 / 群組 / 任意變形`。
- 不做社群展示、remix、competition、會員訂閱系統。
- 不做 AI 圖案生成。
- 不在第一版完成支付、正式購物車、共用會員整合。

## 產品論點

- 呢個系統唔應該被理解成「一頁商品客製選項」。
- 佢應該被理解成一個 `垂直訂製設計平台`，核心價值唔止係改色，而係：
  - 管理 `模板與素材`
  - 保存 `設計 session`
  - 即時產生 `效果圖`
  - 輸出可落單嘅 `交付資料`
  - 接住分流到 `直接下單` 或 `人工報價`

## 核心能力地圖

### 1) Asset Registry

- 系統必須有一層獨立嘅 `素材與模板註冊中心`。
- 呢層唔係單純圖片資料夾，而係要管理：
  - 品類
  - 模板
  - zone 規則
  - 可用 pattern
  - 官方 logo / badge
  - 字型
  - 色盤
  - logo slots / text slots

### 2) Design Session

- 每次用戶進入編輯器，都應建立一個 `design session`。
- `design session` 係成個系統嘅主資料，而唔係最後效果圖。
- 呢份 session 至少要描述：
  - 選咗邊個品類
  - 選咗邊個模板
  - 每個 zone 嘅顏色 / 圖案
  - logo 放咗乜嘢
  - 隊名 / 球員名 / 號碼設定
  - roster
  - 當前價格判斷狀態

### 3) Preview Pipeline

- 系統必須有一條清晰嘅 `預覽管線`，由 session 轉成可視效果。
- 第一版用 `2D + 2.5D`，唔做 3D。
- 預覽唔係最終主資料，只係 session 嘅視覺投影。

### 4) Deliverable Layer

- 系統唔應該只輸出一張圖。
- 應該同時產生：
  - 前幅效果圖
  - 後幅效果圖
  - 設計 JSON
  - roster
  - 印製位置 / 設計摘要
  - 價格判斷結果
- 呢層相當於 `fifakitcreator` 嘅 export layer，但會改成適合你嘅生意流程。

### 5) Commerce Decision Layer

- `價格計算` 同 `提交分流` 應獨立成一層。
- 呢層負責判斷：
  - 呢張單可唔可以直接下單
  - 定係要轉做報價
  - 價格係點拆

## 現況與約束

- 現有 repo 為 `Node.js + Express + EJS` 傳統 storefront。
- 現有前台適合 server-rendered 頁面，但唔適合直接塞入高互動設計器。
- 所以第一版採用：
  - `獨立訂製子系統`
  - `獨立資料表`
  - `之後先接返商城`
- 已確認商業需求：
  - 品類：`足球、籃球、排球、背心、Polo`
  - 素材來源：`官方模板庫 + 客戶上傳`
  - 商業模式：`直接下單 + 報價`
  - 定價：`混合制`
  - 團體流程：`要全隊名單`

## 核心方案

### 半自由編輯器

- 第一版用 `半自由編輯器`，唔用完全自由畫布。
- 每個模板會預先定義：
  - 可編輯 zones
  - 可用色位
  - 可用圖案位
  - logo slots
  - text slots
  - safe area
- 使用者可自由選擇內容，但只可以喺 `規則允許` 範圍內操作。

### 點解唔直接做全自由

- 因為你而家嘅商業目標唔係做開放式設計工具，而係做 `可落單、可生產` 嘅訂製網站。
- 半自由模型有幾個優勢：
  - 效果圖穩定
  - 模板資產容易維護
  - 報價與價格規則容易落地
  - 生產資料比較可控
  - 之後要升級做高自由度都仲有路

## 使用者流程

1. 使用者進入訂製器首頁。
2. 選擇品類。
3. 選擇 `模板開始` 或 `空白款開始`。
4. 系統建立 `design session`。
5. 使用者在編輯器內改：
   - 顏色
   - 圖案
   - 隊名
   - 球員名
   - 號碼
   - logo
6. 系統即時產生前後幅效果圖。
7. 使用者輸入數量、尺碼與全隊名單。
8. 系統計價並判斷：
   - `可直接下單`
   - `需提交報價`
9. 系統保存：
   - session
   - 效果圖快照
   - roster
   - submit 結果

## 編輯器結構

### 編輯器面板

- `款式面板`
  - 品類
  - 模板
  - 空白款
  - 款式變體
- `顏色 / 圖案面板`
  - 主色
  - 副色
  - zone 配色
  - pattern
- `文字面板`
  - 隊名
  - 球員名
  - 號碼
  - 字色
  - 字型
- `Logo 面板`
  - 官方素材
  - 客戶上傳素材
- `名單面板`
  - 姓名
  - 號碼
  - 尺碼

### 編輯器輸出

- 編輯器唔直接等於訂單。
- 編輯器輸出應該係：
  - `design session`
  - `preview snapshots`
  - `roster data`
  - `pricing preview`

## 模板與素材模型

### Template

- 每個模板至少包含：
  - `front base`
  - `back base`
  - `front shadow / highlight`
  - `back shadow / highlight`
  - `zone masks`
  - `logo slots`
  - `text slots`
  - `preview thumbnails`

### Zones

- 每個 template 會包含多個 zone，例如：
  - 前幅
  - 後幅
  - 左袖
  - 右袖
  - 側邊
  - 領口
  - 袖口
- 每個 zone 要定義：
  - 可否改色
  - 可否套 pattern
  - 可否放 logo
  - 可否放名字 / 號碼
  - 邊界
  - safe area
  - 預設值

### Assets

- 官方素材與客戶上傳素材要分開。
- `官方素材` 用於模板化操作與快速出圖。
- `客戶上傳素材` 屬 session 關聯資料，要保留：
  - 原檔
  - 預覽圖
  - mime type
  - 解像度
  - 檔案尺寸

## Preview Pipeline

### 第一版預覽策略

- 第一版以前端合成為主。
- render 次序固定為：
  1. `base image`
  2. `zone color fills`
  3. `pattern overlays`
  4. `logo images`
  5. `text rendering`
  6. `shadow / highlight overlay`

### 預覽原則

- `session` 先係主資料，preview 係 session 的投影。
- preview 失敗唔應該令 session 消失。
- 某個素材載入失敗時，應容錯顯示其餘部分。

## Deliverable 模型

### 提交時應保存嘅資料

- `design session JSON`
- `front preview snapshot`
- `back preview snapshot`
- `roster`
- `selected template`
- `selected product type`
- `uploaded asset references`
- `pricing breakdown`
- `fulfillment path`

### 點解要有 Deliverable Layer

- 因為你個網站唔係淨係俾人玩設計。
- 你需要交俾內部或客人睇到：
  - 呢單設計係咩樣
  - 用咗咩素材
  - 有幾多件
  - 每個人咩尺碼
  - 係咪可直接落單

## 資料模型

### 核心實體

- `product_types`
- `templates`
- `template_zones`
- `design_assets`
- `design_sessions`
- `design_previews`
- `rosters`
- `roster_items`
- `uploaded_assets`
- `pricing_rules`
- `order_drafts`
- `quote_requests`

### 關鍵原則

- `template` 同 `design session` 分開。
- `design session` 同 `preview snapshots` 分開。
- `design session` 同 `roster` 分開。
- `direct order` 同 `quote request` 共用同一份設計資料。
- 唔應該將所有資料塞入一個 blob 而失去結構。

## 商業流程

### 混合制定價

- 定價分為：
  - `基本價`
  - `數量階梯`
  - `附加費`
  - `人工覆蓋價`
- 附加費至少包括：
  - 印名
  - 印號
  - 額外 logo
  - 特殊尺碼
  - 急單

### Direct Order 條件

- 使用標準模板。
- 所有設計操作都喺模板規則內。
- 價格可完整計出。
- 數量未超出自動處理門檻。

### Quote Required 條件

- 特殊要求超出 template 規則。
- 客戶素材需要人手審核。
- 數量太大。
- 某 template / product type 被標記為報價優先。
- 使用者主動揀 `先報價`。
- 任一價格規則缺漏。

## 後台範圍

### 模板管理

- 新增 / 編輯 / 停用模板。
- 上傳模板資產。
- 管理 zones、logo slots、text slots、安全範圍。

### 素材管理

- 管理官方 pattern、badge、logo、字型、色盤。
- 控制素材是否可用於特定品類或模板。

### 價格規則管理

- 管理基本價、階梯價、附加費、direct / quote 條件。

### 報價單查看

- 查看：
  - preview
  - session 摘要
  - roster
  - 上傳素材
  - 備註
- 操作：
  - 改價
  - 設交期
  - 回覆客戶
  - 轉正式訂單

## 技術建議

### 第一版實作策略

- 以現有 repo 為基礎，先做 `獨立訂製子系統`。
- 不建議一開始另起完整前端平台。
- 第一版較穩陣做法係：
  - `EJS shell`
  - `public/js/customizer/*`
  - `Canvas compositing`
  - `Express JSON API`

### 原因

- 可以最快接入現有 Node/Express 架構。
- 可以集中先做好：
  - session
  - asset registry
  - preview pipeline
  - commerce decision
- 之後若要升級，可將前端再搬去 React / Vue。

### 後端責任

- 讀取 catalog
- 保存 session
- 保存 roster
- 管理素材上傳
- 計價
- 判斷 direct / quote
- 建立 order draft / quote request

## 錯誤處理

### 前端

- 上傳失敗時保留現有 session。
- 預覽失敗時提示錯誤，但保留已編輯設定。
- 價格計唔到時唔應阻止提交，而應自動轉報價。

### 後端

- `價格規則缺失` 視為 `quote required`，唔視為 fatal error。
- `模板資產缺漏` 禁止模板上架，但唔影響其他模板。
- `快照生成失敗` 仍要保存 design session。

## 驗收標準

### 功能驗收

- 使用者可建立至少以下兩類完整設計：
  - 足球
  - 籃球
- 使用者可由模板開始或空白款開始。
- 使用者可完成：
  - zone 配色
  - pattern 套用
  - 隊名 / 球員名 / 號碼
  - logo 上傳
  - roster 輸入
- 系統可輸出：
  - preview
  - design session
  - pricing breakdown
  - order draft 或 quote request

### 視覺驗收

- 前後幅切換順暢。
- 顏色、圖案、文字、logo 不出界。
- 2.5D overlay 明顯優於純平面色塊預覽。

### 管理驗收

- 後台可上架至少一組模板族。
- 後台可設定至少一組價格規則。
- 後台可查看至少一張 quote request。

## 風險與注意事項

- 最大成本係 `模板資產 + zone 規則建模`，唔係單純寫 code。
- 如果 session schema 一開始做得唔好，之後會難升級。
- 如果把 preview 當主資料，之後會難做重編輯與重算價。
- 如果 pricing 規則過早寫死得太複雜，標準單流程會變得難維護。
- 客戶上傳素材品質參差，必須有審核與容錯。

## 分期建議

### Phase 1

- 足球、籃球優先
- 模板開始 / 空白款開始
- session-first 編輯器
- 2D + 2.5D preview
- roster
- direct order / quote request
- 最小後台

### Phase 2

- 補齊排球、背心、Polo
- 更多模板與更細 zone 控制
- 接現有商城

### Phase 3

- 更自由編輯能力
- 3D 預覽
- 會員 / 社群 / 作品展示等平台層能力
