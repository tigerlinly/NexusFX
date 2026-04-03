const { pool } = require('../config/database');

/**
 * Middleware to authenticate requests from EA Bridges (Type 1) or Native APIs (Type 2).
 * Fast database lookup using the bridge_token.
 */
const bridgeAuth = async (req, res, next) => {
  const token = req.headers['x-bridge-token'] || req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Bridge token required' });
  }

  try {
    const result = await pool.query(
      `SELECT a.*, u.id as user_id 
       FROM accounts a
       JOIN users u ON u.id = a.user_id
       WHERE a.bridge_token = $1 AND a.is_active = true`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or inactive bridge token' });
    }

    req.account = result.rows[0];
    req.user = { id: req.account.user_id }; // Mock req.user for downstream consistency
    next();
  } catch (err) {
    console.error('Bridge auth error:', err);
    res.status(500).json({ error: 'Internal server error during bridge authentication' });
  }
};

module.exports = { bridgeAuth };
