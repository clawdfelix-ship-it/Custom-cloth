# 後台「倉庫管理」（Warehouses）V1 設計稿

## 目標
- 後台新增 `/admin/warehouses` 管理倉庫資料（新增/停用/設為預設）
- 令庫存調整（未指定 `warehouse_id`）會優先使用「預設倉庫」
- 倉庫列表（inventory filter）只顯示啟用倉庫；倉庫管理頁可查看停用倉庫

## 非目標（V1 不做）
- 不做倉庫層級庫存拆帳（只用 `product_skus.stock`）
- 不做調撥/入庫單/出庫單

## UI / 操作流
- 左側選單新增「倉庫」→ `/admin/warehouses`
- 頂部新增倉庫表單：倉庫名（必填）+ 地址/聯絡人/電話（可選）+「設為預設」
- 列表：倉庫｜地址｜聯絡人｜電話｜狀態（啟用/停用）｜預設｜操作（設為預設/停用/啟用）
- 規則：
  - 不能將「停用」倉庫設為預設
  - 已是預設嘅倉庫，「設為預設」按鈕 disabled

## DB
- `inventory_warehouses` 新增：`is_default boolean not null default false`
- 保證只可有 1 個 default：partial unique index（`WHERE is_default=true`）
- Migration：若不存在 default，會自動將最細 id 嘅啟用倉庫設為 default

## API
- `GET /api/admin/warehouses`
  - 預設只回傳啟用倉庫
  - 支援 `include_inactive=1` 以回傳全部（倉庫管理頁使用）
  - 排序：預設倉庫優先，再啟用，再按名稱
- `POST /api/admin/warehouses`
  - 支援 `is_default`（可選）
- `PUT /api/admin/warehouses/:id`
  - 更新資料 + `is_active`
- `POST /api/admin/warehouses/:id/make-default`
  - 設為預設（交易內先清其他 default，再設指定倉庫）

## 庫存調整行為
- `POST /api/admin/inventory/adjust` 若未提供 `warehouse_id`：
  - `ORDER BY is_default desc, id asc` 取第一個啟用倉庫

## 測試與驗收
- node:test：
  - warehouses page/nav link 存在 + JS wiring
  - API wiring：PUT warehouses + make-default 存在
  - migration 檔案存在且包含 `is_default` + unique index
- 手動：
  - 於 `/admin/warehouses` 新增倉庫、停用、設 default
  - 再到 `/admin/inventory` 做一次「調整庫存」（不選倉庫）會落到預設倉庫

