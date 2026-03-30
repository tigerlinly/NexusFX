const { pool } = require('../config/database');
const https = require('https');

class TelegramNotify {
  
  /**
   * Send a Telegram alert to a user
   * @param {number} userId 
   * @param {string} message 
   */
  static async sendAlert(userId, message) {
    try {
      // 1. Fetch user's Telegram token and chat ID
      const settingsQuery = await pool.query(
        'SELECT telegram_bot_token, telegram_chat_id, notifications_enabled FROM user_settings WHERE user_id = $1',
        [userId]
      );
      
      if (settingsQuery.rows.length === 0) return false;
      
      // Check if notifications are enabled
      if (settingsQuery.rows[0].notifications_enabled === false) return false;

      const botToken = settingsQuery.rows[0].telegram_bot_token;
      const chatId = settingsQuery.rows[0].telegram_chat_id;
      if (!botToken || botToken.trim() === '' || !chatId || chatId.trim() === '') return false;

      // 2. Prepare payload
      const postData = JSON.stringify({
        chat_id: chatId,
        text: `*[NexusFX System]*\n${message}`,
        parse_mode: 'Markdown'
      });
      
      // 3. Send to Telegram API
      const options = {
        hostname: 'api.telegram.org',
        path: `/bot${botToken}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        }
      };

      return new Promise((resolve) => {
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
             if (res.statusCode === 200) resolve(true);
             else { 
               console.warn(`[TelegramNotify] API returned ${res.statusCode}:`, data);
               resolve(false);
             }
          });
        });

        req.on('error', (e) => {
          console.error('[TelegramNotify] Error:', e.message);
          resolve(false);
        });

        req.write(postData);
        req.end();
      });

    } catch (err) {
      console.error('[TelegramNotify] Internal Error:', err);
      return false;
    }
  }

  // =============================================
  // AUTO-TRIGGER METHODS
  // =============================================

  static async notifyTradeOpened(userId, trade) {
    const message = [
      `📈 *เปิดออเดอร์ใหม่*`,
      `Symbol: ${trade.symbol}`,
      `Side: ${trade.side}`,
      `Lot Size: ${trade.lot_size}`,
      `Entry: ${trade.entry_price || 'Market'}`,
      `SL: ${trade.stop_loss || '-'} \\| TP: ${trade.take_profit || '-'}`,
      `เวลา: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`
    ].join('\n');
    return this.sendAlert(userId, message);
  }

  static async notifyTradeClosed(userId, trade) {
    const pnl = parseFloat(trade.pnl || 0);
    const emoji = pnl >= 0 ? '💰' : '📉';
    const message = [
      `${emoji} *ปิดออเดอร์แล้ว*`,
      `Symbol: ${trade.symbol}`,
      `Side: ${trade.side}`,
      `PnL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`,
      `Entry: ${trade.entry_price} → Exit: ${trade.exit_price}`,
      `เวลา: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`
    ].join('\n');
    return this.sendAlert(userId, message);
  }

  static async notifyTargetReached(userId, targetAmount, currentPnl) {
    const message = [
      `🎯 *ถึงเป้าหมายรายวันแล้ว!*`,
      `เป้าหมาย: $${targetAmount}`,
      `กำไรวันนี้: $${parseFloat(currentPnl).toFixed(2)}`,
      `ยินดีด้วย! 🎉`
    ].join('\n');
    return this.sendAlert(userId, message);
  }

  static async notifyRiskViolation(userId, groupName, pnl, limit) {
    const message = [
      `⚠️ *แจ้งเตือนความเสี่ยง!*`,
      `กลุ่ม: ${groupName}`,
      `ขาดทุนวันนี้: $${Math.abs(pnl).toFixed(2)}`,
      `ขีดจำกัด: $${Math.abs(limit).toFixed(2)}`,
      `ระบบได้ปิดไม้และหยุดบอทอัตโนมัติแล้ว`
    ].join('\n');
    return this.sendAlert(userId, message);
  }

  static async notifyEmergencyClose(userId, groupName, reason) {
    const message = [
      `🚨 *Emergency Close ถูกเรียกใช้!*`,
      `กลุ่ม: ${groupName}`,
      `เหตุผล: ${reason || 'ไม่ระบุ'}`,
      `ออเดอร์ทั้งหมดถูกยกเลิก และบอทถูกหยุดแล้ว`
    ].join('\n');
    return this.sendAlert(userId, message);
  }
}

module.exports = TelegramNotify;
