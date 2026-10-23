-- Seed default Hong Kong districts to shipping_zones
INSERT INTO shipping_zones (name, districts) VALUES
('Hong Kong Island', '["Central","Admiralty","Mid-Levels","Sheung Wan","Wan Chai","Causeway Bay","North Point","Quarry Bay","Tai Koo","Shau Kei Wan","Chai Wan","Pok Fu Lam","Aberdeen","Stanley","Repulse Bay"]'),
('Kowloon', '["Tsim Sha Tsui","Jordan","Yau Ma Tei","Mong Kok","Prince Edward","Sham Shui Po","Cheung Sha Wan","Kowloon City","Hung Hom","To Kwa Wan","Wong Tai Sin","Diamond Hill","Kwun Tong","Kowloon Bay","Lam Tin","Yau Tong"]'),
('New Territories East', '["Sha Tin","Ma On Shan","Tai Wai","Fo Tan","Tai Po","Fanling","Sheung Shui","Sai Kung","Tseung Kwan O","Tiu Keng Leng"]'),
('New Territories West', '["Tsuen Wan","Kwai Chung","Tsing Yi","Tuen Mun","Yuen Long","Hung Shui Kiu","Tin Shui Wai","Kam Tin"]'),
('Outlying Islands', '["Tung Chung","Discovery Bay","Lantau","Cheung Chau","Lamma Island","Peng Chau"]');

-- Seed common Hong Kong payment methods
INSERT INTO payment_methods (name, code, provider, sort_order, is_active) VALUES
('FPS轉帳', 'fps', 'fps', 1, true),
('PayMe', 'payme', 'payme', 2, true),
('AlipayHK', 'alipayhk', 'alipay', 3, true),
('WeChat Pay HK', 'wechatpayhk', 'wechatpay', 4, true),
('銀行轉帳', 'bank_transfer', 'manual', 5, true),
('信用卡 (線下)', 'credit_card_offline', 'manual', 6, true);
