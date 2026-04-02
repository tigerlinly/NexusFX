const express = require('express');
const { pool } = require('../config/database');
const TelegramNotify = require('../services/telegramNotify');
const LineNotify = require('../services/lineNotify');
const router = express.Router();

// POST /api/webhooks/bot/:bot_id/signal
router.post('/bot/:bot_id/signal', async (req, res) => {
  try {
    const botId = req.params.bot_id;
    const { action, symbol, volume, secret_token, price, sl, tp, tf, order_type } = req.body;

    if (!action || !symbol || !volume) {
      return res.status(400).json({ error: 'Missing required parameters (action, symbol, volume)' });
    }

    // 1. Verify Bot exists and is ACTIVE
    const botQuery = await pool.query(
      `SELECT tb.*, a.user_id, a.account_number, a.account_name, b.name as broker_name 
       FROM trading_bots tb
       JOIN accounts a ON tb.account_id = a.id
       LEFT JOIN brokers b ON a.broker_id = b.id
       WHERE tb.id = $1`,
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
    const orderType = order_type || 'MARKET';
    
    // Create pending order
    const orderResult = await pool.query(
      `INSERT INTO orders (account_id, symbol, side, order_type, quantity, price, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING') RETURNING *`,
      [bot.account_id, symbol.toUpperCase(), action.toUpperCase(), orderType, lotSize, price || null]
    );

    // 3. Log event
    await pool.query(
      `INSERT INTO bot_events (bot_id, event_type, message) VALUES ($1, $2, $3)`,
      [botId, 'SIGNAL_RECEIVED', `Placed ${action} ${lotSize} on ${symbol}`]
    );

    // 4. Send Notifications
    const tradeInfo = {
      broker_name: bot.broker_name || '-',
      account_number: bot.account_number || '-',
      account_name: bot.account_name || '-',
      symbol: symbol.toUpperCase(),
      side: action.toUpperCase(),
      timeframe: tf || botParams.timeframe || '-',
      lot_size: lotSize,
      stop_loss: sl || '-',
      take_profit: tp || '-',
      entry_price: price || 'Market',
      pattern: orderType
    };

    const userId = bot.user_id;

    LineNotify.notifyTradeOpened(userId, tradeInfo).catch(err => console.warn('[LineNotify] Webhook notify failed:', err.message));
    TelegramNotify.notifyTradeOpened(userId, tradeInfo).catch(err => console.warn('[TelegramNotify] Webhook notify failed:', err.message));

    res.status(200).json({ success: true, message: 'Signal processed and order queued.', order_id: orderResult.rows[0].id });
  } catch (err) {
    console.error('Webhook Error:', err);
    res.status(500).json({ error: 'Internal server error processing webhook' });
  }
});

module.exports = router;
