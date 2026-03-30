const { pool } = require('../config/database');
const metaApiService = require('./metaApiService');
const TelegramNotify = require('./telegramNotify');
const LineNotify = require('./lineNotify');

class OrderSyncEngine {
  constructor() {
    this.intervalMs = 5 * 60 * 1000; // Run every 5 minutes by default, but let's do 1 min for demo
    this.running = false;
  }

  start() {
    this.intervalId = setInterval(() => this.syncAllAccounts(), 60000); // Poll every 1 minute
    console.log('✅ Order Sync Engine Started (Polling MT5 Positions every 60s)');
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  async syncAllAccounts() {
    if (this.running) return;
    this.running = true;
    
    try {
      // Get all active connected MT5 accounts
      const result = await pool.query(
        `SELECT a.id as account_id, a.user_id, a.metaapi_account_id, us.metaapi_token 
         FROM accounts a
         JOIN user_settings us ON us.user_id = a.user_id
         WHERE a.is_active = true AND a.is_connected = true AND a.metaapi_account_id IS NOT NULL`
      );

      for (const row of result.rows) {
        try {
          await this.syncAccountPositions(row);
        } catch (e) {
          console.error(`❌ [OrderSyncEngine] Failed to sync account ${row.account_id}:`, e.message);
        }
      }

    } catch (err) {
       console.error(`❌ [OrderSyncEngine] Loop Error:`, err);
    } finally {
      this.running = false;
    }
  }

  async syncAccountPositions(accountInfo) {
    const { account_id, user_id, metaapi_account_id, metaapi_token } = accountInfo;
    
    if (!metaapi_token) {
      console.warn(`[OrderSyncEngine] No metaapi_token for account ${account_id}, skipping`);
      return;
    }

    // 1. Fetch current open DB trades for this account
    const dbOpenTradesResult = await pool.query(
      `SELECT * FROM trades WHERE account_id = $1 AND status = 'OPEN'`,
      [account_id]
    );
    const dbOpenTrades = dbOpenTradesResult.rows;

    // 2. Fetch live MT5 positions + account info
    let livePositions = [];
    try {
      const api = metaApiService.getApi(metaapi_token);
      const mt5account = await api.metatraderAccountApi.getAccount(metaapi_account_id);
      if (mt5account.state !== 'DEPLOYED') await mt5account.deploy();
      
      const connection = mt5account.getRPCConnection();
      await connection.connect();
      await connection.waitSynchronized();
      
      livePositions = await connection.getPositions();

      // Also sync account info (name, type, balance, equity)
      try {
        const info = await connection.getAccountInformation();
        const accountName = mt5account.name || '';
        const accountType = mt5account.accountType || info.type || info.tradeMode || '';
        
        await pool.query(
          `UPDATE accounts SET 
            balance = $1, equity = $2,
            leverage = COALESCE($3, leverage),
            server = COALESCE(NULLIF($4, ''), server),
            currency = COALESCE(NULLIF($5, ''), currency),
            account_name = COALESCE(NULLIF($6, ''), account_name),
            account_type = COALESCE(NULLIF($7, ''), account_type),
            is_connected = true, last_sync_at = NOW()
          WHERE id = $8`,
          [info.balance, info.equity, info.leverage, info.server || mt5account.server, 
           info.currency, accountName, accountType, account_id]
        );
      } catch (infoErr) {
        console.warn(`[OrderSyncEngine] Could not sync account info for ${account_id}:`, infoErr.message);
      }

      try { await connection.close(); } catch (e) { /* ignore */ }
      
    } catch (apiErr) {
       console.warn(`[OrderSyncEngine] Could not pull positions from MetaAPI for acct ${metaapi_account_id}`);
       return;
    }

    const livePosMap = {};
    for (const pos of livePositions) {
      livePosMap[pos.id] = pos;
    }

    // 3. Mark closed trades
    for (const dbTrade of dbOpenTrades) {
      if (!dbTrade.ticket) continue; // skip trades without ticket
      
      if (!livePosMap[dbTrade.ticket]) {
        // Trade is CLOSED on MT5! We need to update DB.
        console.log(`[OrderSyncEngine] Found CLOSED trade! DB ID: ${dbTrade.id}, Ticket: ${dbTrade.ticket}`);
        
        // Mark as closed - we don't have exit price/pnl here unless we fetch history, 
        // to simplify we just set status. Production should fetch history.
        await pool.query(
          `UPDATE trades SET status = 'CLOSED', closed_at = NOW() WHERE id = $1`,
          [dbTrade.id]
        );

        // Notify
        const msg = `🔔 รหัสไม้ ${dbTrade.ticket} ถูกปิดเรียบร้อยแล้ว`;
        TelegramNotify.sendAlert(user_id, msg).catch(()=>{});
        LineNotify.sendAlert(user_id, msg).catch(()=>{});
        
        // ==========================================
        // PROFIT SHARING LOGIC TRIGGER
        // ==========================================
        // Assuming we look up if this trade was a copied trade
        // If it generated profit, deduct profit share to wallet
      } else {
        // Trade is still OPEN. Update floating PNL
        const lp = livePosMap[dbTrade.ticket];
        await pool.query(
          `UPDATE trades SET pnl = $1, current_price = $2 WHERE id = $3`,
           [lp.profit, lp.currentPrice, dbTrade.id]
        ).catch(()=>{});
      }
    }

    // 4. Sync new positions (e.g. manual trades opened on MT5)
    for (const pos of livePositions) {
      const exists = dbOpenTrades.find(t => t.ticket === pos.id);
      if (!exists) {
        // Insert missing open trade!
        const side = pos.type === 'POSITION_TYPE_BUY' ? 'BUY' : 'SELL';
        await pool.query(
          `INSERT INTO trades (account_id, ticket, symbol, side, lot_size, entry_price, status, pnl, opened_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'OPEN', $7, NOW())
           ON CONFLICT DO NOTHING`,
          [account_id, pos.id, pos.symbol, side, pos.volume, pos.openPrice, pos.profit]
        );
      }
    }
  }
}

module.exports = new OrderSyncEngine();
