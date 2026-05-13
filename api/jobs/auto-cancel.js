/**
 * 自動取消未付款訂單 API
 * 
 * GET /api/jobs/auto-cancel
 * 
 * Vercel Cron 配置（在 vercel.json 中）：
 * {
 *   "crons": [{
 *     "path": "/api/jobs/auto-cancel",
 *     "schedule": "*/10 * * * *"
 *   }]
 * }
 * 
 * 環境變量：
 * - CRON_SECRET: 授權 token（生產環境必須設置）
 * - ORDER_AUTO_CANCEL_MINUTES: 自動取消分鐘數（默認30分鐘）
 */
const { handleCronRequest } = require('../src/jobs/auto-cancel');

module.exports = async function handler(req, res) {
  // 只允許 cron 或已授權的請求
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  await handleCronRequest(req, res);
};
