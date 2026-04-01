const express = require('express');
const { pool } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);

// GET /api/targets
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT dt.*, a.account_name, a.account_number, b.display_name as broker_name
       FROM daily_targets dt
       LEFT JOIN accounts a ON a.id = dt.account_id
       LEFT JOIN brokers b ON b.id = a.broker_id
       WHERE dt.user_id = $1
       ORDER BY dt.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get targets error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/targets
router.post('/', async (req, res) => {
  try {
    const { account_id, target_amount, action_on_reach } = req.body;
    if (!target_amount || target_amount <= 0) {
      return res.status(400).json({ error: 'Valid target_amount required' });
    }

    // Verify account ownership if specified
    if (account_id) {
      const acc = await pool.query(
        'SELECT id FROM accounts WHERE id = $1 AND user_id = $2',
        [account_id, req.user.id]
      );
      if (acc.rows.length === 0) {
        return res.status(404).json({ error: 'Account not found' });
      }
    }

    const result = await pool.query(
      `INSERT INTO daily_targets (user_id, account_id, target_amount, action_on_reach)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, account_id || null, target_amount, action_on_reach || 'NOTIFY']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create target error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/targets/:id
router.put('/:id', async (req, res) => {
  try {
    const { target_amount, action_on_reach, is_active } = req.body;
    const result = await pool.query(
      `UPDATE daily_targets SET
        target_amount = COALESCE($1, target_amount),
        action_on_reach = COALESCE($2, action_on_reach),
        is_active = COALESCE($3, is_active),
        updated_at = NOW()
       WHERE id = $4 AND user_id = $5 RETURNING *`,
      [target_amount, action_on_reach, is_active, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Target not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update target error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/targets/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM daily_targets WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Delete target error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/targets/:id/action — user responds when target reached
router.post('/:id/action', async (req, res) => {
  try {
    const { action } = req.body; // 'STOPPED' or 'CONTINUED'
    if (!['STOPPED', 'CONTINUED'].includes(action)) {
      return res.status(400).json({ error: 'action must be STOPPED or CONTINUED' });
    }

    const target = await pool.query(
      'SELECT * FROM daily_targets WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (target.rows.length === 0) {
      return res.status(404).json({ error: 'Target not found' });
    }

    const t = target.rows[0];
    const todayDate = new Date();
    const today = new Date(todayDate.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })).toISOString().split('T')[0];

    // Get current PnL
    let pnlQuery;
    if (t.account_id) {
      pnlQuery = await pool.query(
        `SELECT COALESCE(SUM(pnl), 0) as current_pnl FROM trades 
         WHERE account_id = $1 AND DATE(closed_at) = $2 AND status = 'CLOSED'`,
        [t.account_id, today]
      );
    } else {
      const accs = await pool.query(
        'SELECT id FROM accounts WHERE user_id = $1 AND is_active = true',
        [req.user.id]
      );
      const accIds = accs.rows.map(r => r.id);
      pnlQuery = await pool.query(
        `SELECT COALESCE(SUM(pnl), 0) as current_pnl FROM trades 
         WHERE account_id = ANY($1) AND DATE(closed_at) = $2 AND status = 'CLOSED'`,
        [accIds, today]
      );
    }

    // Record in target_history
    await pool.query(
      `INSERT INTO target_history (daily_target_id, user_id, account_id, reached_date, target_amount, pnl_at_reach, user_action)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [t.id, req.user.id, t.account_id, today, t.target_amount, pnlQuery.rows[0].current_pnl, action]
    );

    res.json({ success: true, action, pnl: parseFloat(pnlQuery.rows[0].current_pnl) });
  } catch (err) {
    console.error('Target action error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/targets/history
router.get('/history', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT th.*, a.account_name, a.account_number, b.display_name as broker_name
       FROM target_history th
       LEFT JOIN accounts a ON a.id = th.account_id
       LEFT JOIN brokers b ON b.id = a.broker_id
       WHERE th.user_id = $1
       ORDER BY th.reached_date DESC
       LIMIT 100`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Target history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/targets/status — current day progress for all active targets
router.get('/status', async (req, res) => {
  try {
    const targets = await pool.query(
      `SELECT dt.*, a.account_name, b.display_name as broker_name
       FROM daily_targets dt
       LEFT JOIN accounts a ON a.id = dt.account_id
       LEFT JOIN brokers b ON b.id = a.broker_id
       WHERE dt.user_id = $1 AND dt.is_active = true`,
      [req.user.id]
    );

    const todayDate = new Date();
    const today = new Date(todayDate.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })).toISOString().split('T')[0];
    const statuses = [];

    for (const t of targets.rows) {
      let currentPnl;
      if (t.account_id) {
        const r = await pool.query(
          `SELECT COALESCE(SUM(pnl), 0) as pnl FROM trades 
           WHERE account_id = $1 AND DATE(closed_at) = $2 AND status = 'CLOSED'`,
          [t.account_id, today]
        );
        currentPnl = parseFloat(r.rows[0].pnl);
      } else {
        const accs = await pool.query(
          'SELECT id FROM accounts WHERE user_id = $1 AND is_active = true',
          [req.user.id]
        );
        const accIds = accs.rows.map(r => r.id);
        const r = await pool.query(
          `SELECT COALESCE(SUM(pnl), 0) as pnl FROM trades 
           WHERE account_id = ANY($1) AND DATE(closed_at) = $2 AND status = 'CLOSED'`,
          [accIds, today]
        );
        currentPnl = parseFloat(r.rows[0].pnl);
      }

      const progress = t.target_amount > 0 ? 
        Math.max(0, Math.min(100, (currentPnl / parseFloat(t.target_amount)) * 100)).toFixed(1) : 0;
      const reached = currentPnl >= parseFloat(t.target_amount);

      statuses.push({
        ...t,
        current_pnl: currentPnl,
        progress: parseFloat(progress),
        reached,
      });
    }

    res.json(statuses);
  } catch (err) {
    console.error('Target status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
