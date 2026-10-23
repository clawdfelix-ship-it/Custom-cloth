# CSP 收緊（Report-Only + 報告收集）設計規格

## 背景

現時已加入 Helmet，並啟用 CSP `reportOnly: true`，目標係先唔阻斷前台/後台，逐步收緊策略。

要由「寬鬆 CSP」走向「更嚴 CSP（最終 enforce）」之前，必須先量度現況實際依賴咩來源/指令（特別係 Tailwind CDN 可能會觸發 `unsafe-eval`）。所以本階段採用 **Report-Only + 報告收集**：

- 不會 block 任何資源載入（維持穩定）
- 但會收集 CSP 違規報告，用作下一階段收緊依據

## 目標（Goals）

- 保持頁面行為不變（Report-Only），但逐步收緊到可量度風險（例如移除 `unsafe-eval` 以觀察報告）。
- 新增一個 CSP report endpoint（同站點）接收瀏覽器報告。
- 確保報告收集不引入新風險：避免被濫用刷 log、避免記錄敏感資料、避免被 CSRF/權限機制阻礙。
- 提供清晰嘅環境變量開關，之後可無痛切換 `report` / `enforce` 模式。

## 非目標（Non-goals）

- 暫時唔做「移除 Tailwind CDN → 本地 build tailwind」嘅改造（另立專案）。
- 暫時唔做完整 CSP 最嚴策略（無 `unsafe-inline`、nonce/hash-based scripts）——會影響大量 template/inline 行為。

## 設計概述

### 1) CSP 模式與環境變量

新增 env：

- `CSP_MODE`：`report` | `enforce`（預設 `report`）
- `CSP_REPORT_PATH`：預設 `/csp-report`

行為：

- `CSP_MODE=report`：Helmet CSP `reportOnly: true`
- `CSP_MODE=enforce`：Helmet CSP `reportOnly: false`

### 2) CSP policy（先收緊到可量度）

策略原則：

- 仍允許現有依賴（例如 `https://cdn.tailwindcss.com`）
- 先「移除 `unsafe-eval`」但保持 report-only，觀察違規來源（如果 Tailwind CDN 需要 eval，會出 report，之後再決定走本地 build）

### 3) CSP Report Endpoint

新增 `POST /csp-report`（可由 `CSP_REPORT_PATH` 覆寫），接收：

- `Content-Type: application/csp-report`（舊格式）
- `Content-Type: application/reports+json`（新格式：Reporting API）

收集原則（避免敏感資料）：

- 只記錄必要欄位：`blocked-uri`、`violated-directive`、`effective-directive`、`source-file`（只保留 origin+path）、`disposition`、`referrer`（可選）
- 不記錄 request body 全量、不記錄 querystring、不記錄任何 cookie/session 資訊

防濫用：

- 對 `/csp-report` 套用較低成本 rate limit（可重用現有 limiter 或新增一個更低門檻的 limiter）
- 永遠回 `204 No Content`（避免成為反射型資訊通道）

與 CSRF/權限相容：

- `/csp-report` 一律豁免 CSRF（因為呢個係 browser 自動上報，並非 user action）
- 不需要登入

### 4) 測試策略

- 加 unit tests 驗證：
  - `app.js` 有 wiring：CSP mode/env、report endpoint route 註冊、endpoint 豁免 CSRF
  - policy 中 `unsafe-eval` 係已移除（避免意外放寬）

## 風險與緩解

- **報告量過大**：加 rate limit + 204；必要時 production 只保留抽樣記錄或按分鐘聚合。
- **洩漏敏感 URL**：落地時只 log origin+path，剝離 querystring。
- **CSP policy 影響頁面**：Report-Only 不會影響；進入 enforce 前先用報告驗證。

## 驗收標準（Acceptance Criteria）

- `CSP_MODE=report` 時，前台/後台功能不變。
- 瀏覽器可成功 POST CSP report 到 `/csp-report` 並得到 204。
- 測試全過（`npm test`）。

