-- 2026-10-05 販売終了商品全數下架
-- 規則（Felix）：商品情報「出荷」= 販売終了 嘅同步產品一律下架（status='inactive'）。
-- 判定來源：爬詳情時 raw_payload.isEnded = true（由「出荷」狀態文字解析）。
-- 本次一次性下架既有貨；同步/匯入入口（import-mzakka-to-postgres、lean-import-missing、
-- dailySync）已改為新匯入或重新同步時自動保持 inactive。
UPDATE products
SET status = 'inactive', updated_at = NOW()
WHERE source = 'mzakka'
  AND raw_payload->>'isEnded' = 'true'
  AND status = 'active';
-- 預期影響：3901
