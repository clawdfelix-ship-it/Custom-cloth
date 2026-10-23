# Vendure 借鑑清單 → Ohya2.0

> 查證方式：clone `vendurehq/vendure` v3.7.3 原始碼（TypeORM entities / config processes / services 實際讀碼），非官方文件轉述。
> 每節：**Vendure 點做 → Ohya 可借咩（具體欄位/機制）**

---

## 1. Order state machine：三條獨立 FSM，唔係一個 status 走天涯 ⭐

**Vendure 點做**
- Order、Payment、Fulfillment 各自有獨立 finite state machine（`common/finite-state-machine/`），全部 transition 以宣告式 map 定義：`{ AddingItems: { to: ['ArrangingPayment','Cancelled'] } }`，並有 `onTransitionStart`（可 return false/string 阻止）、`onTransitionEnd`、`onError` hooks。Process 可以多個合併（`mergeTransitionDefinitions`），啟動時 validate transition graph。
- Order 狀態（`config/order/default-order-process.ts`）：
  `Created → AddingItems → ArrangingPayment → PaymentAuthorized → PaymentSettled → PartiallyShipped/Shipped → PartiallyDelivered/Delivered`，另有 `Draft / Modifying / ArrangingAdditionalPayment / Cancelled`（Cancelled 終態）。
- **雙軌點協調**：Order 狀態唔自己諗 payment，而係由 Payment FSM 嘅 `onTransitionEnd` **反推**（`default-payment-process.ts`）：每當 payment 轉態，重算 `totalCoveredByPayments(order)`，若全部 Settled 就把 order 推去 `PaymentSettled`；若 Authorized+Settled 覆蓋總額就推 `PaymentAuthorized`。
- Shipping 軌同理：order 能唔能夠去 `Shipped/Delivered` 由 check function 驗證 — `orderItemsAreShipped()` 檢查所有 line 嘅 Fulfillment 狀態（fulfillment 自己係 `Created→Pending→Shipped→Delivered→Cancelled`）。Partial 狀態專門處理分批出貨。
- Transition guard 全部係可關閉嘅 option（`arrangingPaymentRequiresStock`、`checkPaymentsCoverTotal`、`checkFulfillmentStates`…）。

**Ohya 借咩（落地）**
- 廢除「order.status + payment_status 兩條字串各自更新」，改成**單一 order.state 由 payment/fulfillment 子狀態機驅動**。最少可先做：
  - 新增 `order_fulfillments`（或出貨單表）：`state` enum `pending/shipped/delivered/cancelled` + `handler/method` + lines（order_item_id, qty）→ 支援**分批出貨**同 partial states，唔再靠一個 `shipping` status。
  - 資料庫存 transition 規則表/常量 map，喺 service 層做統一 `transitionOrder(state)`，唔准周圍直接 `UPDATE status`。
  - Payment callback / fulfill callback 入面先做子狀態轉換，再用一個 `recomputeOrderState(order)` 推导 order.state（「payment covered? → PaymentSettled」「all items shipped? → Shipped」），**狀態推导集中一處**，消除 status 打架。
- 保留你現有 `order_status_history(from,to,note,processed_by)`，但規定**每次** FSM 轉態自動寫（Vendure 用 history service 做同樣嘢），變成審計 log 而唔係手動 append。

## 2. OrderLine 價格：list / discounted / prorated 三層 + adjustments JSON ⭐

**Vendure 點做**（`entity/order-line/order-line.entity.ts`）
- Persisted：`initialListPrice`（落單時原價快照）、`listPrice`、`listPriceIncludesTax`、`adjustments: Adjustment[]`（simple-json）、`taxLines: TaxLine[]`（每稅項 description+rate）。
- `Adjustment = { adjustmentSource, type, description, amount, data }`；`AdjustmentType` 三種：`PROMOTION`（單品/line 折扣）、`DISTRIBUTED_ORDER_PROMOTION`（訂單級折扣按比例攤落到 line）、`OTHER`。`adjustmentSource` 識別來源（promotion id），同一來源會 group 返做一行 `Discount`。
- Calculated 價格階梯：
  - `unitPrice / unitPriceWithTax`（list，未折）
  - `discountedUnitPrice(WithTax)`（含 line-level 折扣）
  - `proratedUnitPrice(WithTax)`（再含按比例攤分嘅 order-level 折扣）— 註明「true economic value，用於稅同退款計算」
  - `unitTax / proratedUnitTax / taxRate`
- Order 級（`order.entity.ts`）：`subTotal` 已含攤分折扣；另有 `surcharges` 表（非商品非 promotion 嘅一次性加減價，例如付款附加費）；order-level discount 用 `service/helpers/order-calculator/prorate.ts`（largest-remainder 法保證分攤後加總 = 原折扣額，唔會有 rounding 差）。

**Ohya 借咩**
- `order_items` 加欄：
  - `initial_unit_price`（快照）/ `list_unit_price`
  - `discount_total`（單項折扣，正數）
  - `adjustments jsonb`：陣列 `{source_type:'promotion'|'coupon'|'manual', source_id, type, description, amount}`
  - `tax_rate`、`tax_total`（若有稅；香港可預留）
  - derived：`prorated_unit_price`（攤分訂單折扣後嘅真實單價）— **退款/退貨按呢個價計**，解決「訂單滿減后退一件退幾多」。
- 訂單級折扣（coupon/promotion）唔好只擺喺 orders 表一個 `discount` 數；要喺結算時用 largest-remainder prorate 落每個 item 並寫入 adjustments，咁唔單只退款準，分倉/分賣家結算都用到。
- 加 `order_surcharges` 概念（付款方式附加費、人手改價），唔好 hack 入 coupon。

## 3. Stock：on-hand / allocated 雙數 + movement ledger，出站先 Allocation

**Vendure 點做**
- `StockLevel(productVariantId, stockLocationId, stockOnHand, stockAllocated)` 唯一 index；sellable（可賣）= **stockOnHand − stockAllocated − threshold**（`product-variant.service.ts:340`），唔係一條 stock 整數。
- 雙欄含義：`stockOnHand` 實物在倉；`stockAllocated` 已被未出貨訂單鎖定。出貨時（Fulfillment `Created→Pending`）先記 `Sale` movement（正式出站扣 on-hand），取消 fulfillment 記 `Cancellation` + 重新 `Allocation`。
- **幾時 allocate 可策略化**：`StockAllocationStrategy.shouldAllocateStock(from,to,order)`；default 係 `ArrangingPayment → PaymentAuthorized/PaymentSettled` 先鎖（即付款先扣可賣，唔係 add-to-cart）。所有動作以不可變 movement ledger 落账：`Allocation / Sale / Release / Cancellation / StockAdjustment`（single-table inheritance `stock_movement`），stock level 由 movement 推/同步。
- Variant 層有 `trackInventory: DEFAULT/TRUE/FALSE`（可唔可以負數/唔追庫存）同 `outOfStockThreshold`。
- `StockDisplayStrategy`：店面唔直接出真實數字，出「in stock / low stock」字串（避免洩露庫存）。

**Ohya 借咩**
- `inventory_levels` 拆做 `stock_on_hand` + `stock_allocated`，可賣 = on_hand − allocated（你而家 `stock` 單欄，落單未出貨期間必然 over-sell 或要手動鎖）。
- 結帳/付款成功時寫 `Allocation`（你已有 `inventory_transactions`，擴充 transaction type：`allocation/sale/release/cancellation/adjustment` + order_item_id）；出貨先把 allocation 轉 sale 扣 on_hand，取消/退貨回補。保持 ledger append-only，stock 欄由 ledger 同步或校對。
- SKU 加 `track_inventory` flag（成人用品常見情趣內衣/禮盒可能唔追號碼）。店面 API 淨係出存貨狀態字串。

## 4. Promotion：conditions + actions 宣告式，coupon 只係一個 optional 入口 ⭐

**Vendure 點做**（`entity/promotion/promotion.entity.ts`、`config/promotion/`）
- Promotion = `conditions: ConfigurableOperation[]` **AND** `actions: ConfigurableOperation[]` + `startsAt/endsAt/enabled/priorityScore/couponCode/usageLimit/perCustomerUsageLimit`。
- Condition 係可配置插件：`minimum_order_amount`、`has_facet_values`、`contains_products`、`customer_group` 等（check 函數回 bool）。Action 係折扣：`order_percentage_discount`、`order_fixed_discount`、`product/order-line percentage/fixed`、`free_shipping`、`buy_x_get_y_free`。
- **自動 vs coupon 統一模型**：`couponCode` 只係 promotion 上一個 nullable 欄。冇 code + condition 符合 = 自動生效；有 code = 要 order 有 couponCode 先生效（`promotion.test()` 先檢查 `order.couponCodes` 再行 conditions）。Order 上有 `couponCodes: string[]`（可多券）。
- **階梯優惠**：核心冇單一「tier」構造，做法係開多個 promotion（每個 min_order_amount condition + 對應 action），用 `priorityScore` 排序/控制互斥。order calculator 逐個 promotion 行、以 proration 分攤。
- Per-customer limit 內建（防同一客狂用）。

**Ohya 借咩**
- 將 `coupons`（固定券）升級/並存做統一 **promotion**：
  - `promotions` 表：`coupon_code nullable`、`usage_limit`、`per_customer_usage_limit`、`starts_at/ends_at`、`priority_score`、`conditions jsonb`、`actions jsonb`、`enabled`。
  - 條件與動作分離：condition（滿額/指定 category/指定 SKU/會員群組）、action（單品 %、訂單 %、固定減、免運費、買 X 送 Y）。
  - 冇 code 嘅 row = 自動優惠（例如「滿 $800 自動 9 折」），有 code 先行 coupon 驗證再行 conditions — 營運唔使再分兩套系統。
- 階梯：用「多 promotion 各設門檻 + priority_score」實作，唔使喺 coupon 表加 tier 欄。
- 動作結果一律落到 item adjustments（見 §2），coupon 表嘅 `allowed_categories` 由 condition 配置取代，更有彈性。

## 5. Collection：filter 自動集合 + 手動 M2M，可多層可私有

**Vendure 點做**（`entity/collection/collection.entity.ts`）
- Collection 同時支援兩種成員機制：
  - **自動**：`filters: ConfigurableOperation[]`（facet-value / variant-name / variant-id / product-id filters）+ `inheritFilters`（子集合繼承父層 filter）。Variant 改動時經 JobQueue 異步重算成員。
  - **手動**：同 ProductVariant 係 `@ManyToMany` join table，可人手加減。
- 屬性：`slug`、`isPrivate`（店面唔公開，可做內部/特定渠道集合）、`parentId` 多層樹（唔止兩層）、position/sort、breadcrumbs、多 channel。

**Ohya 借咩**
- `categories` 維持分類樹，但另開 **collections**（營運集合）：例如「初次體驗」「SM 入門」「情人節套餐」「會員專區」呢啲**橫跨 category、需要規則或私有的集合**，唔好硬塞入兩層 category。
- 欄位：`filters jsonb`（自動規則）、`inherit_filters`、`is_private`（做僅會員可見/僅特定渠道）、M2M 手動成員表。自動集合用 queue 重算，避免分類/商品變更後集合過期。
- category 樹如可能深過兩層（玩具→電動→震動→...），parent_id 模型本身已夠，UI/查詢改用遞迴 CTE 而非寫死兩層。

## 6. Payment / Refund 抽象：Method handler + 獨立 Refund state

**Vendure 點做**
- `Payment(method, amount, state, transactionId, errorMessage, metadata jsonb)`；Payment state：`Created→Authorized/Settled/Declined/Error/Cancelled`（Authorized→Settled，區分「授權扣款」同「真正結算/過數」）。
- 網關邏輯抽離做 `PaymentMethodHandler`：`createPayment` / `settlePayment` / `cancelPayment` / `createRefund?` 四個函數 + args 配置。PaymentService 用 `withTransaction` 包住「叫網關 → 建/轉 payment 狀態」；網關原始回應落 `metadata`。
- **Refund**（`entity/refund/refund.entity.ts`）：獨立實體 + 自己嘅 state `Pending → Settled/Failed`，掛喺具體 Payment 下（`paymentId`，唔係直接掛 order），有 `transactionId/method/reason/metadata`，金額拆 `items/shipping/adjustment`（舊）/ `total`（新）。
- PaymentService.createRefund 做兩件關鍵事：① **refundable 上限檢查** = payment.amount − 該 payment 已有 refund 總額，超額回 `RefundAmountError`；② 一筆 order refund 可**自動 split 落多個 payment**（逐個可退款 payment 攤，loop）。Refund 經 handler 先喺網關層落單。

**Ohya 借咩**
- 統一網關抽象：定義每個支付方式 `createPayment/settle/cancel/refund` 介面（你而家 `payment_transactions` 偏記錄式），`gateway_raw_response` 保留為 jsonb metadata，但加標準欄 `state / error_message / transaction_id`。
- Refund 狀態簡化為 `pending → settled/failed` 子狀態機；你現有審批流（`approved_by/processed_by/status`）保留喺**審批層**，但「錢過咗未」用 refund.state 表達，兩者分開（審批通過 → 建 Pending refund → 網關成功 → Settled）。
- Refund **掛具體 payment** 並計 refundable 餘額；若 Ohya 支援訂單多次/混合付款，內建「refund 自動分攤到多個 payment」邏輯，避免人工拆數。
- 退款金額用 §2 嘅 `prorated_unit_price` 計，而唔係 list price。

---

## 優先改進（若只做 3 樣）

1. **拆三軌狀態機（§1）**：order.state 由 payment + fulfillment 子狀態集中推导，新增出貨單表支援分批；統一 transition 入口 + 自動寫 history。直接解決 status/payment_status 打架。
2. **OrderLine adjustments + prorated 價（§2）**：`order_items` 加 `discount_total / adjustments jsonb / tax 欄 / prorated_unit_price`，訂單級折扣用 largest-remainder 分攤落 item。退款、退貨、分倉結算全部受惠。
3. **庫存 on-hand/allocated 雙欄 + ledger（§3）**：付款先 allocate、出貨先 sale，可賣 = on_hand − allocated，movement append-only。消除付款後出貨前嘅 over-sell 窗口。

（Promotion 統一模型 §4 係第二波高價值項：coupon 變 promotion 嘅一個入口，自動優惠/階梯/免運費一套搞掂。）

## 重要差異提醒
- Vendure 係 Angular/NestJS + GraphQL 大框架（含 worker、plugin、channel/多語系/facet 體系），唔建議照搬架構；抽**狀態機、價格分攤、庫存帳、promotion 配置模型**呢啲 schema/service pattern 落你自己嘅 Node+PG 就夠。
- 「tier 階梯」Vendure 冇專屬欄位，靠多 promotion + priority，唔好誤以為佢有內置階梯表。
- Refund 預設狀態只有 Pending/Settled/Failed，**審批**係你 Ohya 已有而 Vendure 核心冇嘅嘢，值得保留。
