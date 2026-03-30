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
// =============================================
// HEATMAP DATA (Symbol-level exposure)
// =============================================
/**
 * @swagger
 * /dashboard/heatmap:
 *   get:
 *     summary: Get symbol-level exposure heatmap data
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Heatmap data by symbol
 */
router.get('/heatmap', async (req, res) => {
  try {
    const { view = 'all', broker_id, account_id, days = 30 } = req.query;
    const accountIds = await getFilteredAccountIds(req.user.id, view, broker_id, account_id);

    if (accountIds.length === 0) return res.json({ symbols: [], accounts: [] });

    // 1. Symbol-level aggregation (open + recent closed)
    const symbolData = await pool.query(`
      SELECT 
        t.symbol,
        COUNT(*) as trade_count,
        SUM(CASE WHEN t.status = 'OPEN' THEN t.lot_size ELSE 0 END) as open_lots,
        SUM(t.lot_size) as total_lots,
        COALESCE(SUM(t.pnl), 0) as total_pnl,
        SUM(CASE WHEN t.side = 'BUY' THEN 1 ELSE 0 END) as buy_count,
        SUM(CASE WHEN t.side = 'SELL' THEN 1 ELSE 0 END) as sell_count,
        SUM(CASE WHEN t.pnl > 0 THEN 1 ELSE 0 END) as win_count,
        SUM(CASE WHEN t.pnl < 0 THEN 1 ELSE 0 END) as loss_count,
        MAX(t.lot_size) as max_lot
      FROM trades t
      WHERE t.account_id = ANY($1) 
        AND (t.status = 'OPEN' OR t.closed_at >= NOW() - INTERVAL '1 day' * $2)
      GROUP BY t.symbol
      ORDER BY SUM(t.lot_size) DESC
    `, [accountIds, parseInt(days)]);

    // 2. Account-level exposure
    const accountData = await pool.query(`
      SELECT 
        a.id, a.account_name, b.display_name as broker_name,
        COUNT(t.id) as open_trades,
        COALESCE(SUM(t.lot_size), 0) as total_exposure,
        COALESCE(SUM(t.pnl), 0) as floating_pnl
      FROM accounts a
      JOIN brokers b ON b.id = a.broker_id
      LEFT JOIN trades t ON t.account_id = a.id AND t.status = 'OPEN'
      WHERE a.id = ANY($1)
      GROUP BY a.id, a.account_name, b.display_name
      ORDER BY COALESCE(SUM(t.lot_size), 0) DESC
    `, [accountIds]);

    // 3. Hourly distribution (when do trades happen)
    const hourlyDist = await pool.query(`
      SELECT 
        EXTRACT(HOUR FROM t.opened_at) as hour,
        COUNT(*) as trade_count,
        COALESCE(SUM(t.pnl), 0) as total_pnl
      FROM trades t
      WHERE t.account_id = ANY($1) 
        AND t.opened_at >= NOW() - INTERVAL '1 day' * $2
      GROUP BY EXTRACT(HOUR FROM t.opened_at)
      ORDER BY hour
    `, [accountIds, parseInt(days)]);

    res.json({
      symbols: symbolData.rows.map(s => ({
        symbol: s.symbol,
        trade_count: parseInt(s.trade_count),
        open_lots: parseFloat(s.open_lots),
        total_lots: parseFloat(s.total_lots),
        total_pnl: parseFloat(s.total_pnl),
        buy_count: parseInt(s.buy_count),
        sell_count: parseInt(s.sell_count),
        win_count: parseInt(s.win_count),
        loss_count: parseInt(s.loss_count),
        max_lot: parseFloat(s.max_lot),
        win_rate: parseInt(s.trade_count) > 0 
          ? ((parseInt(s.win_count) / parseInt(s.trade_count)) * 100).toFixed(1) 
          : '0.0',
      })),
      accounts: accountData.rows.map(a => ({
        id: a.id,
        account_name: a.account_name,
        broker_name: a.broker_name,
        open_trades: parseInt(a.open_trades),
        total_exposure: parseFloat(a.total_exposure),
        floating_pnl: parseFloat(a.floating_pnl),
      })),
      hourly: Array.from({ length: 24 }, (_, h) => {
        const found = hourlyDist.rows.find(r => parseInt(r.hour) === h);
        return {
          hour: h,
          trade_count: found ? parseInt(found.trade_count) : 0,
          pnl: found ? parseFloat(found.total_pnl) : 0,
        };
      }),
    });
  } catch (err) {
    console.error('Heatmap error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
