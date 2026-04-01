const express = require('express');
const { pool } = require('../config/database');
const { authMiddleware, auditLog } = require('../middleware/auth');
const { encrypt, decrypt, mask } = require('../utils/encryption');
const router = express.Router();

router.use(authMiddleware);

// Sensitive fields that must be encrypted in DB
const SENSITIVE_FIELDS = [
  'metaapi_token', 'binance_api_key', 'binance_api_secret',
  'twelvedata_api_key', 'line_notify_token', 'telegram_bot_token'
];

/**
 * @swagger
 * /settings:
 *   get:
 *     summary: Get user settings (sensitive fields are decrypted for display)
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

    const settings = result.rows[0];
    const response = { ...settings };

    // Decrypt sensitive fields and provide _actual / _masked versions
    for (const field of SENSITIVE_FIELDS) {
      const raw = settings[field] || '';
      const decrypted = decrypt(raw);
      response[`${field}_actual`] = decrypted;
      response[`${field}_masked`] = mask(decrypted);
      // Keep raw field as the encrypted value (frontend won't use it directly)
      response[field] = decrypted; // For backward compat with frontend state
    }
    response.telegram_chat_id = settings.telegram_chat_id || '';

    res.json(response);
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /settings:
 *   put:
 *     summary: Update user settings (sensitive fields are encrypted before storage)
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
      binance_api_key, binance_api_secret, twelvedata_api_key, line_notify_token,
      telegram_bot_token, telegram_chat_id, sync_schedules
    } = req.body;

    // Encrypt sensitive fields before storing
    const valMetaapi = metaapi_token !== undefined ? encrypt((metaapi_token || '').trim()) : null;
    const valBinanceKey = binance_api_key !== undefined ? encrypt((binance_api_key || '').trim()) : null;
    const valBinanceSecret = binance_api_secret !== undefined ? encrypt((binance_api_secret || '').trim()) : null;
    const valTwelvedata = twelvedata_api_key !== undefined ? encrypt((twelvedata_api_key || '').trim()) : null;
    const valLineToken = line_notify_token !== undefined ? encrypt((line_notify_token || '').trim()) : null;
    const valTelegramToken = telegram_bot_token !== undefined ? encrypt((telegram_bot_token || '').trim()) : null;

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
        telegram_bot_token = COALESCE($16, telegram_bot_token),
        telegram_chat_id = COALESCE($17, telegram_chat_id),
        sync_schedules = COALESCE($18, sync_schedules),
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
        valMetaapi,
        auto_sync !== undefined ? auto_sync : null,
        valBinanceKey,
        valBinanceSecret,
        valTwelvedata,
        valLineToken,
        valTelegramToken,
        telegram_chat_id !== undefined ? telegram_chat_id : null,
        sync_schedules ? JSON.stringify(sync_schedules) : null
      ]
    );

    if (result.rows.length === 0) {
      const insertResult = await pool.query(
        `INSERT INTO user_settings (user_id, theme_id, notifications_enabled, sound_enabled, language, timezone, notify_new_trade, metaapi_token, auto_sync, binance_api_key, binance_api_secret, twelvedata_api_key, line_notify_token, telegram_bot_token, telegram_chat_id, sync_schedules)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING *`,
        [req.user.id, theme_id || 'dark-trading', notifications_enabled ?? true, sound_enabled ?? true, language || 'th', timezone || 'Asia/Bangkok', notify_new_trade ?? false, valMetaapi || '', auto_sync ?? true, valBinanceKey || '', valBinanceSecret || '', valTwelvedata || '', valLineToken || '', valTelegramToken || '', telegram_chat_id || '', sync_schedules ? JSON.stringify(sync_schedules) : JSON.stringify(['07:00'])]
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

// POST /api/settings/test-telegram
router.post('/test-telegram', async (req, res) => {
  try {
    const TelegramNotify = require('../services/telegramNotify');
    const success = await TelegramNotify.sendAlert(req.user.id, `✅ การทดสอบการเชื่อมต่อ Telegram สำเร็จ!\nระบบ NexusFX ของคุณพร้อมส่งแจ้งเตือนการเทรดแล้ว 🚀`);
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
