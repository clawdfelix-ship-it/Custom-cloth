# 後台「分類管理」分層（大分類》子分類）設計

## 背景
目前後台 `/admin/categories` 以平面表格顯示分類，雖然資料庫已支援 `categories.parent_id`，但 UI 未呈現層級、表單亦未提供設定 `parent_id`，導致分類管理難以維護「大分類 / 子分類」結構。

## 目標
- 後台分類管理做到兩級分層：大分類（root）＞子分類（leaf）。
- 左邊列表以樹狀縮排呈現，可展開/收合。
- 右邊表單可設定/修改上級分類（`parent_id`）。
- 加入防呆：只允許兩級、禁止循環、禁止自指、避免三層。
- 大分類商品數顯示「合計」（包含子分類）。

## 非目標
- 不做第三層以上分類（只支援兩級）。
- 不做拖拽排序（沿用 `sort_order`，必要時再擴充）。
- 不更改前台分類展示策略（此改動只針對後台分類管理）。

## 現況與限制
- DB 已有：`categories.parent_id` self-referencing；`products.category_id` 指向 leaf（子分類）。
- `GET /api/admin/categories` 已回傳 `c.*`，包含 `parent_id`。
- 後台分類管理前端目前未提交 `parent_id`、未按樹狀渲染。

## UI/UX 設計

### 左側列表（樹狀縮排）
- 呈現兩級：
  - 大分類（`parent_id IS NULL`）：粗體顯示，可點擊展開/收合。
  - 子分類（`parent_id = <root id>`）：縮排顯示（例如 padding-left）。
- 參考 `macrozheng/mall` 後台分類管理體驗：
  - 大分類行提供快捷操作：新增子分類（直接帶入 parent_id）。
  - 子分類行可清晰辨識層級（縮排 + 較細字/灰底 tag 皆可）。
- 展開/收合：
  - 預設全部展開。
  - 展開狀態只存於前端（in-memory state），不寫入 DB。
- 欄位：
  - 保留現有欄位：ID / 分類 / Slug / 排序 / 狀態 / 商品數 / 操作。
  - 商品數顯示：
    - 子分類：自身 `product_count`。
    - 大分類：`自身 product_count + 所有子分類 product_count 總和`（通常 root 自身應為 0，但保留計算以防歷史資料）。

### 右側表單（新增/編輯）
- 新增欄位：「上級分類」
  - 選項：`無（= 大分類）` + 所有大分類。
  - 編輯時自動帶出目前 `parent_id`。
  - 新增預設為 `無`。
- 參考 `macrozheng/mall` 操作流：
  - 點大分類行的「新增子分類」時，表單會自動選中上級分類並清空其餘欄位（快速建立）。
- 提交 payload：
  - `name, slug, sort_order, status, parent_id`（parent_id 允許 null）。

## 後端校驗與規則

### 兩級限制
- `parent_id` 只允許：
  - `null`（大分類）
  - 指向一個大分類（該分類 `parent_id IS NULL`）
- 禁止將子分類設為另一個子分類的 parent（避免三層）。

### 禁止自指與循環
- 禁止 `parent_id = id`。
- 禁止循環（最少需要檢查：parent 不能是自己的 descendant）。
  - 由於只允許兩級，循環檢查可以簡化：
    - 若更新 `id` 的 `parent_id` 指向 `p`：
      - 確保 `p.parent_id IS NULL`
      - 並且 `p.id != id`
      - 並且 `p.id` 不是 `id` 的子分類（可用 `EXISTS (SELECT 1 FROM categories c WHERE c.parent_id = id AND c.id = p.id)` 直接否定）

### 變更層級限制
- 若某分類已經有子分類（存在任何 `categories.parent_id = <id>`），不允許將其設為子分類（即不允許為該分類設定 `parent_id` 非 null），以避免三層。

### 刪除規則
- 保留現有規則：分類底下有商品則不能刪除（400）。
- 額外（可選，若現有行為不足再補）：若該分類仍有子分類，也不可刪除（避免 orphan）。

## 資料流程
1. 前端 `GET /api/admin/categories` 拿平面列表（含 `parent_id, product_count`）。
2. 前端建立樹：
   - `roots = parent_id == null`
   - `childrenByParentId[parentId] = [...]`
3. 前端渲染樹狀 table rows（root row + children rows）。
4. 表單提交 create/update 時帶上 `parent_id`。
5. 後端做校驗，通過才寫入 DB。

## 介面/檔案範圍（預計改動）
- `views/admin/categories.ejs`
  - 新增「上級分類」欄位（select）。
- `public/js/admin/categories.js`
  - list 改為樹狀渲染（可展開/收合 state）。
  - 表單支援 `parent_id`（填入/提交）。
  - root 商品數合計計算。
- `routes/categories.js`
  - `POST /api/admin/categories`、`PUT /api/admin/categories/:id` 加入 parent_id 校驗（兩級、防循環、防三層）。
  - 如需要：`DELETE` 加「有子分類不可刪」的校驗。

## 驗收標準（手動驗收）
- `/admin/categories`：
  - 大分類/子分類清晰分層（縮排）。
  - 展開/收合正常；刷新後回到預設展開。
  - 大分類商品數為合計（包含子分類）。
- 新增：
  - 新增大分類（parent_id=null）成功。
  - 新增子分類（parent_id 指向大分類）成功。
- 編輯：
  - 子分類可改名/slug/排序/狀態，並保留 parent。
  - 子分類可移到另一個大分類底下（仍為子分類）。
  - 大分類若已有子分類，不可改成子分類（應 400 並提示）。
- 防呆：
  - 禁止 `parent_id = 自己`。
  - 禁止 `parent_id` 指向子分類。
  - 禁止造成循環。
- 刪除：
  - 分類底下有商品，仍不可刪。
  -（若啟用）分類底下有子分類，不可刪。

## 測試策略
- 單元測試（node:test）：
  - 後端：create/update category 的 parent_id 校驗（兩級、自指、父必須為 root、有子分類不可降級等）。
  - 前端（字串/regex 或 DOM 片段）：
    - categories admin 頁含「上級分類」欄位。
    - categories admin js 會讀/寫 `parent_id` 欄位（payload 包含）。
