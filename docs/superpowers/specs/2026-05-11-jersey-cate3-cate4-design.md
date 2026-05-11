# 球衣 3-4 層分類（cate3/cate4）Design

## 目標

在現有分類結構：
- `cate1`：訂製大分類
- `cate2`：產品子分類（球衣/POLO/風衣外套/其他…）

之上，針對 `cate2 = 球衣` 追加兩層分類：
- `cate3`：足球 / 籃球 / 排球 / 其他
- `cate4`：上衣 / 褲子 / 整套

並且：
- `cate3/cate4` 需作為 **獨立 DB 欄位**（不可合併到 cate2 字串）
- 客戶落單頁選到球衣時，`cate3`、`cate4` **兩個都必填**
- 訂單（orders）亦需記錄 `cate3/cate4` 方便後台篩選/統計
- 非球衣（`cate2 != 球衣`）時，`cate3/cate4` 必須為空

---

## 允許值（固定選項）

僅當 `cate2 = 球衣`：
- `cate3` ∈ `['足球','籃球','排球','其他']`
- `cate4` ∈ `['上衣','褲子','整套']`

---

## DB 變更

### styles

新增欄位：
- `cate3 text null`
- `cate4 text null`

### orders

新增欄位：
- `cate3 text null`
- `cate4 text null`

---

## 後端行為

### 1) 後台新增/管理款式（admin）

當建立 styles 時：
- 若 `cate2 !== '球衣'`：後端強制 `cate3/cate4` 必須空字串或 null，否則回 400
- 若 `cate2 === '球衣'`：後端強制 `cate3/cate4` 必填且符合允許值，否則回 400

### 2) 客戶落單（public createOrder）

提交 orders 時：
- 若 `cate2 !== '球衣'`：後端強制 `cate3/cate4` 必須空字串或 null
- 若 `cate2 === '球衣'`：後端強制 `cate3/cate4` 必填且符合允許值

存入 orders：`cate1/cate2/cate3/cate4`

### 3) 款式查詢（public styles）

現有 `GET /api/public/styles?cate1&cate2` 擴展：
- 若 `cate2 !== '球衣'`：維持現狀（不需要 cate3/cate4）
- 若 `cate2 === '球衣'`：要求 query 必須帶 `cate3`、`cate4`，否則回 400（避免前端錯用）

DB filter：`cate1 + cate2 + cate3 + cate4`

---

## 前端/後台 UI 變更

### 客戶落單頁（/）

- 保留原本 `cate1`、`cate2`
- 當 `cate2 === '球衣'` 時顯示新增下拉：
  - 球衣子類（cate3）
  - 再子類（cate4）
- 只有 `cate3/cate4` 選好先會載入款式列表
- 提交訂單 payload 會包含 `cate3/cate4`

### 後台款式庫（/admin）

新增款式流程：
- `cate2` 選到球衣時顯示 `cate3/cate4` 下拉（必填）
- 其他 `cate2` 隱藏 `cate3/cate4`

款式列表顯示：
- 若球衣：顯示 `球衣 / cate3 / cate4`
- 否則維持 `cate2`

---

## 驗收準則

1. 客戶端：選 `球衣` 時必須揀 `cate3/cate4`，否則不能載入款式/不能提交
2. 後台：新增球衣款式必須填 `cate3/cate4`；非球衣不可填
3. API：`/api/public/styles` 在球衣分類下若缺 cate3/cate4 會回 400
4. 訂單資料：orders 會記錄 cate3/cate4（球衣時）

