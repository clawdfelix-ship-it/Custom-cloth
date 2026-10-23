# 電商平台參考研究：Vendure / Medusa / Saleor → Ohya2.0

> 日期：2026-09-23。目的：為 Ohya2.0 下一階段演進提供可落地借鑑。
> 詳細分報告：[`vendure-reference-ohya2.md`](./vendure-reference-ohya2.md)（深讀 v3.7.3 源碼）、
> [`medusa-reference-ohya2.md`](./medusa-reference-ohya2.md)、[`saleor-reference-ohya2.md`](./saleor-reference-ohya2.md)。
>
> ⚠️ 最高約束：**任何改動唔可以破壞 mzakka 資料同步**（見末段守則）。

## 一、三平台共識（三個獨立權威都咁做 = 最可信）

| 主題 | 共識做法 | Ohya 現狀 | 差距 |
|---|---|---|---|
| **訂單狀態** | payment 同 fulfillment **分軌**，order 總狀態由子軌**推导**，唔係一個自由字串 | 單一 `status` 字串 + `payment_status`，各自 UPDATE | 易打架、無分批 |
| **明細價格** | list／undiscounted → discount → 實價 多層；adjustments 記來源；訂單折扣**攤分落 line** | `unit_price/subtotal` 兩欄，無單項折扣/adjustments | 退款、退貨唔準 |
| **庫存** | on-hand ＋ allocated/reserved（＋incoming）；可售 = 在手 − 鎖定；**付款先鎖、出貨先扣**；movement append-only | `inventory_levels.stock` 單欄 | 付款後出貨前 over-sell 窗口 |
| **促銷** | code 券／自動規則／人手改價統一模型；條件＋動作分離 | 傳統 `coupons` + 獨立 flash_sales | 自動優惠要另起系統 |

## 二、各平台獨有、值得借

- **Vendure**：宣告式 FSM（transition map＋guard hooks，可阻擋非法轉態）；promotion conditions/actions；Collection filter 自動集合；refund 掛 payment 並強制可退餘額、可 split 多 payment。
- **Medusa v2**：**Workflow＋compensation**（每步可補償，長流程失敗自動回滾）——工程模式最值借；**Campaign** 把多 promotion 歸一總預算；ReservationItem。
- **Saleor**：OrderLine 完整 net/gross/undiscounted/tax 分解；**支付事件流**（auth/charge/refund events）；checkout 短期 reservation + order 正式 allocation 雙層；public/private metadata JSON。

## 三、建議行動優次

**第一波（核心正確性）**
1. **訂單狀態機分軌**：order.state 由 payment＋fulfillment 子狀態集中推导；新增出貨單（state＋lines）支援分批出貨；統一 `transitionOrder()` 入口、停用周圍直接 UPDATE status；每次轉態自動寫 `order_status_history`。
2. **OrderLine 價格＋adjustments**：加 `undiscounted_unit_price / unit_discount / adjustments jsonb / prorated_unit_price`；訂單級折扣用 largest-remainder 攤分落 line（退款按 prorated 價）。
3. **庫存雙量＋ledger**：`inventory_levels` 拆 `stock_on_hand / allocated`（＋incoming）；擴充 `inventory_transactions` type（allocation/sale/release/cancel）；付款鎖、出貨扣。

**第二波（營運能力）**
4. 統一 promotion：code／自動／手動合一（conditions/actions）；Campaign 總預算。
5. Collections（橫跨分類嘅策展／會員私有集合）。
6. 支付 provider 抽象＋事件流、授權/扣款分離。

**工程層（可隨時做）**
- 把結帳寫成 step＋compensation（借 Medusa），消除「支付失敗但庫存已扣／order 已建」。

---

## 四、⚠️ mzakka 同步安全守則（必須遵守）

### 同步實際點運作（查證結果）
- 爬取：`utils/mzakkaSync.js`、`mzakkaCrawl/NewItems`；寫庫：`scripts/import-mzakka-to-postgres.js`＋大量 `scripts/*mzakka*.js`。
- **商品 upsert 衝突鍵 = `slug`**（`ON CONFLICT (slug) DO UPDATE`）；SKU upsert 衝突鍵 = `sku`。
- 商品來源欄：`source / source_key / source_url / sync_status / raw_payload`；分類大量係 `source='mzakka_mirror'`。
- 分類重建會 `UPDATE products SET category_id ...`；分類 slug 衝突鍵亦係 `slug`。
- home modules / snapshots 係 `DELETE` 後全量 replace。

### 紅線（改任何 schema／邏輯前先檢查）
1. **唔好改／移除 `slug`、`sku`**：佢哋係同步 upsert 命脈。改名生成規則、加 unique 約束、改型都會令下一輪同步重複插入或 conflict 失敗。
2. **保留 `source / source_key / source_url / sync_status / raw_payload`**，同步靠佢哋識別來源；新欄位要 nullable／有默認，避免 NOT NULL 卡住同步 INSERT。
3. **狀態機改造要向後兼容**：現有同步寫入嘅狀態值要仍係合法 transition；最好先「讀取派生」而非改同步寫入路徑。
4. **庫存改造要同步隔離**：mzakka import 預設 `stock:0`。新 on_hand/allocated 模型要保證「導入/重跑同步」唔會被當成入庫或觸發 allocation；同步流唔好經 payment→allocation 管線。
5. **分類／category_id 改動**唔好打亂 `mzakka_mirror` 列；rebuild scripts 仍要搵到舊欄位。
6. 任何改動：**先跑 `test/mzakkaSync.test.js`**，並喸本地用單一記錄 dry-run 一次 upsert，確認「重跑同步係幂等」先合併。
7. 優先「加新表/新欄」而非改舊表；觸碰同步主路徑要 feature flag，可隨時退回。

> 原則：電商模型升級用「旁車（new tables/columns）＋向後兼容」方式推進，同步主路徑最後先遷，確保 mzakka 任何時候重跑都安全。
