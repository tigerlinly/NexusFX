const express = require('express');
const { pool } = require('../config/database');
const { authMiddleware, requireRole, requirePermission, auditLog } = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);

// =============================================
// GROUP CRUD
// =============================================

// GET /api/groups — list groups for current user
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT g.*, u.display_name as lead_name, u.username as lead_username,
              (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) as member_count
       FROM groups g
       JOIN users u ON u.id = g.lead_user_id
       WHERE g.lead_user_id = $1 
          OR g.id IN (SELECT group_id FROM group_members WHERE user_id = $1)
       ORDER BY g.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get groups error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/groups/available-users — get users not in any group
// IMPORTANT: Must be before /:id route to avoid Express matching 'available-users' as :id
router.get('/available-users', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.display_name, u.email
      FROM users u
      WHERE u.is_active = true
        AND u.id NOT IN (SELECT gm.user_id FROM group_members gm)
      ORDER BY u.display_name, u.username
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Get available users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/groups/:id — group detail with members
router.get('/:id', async (req, res) => {
  try {
    const groupResult = await pool.query(
      `SELECT g.*, u.display_name as lead_name, u.username as lead_username
       FROM groups g JOIN users u ON u.id = g.lead_user_id
       WHERE g.id = $1`,
      [req.params.id]
    );
    if (groupResult.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const group = groupResult.rows[0];
    // Check access
    if (group.lead_user_id !== req.user.id) {
      const isMember = await pool.query(
        'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
        [req.params.id, req.user.id]
      );
      if (isMember.rows.length === 0) {
        return res.status(403).json({ error: 'Not a member of this group' });
      }
    }

    const members = await pool.query(
      `SELECT gm.*, u.username, u.display_name, u.email, u.avatar_url, r.role_name
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE gm.group_id = $1
       ORDER BY gm.joined_at`,
      [req.params.id]
    );

    res.json({ ...group, members: members.rows });
  } catch (err) {
    console.error('Get group detail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/groups — create group
router.post('/', requirePermission('group.create'), async (req, res) => {
  try {
    const { group_name, description, max_members } = req.body;
    if (!group_name) {
      return res.status(400).json({ error: 'group_name is required' });
    }

    const result = await pool.query(
      `INSERT INTO groups (group_name, description, lead_user_id, max_members)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [group_name, description || '', req.user.id, max_members || 50]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create group error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/groups/:id — update group
router.put('/:id', async (req, res) => {
  try {
    const { group_name, description, max_members } = req.body;
    const result = await pool.query(
      `UPDATE groups SET
        group_name = COALESCE($1, group_name),
        description = COALESCE($2, description),
        max_members = COALESCE($3, max_members),
        updated_at = NOW()
       WHERE id = $4 AND lead_user_id = $5 RETURNING *`,
      [group_name, description, max_members, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found or not authorized' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update group error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/groups/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(
      'UPDATE groups SET is_active = false WHERE id = $1 AND lead_user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Delete group error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// MEMBERS
// =============================================



// POST /api/groups/:id/members — add member
router.post('/:id/members', requirePermission('group.manage'), async (req, res) => {
  try {
    const { username } = req.body;
    // Check ownership
    const group = await pool.query('SELECT * FROM groups WHERE id = $1 AND lead_user_id = $2', [req.params.id, req.user.id]);
    if (group.rows.length === 0) {
      return res.status(403).json({ error: 'Only group lead can add members' });
    }

    // Find user
    const userResult = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check max members
    const countResult = await pool.query('SELECT COUNT(*) FROM group_members WHERE group_id = $1', [req.params.id]);
    if (parseInt(countResult.rows[0].count) >= group.rows[0].max_members) {
      return res.status(400).json({ error: 'Group is full' });
    }

    const result = await pool.query(
      'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) RETURNING *',
      [req.params.id, userResult.rows[0].id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'User is already a member' });
    }
    console.error('Add member error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/groups/:id/members/:userId — remove member
router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const group = await pool.query('SELECT * FROM groups WHERE id = $1 AND lead_user_id = $2', [req.params.id, req.user.id]);
    if (group.rows.length === 0) {
      return res.status(403).json({ error: 'Only group lead can remove members' });
    }

    await pool.query(
      'DELETE FROM group_members WHERE group_id = $1 AND user_id = $2',
      [req.params.id, req.params.userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Remove member error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/groups/:id/performance — team aggregated performance
router.get('/:id/performance', requirePermission('group.view_team'), async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const group = await pool.query('SELECT * FROM groups WHERE id = $1', [req.params.id]);
    if (group.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Get all member accounts
    const members = await pool.query(
      `SELECT gm.user_id, u.display_name, u.username
       FROM group_members gm JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = $1`,
      [req.params.id]
    );

    const memberIds = members.rows.map(m => m.user_id);
    if (memberIds.length === 0) {
      return res.json({ members: [], summary: { total_pnl: 0, total_trades: 0, avg_win_rate: 0 } });
    }

    // Get per-member performance
    const perfResult = await pool.query(
      `SELECT a.user_id, u.display_name, u.username,
              COALESCE(SUM(t.pnl), 0) as total_pnl,
              COUNT(t.id) as total_trades,
              COUNT(CASE WHEN t.pnl > 0 THEN 1 END) as winning_trades,
              COALESCE(SUM(t.lot_size), 0) as total_volume
       FROM accounts a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN trades t ON t.account_id = a.id
         AND t.status = 'CLOSED'
         AND t.closed_at >= NOW() - INTERVAL '1 day' * $2
       WHERE a.user_id = ANY($1)
       GROUP BY a.user_id, u.display_name, u.username`,
      [memberIds, parseInt(period)]
    );

    const memberPerf = perfResult.rows.map(r => ({
      ...r,
      win_rate: r.total_trades > 0 ? ((r.winning_trades / r.total_trades) * 100).toFixed(1) : '0.0'
    }));

    const totalPnl = memberPerf.reduce((s, m) => s + parseFloat(m.total_pnl), 0);
    const totalTrades = memberPerf.reduce((s, m) => s + parseInt(m.total_trades), 0);
    const totalWins = memberPerf.reduce((s, m) => s + parseInt(m.winning_trades), 0);

    res.json({
      members: memberPerf,
      summary: {
        total_pnl: totalPnl,
        total_trades: totalTrades,
        avg_win_rate: totalTrades > 0 ? ((totalWins / totalTrades) * 100).toFixed(1) : '0.0',
        member_count: memberIds.length
      }
    });
  } catch (err) {
    console.error('Group performance error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// COLLABORATIVE RISK MANAGEMENT
// =============================================

// PUT /api/groups/:id/config — update global risk settings (global stop-loss)
router.put('/:id/config', requirePermission('group.manage'), async (req, res) => {
  try {
    const { global_stop_loss } = req.body;
    
    // Check ownership
    const group = await pool.query('SELECT * FROM groups WHERE id = $1 AND lead_user_id = $2', [req.params.id, req.user.id]);
    if (group.rows.length === 0) {
      return res.status(403).json({ error: 'Only group lead can update risk config' });
    }

    const currentConfig = group.rows[0].config || {};
    const newConfig = { ...currentConfig, global_stop_loss };

    const result = await pool.query(
      'UPDATE groups SET config = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [JSON.stringify(newConfig), req.params.id]
    );

    // Log action
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, 'group.update_config', 'group', $2, $3, $4)`,
      [req.user.id, req.params.id, JSON.stringify({ config: newConfig }), req.ip]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update group config error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/groups/:id/emergency-close — emergency close team's positions
router.post('/:id/emergency-close', requirePermission('group.manage'), async (req, res) => {
  try {
    const { reason } = req.body;
    
    // Check ownership
    const group = await pool.query('SELECT * FROM groups WHERE id = $1 AND lead_user_id = $2', [req.params.id, req.user.id]);
    if (group.rows.length === 0) {
      return res.status(403).json({ error: 'Only group lead can use emergency close' });
    }

    await pool.query('BEGIN');

    // Get all member accounts
    const members = await pool.query(
      `SELECT a.id FROM accounts a JOIN group_members gm ON gm.user_id = a.user_id WHERE gm.group_id = $1`,
      [req.params.id]
    );

    const accountIds = members.rows.map(m => m.id);

    let cancelledOrders = 0;
    let stoppedBots = 0;

    if (accountIds.length > 0) {
      // 1. Cancel pending orders for members
      const orderRes = await pool.query(
        `UPDATE orders SET status = 'CANCELLED', cancelled_at = NOW() WHERE account_id = ANY($1) AND status = 'PENDING' RETURNING id`,
        [accountIds]
      );
      cancelledOrders = orderRes.rowCount;

      // 2. Stop bots for members
      const botRes = await pool.query(
        `UPDATE trading_bots SET is_active = false, status = 'STOPPED', updated_at = NOW() 
         WHERE account_id = ANY($1) AND is_active = true RETURNING id`,
        [accountIds]
      );
      stoppedBots = botRes.rowCount;
    }

    // 3. Log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, 'group.emergency_close', 'group', $2, $3, $4)`,
      [req.user.id, req.params.id, JSON.stringify({ reason, cancelled_orders: cancelledOrders, stopped_bots: stoppedBots }), req.ip]
    );

    await pool.query('COMMIT');

    res.json({ success: true, cancelled_orders: cancelledOrders, stopped_bots: stoppedBots, message: 'Emergency close executed' });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Emergency close error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
