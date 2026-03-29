const express = require('express');
const { pool } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);

// Helper: get account IDs based on view filter
async function getFilteredAccountIds(userId, view, brokerId, accountId) {
  if (view === 'account' && accountId) {
    // Verify account ownership
    const r = await pool.query(
      'SELECT id FROM accounts WHERE id = $1 AND user_id = $2 AND is_active = true',
      [accountId, userId]
    );
    return r.rows.map(r => r.id);
  }
  if (view === 'broker' && brokerId) {
    const r = await pool.query(
      'SELECT id FROM accounts WHERE broker_id = $1 AND user_id = $2 AND is_active = true',
      [brokerId, userId]
    );
    return r.rows.map(r => r.id);
  }
  // all
  const r = await pool.query(
    'SELECT id FROM accounts WHERE user_id = $1 AND is_active = true',
    [userId]
  );
  return r.rows.map(r => r.id);
}

// GET /api/dashboard/summary
router.get('/summary', async (req, res) => {
  try {
    const { view = 'all', broker_id, account_id } = req.query;
    const accountIds = await getFilteredAccountIds(req.user.id, view, broker_id, account_id);

    if (accountIds.length === 0) {
      return res.json({
        total_balance: 0, total_equity: 0, total_pnl_today: 0,
        total_trades_today: 0, win_rate_today: 0, accounts_count: 0,
      });
    }

    // Account summary
    const accSummary = await pool.query(
      `SELECT 
        SUM(balance) as total_balance,
        SUM(equity) as total_equity,
        COUNT(*) as accounts_count
       FROM accounts WHERE id = ANY($1)`,
      [accountIds]
    );

    // Today's aggregate
    const today = new Date().toISOString().split('T')[0];
    const todayAgg = await pool.query(
      `SELECT 
        COALESCE(SUM(total_pnl), 0) as total_pnl_today,
        COALESCE(SUM(total_trades), 0) as total_trades_today,
        COALESCE(SUM(winning_trades), 0) as winning_today,
        COALESCE(SUM(losing_trades), 0) as losing_today,
        COALESCE(SUM(total_volume), 0) as volume_today
       FROM daily_aggregates 
       WHERE account_id = ANY($1) AND report_date = $2`,
      [accountIds, today]
    );

    // Open positions
    const openTrades = await pool.query(
      `SELECT COUNT(*) as open_count, COALESCE(SUM(pnl), 0) as floating_pnl
       FROM trades WHERE account_id = ANY($1) AND status = 'OPEN'`,
      [accountIds]
    );

    // Total withdrawals
    const withdrawalSum = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total_withdrawal
       FROM withdrawals 
       WHERE account_id = ANY($1) AND status = 'COMPLETED'`,
      [accountIds]
    );

    const td = todayAgg.rows[0];
    const totalToday = parseInt(td.winning_today) + parseInt(td.losing_today);
    const winRate = totalToday > 0 ? ((td.winning_today / totalToday) * 100).toFixed(1) : 0;

    res.json({
      total_balance: parseFloat(accSummary.rows[0].total_balance) || 0,
      total_equity: parseFloat(accSummary.rows[0].total_equity) || 0,
      accounts_count: parseInt(accSummary.rows[0].accounts_count),
      total_pnl_today: parseFloat(td.total_pnl_today),
      total_trades_today: parseInt(td.total_trades_today),
      win_rate_today: parseFloat(winRate),
      volume_today: parseFloat(td.volume_today),
      open_positions: parseInt(openTrades.rows[0].open_count),
      floating_pnl: parseFloat(openTrades.rows[0].floating_pnl),
      total_withdrawal: parseFloat(withdrawalSum.rows[0].total_withdrawal),
    });
  } catch (err) {
    console.error('Dashboard summary error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/pnl-chart
router.get('/pnl-chart', async (req, res) => {
  try {
    const { view = 'all', broker_id, account_id, start_date, end_date } = req.query;
    const accountIds = await getFilteredAccountIds(req.user.id, view, broker_id, account_id);

    if (accountIds.length === 0) return res.json([]);

    const sd = start_date || new Date(new Date().setDate(new Date().getDate() - 29)).toISOString().split('T')[0];
    const ed = end_date || new Date().toISOString().split('T')[0];

    const result = await pool.query(
      `WITH date_series AS (
         SELECT generate_series(
           $2::date,
           $3::date,
           '1 day'::interval
         )::date AS report_date
       )
       SELECT 
        ds.report_date,
        COALESCE(SUM(da.total_pnl), 0) as pnl,
        COALESCE(SUM(da.total_trades), 0) as trades,
        COALESCE(SUM(da.winning_trades), 0) as wins,
        COALESCE(SUM(da.total_volume), 0) as volume
       FROM date_series ds
       LEFT JOIN daily_aggregates da
         ON da.report_date = ds.report_date AND da.account_id = ANY($1)
       GROUP BY ds.report_date
       ORDER BY ds.report_date`,
      [accountIds, sd, ed]
    );

    // Compute cumulative PnL
    let cumPnl = 0;
    const data = result.rows.map(row => {
      cumPnl += parseFloat(row.pnl);
      return {
        date: row.report_date,
        pnl: parseFloat(row.pnl),
        cumulative_pnl: cumPnl,
        trades: parseInt(row.trades),
        wins: parseInt(row.wins),
        volume: parseFloat(row.volume),
      };
    });

    res.json(data);
  } catch (err) {
    console.error('PnL chart error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/account-breakdown
router.get('/account-breakdown', async (req, res) => {
  try {
    const { view = 'all', broker_id } = req.query;
    let query, params;

    if (view === 'broker' && broker_id) {
      query = `
        SELECT a.id, a.account_name, a.account_number, a.balance, a.equity,
               b.display_name as broker_name,
               COALESCE(d.total_pnl, 0) as today_pnl,
               COALESCE(d.total_trades, 0) as today_trades,
               COALESCE(d.win_rate, 0) as today_win_rate
        FROM accounts a
        JOIN brokers b ON b.id = a.broker_id
        LEFT JOIN daily_aggregates d ON d.account_id = a.id AND d.report_date = CURRENT_DATE
        WHERE a.user_id = $1 AND a.broker_id = $2 AND a.is_active = true
        ORDER BY a.account_name`;
      params = [req.user.id, broker_id];
    } else {
      query = `
        SELECT a.id, a.account_name, a.account_number, a.balance, a.equity,
               b.display_name as broker_name,
               COALESCE(d.total_pnl, 0) as today_pnl,
               COALESCE(d.total_trades, 0) as today_trades,
               COALESCE(d.win_rate, 0) as today_win_rate
        FROM accounts a
        JOIN brokers b ON b.id = a.broker_id
        LEFT JOIN daily_aggregates d ON d.account_id = a.id AND d.report_date = CURRENT_DATE
        WHERE a.user_id = $1 AND a.is_active = true
        ORDER BY b.display_name, a.account_name`;
      params = [req.user.id];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Account breakdown error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/widgets
router.get('/widgets', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM dashboard_widgets WHERE user_id = $1 ORDER BY position_y, position_x',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch widgets error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/dashboard/widgets
router.put('/widgets', async (req, res) => {
  try {
    const { widgets } = req.body;
    if (!Array.isArray(widgets)) return res.status(400).json({ error: 'Invalid payload' });

    await pool.query('BEGIN');
    await pool.query('DELETE FROM dashboard_widgets WHERE user_id = $1', [req.user.id]);
    
    for (const w of widgets) {
      await pool.query(
        `INSERT INTO dashboard_widgets (user_id, widget_type, position_x, position_y, width, height, settings)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [req.user.id, w.widget_type, w.position_x || 0, w.position_y || 0, w.width || 2, w.height || 2, w.settings || {}]
      );
    }
    
    await pool.query('COMMIT');
    
    const result = await pool.query('SELECT * FROM dashboard_widgets WHERE user_id = $1', [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Save widgets SQL error detail:', err.message, err.stack);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

module.exports = router;
