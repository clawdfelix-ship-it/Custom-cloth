# 款式庫大類/子類下拉選項（前後台同步）Design

## 目標

1. 後台 `/admin` 新增款式時，`大類(cate1)`、`子類(cate2)` 由手動輸入改成「下拉選項」。
2. 同時保留彈性：可揀 `自訂` 再輸入新類別，避免卡住新增。
3. 客戶端落單頁 `/` 的 `cate1/cate2` 下拉選項由 API 動態取得，與後台新增的分類同步（不用再手動改前端 hardcode）。

---

## 現況

- 客戶端 `index.html`：
  - `cate1` / `cate2` 是 hardcode `<option>`
  - `filterStyle()` 呼叫 `/api/public/styles?cate1=...&cate2=...`
- 後台 `admin.html`：
  - `styleCate1` / `styleCate2` 是 `<input>`
  - 新增款式時直接把文字存入 DB（styles.cate1 / styles.cate2）

---

## 方案（採用）

### 1) 新增分類清單 API

新增：

- `GET /api/public/categories`

返回：

```json
{
  "ok": true,
  "cate1": ["現貨款式加工", "熱昇華訂製", "開板訂製"],
  "cate2ByCate1": {
    "現貨款式加工": ["球衣", "POLO", "風衣外套", "其他"],
    "熱昇華訂製": ["球衣", "POLO", "風衣外套", "其他"],
    "開板訂製": ["球衣", "POLO", "風衣外套", "其他"]
  }
}
```

來源組合：

- **預設清單**：保留目前客戶端 hardcode 的選項（確保 DB 未有款式時依然有得揀）
- **DB 動態清單**：`styles` 表 `distinct cate1/cate2`，並 union 進去（確保後台新增新類別後會出現）

### 2) 後台（admin）新增款式改為下拉 + 自訂

UI：

- `大類`：`<select>` + 一個 `自訂` option
- `子類`：跟大類聯動的 `<select>` + `自訂`
- 當選 `自訂` 時顯示對應 `<input>` 讓用戶輸入

提交：

- 如果選 `自訂`：用 input 的值
- 否則：用 select 的值

### 3) 客戶端（/）分類選單改由 API 讀取

流程：

- page init 時 fetch `/api/public/categories`
- 填充 `cate1` options
- 根據選中的 `cate1` 動態填充 `cate2` options
- 保留 `自訂`（可選）：
  - 若要「只揀現有分類」，則 client 端可不提供 `自訂`

---

## 驗收準則

1. 後台新增款式：大類/子類可以直接揀；如要新分類可以揀自訂並輸入
2. 後台新增新子類後：客戶端 `/` 重新載入頁面即可見到新子類選項
3. 現有 `/api/public/styles` API 不用改，仍能按 cate1/cate2 過濾

