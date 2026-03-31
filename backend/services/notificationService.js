const { pool } = require('../config/database');

/**
 * NotificationService — Creates in-app notifications and emits Socket.io events
 */
class NotificationService {
  constructor(io) {
    this.io = io;
  }

  /**
   * Create a notification and emit it via Socket.io
   * @param {number} userId 
   * @param {string} type - 'trade_opened', 'trade_closed', 'trade_failed', 'risk_alert', 'system', etc.
   * @param {string} title 
   * @param {string} message 
   * @param {object} data — additional JSON data
   */
  async notify(userId, type, title, message, data = {}) {
    try {
      // 1. Save to DB
      const result = await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, data) 
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [userId, type, title, message, JSON.stringify(data)]
      );
      const notification = result.rows[0];

      // 2. Emit via Socket.io to the user's room
      if (this.io) {
        this.io.to(`user:${userId}`).emit('notification', notification);
      }

      return notification;
    } catch (err) {
      console.error('[NotificationService] Error:', err.message);
      return null;
    }
  }

  /** Trade executed successfully */
  async tradeExecuted(userId, order) {
    return this.notify(userId, 'trade_executed', '✅ เทรดสำเร็จ', 
      `${order.side} ${order.symbol} — Lot: ${order.quantity || order.lot_size}`,
      { symbol: order.symbol, side: order.side, order_id: order.id }
    );
  }

  /** Trade failed */
  async tradeFailed(userId, order, reason) {
    return this.notify(userId, 'trade_failed', '❌ เทรดล้มเหลว',
      `${order.symbol} — ${reason}`,
      { symbol: order.symbol, side: order.side, order_id: order.id, reason }
    );
  }

  /** New trade opened (from sync) */
  async tradeOpened(userId, trade) {
    return this.notify(userId, 'trade_opened', '📈 เปิดออเดอร์ใหม่',
      `${trade.side} ${trade.symbol} — Lot: ${trade.lot_size}`,
      { symbol: trade.symbol, side: trade.side, trade_id: trade.id }
    );
  }

  /** Trade closed (from sync) */
  async tradeClosed(userId, trade) {
    const pnl = parseFloat(trade.pnl || 0);
    const emoji = pnl >= 0 ? '💰' : '📉';
    return this.notify(userId, 'trade_closed', `${emoji} ปิดออเดอร์แล้ว`,
      `${trade.symbol} — PnL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`,
      { symbol: trade.symbol, pnl, trade_id: trade.id }
    );
  }

  /** Risk violation alert */
  async riskAlert(userId, groupName, pnl, limit) {
    return this.notify(userId, 'risk_alert', '⚠️ แจ้งเตือนความเสี่ยง',
      `กลุ่ม ${groupName} ขาดทุน $${Math.abs(pnl).toFixed(2)} / ขีดจำกัด $${Math.abs(limit).toFixed(2)}`,
      { groupName, pnl, limit }
    );
  }
}

module.exports = NotificationService;
