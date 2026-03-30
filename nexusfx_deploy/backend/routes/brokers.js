const express = require('express');
const { pool } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

router.use(authMiddleware);

// GET /api/brokers
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT ON (name) * FROM brokers WHERE is_active = true ORDER BY name, id ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get brokers error:', err);
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
