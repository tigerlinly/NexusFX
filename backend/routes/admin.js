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

module.exports = router;
