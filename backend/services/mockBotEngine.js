const { pool } = require('../config/database');
const crypto = require('crypto');

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
      // 1. Get all active bots
      const activeBotsRes = await pool.query(
         `SELECT * 
          FROM trading_bots
          WHERE status = 'RUNNING' AND is_active = true`
      );

      const activeBots = activeBotsRes.rows;
      if (activeBots.length === 0) {
        this.running = false;
        return;
      }

      // Random chance to fire a signal per tick (e.g. 15% chance per bot per 30sec)
      for (const bot of activeBots) {
        // Emit "Scanning" activity for monitoring
        if (this.io) {
          const conditions = ['RSI & MACD Analysis', 'SMA Crossover Check', 'Bollinger Bands Squeeze', 'Support/Resistance Retest'];
          const condition = conditions[Math.floor(Math.random() * conditions.length)];
          this.io.to(`user:${bot.user_id}`).emit('bot_activity', {
            bot_id: bot.id,
            bot_name: bot.bot_name,
            event_type: 'SCANNING',
            message: `Analyzing market with condition: ${condition}`,
            timestamp: new Date().toISOString()
          });
        }

        const wantsToTrade = Math.random() < 0.15; 
        if (wantsToTrade) {
          await this.generateSignalForBot(bot);
        } else if (this.io && Math.random() < 0.3) {
          // Occasionally log "No trade"
          this.io.to(`user:${bot.user_id}`).emit('bot_activity', {
            bot_id: bot.id,
            bot_name: bot.bot_name,
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
    const symbols = ['BTCUSDT', 'ETHUSDT', 'XAUUSD', 'EURUSD'];
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
    
    // Volume base logic
    let volume = parseFloat(bot.parameters?.lot_sizing || bot.lot_sizing || '0.01');
    if (isNaN(volume) || volume <= 0) volume = 0.01;

    console.log(`🤖 [BotEngine] Signal Generated! Bot: ${bot.bot_name} -> ${side} ${symbol}`);

    if (this.io) {
      this.io.to(`user:${bot.user_id}`).emit('bot_activity', {
        bot_id: bot.id,
        bot_name: bot.bot_name,
        event_type: 'SIGNAL_GENERATED',
        message: `Signal generated: ${side} ${symbol} @ ${volume} LOT`,
        timestamp: new Date().toISOString()
      });
    }

    // Insert an order into global orders table, which ExecutionEngine will pick up!
    await pool.query(
      `INSERT INTO orders (user_id, account_id, bot_id, symbol, side, order_type, quantity, status)
       VALUES ($1, $2, $3, $4, $5, 'MARKET', $6, 'PENDING')`,
      [bot.user_id, bot.account_id, bot.id, symbol, side, volume]
    );

    // Write to bot_events for persistence
    await pool.query(
      `INSERT INTO bot_events (bot_id, event_type, message) VALUES ($1, $2, $3)`,
      [bot.id, 'SIGNAL_GENERATED', `Auto-Trade signal: ${side} ${symbol} (Vol: ${volume})`]
    );

    // Also deduct a small "Trading Fee" from wallet if it's enterprise? 
    // Handled strictly by execution engine.
  }
}

module.exports = new MockBotEngine();
