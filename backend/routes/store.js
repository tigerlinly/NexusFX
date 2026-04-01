const express = require('express');
const { pool } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);

// =============================================
// 4 FREE Basic Strategies — ระบบจัดให้ฟรีสำหรับผู้ใช้ทุกคน
// =============================================
const storeBots = [
  {
    id: 1, name: 'Nexus Alpha Scalper', type: 'Scalper (เก็บสั้น)', price: 0,
    author: 'NexusFX Labs', roi: '+142%', drawdown: '2.4%', rating: 4.8, users: 1240,
    description: 'บอทเทรดแบบ Scalping เน้นเก็บสั้นรอบ 1-15 นาที ทำกำไรจากความผันผวนของราคา XAUUSD ในช่วง London/NY Session ความเสี่ยงต่ำ เหมาะสำหรับผู้เริ่มต้น',
    isHot: true,
    config: { strategy: 'scalper', timeframe: '1m', sl_pct: 1.0, tp_pct: 2.0, symbols: ['XAUUSD'], session: 'london_ny' }
  },
  {
    id: 2, name: 'Trend Follower Pro', type: 'Swing Trade', price: 0,
    author: 'NexusFX Labs', roi: '+85%', drawdown: '10.5%', rating: 4.5, users: 890,
    description: 'กลยุทธ์ Swing Trade จับเทรนด์ขาขึ้น-ขาลงของคู่เงินหลัก EURUSD, GBPUSD ทิ้งออเดอร์ข้ามคืน 1-5 วัน ใช้ Moving Average + RSI ยืนยันทิศทาง เหมาะกับตลาดที่มีเทรนด์ชัดเจน',
    isHot: false,
    config: { strategy: 'swing', timeframe: '1h', sl_pct: 2.0, tp_pct: 5.0, symbols: ['EURUSD', 'GBPUSD'], indicators: ['MA200', 'RSI14'] }
  },
  {
    id: 3, name: 'Grid Master Recovery', type: 'Grid Trading', price: 0,
    author: 'NexusFX Labs', roi: '+210%', drawdown: '25.0%', rating: 4.9, users: 2100,
    description: 'ระบบ Grid Trading วางออเดอร์เป็นตาราง (Grid Spacing) ทุกระยะราคาที่กำหนด ทำกำไรจากตลาด Sideway โดยอัตโนมัติ มีระบบ Recovery ฟื้นฟูเงินทุนในกรณีราคาวิ่งทิศทางเดียว',
    isHot: true,
    config: { strategy: 'grid', grid_spacing: 10, sl_pct: 5.0, tp_pct: 3.0, grid_levels: 10, symbols: ['XAUUSD', 'EURUSD'] }
  },
  {
    id: 4, name: 'Martingale Bouncer', type: 'Martingale', price: 0,
    author: 'NexusFX Labs', roi: '+320%', drawdown: '35.0%', rating: 4.3, users: 1680,
    description: 'ระบบ Martingale เพิ่มขนาด Lot ทุกครั้งที่ขาดทุน เพื่อรอให้กำไรหนึ่งครั้งเอาคืนทุกออเดอร์ที่แพ้ เหมาะกับผู้ที่กล้ารับความเสี่ยงสูง มีระบบ Max Step จำกัดการเพิ่ม Lot ไม่ให้เกินที่ตั้ง',
    isHot: false,
    config: { strategy: 'martingale', multiplier: 2.0, max_steps: 5, sl_pct: 3.0, tp_pct: 1.5, symbols: ['XAUUSD'], base_lot: 0.01 }
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
