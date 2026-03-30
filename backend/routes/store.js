const express = require('express');
const { pool } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);

// Hardcoded store bots for simplicity (could be moved to DB table 'strategies')
const storeBots = [
  {
    id: 1, name: 'Nexus Alpha Scalper', type: 'Scalping AI', price: 0,
    author: 'NexusFX Labs', roi: '+142%', drawdown: '2.4%', rating: 4.8, users: 1240,
    description: 'บอทเทรดระดับความถี่สูง (HFT) สำหรับเล่นรอบสั้น เน้นทำกำไรจากความผันผวนของ XAUUSD',
    isHot: true,
    config: { strategy: 'scalper', timeframe: '1m', sl_pct: 1.0, tp_pct: 2.0 }
  },
  {
    id: 2, name: 'Trend Follower Pro', type: 'Swing Trade', price: 49,
    author: 'Trader Joe', roi: '+85%', drawdown: '10.5%', rating: 4.5, users: 450,
    description: 'จับเทรนด์ขาขึ้นของคู่เงินหลัก EURUSD, GBPUSD ทิ้งออเดอร์ยาวระยะเวลาข้ามคืน (Swing)',
    isHot: false,
    config: { strategy: 'trend', timeframe: '1h', sl_pct: 2.0, tp_pct: 5.0 }
  },
  {
    id: 3, name: 'Grid Master Recovery', type: 'Grid System', price: 99,
    author: 'Mr. Grid Bot', roi: '+210%', drawdown: '25.0%', rating: 4.9, users: 2100,
    description: 'ระบบแก้พอร์ตอัตโนมัติ ใช้วิธี Grid ระยะห่างตาราง (Spacing) ช่วยฟื้นฟูเงินทุน เหมาะสำหรับตลาด Sideway',
    isHot: true,
    config: { strategy: 'grid', grid_spacing: 10, sl_pct: 5.0, tp_pct: 3.0 }
  }
];

// GET /api/store/bots
router.get('/bots', (req, res) => {
  res.json(storeBots);
});

// POST /api/store/purchase
router.post('/purchase', async (req, res) => {
  const { botId, accountId } = req.body;
  if (!botId || !accountId) return res.status(400).json({ error: 'Missing botId or accountId' });

  const botToBuy = storeBots.find(b => b.id === parseInt(botId));
  if (!botToBuy) return res.status(404).json({ error: 'Bot not found in store' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify account ownership
    const accCheck = await client.query('SELECT id FROM accounts WHERE id = $1 AND user_id = $2', [accountId, req.user.id]);
    if (accCheck.rows.length === 0) throw new Error('Account not found or unauthorized');

    // Deduct from wallet if price > 0
    if (botToBuy.price > 0) {
      const walletRes = await client.query('SELECT id, balance FROM wallets WHERE user_id = $1 AND currency = $2 FOR UPDATE', [req.user.id, 'USD']);
      if (walletRes.rows.length === 0 || walletRes.rows[0].balance < botToBuy.price) {
        throw new Error('Insufficient USD balance');
      }
      const walletId = walletRes.rows[0].id;
      
      await client.query('UPDATE wallets SET balance = balance - $1 WHERE id = $2', [botToBuy.price, walletId]);
      
      // Log transaction
      await client.query(
        'INSERT INTO financial_transactions (wallet_id, type, amount, status) VALUES ($1, $2, $3, $4)',
        [walletId, 'FEE', -botToBuy.price, 'COMPLETED']
      );
    }

    // Provision the bot to the user's trading_bots table
    const botName = `Copied: ${botToBuy.name}`;
    const insertBot = await client.query(
      `INSERT INTO trading_bots (account_id, bot_name, webhook_token, parameters, status, is_active)
       VALUES ($1, $2, encode(gen_random_bytes(16), 'hex'), $3, 'AWAITING_SIGNAL', true) RETURNING *`,
      [accountId, botName, botToBuy.config]
    );

    // Audit log
    await client.query(
      'INSERT INTO audit_logs (user_id, action, ip_address, payload) VALUES ($1, $2, $3, $4)',
      [req.user.id, 'PURCHASE_BOT', req.ip, JSON.stringify({ bot_id: botToBuy.id, price: botToBuy.price })]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: `Successfully purchased and installed ${botToBuy.name}`, bot: insertBot.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Store Purchase Error:', err);
    res.status(400).json({ error: err.message || 'Purchase failed' });
  } finally {
    client.release();
  }
});

module.exports = router;
