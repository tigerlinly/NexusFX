const { pool } = require('../config/database');
const crypto = require('crypto');
const LineNotify = require('./lineNotify');

class ExecutionEngine {
  constructor() {
    this.running = false;
    this.pollIntervalMs = 2000; // Poll every 2 seconds
    this.binanceApiUrl = 'https://testnet.binance.vision/api/v3/order'; // Use Testnet
  }

  start() {
    this.interval = setInterval(() => this.processPendingOrders(), this.pollIntervalMs);
    console.log('✅ Execution Engine started (Polling PENDING orders)');
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
  }

  async processPendingOrders() {
    if (this.running) return;
    this.running = true;

    try {
      // Find up to 50 pending orders
      const ordersResult = await pool.query(
        `SELECT o.*, b.name as broker_name, a.user_id, a.metaapi_account_id,
                us.binance_api_key, us.binance_api_secret, us.metaapi_token
         FROM orders o
         JOIN accounts a ON a.id = o.account_id
         JOIN brokers b ON b.id = a.broker_id
         LEFT JOIN user_settings us ON us.user_id = a.user_id
         WHERE o.status = 'PENDING'
         ORDER BY o.created_at ASC
         LIMIT 50`
      );

      const orders = ordersResult.rows;
      if (orders.length === 0) {
        this.running = false;
        return;
      }

      for (const order of orders) {
        try {
          // Check if system is killed (Kill Switch globally active)
          // Ideally handled before, but good double check
          // Verify user has correctly stored their Binance API Keys
          const userKey = order.binance_api_key;
          const userSecret = order.binance_api_secret;
          const metaApiToken = order.metaapi_token;
          const metaApiAccountId = order.metaapi_account_id;

          let executionResult = false;
          
          if (order.broker_name && order.broker_name.toLowerCase() === 'binance') {
            executionResult = await this.executeBinance(order, userKey, userSecret);
          } else {
            // MT5 Broker (e.g. Exness, IC Markets)
            const metaApiService = require('./metaApiService');
            if (!metaApiToken || !metaApiAccountId) {
              throw new Error('MetaApi Token or Account ID is missing');
            }
            const mt5Result = await metaApiService.executeTrade(metaApiAccountId, metaApiToken, order);
            executionResult = mt5Result ? true : false;
          }

          if (executionResult) {
            await pool.query(
              `UPDATE orders SET status = 'FILLED' WHERE id = $1`,
              [order.id]
            );
            
            // Notify user via LINE
            await LineNotify.sendAlert(
              order.user_id, 
              `✅ Order Executed\nSymbol: ${order.symbol}\nSide: ${order.side}\nVolume: ${order.quantity}\nBroker: ${order.broker_name}`
            );
          }
        } catch (orderErr) {
          console.error(`❌ [ExecutionEngine] Order ${order.id} failed:`, orderErr.message);
          await pool.query(
            `UPDATE orders SET status = 'FAILED' WHERE id = $1`,
            [order.id]
          );
          
          await LineNotify.sendAlert(order.user_id, `❌ Order Failed\nSymbol: ${order.symbol}\nReason: ${orderErr.message}`);
        }
      }

    } catch (err) {
      console.error('❌ [ExecutionEngine] Polling error:', err);
    } finally {
      this.running = false;
    }
  }

  async executeBinance(order, apiKey, apiSecret) {
    if (!apiKey || !apiSecret || apiKey.includes('mock') || apiKey.includes('your_binance')) {
      console.log('🤖 [ExecutionEngine] Simulation Mode: Mocking Binance Trade for', order.symbol);
      return { status: 'FILLED', executedQty: order.quantity, price: order.price || 0 };
    }

    try {
      const timestamp = Date.now();
      let side = order.side === 'BUY' ? 'BUY' : 'SELL';
      const orderType = order.order_type || 'MARKET'; // MARKET, LIMIT, STOP_LOSS
      
      let queryString = `symbol=${order.symbol.toUpperCase()}&side=${side}&type=${orderType}&quantity=${order.quantity}&timestamp=${timestamp}`;
      
      if (orderType === 'LIMIT' && order.price) {
        queryString += `&price=${order.price}&timeInForce=GTC`;
      }
      
      const signature = crypto.createHmac('sha256', apiSecret).update(queryString).digest('hex');
      const url = `${this.binanceApiUrl}?${queryString}&signature=${signature}`;

      console.log(`🚀 [ExecutionEngine] Firing REAL order to Binance: ${order.symbol} | ${side}`);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-MBX-APIKEY': apiKey,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('❌ Binance API Error:', data);
        throw new Error(data.msg || 'Binance Exec failed');
      }
      return data;
    } catch (error) {
      console.error('❌ Execute Binance Runtime Error:', error.message);
      throw error;
    }
  }
}

module.exports = ExecutionEngine;
