const express = require('express');
const { pool } = require('../config/database');
const { bridgeAuth } = require('../middleware/bridgeAuth');
const riskCalculator = require('../services/riskCalculator');
const LineNotify = require('../services/lineNotify');
const TelegramNotify = require('../services/telegramNotify');
const router = express.Router();

// POST /api/bridge/feed — Master Feed EA pushes market candles
router.post('/feed', async (req, res) => {
  try {
    const feedToken = req.headers['x-feed-token'];
    if (feedToken !== (process.env.FEED_TOKEN || 'NEXUS_FEED_SECRET_123')) {
      return res.status(401).json({ error: 'Unauthorized feed token' });
    }

    const { candles } = req.body;
    if (!candles || !Array.isArray(candles)) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const candle of candles) {
        await client.query(`
          INSERT INTO market_candles (symbol, interval, open_time, open, high, low, close, volume)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (symbol, interval, open_time) 
          DO UPDATE SET 
            open = EXCLUDED.open,
            high = EXCLUDED.high,
            low = EXCLUDED.low,
            close = EXCLUDED.close,
            volume = EXCLUDED.volume
        `, [
          candle.symbol, 
          candle.interval, 
          candle.open_time, 
          candle.open, 
          candle.high, 
          candle.low, 
          candle.close, 
          candle.volume
        ]);
      }

      await client.query('COMMIT');
      res.json({ success: true, count: candles.length });
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Bridge feed error:', err);
    res.status(500).json({ error: 'Internal server error while processing feed' });
  }
});

router.use(bridgeAuth);

// GET /api/bridge/ping — EA Heartbeat
// EA sends a ping every 5-10 seconds to keep connection alive
router.get('/ping', async (req, res) => {
  try {
    const { balance, equity } = req.query; // EA can optionally send balance on ping
    
    let updateQuery = `UPDATE accounts SET is_connected = true, last_sync_at = NOW()`;
    let queryParams = [req.account.id];
    
    if (balance && equity) {
        updateQuery += `, balance = $2, equity = $3`;
        queryParams.push(balance, equity);
    }
    
    updateQuery += ` WHERE id = $1`;
    
    await pool.query(updateQuery, queryParams);
    
    res.json({ success: true, message: 'Pong', account_id: req.account.id });
  } catch (err) {
    console.error('Bridge ping error:', err);
    res.status(500).json({ error: 'Internal bridge error' });
  }
});

// POST /api/bridge/sync — Full or Partial Sync from EA
// EA sends its open trades to update the database
router.post('/sync', async (req, res) => {
  const client = await pool.connect();
  try {
    const { balance, equity, trades } = req.body;
    
    await client.query('BEGIN');
    
    // 1. Update Account Balance
    await client.query(
      `UPDATE accounts SET balance = COALESCE($1, balance), equity = COALESCE($2, equity), is_connected = true, last_sync_at = NOW() WHERE id = $3`,
      [balance, equity, req.account.id]
    );

    // Auto update target to 5% if it's currently 0 or NULL
    if (balance > 0) {
      await client.query(
        `UPDATE daily_targets SET target_amount = $1 
         WHERE account_id = $2 AND (target_amount = 0 OR target_amount IS NULL)`,
        [(balance * 0.05).toFixed(2), req.account.id]
      );
    }

    // 2. Sync Trades (UPSERT pattern for open positions)
    if (trades && Array.isArray(trades)) {
      for (const trade of trades) {
        // Assume trade object mapping standard MQL to DB fields
        await client.query(`
          INSERT INTO trades (account_id, ticket, symbol, side, lot_size, entry_price, stop_loss, take_profit, current_price, pnl, status, opened_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'OPEN', COALESCE($11, NOW()))
          ON CONFLICT (account_id, ticket) 
          DO UPDATE SET 
            current_price = EXCLUDED.current_price,
            pnl = EXCLUDED.pnl,
            stop_loss = EXCLUDED.stop_loss,
            take_profit = EXCLUDED.take_profit,
            status = 'OPEN'
        `, [
          req.account.id, 
          String(trade.ticket), 
          trade.symbol, 
          trade.type === 0 ? 'BUY' : 'SELL', // Assuming 0=BUY, 1=SELL
          trade.lots, 
          trade.open_price, 
          trade.sl || 0, 
          trade.tp || 0, 
          trade.current_price, 
          trade.profit,
          trade.open_time ? new Date(trade.open_time * 1000) : null // Unix timestamp conversion
        ]);
      }
    }
    
    await client.query('COMMIT');
    
    // Broadcast via socketio so frontend sees the update instantly
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${req.account.user_id}`).emit('account_sync', {
        account_id: req.account.id,
        balance,
        equity
      });
    }

    // 3. Fetch Pending Commands (Orders) for this account
    // We UPDATE to 'PROCESSING' immediately so the EA doesn't get the same order twice
    // if the next sync request happens before the EA finishes execution.
    const pendingOrdersResult = await client.query(
      `UPDATE orders 
       SET status = 'PROCESSING', updated_at = NOW()
       WHERE account_id = $1 AND status = 'PENDING'
       RETURNING id, symbol, side, quantity, order_type, price, stop_loss, take_profit`,
       [req.account.id]
    );

    const pendingCommands = pendingOrdersResult.rows;

    res.json({ 
      success: true, 
      synced_trades: trades ? trades.length : 0,
      pending_commands: pendingCommands
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Bridge sync error:', err);
    res.status(500).json({ error: 'Internal bridge error during sync' });
  } finally {
    client.release();
  }
});

// POST /api/bridge/close-trade — Notify when a trade is closed
router.post('/close-trade', async (req, res) => {
  try {
    const { ticket, close_price, profit, close_time } = req.body;
    
    await pool.query(
      `UPDATE trades SET 
        status = 'CLOSED', 
        exit_price = $1, 
        pnl = $2, 
        closed_at = COALESCE($3, NOW()) 
       WHERE account_id = $4 AND ticket = $5 AND status = 'OPEN'`,
      [close_price, profit, close_time ? new Date(close_time * 1000) : null, req.account.id, String(ticket)]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Bridge close-trade error:', err);
    res.status(500).json({ error: 'Internal bridge error' });
  }
});

// POST /api/bridge/command-result — EA reports back order execution
router.post('/command-result', async (req, res) => {
  try {
    const { order_id, success, ticket, error_message, execution_price } = req.body;
    
    if (success) {
      // Fetch full order to recalculate risk
      const orderRes = await pool.query(`SELECT * FROM orders WHERE id = $1 AND account_id = $2`, [order_id, req.account.id]);
      if (orderRes.rows.length > 0) {
        const order = orderRes.rows[0];
        
        let finalSL = order.stop_loss;
        let finalTP = order.take_profit;

        if (execution_price && execution_price > 0) {
          const strategyType = order.strategy_type || 'Custom';
          const recalculated = riskCalculator.calculate(
            strategyType, order.symbol, order.side, execution_price, {
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
            exchange_order_id = $1, 
            filled_at = NOW(), 
            updated_at = NOW(),
            entry_price = COALESCE($2, price),
            stop_loss = COALESCE($3, stop_loss),
            take_profit = COALESCE($4, take_profit),
            current_sl = COALESCE($3, stop_loss),
            current_tp = COALESCE($4, take_profit),
            peak_price = COALESCE($2, price),
            filled_quantity = quantity
           WHERE id = $5 AND account_id = $6`,
          [String(ticket), execution_price, finalSL, finalTP, order_id, req.account.id]
        );

        const slInfo = finalSL ? `\\nSL: ${finalSL}` : '';
        const tpInfo = finalTP ? `\\nTP: ${finalTP}` : '';
        const rrInfo = order.risk_reward ? ` [${order.risk_reward}]` : '';

        // Notifications
        await Promise.all([
          LineNotify.sendAlert(order.user_id,
            `✅ Bridge Trade Executed!\\nSymbol: ${order.symbol}\\nSide: ${order.side}\\nEntry: ${execution_price || 'Market'}\\nQty: ${order.quantity}${slInfo}${tpInfo}${rrInfo}`
          ),
          TelegramNotify.sendAlert(order.user_id,
            `✅ Bridge Trade Executed!\\nSymbol: ${order.symbol}\\nSide: ${order.side}\\nEntry: ${execution_price || 'Market'}\\nQty: ${order.quantity}${slInfo}${tpInfo}${rrInfo}`
          )
        ]).catch(e => console.warn('Bridge Notification error:', e));
      }
    } else {
      await pool.query(
        `UPDATE orders SET 
          status = 'FAILED', 
          error_message = $1, 
          updated_at = NOW() 
         WHERE id = $2 AND account_id = $3`,
        [error_message || 'EA Execution Failed', order_id, req.account.id]
      );
      
      const orderRes = await pool.query(`SELECT user_id, symbol FROM orders WHERE id = $1`, [order_id]);
      if (orderRes.rows.length > 0) {
        const u = orderRes.rows[0];
        await Promise.all([
          LineNotify.sendAlert(u.user_id, `❌ Bridge Order Failed\\nSymbol: ${u.symbol}\\nReason: ${error_message}`),
          TelegramNotify.sendAlert(u.user_id, `❌ Bridge Order Failed\\nSymbol: ${u.symbol}\\nReason: ${error_message}`)
        ]).catch(e => console.error(e));
      }
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Bridge command-result error:', err);
    res.status(500).json({ error: 'Internal bridge error' });
  }
});

module.exports = router;
