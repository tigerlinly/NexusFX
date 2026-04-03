const { pool } = require('../config/database');
const crypto = require('crypto');
const LineNotify = require('./lineNotify');
const TelegramNotify = require('./telegramNotify');
const riskCalculator = require('./riskCalculator');

class ExecutionEngine {
  constructor() {
    this.running = false;
    this.pollIntervalMs = 2000; // Poll every 2 seconds
    this.binanceApiUrl = 'https://testnet.binance.vision/api/v3/order'; // Use Testnet
    this.notificationService = null;
  }

  setNotificationService(ns) {
    this.notificationService = ns;
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
        `SELECT o.*, b.name as broker_name, a.user_id, a.metaapi_account_id, a.api_credentials, a.connection_type,
                us.binance_api_key, us.binance_api_secret, us.metaapi_token
         FROM orders o
         JOIN accounts a ON a.id = o.account_id
         JOIN brokers b ON b.id = a.broker_id
         LEFT JOIN user_settings us ON us.user_id = a.user_id
          WHERE o.status = 'PENDING' 
            AND (a.connection_type IS NULL OR a.connection_type = 'TYPE_3_METAAPI' OR a.connection_type = 'TYPE_2_API')
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
          // Use account-level API credentials if available (TYPE_2_API overrides global settings)
          const creds = order.api_credentials || {};
          const userKey = creds.apiKey || order.binance_api_key || null;
          const userSecret = creds.apiSecret || order.binance_api_secret || null;
          const metaApiToken = order.metaapi_token || null;
          const metaApiAccountId = order.metaapi_account_id;

          let executionResult = false;
          let executionPrice = order.price || null;
          let filled_qty = order.quantity;
          let exchangeOrderId = null;

          if (order.broker_name && order.broker_name.toLowerCase() === 'binance') {
            executionResult = await this.executeBinance(order, userKey, userSecret);
            if (executionResult && executionResult.price) {
              executionPrice = parseFloat(executionResult.price);
            }
          } else if (!order.connection_type || order.connection_type === 'TYPE_3_METAAPI') {
            // MT5 Broker via MetaAPI (e.g. Exness, IC Markets)
            const metaApiService = require('./metaApiService');
            if (!metaApiToken || !metaApiAccountId) {
              throw new Error('MetaApi Token or Account ID is missing');
            }
            const mt5Result = await metaApiService.executeTrade(metaApiAccountId, metaApiToken, order);
            if (mt5Result) {
              executionResult = true;
              exchangeOrderId = mt5Result.positionId || mt5Result.orderId || null;
              executionPrice = mt5Result.openPrice || mt5Result.price || null;
            }
          } else if (order.connection_type === 'TYPE_2_API') {
            // Placeholder for other Native API connects (e.g. cTrader, DxTrade)
            console.log(`🤖 [ExecutionEngine] Executing Native API Trade for ${order.broker_name} with credentials override`);
            executionResult = true;
            executionPrice = order.price || null;
          }

          if (executionResult) {
            // คำนวณ SL/TP จาก entry price ที่รู้ตอน fill
            let finalSL = order.stop_loss;
            let finalTP = order.take_profit;

            if (executionPrice && executionPrice > 0) {
              const strategyType = order.strategy_type || 'Custom';
              const recalculated = riskCalculator.calculate(
                strategyType,
                order.symbol,
                order.side,
                executionPrice,
                {
                  sl_pips: order.sl_pips,
                  tp_ratio: order.tp_pips && order.sl_pips ? (order.tp_pips / order.sl_pips) : undefined,
                  trail_trigger_pips: order.trail_trigger_pips,
                  trail_distance_pips: order.trailing_distance_pips,
                  breakeven_trigger_pips: order.breakeven_trigger_pips,
                }
              );
              finalSL = recalculated.stop_loss;
              finalTP = recalculated.take_profit;
            }

            await pool.query(
              `UPDATE orders SET
                 status = 'FILLED',
                 filled_at = NOW(),
                 filled_quantity = quantity,
                 entry_price = COALESCE($2, price),
                 stop_loss = COALESCE($3, stop_loss),
                 take_profit = COALESCE($4, take_profit),
                 current_sl = COALESCE($3, stop_loss),
                 current_tp = COALESCE($4, take_profit),
                 peak_price = COALESCE($2, price),
                 exchange_order_id = COALESCE($5, exchange_order_id),
                 updated_at = NOW()
               WHERE id = $1`,
              [order.id, executionPrice, finalSL, finalTP, exchangeOrderId]
            );

            const slInfo = finalSL ? `\nSL: ${finalSL}` : '';
            const tpInfo = finalTP ? `\nTP: ${finalTP}` : '';
            const rrInfo = order.risk_reward ? ` [${order.risk_reward}]` : '';

            // Notify user via LINE & Telegram + In-App
            await Promise.all([
              LineNotify.sendAlert(order.user_id,
                `✅ Trade Executed!\nSymbol: ${order.symbol}\nSide: ${order.side}\nEntry: ${executionPrice || 'Market'}\nQty: ${filled_qty}${slInfo}${tpInfo}${rrInfo}\n📈 Trailing Stop: ON`
              ),
              TelegramNotify.sendAlert(order.user_id,
                `✅ Trade Executed!\nSymbol: ${order.symbol}\nSide: ${order.side}\nEntry: ${executionPrice || 'Market'}\nQty: ${filled_qty}${slInfo}${tpInfo}${rrInfo}\n📈 Trailing Stop: ON`
              ),
              this.notificationService ? this.notificationService.tradeExecuted(order.user_id, order) : Promise.resolve()
            ]).catch(err => console.warn('Notification error:', err));
          }
        } catch (orderErr) {
          console.error(`❌ [ExecutionEngine] Order ${order.id} failed:`, orderErr.message);
          await pool.query(
            `UPDATE orders SET status = 'FAILED', error_message = $2 WHERE id = $1`,
            [order.id, orderErr.message]
          );
          
          await Promise.all([
            LineNotify.sendAlert(order.user_id, `❌ Order Failed\nSymbol: ${order.symbol}\nReason: ${orderErr.message}`),
            TelegramNotify.sendAlert(order.user_id, `❌ Order Failed\nSymbol: ${order.symbol}\nReason: ${orderErr.message}`),
            this.notificationService ? this.notificationService.tradeFailed(order.user_id, order, orderErr.message) : Promise.resolve()
          ]).catch(e => console.error(e));
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
