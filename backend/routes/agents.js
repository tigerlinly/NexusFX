const express = require('express');
const crypto = require('crypto');
const { pool } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// =============================================
// Middleware: Verify user is an agent
// =============================================
const agentMiddleware = async (req, res, next) => {
  try {
    const roleResult = await pool.query(
      `SELECT r.role_name FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [req.user.id]
    );
    const role = roleResult.rows[0]?.role_name;
    if (!['agent', 'admin', 'super_admin'].includes(role)) {
      return res.status(403).json({ error: 'ต้องมีสิทธิ์ระดับ Agent ขึ้นไป' });
    }
    req.userRole = role;
    next();
  } catch (err) {
    console.error('Agent middleware error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Helper: Get agent's tenant
async function getAgentTenant(userId) {
  const result = await pool.query(
    `SELECT t.* FROM tenants t WHERE t.owner_user_id = $1 AND t.is_active = true`,
    [userId]
  );
  return result.rows[0] || null;
}

// =============================================
// GET /api/agents/my-tenant — Agent's tenant info
// =============================================
router.get('/my-tenant', authMiddleware, agentMiddleware, async (req, res) => {
  try {
    const tenant = await getAgentTenant(req.user.id);
    if (!tenant) {
      return res.status(404).json({ error: 'ยังไม่มี Tenant ที่ผูกกับบัญชีนี้' });
    }

    // Count members
    const memberCount = await pool.query(
      `SELECT COUNT(*) as count FROM users WHERE tenant_id = $1 AND is_active = true`,
      [tenant.id]
    );

    res.json({
      ...tenant,
      member_count: parseInt(memberCount.rows[0].count) || 0,
    });
  } catch (err) {
    console.error('Get my tenant error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// GET /api/agents/my-team — List team members
// =============================================
router.get('/my-team', authMiddleware, agentMiddleware, async (req, res) => {
  try {
    const tenant = await getAgentTenant(req.user.id);
    if (!tenant) {
      return res.status(404).json({ error: 'ยังไม่มี Tenant' });
    }

    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = `u.tenant_id = $1 AND u.id != $2`;
    const params = [tenant.id, req.user.id];

    if (search) {
      whereClause += ` AND (u.username ILIKE $3 OR u.email ILIKE $3 OR u.display_name ILIKE $3)`;
      params.push(`%${search}%`);
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM users u WHERE ${whereClause}`,
      params
    );

    const members = await pool.query(
      `SELECT u.id, u.username, u.email, u.display_name, u.avatar_url,
              u.is_active, u.last_login_at, u.created_at,
              r.role_name as role,
              COALESCE(
                (SELECT SUM(t.pnl) FROM trades t
                 JOIN accounts a ON a.id = t.account_id
                 WHERE a.user_id = u.id AND t.status = 'CLOSED'), 0
              ) as total_pnl,
              COALESCE(
                (SELECT COUNT(*) FROM trades t
                 JOIN accounts a ON a.id = t.account_id
                 WHERE a.user_id = u.id AND t.status = 'CLOSED'), 0
              ) as total_trades
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      members: members.rows,
      total: parseInt(countResult.rows[0].total),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error('Get my team error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// GET /api/agents/team-performance — Team dashboard
// =============================================
router.get('/team-performance', authMiddleware, agentMiddleware, async (req, res) => {
  try {
    const tenant = await getAgentTenant(req.user.id);
    if (!tenant) {
      return res.status(404).json({ error: 'ยังไม่มี Tenant' });
    }

    const { period = '30' } = req.query;
    const days = parseInt(period) || 30;

    // Active members count
    const activeMembers = await pool.query(
      `SELECT COUNT(*) as count FROM users WHERE tenant_id = $1 AND is_active = true AND id != $2`,
      [tenant.id, req.user.id]
    );

    // Total PnL across all team members
    const teamPnl = await pool.query(
      `SELECT 
        COALESCE(SUM(t.pnl), 0) as total_pnl,
        COUNT(t.id) as total_trades,
        COALESCE(SUM(CASE WHEN t.pnl > 0 THEN t.pnl ELSE 0 END), 0) as total_profit,
        COALESCE(SUM(CASE WHEN t.pnl < 0 THEN t.pnl ELSE 0 END), 0) as total_loss,
        COUNT(CASE WHEN t.pnl > 0 THEN 1 END) as winning_trades,
        COUNT(CASE WHEN t.pnl < 0 THEN 1 END) as losing_trades
       FROM trades t
       JOIN accounts a ON a.id = t.account_id
       JOIN users u ON u.id = a.user_id
       WHERE u.tenant_id = $1 AND t.status = 'CLOSED'
         AND t.closed_at >= NOW() - INTERVAL '${days} days'`,
      [tenant.id]
    );

    // Today's PnL (Asia/Bangkok)
    const todayPnl = await pool.query(
      `SELECT COALESCE(SUM(t.pnl), 0) as today_pnl
       FROM trades t
       JOIN accounts a ON a.id = t.account_id
       JOIN users u ON u.id = a.user_id
       WHERE u.tenant_id = $1 AND t.status = 'CLOSED'
         AND t.closed_at >= (NOW() AT TIME ZONE 'Asia/Bangkok')::date`,
      [tenant.id]
    );

    // Total commissions
    const commissions = await pool.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN status = 'SETTLED' THEN amount ELSE 0 END), 0) as total_settled,
        COALESCE(SUM(CASE WHEN status = 'PENDING' THEN amount ELSE 0 END), 0) as total_pending
       FROM agent_commissions
       WHERE agent_user_id = $1`,
      [req.user.id]
    );

    // PnL chart data by day
    const chartData = await pool.query(
      `SELECT 
        DATE(t.closed_at AT TIME ZONE 'Asia/Bangkok') as date,
        COALESCE(SUM(t.pnl), 0) as pnl,
        COUNT(t.id) as trades
       FROM trades t
       JOIN accounts a ON a.id = t.account_id
       JOIN users u ON u.id = a.user_id
       WHERE u.tenant_id = $1 AND t.status = 'CLOSED'
         AND t.closed_at >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(t.closed_at AT TIME ZONE 'Asia/Bangkok')
       ORDER BY date`,
      [tenant.id]
    );

    // Top performers
    const topPerformers = await pool.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url,
              COALESCE(SUM(t.pnl), 0) as total_pnl,
              COUNT(t.id) as total_trades
       FROM users u
       JOIN accounts a ON a.user_id = u.id
       JOIN trades t ON t.account_id = a.id
       WHERE u.tenant_id = $1 AND t.status = 'CLOSED'
         AND t.closed_at >= NOW() - INTERVAL '${days} days'
       GROUP BY u.id, u.username, u.display_name, u.avatar_url
       ORDER BY total_pnl DESC
       LIMIT 5`,
      [tenant.id]
    );

    const stats = teamPnl.rows[0];
    const winRate = stats.total_trades > 0
      ? ((parseInt(stats.winning_trades) / parseInt(stats.total_trades)) * 100).toFixed(1)
      : 0;

    res.json({
      summary: {
        active_members: parseInt(activeMembers.rows[0].count),
        total_pnl: parseFloat(stats.total_pnl),
        total_trades: parseInt(stats.total_trades),
        total_profit: parseFloat(stats.total_profit),
        total_loss: parseFloat(stats.total_loss),
        win_rate: parseFloat(winRate),
        today_pnl: parseFloat(todayPnl.rows[0].today_pnl),
        commission_settled: parseFloat(commissions.rows[0].total_settled),
        commission_pending: parseFloat(commissions.rows[0].total_pending),
      },
      chart: chartData.rows,
      top_performers: topPerformers.rows,
    });
  } catch (err) {
    console.error('Team performance error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// POST /api/agents/invite — Create invite link
// =============================================
router.post('/invite', authMiddleware, agentMiddleware, async (req, res) => {
  try {
    const tenant = await getAgentTenant(req.user.id);
    if (!tenant) {
      return res.status(404).json({ error: 'ยังไม่มี Tenant' });
    }

    // Check member limit
    const memberCount = await pool.query(
      `SELECT COUNT(*) as count FROM users WHERE tenant_id = $1`,
      [tenant.id]
    );
    if (parseInt(memberCount.rows[0].count) >= tenant.max_users) {
      return res.status(400).json({ error: `ถึงจำนวนสมาชิกสูงสุดแล้ว (${tenant.max_users} คน)` });
    }

    const { email, max_uses = 1, expires_days = 7 } = req.body;
    const inviteCode = crypto.randomBytes(16).toString('hex');

    const result = await pool.query(
      `INSERT INTO agent_invitations (tenant_id, invited_by, invite_code, email, max_uses, expires_at)
       VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '${parseInt(expires_days)} days')
       RETURNING *`,
      [tenant.id, req.user.id, inviteCode, email || null, parseInt(max_uses)]
    );

    res.status(201).json({
      invitation: result.rows[0],
      invite_url: `${req.protocol}://${req.get('host')}/register?invite=${inviteCode}`,
    });
  } catch (err) {
    console.error('Create invite error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// GET /api/agents/invitations — List invitations
// =============================================
router.get('/invitations', authMiddleware, agentMiddleware, async (req, res) => {
  try {
    const tenant = await getAgentTenant(req.user.id);
    if (!tenant) {
      return res.status(404).json({ error: 'ยังไม่มี Tenant' });
    }

    const invitations = await pool.query(
      `SELECT * FROM agent_invitations 
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [tenant.id]
    );

    res.json(invitations.rows);
  } catch (err) {
    console.error('List invitations error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// DELETE /api/agents/invitations/:id — Cancel invitation
// =============================================
router.delete('/invitations/:id', authMiddleware, agentMiddleware, async (req, res) => {
  try {
    const tenant = await getAgentTenant(req.user.id);
    if (!tenant) {
      return res.status(404).json({ error: 'ยังไม่มี Tenant' });
    }

    await pool.query(
      `UPDATE agent_invitations SET is_active = false WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, tenant.id]
    );

    res.json({ message: 'ยกเลิกลิงก์เชิญแล้ว' });
  } catch (err) {
    console.error('Cancel invitation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// PUT /api/agents/members/:id/toggle — Enable/Disable member
// =============================================
router.put('/members/:id/toggle', authMiddleware, agentMiddleware, async (req, res) => {
  try {
    const tenant = await getAgentTenant(req.user.id);
    if (!tenant) {
      return res.status(404).json({ error: 'ยังไม่มี Tenant' });
    }

    const member = await pool.query(
      `SELECT id, is_active FROM users WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, tenant.id]
    );
    if (member.rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบสมาชิก' });
    }

    const newStatus = !member.rows[0].is_active;
    await pool.query(
      `UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2`,
      [newStatus, req.params.id]
    );

    res.json({ message: newStatus ? 'เปิดใช้งานสมาชิกแล้ว' : 'ระงับสมาชิกแล้ว', is_active: newStatus });
  } catch (err) {
    console.error('Toggle member error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// DELETE /api/agents/members/:id — Remove member from team
// =============================================
router.delete('/members/:id', authMiddleware, agentMiddleware, async (req, res) => {
  try {
    const tenant = await getAgentTenant(req.user.id);
    if (!tenant) {
      return res.status(404).json({ error: 'ยังไม่มี Tenant' });
    }

    // Remove tenant association, don't delete user
    const result = await pool.query(
      `UPDATE users SET tenant_id = NULL, updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [req.params.id, tenant.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบสมาชิกในทีม' });
    }

    res.json({ message: 'ลบสมาชิกออกจากทีมแล้ว' });
  } catch (err) {
    console.error('Remove member error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// GET /api/agents/branding — Get branding settings
// =============================================
router.get('/branding', authMiddleware, agentMiddleware, async (req, res) => {
  try {
    const tenant = await getAgentTenant(req.user.id);
    if (!tenant) {
      return res.status(404).json({ error: 'ยังไม่มี Tenant' });
    }

    res.json({
      platform_name: tenant.platform_name,
      logo_url: tenant.logo_url,
      primary_color: tenant.primary_color,
      secondary_color: tenant.secondary_color,
      domain: tenant.domain,
    });
  } catch (err) {
    console.error('Get branding error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// PUT /api/agents/branding — Update branding
// =============================================
router.put('/branding', authMiddleware, agentMiddleware, async (req, res) => {
  try {
    const tenant = await getAgentTenant(req.user.id);
    if (!tenant) {
      return res.status(404).json({ error: 'ยังไม่มี Tenant' });
    }

    const { platform_name, logo_url, primary_color, secondary_color } = req.body;

    await pool.query(
      `UPDATE tenants SET
        platform_name = COALESCE($1, platform_name),
        logo_url = COALESCE($2, logo_url),
        primary_color = COALESCE($3, primary_color),
        secondary_color = COALESCE($4, secondary_color),
        updated_at = NOW()
       WHERE id = $5`,
      [platform_name, logo_url, primary_color, secondary_color, tenant.id]
    );

    res.json({ message: 'อัปเดตแบรนด์แล้ว' });
  } catch (err) {
    console.error('Update branding error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// GET /api/agents/commissions — Commission history
// =============================================
router.get('/commissions', authMiddleware, agentMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM agent_commissions WHERE agent_user_id = $1`,
      [req.user.id]
    );

    const commissions = await pool.query(
      `SELECT ac.*, u.username as source_username, u.display_name as source_display_name
       FROM agent_commissions ac
       LEFT JOIN users u ON u.id = ac.source_user_id
       WHERE ac.agent_user_id = $1
       ORDER BY ac.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, parseInt(limit), offset]
    );

    // Summary
    const summary = await pool.query(
      `SELECT 
        COALESCE(SUM(amount), 0) as total_commission,
        COALESCE(SUM(CASE WHEN status = 'SETTLED' THEN amount ELSE 0 END), 0) as total_settled,
        COALESCE(SUM(CASE WHEN status = 'PENDING' THEN amount ELSE 0 END), 0) as total_pending
       FROM agent_commissions WHERE agent_user_id = $1`,
      [req.user.id]
    );

    res.json({
      commissions: commissions.rows,
      summary: summary.rows[0],
      total: parseInt(countResult.rows[0].total),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error('Get commissions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// GET /api/agents/validate-invite/:code — Validate invite code (public)
// =============================================
router.get('/validate-invite/:code', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ai.*, t.name as tenant_name, t.platform_name, t.logo_url, t.primary_color
       FROM agent_invitations ai
       JOIN tenants t ON t.id = ai.tenant_id
       WHERE ai.invite_code = $1 
         AND ai.is_active = true 
         AND ai.expires_at > NOW()
         AND (ai.max_uses = 0 OR ai.used_count < ai.max_uses)`,
      [req.params.code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ลิงก์เชิญไม่ถูกต้องหรือหมดอายุแล้ว' });
    }

    const invite = result.rows[0];
    res.json({
      valid: true,
      tenant_name: invite.tenant_name,
      platform_name: invite.platform_name,
      logo_url: invite.logo_url,
      primary_color: invite.primary_color,
    });
  } catch (err) {
    console.error('Validate invite error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
