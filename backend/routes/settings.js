const express = require('express');
const { pool } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM user_settings WHERE user_id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      // Create default settings
      const newSettings = await pool.query(
        'INSERT INTO user_settings (user_id) VALUES ($1) RETURNING *',
        [req.user.id]
      );
      return res.json(newSettings.rows[0]);
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const { auditLogger } = require('../middleware/audit');

// PUT /api/settings
router.put('/', auditLogger('UPDATE_SETTINGS', 'SETTING'), async (req, res) => {
  try {
    const {
      theme_id, custom_colors, dashboard_layout,
      notifications_enabled, sound_enabled, language, timezone,
      notify_new_trade, metaapi_token, auto_sync,
      binance_api_key, binance_api_secret, twelvedata_api_key, line_notify_token
    } = req.body;

    console.log('--- PUT /api/settings ---');
    console.log('User ID:', req.user.id);
    console.log('Payload:', JSON.stringify(req.body, null, 2));

    // Use simple UPDATE since GET already ensures the row exists
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
        metaapi_token !== undefined ? metaapi_token : null,
        auto_sync !== undefined ? auto_sync : null,
        binance_api_key !== undefined ? binance_api_key : null,
        binance_api_secret !== undefined ? binance_api_secret : null,
        twelvedata_api_key !== undefined ? twelvedata_api_key : null,
        line_notify_token !== undefined ? line_notify_token : null
      ]
    );

    if (result.rows.length === 0) {
      console.log('No row found, inserting new...');
      const insertResult = await pool.query(
        `INSERT INTO user_settings (user_id, theme_id, notifications_enabled, sound_enabled, language, timezone, notify_new_trade, metaapi_token, auto_sync, binance_api_key, binance_api_secret, twelvedata_api_key, line_notify_token)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [req.user.id, theme_id || 'dark-trading', notifications_enabled ?? true, sound_enabled ?? true, language || 'th', timezone || 'Asia/Bangkok', notify_new_trade ?? false, metaapi_token || '', auto_sync ?? true, binance_api_key || '', binance_api_secret || '', twelvedata_api_key || '', line_notify_token || '']
      );
      console.log('Insert result:', insertResult.rows[0]);
      return res.json(insertResult.rows[0]);
    }

    console.log('Update success! theme_id:', result.rows[0].theme_id, 'metaapi_token:', result.rows[0].metaapi_token);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update settings error:', err.message);
    console.error('Full error:', err);
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
