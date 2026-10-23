# Medusa v2 借鑑清單 → Ohya2.0

> 查證方式：官方文件 v2.21.1（Inventory / Promotion concepts）＋已知 v2 architecture，重點抽 schema / 架構模式。
> 每項：**Medusa 點做 → Ohya 可借咩**。

## 1. Order：fulfillment_status + payment_status 分軌 + versioned orders
- **Medusa**：Order 有獨立 `payment_status`（awaiting/captured/partially_refunded/refunded/canceled）同 `fulfillment_status`（not_fulfilled/partially_fulfilled/fulfilled/partially_shipped/shipped/delivered），兩條 enum 分開。v2 **Order editing** 會生成新版本（versioned order），改單後產生差額（additional payment 或 credit）。
- **Ohya 借咩**：即使唔上完整 FSM，至少把 status 拆成兩條**受約束 enum**（而不是自由字串），後台按兩軸篩。日後做「改單」時借 versioned order：保留原單＋生成修改單，唔好就地 UPDATE。

## 2. Modules + Workflows 架構（最值得借嘅工程模式）⭐
- **Medusa v2**：Commerce 邏輯拆做獨立 **Modules**（Product/Inventory/Promotion/Order…），每個有自己 service＋data model＋isolated，可單用。編排用 **Workflows**（`createWorkflow`）：一串 step，每步可補償（compensation），中途失敗自動回滾已完成步驟；並可掛 hook 俾外部注入。
- **Ohya 借咩**：你而家 routes 偏胖。重構方向：
  - 把「結帳」這類多步流程（建 order → 鎖庫存 → 收支付 → 發確認）寫成顯式 step 序列，**每步定義補償**（支付失敗 → 釋放庫存＋作廢 order），而唔係靠長 try/catch。
  - 領域邊界向 module 收斂（inventory service、promotion service），route 只做參數＋調度。唔需要引入 Medusa 框架，借「step + compensation」概念即可。

## 3. Inventory：stocked / reserved / incoming 三量 + ReservationItem ⭐
- **Medusa**：`InventoryLevel(location, inventory_item)` 三個量：
  - `stocked_quantity` 可用實際庫存
  - `reserved_quantity` 已被未落實訂單鎖定（落單即 reserve）
  - `incoming_quantity` 將到貨（唔影響可售）
  - 可售 = stocked − reserved。
  - `ReservationItem` 記一筆具體預留（line_item/位置/數量），支援自定義用途；`requires_shipping`（數碼商品可 false）；v2.20 加 fractional `unit_of_measure`。
- **Ohya 借咩**：同 Vendure 結論一致——`inventory_levels` 拆 on_hand/（reserved or allocated）/incoming；用預留記錄掛具體 order_item；SKU 加 requires_shipping／track flag。你已有 inventory_transactions，擴 type 即可，唔使新建體系。

## 4. Promotions v2：automatic/code 統一 + Application Method + Campaign budget
- **Medusa**：一個 Promotion 同時支援 **automatic**（無 code，規則符合即套用）同 **code**。核心：
  - **Application Method**：點套用（percentage/fixed、target_type=order/items/shipping、value、currency、allocation across/item）。
  - `rules`（promotion 適用條件，如 customer_group/總額）、`target_rules`＋`buy_rules`（作用對象細則，支援 Buy X Get Y）。
  - **Campaign**：多個 promotion 歸一 campaign，設總 budget／用量上限（跨 promotion 共同限額）。
- **Ohya 借咩**：coupons 升級做統一 promotion 時，借三層：
  - 觸發條件（rules）
  - 套用方法（application method：作用 level＋類型＋值）
  - 營運分組（campaign：閃購季／節慶，一個總預算封住多個優惠）。
  呢個比 Vendure「多 promotion＋priority」更明確分開「優惠定義」同「預算／活動」。

## 5. Product variants / collections / tags
- **Medusa**：Product → options → variant（SKU 掛 variant）；Collection 係手機制商品集合；Tag 自由標籤。
- **Ohya 借咩**：你已有 product_skus（≈variant）、product_tags。Collection 可補做營運策展集合（手動 M2M，唔一定要 Vendure 嘅自動 filter）。SKU 與 product 之間若有時裝式「顏色/尺寸」可考慮 option 結構，成人用品多數規格簡單，唔使硬套。

## 6. Payment / Refund
- **Medusa**：Payment Provider 抽象，payment collection 支援 authorize→capture；refund 記於 payment，支援 partial；status 用 payment_status enum 反推 order。
- **Ohya 借咩**：統一 provider 介面（authorize/capture/refund）；明確區分「授權」同「過數」（信用卡常見）；退款強制掛 payment 並計可退餘額。

## 7. Cart → Order
- **Medusa**：Cart 係獨立實體，checkout 完成時 Cart → Order（一筆轉換）；另支援 Draft Order（後台代客落單）。
- **Ohya 借咩**：保留 cart_items；結帳時以「cart 凍結快照 → 生成 order」做轉換；若有客服代客落單需求，draft order 模式可加。

---

## 最值得優先（Medusa 角度）
1. **Workflow + compensation**（§2）：把結帳多步流程寫成可補償步驟 → 消除「支付失敗但庫存已扣／order 已建」嘅不一致。
2. **庫存三量＋ReservationItem**（§3）→ 可售精準、支援到貨預期。
3. **Promotion 統一＋Campaign 預算**（§4）→ 自動優惠同券合一、節慶活動可控總預算。
