const { pool } = require('../config/database');
const metaApiService = require('./metaApiService');

class ScheduleSyncEngine {
  constructor() {
    this.intervalId = null;
  }

  start() {
    // Run exactly at the start of the next minute
    const delay = 60000 - (Date.now() % 60000);
    setTimeout(() => {
      this.checkSchedules();
      this.intervalId = setInterval(() => this.checkSchedules(), 60000);
    }, delay);
    console.log('✅ Schedule Sync Engine Started (Checking schedules every minute)');
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  async checkSchedules() {
    try {
      const result = await pool.query(
        `SELECT user_id, timezone, sync_schedules, metaapi_token 
         FROM user_settings 
         WHERE sync_schedules IS NOT NULL AND jsonb_array_length(sync_schedules) > 0`
      );

      const usersToSync = [];
      const now = new Date();

      for (const row of result.rows) {
        if (!row.metaapi_token) continue;
        
        let tz = row.timezone || 'Asia/Bangkok';
        
        let currentTime;
        try {
          const formatter = new Intl.DateTimeFormat('en-US', { 
            timeZone: tz, 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: false 
          });
          currentTime = formatter.format(now);
          // Handle 24:xx edge cases from Intl
          if (currentTime.startsWith('24:')) {
            currentTime = '00:' + currentTime.split(':')[1];
          }
        } catch (e) {
          console.warn(`[ScheduleSync] Invalid timezone ${tz} for user ${row.user_id}, fallback to Asia/Bangkok`);
          const fallback = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false });
          currentTime = fallback.format(now);
        }

        const schedules = typeof row.sync_schedules === 'string' ? JSON.parse(row.sync_schedules) : row.sync_schedules;

        if (Array.isArray(schedules) && schedules.includes(currentTime)) {
          usersToSync.push(row);
        }
      }

      if (usersToSync.length > 0) {
        console.log(`[ScheduleSync] Triggering sync for ${usersToSync.length} users at ${now.toISOString()}`);
        for (const user of usersToSync) {
           // We do not await this to avoid blocking the loop for too long
           this.syncUserAccounts(user).catch(err => {
               console.error(`[ScheduleSync] Error syncing for user ${user.user_id}:`, err);
           });
        }
      }

    } catch (err) {
      console.error('[ScheduleSync] Error checking schedules:', err);
    }
  }

  async syncUserAccounts(user) {
    const { user_id, metaapi_token } = user;
    const accountsRes = await pool.query(
      `SELECT id, metaapi_account_id 
       FROM accounts 
       WHERE user_id = $1 AND is_active = true AND is_connected = true AND metaapi_account_id IS NOT NULL`,
       [user_id]
    );

    if (accountsRes.rows.length === 0) return;

    let api;
    try {
      api = metaApiService.getApi(metaapi_token);
    } catch(err) {
      console.warn(`[ScheduleSync] MetaApi Token invalid for user ${user_id}`);
      return;
    }

    for (const account of accountsRes.rows) {
      try {
        const mt5account = await api.metatraderAccountApi.getAccount(account.metaapi_account_id);
        if (mt5account.state !== 'DEPLOYED') await mt5account.deploy();
        
        const connection = mt5account.getRPCConnection();
        await connection.connect();
        await connection.waitSynchronized();

        // Fetch last 30 days
        const endTime = new Date(Date.now() + 3600000).toISOString();
        const startTime = new Date(Date.now() - 30 * 24 * 3600000).toISOString();
        const historyDeals = await connection.getDealsByTimeRange(startTime, endTime);

        const positionDeals = {};
        for (const d of historyDeals) {
           if (!positionDeals[d.positionId]) positionDeals[d.positionId] = [];
           positionDeals[d.positionId].push(d);
        }

        for (const [posId, deals] of Object.entries(positionDeals)) {
           const inDeal = deals.find(d => d.entryType === 'DEAL_ENTRY_IN' || d.entryType === 'DEAL_ENTRY_INOUT');
           const outDeal = deals.find(d => d.entryType === 'DEAL_ENTRY_OUT' || d.entryType === 'DEAL_ENTRY_INOUT');

           if (!inDeal) continue; // If we only have the OUT deal, we don't have enough entry data

           const side = inDeal.type === 'DEAL_TYPE_BUY' ? 'BUY' : 'SELL';
           const status = outDeal ? 'CLOSED' : 'OPEN';
           const pnl = outDeal ? outDeal.profit : 0;
           const exitPrice = outDeal ? outDeal.price : null;
           const closedAt = outDeal ? new Date(outDeal.time) : null;
           const comment = inDeal.comment || '';
           const magicNumber = inDeal.magic || 0;

           await pool.query(
             `INSERT INTO trades (
                account_id, ticket, symbol, side, lot_size, 
                entry_price, status, pnl, exit_price, 
                opened_at, closed_at, comment, magic_number
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
              ON CONFLICT (account_id, ticket) 
              DO UPDATE SET 
                status = EXCLUDED.status,
                pnl = EXCLUDED.pnl,
                exit_price = EXCLUDED.exit_price,
                closed_at = EXCLUDED.closed_at`,
             [
               account.id, 
               posId, 
               inDeal.symbol, 
               side, 
               inDeal.volume, 
               inDeal.price, 
               status, 
               pnl, 
               exitPrice, 
               new Date(inDeal.time), 
               closedAt,
               comment,
               magicNumber
             ]
           );
        }

        // Close connection gracefully
        try { await connection.close(); } catch (e) { /* ignore */ }

      } catch (accountErr) {
        console.warn(`[ScheduleSync] Error syncing account ${account.id}:`, accountErr.message);
      }
    }
  }
}

module.exports = new ScheduleSyncEngine();
