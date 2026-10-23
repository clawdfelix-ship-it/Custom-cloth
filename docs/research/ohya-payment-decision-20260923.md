# Ohya2.0 支付方向決定（2026-09-23）

Felix 明確指示：**暫時只做銀行轉帳，其他支付 webhook 唔好郁。**

## 現狀（保留）
- 唯一收款方式：銀行轉帳／FPS 入數 → 買家上傳入數證明 → 後台人工審批
  - approve：`routes/orders.js` proof/approve，已經 `orderService.transitionPayment('paid')`
  - reject：proof/reject，經 `transitionPayment('unpaid')`
- 後台手動更新狀態亦已接狀態機（`2754345`）

## 唔好掂（直到 Felix 再講）
- `routes/logistics.js` 三個自動閘道 webhook：`/webhooks/fps-payme`、`/alipayhk`、`/wechatpay`
  - 係從未啟用嘅 stub（payment_transactions 0 筆、orders.order_number 全空、payment_method_code 全 NULL）
  - 帶有 pre-existing bug：寫錯表名 `order_status_histories`（應為 order_status_history）、欄位 status/notes（應為 to_status/note）、用咗唔存在嘅 orders.payment_transaction_id、靠永遠空嘅 order_number 搵單
  - 第日真係要接自動閘道 → 由零重寫，直接用 `orderService.transitionPayment('paid')`
- refunds 退款流程：暫時唔接狀態機

## 原因
自動閘道未用、無金鑰、stub 本身係壞嘅；而家郁手零效益兼添風險。銀行轉帳已夠營運。
