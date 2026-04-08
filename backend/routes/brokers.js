const express = require('express');
const { pool } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);

// Helper to check if user is admin
const isAdmin = (req) => req.user && req.user.role === 'admin';

// GET /api/brokers
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    if (isAdmin(req)) {
      // Admin sees everything, plus proxy check for data/connection
      const result = await pool.query(`
        SELECT b.*, 
               EXISTS(SELECT 1 FROM accounts a WHERE a.broker_id = b.id AND (a.is_connected = true OR a.last_sync_at IS NOT NULL)) AS has_data
        FROM brokers b 
        ORDER BY b.id ASC
      `);
      return res.json(result.rows);
    }

    // Is the user a lead of any group?
    const leadCheck = await pool.query('SELECT id, config FROM groups WHERE lead_user_id = $1 AND is_active = true LIMIT 1', [userId]);
    if (leadCheck.rows.length > 0) {
      // Team Lead
      const groupConfig = leadCheck.rows[0].config || {};
      const allowedIds = groupConfig.allowed_brokers || [];
      const result = await pool.query('SELECT * FROM brokers WHERE is_active = true ORDER BY name, id ASC');
      // Append flag
      const rows = result.rows.map(b => ({ ...b, is_allowed_for_team: allowedIds.includes(b.id), is_lead: true }));
      return res.json(rows);
    }

    // Is the user in a group?
    const memberCheck = await pool.query(`
      SELECT g.config 
      FROM group_members gm 
      JOIN groups g ON gm.group_id = g.id 
      WHERE gm.user_id = $1 AND g.is_active = true
      LIMIT 1
    `, [userId]);

    if (memberCheck.rows.length > 0) {
      const groupConfig = memberCheck.rows[0].config || {};
      const allowedIds = groupConfig.allowed_brokers || [];
      if (allowedIds.length > 0) {
        const result = await pool.query('SELECT * FROM brokers WHERE is_active = true AND id = ANY($1) ORDER BY name, id ASC', [allowedIds]);
        return res.json(result.rows);
      } else {
        return res.json([]);
      }
    }

    // Normal user with no group
    const result = await pool.query('SELECT * FROM brokers WHERE is_active = true ORDER BY name, id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Get brokers error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/brokers/allow-for-team
router.put('/allow-for-team', async (req, res) => {
  try {
    const { broker_id, is_allowed } = req.body;
    const leadCheck = await pool.query('SELECT id, config FROM groups WHERE lead_user_id = $1 AND is_active = true', [req.user.id]);
    if (leadCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not a team lead' });
    }
    
    // Update config for all groups lead by this user
    for (const group of leadCheck.rows) {
      const config = group.config || {};
      let allowed = config.allowed_brokers || [];
      if (is_allowed) {
        if (!allowed.includes(broker_id)) allowed.push(broker_id);
      } else {
        allowed = allowed.filter(id => id !== broker_id);
      }
      config.allowed_brokers = allowed;
      await pool.query('UPDATE groups SET config = $1 WHERE id = $2', [config, group.id]);
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Allow broker error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin check middleware
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Require Admin role' });
  }
  next();
};

// POST /api/brokers (Admin only)
router.post('/', adminOnly, async (req, res) => {
  try {
    const { 
      name, display_name, market_type, protocol, regulation, 
      country, website, max_leverage, min_deposit, spread_from, 
      platforms, rating, description, logo_url
    } = req.body;

    const result = await pool.query(
      `INSERT INTO brokers 
       (name, display_name, market_type, protocol, regulation, country, website, max_leverage, min_deposit, spread_from, platforms, rating, description, logo_url, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, true) 
       RETURNING *`,
      [name, display_name, market_type || 'Forex', protocol || 'MT5', regulation, country, website, max_leverage, min_deposit || 0, spread_from, platforms, rating || 0, description, logo_url]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create broker error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/brokers/:id (Admin only)
router.put('/:id', adminOnly, async (req, res) => {
  try {
    const { 
      name, display_name, market_type, protocol, regulation, 
      country, website, max_leverage, min_deposit, spread_from, 
      platforms, rating, description, logo_url, is_active
    } = req.body;

    const result = await pool.query(
      `UPDATE brokers SET 
         name=$1, display_name=$2, market_type=$3, protocol=$4, regulation=$5, 
         country=$6, website=$7, max_leverage=$8, min_deposit=$9, spread_from=$10, 
         platforms=$11, rating=$12, description=$13, logo_url=$14, is_active=$15
       WHERE id=$16 RETURNING *`,
      [name, display_name, market_type, protocol, regulation, country, website, max_leverage, min_deposit, spread_from, platforms, rating, description, logo_url, is_active ?? true, req.params.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update broker error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/brokers/:id (Admin only)
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM brokers WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('Delete broker error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
