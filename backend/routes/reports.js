const express = require('express');
const { pool } = require('../config/database');
const { authMiddleware, requirePermission } = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);

// =============================================
// WEEKLY / MONTHLY AGGREGATES
// =============================================

// GET /api/reports/weekly — weekly performance
router.get('/weekly', requirePermission('report.view'), async (req, res) => {
  try {
    const { weeks = 12 } = req.query;
    const result = await pool.query(
      `SELECT wa.*, a.account_name, a.account_number, b.display_name as broker_name
       FROM weekly_aggregates wa
       JOIN accounts a ON a.id = wa.account_id
       JOIN brokers b ON b.id = a.broker_id
       WHERE a.user_id = $1
       ORDER BY wa.year DESC, wa.week_number DESC
       LIMIT $2`,
      [req.user.id, parseInt(weeks)]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Weekly report error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/monthly — monthly performance
router.get('/monthly', requirePermission('report.view'), async (req, res) => {
  try {
    const { months = 12 } = req.query;
    const result = await pool.query(
      `SELECT ma.*, a.account_name, a.account_number, b.display_name as broker_name
       FROM monthly_aggregates ma
       JOIN accounts a ON a.id = ma.account_id
       JOIN brokers b ON b.id = a.broker_id
       WHERE a.user_id = $1
       ORDER BY ma.year DESC, ma.month DESC
       LIMIT $2`,
      [req.user.id, parseInt(months)]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Monthly report error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/analytics — advanced analytics
router.get('/analytics', requirePermission('report.view'), async (req, res) => {
  try {
    const { period = '30' } = req.query;

    // Symbol performance
    const symbolPerf = await pool.query(
      `SELECT t.symbol,
              COUNT(*) as total_trades,
              SUM(CASE WHEN t.pnl > 0 THEN 1 ELSE 0 END) as wins,
              SUM(CASE WHEN t.pnl < 0 THEN 1 ELSE 0 END) as losses,
              COALESCE(SUM(t.pnl), 0) as total_pnl,
              COALESCE(AVG(t.pnl), 0) as avg_pnl,
              COALESCE(SUM(t.lot_size), 0) as total_volume
       FROM trades t
       JOIN accounts a ON a.id = t.account_id
       WHERE a.user_id = $1 AND t.status = 'CLOSED'
         AND t.closed_at >= NOW() - INTERVAL '1 day' * $2
       GROUP BY t.symbol
       ORDER BY total_pnl DESC`,
      [req.user.id, parseInt(period)]
    );

    // Hourly distribution
    const hourlyDist = await pool.query(
      `SELECT EXTRACT(HOUR FROM t.opened_at) as hour,
              COUNT(*) as trade_count,
              COALESCE(SUM(t.pnl), 0) as total_pnl,
              SUM(CASE WHEN t.pnl > 0 THEN 1 ELSE 0 END) as wins
       FROM trades t
       JOIN accounts a ON a.id = t.account_id
       WHERE a.user_id = $1 AND t.status = 'CLOSED'
         AND t.closed_at >= NOW() - INTERVAL '1 day' * $2
       GROUP BY hour
       ORDER BY hour`,
      [req.user.id, parseInt(period)]
    );

    // Day-of-week distribution
    const dayOfWeekDist = await pool.query(
      `SELECT EXTRACT(DOW FROM t.opened_at) as day_num,
              COUNT(*) as trade_count,
              COALESCE(SUM(t.pnl), 0) as total_pnl,
              SUM(CASE WHEN t.pnl > 0 THEN 1 ELSE 0 END) as wins
       FROM trades t
       JOIN accounts a ON a.id = t.account_id
       WHERE a.user_id = $1 AND t.status = 'CLOSED'
         AND t.closed_at >= NOW() - INTERVAL '1 day' * $2
       GROUP BY day_num
       ORDER BY day_num`,
      [req.user.id, parseInt(period)]
    );

    // Risk metrics
    const riskMetrics = await pool.query(
      `SELECT 
        COALESCE(MAX(t.pnl), 0) as best_trade,
        COALESCE(MIN(t.pnl), 0) as worst_trade,
        COALESCE(AVG(CASE WHEN t.pnl > 0 THEN t.pnl END), 0) as avg_win,
        COALESCE(AVG(CASE WHEN t.pnl < 0 THEN t.pnl END), 0) as avg_loss,
        COALESCE(AVG(t.lot_size), 0) as avg_lot_size,
        COUNT(*) as total_trades,
        SUM(CASE WHEN t.pnl > 0 THEN 1 ELSE 0 END) as winning_trades
       FROM trades t
       JOIN accounts a ON a.id = t.account_id
       WHERE a.user_id = $1 AND t.status = 'CLOSED'
         AND t.closed_at >= NOW() - INTERVAL '1 day' * $2`,
      [req.user.id, parseInt(period)]
    );

    const rm = riskMetrics.rows[0];
    const avgWin = parseFloat(rm.avg_win) || 0;
    const avgLoss = Math.abs(parseFloat(rm.avg_loss)) || 1;
    const riskRewardRatio = (avgWin / avgLoss).toFixed(2);
    const winRate = rm.total_trades > 0 ? ((rm.winning_trades / rm.total_trades) * 100).toFixed(1) : '0.0';

    res.json({
      symbol_performance: symbolPerf.rows,
      hourly_distribution: hourlyDist.rows,
      day_of_week: dayOfWeekDist.rows,
      risk_metrics: {
        ...rm,
        risk_reward_ratio: riskRewardRatio,
        win_rate: winRate,
        profit_factor: avgLoss > 0 ? ((avgWin * parseFloat(rm.winning_trades || 0)) / (avgLoss * (parseFloat(rm.total_trades || 0) - parseFloat(rm.winning_trades || 0)) || 1)).toFixed(2) : '0.00'
      }
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// REPORT EXPORT
// =============================================

// POST /api/reports/export — request export
router.post('/export', requirePermission('report.export'), async (req, res) => {
  try {
    const { report_type, format = 'CSV', params = {} } = req.body;
    if (!report_type) {
      return res.status(400).json({ error: 'report_type required' });
    }

    const result = await pool.query(
      `INSERT INTO report_exports (requested_by, report_type, format, params, status)
       VALUES ($1, $2, $3, $4, 'PROCESSING') RETURNING *`,
      [req.user.id, report_type, format, JSON.stringify(params)]
    );

    // Generate the CSV data immediately (simplified)
    let csvData = '';
    const exportId = result.rows[0].id;

    if (report_type === 'TRADES') {
      const trades = await pool.query(
        `SELECT t.ticket, t.symbol, t.side, t.lot_size, t.entry_price, t.exit_price,
                t.pnl, t.commission, t.swap, t.opened_at, t.closed_at, t.status,
                a.account_name, b.display_name as broker_name
         FROM trades t
         JOIN accounts a ON a.id = t.account_id
         JOIN brokers b ON b.id = a.broker_id
         WHERE a.user_id = $1
         ORDER BY t.closed_at DESC`,
        [req.user.id]
      );

      csvData = 'Ticket,Symbol,Side,Lots,Entry,Exit,PnL,Commission,Swap,Opened,Closed,Status,Account,Broker\n';
      trades.rows.forEach(t => {
        csvData += `${t.ticket},${t.symbol},${t.side},${t.lot_size},${t.entry_price},${t.exit_price},${t.pnl},${t.commission},${t.swap},${t.opened_at},${t.closed_at},${t.status},${t.account_name},${t.broker_name}\n`;
      });
    } else if (report_type === 'DAILY') {
      const daily = await pool.query(
        `SELECT da.report_date, da.total_pnl, da.total_trades, da.winning_trades,
                da.losing_trades, da.win_rate, da.total_volume, a.account_name
         FROM daily_aggregates da
         JOIN accounts a ON a.id = da.account_id
         WHERE a.user_id = $1
         ORDER BY da.report_date DESC`,
        [req.user.id]
      );

      csvData = 'Date,PnL,Trades,Wins,Losses,WinRate,Volume,Account\n';
      daily.rows.forEach(d => {
        csvData += `${d.report_date},${d.total_pnl},${d.total_trades},${d.winning_trades},${d.losing_trades},${d.win_rate},${d.total_volume},${d.account_name}\n`;
      });
    }

    // Store as data URL (in production, upload to S3)
    const fileUrl = `data:text/csv;base64,${Buffer.from(csvData).toString('base64')}`;
    
    await pool.query(
      `UPDATE report_exports SET status = 'COMPLETED', file_url = $1, completed_at = NOW() WHERE id = $2`,
      [fileUrl, exportId]
    );

    res.status(201).json({ ...result.rows[0], file_url: fileUrl, status: 'COMPLETED' });
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/exports — export history
router.get('/exports', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM report_exports WHERE requested_by = $1 ORDER BY created_at DESC LIMIT 20`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Export history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
