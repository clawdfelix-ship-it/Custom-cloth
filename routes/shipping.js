// ===========================================
// Shipping & Delivery API
// Hong Kong Local Adaptation: districts, couriers, pickup points
// ===========================================

module.exports = function(app, pool) {

  const requireAdmin = require('./middleware/auth').requireAdmin;
  const requirePermission = require('./middleware/auth').requirePermission;
  const { computeShippingFee } = require('../utils/shippingAvailability');

  // ===========================================
  // Shipping Zones & Methods (public)
  // ===========================================

  // Get all shipping zones
  app.get('/api/shipping/zones', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM shipping_zones ORDER BY name');
      res.json({ zones: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Get active shipping methods for calculation
  app.post('/api/shipping/methods/available', async (req, res) => {
    try {
      const { district, total_amount } = req.body;

      // Find shipping methods available for this district
      const params = [];
      let where = 'sm.is_active = true';
      if (district) {
        params.push(district);
        where += `
          AND EXISTS (
            SELECT 1
            FROM json_array_elements_text(sz.districts) d
            WHERE d = $1
          )
        `;
      }

      const result = await pool.query(
        `
          SELECT sm.*, sz.name as zone_name
          FROM shipping_methods sm
          LEFT JOIN shipping_zones sz ON sm.zone_id = sz.id
          WHERE ${where}
          ORDER BY sm.sort_order
        `,
        params
      );

      const methods = result.rows.map((method) => {
        const fee = computeShippingFee(method, total_amount);
        if (fee === null) return null;
        return { ...method, calculated_fee: fee };
      });

      // Filter out unavailable methods
      const availableMethods = methods.filter(m => m !== null);

      res.json({
        shipping_methods: availableMethods
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Get all pickup points (public)
  app.get('/api/pickup-points', async (req, res) => {
    try {
      const district = req.query.district;
      const provider = req.query.provider;

      let where = 'is_active = true';
      let params = [];

      if (district) {
        where += ` AND district = $${params.length + 1}`;
        params.push(district);
      }
      if (provider) {
        where += ` AND provider = $${params.length + 1}`;
        params.push(provider);
      }

      const result = await pool.query(`
        SELECT * FROM pickup_points WHERE ${where} ORDER BY district, name
      `, params);

      res.json({ pickup_points: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // Get pickup points by district
  app.get('/api/pickup-points/:district', async (req, res) => {
    try {
      const { district } = req.params;
      const result = await pool.query(`
        SELECT * FROM pickup_points WHERE district = $1 AND is_active = true ORDER BY name
      `, [district]);
      res.json({ pickup_points: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // ===========================================
  // Admin: Shipping Methods Management
  // ===========================================

  app.get('/api/admin/shipping/methods', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT sm.*, sz.name as zone_name
        FROM shipping_methods sm
        LEFT JOIN shipping_zones sz ON sm.zone_id = sz.id
        ORDER BY sm.sort_order, sm.name
      `);
      res.json({ shipping_methods: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.post('/api/admin/shipping/methods', requirePermission('*'), async (req, res) => {
    try {
      const { name, type, zone_id, provider, shipping_fee, free_shipping_threshold, sort_order, is_active } = req.body;

      const result = await pool.query(`
        INSERT INTO shipping_methods (name, type, zone_id, provider, shipping_fee, free_shipping_threshold, sort_order, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [name, type, zone_id || null, provider, shipping_fee, free_shipping_threshold, sort_order || 0, is_active !== false]);

      res.json({ success: true, shipping_method: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.put('/api/admin/shipping/methods/:id', requirePermission('*'), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, type, zone_id, provider, shipping_fee, free_shipping_threshold, sort_order, is_active } = req.body;

      const result = await pool.query(`
        UPDATE shipping_methods SET
          name = $1, type = $2, zone_id = $3, provider = $4, shipping_fee = $5,
          free_shipping_threshold = $6, sort_order = $7, is_active = $8
        WHERE id = $9
        RETURNING *
      `, [name, type, zone_id || null, provider, shipping_fee, free_shipping_threshold, sort_order, is_active, id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: '運輸方式不存在' });
      }

      res.json({ success: true, shipping_method: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.delete('/api/admin/shipping/methods/:id', requirePermission('*'), async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query('DELETE FROM shipping_methods WHERE id = $1', [id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // ===========================================
  // Admin: Pickup Points Management
  // ===========================================

  app.get('/api/admin/pickup-points', requireAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.page_size) || 50;
      const offset = (page - 1) * pageSize;
      const district = req.query.district;
      const provider = req.query.provider;

      let where = '1=1';
      let params = [];
      if (district) {
        where += ` AND district = $${params.length + 1}`;
        params.push(district);
      }
      if (provider) {
        where += ` AND provider = $${params.length + 1}`;
        params.push(provider);
      }

      const countResult = await pool.query(`SELECT COUNT(*) FROM pickup_points WHERE ${where} AND is_active = true`, params);
      const total = parseInt(countResult.rows[0].count);

      const result = await pool.query(`
        SELECT * FROM pickup_points WHERE ${where} AND is_active = true ORDER BY district, name
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, pageSize, offset]);

      res.json({
        pickup_points: result.rows,
        pagination: { page, page_size: pageSize, total }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.post('/api/admin/pickup-points', requirePermission('*'), async (req, res) => {
    try {
      const { name, address, district, provider, latitude, longitude } = req.body;

      const result = await pool.query(`
        INSERT INTO pickup_points (name, address, district, provider, latitude, longitude)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [name, address, district, provider, latitude, longitude]);

      res.json({ success: true, pickup_point: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.put('/api/admin/pickup-points/:id', requirePermission('*'), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, address, district, provider, latitude, longitude, is_active } = req.body;

      const result = await pool.query(`
        UPDATE pickup_points SET
          name = $1, address = $2, district = $3, provider = $4, latitude = $5, longitude = $6, is_active = $7
        WHERE id = $8
        RETURNING *
      `, [name, address, district, provider, latitude, longitude, is_active, id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: '自取點不存在' });
      }

      res.json({ success: true, pickup_point: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.delete('/api/admin/pickup-points/:id', requirePermission('*'), async (req, res) => {
    try {
      const { id } = req.params;
      // Soft deactivate
      await pool.query('UPDATE pickup_points SET is_active = false WHERE id = $1', [id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // ===========================================
  // Bulk import pickup points (for HK lockers/convenience stores)
  // ===========================================

  app.post('/api/admin/pickup-points/bulk', requirePermission('*'), async (req, res) => {
    try {
      const { pickup_points } = req.body;
      const client = await pool.connect();
      let inserted = 0;

      try {
        await client.query('BEGIN');
        for (const pp of pickup_points) {
          await client.query(`
            INSERT INTO pickup_points (name, address, district, provider, latitude, longitude)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT DO NOTHING
          `, [pp.name, pp.address, pp.district, pp.provider, pp.latitude, pp.longitude]);
          inserted++;
        }
        await client.query('COMMIT');
        res.json({ success: true, inserted });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // ===========================================
  // Pre-filled Hong Kong district list for frontend
  // ===========================================

  app.get('/api/hong-kong/district-list', async (req, res) => {
    try {
      const districts = {
        'Hong Kong Island': [
          'Central', 'Admiralty', 'Mid-Levels', 'Sheung Wan', 'Wan Chai',
          'Causeway Bay', 'North Point', 'Quarry Bay', 'Tai Koo', 'Shau Kei Wan',
          'Chai Wan', 'Pok Fu Lam', 'Aberdeen', 'Stanley', 'Repulse Bay'
        ],
        'Kowloon': [
          'Tsim Sha Tsui', 'Jordan', 'Yau Ma Tei', 'Mong Kok', 'Prince Edward',
          'Sham Shui Po', 'Cheung Sha Wan', 'Kowloon City', 'Hung Hom',
          'To Kwa Wan', 'Wong Tai Sin', 'Diamond Hill', 'Kwun Tong',
          'Kowloon Bay', 'Lam Tin', 'Yau Tong'
        ],
        'New Territories East': [
          'Sha Tin', 'Ma On Shan', 'Tai Wai', 'Fo Tan', 'Tai Po',
          'Fanling', 'Sheung Shui', 'Sai Kung', 'Tseung Kwan O', 'Tiu Keng Leng'
        ],
        'New Territories West': [
          'Tsuen Wan', 'Kwai Chung', 'Tsing Yi', 'Tuen Mun', 'Yuen Long',
          'Hung Shui Kiu', 'Tin Shui Wai', 'Kam Tin'
        ],
        'Outlying Islands': [
          'Tung Chung', 'Discovery Bay', 'Lantau', 'Cheung Chau', 'Lamma Island', 'Peng Chau'
        ]
      };

      // All districts flat list for selection
      const allDistricts = [
        'Central', 'Admiralty', 'Mid-Levels', 'Sheung Wan', 'Wan Chai',
        'Causeway Bay', 'North Point', 'Quarry Bay', 'Tai Koo', 'Shau Kei Wan',
        'Chai Wan', 'Pok Fu Lam', 'Aberdeen', 'Stanley', 'Repulse Bay',
        'Tsim Sha Tsui', 'Jordan', 'Yau Ma Tei', 'Mong Kok', 'Prince Edward',
        'Sham Shui Po', 'Cheung Sha Wan', 'Kowloon City', 'Hung Hom',
        'To Kwa Wan', 'Wong Tai Sin', 'Diamond Hill', 'Kwun Tong',
        'Kowloon Bay', 'Lam Tin', 'Yau Tong',
        'Sha Tin', 'Ma On Shan', 'Tai Wai', 'Fo Tan', 'Tai Po',
        'Fanling', 'Sheung Shui', 'Sai Kung', 'Tseung Kwan O', 'Tiu Keng Leng',
        'Tsuen Wan', 'Kwai Chung', 'Tsing Yi', 'Tuen Mun', 'Yuen Long',
        'Hung Shui Kiu', 'Tin Shui Wai', 'Kam Tin',
        'Tung Chung', 'Discovery Bay', 'Lantau', 'Cheung Chau', 'Lamma Island', 'Peng Chau'
      ];

      res.json({
        grouped: districts,
        all: allDistricts.sort()
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  // ===========================================
  // Payment Methods (public list)
  // ===========================================

  app.get('/api/payment-methods', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT id, name, code, provider, fee_percent, fee_fixed, instructions, qr_code_image, sort_order
        FROM payment_methods WHERE is_active = true ORDER BY sort_order
      `);
      res.json({ payment_methods: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.get('/api/admin/payment-methods', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT * FROM payment_methods ORDER BY sort_order
      `);
      res.json({ payment_methods: result.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.post('/api/admin/payment-methods', requirePermission('*'), async (req, res) => {
    try {
      const { name, code, provider, fee_percent, fee_fixed, instructions, qr_code_image, sort_order, is_active } = req.body;

      const result = await pool.query(`
        INSERT INTO payment_methods (name, code, provider, fee_percent, fee_fixed, instructions, qr_code_image, sort_order, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [name, code, provider, fee_percent, fee_fixed, instructions || null, qr_code_image || null, sort_order || 0, is_active !== false]);

      res.json({ success: true, payment_method: result.rows[0] });
    } catch (err) {
      console.error(err);
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Code 已存在' });
      }
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.put('/api/admin/payment-methods/:id', requirePermission('*'), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, code, provider, fee_percent, fee_fixed, instructions, qr_code_image, sort_order, is_active } = req.body;

      const result = await pool.query(`
        UPDATE payment_methods SET
          name = $1, code = $2, provider = $3, fee_percent = $4, fee_fixed = $5, instructions = $6, qr_code_image = $7, sort_order = $8, is_active = $9
        WHERE id = $10
        RETURNING *
      `, [name, code, provider, fee_percent, fee_fixed, instructions, qr_code_image, sort_order, is_active, id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: '支付方式不存在' });
      }

      res.json({ success: true, payment_method: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

  app.delete('/api/admin/payment-methods/:id', requirePermission('*'), async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query('DELETE FROM payment_methods WHERE id = $1', [id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: '服務器錯誤' });
    }
  });

};
