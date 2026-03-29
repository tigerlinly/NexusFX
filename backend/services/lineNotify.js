const { pool } = require('../config/database');
const https = require('https');
const querystring = require('querystring');

class LineNotify {
  
  static async sendAlert(userId, message) {
    try {
      // 1. Fetch user's Line token from user_settings
      const settingsQuery = await pool.query(
        'SELECT line_notify_token FROM user_settings WHERE user_id = $1',
        [userId]
      );
      
      if (settingsQuery.rows.length === 0) return false;
      
      const token = settingsQuery.rows[0].line_notify_token;
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
          'Content-Length': postData.length,
          'Authorization': `Bearer ${token}`
        }
      };

      return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
             if (res.statusCode === 200) resolve(true);
             else resolve(false); // Can log error if needed
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
}

module.exports = LineNotify;
