/**
 * =============================================
 * NEXUSFX — Bot Engine (Real Price Action)
 * ใช้ signalEngine วิเคราะห์ตลาดจริง
 * ไม่ใช่ Random แล้ว!
 * =============================================
 */

const { pool }          = require('../config/database');
const riskCalculator    = require('./riskCalculator');
const { generateSignal, STRATEGY_INTERVAL } = require('./signalEngine');

class MockBotEngine {
  constructor() {
    this.intervalMs = 60000; // Scan ทุก 60 วินาที (ลด API calls)
    this.running    = false;
    this.io         = null;
  }

  setIo(io) { this.io = io; }

  start() {
    this.intervalId = setInterval(() => this.tick(), this.intervalMs);
    console.log('🤖 Bot Engine started (Real Price Action | RSI + MACD + EMA + Bollinger Bands)');
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  // =============================================
  // MAIN LOOP
  // =============================================
  async tick() {
    if (this.running) return;
    this.running = true;

    try {
      const { rows: activeBots } = await pool.query(
        `SELECT * FROM trading_bots WHERE status = 'RUNNING' AND is_active = true`
      );

      if (activeBots.length === 0) return;

      for (const bot of activeBots) {
        await this.processBotSignal(bot);
      }
    } catch (err) {
      console.error('❌ [BotEngine] Error:', err.message);
    } finally {
      this.running = false;
    }
  }

  // =============================================
  // PROCESS SINGLE BOT
  // =============================================
  async processBotSignal(bot) {
    const strategyType = bot.strategy_type || 'Custom';
    const interval     = STRATEGY_INTERVAL[strategyType] || '5m';

    // Notify: Scanning
    this._emit(bot, 'SCANNING',
      `Scanning ${strategyType} strategy on ${interval} chart — Price Action Analysis...`
    );

    try {
      // ============================
      // Real Price Action Analysis
      // ============================
      const signal = await generateSignal(bot);

      if (!signal) {
        this._emit(bot, 'INFO', `No valid signal found — market conditions not met`);
        return;
      }

      // ============================
      // Calculate SL / TP / Trailing
      // ============================
      const volume = this._getVolume(bot, signal);
      const riskParams = riskCalculator.calculate(
        strategyType,
        signal.symbol,
        signal.side,
        0, // entry_price = 0 for market order (filled price set later)
        bot.parameters || {}
      );

      const logMsg =
        `Signal: ${signal.side} ${signal.symbol} @ Market\n` +
        `Strategy: ${strategyType} | Confidence: ${signal.confidence}%\n` +
        `Reason: ${signal.reason}\n` +
        `Vol: ${volume}L | SL: ${riskParams.sl_pips}p | TP: ${riskParams.tp_pips}p ` +
        `| Trail: ${riskParams.trailing_distance_pips}p [${riskParams.risk_reward}]`;

      console.log(`🤖 [BotEngine] ${logMsg.replace(/\n/g, ' | ')}`);
      this._emit(bot, 'SIGNAL_GENERATED', logMsg);

      // ============================
      // Insert Order to DB
      // ============================
      await pool.query(
        `INSERT INTO orders (
           user_id, account_id, bot_id, symbol, side, order_type, quantity, status,
           pip_size, sl_pips, tp_pips, risk_reward,
           trailing_stop_enabled, trailing_distance_pips,
           trail_trigger_pips, breakeven_trigger_pips
         ) VALUES (
           $1, $2, $3, $4, $5, 'MARKET', $6, 'PENDING',
           $7, $8, $9, $10,
           true, $11, $12, $13
         )`,
        [
          bot.user_id, bot.account_id, bot.id,
          signal.symbol, signal.side, volume,
          riskParams.pip_size,
          riskParams.sl_pips,
          riskParams.tp_pips,
          riskParams.risk_reward,
          riskParams.trailing_distance_pips,
          riskParams.trail_trigger_pips,
          riskParams.breakeven_trigger_pips,
        ]
      );

      // Log to bot_events
      await pool.query(
        `INSERT INTO bot_events (bot_id, event_type, message) VALUES ($1, $2, $3)`,
        [
          bot.id, 'SIGNAL_GENERATED',
          `${signal.side} ${signal.symbol} | Confidence:${signal.confidence}% | ${signal.reason} | RR:${riskParams.risk_reward}`,
        ]
      );

    } catch (err) {
      const msg = `Analysis error: ${err.message}`;
      console.warn(`⚠️ [BotEngine] Bot ${bot.bot_name}: ${msg}`);
      this._emit(bot, 'ERROR', msg);

      await pool.query(
        `INSERT INTO bot_events (bot_id, event_type, message) VALUES ($1, $2, $3)`,
        [bot.id, 'ERROR', msg]
      ).catch(() => {});
    }
  }

  // =============================================
  // HELPERS
  // =============================================
  _getVolume(bot, signal) {
    let volume = parseFloat(
      bot.parameters?.lot_sizing ||
      bot.parameters?.volume     ||
      bot.lot_sizing             ||
      '0.01'
    );
    if (isNaN(volume) || volume <= 0) volume = 0.01;

    // Martingale: double lot if last order for this symbol was a loss
    // (simple version — check last closed order)
    return volume;
  }

  _emit(bot, eventType, message) {
    if (!this.io) return;
    this.io.to(`user:${bot.user_id}`).emit('bot_activity', {
      bot_id:     bot.id,
      bot_name:   bot.bot_name,
      event_type: eventType,
      message,
      timestamp:  new Date().toISOString(),
    });
  }
}

module.exports = new MockBotEngine();
