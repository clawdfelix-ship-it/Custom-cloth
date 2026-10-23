# Admin 報表中心（銷售 V1）設計

## 目標
- 新增 `/admin/reports` 後台頁面，作為「報表中心」入口（V1 先做銷售）。
- 用現有 reports API，提供：
  - Overview（今日/昨日/7日/總覽）
  - 銷售趨勢（按日/週/月）
  - Top Products 熱賣排行
  - 匯出訂單 CSV
- 不引入第三方圖表套件，使用原生 SVG 畫簡單趨勢圖（零依賴）。

## 非目標（V1 不做）
- 庫存報表/低庫存整合（已有 `/admin/low-stock`）
- 稅務報表 UI（已有 API，V2 再加）
- 多維度圖表、儀表板拖拉配置
- 報表快取/排程

## 權限與守門
- Page gate：`requireAdminPage('reports:read')`
- API：沿用現有 `requirePermission('reports:read')`
- Menu：只有 `reports:read` 先顯示「報表」入口

## 現有可用 API（保持不變）
- `GET /api/admin/dashboard/overview`（reports:read）
- `GET /api/admin/reports/sales-by-date`（reports:read）
  - query：`start_date`, `end_date`, `group_by=day|week|month`
- `GET /api/admin/reports/top-products`（reports:read）
  - query：`start_date`, `end_date`, `limit`
- `GET /api/admin/reports/export-orders/csv`（reports:read）
  - query：`start_date`, `end_date`, `status`

## 後台 UI（/admin/reports）V1
### 頁面結構
- 頁首：標題「報表（銷售）」+ 期間篩選
- 篩選列：
  - 開始日 / 結束日（date input）
  - group_by（select：日/週/月）
  - 快捷鍵：最近 7/30/90 日（button）
  - 操作：刷新（button）、匯出訂單 CSV（button）
- 區塊 1：Overview cards
  - 由 `dashboard/overview` 取得，顯示：
    - 今日訂單/銷售額
    - 昨日訂單/銷售額
    - 7日訂單/銷售額
    - 累計訂單/銷售額（如 API 有提供）
- 區塊 2：Sales by date 趨勢
  - 表格：period / order_count / total_sales
  - SVG 趨勢圖：用 total_sales 作 y 值（簡單折線或柱狀）
- 區塊 3：Top products
  - 表格：商品名 / 數量 / 銷售額

### 互動行為
- 預設期間：最近 30 日；group_by 預設 day
- 「刷新」：並行打 3 個 API（overview / sales-by-date / top-products），分開渲染，任何一個失敗只影響該區塊。
- 「匯出 CSV」：用當前篩選條件生成 URL，直接 `window.location.href = ...`

## 前端資料處理（容錯）
- 日期：
  - start/end 缺失時自動補齊（預設 30 日）
  - 保證 start <= end，否則交換或提示錯誤
- group_by：
  - 限定 day/week/month，其他值 fallback day
- 數值欄位：
  - total_sales 以 Number() 轉換，NaN → 0

## 錯誤處理
- 每個區塊有獨立 error message（或共用頁面 error 區）
- API 回 401/403：顯示「沒有權限」/「需要登入」
- 其他：顯示「服務器錯誤」或後端 error message

## 測試（node:test）
- `/admin/reports` page 存在且會載入 `reports.js`
- admin layout 有 reports nav link（字串 marker + permission key）
- `public/js/admin/reports.js` 會呼叫以下 endpoints（字串 match）：
  - `/api/admin/dashboard/overview`
  - `/api/admin/reports/sales-by-date`
  - `/api/admin/reports/top-products`
  - `/api/admin/reports/export-orders/csv`

## 驗收標準
- 具備 `reports:read` 嘅 backoffice admin：
  - 看到 sidebar「報表」入口
  - 可入 `/admin/reports`
  - 可刷新並看到 overview + 趨勢 + top products
  - 可匯出訂單 CSV
- `npm test` 全綠

