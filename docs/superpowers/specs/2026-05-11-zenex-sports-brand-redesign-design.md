# ZENEX-SPORTS 全品牌化網站改版（A：運動零售藍）設計稿

## 背景

現有系統包含：

- 客戶下單頁：[/index.html](file:///Users/chansiulungfelix/Documents/TraeProjects/Cloth%20System/index.html)
- 後台管理：[/admin.html](file:///Users/chansiulungfelix/Documents/TraeProjects/Cloth%20System/admin.html)（含工廠端 tab）

目標為「全品牌化」：以 Decathlon 風格取向（清爽、運動零售感、藍色強 CTA）重整視覺與可用性，同時保留現有功能與既有 DOM id / JS 行為，避免破壞 API 與測試。

## 目標與非目標

### 目標

- 統一品牌：顏色、字體、間距、元件風格在 /、/admin、工廠端一致
- 可用性：表單更易填、錯誤提示更清晰、手機體驗更順、後台表格可掃讀
- 無障礙：文字對比、focus ring、鍵盤操作、可理解的狀態/錯誤訊息
- 低風險：不改核心資料流與 API；盡量保持現有 JS function/DOM id

### 非目標（本輪不做）

- 重新架構成 React/Next.js 或引入大型 UI 框架
- 大改流程（例如多步驟 wizard）或加入新業務功能
- 更換 DB schema / API contract（除非為 UI 必要）

## 視覺方向（A：運動零售藍）

### 視覺語言

- 乾淨白底、清晰分段、可掃讀的資訊階層
- 主 CTA 使用 ZENEX Blue（強烈、清晰），輔以成功/警示/危險色
- 元件圓角偏中等（12px 左右）、陰影輕、邊框明確

### 品牌文案

- 品牌名：ZENEX-SPORTS
- 頁面標題與 header 均顯示 ZENEX-SPORTS

## Design Tokens（建議以 CSS 變數落地）

### 顏色（建議值，可按你最終偏好微調）

- 主色
  - `--zenex-brand-500: #0066ff`（primary）
  - `--zenex-brand-600: #0052cc`（primary hover）
  - `--zenex-brand-50: #eaf2ff`（弱化背景/選中底）
- 中性色
  - `--zenex-bg: #f6f8fb`
  - `--zenex-surface: #ffffff`
  - `--zenex-text: #0f172a`
  - `--zenex-muted: #64748b`
  - `--zenex-border: #e2e8f0`
- 語意色
  - `--zenex-success: #16a34a`
  - `--zenex-warning: #f59e0b`
  - `--zenex-danger: #dc2626`
  - `--zenex-info: #0ea5e9`

### 字體

- 以系統字體為主（中英一致、載入快）：
  - `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, "Microsoft JhengHei", "PingFang HK", "Noto Sans CJK TC", sans-serif`

### 字級（階梯）

- `12 / 14 / 16 / 20 / 24`（配合行高：`1.4~1.6`）

### 圓角、陰影、間距

- 圓角：卡片 16、按鈕/輸入 12、tag 999
- 陰影：只用輕微（例如 `0 8px 30px rgba(15,23,42,.06)`）
- 間距：8 的倍數（8/12/16/24/32）

## 元件規格（跨頁共用）

### Header

- 左：ZENEX-SPORTS（可預留放 logo）
- 右：主要入口（客戶端 / 後台 / 登出等）
- 背景白、下邊框 `--zenex-border`，sticky（admin 可選）

### Tabs

- active：brand-500 底色 + 白字 或 白底 + brand-500 下底線（視頁面）
- hover：brand-50
- mobile：支援換行或水平滾動

### Buttons

- Primary：brand-500 背景、hover brand-600、focus ring brand-500/30
- Secondary：白底、border、hover brand-50
- Danger：danger 背景（少用，只用於刪除等）
- Disabled：降低 opacity + 不可點

### Inputs / Select / Textarea

- 背景白、border、focus ring（brand）
- 錯誤態：border danger + 錯誤訊息（danger 文案）
- hint：muted 小字

### Cards / Panels

- surface + border + 輕陰影
- 標題區與內容區分隔（細線或 spacing）

### Tables（admin）

- 表頭 sticky（可選）
- zebra stripes（淡灰）
- hover 高亮（brand-50）
- 狀態用 badge（顏色映射 status）

### Modal / Toast

- Modal：遮罩、卡片式內容、可鍵盤關閉（Esc）
- Toast / inline msg：一致顏色與 icon（如要 icon 以純 CSS/文字實現，不引入圖標庫）

## 頁面落地設計

### 1) 客戶下單頁（/）

保持現有三 tab 與現有 id/function，不改 API 互動。

重點調整：

- 以品牌 header 取代單一 card title（保留原標題文字但視覺升級）
- 表單分段（分類 → 款式 → 尺碼數量 → 客戶資料 → 提交）
- 球衣 cate3/cate4 區塊：在選中球衣時以「嵌套子段」方式顯示，提示更清楚
- 提交成功 / 查單結果：變成更清晰的結果卡（含 copy button 的一致樣式）
- 手機版：tab、按鈕、表單 spacing、表格預覽不溢出

驗收：

- 手機 360px 寬不橫向溢出
- focus 可見、錯誤訊息可理解

### 2) 後台管理（/admin）

保持 Tailwind CDN（現狀）與既有 id/JS，做品牌化：

- header 區：加入 ZENEX-SPORTS（與客戶端一致）
- Tabs：視覺一致（active/hover/focus）
- 訂單篩選：視覺更清晰（filter panel），按鈕階層（載入/匯出）
- 表格：增加 zebra + hover，高密度但易掃讀
- 工廠端 modal：資訊分組更清楚（訂單資料 / 款式 items / 狀態更新 / 反饋）

驗收：

- 表格在 1280px 寬可掃讀；窄屏仍可水平滾動而不崩版

### 3) 工廠端（admin 的 factory tab）

- 詳情 modal：把「狀態更新」與「反饋」分段，主動作（更新狀態/提交反饋）一致 CTA
- 附件連結：統一為「品牌 link」樣式

## 技術落地策略（不引入新框架）

### 方案（推薦）

- 新增一個共用 CSS 檔（例如 `/assets/zenex.css`）：
  - 放 tokens（CSS variables）
  - 放通用元件 class（button/input/card/badge/tab…）
- /index.html：用該 CSS 重整現有樣式（取代目前 page 內的大量 inline CSS）
- /admin.html：保留 Tailwind，但新增：
  - `:root` tokens（或引入同一份 CSS）
  - 少量自訂 class 補 Tailwind 做唔到的「品牌一致性」
  - 可選：用 `tailwind.config = { theme: { extend: ... } }` 映射 brand 色

### 測試策略

- 延續現有 HTML 结构測試：補充測試確保核心 id、關鍵文字、button/選擇器仍存在
- 不做視覺像素測試（目前 repo 無此框架）

## 無障礙與 Web Design Guidelines 清單（會在最後做 Audit）

- 顏色對比（尤其 button / muted text / badges）
- focus ring 可見、tab 鍵導航順序合理
- 表單 label 對應、錯誤訊息可感知
- 點擊區域大小（手機）
- 表格可讀性（行距、對齊、可掃讀）

## 上線方式

- 改版完成後，Vercel redeploy
- 不涉及 migration（純前端視覺）

