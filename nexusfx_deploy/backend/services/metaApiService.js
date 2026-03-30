const MetaApi = require('metaapi.cloud-sdk').default;

class MetaApiService {
  constructor() {
    this.apiInstances = new Map(); // token -> MetaApi instance
  }

  getApi(token) {
    if (!token) throw new Error('MetaApi token is required');
    if (!this.apiInstances.has(token)) {
      const api = new MetaApi(token);
      this.apiInstances.set(token, api);
    }
    return this.apiInstances.get(token);
  }

  async executeTrade(accountId, token, order) {
    try {
      const api = this.getApi(token);
      console.log(`🔌 [MetaAPI] Connecting to account: ${accountId}`);
      const account = await api.metatraderAccountApi.getAccount(accountId);
      
      if (account.state !== 'DEPLOYED') {
         await account.deploy();
      }
      
      console.log(`🔌 [MetaAPI] Waiting for API connection...`);
      const connection = account.getRPCConnection();
      await connection.connect();
      
      const symbol = order.symbol.toUpperCase();
      const volume = parseFloat(order.quantity);
      let tradeResult;
      
      console.log(`🚀 [MetaAPI] Executing ${order.side} ${volume} ${symbol}`);
      if (order.side === 'BUY') {
         tradeResult = await connection.createMarketBuyOrder(symbol, volume, 0, 0);
      } else {
         tradeResult = await connection.createMarketSellOrder(symbol, volume, 0, 0);
      }
      
      console.log(`✅ [MetaAPI] Trade success! OrderId: ${tradeResult.orderId}`);
      return tradeResult;

    } catch (err) {
      console.error(`❌ [MetaAPI] Trade Execution Error:`, err.message);
      throw err;
    }
  }
  async getAccountInfo(accountId, token) {
    let connection;
    try {
      const api = this.getApi(token);
      const account = await api.metatraderAccountApi.getAccount(accountId);

      // Log all provisioning-level fields for debugging
      console.log(`📋 [MetaAPI] Provisioning data for ${accountId}:`, JSON.stringify({
        name: account.name,
        login: account.login,
        server: account.server,
        platform: account.platform,
        type: account.type,
        state: account.state,
        accountType: account.accountType,
      }));

      if (account.state !== 'DEPLOYED') {
        await account.deploy();
      }

      connection = account.getRPCConnection();
      await connection.connect();
      await connection.waitSynchronized();

      const info = await connection.getAccountInformation();

      // Log all MT5 account info fields for debugging
      console.log(`📊 [MetaAPI] MT5 Account Info for ${accountId}:`, JSON.stringify({
        name: info.name,
        login: info.login,
        server: info.server,
        balance: info.balance,
        equity: info.equity,
        margin: info.margin,
        freeMargin: info.freeMargin,
        leverage: info.leverage,
        currency: info.currency,
        platform: info.platform,
        tradeMode: info.tradeMode,
        type: info.type,
      }));

      // account.name = ชื่อที่ตั้งไว้ตอนสร้างบัญชีบน MetaAPI (ตรงกับ nickname จากโบรกเกอร์)
      // info.name = ชื่อผู้เทรด (ชื่อ-นามสกุล) — ไม่เหมาะใช้เป็นชื่อบัญชี
      const accountName = account.name || '';
      
      // info.tradeMode = "DEMO" / "REAL" — ประเภทระดับ trade mode
      // account.accountType = "DEMO PREMIUM", "Pro" etc — ถ้าโบรกเกอร์ส่งมาใน MetaAPI
      let accountType = account.accountType || info.type || info.tradeMode || '';
      if (typeof accountType === 'string' && accountType.length > 20) {
        accountType = accountType.substring(0, 20);
      }

      return {
        balance: info.balance,
        equity: info.equity,
        leverage: info.leverage,
        currency: info.currency,
        server: info.server || account.server,
        account_name: accountName,
        account_type: accountType,
        platform: info.platform || account.platform || 'MT5',
        login: info.login || account.login,
        connected: true,
      };
    } catch (err) {
      console.error(`❌ [MetaAPI] getAccountInfo Error for ${accountId}:`, err.message);
      return { balance: 0, equity: 0, connected: false, error: err.message };
    } finally {
      // Close connection to prevent stale data when syncing multiple accounts
      if (connection) {
        try { await connection.close(); } catch (e) { /* ignore */ }
      }
    }
  }
}

module.exports = new MetaApiService();
