# Admin 採購單（PO）收貨體驗優化（V2-1）設計

## 目標
- 令 `/admin/purchase-orders`「收貨入庫」操作由「手打 sku_id 多行」升級為「按 PO items 逐行收貨」，減少錯入 SKU、提升效率。
- 保持後端入庫閉環不變：仍寫 `inventory_transactions(type='purchase_receive')`，同步更新 `inventory_levels` + `product_skus.stock`。
- 保留舊版手打收貨 textarea 作 fallback（預設收起）。

## 非目標
- 建 PO 時的 SKU 搜尋/挑選器（留待下一輪）
- 批量列印/匯出 PO
- 自動把 PO status 變更為 received（V2-1 只提供提示/快捷按鈕，不做自動狀態機）

## 現況（V1）
`/admin/purchase-orders` 詳情區目前提供：
- items 表格（顯示採購數量/已收/未收）
- 收貨入庫 textarea：每行 `sku_id,quantity,備註(可選)`，提交到：
  - `POST /api/admin/purchase-orders/:id/receive`
- 可選倉庫（預設倉庫）

## 新 UI（V2-1）
### 詳情區新增「按 item 收貨」表格
在 PO 詳情中加入一個收貨表格（同 items 表格放一齊或合併）：
- 顯示欄位：
  - 商品名 / SKU ID（可點去庫存中心）/ 採購數量 / 已收 / 未收
  - 本次收貨（input number，min=0，max=未收）
  - 備註（可選，input text，按行）
- 行為：
  - 預設本次收貨=0
  - 點「填滿未收」快捷：把每行本次收貨設為未收（>0）
  - 點「提交收貨入庫」：
    - 只提交本次收貨 > 0 嘅行
    - payload 由前端生成 `lines[]`：
      - `{ sku_id, quantity, note }`
    - optional `warehouse_id`（有選就傳）

### Fallback：保留手打 textarea（預設收起）
- 加一個「手動輸入（進階）」toggle，展開後仍可用原本 textarea。
- 目的：萬一 PO items 內 SKU 有異常，仍可用舊方法救場（但後端仍會驗證 SKU 必須屬於該 PO）。

### 快捷：跳去庫存中心
- 每行 SKU 提供 link：`/admin/inventory?sku_id=...`（方便查入庫後庫存分佈/流水）

### 狀態提示（不自動）
- 當所有 items 未收=0：
  - 顯示提示「已全數收貨，可將狀態設為 received」
  - 提供按鈕「設為 received」（呼叫 `PUT /api/admin/purchase-orders/:id/status`）

## 後端（不改接口，只需確保容錯）
### POST /api/admin/purchase-orders/:id/receive
- 保持現有：
  - `lines[]`：`{ sku_id, quantity, note }`
  - `warehouse_id`（可選；缺省用預設倉庫）
- V2-1 前端會更頻繁地提交多行，後端仍需：
  - transaction
  - 驗證每行 sku 屬於該 PO item
  - 不得超收（received_quantity + qty <= quantity）

## 前端（實作點）
- `public/js/admin/purchase-orders.js`
  - `renderPoDetail()` 改為產生收貨表格 + inputs + submit handler
  - submit handler 統一 call `/api/admin/purchase-orders/:id/receive`
  - 成功後：
    - reload PO detail
    - reload PO list（更新 status/金額/到貨等顯示）

## 測試（node:test）
- 以現有 pattern（讀檔字串）增加 1 個回歸測試：
  - `purchase-orders.js` 包含 `/api/admin/purchase-orders/` + `/receive` 字串（確保仍有收貨 wiring）
  - `purchase-orders.ejs` 包含「提交收貨入庫」或「按 item 收貨」marker

## 驗收標準
- 在 PO 詳情可：
  - 逐 item 輸入本次收貨（<= 未收）並提交
  - 入庫後 items 的 received_quantity/remaining 正確更新
  - 可選倉庫；不選則用預設倉庫
  - 可跳去庫存中心查該 SKU
- `npm test` 全綠

