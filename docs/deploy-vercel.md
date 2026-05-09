# Deploy 到 Vercel（REF 兩頁系統雲端版）

## 1) Vercel Import Repo

- Vercel Dashboard → Add New Project → Import Git Repository
- 選擇 GitHub repo：`clawdfelix-ship-it/Custom-cloth`
- Framework：Other（保持預設即可）

## 2) 建立 Postgres（Vercel/Neon）

- Vercel Dashboard → Storage → Postgres → Create
- 連接到此 Project

確認 Project Settings → Environment Variables 有：

- `POSTGRES_URL`（由 integration 提供）

## 3) 初始化資料表

喺 Postgres Console / SQL Editor 依次執行：

- `db/schema.sql`
- `db/seed.sql`

`db/seed.sql` 會建立：

- `admin / 123456`（role=admin）
- `factory1 / 123456`（role=factory）

## 4) 功能入口

- 客戶端（新單/翻單/查單）：`/`
- 後台（帳密登入）：`/admin`

## 5) 注意事項

- 本機用 `python3 -m http.server` 只會顯示靜態頁面，唔會跑 `/api/*`；要測完整流程請用 Vercel deploy 後測試
- 圖片暫時存 DB（base64），上傳限制建議 < 500KB

