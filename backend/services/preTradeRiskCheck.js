const { pool } = require('../config/database');

/**
 * Pre-trade risk validation service
 * Checks risk limits BEFORE a trade is placed (not after like RiskEngine)
 */
class PreTradeRiskCheck {

  /**
   * Run all pre-trade checks for a given order
   * @returns {{ allowed: boolean, reason?: string, warnings: string[] }}
   */
  static async validate(userId, accountId, symbol, side, lotSize) {
    const warnings = [];
    
    try {
      // =============================================
      // CHECK 1: Max lot size per trade (hard limit)
      // =============================================
      const MAX_LOT_SIZE = 100;
      if (parseFloat(lotSize) > MAX_LOT_SIZE) {
        return { allowed: false, reason: `Lot size ${lotSize} exceeds maximum allowed (${MAX_LOT_SIZE})` , warnings };
      }
      if (parseFloat(lotSize) <= 0) {
        return { allowed: false, reason: 'Lot size must be greater than 0', warnings };
      }

      // =============================================
      // CHECK 2: Max open positions per account
      // =============================================
      const MAX_OPEN_POSITIONS = 50;
      const openPositions = await pool.query(
        `SELECT COUNT(*) as cnt FROM trades WHERE account_id = $1 AND status = 'OPEN'`,
        [accountId]
      );
      const currentOpen = parseInt(openPositions.rows[0].cnt);
      
      if (currentOpen >= MAX_OPEN_POSITIONS) {
        return { allowed: false, reason: `Account has ${currentOpen} open positions (max: ${MAX_OPEN_POSITIONS}). Close some positions first.`, warnings };
      }
      if (currentOpen >= MAX_OPEN_POSITIONS * 0.8) {
        warnings.push(`Near position limit: ${currentOpen}/${MAX_OPEN_POSITIONS}`);
      }

      // =============================================
      // CHECK 3: Daily drawdown limit (group-level)
      // =============================================
      const groupCheck = await pool.query(`
        SELECT g.group_name, (g.config->>'max_drawdown')::numeric as max_drawdown,
               COALESCE(SUM(t.pnl), 0) as daily_pnl
        FROM group_members gm
        JOIN groups g ON g.id = gm.group_id AND g.is_active = true
        LEFT JOIN accounts a ON a.user_id = gm.user_id
        LEFT JOIN trades t ON t.account_id = a.id 
          AND DATE(t.created_at) = CURRENT_DATE
          AND t.status IN ('OPEN', 'CLOSED')
        WHERE gm.user_id = $1
          AND (g.config->>'max_drawdown') IS NOT NULL
          AND (g.config->>'max_drawdown')::numeric > 0
        GROUP BY g.group_name, g.config
      `, [userId]);

      for (const group of groupCheck.rows) {
        const dailyPnl = parseFloat(group.daily_pnl);
        const maxDrawdown = parseFloat(group.max_drawdown);
        
        if (dailyPnl <= -maxDrawdown) {
          return { 
            allowed: false, 
            reason: `Trading blocked: Daily loss ($${Math.abs(dailyPnl).toFixed(2)}) exceeds group "${group.group_name}" limit ($${maxDrawdown.toFixed(2)})`,
            warnings 
          };
        }
        if (dailyPnl <= -maxDrawdown * 0.7) {
          warnings.push(`Warning: Daily loss is ${((Math.abs(dailyPnl) / maxDrawdown) * 100).toFixed(0)}% of group "${group.group_name}" limit`);
        }
      }

      // =============================================
      // CHECK 4: Max total exposure per user (lot-based)
      // =============================================
      const MAX_TOTAL_EXPOSURE = 500; // lots
      const exposureResult = await pool.query(`
        SELECT COALESCE(SUM(t.lot_size), 0) as total_exposure
        FROM trades t
        JOIN accounts a ON a.id = t.account_id
        WHERE a.user_id = $1 AND t.status = 'OPEN'
      `, [userId]);

      const currentExposure = parseFloat(exposureResult.rows[0].total_exposure);
      const newExposure = currentExposure + parseFloat(lotSize);

      if (newExposure > MAX_TOTAL_EXPOSURE) {
        return { 
          allowed: false, 
          reason: `Total exposure would be ${newExposure.toFixed(2)} lots (max: ${MAX_TOTAL_EXPOSURE}). Reduce lot size or close positions.`, 
          warnings 
        };
      }
      if (newExposure > MAX_TOTAL_EXPOSURE * 0.8) {
        warnings.push(`High exposure: ${newExposure.toFixed(2)}/${MAX_TOTAL_EXPOSURE} lots`);
      }

      // =============================================
      // CHECK 5: Duplicate detection (same symbol+side within 5 seconds)
      // =============================================
      const recentDuplicate = await pool.query(`
        SELECT COUNT(*) as cnt FROM orders 
        WHERE account_id = $1 AND symbol = $2 AND side = $3 
          AND created_at >= NOW() - INTERVAL '5 seconds'
          AND status = 'PENDING'
      `, [accountId, symbol.toUpperCase(), side.toUpperCase()]);

      if (parseInt(recentDuplicate.rows[0].cnt) > 0) {
        return { 
          allowed: false, 
          reason: 'Duplicate order detected. Same symbol and side was submitted within 5 seconds.', 
          warnings 
        };
      }

      // =============================================
      // CHECK 6: Kill switch active check
      // =============================================
      const killSwitchCheck = await pool.query(`
        SELECT 1 FROM audit_logs 
        WHERE action = 'admin.kill_switch_activated' 
          AND created_at >= NOW() - INTERVAL '24 hours'
        ORDER BY created_at DESC LIMIT 1
      `);

      if (killSwitchCheck.rows.length > 0) {
        return { 
          allowed: false, 
          reason: 'Trading is temporarily suspended by system administrator (Kill Switch active).', 
          warnings 
        };
      }

      // All checks passed
      return { allowed: true, warnings };

    } catch (err) {
      console.error('[PreTradeRiskCheck] Error:', err);
      // Fail-closed: block trade when risk check fails (safer for financial applications)
      return { allowed: false, reason: 'Risk check system error — trade blocked for safety. Please try again.', warnings };
    }
  }
}

module.exports = PreTradeRiskCheck;
