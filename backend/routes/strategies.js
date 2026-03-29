const express = require('express');
const { pool } = require('../config/database');
const { authMiddleware, auditLog } = require('../middleware/auth');
const LineNotify = require('../services/lineNotify');
const TelegramNotify = require('../services/telegramNotify');
const router = express.Router();

router.use(authMiddleware);

// =============================================
// BROWSE STRATEGIES (Public marketplace)
// =============================================
/**
 * @swagger
 * /strategies:
 *   get:
 *     summary: Get published strategies marketplace
 *     tags: [Copy Trading]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: risk_level
 *         schema: { type: string, enum: [low, medium, high] }
 *     responses:
 *       200:
 *         description: List of published strategies
 */
router.get('/', async (req, res) => {
  try {
    const { category, risk_level, search, sort = 'subscribers', page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let conditions = ['s.is_published = true', 's.is_active = true'];
    let params = [];
    let idx = 1;

    if (category) {
      conditions.push(`s.category = $${idx++}`);
      params.push(category);
    }
    if (risk_level) {
      conditions.push(`s.risk_level = $${idx++}`);
      params.push(risk_level);
    }
    if (search) {
      conditions.push(`(s.name ILIKE $${idx} OR s.description ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const sortMap = {
      subscribers: 's.subscribers_count DESC',
      return: 's.monthly_return DESC',
      winrate: 's.win_rate DESC',
      newest: 's.created_at DESC',
    };
    const orderBy = sortMap[sort] || sortMap.subscribers;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM strategies s WHERE ${conditions.join(' AND ')}`,
      params
    );

    params.push(parseInt(limit), offset);
    const result = await pool.query(
      `SELECT s.*, u.username as publisher_username, u.display_name as publisher_name, u.avatar_url as publisher_avatar,
              EXISTS(SELECT 1 FROM strategy_subscriptions ss WHERE ss.strategy_id = s.id AND ss.subscriber_id = $${idx} AND ss.is_active = true) as is_subscribed
       FROM strategies s
       JOIN users u ON u.id = s.publisher_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${orderBy}
       LIMIT $${idx - 1 + 1} OFFSET $${idx - 1 + 2}`,
      [...params.slice(0, -2), req.user.id, ...params.slice(-2)]
    );

    res.json({
      strategies: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
    });
  } catch (err) {
    console.error('Get strategies error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// MY STRATEGIES (publisher view)
// =============================================
router.get('/my', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, 
              (SELECT COUNT(*) FROM strategy_subscriptions ss WHERE ss.strategy_id = s.id AND ss.is_active = true) as active_subs,
              (SELECT COUNT(*) FROM strategy_signals sig WHERE sig.strategy_id = s.id) as total_signals
       FROM strategies s
       WHERE s.publisher_id = $1 AND s.is_active = true
       ORDER BY s.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('My strategies error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// CREATE STRATEGY
// =============================================
router.post('/', auditLog('CREATE_STRATEGY', 'STRATEGY'), async (req, res) => {
  try {
    const { name, description, category = 'manual', symbols = [], risk_level = 'medium', price_monthly = 0 } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Strategy name is required' });
    }

    const result = await pool.query(
      `INSERT INTO strategies (publisher_id, name, description, category, symbols, risk_level, price_monthly, is_free)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.id, name, description, category, symbols, risk_level, price_monthly, parseFloat(price_monthly) === 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create strategy error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// UPDATE STRATEGY
// =============================================
router.put('/:id', auditLog('UPDATE_STRATEGY', 'STRATEGY'), async (req, res) => {
  try {
    const { name, description, category, symbols, risk_level, price_monthly, is_published } = req.body;
    
    const result = await pool.query(
      `UPDATE strategies SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        category = COALESCE($3, category),
        symbols = COALESCE($4, symbols),
        risk_level = COALESCE($5, risk_level),
        price_monthly = COALESCE($6, price_monthly),
        is_free = CASE WHEN $6 IS NOT NULL THEN ($6::decimal = 0) ELSE is_free END,
        is_published = COALESCE($7, is_published),
        updated_at = NOW()
       WHERE id = $8 AND publisher_id = $9 RETURNING *`,
      [name, description, category, symbols, risk_level, price_monthly, is_published, req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Strategy not found or not authorized' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update strategy error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// SUBSCRIBE TO STRATEGY
// =============================================
router.post('/:id/subscribe', auditLog('SUBSCRIBE_STRATEGY', 'STRATEGY'), async (req, res) => {
  try {
    const { account_id, lot_multiplier = 1.0, max_lot = 10 } = req.body;
    const strategyId = req.params.id;

    // Check strategy exists
    const strategy = await pool.query(
      'SELECT * FROM strategies WHERE id = $1 AND is_published = true AND is_active = true',
      [strategyId]
    );
    if (strategy.rows.length === 0) {
      return res.status(404).json({ error: 'Strategy not found' });
    }

    // Can't subscribe to own strategy
    if (strategy.rows[0].publisher_id === req.user.id) {
      return res.status(400).json({ error: "You can't subscribe to your own strategy" });
    }

    // Create subscription
    const result = await pool.query(
      `INSERT INTO strategy_subscriptions (strategy_id, subscriber_id, account_id, lot_multiplier, max_lot)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (strategy_id, subscriber_id) 
       DO UPDATE SET is_active = true, account_id = $3, lot_multiplier = $4, max_lot = $5, unsubscribed_at = NULL
       RETURNING *`,
      [strategyId, req.user.id, account_id, lot_multiplier, max_lot]
    );

    // Update subscriber count
    await pool.query(
      `UPDATE strategies SET subscribers_count = 
        (SELECT COUNT(*) FROM strategy_subscriptions WHERE strategy_id = $1 AND is_active = true)
       WHERE id = $1`,
      [strategyId]
    );

    res.json({ success: true, subscription: result.rows[0] });
  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// UNSUBSCRIBE
// =============================================
router.post('/:id/unsubscribe', auditLog('UNSUBSCRIBE_STRATEGY', 'STRATEGY'), async (req, res) => {
  try {
    await pool.query(
      `UPDATE strategy_subscriptions SET is_active = false, unsubscribed_at = NOW()
       WHERE strategy_id = $1 AND subscriber_id = $2`,
      [req.params.id, req.user.id]
    );

    await pool.query(
      `UPDATE strategies SET subscribers_count = 
        (SELECT COUNT(*) FROM strategy_subscriptions WHERE strategy_id = $1 AND is_active = true)
       WHERE id = $1`,
      [req.params.id]
    );

    res.json({ success: true, message: 'Unsubscribed successfully' });
  } catch (err) {
    console.error('Unsubscribe error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// MY SUBSCRIPTIONS
// =============================================
router.get('/subscriptions/my', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ss.*, s.name as strategy_name, s.category, s.risk_level, s.monthly_return, s.win_rate,
              u.username as publisher_username, u.display_name as publisher_name,
              a.account_name
       FROM strategy_subscriptions ss
       JOIN strategies s ON s.id = ss.strategy_id
       JOIN users u ON u.id = s.publisher_id
       LEFT JOIN accounts a ON a.id = ss.account_id
       WHERE ss.subscriber_id = $1 AND ss.is_active = true
       ORDER BY ss.subscribed_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('My subscriptions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// PUBLISH SIGNAL (for strategy publisher)
// =============================================
router.post('/:id/signal', auditLog('PUBLISH_SIGNAL', 'STRATEGY'), async (req, res) => {
  try {
    const { symbol, side, lot_size, entry_price, sl, tp, signal_type = 'OPEN' } = req.body;
    const strategyId = req.params.id;

    // Verify ownership
    const strategy = await pool.query(
      'SELECT * FROM strategies WHERE id = $1 AND publisher_id = $2',
      [strategyId, req.user.id]
    );
    if (strategy.rows.length === 0) {
      return res.status(404).json({ error: 'Strategy not found or not authorized' });
    }

    // Insert signal
    const signal = await pool.query(
      `INSERT INTO strategy_signals (strategy_id, symbol, side, lot_size, entry_price, sl, tp, signal_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [strategyId, symbol, side, lot_size, entry_price, sl, tp, signal_type]
    );

    // Update strategy stats
    await pool.query(
      `UPDATE strategies SET total_trades = total_trades + 1, updated_at = NOW() WHERE id = $1`,
      [strategyId]
    );

    // Get active subscribers (for notification)
    const subs = await pool.query(
      `SELECT ss.*, u.username, a.account_number 
       FROM strategy_subscriptions ss 
       JOIN users u ON u.id = ss.subscriber_id
       LEFT JOIN accounts a ON a.id = ss.account_id
       WHERE ss.strategy_id = $1 AND ss.is_active = true`,
      [strategyId]
    );

    // Publish copies to Orders table for ExecutionEngine to pick up
    for (const sub of subs.rows) {
      if (sub.account_id) {
        let finalLot = parseFloat(lot_size) * parseFloat(sub.lot_multiplier);
        if (finalLot > parseFloat(sub.max_lot)) finalLot = parseFloat(sub.max_lot);

        await pool.query(
          `INSERT INTO orders (user_id, account_id, symbol, side, type, price, quantity, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')`,
          [sub.subscriber_id, sub.account_id, symbol, side, signal_type, entry_price || null, finalLot.toFixed(2)]
        );

        // Notify Subscriber
        const msg = `⚡ Copy Trade Signal: ${strategy.rows[0].name}\n📈 Symbol: ${symbol}\n💠 Side: ${side}\n🔢 Lot: ${finalLot.toFixed(2)}\n⚙️ Type: ${signal_type}`;
        LineNotify.sendAlert(sub.subscriber_id, msg).catch(() => {});
        TelegramNotify.sendAlert(sub.subscriber_id, msg).catch(() => {});
      }
    }

    res.json({
      success: true,
      signal: signal.rows[0],
      notified_subscribers: subs.rows.length,
    });
  } catch (err) {
    console.error('Publish signal error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// GET STRATEGY SIGNALS
// =============================================
router.get('/:id/signals', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const result = await pool.query(
      `SELECT sig.* FROM strategy_signals sig
       WHERE sig.strategy_id = $1
       ORDER BY sig.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.params.id, parseInt(limit), offset]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get signals error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
