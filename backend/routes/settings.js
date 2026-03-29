const express = require('express');
const { pool } = require('../config/database');
const { authMiddleware, auditLog } = require('../middleware/auth');
const { encrypt, decrypt, mask } = require('../utils/encryption');
const router = express.Router();

router.use(authMiddleware);

/**
 * @swagger
 * /settings:
 *   get:
 *     summary: Get user settings
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: User settings object
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM user_settings WHERE user_id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      const newSettings = await pool.query(
        'INSERT INTO user_settings (user_id) VALUES ($1) RETURNING *',
        [req.user.id]
      );
      return res.json(newSettings.rows[0]);
    }

    // Decrypt sensitive fields for display (masked)
    const settings = result.rows[0];
    const decrypted = { ...settings };

    // Return masked versions for display, not raw keys
    if (settings.metaapi_token) decrypted.metaapi_token_masked = mask(decrypt(settings.metaapi_token));
    if (settings.binance_api_key) decrypted.binance_api_key_masked = mask(decrypt(settings.binance_api_key));
    if (settings.binance_api_secret) decrypted.binance_api_secret_masked = mask(decrypt(settings.binance_api_secret));
    if (settings.twelvedata_api_key) decrypted.twelvedata_api_key_masked = mask(decrypt(settings.twelvedata_api_key));
    if (settings.line_notify_token) decrypted.line_notify_token_masked = mask(decrypt(settings.line_notify_token));

    res.json(decrypted);
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /settings:
 *   put:
 *     summary: Update user settings
 *     tags: [Settings]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Updated settings
 */
router.put('/', auditLog('UPDATE_SETTINGS', 'SETTING'), async (req, res) => {
  try {
    const {
      theme_id, custom_colors, dashboard_layout,
      notifications_enabled, sound_enabled, language, timezone,
      notify_new_trade, metaapi_token, auto_sync,
      binance_api_key, binance_api_secret, twelvedata_api_key, line_notify_token
    } = req.body;

    // 🔒 Encrypt sensitive API keys before storing
    const encMetaapi = metaapi_token !== undefined ? (metaapi_token ? encrypt(metaapi_token) : '') : null;
    const encBinanceKey = binance_api_key !== undefined ? (binance_api_key ? encrypt(binance_api_key) : '') : null;
    const encBinanceSecret = binance_api_secret !== undefined ? (binance_api_secret ? encrypt(binance_api_secret) : '') : null;
    const encTwelvedata = twelvedata_api_key !== undefined ? (twelvedata_api_key ? encrypt(twelvedata_api_key) : '') : null;
    const encLineToken = line_notify_token !== undefined ? (line_notify_token ? encrypt(line_notify_token) : '') : null;

    const result = await pool.query(
      `UPDATE user_settings SET
        theme_id = COALESCE($2, theme_id),
        custom_colors = COALESCE($3, custom_colors),
        dashboard_layout = COALESCE($4, dashboard_layout),
        notifications_enabled = COALESCE($5, notifications_enabled),
        sound_enabled = COALESCE($6, sound_enabled),
        language = COALESCE($7, language),
        timezone = COALESCE($8, timezone),
        notify_new_trade = COALESCE($9, notify_new_trade),
        metaapi_token = COALESCE($10, metaapi_token),
        auto_sync = COALESCE($11, auto_sync),
        binance_api_key = COALESCE($12, binance_api_key),
        binance_api_secret = COALESCE($13, binance_api_secret),
        twelvedata_api_key = COALESCE($14, twelvedata_api_key),
        line_notify_token = COALESCE($15, line_notify_token),
        updated_at = NOW()
      WHERE user_id = $1
      RETURNING *`,
      [
        req.user.id,
        theme_id || null,
        custom_colors ? JSON.stringify(custom_colors) : null,
        dashboard_layout ? JSON.stringify(dashboard_layout) : null,
        notifications_enabled !== undefined ? notifications_enabled : null,
        sound_enabled !== undefined ? sound_enabled : null,
        language || null,
        timezone || null,
        notify_new_trade !== undefined ? notify_new_trade : null,
        encMetaapi,
        auto_sync !== undefined ? auto_sync : null,
        encBinanceKey,
        encBinanceSecret,
        encTwelvedata,
        encLineToken
      ]
    );

    if (result.rows.length === 0) {
      const insertResult = await pool.query(
        `INSERT INTO user_settings (user_id, theme_id, notifications_enabled, sound_enabled, language, timezone, notify_new_trade, metaapi_token, auto_sync, binance_api_key, binance_api_secret, twelvedata_api_key, line_notify_token)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [req.user.id, theme_id || 'dark-trading', notifications_enabled ?? true, sound_enabled ?? true, language || 'th', timezone || 'Asia/Bangkok', notify_new_trade ?? false, encMetaapi || '', auto_sync ?? true, encBinanceKey || '', encBinanceSecret || '', encTwelvedata || '', encLineToken || '']
      );
      return res.json(insertResult.rows[0]);
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update settings error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/settings/test-line
router.post('/test-line', async (req, res) => {
  try {
    const LineNotify = require('../services/lineNotify');
    const success = await LineNotify.sendAlert(req.user.id, `✅ การทดสอบการเชื่อมต่อ Line Notify สำเร็จ!\nระบบ NexusFX ของคุณพร้อมส่งแจ้งเตือนการเทรดแล้ว 🚀`);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Failed' });
    }
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
