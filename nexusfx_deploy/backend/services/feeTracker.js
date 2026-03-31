const { pool } = require('../config/database');

class FeeTracker {
  constructor() {
    this.running = false;
    this.successFeeRate = 0.20; // 20% by default
  }

  start() {
    // Run every minute
    this.interval = setInterval(() => this.processFees(), 60 * 1000);
    setTimeout(() => this.processFees(), 10000);
    console.log('✅ Fee Tracker started (1min interval)');
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
  }

  async processFees() {
    if (this.running) return;
    this.running = true;

    try {
      // Find CLOSED trades with positive PnL that don't have a fee log yet
      const trades = await pool.query(
        `SELECT t.id, t.pnl, a.user_id 
         FROM trades t
         JOIN accounts a ON a.id = t.account_id
         LEFT JOIN service_fee_logs f ON f.trade_id = t.id
         WHERE t.status = 'CLOSED' AND t.pnl > 0 AND f.id IS NULL
         LIMIT 100`
      );

      if (trades.rows.length === 0) {
        this.running = false;
        return;
      }

      await pool.query('BEGIN');

      for (const trade of trades.rows) {
        const feeAmount = (parseFloat(trade.pnl) * this.successFeeRate).toFixed(2);
        
        if (feeAmount <= 0) continue;

        // Create fee log
        await pool.query(
          `INSERT INTO service_fee_logs (trade_id, user_id, fee_type, amount, status)
           VALUES ($1, $2, 'SUCCESS_FEE', $3, 'COMPLETED')`,
          [trade.id, trade.user_id, feeAmount]
        );

        // Get or Create user wallet
        const walletResult = await pool.query('SELECT id, balance FROM wallets WHERE user_id = $1 AND currency = $2', [trade.user_id, 'USD']);
        let walletId = null;
        let currentBalance = 0;
        if (walletResult.rows.length > 0) {
          walletId = walletResult.rows[0].id;
          currentBalance = parseFloat(walletResult.rows[0].balance);
        } else {
          const newWallet = await pool.query('INSERT INTO wallets (user_id, currency, balance) VALUES ($1, $2, 0) RETURNING id', [trade.user_id, 'USD']);
          walletId = newWallet.rows[0].id;
        }

        // Skip if wallet balance is insufficient (prevent negative balance)
        if (currentBalance < parseFloat(feeAmount)) {
          console.log(`⚠️ [FeeTracker] Skipping fee for trade #${trade.id} - insufficient balance ($${currentBalance} < $${feeAmount})`);
          continue;
        }

        // Record FEE transaction in their wallet
        await pool.query(
          `INSERT INTO financial_transactions (wallet_id, user_id, type, amount, status, note)
           VALUES ($1, $2, 'FEE', $3, 'COMPLETED', $4)`,
          [walletId, trade.user_id, feeAmount, `Success Fee (20%) for Trade #${trade.id}`]
        );
        
        // Update user wallet balance
        await pool.query(
          `UPDATE wallets SET balance = balance - $1 WHERE user_id = $2 AND currency = 'USD'`,
          [feeAmount, trade.user_id]
        );
      }

      await pool.query('COMMIT');
    } catch (err) {
      await pool.query('ROLLBACK');
      console.error('Fee calculation error:', err);
    } finally {
      this.running = false;
    }
  }
}

module.exports = FeeTracker;
