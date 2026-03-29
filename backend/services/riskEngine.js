const { pool } = require('../config/database');

class RiskEngine {
  constructor() {
    this.running = false;
    this.checkIntervalMs = 15000; // Check every 15 seconds
  }

  start() {
    this.interval = setInterval(() => this.enforceGroupRiskLimits(), this.checkIntervalMs);
    console.log('✅ Automated Risk Engine started (15s interval)');
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
  }

  async enforceGroupRiskLimits() {
    if (this.running) return;
    this.running = true;

    try {
      // Get all Groups that have a max_drawdown configured
      const groupsResult = await pool.query(`
        SELECT g.id, g.group_name, (g.config->>'max_drawdown')::numeric as max_drawdown 
        FROM groups g 
        WHERE (g.config->>'max_drawdown') IS NOT NULL AND (g.config->>'max_drawdown')::numeric > 0
      `);
      
      const groups = groupsResult.rows;

      for (const group of groups) {
        // Find users in this group, and compute their today's PnL
        const usersResult = await pool.query(`
          SELECT gm.user_id, COALESCE(SUM(t.pnl), 0) as daily_pnl
          FROM group_members gm
          LEFT JOIN accounts a ON a.user_id = gm.user_id
          LEFT JOIN trades t ON t.account_id = a.id AND DATE(t.created_at) = CURRENT_DATE
          WHERE gm.group_id = $1 AND gm.role = 'MEMBER'
          GROUP BY gm.user_id
        `, [group.id]);

        for (const user of usersResult.rows) {
          const userPnL = parseFloat(user.daily_pnl);
          
          // Drawdown logic: if userPnL is less than -max_drawdown
          if (userPnL <= -Math.abs(group.max_drawdown)) {
            console.log(`⚠️ [RiskEngine] User ${user.user_id} in Group '${group.group_name}' hit Stop-Loss limit (${userPnL} / -${group.max_drawdown})`);
            
            // 1. Force close all OPEN trades of this user
            const openTrades = await pool.query(`
              SELECT t.id 
              FROM trades t
              JOIN accounts a ON a.id = t.account_id
              WHERE a.user_id = $1 AND t.status = 'OPEN'
            `, [user.user_id]);

            for(const trade of openTrades.rows) {
              await pool.query(`
                UPDATE trades 
                SET status = 'CLOSED', pnl = 0, close_price = open_price, updated_at = NOW() 
                WHERE id = $1
              `, [trade.id]);
              console.log(`   [RiskEngine] Emergency closed trade ${trade.id}`);
            }

            // 2. Stop all user's active bots to prevent them from opening more positions today
            await pool.query(`
              UPDATE trading_bots
              SET is_active = false, status = 'STOPPED'
              WHERE account_id IN (SELECT id FROM accounts WHERE user_id = $1)
            `, [user.user_id]);

            // Add an alert/event indicating standard rules were enforced
            console.log(`   [RiskEngine] All active bots stopped for User ${user.user_id} due to Risk Violation.`);
          }
        }
      }

    } catch (err) {
      console.error('❌ [RiskEngine] Enforce limits error:', err);
    } finally {
      this.running = false;
    }
  }
}

module.exports = RiskEngine;
