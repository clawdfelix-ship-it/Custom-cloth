# 後台尺碼表列表 Preview 縮圖（SVG）Design

## 目標

喺 `/admin` →「尺碼表」列表新增一欄 Preview，令每個尺碼表新增後都可以即時睇返數據內容（表格縮圖 + 可放大預覽），無需再逐次入 JSON 或重新貼表格。

---

## 範圍

- 只改後台 `admin.html`
- 不新增 DB 欄位
- 不上傳/保存圖片
- 由尺碼表 `data` 即時生成 SVG（data URI）作縮圖與放大圖

---

## UI / 互動

### 1) 列表欄位

尺碼表列表 table 增加一欄：

- 名稱
- ID
- Preview（新增）
- 操作

### 2) Preview 縮圖

- 每行用 `<img>` 顯示縮圖
- 圖像來源：`data:image/svg+xml;utf8,...` 或 encode 後 data URI
- 顯示「全部 size 行」

### 3) 放大預覽（Modal）

- 點縮圖會彈出 modal
- modal 內顯示同一份 SVG，但用較大 viewport/字體
- modal 顯示尺碼表名稱 + ID

---

## SVG 生成規格

### 1) 資料來源

用 `/api/admin/size-tables` 返回每張尺碼表的 `data`（array rows）。

尺寸列表：以每行的 `eu` 作為 size label。

### 2) 欄位（動態）

表頭按資料存在與否動態決定：

- 基本：EU / 衣長(length) / 胸圍(chest) / 腰圍(waist)
- 若任一行有 `seat`：加 臀圍(seat)
- 若任一行有 `china`：加 中國碼(china)
- 若任一行有 `height`：加 身高(height)

若某欄位不存在，留空字串。

### 3) 渲染尺寸

兩個 preset：

- thumbnail：較細字體 + 固定最大寬度（例如 220–260px）
- modal：較大字體 + 自動換行/橫向 scroll

---

## 錯誤/空數據處理

- `data` 無 rows 或缺 `eu`：Preview 顯示「無資料」
- 行數過多（例如 > 20）：仍顯示全部，但縮圖可用較細行高（避免爆高）

---

## 驗收準則

1. 新增尺碼表後，按「載入尺碼表」列表可見 Preview 縮圖
2. 足球服 ADULT（含 seat）縮圖與放大圖會顯示 臀圍 欄
3. 點縮圖可彈出放大預覽，能清楚核對全部行

