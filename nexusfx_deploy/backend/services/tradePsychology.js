const { pool } = require('../config/database');

/**
 * Rule-based Trade Psychology Analysis Engine
 * Detects behavioral patterns in trading data without AI/ML
 */
class TradePsychologyAnalyzer {

  /**
   * Run full analysis for a user
   * @returns {{ overall_score, patterns, recommendations, metrics }}
   */
  static async analyze(userId, periodDays = 30) {
    try {
      // Get user's accounts
      const accounts = await pool.query(
        'SELECT id FROM accounts WHERE user_id = $1 AND is_active = true',
        [userId]
      );
      const accountIds = accounts.rows.map(a => a.id);
      if (accountIds.length === 0) {
        return { overall_score: 0, patterns: [], recommendations: [], metrics: {} };
      }

      // Fetch trades for analysis
      const trades = await pool.query(`
        SELECT t.*, a.account_name
        FROM trades t
        JOIN accounts a ON a.id = t.account_id
        WHERE t.account_id = ANY($1)
          AND t.created_at >= NOW() - INTERVAL '1 day' * $2
          AND t.status = 'CLOSED'
        ORDER BY t.opened_at
      `, [accountIds, periodDays]);

      const allTrades = trades.rows;
      if (allTrades.length === 0) {
        return { 
          overall_score: 50, 
          patterns: [{ type: 'info', name: 'ข้อมูลไม่เพียงพอ', description: 'ไม่มีเทรดที่ปิดแล้วในช่วงเวลานี้', severity: 'low' }],
          recommendations: ['เริ่มเทรดเพื่อให้ระบบวิเคราะห์พฤติกรรมได้'],
          metrics: {},
        };
      }

      const patterns = [];
      const recommendations = [];
      let score = 100;

      // =============================================
      // METRIC CALCULATIONS
      // =============================================
      const totalTrades = allTrades.length;
      const winTrades = allTrades.filter(t => parseFloat(t.pnl) > 0);
      const lossTrades = allTrades.filter(t => parseFloat(t.pnl) < 0);
      const winRate = (winTrades.length / totalTrades) * 100;

      const avgWin = winTrades.length > 0 
        ? winTrades.reduce((s, t) => s + parseFloat(t.pnl), 0) / winTrades.length : 0;
      const avgLoss = lossTrades.length > 0
        ? lossTrades.reduce((s, t) => s + Math.abs(parseFloat(t.pnl)), 0) / lossTrades.length : 0;
      
      const profitFactor = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;
      
      const totalPnl = allTrades.reduce((s, t) => s + parseFloat(t.pnl), 0);
      const avgPnl = totalPnl / totalTrades;

      // Hold duration in minutes
      const holdDurations = allTrades
        .filter(t => t.opened_at && t.closed_at)
        .map(t => (new Date(t.closed_at) - new Date(t.opened_at)) / 60000);
      const avgHoldMinutes = holdDurations.length > 0 
        ? holdDurations.reduce((s, d) => s + d, 0) / holdDurations.length : 0;

      // Trading hours
      const tradingHours = allTrades.map(t => new Date(t.opened_at).getHours());

      const metrics = {
        total_trades: totalTrades,
        win_rate: parseFloat(winRate.toFixed(1)),
        avg_win: parseFloat(avgWin.toFixed(2)),
        avg_loss: parseFloat(avgLoss.toFixed(2)),
        profit_factor: parseFloat(Math.min(profitFactor, 99).toFixed(2)),
        total_pnl: parseFloat(totalPnl.toFixed(2)),
        avg_hold_minutes: parseFloat(avgHoldMinutes.toFixed(0)),
        period_days: periodDays,
      };

      // =============================================
      // PATTERN 1: OVERTRADING
      // =============================================
      const tradesPerDay = totalTrades / periodDays;
      if (tradesPerDay > 15) {
        patterns.push({
          type: 'warning', name: 'Overtrading (เทรดมากเกินไป)',
          description: `เฉลี่ย ${tradesPerDay.toFixed(1)} เทรด/วัน — มากกว่า 15 เทรด/วัน อาจทำให้เสียค่า commission โดยไม่จำเป็น`,
          severity: 'high',
        });
        score -= 15;
        recommendations.push('ลดจำนวนเทรดต่อวัน เน้นคุณภาพมากกว่าปริมาณ');
      } else if (tradesPerDay > 10) {
        patterns.push({
          type: 'caution', name: 'เทรดค่อนข้างถี่',
          description: `เฉลี่ย ${tradesPerDay.toFixed(1)} เทรด/วัน`,
          severity: 'medium',
        });
        score -= 5;
      }

      // =============================================
      // PATTERN 2: REVENGE TRADING
      // =============================================
      let revengeSessions = 0;
      const sortedTrades = [...allTrades].sort((a, b) => new Date(a.opened_at) - new Date(b.opened_at));
      
      for (let i = 1; i < sortedTrades.length; i++) {
        const prev = sortedTrades[i - 1];
        const curr = sortedTrades[i];
        
        if (parseFloat(prev.pnl) < 0) {
          const timeDiff = (new Date(curr.opened_at) - new Date(prev.closed_at || prev.opened_at)) / 60000;
          const lotIncrease = parseFloat(curr.lot_size) > parseFloat(prev.lot_size) * 1.5;
          
          if (timeDiff < 5 && lotIncrease) {
            revengeSessions++;
          }
        }
      }

      if (revengeSessions >= 3) {
        patterns.push({
          type: 'danger', name: 'Revenge Trading (เทรดแก้แค้น)',
          description: `ตรวจพบ ${revengeSessions} ครั้งที่เปิดไม้ใหญ่ขึ้นทันทีหลังขาดทุน (ภายใน 5 นาที, lot +50%)`,
          severity: 'critical',
        });
        score -= 20;
        recommendations.push('หลังจากเทรดขาดทุน ให้หยุดพัก 15-30 นาทีก่อนเปิดไม้ใหม่');
      } else if (revengeSessions >= 1) {
        patterns.push({
          type: 'caution', name: 'สัญญาณ Revenge Trading เล็กน้อย',
          description: `ตรวจพบ ${revengeSessions} ครั้ง`,
          severity: 'medium',
        });
        score -= 5;
      }

      // =============================================
      // PATTERN 3: HOLD TOO LONG / TOO SHORT
      // =============================================
      const quickCloses = holdDurations.filter(d => d < 2).length;
      const longHolds = holdDurations.filter(d => d > 480).length; // > 8 hours

      if (quickCloses > totalTrades * 0.3) {
        patterns.push({
          type: 'warning', name: 'ปิดไม้เร็วเกินไป (Scalping)',
          description: `${((quickCloses / totalTrades) * 100).toFixed(0)}% ของเทรดปิดภายใน 2 นาที — อาจพลาดกำไรที่ควรจะได้`,
          severity: 'medium',
        });
        score -= 8;
        recommendations.push('ลองตั้ง Take Profit ให้ไกลขึ้น หรือใช้ Trailing Stop');
      }

      if (longHolds > totalTrades * 0.2) {
        patterns.push({
          type: 'warning', name: 'ถือไม้นานเกินไป',
          description: `${((longHolds / totalTrades) * 100).toFixed(0)}% ของเทรดถือนานกว่า 8 ชั่วโมง`,
          severity: 'medium',
        });
        score -= 8;
        recommendations.push('ตั้ง Stop Loss เพื่อจำกัดเวลาถือไม้');
      }

      // =============================================
      // PATTERN 4: NO STOP LOSS
      // =============================================
      const noSL = allTrades.filter(t => !t.stop_loss || parseFloat(t.stop_loss) === 0).length;
      if (noSL > totalTrades * 0.5) {
        patterns.push({
          type: 'danger', name: 'ไม่ตั้ง Stop Loss',
          description: `${((noSL / totalTrades) * 100).toFixed(0)}% ของเทรดไม่มี Stop Loss — ความเสี่ยงสูง`,
          severity: 'critical',
        });
        score -= 20;
        recommendations.push('ตั้ง Stop Loss ทุกไม้ที่เปิด เพื่อจำกัดผลขาดทุน');
      }

      // =============================================
      // PATTERN 5: ASYMMETRIC RISK/REWARD
      // =============================================
      if (avgLoss > 0 && avgWin > 0) {
        const rrRatio = avgWin / avgLoss;
        if (rrRatio < 0.5) {
          patterns.push({
            type: 'danger', name: 'Risk/Reward ต่ำมาก',
            description: `กำไรเฉลี่ย $${avgWin.toFixed(2)} vs ขาดทุนเฉลี่ย $${avgLoss.toFixed(2)} (R:R = 1:${(1/rrRatio).toFixed(1)})`,
            severity: 'high',
          });
          score -= 15;
          recommendations.push('ตั้ง Take Profit ให้มากกว่า Stop Loss อย่างน้อย 1.5 เท่า');
        } else if (rrRatio >= 1.5) {
          patterns.push({
            type: 'positive', name: 'Risk/Reward ดี',
            description: `R:R = ${rrRatio.toFixed(1)}:1 — กำไรเฉลี่ยมากกว่าขาดทุน`,
            severity: 'positive',
          });
        }
      }

      // =============================================
      // PATTERN 6: TRADING OUTSIDE OPTIMAL HOURS
      // =============================================
      const offHourTrades = tradingHours.filter(h => h >= 0 && h < 7).length; // midnight to 7am
      if (offHourTrades > totalTrades * 0.3) {
        patterns.push({
          type: 'caution', name: 'เทรดนอกเวลาหลัก',
          description: `${((offHourTrades / totalTrades) * 100).toFixed(0)}% ของเทรดเปิดช่วง 00:00-07:00 — ตลาดมี spread สูงและ volatility ต่ำ`,
          severity: 'medium',
        });
        score -= 5;
      }

      // =============================================
      // PATTERN 7: LOSS STREAK ANALYSIS
      // =============================================
      let maxLossStreak = 0;
      let currentStreak = 0;
      for (const t of sortedTrades) {
        if (parseFloat(t.pnl) < 0) {
          currentStreak++;
          maxLossStreak = Math.max(maxLossStreak, currentStreak);
        } else {
          currentStreak = 0;
        }
      }

      if (maxLossStreak >= 7) {
        patterns.push({
          type: 'danger', name: 'ขาดทุนติดต่อกันยาว',
          description: `ขาดทุนติดต่อกันสูงสุด ${maxLossStreak} ไม้ — ต้องทบทวนกลยุทธ์`,
          severity: 'high',
        });
        score -= 10;
        recommendations.push('เมื่อขาดทุนติดต่อ 3 ไม้ ให้หยุดเทรดในวันนั้น');
      }

      metrics.max_loss_streak = maxLossStreak;
      metrics.revenge_sessions = revengeSessions;
      metrics.trades_per_day = parseFloat(tradesPerDay.toFixed(1));

      // =============================================
      // POSITIVE PATTERNS
      // =============================================
      if (winRate >= 60) {
        patterns.push({
          type: 'positive', name: 'Win Rate ดีมาก',
          description: `Win Rate ${winRate.toFixed(1)}% — สูงกว่าค่าเฉลี่ยที่ดี (55%)`,
          severity: 'positive',
        });
      }

      if (profitFactor >= 2) {
        patterns.push({
          type: 'positive', name: 'Profit Factor ยอดเยี่ยม',
          description: `Profit Factor ${profitFactor.toFixed(2)} — กำไรมากกว่าขาดทุน ${profitFactor.toFixed(1)} เท่า`,
          severity: 'positive',
        });
      }

      if (revengeSessions === 0 && noSL <= totalTrades * 0.2) {
        patterns.push({
          type: 'positive', name: 'มีวินัยในการเทรด',
          description: 'ไม่พบ Revenge Trading และมี Stop Loss ในเกือบทุกไม้',
          severity: 'positive',
        });
      }

      // General recommendations
      if (recommendations.length === 0) {
        recommendations.push('รักษาวินัยการเทรดต่อไป!');
      }
      recommendations.push('ทบทวนรายงานนี้ทุกสัปดาห์เพื่อติดตามพัฒนาการ');

      // Clamp score
      const overallScore = Math.max(0, Math.min(100, score));

      // Save report to DB
      try {
        await pool.query(`
          INSERT INTO trade_psychology_reports (user_id, report_date, period_days, overall_score, patterns, recommendations, metrics)
          VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6)
          ON CONFLICT (user_id, report_date, period_days) 
          DO UPDATE SET overall_score = $3, patterns = $4, recommendations = $5, metrics = $6, created_at = NOW()
        `, [userId, periodDays, overallScore, JSON.stringify(patterns), JSON.stringify(recommendations), JSON.stringify(metrics)]);
      } catch (e) {
        console.warn('[Psychology] Save report error:', e.message);
      }

      return { overall_score: overallScore, patterns, recommendations, metrics };
    } catch (err) {
      console.error('[TradePsychology] Analysis error:', err);
      throw err;
    }
  }

  /**
   * Get historical reports
   */
  static async getHistory(userId, limit = 30) {
    const result = await pool.query(
      `SELECT * FROM trade_psychology_reports 
       WHERE user_id = $1 
       ORDER BY report_date DESC 
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  }
}

module.exports = TradePsychologyAnalyzer;
