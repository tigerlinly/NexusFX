const { pool } = require('../config/database');
const riskCalculator = require('./riskCalculator');

class MockBotEngine {
  constructor() {
    this.intervalMs = 30000; // Run every 30 seconds
    this.running = false;
    this.io = null;
  }

  setIo(io) {
    this.io = io;
  }

  start() {
    this.intervalId = setInterval(() => this.tick(), this.intervalMs);
    console.log('🤖 AI Bot Engine started (Simulating Trading Strategy signals)');
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  async tick() {
    if (this.running) return;
    this.running = true;

    try {
      const activeBotsRes = await pool.query(
         `SELECT * FROM trading_bots WHERE status = 'RUNNING' AND is_active = true`
      );

      const activeBots = activeBotsRes.rows;
      if (activeBots.length === 0) { this.running = false; return; }

      for (const bot of activeBots) {
        if (this.io) {
          const conditions = ['RSI & MACD Analysis', 'SMA Crossover Check', 'Bollinger Bands Squeeze', 'Support/Resistance Retest'];
          const condition = conditions[Math.floor(Math.random() * conditions.length)];
          this.io.to(`user:${bot.user_id}`).emit('bot_activity', {
            bot_id: bot.id, bot_name: bot.bot_name,
            event_type: 'SCANNING',
            message: `Analyzing market with condition: ${condition}`,
            timestamp: new Date().toISOString()
          });
        }

        const wantsToTrade = Math.random() < 0.15;
        if (wantsToTrade) {
          await this.generateSignalForBot(bot);
        } else if (this.io && Math.random() < 0.3) {
          this.io.to(`user:${bot.user_id}`).emit('bot_activity', {
            bot_id: bot.id, bot_name: bot.bot_name,
            event_type: 'INFO',
            message: `Condition not met. Skipping trade.`,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (err) {
      console.error('❌ [BotEngine] Error:', err.message);
    } finally {
      this.running = false;
    }
  }

  async generateSignalForBot(bot) {
    const symbols = ['XAUUSD', 'EURUSD', 'GBPUSD', 'BTCUSDT', 'ETHUSDT'];
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const side = Math.random() > 0.5 ? 'BUY' : 'SELL';

    let volume = parseFloat(bot.parameters?.lot_sizing || bot.lot_sizing || '0.01');
    if (isNaN(volume) || volume <= 0) volume = 0.01;

    // =============================================
    // คำนวณ SL / TP / Trailing ตามกลยุทธ์
    // =============================================
    const strategyType = bot.strategy_type || 'Custom';
    const customParams = bot.parameters || {};
    // Market order → entry_price จะรู้ตอน fill, บันทึก risk params เตรียมไว้
    const riskParams = riskCalculator.calculate(strategyType, symbol, side, 0, customParams);

    console.log(
      `🤖 [BotEngine] Signal! Bot: ${bot.bot_name} → ${side} ${symbol} | ` +
      `SL:${riskParams.sl_pips}pips | TP:${riskParams.tp_pips}pips | ` +
      `Trail:${riskParams.trailing_distance_pips}pips | RR:${riskParams.risk_reward}`
    );

    if (this.io) {
      this.io.to(`user:${bot.user_id}`).emit('bot_activity', {
        bot_id: bot.id, bot_name: bot.bot_name,
        event_type: 'SIGNAL_GENERATED',
        message: `Signal: ${side} ${symbol} | Vol:${volume}L | SL:${riskParams.sl_pips}p | TP:${riskParams.tp_pips}p | Trail:${riskParams.trailing_distance_pips}p [${riskParams.risk_reward}]`,
        timestamp: new Date().toISOString()
      });
    }

    // Insert order พร้อม risk parameters ครบถ้วน
    await pool.query(
      `INSERT INTO orders (
         user_id, account_id, bot_id, symbol, side, order_type, quantity, status,
         pip_size, sl_pips, tp_pips, risk_reward,
         trailing_stop_enabled, trailing_distance_pips, trail_trigger_pips, breakeven_trigger_pips
       ) VALUES (
         $1, $2, $3, $4, $5, 'MARKET', $6, 'PENDING',
         $7, $8, $9, $10,
         true, $11, $12, $13
       )`,
      [
        bot.user_id, bot.account_id, bot.id, symbol, side, volume,
        riskParams.pip_size,
        riskParams.sl_pips,
        riskParams.tp_pips,
        riskParams.risk_reward,
        riskParams.trailing_distance_pips,
        riskParams.trail_trigger_pips,
        riskParams.breakeven_trigger_pips,
      ]
    );

    await pool.query(
      `INSERT INTO bot_events (bot_id, event_type, message) VALUES ($1, $2, $3)`,
      [
        bot.id, 'SIGNAL_GENERATED',
        `Auto-Trade signal: ${side} ${symbol} (Vol:${volume} | SL:${riskParams.sl_pips}p | TP:${riskParams.tp_pips}p | RR:${riskParams.risk_reward} | Trail:${riskParams.trailing_distance_pips}p)`
      ]
    );
  }
}

module.exports = new MockBotEngine();
