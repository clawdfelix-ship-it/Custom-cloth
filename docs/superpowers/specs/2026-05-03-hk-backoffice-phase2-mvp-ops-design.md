# 香港獨立站電商後台（第二階段：MVP 可營運）設計規格

## 背景與目標

第一階段已完成後台核心營運頁（訂單/商品/分類/用戶）由 JSON viewer 升級成可操作 UI，並已清理 `/api/admin/*` 路由重複衝突，確保行為一致。

第二階段目標是在現有 Node + Express + EJS + session 架構上，落地五個「日常營運必用」子系統，補齊交易閉環：
- 售後（退貨/退款申請與審批流）
- 退款（手動退款為主，留存憑證與審批痕跡）
- 對賬（每日差異清單：應收 vs 實收）
- WhatsApp 通知（wa.me 一鍵預填）
- 本地物流（ShipAny 為主：面單 + 追蹤 webhook 安全化 + 香港運費可用性）

## 範圍（Scope）

### In Scope

- 新增售後/退款/對賬後台頁（EJS + 少量原生 JS），重用既有 `/api/*`。
- 建立「狀態機分層」：履約狀態（orders.status）與支付狀態（orders.payment_status）分離，避免衝突。
- 補齊缺失資料表/欄位（以 migration 方式，向後相容）。
- ShipAny webhook 簽名驗證（最低安全要求）。
- 香港運送方式可用性：按 district/zone 過濾 + 計費（修正現有半實作）。

### Out of Scope（第二階段不做）

- 原路退款（支付供應商退款 API），只做手動退款並留存憑證。
- WhatsApp 自動發送（Meta Cloud API / Twilio）與訊息記錄系統。
- 深度 BI 與會計系統 API 對接（只做對賬差異清單與 CSV）。

## 決策（已確認）

- 退款模式：手動退款（後台審批/完成，財務在支付/銀行後台操作，回填憑證）。
- WhatsApp：wa.me 預填連結（後台一鍵打開 WhatsApp，人工發送）。
- 本地物流：ShipAny 為主（生成面單 + tracking webhook）。

## 核心原則與狀態機（避免現況衝突）

### 1) 訂單狀態只管履約（Fulfillment）

`orders.status` 允許值固定為：
- `pending`（待付款）
- `paid`（已付款/待處理）
- `shipping`（派送中）
- `completed`（已完成）
- `cancelled`（已取消）

**規則：** 不再把 `orders.status` 設為 `refunded`。退款由支付狀態表示。

### 2) 支付狀態獨立（Payment）

新增/補齊 `orders.payment_status`，允許值：
- `pending`
- `paid`
- `failed`
- `refunding`
- `refunded`
- `partial_refunded`

**規則：**
- 退款完成後只更新 `orders.payment_status`（refunded/partial_refunded）。
- `orders.status` 仍按履約流程走。

### 3) 售後（退貨/退款）獨立狀態

`return_requests.status`：
- `pending`（待審批）
- `approved`（已批准）
- `in_transit`（退回中）
- `received`（已收貨）
- `inspected`（已驗貨）
- `refunded`（已退款）
- `rejected`（已拒絕）

`refunds.status`：
- `pending`（待審批）
- `approved`（已批准）
- `processing`（處理中）
- `completed`（已完成）
- `rejected`（已拒絕）

### 4) 全部關鍵動作可追溯

所有以下動作必須寫入「訂單狀態/操作歷史」：
- 出貨（含 ShipAny 生成面單/追蹤號）
- 退貨審批、收貨、驗貨、拒絕
- 退款審批、退款完成（含退款憑證）

## 資料表/欄位（以 migration 補齊，向後相容）

> 註：專案同時存在 `schema.sql` 與 `schema-full.sql`，routes 目前已使用部分 full 欄位（例如 `shipany_label_url`、`tracking_status` 等）但 DB 未必存在。第二階段以 migrations 將現行 DB 補齊到「可營運」。

### 1) 新增：return_requests（必須）

`return_requests`（售後申請/RMA）
- `id` SERIAL PK
- `user_id` INT FK users
- `order_id` INT FK orders
- `reason` TEXT NOT NULL
- `items` JSON NULL（退邊幾件/數量）
- `return_method` VARCHAR(50) NOT NULL
- `images` JSON NULL
- `status` VARCHAR(20) NOT NULL（見狀態機）
- `admin_note` TEXT NULL
- `refund_amount` DECIMAL(10,2) NULL
- `tracking_number` VARCHAR(100) NULL（退貨物流）
- `created_at` / `updated_at`

### 2) 訂單歷史：統一命名（避免 order_status_history vs order_status_histories）

最終採用 `order_status_histories` 作為唯一表名（如已存在另一命名，migration 會建立缺失表並將程式統一寫入同一表）。

`order_status_histories`
- `id` SERIAL PK
- `order_id` INT FK orders
- `status` VARCHAR(50) NOT NULL
- `notes` TEXT NULL
- `created_by` INT FK users NULL
- `created_at` TIMESTAMPTZ DEFAULT now()

### 3) orders 表補欄位（如缺）

支付：
- `payment_method_code` VARCHAR(50) NULL
- `payment_status` VARCHAR(20) DEFAULT 'pending'
- `payment_transaction_id` VARCHAR(100) NULL
- `paid_at` TIMESTAMPTZ NULL

ShipAny/追蹤：
- `shipany_label_url` VARCHAR(500) NULL
- `tracking_status` VARCHAR(50) NULL
- `tracking_updated_at` TIMESTAMPTZ NULL

本地物流選項（MVP 可空）：
- `district` VARCHAR(50) NULL
- `pickup_point_id` INT FK pickup_points NULL
- `shipping_method_id` INT FK shipping_methods NULL
- `order_number` VARCHAR(50) NULL（如現行以 id 顯示，仍可維持；第二階段可新增生成）

回填策略（migration 一次性）：
- `orders.status IN ('paid','shipping','completed')` → `payment_status='paid'`
- 其他 → `payment_status='pending'`

### 4) payment_transactions（對賬來源）

沿用現有 `payment_transactions`，增加唯一鍵：
- unique(`payment_method_code`, `transaction_id`)

增加索引：
- idx(`created_at`)
- idx(`order_id`)

### 5) refunds（手動退款）

沿用現有 `refunds`，補齊（如缺）：
- `approved_by` INT FK users NULL
- `approved_at` TIMESTAMPTZ NULL
- `rejected_by` INT FK users NULL
- `rejected_at` TIMESTAMPTZ NULL
- `note` TEXT NULL

退款完成後同步：
- `orders.payment_status` 設為 `refunded/partial_refunded`
- 寫入 `order_status_histories`

## API 設計（MVP 可營運）

### 售後 / 退貨

會員端：
- `GET /api/user/returns`
- `POST /api/user/returns`
  - body：`{ order_id, reason, items?, return_method, images? }`
  - 規則：只可針對自己訂單；需登入

管理端：
- `GET /api/admin/returns?status=&q=&date_from=&date_to=`
- `GET /api/admin/returns/:id`
- `PUT /api/admin/returns/:id/status`
  - body：`{ status, admin_note?, refund_amount?, tracking_number? }`

### 退款（手動）

管理端：
- `GET /api/admin/refunds?status=&q=&date_from=&date_to=`
- `POST /api/admin/refunds`
  - body：`{ order_id, reason, type: 'full'|'partial', amount }`
- `POST /api/admin/refunds/:id/approve`
- `POST /api/admin/refunds/:id/reject`
  - body：`{ note }`（必填）
- `POST /api/admin/refunds/:id/complete`
  - body：`{ refund_transaction_id, payment_transaction_id?, note? }`

### 對賬（每日差異）

Webhook（既有 endpoints 擴展寫入 payment_transactions）：
- `POST /webhooks/fps-payme`
- `POST /webhooks/alipayhk`
- `POST /webhooks/wechatpay`

管理端：
- `GET /api/admin/reconciliation/daily?date=YYYY-MM-DD&payment_method_code=`
  - 回傳：`matched`、`missing_transaction`、`missing_order`、`amount_mismatch`

### WhatsApp（wa.me 一鍵預填）

MVP：後台頁以規則生成 `https://wa.me/<e164>?text=<encoded>` 連結。
限制：只對 `users.whatsapp` 有值且 `users.marketing_consent=true` 顯示。

### 本地物流（ShipAny 為主）

- `POST /api/admin/shipany/generate-label`（沿用）
- `POST /webhooks/shipany`：補齊簽名驗證（無效直接 403）
- `POST /api/shipping/methods/available`：按 district/zone 過濾＋計費（修正半實作）

## 後台 UI（EJS pages）

新增頁面：
- `/admin/returns`：售後列表 + 詳情 + 改狀態 + 填退貨單號/退款金額
- `/admin/refunds`：退款列表 + 建立/審批/完成（輸入退款憑證）
- `/admin/reconciliation`：選日期 + 差異清單（可導出 CSV）

擴展既有訂單詳情（`/admin/orders`）：
- 顯示 `payment_status`
- WhatsApp 三個按鈕：付款提醒/出貨通知/售後通知（wa.me）
- ShipAny 區：顯示 label URL / tracking status（如有）

## 安全與合規（MVP）

- ShipAny webhook：必做簽名驗證（使用 env secret）。
- 退款：必須 admin 權限；審批/完成記錄 processed_by/at 與 order_status_histories。
- WhatsApp：只對有 consent + 有 whatsapp 的會員顯示快捷發送。

## 驗收標準（Acceptance Criteria）

- 售後：會員可提交退貨申請；後台可查/篩選/改狀態；狀態流轉與備註可追溯。
- 退款：後台可建立退款單→審批→完成；完成後訂單 `payment_status` 正確更新；退款憑證可查。
- 對賬：webhook 會寫入 payment_transactions；對賬頁能生成當日差異清單（最少包含 missing/mismatch）。
- WhatsApp：訂單詳情可一鍵打開 wa.me 預填訊息（含訂單號/金額/物流）。
- 物流：ShipAny webhook 無效簽名會拒絕；`methods/available` 會按 district/zone 回正確可用方式。

