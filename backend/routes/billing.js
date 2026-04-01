const express = require('express');
const { pool } = require('../config/database');
const { authMiddleware, auditLog } = require('../middleware/auth');
const TelegramNotify = require('../services/telegramNotify');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_mock_secret');
const router = express.Router();

router.use(authMiddleware);

// =============================================
// MEMBERSHIP PLANS (DB-Driven)
// =============================================

/**
 * @swagger
 * /billing/plans:
 *   get:
 *     summary: Get all available membership plans
 *     tags: [Billing]
 *     responses:
 *       200:
 *         description: List of plans
 */
router.get('/plans', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM membership_plans WHERE is_active = true ORDER BY sort_order ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get plans error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /billing/upgrade:
 *   post:
 *     summary: Upgrade subscription plan (pays from USD wallet)
 *     tags: [Billing]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               planId: { type: string, description: "Plan key (basic, pro, enterprise)" }
 *     responses:
 *       200:
 *         description: Upgrade successful
 */
router.post('/upgrade', auditLog('PURCHASE_SUBSCRIPTION', 'BILLING'), async (req, res) => {
  const { planId } = req.body;
  
  if (!planId) {
    return res.status(400).json({ error: 'planId is required' });
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Get plan from DB
    const planRes = await client.query(
      'SELECT * FROM membership_plans WHERE plan_key = $1 AND is_active = true',
      [planId]
    );

    if (planRes.rows.length === 0) {
      throw new Error('Invalid subscription plan selected');
    }

    const selectedPlan = planRes.rows[0];

    // Check USD wallet balance
    const walletRes = await client.query(
      'SELECT id, balance FROM wallets WHERE user_id = $1 AND currency = $2 FOR UPDATE',
      [req.user.id, 'USD']
    );

    if (walletRes.rows.length === 0 || walletRes.rows[0].balance < selectedPlan.monthly_price) {
      throw new Error(`Insufficient USD balance (${selectedPlan.monthly_price} USD required). Please deposit funds.`);
    }

    const walletId = walletRes.rows[0].id;
    
    // Deduct subscription fee
    await client.query(
      'UPDATE wallets SET balance = balance - $1 WHERE id = $2',
      [selectedPlan.monthly_price, walletId]
    );
    
    // Log financial transaction
    await client.query(
      `INSERT INTO financial_transactions (wallet_id, user_id, type, amount, status, note)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [walletId, req.user.id, 'FEE', -selectedPlan.monthly_price, 'COMPLETED', `Subscription: ${selectedPlan.plan_name}`]
    );

    const days = planId === 'free' ? 15 : 30;

    // Record subscription history
    await client.query(
      `INSERT INTO subscription_history (user_id, plan_id, amount, payment_status, payment_method, period_end)
       VALUES ($1, $2, $3, 'COMPLETED', 'WALLET', NOW() + INTERVAL '${days} days')`,
      [req.user.id, selectedPlan.id, selectedPlan.monthly_price]
    );

    // Update current plan on user record
    await client.query(
      `UPDATE users SET current_plan_id = $1, plan_expires_at = NOW() + INTERVAL '${days} days' WHERE id = $2`,
      [selectedPlan.id, req.user.id]
    );

    // Update user role if they buy enterprise
    if (planId === 'enterprise') {
      const teamLeadRole = await client.query("SELECT id FROM roles WHERE role_name = 'team_lead'");
      if (teamLeadRole.rows.length > 0) {
        await client.query('UPDATE users SET role_id = $1 WHERE id = $2', [teamLeadRole.rows[0].id, req.user.id]);
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: `อัปเกรดเป็น ${selectedPlan.plan_name} สำเร็จ! หมดอายุใน ${days} วัน` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Subscription error:', err);
    res.status(400).json({ error: err.message || 'Payment processing failed' });
  } finally {
    client.release();
  }
});

// GET /api/billing/current — get user's current active plan
router.get('/current', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT mp.plan_key, mp.plan_name, mp.monthly_price, mp.max_bots, mp.max_accounts, mp.features,
             u.plan_expires_at, u.current_plan_id,
             CASE WHEN u.plan_expires_at > NOW() THEN true ELSE false END as is_active
      FROM users u
      LEFT JOIN membership_plans mp ON mp.id = u.current_plan_id
      WHERE u.id = $1
    `, [req.user.id]);

    if (result.rows.length === 0 || !result.rows[0].current_plan_id) {
      return res.json({
        plan_key: 'free',
        plan_name: 'Free Trial',
        monthly_price: 0,
        is_active: true,
        plan_expires_at: null,
        max_bots: 1,
        max_accounts: 1,
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get current plan error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/billing/history — subscription history
router.get('/history', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT sh.*, mp.plan_name, mp.plan_key
      FROM subscription_history sh
      JOIN membership_plans mp ON mp.id = sh.plan_id
      WHERE sh.user_id = $1
      ORDER BY sh.created_at DESC
      LIMIT 20
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Subscription history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// STRIPE PAYMENT GATEWAY
// =============================================

/**
 * @swagger
 * /billing/checkout:
 *   post:
 *     summary: Create Stripe checkout session for wallet top-up or subscription
 *     tags: [Billing]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amountUSD: { type: number, description: "USD amount to charge if wallet topup" }
 *               planId: { type: string, description: "Plan key if subscription" }
 *     responses:
 *       200:
 *         description: Stripe Session URL returned
 */
router.post('/checkout', async (req, res) => {
  try {
    const { amountUSD, planId } = req.body;
    let lineItems = [];
    
    // Allow either custom topup amount or explicit plan
    if (planId) {
      const planRes = await pool.query('SELECT * FROM membership_plans WHERE plan_key = $1 AND is_active = true', [planId]);
      if (planRes.rows.length === 0) return res.status(400).json({ error: 'Invalid plan' });
      
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: `NexusFX Subscription: ${planRes.rows[0].plan_name}` },
          unit_amount: Math.round(planRes.rows[0].monthly_price * 100), // cents
        },
        quantity: 1,
      });
    } else if (amountUSD && amountUSD > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: 'NexusFX Wallet Top-up (USD)' },
          unit_amount: Math.round(amountUSD * 100), // cents
        },
        quantity: 1,
      });
    } else {
      return res.status(400).json({ error: 'Must provide amountUSD or planId' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/wallet?payment=success`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/wallet?payment=cancelled`,
      client_reference_id: req.user.id.toString(), // identify user
      metadata: {
        userId: req.user.id,
        type: planId ? 'SUBSCRIPTION' : 'TOPUP',
        planId: planId || '',
        amountUSD: amountUSD || 0
      }
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    res.status(500).json({ error: err.message });
  }
});

// =============================================
// PROFIT SHARING (Level 2)
// =============================================

/**
 * @swagger
 * /billing/profit-sharing/calculate:
 *   post:
 *     summary: Calculate profit sharing for a group (leader only)
 *     tags: [Billing]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               group_id: { type: integer }
 *               period_days: { type: integer, default: 30 }
 *               share_percentage: { type: number, default: 20 }
 *     responses:
 *       200:
 *         description: Profit sharing calculation result
 */
router.post('/profit-sharing/calculate', async (req, res) => {
  try {
    const { group_id, period_days = 30, share_percentage = 20 } = req.body;

    if (!group_id) {
      return res.status(400).json({ error: 'group_id is required' });
    }

    // Verify group ownership
    const group = await pool.query(
      'SELECT * FROM groups WHERE id = $1 AND lead_user_id = $2',
      [group_id, req.user.id]
    );
    if (group.rows.length === 0) {
      return res.status(403).json({ error: 'Only group leader can calculate profit sharing' });
    }

    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - period_days);
    const periodEnd = new Date();

    // Get each member's PnL for the period
    const membersPerf = await pool.query(`
      SELECT gm.user_id, u.display_name, u.username,
             COALESCE(SUM(t.pnl), 0) as total_pnl
      FROM group_members gm
      JOIN users u ON u.id = gm.user_id
      LEFT JOIN accounts a ON a.user_id = gm.user_id
      LEFT JOIN trades t ON t.account_id = a.id 
        AND t.status = 'CLOSED'
        AND t.closed_at >= $2
        AND t.closed_at <= $3
      WHERE gm.group_id = $1
      GROUP BY gm.user_id, u.display_name, u.username
    `, [group_id, periodStart.toISOString(), periodEnd.toISOString()]);

    const results = membersPerf.rows.map(member => {
      const pnl = parseFloat(member.total_pnl);
      const leaderShare = pnl > 0 ? (pnl * share_percentage / 100) : 0;
      const memberNet = pnl - leaderShare;
      
      return {
        user_id: member.user_id,
        display_name: member.display_name,
        username: member.username,
        total_pnl: pnl,
        share_percentage,
        leader_share: parseFloat(leaderShare.toFixed(2)),
        member_net: parseFloat(memberNet.toFixed(2)),
      };
    });

    const totalLeaderShare = results.reduce((s, r) => s + r.leader_share, 0);
    const totalGroupPnl = results.reduce((s, r) => s + r.total_pnl, 0);

    res.json({
      group_id,
      group_name: group.rows[0].group_name,
      period_start: periodStart.toISOString().split('T')[0],
      period_end: periodEnd.toISOString().split('T')[0],
      share_percentage,
      members: results,
      summary: {
        total_group_pnl: parseFloat(totalGroupPnl.toFixed(2)),
        total_leader_share: parseFloat(totalLeaderShare.toFixed(2)),
        members_with_profit: results.filter(r => r.total_pnl > 0).length,
        members_with_loss: results.filter(r => r.total_pnl < 0).length,
      }
    });
  } catch (err) {
    console.error('Profit sharing calc error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/billing/profit-sharing/settle — save and settle profit sharing
router.post('/profit-sharing/settle', auditLog('SETTLE_PROFIT_SHARING', 'GROUP'), async (req, res) => {
  try {
    const { group_id, members, period_start, period_end, share_percentage } = req.body;

    if (!group_id || !members || !Array.isArray(members)) {
      return res.status(400).json({ error: 'group_id and members array required' });
    }

    // Verify ownership
    const group = await pool.query(
      'SELECT * FROM groups WHERE id = $1 AND lead_user_id = $2',
      [group_id, req.user.id]
    );
    if (group.rows.length === 0) {
      return res.status(403).json({ error: 'Only group leader can settle profit sharing' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Get leader's USD wallet
      const leaderWalletRes = await client.query(
        'SELECT id FROM wallets WHERE user_id = $1 AND currency = $2 FOR UPDATE',
        [req.user.id, 'USD']
      );
      if (leaderWalletRes.rows.length === 0) throw new Error('Leader USD wallet not found');
      const leaderWalletId = leaderWalletRes.rows[0].id;

      let settled = 0;
      const notifications = [];
      const leaderName = req.user.username || 'Leader';

      for (const m of members) {
        if (m.leader_share > 0) {
          // Get member's USD wallet
          const memberWalletRes = await client.query(
            'SELECT id, balance FROM wallets WHERE user_id = $1 AND currency = $2 FOR UPDATE',
            [m.user_id, 'USD']
          );
          if (memberWalletRes.rows.length === 0) {
             throw new Error(`Member ${m.username || m.user_id} does not have a USD wallet.`);
          }
          const memberWalletId = memberWalletRes.rows[0].id;
          
          if (memberWalletRes.rows[0].balance < m.leader_share) {
             throw new Error(`Member ${m.username || m.user_id} has insufficient USD balance. Required: $${m.leader_share}, Available: $${memberWalletRes.rows[0].balance}`);
          }

          // Deduct from member
          await client.query(
            'UPDATE wallets SET balance = balance - $1 WHERE id = $2',
            [m.leader_share, memberWalletId]
          );

          // Record deduction transaction
          await client.query(
            `INSERT INTO financial_transactions (wallet_id, user_id, type, amount, status, note, completed_at)
             VALUES ($1, $2, 'FEE', $3, 'COMPLETED', $4, NOW())`,
            [memberWalletId, m.user_id, -m.leader_share, `Profit share paid to leader of '${group.rows[0].group_name}'`]
          );

          // Add to leader
          await client.query(
            'UPDATE wallets SET balance = balance + $1 WHERE id = $2',
            [m.leader_share, leaderWalletId]
          );

          // Record earning transaction
          await client.query(
            `INSERT INTO financial_transactions (wallet_id, user_id, type, amount, status, note, completed_at)
             VALUES ($1, $2, 'REWARD', $3, 'COMPLETED', $4, NOW())`,
            [leaderWalletId, req.user.id, m.leader_share, `Profit share received from member '${m.username || m.user_id}'`]
          );

          // Mark as settled in profit sharing logs
          await client.query(`
            INSERT INTO profit_sharing_logs 
              (group_id, leader_user_id, member_user_id, period_start, period_end, 
               member_pnl, share_percentage, leader_share, member_net, status, settled_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'SETTLED', NOW())
          `, [group_id, req.user.id, m.user_id, period_start, period_end,
              m.total_pnl, share_percentage || 20, m.leader_share, m.member_net]);
              
          notifications.push({
            leaderId: req.user.id,
            memberId: m.user_id,
            memberName: m.username || m.user_id,
            amount: m.leader_share,
            groupName: group.rows[0].group_name
          });

          settled++;
        }
      }

      await client.query('COMMIT');
      res.json({ success: true, settled_members: settled });

      // Send telegram notifications AFTER successful commit
      for (const msg of notifications) {
        // To Leader
        TelegramNotify.sendAlert(
          msg.leaderId,
          `💸 *ได้รับค่าส่วนแบ่งกำไร (Profit Sharing)*\nกลุ่ม: ${msg.groupName}\nจาก: ${msg.memberName}\nยอดเงิน: +$${Number(msg.amount).toFixed(2)}\nโอนเข้า USD Wallet เรียบร้อยแล้ว`
        ).catch(err => console.error('[Telegram] Leader PS notify failed:', err.message));

        // To Member
        TelegramNotify.sendAlert(
          msg.memberId,
          `📉 *จ่ายค่าส่วนแบ่งกำไร (Profit Sharing)*\nกลุ่ม: ${msg.groupName}\nจ่ายให้: ${leaderName}\nยอดเงิน: -$${Number(msg.amount).toFixed(2)}\nหักจาก USD Wallet เรียบร้อยแล้ว`
        ).catch(err => console.error('[Telegram] Member PS notify failed:', err.message));
      }
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Profit sharing settle error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/billing/profit-sharing/history
router.get('/profit-sharing/history', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ps.*, g.group_name, u.display_name as member_name
      FROM profit_sharing_logs ps
      JOIN groups g ON g.id = ps.group_id
      JOIN users u ON u.id = ps.member_user_id
      WHERE ps.leader_user_id = $1
      ORDER BY ps.created_at DESC
      LIMIT 50
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Profit sharing history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
