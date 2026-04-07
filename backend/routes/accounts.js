const express = require('express');
const { pool } = require('../config/database');
const { authMiddleware, auditLog } = require('../middleware/auth');
const { decrypt, generateBridgeToken } = require('../utils/encryption');
const router = express.Router();

router.use(authMiddleware);

// GET /api/accounts — all accounts for current user (with broker info)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, b.name as broker_name, b.display_name as broker_display_name, b.logo_url as broker_logo
       FROM accounts a
       JOIN brokers b ON b.id = a.broker_id
       WHERE a.user_id = $1 AND a.is_active = true
       ORDER BY b.name, a.account_name`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get accounts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/accounts — add account
router.post('/', auditLog('ADD_ACCOUNT', 'ACCOUNT'), async (req, res) => {
  try {
    const { broker_id, account_number, account_name, account_type, currency, server, connection_type, api_credentials, is_master, copy_target_id } = req.body;
    if (!broker_id || !account_number) {
      return res.status(400).json({ error: 'broker_id and account_number required' });
    }

    const cType = connection_type || 'TYPE_1_EA';
    let bridgeToken = null;
    if (cType === 'TYPE_1_EA' || cType === 'TYPE_2_API') {
      bridgeToken = generateBridgeToken(); // Only generate token for non-cloud connections
    }

    const result = await pool.query(
      `INSERT INTO accounts (user_id, broker_id, account_number, account_name, account_type, currency, server, connection_type, bridge_token, api_credentials, is_master, copy_target_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [req.user.id, broker_id, account_number, account_name || `Account ${account_number}`,
       account_type || 'Real', currency || 'USD', server, cType, bridgeToken,
       api_credentials || '{}', is_master || false, copy_target_id || null]
    );

    // Auto-create daily profit target (0 initially, will be set to 5% of balance when synced)
    await pool.query(
      `INSERT INTO daily_targets (user_id, account_id, target_amount, action_on_reach, is_active)
       VALUES ($1, $2, 0, 'STOPPED', true)`,
      [req.user.id, result.rows[0].id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Account already exists' });
    }
    console.error('Add account error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/accounts/:id
router.put('/:id', auditLog('UPDATE_ACCOUNT', 'ACCOUNT'), async (req, res) => {
  try {
    const currentRes = await pool.query('SELECT * FROM accounts WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (currentRes.rows.length === 0) return res.status(404).json({ error: 'Account not found' });
    const current = currentRes.rows[0];

    // Merge updates, allowing explicit null
    const account_name = req.body.account_name !== undefined ? req.body.account_name : current.account_name;
    const account_type = req.body.account_type !== undefined ? req.body.account_type : current.account_type;
    const currency = req.body.currency !== undefined ? req.body.currency : current.currency;
    const is_active = req.body.is_active !== undefined ? req.body.is_active : current.is_active;
    const server = req.body.server !== undefined ? req.body.server : current.server;
    const account_number = req.body.account_number !== undefined ? req.body.account_number : current.account_number;
    const broker_id = req.body.broker_id !== undefined ? req.body.broker_id : current.broker_id;
    const connection_type = req.body.connection_type !== undefined ? req.body.connection_type : current.connection_type;
    const api_credentials = req.body.api_credentials !== undefined ? req.body.api_credentials : current.api_credentials;
    const is_master = req.body.is_master !== undefined ? req.body.is_master : current.is_master;
    const copy_target_id = req.body.copy_target_id !== undefined ? req.body.copy_target_id : current.copy_target_id;

    const result = await pool.query(
      `UPDATE accounts SET 
        account_name = $1, account_type = $2, currency = $3, is_active = $4,
        server = $5, account_number = $6, broker_id = $7,
        connection_type = $8, api_credentials = $9, is_master = $10, copy_target_id = $11,
        updated_at = NOW()
       WHERE id = $12 AND user_id = $13 RETURNING *`,
      [account_name, account_type, currency, is_active, server, account_number, broker_id, connection_type, api_credentials, is_master, copy_target_id, req.params.id, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update account error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/accounts/:id
router.delete('/:id', auditLog('DELETE_ACCOUNT', 'ACCOUNT'), async (req, res) => {
  try {
    await pool.query(
      'UPDATE accounts SET is_active = false WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// MetaApi Sync route removed
module.exports = router;
