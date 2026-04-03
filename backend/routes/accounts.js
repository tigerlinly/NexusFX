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
    const { broker_id, account_number, account_name, account_type, currency, server, metaapi_account_id, connection_type, api_credentials, is_master, copy_target_id } = req.body;
    if (!broker_id || !account_number) {
      return res.status(400).json({ error: 'broker_id and account_number required' });
    }

    const cType = connection_type || 'TYPE_3_METAAPI';
    let bridgeToken = null;
    if (cType === 'TYPE_1_EA' || cType === 'TYPE_2_API') {
      bridgeToken = generateBridgeToken(); // Only generate token for non-cloud connections
    }

    const result = await pool.query(
      `INSERT INTO accounts (user_id, broker_id, account_number, account_name, account_type, currency, server, metaapi_account_id, connection_type, bridge_token, api_credentials, is_master, copy_target_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [req.user.id, broker_id, account_number, account_name || `Account ${account_number}`,
       account_type || 'Real', currency || 'USD', server, metaapi_account_id, cType, bridgeToken,
       api_credentials || '{}', is_master || false, copy_target_id || null]
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
    const { account_name, account_number, account_type, currency, is_active, metaapi_account_id, server, broker_id, connection_type, api_credentials, is_master, copy_target_id } = req.body;
    const result = await pool.query(
      `UPDATE accounts SET 
        account_name = COALESCE($1, account_name),
        account_type = COALESCE($2, account_type),
        currency = COALESCE($3, currency),
        is_active = COALESCE($4, is_active),
        metaapi_account_id = COALESCE($5, metaapi_account_id),
        server = COALESCE($6, server),
        account_number = COALESCE($7, account_number),
        broker_id = COALESCE($8, broker_id),
        connection_type = COALESCE($9, connection_type),
        api_credentials = COALESCE($10, api_credentials),
        is_master = COALESCE($11, is_master),
        copy_target_id = COALESCE($12, copy_target_id),
        updated_at = NOW()
       WHERE id = $13 AND user_id = $14 RETURNING *`,
      [account_name, account_type, currency, is_active, metaapi_account_id, server, account_number, broker_id, connection_type, api_credentials, is_master, copy_target_id, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
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

// POST /api/accounts/:id/sync — manually sync a single account via MetaAPI
router.post('/:id/sync', auditLog('SYNC_ACCOUNT', 'ACCOUNT'), async (req, res) => {
  try {
    const acctRes = await pool.query(
      `SELECT a.*, us.metaapi_token
       FROM accounts a
       LEFT JOIN user_settings us ON us.user_id = a.user_id
       WHERE a.id = $1 AND a.user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (acctRes.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const acct = acctRes.rows[0];
    if (!acct.metaapi_account_id || !acct.metaapi_token) {
      return res.status(400).json({ error: 'MetaAPI Account ID หรือ Token ยังไม่ได้ตั้งค่า' });
    }

    const metaApiService = require('../services/metaApiService');
    const info = await metaApiService.getAccountInfo(acct.metaapi_account_id, decrypt(acct.metaapi_token));

    if (info.connected) {
      // Update balance, equity AND account_name, account_type from MetaAPI
      const newName = info.account_name || acct.account_name;
      const newType = info.account_type || acct.account_type;
      const symbolsJson = info.symbols && info.symbols.length > 0 ? JSON.stringify(info.symbols) : null;

      await pool.query(
        `UPDATE accounts SET 
          balance = $1, equity = $2, 
          leverage = COALESCE($3, leverage),
          server = COALESCE(NULLIF($4, ''), server),
          currency = COALESCE(NULLIF($5, ''), currency),
          account_name = COALESCE(NULLIF($6, ''), account_name),
          account_type = COALESCE(NULLIF($7, ''), account_type),
          supported_symbols = COALESCE($8::jsonb, supported_symbols),
          is_connected = true, last_sync_at = NOW() 
        WHERE id = $9`,
        [info.balance, info.equity, info.leverage, info.server, info.currency, newName, newType, symbolsJson, acct.id]
      );
      res.json({ 
        success: true, balance: info.balance, equity: info.equity,
        account_name: newName, account_type: newType, supported_symbols: info.symbols
      });
    } else {
      await pool.query(`UPDATE accounts SET is_connected = false WHERE id = $1`, [acct.id]);
      res.status(400).json({ error: info.error || 'ไม่สามารถเชื่อมต่อ MetaAPI ได้' });
    }
  } catch (err) {
    console.error('Sync account error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

module.exports = router;
