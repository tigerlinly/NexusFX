const express = require('express');
const { pool } = require('../config/database');
const router = express.Router();

// POST /api/webhooks/bot/:bot_id/signal
router.post('/bot/:bot_id/signal', async (req, res) => {
  try {
    const botId = req.params.bot_id;
    const { action, symbol, volume, secret_token, price } = req.body;

    if (!action || !symbol || !volume) {
      return res.status(400).json({ error: 'Missing required parameters (action, symbol, volume)' });
    }

    // 1. Verify Bot exists and is ACTIVE
    const botQuery = await pool.query(
      `SELECT * FROM trading_bots WHERE id = $1`,
      [botId]
    );

    if (botQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    const bot = botQuery.rows[0];

    // Optional: Secret token validation
    // If bot has a webhook_secret configured in parameters, validate it.
    const botParams = bot.parameters || {};
    if (botParams.webhook_secret && botParams.webhook_secret !== secret_token) {
       // Log failed auth event
       await pool.query(`INSERT INTO bot_events (bot_id, event_type, message) VALUES ($1, $2, $3)`, [botId, 'ERROR', 'Webhook authentication failed (invalid secret token).']);
       return res.status(403).json({ error: 'Unauthorized webhook signal' });
    }

    if (!bot.is_active || bot.status === 'STOPPED') {
       await pool.query(`INSERT INTO bot_events (bot_id, event_type, message) VALUES ($1, $2, $3)`, [botId, 'WARNING', 'Signal ignored: Bot is currently inactive or stopped.']);
       return res.status(400).json({ error: 'Bot is not active' });
    }

    // 2. Insert the actual order request into orders
    const lotSize = parseFloat(volume);
    
    // Create pending order
    const orderResult = await pool.query(
      `INSERT INTO orders (account_id, symbol, side, order_type, quantity, price, status)
       VALUES ($1, $2, $3, 'MARKET', $4, $5, 'PENDING') RETURNING *`,
      [bot.account_id, symbol.toUpperCase(), action.toUpperCase(), lotSize, price || null]
    );

    // 3. Log event
    await pool.query(
      `INSERT INTO bot_events (bot_id, event_type, message) VALUES ($1, $2, $3)`,
      [botId, 'SIGNAL_RECEIVED', `Placed ${action} ${lotSize} on ${symbol}`]
    );

    res.status(200).json({ success: true, message: 'Signal processed and order queued.', order_id: orderResult.rows[0].id });
  } catch (err) {
    console.error('Webhook Error:', err);
    res.status(500).json({ error: 'Internal server error processing webhook' });
  }
});

module.exports = router;
