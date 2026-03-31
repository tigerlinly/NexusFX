const { pool } = require('../config/database');

class AggregationService {
  constructor() {
    this.running = false;
  }

  start() {
    // Run aggregation every 5 minutes
    this.interval = setInterval(() => this.runAll(), 5 * 60 * 1000);
    // Run immediately on start
    setTimeout(() => this.runAll(), 5000);
    console.log('✅ Aggregation Service started (5min interval)');
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
  }

  async runAll() {
    if (this.running) return;
    this.running = true;
    try {
      await this.computeDailyAggregates();
      await this.computeWeeklyAggregates();
      await this.computeMonthlyAggregates();
    } catch (err) {
      console.error('Aggregation error:', err);
    } finally {
      this.running = false;
    }
  }

  // Compute today's daily aggregates for all accounts
  async computeDailyAggregates() {
    try {
      // Use Bangkok timezone for "today"
      const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })).toISOString().split('T')[0];
      
      const accounts = await pool.query('SELECT id FROM accounts WHERE is_active = true');
      
      for (const account of accounts.rows) {
        const stats = await pool.query(
          `SELECT 
            COALESCE(SUM(pnl), 0) as total_pnl,
            COUNT(*) as total_trades,
            SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
            SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losing_trades,
            COALESCE(SUM(lot_size), 0) as total_volume,
            COALESCE(MAX(pnl), 0) as best_trade,
            COALESCE(MIN(pnl), 0) as worst_trade
           FROM trades
           WHERE account_id = $1 AND status = 'CLOSED'
             AND DATE(closed_at AT TIME ZONE 'Asia/Bangkok') = $2`,
          [account.id, today]
        );

        const s = stats.rows[0];
        const winRate = s.total_trades > 0 
          ? ((s.winning_trades / s.total_trades) * 100).toFixed(2) 
          : 0;

        await pool.query(
          `INSERT INTO daily_aggregates 
            (account_id, report_date, total_pnl, total_trades, winning_trades, losing_trades, 
             win_rate, total_volume, best_trade, worst_trade)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (account_id, report_date) 
           DO UPDATE SET 
             total_pnl = EXCLUDED.total_pnl,
             total_trades = EXCLUDED.total_trades,
             winning_trades = EXCLUDED.winning_trades,
             losing_trades = EXCLUDED.losing_trades,
             win_rate = EXCLUDED.win_rate,
             total_volume = EXCLUDED.total_volume,
             best_trade = EXCLUDED.best_trade,
             worst_trade = EXCLUDED.worst_trade`,
          [account.id, today, s.total_pnl, s.total_trades, s.winning_trades, 
           s.losing_trades, winRate, s.total_volume, s.best_trade, s.worst_trade]
        );
      }
    } catch (err) {
      console.error('Daily aggregation error:', err);
    }
  }

  // Compute weekly aggregates
  async computeWeeklyAggregates() {
    try {
      const accounts = await pool.query('SELECT id FROM accounts WHERE is_active = true');
      
      for (const account of accounts.rows) {
        const stats = await pool.query(
          `SELECT 
            EXTRACT(WEEK FROM closed_at) as week_number,
            EXTRACT(YEAR FROM closed_at) as year,
            COALESCE(SUM(pnl), 0) as total_pnl,
            COUNT(*) as total_trades,
            SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
            COALESCE(SUM(lot_size), 0) as total_volume
           FROM trades
           WHERE account_id = $1 AND status = 'CLOSED'
             AND closed_at >= NOW() - INTERVAL '90 days'
           GROUP BY week_number, year`,
          [account.id]
        );

        for (const s of stats.rows) {
          const winRate = s.total_trades > 0 
            ? ((s.winning_trades / s.total_trades) * 100).toFixed(2)
            : 0;

          await pool.query(
            `INSERT INTO weekly_aggregates 
              (account_id, week_number, year, total_pnl, net_pnl, total_trades, win_rate, total_volume)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (account_id, week_number, year)
             DO UPDATE SET 
               total_pnl = EXCLUDED.total_pnl,
               net_pnl = EXCLUDED.net_pnl,
               total_trades = EXCLUDED.total_trades,
               win_rate = EXCLUDED.win_rate,
               total_volume = EXCLUDED.total_volume`,
            [account.id, s.week_number, s.year, s.total_pnl, s.total_pnl, 
             s.total_trades, winRate, s.total_volume]
          );
        }
      }
    } catch (err) {
      console.error('Weekly aggregation error:', err);
    }
  }

  // Compute monthly aggregates
  async computeMonthlyAggregates() {
    try {
      const accounts = await pool.query('SELECT id FROM accounts WHERE is_active = true');
      
      for (const account of accounts.rows) {
        const stats = await pool.query(
          `SELECT 
            EXTRACT(MONTH FROM closed_at) as month,
            EXTRACT(YEAR FROM closed_at) as year,
            COALESCE(SUM(pnl), 0) as total_pnl,
            COALESCE(SUM(commission + swap), 0) as total_fees,
            COUNT(*) as total_trades,
            SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
            COALESCE(SUM(lot_size), 0) as total_volume,
            COALESCE(MIN(pnl), 0) as drawdown_max
           FROM trades
           WHERE account_id = $1 AND status = 'CLOSED'
             AND closed_at >= NOW() - INTERVAL '365 days'
           GROUP BY month, year`,
          [account.id]
        );

        for (const s of stats.rows) {
          const winRate = s.total_trades > 0 
            ? ((s.winning_trades / s.total_trades) * 100).toFixed(2)
            : 0;

          await pool.query(
            `INSERT INTO monthly_aggregates 
              (account_id, month, year, total_pnl, net_pnl, total_fees, drawdown_max, 
               total_trades, win_rate, total_volume)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (account_id, month, year)
             DO UPDATE SET 
               total_pnl = EXCLUDED.total_pnl,
               net_pnl = EXCLUDED.net_pnl,
               total_fees = EXCLUDED.total_fees,
               drawdown_max = EXCLUDED.drawdown_max,
               total_trades = EXCLUDED.total_trades,
               win_rate = EXCLUDED.win_rate,
               total_volume = EXCLUDED.total_volume`,
            [account.id, s.month, s.year, s.total_pnl, s.total_pnl, s.total_fees,
             s.drawdown_max, s.total_trades, winRate, s.total_volume]
          );
        }
      }
    } catch (err) {
      console.error('Monthly aggregation error:', err);
    }
  }
}

module.exports = AggregationService;
