# 動態尺寸落單（足球服 KID/ADULT）Design

## 目標

1. 客戶落單頁面（`/`）的「數量輸入」改為跟「尺碼表」動態生成，而唔再固定 S/M/L/XL/2XL/3XL 六格。
2. 針對足球服新增兩張尺碼表：
   - `足球服 KID (cm)`（size：100/110/120/130/140/150/160；欄位：LENGTH/CHEST/WAIST）
   - `足球服 ADULT (cm)`（size：S/M/L/XL/2XL/3XL/4XL；欄位：LENGTH/CHEST/WAIST/SEAT）
3. 後端 `order_items.qty` 由固定 6-size object 格式演進為動態尺寸格式，同時兼容舊單。

---

## 現況

### 1) Qty 資料結構（現有）

- `order_items.qty`：jsonb
- 後端建立訂單時使用 `requiredQtyJson()`，只接受固定 key：
  - `S, M, L, XL, 2XL, 3XL`
- 客戶端落單頁面亦只提供固定 6 格數量輸入。

### 2) 尺碼表結構（現有）

- `size_tables.data` 目前存 array，每行預期鍵：
  - `eu, chest, waist, length, china, height`
- 客戶端顯示尺碼表時固定顯示 6 欄（EU/胸圍/腰圍/衣長/中國碼/身高）。

---

## 方案 A（確認採用）

### 核心原則

1. 「落單尺寸」以尺碼表為準：只要揀到某個 size table，就用該 size table 的尺寸列表生成 qty 輸入。
2. `order_items.qty` 支援新舊兩種格式：
   - **新格式（推薦、未來統一）**：`sizeRatio array`
   - **舊格式（兼容）**：固定 6-size object（現存訂單資料）

---

## 資料格式設計

### 1) 新 qty 格式：sizeRatio array

```json
[
  { "size": "100", "qty": 12 },
  { "size": "110", "qty": 8 }
]
```

約束：
- `size`：string（保留原樣，例如 `2XL`, `4XL`, `100`）
- `qty`：number（>= 0），提交時總和必須 > 0

### 2) 舊 qty 格式：fixed object（兼容）

```json
{ "S": 1, "M": 0, "L": 2, "XL": 0, "2XL": 0, "3XL": 0 }
```

### 3) 後端驗證策略

新增一個 `normalizeQty()`：
- 若 `qty` 係 array：用 `requiredSizeRatio()` 驗證（需把允許 qty=0 的規則擴展/另寫）
- 若 `qty` 係 object：沿用 `requiredQtyJson()`，並轉成 array 格式供後續一致處理

返回統一格式：

```json
[
  { "size": "S", "qty": 1 },
  { "size": "L", "qty": 2 }
]
```

---

## 尺碼表設計（足球服）

### 1) `足球服 KID (cm)`（從圖表抽取）

尺寸列：`100, 110, 120, 130, 140, 150, 160`

每行 row：

```json
{ "eu": "100", "length": "38", "chest": "66", "waist": "65" }
```

完整數據：
- 100：length 38 / chest 66 / waist 65
- 110：length 42 / chest 70 / waist 69
- 120：length 46 / chest 74 / waist 73
- 130：length 50 / chest 78 / waist 77
- 140：length 54 / chest 83 / waist 81
- 150：length 58 / chest 89 / waist 87
- 160：length 62 / chest 95 / waist 93

### 2) `足球服 ADULT (cm)`（從圖表抽取）

尺寸列：`S, M, L, XL, 2XL, 3XL, 4XL`

每行 row：

```json
{ "eu": "S", "length": "66", "chest": "98", "waist": "94", "seat": "96" }
```

完整數據：
- S：length 66 / chest 98 / waist 94 / seat 96
- M：length 68 / chest 102 / waist 98 / seat 100
- L：length 70 / chest 106 / waist 102 / seat 104
- XL：length 72 / chest 110 / waist 106 / seat 108
- 2XL：length 74 / chest 114 / waist 110 / seat 112
- 3XL：length 76 / chest 118 / waist 114 / seat 116
- 4XL：length 78 / chest 122 / waist 118 / seat 120

---

## 前端（客戶端 /）改動

### 1) 尺寸輸入由固定 6 格 → 動態

- 由 `loadSizeTable()` 取得 `sizeTable.data`
- 尺寸列表來源：`rows.map(r => String(r.eu))`（去重、保留順序）
- 動態 render 一個數量輸入區：
  - 每個 size 一格 number input
  - 預設值 0，min 0

### 2) 提交 payload

`items[].qty` 改成：

```json
[{ "size": "100", "qty": 1 }, ...]
```

---

## 後端（createOrder / history / 工廠端）

### 1) 建單（public createOrder）

- 允許 `items[].qty` 新/舊格式
- DB `order_items.qty` 一律寫入 array（新格式）

### 2) 歷史訂單 / 工廠查單回傳

回傳時：
- 直接回傳 DB 內 array（新格式）
- 若讀到舊單 object（歷史遺留），也要 normalize 成 array 再回傳，確保前端一致

---

## 顯示（尺碼表 preview 支援 seat）

### 1) 客戶端 size table preview

- 表頭動態：
  - 基本：EU / LENGTH / CHEST / WAIST
  - 若任一行存在 `seat`：加 SEAT 欄
  - 若存在 `china/height`（舊款表）：繼續顯示（保持兼容）

### 2) 後台 size table preview（若需要）

- 同一套 render 方式（可沿用客戶端邏輯）

---

## 兼容性 / 風險

- 舊單 qty 係 object：需要 normalize，避免翻單/工廠端/後台顯示出現 undefined
- 動態尺寸會影響所有款式：需要確認所有現有尺碼表 `data` 至少有 `eu` 欄位（目前已有）

---

## 驗收準則

1. 客戶端選足球服尺碼表時，數量輸入會出：
   - KID：100–160
   - ADULT：S–4XL
2. 提交訂單成功，後端保存 qty 為 array。
3. 翻單、查歷史訂單、工廠端查單，qty 顯示/回填一致。
4. 尺碼表預覽可顯示 ADULT 的 SEAT 欄。

