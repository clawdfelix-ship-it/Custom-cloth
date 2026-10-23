-- 廠方型號（メーカー型番 / MPN）：mzakka 商品標題結尾常見，例如 GLCM-002
-- JAN code 已經重用 barcode 欄；廠方型號獨立一欄，方便入貨/盤點對照
ALTER TABLE product_skus
  ADD COLUMN IF NOT EXISTS manufacturer_code VARCHAR(100);
