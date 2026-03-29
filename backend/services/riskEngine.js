const { pool } = require('../config/database');
const LineNotify = require('./lineNotify');

class RiskEngine {
  constructor(io) {
    this.io = io;
    this.running = false;
    this.checkIntervalMs = 15000; // Check every 15 seconds
  }

  start() {
    this.interval = setInterval(() => this.runAll(), this.checkIntervalMs);
    console.log('✅ Risk Engine started (15s interval) — Individual + Group-level checks');
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
  }

  async runAll() {
    if (this.running) return;
    this.running = true;

    try {
      await this.enforceGroupRiskLimits();
      await this.enforceGroupExposureLimits();
    } catch (err) {
      console.error('❌ [RiskEngine] Error:', err);
    } finally {
      this.running = false;
    }
  }

  // =============================================
  // Level 2: Group Auto Stop-Loss (max_drawdown per user)
  // =============================================
  async enforceGroupRiskLimits() {
    try {
      // Get all Groups that have a max_drawdown configured
      const groupsResult = await pool.query(`
        SELECT g.id, g.group_name, g.lead_user_id,
               (g.config->>'max_drawdown')::numeric as max_drawdown 
        FROM groups g 
        WHERE g.is_active = true
          AND (g.config->>'max_drawdown') IS NOT NULL 
          AND (g.config->>'max_drawdown')::numeric > 0
      `);
      
      for (const group of groupsResult.rows) {
        // Find users in this group and compute their today's PnL
        const usersResult = await pool.query(`
          SELECT gm.user_id, u.display_name, COALESCE(SUM(t.pnl), 0) as daily_pnl
          FROM group_members gm
          JOIN users u ON u.id = gm.user_id
          LEFT JOIN accounts a ON a.user_id = gm.user_id
          LEFT JOIN trades t ON t.account_id = a.id 
            AND DATE(t.created_at) = CURRENT_DATE
            AND t.status IN ('OPEN', 'CLOSED')
          WHERE gm.group_id = $1
          GROUP BY gm.user_id, u.display_name
        `, [group.id]);

        for (const user of usersResult.rows) {
          const userPnL = parseFloat(user.daily_pnl);
          
          // Drawdown logic: if userPnL is less than -max_drawdown
          if (userPnL <= -Math.abs(group.max_drawdown)) {
            console.log(`⚠️ [RiskEngine] User ${user.user_id} (${user.display_name}) in Group '${group.group_name}' hit Stop-Loss limit (${userPnL} / -${group.max_drawdown})`);
            
            // 1. Force close all OPEN trades of this user
            const openTrades = await pool.query(`
              SELECT t.id 
              FROM trades t
              JOIN accounts a ON a.id = t.account_id
              WHERE a.user_id = $1 AND t.status = 'OPEN'
            `, [user.user_id]);

            for (const trade of openTrades.rows) {
              await pool.query(`
                UPDATE trades 
                SET status = 'CLOSED', closed_at = NOW()
                WHERE id = $1
              `, [trade.id]);
              console.log(`   [RiskEngine] Emergency closed trade ${trade.id}`);
            }

            // 2. Stop all user's active bots
            await pool.query(`
              UPDATE trading_bots
              SET is_active = false, status = 'STOPPED'
              WHERE user_id = $1 AND is_active = true
            `, [user.user_id]);

            // 3. Cancel pending orders
            await pool.query(`
              UPDATE orders SET status = 'CANCELLED', cancelled_at = NOW()
              WHERE account_id IN (SELECT id FROM accounts WHERE user_id = $1) AND status = 'PENDING'
            `, [user.user_id]);

            // 4. Log audit event
            await pool.query(
              `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
               VALUES ($1, 'RISK_AUTO_STOPLOSS', 'GROUP', $2, $3)`,
              [user.user_id, group.id, JSON.stringify({
                group_name: group.group_name,
                daily_pnl: userPnL,
                max_drawdown: group.max_drawdown,
                trades_closed: openTrades.rows.length
              })]
            );

            // 5. 🔔 Notify user via Line
            LineNotify.notifyRiskViolation(
              user.user_id, group.group_name, userPnL, group.max_drawdown
            ).catch(err => console.warn('[LineNotify] Risk notify failed:', err.message));

            // 6. Notify group leader
            LineNotify.notifyRiskViolation(
              group.lead_user_id, group.group_name, userPnL, group.max_drawdown
            ).catch(err => console.warn('[LineNotify] Leader notify failed:', err.message));

            // 7. Emit socket event
            if (this.io) {
              this.io.to(`user:${user.user_id}`).emit('risk_violation', {
                type: 'AUTO_STOPLOSS',
                group: group.group_name,
                pnl: userPnL,
                limit: group.max_drawdown
              });
            }

            console.log(`   [RiskEngine] All bots stopped, orders cancelled for User ${user.user_id}`);
          }
        }
      }
    } catch (err) {
      console.error('❌ [RiskEngine] Group stop-loss error:', err);
    }
  }

  // =============================================
  // Level 3: Group-level Total Exposure Check
  // =============================================
  async enforceGroupExposureLimits() {
    try {
      // Get groups with max_exposure configured
      const groupsResult = await pool.query(`
        SELECT g.id, g.group_name, g.lead_user_id,
               (g.config->>'max_exposure')::numeric as max_exposure
        FROM groups g
        WHERE g.is_active = true
          AND (g.config->>'max_exposure') IS NOT NULL
          AND (g.config->>'max_exposure')::numeric > 0
      `);

      for (const group of groupsResult.rows) {
        // Calculate total open position volume for the entire group
        const exposureResult = await pool.query(`
          SELECT COALESCE(SUM(t.lot_size), 0) as total_exposure,
                 COUNT(t.id) as open_positions
          FROM trades t
          JOIN accounts a ON a.id = t.account_id
          JOIN group_members gm ON gm.user_id = a.user_id
          WHERE gm.group_id = $1 AND t.status = 'OPEN'
        `, [group.id]);

        const totalExposure = parseFloat(exposureResult.rows[0].total_exposure);
        const openPositions = parseInt(exposureResult.rows[0].open_positions);

        if (totalExposure > group.max_exposure) {
          console.log(`⚠️ [RiskEngine] Group '${group.group_name}' exceeded exposure limit! (${totalExposure} / ${group.max_exposure} lots)`);

          // Notify group leader
          LineNotify.sendAlert(
            group.lead_user_id,
            `⚠️ กลุ่ม "${group.group_name}" มีความเสี่ยงสูง!\nExposure: ${totalExposure.toFixed(2)} lots (เกินขีดจำกัด ${group.max_exposure} lots)\nOpen Positions: ${openPositions}\nโปรดตรวจสอบและลดขนาดไม้`
          ).catch(err => console.warn('[LineNotify] Exposure notify failed:', err.message));

          // Log
          await pool.query(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
             VALUES ($1, 'RISK_EXPOSURE_WARNING', 'GROUP', $2, $3)`,
            [group.lead_user_id, group.id, JSON.stringify({
              total_exposure: totalExposure,
              max_exposure: group.max_exposure,
              open_positions: openPositions
            })]
          );

          // Emit socket event to leader
          if (this.io) {
            this.io.to(`user:${group.lead_user_id}`).emit('risk_warning', {
              type: 'EXPOSURE_LIMIT',
              group: group.group_name,
              current: totalExposure,
              limit: group.max_exposure
            });
          }
        }
      }
    } catch (err) {
      console.error('❌ [RiskEngine] Group exposure check error:', err);
    }
  }
}

module.exports = RiskEngine;
