/**
 * =============================================
 * NEXUSFX — Trailing Stop Engine
 * ติดตามราคาตลาดและเลื่อน SL/TP อัตโนมัติ
 * =============================================
 *
 * การทำงาน:
 * 1. Poll ทุก 10 วินาที หา FILLED orders ที่เปิดอยู่
 * 2. ดึงราคาปัจจุบันจาก MetaAPI หรือ Binance
 * 3. ถ้า trailing condition ถูก trigger → ส่งคำสั่ง modify SL/TP
 * 4. บันทึก log และแจ้งเตือนผ่าน Telegram/LINE
 */

const { pool } = require('../config/database');
const riskCalculator = require('./riskCalculator');
const TelegramNotify = require('./telegramNotify');
const LineNotify = require('./lineNotify');

class TrailingStopEngine {
  constructor() {
    this.running = false;
    this.intervalMs = 10000; // Poll ทุก 10 วินาที
    this.intervalId = null;
    this.io = null;
  }

  setIo(io) { this.io = io; }

  start() {
    this.intervalId = setInterval(() => this.tick(), this.intervalMs);
    console.log('📈 Trailing Stop Engine started (Polling every 10s)');
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.processTrailingOrders();
    } catch (err) {
      console.error('❌ [TrailingEngine] Error:', err.message);
    } finally {
      this.running = false;
    }
  }

  // =============================================
  // MAIN LOOP
  // =============================================
  async processTrailingOrders() {
    // ดึง FILLED orders ที่มี trailing_stop_enabled และมี SL หรือ TP
    const result = await pool.query(`
      SELECT o.*,
             a.metaapi_account_id, a.broker_id,
             us.metaapi_token, us.binance_api_key, us.binance_api_secret,
             b.name as broker_name,
             tb.strategy_type, tb.parameters as bot_parameters
      FROM orders o
      JOIN accounts a ON a.id = o.account_id
      JOIN brokers b ON b.id = a.broker_id
      LEFT JOIN user_settings us ON us.user_id = o.user_id
      LEFT JOIN trading_bots tb ON tb.id = o.bot_id
      WHERE o.status = 'FILLED'
        AND o.trailing_stop_enabled = true
        AND o.current_sl IS NOT NULL
      ORDER BY o.filled_at ASC
      LIMIT 100
    `);

    const orders = result.rows;
    if (orders.length === 0) return;

    console.log(`📈 [TrailingEngine] Checking ${orders.length} open position(s)...`);

    for (const order of orders) {
      try {
        let currentPrice = await this.getCurrentPrice(order);
        if (!currentPrice) continue;

        const trailingResult = riskCalculator.calculateTrailing(order, currentPrice);
        if (!trailingResult || !trailingResult.action) continue;

        console.log(`📈 [TrailingEngine] ${trailingResult.action} triggered! Order ${order.id} | ${order.symbol} | Profit: +${trailingResult.profit_pips} pips | New SL: ${trailingResult.new_sl}`);

        // Modify SL/TP บน Exchange
        await this.modifyPositionOnExchange(order, trailingResult);

        // อัปเดต DB
        await pool.query(`
          UPDATE orders SET
            current_sl = $1,
            current_tp = $2,
            peak_price = $3,
            breakeven_triggered = $4,
            trailing_log = COALESCE(trailing_log, '[]'::jsonb) || $5::jsonb,
            updated_at = NOW()
          WHERE id = $6
        `, [
          trailingResult.new_sl,
          trailingResult.new_tp,
          trailingResult.new_peak,
          trailingResult.breakeven_triggered,
          JSON.stringify([{
            action: trailingResult.action,
            at: new Date().toISOString(),
            price: currentPrice,
            profit_pips: trailingResult.profit_pips,
            new_sl: trailingResult.new_sl,
            new_tp: trailingResult.new_tp,
          }]),
          order.id,
        ]);

        // Emit ไปยัง frontend ผ่าน WebSocket
        if (this.io && order.user_id) {
          this.io.to(`user:${order.user_id}`).emit('trailing_update', {
            order_id: order.id,
            bot_id: order.bot_id,
            symbol: order.symbol,
            action: trailingResult.action,
            profit_pips: trailingResult.profit_pips,
            new_sl: trailingResult.new_sl,
            new_tp: trailingResult.new_tp,
            current_price: currentPrice,
            timestamp: new Date().toISOString(),
          });
        }

        // Notify ผ่าน Telegram ถ้าเป็น Breakeven (event สำคัญ)
        if (trailingResult.action?.includes('BREAKEVEN')) {
          const msg = this.buildNotifyMessage(order, trailingResult, currentPrice);
          await Promise.all([
            TelegramNotify.sendAlert(order.user_id, msg).catch(() => {}),
            LineNotify.sendAlert(order.user_id, msg).catch(() => {}),
          ]);
        }

      } catch (err) {
        console.error(`❌ [TrailingEngine] Order ${order.id} error:`, err.message);
      }
    }
  }

  // =============================================
  // GET CURRENT PRICE
  // =============================================
  async getCurrentPrice(order) {
    try {
      const broker = (order.broker_name || '').toLowerCase();

      if (broker === 'binance') {
        return await this.getBinancePrice(order);
      } else {
        // MetaAPI (MT5: Exness, IC Markets etc.)
        return await this.getMetaApiPrice(order);
      }
    } catch (err) {
      console.warn(`[TrailingEngine] Cannot get price for ${order.symbol}:`, err.message);
      return null;
    }
  }

  async getBinancePrice(order) {
    const symbol = order.symbol.toUpperCase();
    const resp = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    return parseFloat(data.price);
  }

  async getMetaApiPrice(order) {
    if (!order.metaapi_token || !order.metaapi_account_id) return null;
    const MetaApi = require('metaapi.cloud-sdk').default;
    const api = new MetaApi(order.metaapi_token.trim());
    const account = await api.metatraderAccountApi.getAccount(order.metaapi_account_id);
    if (account.state !== 'DEPLOYED') return null;
    const conn = account.getRPCConnection();
    await conn.connect();
    const price = await conn.getSymbolPrice(order.symbol.toUpperCase());
    try { await conn.close(); } catch (e) {}
    return order.side === 'BUY' ? parseFloat(price.ask) : parseFloat(price.bid);
  }

  // =============================================
  // MODIFY POSITION ON EXCHANGE
  // =============================================
  async modifyPositionOnExchange(order, trailingResult) {
    const broker = (order.broker_name || '').toLowerCase();
    if (broker === 'binance') {
      // Binance: ต้องยกเลิก OCO เดิมและสร้างใหม่ (complex, skip for now)
      console.log(`[TrailingEngine] Binance trailing: Updated in DB only (manual intervention needed)`);
      return;
    }

    // MT5 via MetaAPI
    if (!order.metaapi_token || !order.metaapi_account_id || !order.exchange_order_id) {
      console.warn(`[TrailingEngine] Missing MetaAPI credentials or position ID for order ${order.id}`);
      return;
    }

    const MetaApi = require('metaapi.cloud-sdk').default;
    const api = new MetaApi(order.metaapi_token.trim());
    const account = await api.metatraderAccountApi.getAccount(order.metaapi_account_id);
    if (account.state !== 'DEPLOYED') return;

    const conn = account.getRPCConnection();
    await conn.connect();

    try {
      await conn.modifyPosition(
        order.exchange_order_id,
        trailingResult.new_sl ?? undefined,
        trailingResult.new_tp ?? undefined,
      );
      console.log(`✅ [TrailingEngine] Modified position ${order.exchange_order_id} | SL: ${trailingResult.new_sl} | TP: ${trailingResult.new_tp}`);
    } finally {
      try { await conn.close(); } catch (e) {}
    }
  }

  // =============================================
  // NOTIFICATION MESSAGE
  // =============================================
  buildNotifyMessage(order, trailingResult, currentPrice) {
    const actionEmoji = {
      BREAKEVEN: '⚖️',
      TRAIL: '📈',
      'BREAKEVEN+TRAIL': '🚀',
    }[trailingResult.action] || '📊';

    return `${actionEmoji} Trailing Stop Update\n` +
      `Symbol: ${order.symbol} ${order.side}\n` +
      `Action: ${trailingResult.action}\n` +
      `Current Price: ${currentPrice}\n` +
      `Profit: +${trailingResult.profit_pips} pips\n` +
      `New SL: ${trailingResult.new_sl ?? 'N/A'}\n` +
      `New TP: ${trailingResult.new_tp ?? 'N/A'}\n` +
      `⚡ Auto-managed by NexusFX`;
  }
}

module.exports = new TrailingStopEngine();
