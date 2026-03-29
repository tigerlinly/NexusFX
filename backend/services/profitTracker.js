/**
 * Profit Tracker Service
 * Monitors daily PnL and triggers notifications when targets are reached
 */
const { pool } = require('../config/database');

class ProfitTracker {
  constructor(io) {
    this.io = io;
    this.checkInterval = null;
  }

  start() {
    // Check every 30 seconds
    this.checkInterval = setInterval(() => this.checkAllTargets(), 30000);
    console.log('✅ Profit Tracker started (30s interval)');
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  async checkAllTargets() {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Get all active targets
      const targets = await pool.query(
        `SELECT dt.*, u.username
         FROM daily_targets dt
         JOIN users u ON u.id = dt.user_id
         WHERE dt.is_active = true`
      );

      for (const target of targets.rows) {
        await this.checkTarget(target, today);
      }
    } catch (err) {
      console.error('Profit tracker error:', err.message);
    }
  }

  async checkTarget(target, today) {
    try {
      // Check if already reached today
      const existing = await pool.query(
        'SELECT id FROM target_history WHERE daily_target_id = $1 AND reached_date = $2',
        [target.id, today]
      );
      if (existing.rows.length > 0) return;

      // Calculate current PnL
      let currentPnl;
      if (target.account_id) {
        const r = await pool.query(
          `SELECT COALESCE(SUM(pnl), 0) as pnl FROM trades 
           WHERE account_id = $1 AND DATE(closed_at) = $2 AND status = 'CLOSED'`,
          [target.account_id, today]
        );
        currentPnl = parseFloat(r.rows[0].pnl);
      } else {
        const accs = await pool.query(
          'SELECT id FROM accounts WHERE user_id = $1 AND is_active = true',
          [target.user_id]
        );
        const accIds = accs.rows.map(r => r.id);
        if (accIds.length === 0) return;

        const r = await pool.query(
          `SELECT COALESCE(SUM(pnl), 0) as pnl FROM trades 
           WHERE account_id = ANY($1) AND DATE(closed_at) = $2 AND status = 'CLOSED'`,
          [accIds, today]
        );
        currentPnl = parseFloat(r.rows[0].pnl);
      }

      // Check if target reached
      if (currentPnl >= parseFloat(target.target_amount)) {
        // Emit notification
        this.io.to(`user:${target.user_id}`).emit('target:reached', {
          targetId: target.id,
          targetAmount: parseFloat(target.target_amount),
          currentPnl,
          accountId: target.account_id,
          action: target.action_on_reach,
        });

        console.log(`🎯 Target reached for user ${target.username}: $${currentPnl} / $${target.target_amount}`);
      }

      // Always emit progress
      const progress = parseFloat(target.target_amount) > 0 ?
        Math.min(100, (currentPnl / parseFloat(target.target_amount)) * 100) : 0;

      this.io.to(`user:${target.user_id}`).emit('target:progress', {
        targetId: target.id,
        currentPnl,
        targetAmount: parseFloat(target.target_amount),
        progress: Math.round(progress * 10) / 10,
      });
    } catch (err) {
      console.error(`Profit tracker check error (target ${target.id}):`, err.message);
    }
  }
}

module.exports = ProfitTracker;
