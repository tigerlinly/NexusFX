const { pool } = require('../config/database');
const https = require('https');
const querystring = require('querystring');
const { decrypt } = require('../utils/encryption');

class LineNotify {
  
  /**
   * Send a Line Notify alert to a user
   * @param {number} userId 
   * @param {string} message 
   */
  static async sendAlert(userId, message) {
    try {
      // 1. Fetch user's Line token from user_settings
      const settingsQuery = await pool.query(
        'SELECT line_notify_token, notifications_enabled FROM user_settings WHERE user_id = $1',
        [userId]
      );
      
      if (settingsQuery.rows.length === 0) return false;
      
      // Check if notifications are enabled
      if (settingsQuery.rows[0].notifications_enabled === false) return false;

      const rawToken = settingsQuery.rows[0].line_notify_token;
      if (!rawToken || rawToken.trim() === '') return false;
      
      // Decrypt the token (supports both encrypted and plaintext for backward compat)
      const token = decrypt(rawToken);
      if (!token || token.trim() === '') return false;

      // 2. Prepare payload
      const postData = querystring.stringify({ message: `\n[NexusFX System]\n${message}` });
      
      // 3. Send to Line Notify API
      const options = {
        hostname: 'notify-api.line.me',
        path: '/api/notify',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
          'Authorization': `Bearer ${token}`
        }
      };

      return new Promise((resolve) => {
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
             if (res.statusCode === 200) resolve(true);
             else { 
               console.warn(`[LineNotify] API returned ${res.statusCode}:`, data);
               resolve(false);
             }
          });
        });

        req.on('error', (e) => {
          console.error('[LineNotify] Error:', e.message);
          resolve(false);
        });

        req.write(postData);
        req.end();
      });

    } catch (err) {
      console.error('[LineNotify] Internal Error:', err);
      return false;
    }
  }

  // =============================================
  // AUTO-TRIGGER METHODS (Level 2 Feature)
  // =============================================

  /**
   * Notify when a new trade is opened
   */
  static async notifyTradeOpened(userId, trade) {
    const message = [
      `📈 เปิดออเดอร์ใหม่`,
      `Broker : ${trade.broker_name || '-'} ( ${trade.account_number || '-'} : ${trade.account_name || '-'} )`,
      `Symbol : ${trade.symbol || '-'} ( ${trade.side === 'BUY' ? 'Buy' : 'Sell'} )  ${trade.timeframe !== '-' ? 'TF ' + trade.timeframe : ''}`,
      `Lot Size :  ${trade.lot_size || '-'} ( SL :  ${trade.stop_loss || '-'}  / TP :  ${trade.take_profit || '-'}   )`,
      `Price :  ${trade.entry_price || 'Market'}     ( ${trade.pattern || '-'} )`
    ].join('\n');
    return this.sendAlert(userId, message);
  }

  /**
   * Notify when a trade is closed
   */
  static async notifyTradeClosed(userId, trade) {
    const pnl = parseFloat(trade.pnl || 0);
    const emoji = pnl >= 0 ? '💰' : '📉';
    const message = [
      `${emoji} ปิดออเดอร์แล้ว`,
      `Symbol: ${trade.symbol}`,
      `Side: ${trade.side}`,
      `PnL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`,
      `Entry: ${trade.entry_price} → Exit: ${trade.exit_price}`,
      `เวลา: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`
    ].join('\n');
    return this.sendAlert(userId, message);
  }

  /**
   * Notify when daily target is reached
   */
  static async notifyTargetReached(userId, targetAmount, currentPnl) {
    const message = [
      `🎯 ถึงเป้าหมายรายวันแล้ว!`,
      `เป้าหมาย: $${targetAmount}`,
      `กำไรวันนี้: $${parseFloat(currentPnl).toFixed(2)}`,
      `ยินดีด้วย! 🎉`
    ].join('\n');
    return this.sendAlert(userId, message);
  }

  /**
   * Notify when risk limit is hit (group auto stop-loss)
   */
  static async notifyRiskViolation(userId, groupName, pnl, limit) {
    const message = [
      `⚠️ แจ้งเตือนความเสี่ยง!`,
      `กลุ่ม: ${groupName}`,
      `ขาดทุนวันนี้: $${Math.abs(pnl).toFixed(2)}`,
      `ขีดจำกัด: $${Math.abs(limit).toFixed(2)}`,
      `ระบบได้ปิดไม้และหยุดบอทอัตโนมัติแล้ว`
    ].join('\n');
    return this.sendAlert(userId, message);
  }

  /**
   * Notify when emergency close is triggered
   */
  static async notifyEmergencyClose(userId, groupName, reason) {
    const message = [
      `🚨 Emergency Close ถูกเรียกใช้!`,
      `กลุ่ม: ${groupName}`,
      `เหตุผล: ${reason || 'ไม่ระบุ'}`,
      `ออเดอร์ทั้งหมดถูกยกเลิก และบอทถูกหยุดแล้ว`
    ].join('\n');
    return this.sendAlert(userId, message);
  }
}

module.exports = LineNotify;
