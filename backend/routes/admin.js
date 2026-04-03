const express = require('express');
const { pool } = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);
router.use(requireRole('admin'));

// =============================================
// DASHBOARD (Admin Overview)
// =============================================

// GET /api/admin/overview — system stats
router.get('/overview', async (req, res) => {
  try {
    const [usersCount, activeTraders, totalTrades, totalPnl, groupsCount, revenue] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users WHERE is_active = true'),
      pool.query(`SELECT COUNT(DISTINCT a.user_id) FROM accounts a WHERE a.is_active = true`),
      pool.query('SELECT COUNT(*) FROM trades'),
      pool.query('SELECT COALESCE(SUM(pnl), 0) as total FROM trades WHERE status = \'CLOSED\''),
      pool.query('SELECT COUNT(*) FROM groups WHERE is_active = true'),
      pool.query(`SELECT 
        COALESCE(SUM(CASE WHEN type = 'FEE' THEN amount ELSE 0 END), 0) as total_fees,
        COALESCE(SUM(CASE WHEN type = 'DEPOSIT' THEN amount ELSE 0 END), 0) as total_deposits,
        COALESCE(SUM(CASE WHEN type = 'WITHDRAW' THEN amount ELSE 0 END), 0) as total_withdrawals
       FROM financial_transactions WHERE status = 'COMPLETED'`),
    ]);

    res.json({
      total_users: parseInt(usersCount.rows[0].count),
      active_traders: parseInt(activeTraders.rows[0].count),
      total_trades: parseInt(totalTrades.rows[0].count),
      total_pnl: parseFloat(totalPnl.rows[0].total),
      total_groups: parseInt(groupsCount.rows[0].count),
      revenue: {
        total_fees: parseFloat(revenue.rows[0].total_fees),
        total_deposits: parseFloat(revenue.rows[0].total_deposits),
        total_withdrawals: parseFloat(revenue.rows[0].total_withdrawals),
      }
    });
  } catch (err) {
    console.error('Admin overview error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// USER MANAGEMENT
// =============================================

// GET /api/admin/users — list all users
router.get('/users', async (req, res) => {
  try {
    const { search, role, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = '1=1';
    const params = [];
    let idx = 1;

    if (search) {
      where += ` AND (u.username ILIKE $${idx} OR u.email ILIKE $${idx} OR u.display_name ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }
    if (role) {
      where += ` AND r.role_name = $${idx}`;
      params.push(role);
      idx++;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE ${where}`,
      params
    );

    params.push(parseInt(limit), offset);
    const result = await pool.query(
      `SELECT u.id, u.username, u.email, u.display_name, u.avatar_url, u.is_active,
              u.last_login_at, u.created_at, r.role_name as role,
              (SELECT COUNT(*) FROM accounts a WHERE a.user_id = u.id AND a.is_active = true) as accounts_count,
              (SELECT COALESCE(SUM(t.pnl), 0) FROM trades t JOIN accounts a ON a.id = t.account_id WHERE a.user_id = u.id AND t.status = 'CLOSED') as total_pnl
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE ${where}
       ORDER BY u.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      params
    );

    res.json({
      users: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/users/:id — update user (role, active status)
router.put('/users/:id', async (req, res) => {
  try {
    const { role_name, is_active, display_name } = req.body;
    let roleId = null;

    if (role_name) {
      const roleResult = await pool.query('SELECT id FROM roles WHERE role_name = $1', [role_name]);
      if (roleResult.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      roleId = roleResult.rows[0].id;
    }

    const result = await pool.query(
      `UPDATE users SET
        role_id = COALESCE($1, role_id),
        is_active = COALESCE($2, is_active),
        display_name = COALESCE($3, display_name),
        updated_at = NOW()
       WHERE id = $4 RETURNING id, username, email, display_name, is_active`,
      [roleId, is_active, display_name, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Log admin action
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'admin.update_user', 'user', $2, $3)`,
      [req.user.id, req.params.id, JSON.stringify(req.body)]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Admin update user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/users/:id/adjust-balance — Maker-Checker Balance adjustment request
router.post('/users/:id/adjust-balance', async (req, res) => {
  const client = await pool.connect();
  try {
    const { amount, reason } = req.body;
    const adjustAmount = parseFloat(amount);
    
    if (isNaN(adjustAmount) || adjustAmount === 0) {
      return res.status(400).json({ error: 'Valid amount required (not zero)' });
    }
    if (!reason || reason.trim() === '') {
      return res.status(400).json({ error: 'Reason is required for manual adjustment' });
    }

    await client.query('BEGIN');

    // Get user's wallet
    const walletRes = await client.query('SELECT id, balance FROM wallets WHERE user_id = $1 AND currency = $2 FOR UPDATE', [req.params.id, 'USD']);
    if (walletRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User wallet not found' });
    }
    const walletId = walletRes.rows[0].id;

    if (req.user.role === 'super_admin' || req.user.role === 'team_lead') {
      // Auto-approve logic for high-level roles
      const updatedWallet = await client.query(
        'UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE id = $2 RETURNING balance',
        [adjustAmount, walletId]
      );

      const type = adjustAmount > 0 ? 'DEPOSIT' : 'WITHDRAW';
      await client.query(
        `INSERT INTO financial_transactions (wallet_id, user_id, type, amount, status, note, completed_at) 
         VALUES ($1, $2, $3, $4, 'COMPLETED', $5, NOW())`,
        [walletId, req.params.id, type, Math.abs(adjustAmount), `Manual Adjustment (Admin): ${reason}`]
      );

      await client.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES ($1, 'admin.adjust_balance', 'user', $2, $3)`,
        [req.user.id, req.params.id, JSON.stringify({ adjust_amount: adjustAmount, reason, auto_approved: true })]
      );

      await client.query(
        `INSERT INTO balance_adjustments (user_id, requested_by, approved_by, amount, reason, status) 
         VALUES ($1, $2, $3, $4, $5, 'APPROVED')`,
        [req.params.id, req.user.id, req.user.id, adjustAmount, reason]
      );

      await client.query('COMMIT');
      return res.json({ success: true, new_balance: updatedWallet.rows[0].balance, status: 'APPROVED' });
    } else {
      // Maker flow: Create a PENDING request.
      await client.query(
        `INSERT INTO balance_adjustments (user_id, requested_by, amount, reason, status) 
         VALUES ($1, $2, $3, $4, 'PENDING')`,
        [req.params.id, req.user.id, adjustAmount, reason]
      );

      await client.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES ($1, 'admin.adjust_balance_request', 'user', $2, $3)`,
        [req.user.id, req.params.id, JSON.stringify({ adjust_amount: adjustAmount, reason, status: 'PENDING' })]
      );

      await client.query('COMMIT');
      return res.json({ success: true, status: 'PENDING', message: 'Balance adjustment request submitted for approval.' });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Admin adjust balance error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /api/admin/adjustments
router.get('/adjustments', async (req, res) => {
  try {
    const status = req.query.status || 'PENDING';
    const result = await pool.query(`
      SELECT ba.*, 
             u1.username as target_username, u1.email as target_email, 
             u2.username as requested_by_username,
             u3.username as approved_by_username
      FROM balance_adjustments ba
      JOIN users u1 ON ba.user_id = u1.id
      JOIN users u2 ON ba.requested_by = u2.id
      LEFT JOIN users u3 ON ba.approved_by = u3.id
      WHERE ba.status = $1
      ORDER BY ba.created_at DESC
      LIMIT 100
    `, [status]);
    res.json(result.rows);
  } catch (err) {
    console.error('List adjustments error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/adjustments/:id/approve
router.post('/adjustments/:id/approve', async (req, res) => {
  if (req.user.role !== 'super_admin' && req.user.role !== 'team_lead') {
    return res.status(403).json({ error: 'Insufficient permissions to approve adjustments' });
  }

  const client = await pool.connect();
  try {
    const { action } = req.body; // 'APPROVE' or 'REJECT'
    const status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    await client.query('BEGIN');
    const reqRes = await client.query('SELECT * FROM balance_adjustments WHERE id = $1 AND status = $2 FOR UPDATE', [req.params.id, 'PENDING']);
    if (reqRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Adjustment request not found or already processed' });
    }
    const adjustment = reqRes.rows[0];

    await client.query('UPDATE balance_adjustments SET status = $1, approved_by = $2, updated_at = NOW() WHERE id = $3', [status, req.user.id, adjustment.id]);

    if (action === 'APPROVE') {
      const walletRes = await client.query('SELECT id, balance FROM wallets WHERE user_id = $1 AND currency = $2 FOR UPDATE', [adjustment.user_id, 'USD']);
      if (walletRes.rows.length > 0) {
        const walletId = walletRes.rows[0].id;
        const adjustAmount = parseFloat(adjustment.amount);
        
        await client.query(
          'UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE id = $2',
          [adjustAmount, walletId]
        );

        const type = adjustAmount > 0 ? 'DEPOSIT' : 'WITHDRAW';
        await client.query(
          `INSERT INTO financial_transactions (wallet_id, user_id, type, amount, status, note, completed_at) 
           VALUES ($1, $2, $3, $4, 'COMPLETED', $5, NOW())`,
          [walletId, adjustment.user_id, type, Math.abs(adjustAmount), `Manual Adjustment (Approved): ${adjustment.reason}`]
        );
      }
    }

    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, 'balance_adjustment', $3, $4)`,
      [req.user.id, action === 'APPROVE' ? 'admin.approve_adjustment' : 'admin.reject_adjustment', adjustment.id, JSON.stringify({ adjust_amount: adjustment.amount, target_user: adjustment.user_id })]
    );

    await client.query('COMMIT');
    res.json({ success: true, status });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Approve adjustment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// =============================================
// AUDIT LOGS
// =============================================

// GET /api/admin/audit-logs
router.get('/audit-logs', async (req, res) => {
  try {
    const { user_id, action, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = '1=1';
    const params = [];
    let idx = 1;

    if (user_id) {
      where += ` AND al.user_id = $${idx++}`;
      params.push(parseInt(user_id));
    }
    if (action) {
      where += ` AND al.action ILIKE $${idx++}`;
      params.push(`%${action}%`);
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM audit_logs al WHERE ${where}`,
      params
    );

    params.push(parseInt(limit), offset);
    const result = await pool.query(
      `SELECT al.*, u.username, u.display_name
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       WHERE ${where}
       ORDER BY al.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      params
    );

    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error('Audit logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// REVENUE & FEES
// =============================================

// GET /api/admin/revenue
router.get('/revenue', async (req, res) => {
  try {
    const { period = '30' } = req.query;

    // Daily revenue for chart
    const dailyRevenue = await pool.query(
      `SELECT DATE(created_at) as date,
              SUM(CASE WHEN fee_type = 'SUCCESS_FEE' THEN amount ELSE 0 END) as success_fees,
              SUM(CASE WHEN fee_type = 'TRADING_FEE' THEN amount ELSE 0 END) as trading_fees,
              SUM(amount) as total
       FROM service_fee_logs
       WHERE created_at >= NOW() - INTERVAL '1 day' * $1
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [parseInt(period)]
    );

    // Summary
    const summary = await pool.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN fee_type = 'SUCCESS_FEE' THEN amount ELSE 0 END), 0) as total_success_fees,
        COALESCE(SUM(CASE WHEN fee_type = 'TRADING_FEE' THEN amount ELSE 0 END), 0) as total_trading_fees,
        COALESCE(SUM(amount), 0) as total_revenue
       FROM service_fee_logs
       WHERE created_at >= NOW() - INTERVAL '1 day' * $1`,
      [parseInt(period)]
    );

    res.json({
      daily: dailyRevenue.rows,
      summary: summary.rows[0]
    });
  } catch (err) {
    console.error('Revenue error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// ROLES MANAGEMENT
// =============================================
router.get('/roles', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, 
        (SELECT COUNT(*) FROM users WHERE role_id = r.id) as user_count
       FROM roles r ORDER BY r.id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Roles error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// CRISIS MANAGEMENT (Kill Switch)
// =============================================
router.post('/kill-switch', async (req, res) => {
  try {
    const { reason, password } = req.body;
    
    // Very basic check, in production you'd verify admin password here
    if (!reason) {
      return res.status(400).json({ error: 'Reason for Kill Switch is required.' });
    }

    await pool.query('BEGIN');

    // 1. Stop all active bots
    const botResult = await pool.query(
      `UPDATE trading_bots 
       SET is_active = false, status = 'STOPPED', updated_at = NOW() 
       WHERE is_active = true 
       RETURNING id`
    );

    // 2. Cancel all pending orders
    const orderResult = await pool.query(
      `UPDATE orders 
       SET status = 'CANCELLED', cancelled_at = NOW() 
       WHERE status = 'PENDING' 
       RETURNING id`
    );

    // 3. Log the crisis action
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, details, ip_address)
       VALUES ($1, 'admin.kill_switch_activated', 'system', $2, $3)`,
      [req.user.id, JSON.stringify({ reason, bots_stopped: botResult.rowCount, orders_cancelled: orderResult.rowCount }), req.ip]
    );

    await pool.query('COMMIT');

    res.json({ 
      success: true, 
      message: 'Kill Switch Activated successfully.', 
      bots_stopped: botResult.rowCount, 
      orders_cancelled: orderResult.rowCount 
    });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Kill switch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// SYSTEM CONFIGURATION (Category-based with secret masking)
// =============================================
router.get('/system-config', async (req, res) => {
  try {
    const { category } = req.query;
    let query = 'SELECT key, value, description, category, is_secret FROM system_config';
    const params = [];
    if (category) {
      query += ' WHERE category = $1';
      params.push(category);
    }
    query += ' ORDER BY category, key';
    const result = await pool.query(query, params);
    
    // Mask secret values — only show last 4 chars
    const masked = result.rows.map(row => ({
      ...row,
      value: row.is_secret && row.value 
        ? (row.value.length > 4 ? '••••••••' + row.value.slice(-4) : '••••') 
        : row.value
    }));
    
    res.json(masked);
  } catch (err) {
    if (err.code === '42P01') {
      res.json([]); // Table doesn't exist yet
    } else {
      console.error('System config get error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// GET /api/admin/system-config/categories — list all categories
router.get('/system-config/categories', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT category, COUNT(*) as count FROM system_config GROUP BY category ORDER BY category`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('System config categories error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/system-config', async (req, res) => {
  try {
    const { key, value } = req.body;
    
    // If the value is masked (starts with ••), don't update — user didn't change the secret
    if (value && value.startsWith('••')) {
      return res.json({ success: true, message: 'No changes (masked value)' });
    }
    
    await pool.query(
      `INSERT INTO system_config (key, value) 
       VALUES ($1, $2) 
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, value]
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, details, ip_address)
       VALUES ($1, 'admin.update_system_config', 'system', $2, $3)`,
      [req.user.id, JSON.stringify({ key }), req.ip]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('System config update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/system-config/bulk — update multiple configs at once
router.put('/system-config/bulk', async (req, res) => {
  const client = await pool.connect();
  try {
    const { configs } = req.body; // [{ key, value }]
    if (!Array.isArray(configs)) return res.status(400).json({ error: 'configs must be an array' });
    
    await client.query('BEGIN');
    let updated = 0;
    for (const { key, value } of configs) {
      if (value && value.startsWith('••')) continue; // Skip masked secrets
      await client.query(
        `INSERT INTO system_config (key, value) 
         VALUES ($1, $2) 
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, value]
      );
      updated++;
    }
    
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, details, ip_address)
       VALUES ($1, 'admin.bulk_update_system_config', 'system', $2, $3)`,
      [req.user.id, JSON.stringify({ updated_count: updated }), req.ip]
    );
    await client.query('COMMIT');
    res.json({ success: true, updated });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('System config bulk update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// =============================================
// AGENT / B2B MANAGEMENT
// =============================================

// GET /api/admin/agents — list all agents
router.get('/agents', async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = `r.role_name = 'agent'`;
    const params = [];
    let idx = 1;

    if (search) {
      where += ` AND (u.username ILIKE $${idx} OR u.email ILIKE $${idx} OR u.display_name ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id WHERE ${where}`,
      params
    );

    params.push(parseInt(limit), offset);
    const result = await pool.query(
      `SELECT u.id, u.username, u.email, u.display_name, u.is_active, u.created_at,
              t.id as tenant_id, t.name as tenant_name, t.platform_name, t.domain,
              t.revenue_share_pct, t.max_users, t.logo_url, t.primary_color,
              (SELECT COUNT(*) FROM users m WHERE m.tenant_id = t.id AND m.id != u.id) as member_count,
              (SELECT COALESCE(SUM(ac.amount), 0) FROM agent_commissions ac WHERE ac.agent_user_id = u.id) as total_commission
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN tenants t ON t.owner_user_id = u.id
       WHERE ${where}
       ORDER BY u.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      params
    );

    res.json({
      agents: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error('Admin list agents error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/agents — create a new agent (promote user to agent + create tenant)
router.post('/agents', async (req, res) => {
  try {
    const { user_id, tenant_name, platform_name, domain, revenue_share_pct = 10, max_users = 50, contact_email, contact_phone } = req.body;

    if (!user_id || !tenant_name) {
      return res.status(400).json({ error: 'user_id and tenant_name are required' });
    }

    // Check user exists
    const userCheck = await pool.query('SELECT id, username FROM users WHERE id = $1', [user_id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    }

    await pool.query('BEGIN');

    // 1. Set user role to agent
    const agentRole = await pool.query(`SELECT id FROM roles WHERE role_name = 'agent'`);
    if (agentRole.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(500).json({ error: 'Agent role not found in database' });
    }

    await pool.query(
      `UPDATE users SET role_id = $1, updated_at = NOW() WHERE id = $2`,
      [agentRole.rows[0].id, user_id]
    );

    // 2. Create tenant
    const tenantResult = await pool.query(
      `INSERT INTO tenants (name, platform_name, domain, owner_user_id, revenue_share_pct, max_users, contact_email, contact_phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [tenant_name, platform_name || tenant_name, domain || null, user_id, revenue_share_pct, max_users, contact_email || null, contact_phone || null]
    );

    // 3. Assign tenant_id to the agent user themselves too
    await pool.query(
      `UPDATE users SET tenant_id = $1 WHERE id = $2`,
      [tenantResult.rows[0].id, user_id]
    );

    // 4. Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'admin.create_agent', 'tenant', $2, $3)`,
      [req.user.id, tenantResult.rows[0].id, JSON.stringify({ user_id, tenant_name })]
    );

    await pool.query('COMMIT');

    res.status(201).json({
      agent: userCheck.rows[0],
      tenant: tenantResult.rows[0],
    });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Admin create agent error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/agents/:userId — update agent tenant config
router.put('/agents/:userId', async (req, res) => {
  try {
    const { revenue_share_pct, max_users, is_active, platform_name, domain, contact_email, contact_phone } = req.body;

    const result = await pool.query(
      `UPDATE tenants SET
        revenue_share_pct = COALESCE($1, revenue_share_pct),
        max_users = COALESCE($2, max_users),
        is_active = COALESCE($3, is_active),
        platform_name = COALESCE($4, platform_name),
        domain = COALESCE($5, domain),
        contact_email = COALESCE($6, contact_email),
        contact_phone = COALESCE($7, contact_phone),
        updated_at = NOW()
       WHERE owner_user_id = $8
       RETURNING *`,
      [revenue_share_pct, max_users, is_active, platform_name, domain, contact_email, contact_phone, req.params.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบ Tenant ของ Agent นี้' });
    }

    // Audit
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'admin.update_agent', 'tenant', $2, $3)`,
      [req.user.id, result.rows[0].id, JSON.stringify(req.body)]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Admin update agent error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/agents/:userId/stats — agent statistics
router.get('/agents/:userId/stats', async (req, res) => {
  try {
    const tenant = await pool.query(
      `SELECT * FROM tenants WHERE owner_user_id = $1`,
      [req.params.userId]
    );
    if (tenant.rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบ Tenant ของ Agent นี้' });
    }
    const tenantId = tenant.rows[0].id;

    const [members, trades, commissions, invites] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) as total, 
                COUNT(CASE WHEN is_active THEN 1 END) as active,
                COUNT(CASE WHEN NOT is_active THEN 1 END) as inactive
         FROM users WHERE tenant_id = $1 AND id != $2`,
        [tenantId, req.params.userId]
      ),
      pool.query(
        `SELECT 
           COALESCE(SUM(t.pnl), 0) as total_pnl,
           COUNT(t.id) as total_trades,
           COUNT(CASE WHEN t.pnl > 0 THEN 1 END) as winning,
           COUNT(CASE WHEN t.pnl < 0 THEN 1 END) as losing
         FROM trades t
         JOIN accounts a ON a.id = t.account_id
         JOIN users u ON u.id = a.user_id
         WHERE u.tenant_id = $1 AND t.status = 'CLOSED'`,
        [tenantId]
      ),
      pool.query(
        `SELECT 
           COALESCE(SUM(amount), 0) as total,
           COALESCE(SUM(CASE WHEN status = 'SETTLED' THEN amount ELSE 0 END), 0) as settled,
           COALESCE(SUM(CASE WHEN status = 'PENDING' THEN amount ELSE 0 END), 0) as pending
         FROM agent_commissions WHERE agent_user_id = $1`,
        [req.params.userId]
      ),
      pool.query(
        `SELECT COUNT(*) as total, 
                COUNT(CASE WHEN is_active AND expires_at > NOW() THEN 1 END) as active
         FROM agent_invitations WHERE tenant_id = $1`,
        [tenantId]
      ),
    ]);

    res.json({
      tenant: tenant.rows[0],
      members: members.rows[0],
      trades: trades.rows[0],
      commissions: commissions.rows[0],
      invitations: invites.rows[0],
    });
  } catch (err) {
    console.error('Agent stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// POST /api/admin/agents/:userId/settle — Settle commissions for agent
// =============================================
router.post('/agents/:userId/settle', async (req, res) => {
  try {
    const commissionEngine = require('../services/commissionEngine');
    const result = await commissionEngine.settlePendingCommissions(parseInt(req.params.userId));
    
    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES ($1, 'settle_commissions', $2, $3)`,
      [req.user.id, JSON.stringify({ agent_user_id: req.params.userId, ...result }), req.ip]
    );

    res.json(result);
  } catch (err) {
    console.error('Settle commissions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// POST /api/admin/commissions/calculate — Trigger manual commission calc
// =============================================
router.post('/commissions/calculate', async (req, res) => {
  try {
    const commissionEngine = require('../services/commissionEngine');
    await commissionEngine.run();
    res.json({ message: 'คำนวณค่าคอมมิชชั่นเรียบร้อยแล้ว', status: commissionEngine.getStatus() });
  } catch (err) {
    console.error('Manual commission calc error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// GET /api/admin/commissions/status — Commission engine status
// =============================================
router.get('/commissions/status', async (req, res) => {
  try {
    const commissionEngine = require('../services/commissionEngine');
    const dbStats = await pool.query(`
      SELECT 
        COUNT(*) as total_commissions,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN status = 'PENDING' THEN amount ELSE 0 END), 0) as pending_amount,
        COALESCE(SUM(CASE WHEN status = 'SETTLED' THEN amount ELSE 0 END), 0) as settled_amount,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'SETTLED' THEN 1 END) as settled_count
      FROM agent_commissions
    `);

    res.json({
      engine: commissionEngine.getStatus(),
      stats: dbStats.rows[0],
    });
  } catch (err) {
    console.error('Commission status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

