const express = require('express');
const { pool } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);

// GET /api/bots — list user's bots
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, a.account_name, a.account_number 
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

// POST /api/bots — create a bot
router.post('/', async (req, res) => {
  try {
    const { account_id, bot_name, strategy_type, parameters } = req.body;
    if (!bot_name || !account_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify account belongs to user
    const accCheck = await pool.query('SELECT id FROM accounts WHERE id = $1 AND user_id = $2', [account_id, req.user.id]);
    if (accCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized account' });
    }

    const result = await pool.query(
      `INSERT INTO trading_bots (user_id, account_id, bot_name, strategy_type, parameters)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, account_id, bot_name, strategy_type || 'Custom', parameters || {}]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create bot error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/bots/:id — update bot (toggle active)
router.put('/:id', async (req, res) => {
  try {
    const { is_active, parameters, bot_name } = req.body;
    
    // Check ownership
    const botCheck = await pool.query('SELECT * FROM trading_bots WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (botCheck.rows.length === 0) return res.status(404).json({ error: 'Bot not found' });
    
    const bot = botCheck.rows[0];
    const newActive = is_active !== undefined ? is_active : bot.is_active;
    const newStatus = newActive ? 'RUNNING' : 'STOPPED';
    
    const result = await pool.query(
      `UPDATE trading_bots 
       SET is_active = $1, status = $2, parameters = COALESCE($3, parameters), bot_name = COALESCE($4, bot_name), updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [newActive, newStatus, parameters, bot_name, req.params.id]
    );

    // Log the event
    await pool.query(
      `INSERT INTO bot_events (bot_id, event_type, message) VALUES ($1, $2, $3)`,
      [req.params.id, 'STATE_CHANGE', `Bot status changed to ${newStatus}`]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update bot error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/bots/:id — delete bot
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM trading_bots WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Bot not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete bot error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/bots/:id/logs — view bot events
router.get('/:id/logs', async (req, res) => {
  try {
    // Check ownership
    const botCheck = await pool.query('SELECT id FROM trading_bots WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (botCheck.rows.length === 0) return res.status(404).json({ error: 'Bot not found' });

    const result = await pool.query(
      `SELECT * FROM bot_events WHERE bot_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch bot logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
