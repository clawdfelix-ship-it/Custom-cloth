# 尺碼表「貼表格」輸入（Admin）Design

**目標**

喺 `/admin` →「尺碼表」新增一個更簡單嘅輸入方式：用戶可以直接由 Excel / Google Sheets copy 表格內容貼入，系統自動轉成現有 API 需要嘅 JSON array，並提供預覽確認後先提交。

---

## 現況

- 後台「尺碼表」只接受一個 textarea：`尺碼表 JSON（array，每行：eu/chest/waist/length/china/height）`
- 用戶要手動寫 JSON，理解成本高，容易括號/引號錯。
- 後端 API `/api/admin/size-tables` 已經支援 `data` 係任意 JSON（目前以 array of rows 為主）。

---

## 新增功能（UI）

### 1) 輸入模式切換

喺「尺碼表」tab 加一個 mode switch：

- 貼表格（推薦，預設）
- JSON（進階，保留而家嘅 textarea）

### 2) 貼表格模式內容

- 尺碼表名稱：沿用現有 `sizeName`
- 貼表格 textarea（新）
- `第一行係表頭` checkbox（新，預設開）
- `預覽` 按鈕（新）：解析貼入內容，顯示預覽表格 + 解析狀態
- `新增尺碼表` 按鈕：只會用「成功解析」嘅結果提交
- `貼入範例` 按鈕：自動填一段示例 TSV，方便照住改

### 3) 預覽

預覽區要顯示：

- 解析狀態：成功 / 失敗原因（例如缺欄、行數 0）
- 預覽 table：欄位固定顯示 `EU / 胸圍 / 腰圍 / 衣長 / 中國碼 / 身高`
- 可選顯示「識別到嘅表頭對應」（debug info，純文字）

---

## 支援格式（輸入來源）

### 1) Excel / Google Sheets copy（主要）

- 通常係 TSV（tab 分隔）
- 行尾可能有空格
- 可能有空行

### 2) CSV（次要）

- 逗號分隔
- 可能有引號包住欄位

本功能會先偵測：

- 如果有 `\t`：當 TSV
- 否則如果有 `,`：當 CSV
- 否則：當單欄文本，直接報錯

---

## 欄位對應（容錯）

最終輸出 row schema 仍然係：

```json
{ "eu": "", "chest": "", "waist": "", "length": "", "china": "", "height": "" }
```

### 表頭容錯（第一行係表頭時）

允許以下同義詞（trim + uppercase 後匹配）：

- eu：`EU`, `EU SIZE`, `SIZE`, `國際尺碼`, `國際尺碼(EU)`, `尺碼`
- chest：`CHEST`, `胸圍`, `胸圍(CM)`, `胸圍CM`
- waist：`WAIST`, `腰圍`, `腰圍(CM)`, `腰圍CM`
- length：`LENGTH`, `衣長`, `衣長(CM)`, `衣長CM`
- china：`CHINA`, `CHINA SIZE`, `中國尺碼`, `中國尺碼(HEIGHT/CHEST)`
- height：`HEIGHT`, `SUGGESTED HEIGHT`, `適用身高範圍`

### 無表頭（第一行非表頭）

假設 6 欄固定順序：

`EU / CHEST / WAIST / LENGTH / CHINA / HEIGHT`

---

## API / 資料存放

- 唔改後端 API
- 前端貼表格 → 解析成 `data: row[]` → `POST /api/admin/size-tables`

---

## 驗收準則（成功定義）

- 後台可以用「貼表格」新增尺碼表，唔需要寫 JSON
- 貼入 Excel copy 出嚟嘅表格可成功解析（含表頭/無表頭）
- 解析失敗時提供清晰錯誤訊息
- 成功新增後，客戶端 `/api/public/size-tables/:id` 取到同樣 data，客戶頁面預覽正常顯示

