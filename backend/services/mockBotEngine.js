const { pool } = require('../config/database');
const crypto = require('crypto');

class MockBotEngine {
  constructor() {
    this.intervalMs = 30000; // Run every 30 seconds
    this.running = false;
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
      // 1. Get all active bots that have strategies assigned
      const activeBotsRes = await pool.query(
         `SELECT tb.*, ss.strategy_type 
          FROM trading_bots tb
          JOIN strategy_store ss ON ss.id = tb.strategy_id
          WHERE tb.status = 'RUNNING'`
      );

      const activeBots = activeBotsRes.rows;
      if (activeBots.length === 0) {
        this.running = false;
        return;
      }

      // Random chance to fire a signal per tick (e.g. 15% chance per bot per 30sec)
      for (const bot of activeBots) {
        const wantsToTrade = Math.random() < 0.15; 
        if (wantsToTrade) {
          await this.generateSignalForBot(bot);
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
    let volume = parseFloat(bot.lot_sizing || '0.01');
    if (isNaN(volume) || volume <= 0) volume = 0.01;

    console.log(`🤖 [BotEngine] Signal Generated! Bot: ${bot.name} -> ${side} ${symbol}`);

    // Insert an order into global orders table, which ExecutionEngine will pick up!
    await pool.query(
      `INSERT INTO orders (user_id, account_id, bot_id, symbol, side, type, quantity, status)
       VALUES ($1, $2, $3, $4, $5, 'MARKET', $6, 'PENDING')`,
      [bot.user_id, bot.account_id, bot.id, symbol, side, volume]
    );

    // Also deduct a small "Trading Fee" from wallet if it's enterprise? 
    // Handled strictly by execution engine.
  }
}

module.exports = new MockBotEngine();
