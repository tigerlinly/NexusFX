const express = require('express');
const { pool } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);

// GET /api/bots — list user's bots
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, a.account_name, a.account_number,
              (SELECT COUNT(*) FROM bot_events be WHERE be.bot_id = b.id
               AND be.event_type IN ('TRADE','SIGNAL_RECEIVED','ORDER_PLACED','SIGNAL_GENERATED','STATE_CHANGE')
               AND be.created_at >= NOW() - INTERVAL '24 hours')::int AS recent_events,
              (SELECT COUNT(*) FROM orders o WHERE o.bot_id = b.id AND o.status = 'FILLED')::int AS total_trades,
              (SELECT COUNT(*) FROM orders o WHERE o.bot_id = b.id AND o.status = 'PENDING')::int AS pending_orders
       FROM trading_bots b
       LEFT JOIN accounts a ON a.id = b.account_id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch bots error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/bots/logs/all
router.get('/logs/all', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT be.*, b.bot_name
       FROM bot_events be
       JOIN trading_bots b ON be.bot_id = b.id
       WHERE b.user_id = $1
       ORDER BY be.created_at DESC
       LIMIT 100`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch all bot logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/bots — create a bot (full config)
router.post('/', async (req, res) => {
  try {
    const {
      account_id, bot_name, strategy_type,
      primary_timeframe, analysis_timeframes,
      indicators_config, symbols, min_confidence,
      parameters,
    } = req.body;

    if (!bot_name || !account_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const accCheck = await pool.query(
      'SELECT id FROM accounts WHERE id = $1 AND user_id = $2',
      [account_id, req.user.id]
    );
    if (accCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized account' });
    }

    // Merge indicators config into parameters for signalEngine compatibility
    const mergedParams = {
      ...(parameters || {}),
      symbols: symbols || ['XAUUSD', 'EURUSD'],
      min_confidence: min_confidence || 60,
    };

    const result = await pool.query(
      `INSERT INTO trading_bots (
         user_id, account_id, bot_name, strategy_type,
         primary_timeframe, analysis_timeframes, indicators_config,
         min_confidence, parameters, is_active, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, 'STOPPED')
       RETURNING *`,
      [
        req.user.id, account_id, bot_name,
        strategy_type || 'Custom',
        primary_timeframe || '5m',
        JSON.stringify(analysis_timeframes || ['5m', '15m']),
        JSON.stringify(indicators_config || []),
        min_confidence || 60,
        mergedParams,
      ]
    );

    await pool.query(
      `INSERT INTO bot_events (bot_id, event_type, message) VALUES ($1, $2, $3)`,
      [result.rows[0].id, 'STATE_CHANGE', `Bot "${bot_name}" created`]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create bot error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/bots/:id — update bot config
router.put('/:id', async (req, res) => {
  try {
    const {
      is_active, bot_name, strategy_type, parameters,
      primary_timeframe, analysis_timeframes,
      indicators_config, min_confidence, symbols,
    } = req.body;

    const botCheck = await pool.query(
      'SELECT * FROM trading_bots WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (botCheck.rows.length === 0) return res.status(404).json({ error: 'Bot not found' });

    const bot = botCheck.rows[0];
    const newActive = is_active !== undefined ? is_active : bot.is_active;
    const newStatus = newActive ? 'RUNNING' : 'STOPPED';

    // Merge symbols into parameters
    const currentParams = bot.parameters || {};
    const updatedParams = {
      ...currentParams,
      ...(parameters || {}),
      ...(symbols ? { symbols } : {}),
      ...(min_confidence ? { min_confidence } : {}),
    };

    const result = await pool.query(
      `UPDATE trading_bots SET
         is_active = $1, status = $2,
         bot_name = COALESCE($3, bot_name),
         strategy_type = COALESCE($4, strategy_type),
         primary_timeframe = COALESCE($5, primary_timeframe),
         analysis_timeframes = COALESCE($6::jsonb, analysis_timeframes),
         indicators_config = COALESCE($7::jsonb, indicators_config),
         min_confidence = COALESCE($8, min_confidence),
         parameters = $9,
         updated_at = NOW()
       WHERE id = $10 RETURNING *`,
      [
        newActive, newStatus, bot_name, strategy_type,
        primary_timeframe,
        analysis_timeframes ? JSON.stringify(analysis_timeframes) : null,
        indicators_config ? JSON.stringify(indicators_config) : null,
        min_confidence,
        updatedParams,
        req.params.id,
      ]
    );

    const statusChanged = newActive !== bot.is_active;
    if (statusChanged) {
      await pool.query(
        `INSERT INTO bot_events (bot_id, event_type, message) VALUES ($1, $2, $3)`,
        [req.params.id, 'STATE_CHANGE', `Bot status changed to ${newStatus}`]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update bot error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/bots/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM trading_bots WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Bot not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete bot error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/bots/:id/logs
router.get('/:id/logs', async (req, res) => {
  try {
    const botCheck = await pool.query(
      'SELECT id FROM trading_bots WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (botCheck.rows.length === 0) return res.status(404).json({ error: 'Bot not found' });

    const result = await pool.query(
      `SELECT * FROM bot_events WHERE bot_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/bots/:id/logs
router.delete('/:id/logs', async (req, res) => {
  try {
    const botCheck = await pool.query(
      'SELECT id FROM trading_bots WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (botCheck.rows.length === 0) return res.status(404).json({ error: 'Bot not found' });

    const result = await pool.query(
      `DELETE FROM bot_events WHERE bot_id = $1`,
      [req.params.id]
    );
    res.json({ success: true, deleted: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
