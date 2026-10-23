# Saleor 借鑑清單 → Ohya2.0

> 查證方式：官方 docs（discounts/order/warehouse 目錄）＋已知 Saleor PG 數據模型。重 PG schema 同交易模型。

## 1. Order / OrderLine：完整價格分解 + 授權 vs 扣款
- **Saleor**：OrderLine 同時存 `undiscounted_unit_price`、`unit_discount`、`unit_price`（折後）、`tax_rate`、稅前後多欄（net/gross）、`quantity`；Order 有 subtotal/shipping/discount/total 各自 undiscounted 版本。支付區分 **authorized（授權）→ charged/captured（過數）**。
- **Ohya 借咩**：order_items 補 `undiscounted_unit_price`＋`unit_discount`＋折後價（同 Vendure list/discount 分層一致）；明確區分授權／扣款，信用卡場景好重要。

## 2. Checkout → Order + Transaction Items
- **Saleor**：Checkout 獨立存在，完成後轉 Order；現代 **TransactionFlow**（payment app 回報 transaction events：authorization/charge/refund），每筆錢係 TransactionItem 而非單一 payment status。
- **Ohya 借咩**：checkout 凍結→order；支付網關回調以「事件流」記錄（授權/扣款/退款各一筆），比單一 status 更可追溯。你 payment_transactions 可擴充 event type。

## 3. Stock：allocation + reservation
- **Saleor**：Checkout 階段可 **reserve**（暫時預留，有時效）；落 Order 做 **allocation**（綁定倉）；出貨先真正扣。Warehouse 多倉。
- **Ohya 借咩**：雙層概念——checkout 短期預留（防結帳中被搶）＋order 正式 allocation；你 inventory_levels 拆 on_hand/allocated 可承載。

## 4. Voucher / Promotion / Manual discount
- **Saleor**：Voucher（code：百分比/固定/免運）；**Promotion rules**（catalog 折扣＋order 折扣，規則式自動）；Manual discount（後台人手改）。舊 Sales 已 legacy。
- **Ohya 借咩**：三種優惠分層清晰：code 券／規則自動／人手改價，可作統一 promotion 表設計參考。

## 5. Metadata（public/private JSON）
- **Saleor**：幾乎所有實體可附 public＋private metadata JSON。
- **Ohya 借咩**：你已有 raw_payload／payload_json；可用 metadata JSON 承載成人商品嘅可變/來源屬性，避免頻繁加欄。⚠️ 但同步相關嘅 key（source/source_key/slug）要保持專欄位，唔好只塞 JSON。

## 6. PG 最佳實踐
- 金錢一律 decimal（唔用 float）；migration 細粒度；關鍵查詢建 index。
- **Ohya**：你已用 decimal。可對照檢查 orders/items 嘅 index（status、created_at、user_id）。

## 最值得優先（Saleor 角度）
1. OrderLine 完整價格分解（undiscounted/discount/tax）→ 退款準。
2. 支付事件流 + 授權/扣款分離。
3. Checkout reservation + order allocation 雙層庫存。
