const express = require('express');
const { pool } = require('../config/database');
const { authMiddleware, requirePermission, auditLog } = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);

// GET /api/wallet — get user's wallet
router.get('/', async (req, res) => {
  try {
    let result = await pool.query(
      'SELECT * FROM wallets WHERE user_id = $1 ORDER BY currency',
      [req.user.id]
    );

    // Auto-create if not exists
    if (result.rows.length === 0) {
      await pool.query(
        'INSERT INTO wallets (user_id, currency, balance) VALUES ($1, $2, $3)',
        [req.user.id, 'USD', 0]
      );
      result = await pool.query(
        'SELECT * FROM wallets WHERE user_id = $1',
        [req.user.id]
      );
    }

    res.json(result.rows);
  } catch (err) {
    console.error('Get wallet error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/wallet/summary — wallet summary with stats
router.get('/summary', async (req, res) => {
  try {
    const wallets = await pool.query(
      'SELECT * FROM wallets WHERE user_id = $1',
      [req.user.id]
    );

    const totalBalance = wallets.rows.reduce((s, w) => s + parseFloat(w.balance), 0);
    const totalLocked = wallets.rows.reduce((s, w) => s + parseFloat(w.locked_balance || 0), 0);

    // Recent transactions
    const recentTx = await pool.query(
      `SELECT ft.*, w.currency
       FROM financial_transactions ft
       JOIN wallets w ON w.id = ft.wallet_id
       WHERE ft.user_id = $1
       ORDER BY ft.created_at DESC LIMIT 10`,
      [req.user.id]
    );

    // Monthly totals
    const monthlyStats = await pool.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN type = 'DEPOSIT' AND status = 'COMPLETED' THEN amount ELSE 0 END), 0) as total_deposits,
        COALESCE(SUM(CASE WHEN type = 'WITHDRAW' AND status = 'COMPLETED' THEN amount ELSE 0 END), 0) as total_withdrawals,
        COALESCE(SUM(CASE WHEN type = 'FEE' AND status = 'COMPLETED' THEN amount ELSE 0 END), 0) as total_fees
       FROM financial_transactions
       WHERE user_id = $1 AND created_at >= date_trunc('month', NOW())`,
      [req.user.id]
    );

    res.json({
      wallets: wallets.rows,
      total_balance: totalBalance,
      total_locked: totalLocked,
      available_balance: totalBalance - totalLocked,
      recent_transactions: recentTx.rows,
      monthly: monthlyStats.rows[0]
    });
  } catch (err) {
    console.error('Wallet summary error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/wallet/transactions — full transaction history
router.get('/transactions', async (req, res) => {
  try {
    const { type, status, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = 'ft.user_id = $1';
    const params = [req.user.id];
    let idx = 2;

    if (type) {
      where += ` AND ft.type = $${idx++}`;
      params.push(type);
    }
    if (status) {
      where += ` AND ft.status = $${idx++}`;
      params.push(status);
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM financial_transactions ft WHERE ${where}`,
      params
    );

    params.push(parseInt(limit), offset);
    const result = await pool.query(
      `SELECT ft.*, w.currency
       FROM financial_transactions ft
       JOIN wallets w ON w.id = ft.wallet_id
       WHERE ${where}
       ORDER BY ft.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      params
    );

    res.json({
      transactions: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error('Get transactions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/wallet/deposit — create deposit
router.post('/deposit', requirePermission('finance.deposit'), auditLog('DEPOSIT', 'WALLET'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { amount, currency = 'USD', note, reference_id } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount required' });
    }

    await client.query('BEGIN');

    // Get or create wallet (lock row for update)
    let wallet = await client.query(
      'SELECT * FROM wallets WHERE user_id = $1 AND currency = $2 FOR UPDATE',
      [req.user.id, currency]
    );
    if (wallet.rows.length === 0) {
      wallet = await client.query(
        'INSERT INTO wallets (user_id, currency) VALUES ($1, $2) RETURNING *',
        [req.user.id, currency]
      );
    }

    const walletId = wallet.rows[0].id;

    // Create transaction
    const tx = await client.query(
      `INSERT INTO financial_transactions (wallet_id, user_id, type, amount, status, reference_id, note, completed_at)
       VALUES ($1, $2, 'DEPOSIT', $3, 'COMPLETED', $4, $5, NOW()) RETURNING *`,
      [walletId, req.user.id, amount, reference_id, note]
    );

    // Update wallet balance
    await client.query(
      'UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE id = $2',
      [amount, walletId]
    );

    await client.query('COMMIT');
    res.status(201).json(tx.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Deposit error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// POST /api/wallet/topup — User Mock Deposit (For Testing)
router.post('/topup', requirePermission('finance.deposit'), auditLog('TOPUP', 'WALLET'), async (req, res) => {
  try {
    // Check admin role from database (not JWT)
    const roleCheck = await pool.query(
      `SELECT r.role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
      [req.user.id]
    );
    if (roleCheck.rows.length === 0 || !['admin', 'super_admin'].includes(roleCheck.rows[0].role_name)) {
      return res.status(403).json({ error: 'Permission denied. Admins only.' });
    }

    const { amount, currency = 'USD' } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount required' });
    }

    let wallet = await pool.query(
      'SELECT * FROM wallets WHERE user_id = $1 AND currency = $2',
      [req.user.id, currency]
    );

    if (wallet.rows.length === 0) {
      wallet = await pool.query(
        'INSERT INTO wallets (user_id, currency) VALUES ($1, $2) RETURNING *',
        [req.user.id, currency]
      );
    }

    const walletId = wallet.rows[0].id;

    const tx = await pool.query(
      `INSERT INTO financial_transactions (wallet_id, user_id, type, amount, status, note, completed_at)
       VALUES ($1, $2, 'DEPOSIT', $3, 'COMPLETED', 'Mock Top-Up (PromptPay)', NOW()) RETURNING *`,
      [walletId, req.user.id, amount]
    );

    await pool.query(
      'UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE id = $2',
      [amount, walletId]
    );

    res.status(201).json(tx.rows[0]);
  } catch (err) {
    console.error('Topup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/wallet/withdraw — create withdrawal
router.post('/withdraw', requirePermission('finance.withdraw'), auditLog('WITHDRAW', 'WALLET'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { amount, currency = 'USD', note, reference_id } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount required' });
    }

    await client.query('BEGIN');

    const wallet = await client.query(
      'SELECT * FROM wallets WHERE user_id = $1 AND currency = $2 FOR UPDATE',
      [req.user.id, currency]
    );
    if (wallet.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Wallet not found' });
    }
    const availableBalance = parseFloat(wallet.rows[0].balance) - parseFloat(wallet.rows[0].locked_balance || 0);
    if (availableBalance < amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const walletId = wallet.rows[0].id;

    // Create transaction
    const tx = await client.query(
      `INSERT INTO financial_transactions (wallet_id, user_id, type, amount, status, reference_id, note, completed_at)
       VALUES ($1, $2, 'WITHDRAW', $3, 'COMPLETED', $4, $5, NOW()) RETURNING *`,
      [walletId, req.user.id, amount, reference_id, note]
    );

    // Update wallet balance
    await client.query(
      'UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE id = $2',
      [amount, walletId]
    );

    await client.query('COMMIT');
    res.status(201).json(tx.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Withdraw error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
