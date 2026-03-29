/**
 * MT5 Connection Service via MetaApi
 * Handles automatic connection, trade sync, and real-time updates
 */
const { pool } = require('../config/database');

let MetaApi;
try {
  MetaApi = require('metaapi.cloud-sdk').default;
} catch (e) {
  console.warn('⚠️  MetaApi SDK not available. MT5 sync will be disabled.');
  MetaApi = null;
}

class MT5Service {
  constructor(io) {
    this.io = io;
    this.api = null;
    this.connections = new Map(); // accountId -> connection
    this.syncIntervals = new Map();
  }

  async init() {
    const token = process.env.META_API_TOKEN;
    if (!token || !MetaApi) {
      console.log('ℹ️  MT5 Service: No MetaApi token configured. Running in demo mode.');
      return;
    }

    try {
      this.api = new MetaApi(token);
      console.log('✅ MT5 Service initialized');
    } catch (err) {
      console.error('❌ MT5 Service init error:', err.message);
    }
  }

  // Connect to an MT5 account via MetaApi
  async connectAccount(accountId) {
    if (!this.api) return { success: false, error: 'MetaApi not initialized' };

    try {
      const accResult = await pool.query(
        'SELECT * FROM accounts WHERE id = $1',
        [accountId]
      );
      if (accResult.rows.length === 0) return { success: false, error: 'Account not found' };

      const acc = accResult.rows[0];
      if (!acc.metaapi_account_id) {
        return { success: false, error: 'No MetaApi account ID configured' };
      }

      const metaAccount = await this.api.metatraderAccountApi.getAccount(acc.metaapi_account_id);
      
      // Deploy account if needed
      if (metaAccount.state !== 'DEPLOYED') {
        await metaAccount.deploy();
        await metaAccount.waitDeployed();
      }

      // Connect
      const connection = metaAccount.getRPCConnection();
      await connection.connect();
      await connection.waitSynchronized();

      this.connections.set(accountId, connection);

      // Update DB
      await pool.query(
        'UPDATE accounts SET is_connected = true, last_sync_at = NOW() WHERE id = $1',
        [accountId]
      );

      // Start periodic sync
      this.startSync(accountId);

      console.log(`✅ MT5 Account ${acc.account_number} connected`);
      return { success: true };
    } catch (err) {
      console.error(`❌ MT5 connect error (${accountId}):`, err.message);
      return { success: false, error: err.message };
    }
  }

  // Sync account data from MT5
  async syncAccount(accountId) {
    const connection = this.connections.get(accountId);
    if (!connection) return;

    try {
      // Get account info
      const accountInfo = await connection.getAccountInformation();
      await pool.query(
        'UPDATE accounts SET balance = $1, equity = $2, leverage = $3, last_sync_at = NOW() WHERE id = $4',
        [accountInfo.balance, accountInfo.equity, accountInfo.leverage, accountId]
      );

      // Get recent deals/trades
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const deals = await connection.getDealsByTimeRange(startOfDay, now);

      for (const deal of deals) {
        if (deal.type === 'DEAL_TYPE_BUY' || deal.type === 'DEAL_TYPE_SELL') {
          await pool.query(
            `INSERT INTO trades (account_id, ticket, symbol, side, lot_size, entry_price, exit_price, pnl, commission, swap, opened_at, closed_at, status, magic_number, comment)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
             ON CONFLICT DO NOTHING`,
            [
              accountId,
              deal.id || deal.positionId,
              deal.symbol,
              deal.type === 'DEAL_TYPE_BUY' ? 'BUY' : 'SELL',
              deal.volume || 0,
              deal.price || 0,
              deal.price || 0,
              deal.profit || 0,
              deal.commission || 0,
              deal.swap || 0,
              deal.time || now,
              deal.profit !== undefined ? (deal.time || now) : null,
              deal.profit !== undefined ? 'CLOSED' : 'OPEN',
              deal.magic || null,
              deal.comment || null,
            ]
          );
        }
      }

      // Emit update via Socket.io
      const accResult = await pool.query('SELECT user_id FROM accounts WHERE id = $1', [accountId]);
      if (accResult.rows.length > 0) {
        this.io.to(`user:${accResult.rows[0].user_id}`).emit('account:updated', {
          accountId,
          balance: accountInfo.balance,
          equity: accountInfo.equity,
        });
      }
    } catch (err) {
      console.error(`❌ MT5 sync error (${accountId}):`, err.message);
    }
  }

  startSync(accountId) {
    // Sync every 10 seconds
    const interval = setInterval(() => this.syncAccount(accountId), 10000);
    this.syncIntervals.set(accountId, interval);
  }

  stopSync(accountId) {
    const interval = this.syncIntervals.get(accountId);
    if (interval) {
      clearInterval(interval);
      this.syncIntervals.delete(accountId);
    }
  }

  async disconnectAccount(accountId) {
    this.stopSync(accountId);
    this.connections.delete(accountId);
    await pool.query('UPDATE accounts SET is_connected = false WHERE id = $1', [accountId]);
  }

  // Auto-connect all active accounts for a user
  async autoConnectUser(userId) {
    const result = await pool.query(
      'SELECT id FROM accounts WHERE user_id = $1 AND is_active = true AND metaapi_account_id IS NOT NULL',
      [userId]
    );
    const results = [];
    for (const row of result.rows) {
      const r = await this.connectAccount(row.id);
      results.push({ accountId: row.id, ...r });
    }
    return results;
  }
}

module.exports = MT5Service;
