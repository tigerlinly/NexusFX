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
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
