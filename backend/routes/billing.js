const express = require('express');
const { pool } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);

const plans = {
  basic: { name: 'Starter Trader', price: 29 },
  pro: { name: 'Pro Algo', price: 99 },
  enterprise: { name: 'White-label / B2B', price: 199 }
};

// POST /api/billing/upgrade
router.post('/upgrade', async (req, res) => {
  const { planId } = req.body;
  
  if (!planId || !plans[planId]) {
    return res.status(400).json({ error: 'Invalid subscription plan selected' });
  }

  const selectedPlan = plans[planId];
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // For demonstration, we assume they pay with their USDT wallet balance
    // In a real application, this would trigger Stripe checkout or PromptPay
    const walletRes = await client.query('SELECT id, balance FROM wallets WHERE user_id = $1 AND currency = $2 FOR UPDATE', [req.user.id, 'USDT']);
    if (walletRes.rows.length === 0 || walletRes.rows[0].balance < selectedPlan.price) {
      throw new Error(`Insufficient USDT balance (${selectedPlan.price} USDT required). Please deposit funds.`);
    }

    const walletId = walletRes.rows[0].id;
    
    // Deduct subscription fee
    await client.query('UPDATE wallets SET balance = balance - $1 WHERE id = $2', [selectedPlan.price, walletId]);
    
    // Log financial transaction
    await client.query(
      'INSERT INTO financial_transactions (wallet_id, type, amount, status) VALUES ($1, $2, $3, $4)',
      [walletId, 'FEE', -selectedPlan.price, 'COMPLETED']
    );

    // Update user role if they buy enterprise, or log their subscription in audit
    if (planId === 'enterprise' && req.user.role === 'user') {
      await client.query('UPDATE users SET role = $1 WHERE id = $2', ['team_lead', req.user.id]);
    }

    // Insert purchase audit
    await client.query(
      'INSERT INTO audit_logs (user_id, action, ip_address, payload) VALUES ($1, $2, $3, $4)',
      [req.user.id, 'PURCHASE_SUBSCRIPTION', req.ip, JSON.stringify({ plan_id: planId, price: selectedPlan.price })]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: `Successfully upgraded to ${selectedPlan.name}!` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Subscription error:', err);
    res.status(400).json({ error: err.message || 'Payment processing failed' });
  } finally {
    client.release();
  }
});

module.exports = router;
