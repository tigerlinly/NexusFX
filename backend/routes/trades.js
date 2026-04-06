const express = require('express');
const { pool } = require('../config/database');
const { authMiddleware, auditLog } = require('../middleware/auth');
const LineNotify = require('../services/lineNotify');
const TelegramNotify = require('../services/telegramNotify');
const PreTradeRiskCheck = require('../services/preTradeRiskCheck');
const { decrypt } = require('../utils/encryption');
const router = express.Router();

router.use(authMiddleware);

// Helper: get filtered account IDs
async function getFilteredAccountIds(userId, view, brokerId, accountId) {
  if (view === 'account' && accountId) {
    const r = await pool.query(
      'SELECT id FROM accounts WHERE id = $1 AND user_id = $2 AND is_active = true',
      [accountId, userId]
    );
    return r.rows.map(r => r.id);
  }
  if (view === 'broker' && brokerId) {
    const r = await pool.query(
      'SELECT id FROM accounts WHERE broker_id = $1 AND user_id = $2 AND is_active = true',
      [brokerId, userId]
    );
    return r.rows.map(r => r.id);
  }
  const r = await pool.query(
    'SELECT id FROM accounts WHERE user_id = $1 AND is_active = true',
    [userId]
  );
  return r.rows.map(r => r.id);
}

// GET /api/trades
router.get('/', async (req, res) => {
  try {
    const {
      view = 'all', broker_id, account_id,
      from, to, symbol, side, status, source,
      page = 1, limit = 50, sort_by = 'closed_at', sort_dir = 'DESC'
    } = req.query;

    const accountIds = await getFilteredAccountIds(req.user.id, view, broker_id, account_id);
    if (accountIds.length === 0) return res.json({ trades: [], total: 0, page: 1, pages: 1 });

    // Build query
    let conditions = ['t.account_id = ANY($1)'];
    let params = [accountIds];
    let paramIdx = 2;

    // Convert date-only strings using PostgreSQL AT TIME ZONE syntax
    if (from) {
      const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(from);
      if (isDateOnly) {
        conditions.push(`DATE(COALESCE(t.closed_at, t.opened_at) AT TIME ZONE 'Asia/Bangkok') >= $${paramIdx}`);
        params.push(from);
      } else {
        conditions.push(`COALESCE(t.closed_at, t.opened_at) >= $${paramIdx}`);
        params.push(from);
      }
      paramIdx++;
    }
    if (to) {
      const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(to);
      if (isDateOnly) {
        conditions.push(`DATE(COALESCE(t.closed_at, t.opened_at) AT TIME ZONE 'Asia/Bangkok') <= $${paramIdx}`);
        params.push(to);
      } else {
        conditions.push(`COALESCE(t.closed_at, t.opened_at) <= $${paramIdx}`);
        params.push(to);
      }
      paramIdx++;
    }
    if (symbol) {
      conditions.push(`t.symbol = $${paramIdx}`);
      params.push(symbol.toUpperCase());
      paramIdx++;
    }
    if (side) {
      conditions.push(`t.side = $${paramIdx}`);
      params.push(side.toUpperCase());
      paramIdx++;
    }
    if (status) {
      conditions.push(`t.status = $${paramIdx}`);
      params.push(status.toUpperCase());
      paramIdx++;
    }
    if (source === 'bot') {
      conditions.push(`(t.bot_id IS NOT NULL OR t.magic_number > 0)`);
    } else if (source === 'manual') {
      conditions.push(`(t.bot_id IS NULL AND (t.magic_number IS NULL OR t.magic_number = 0))`);
    }

    const whereClause = conditions.join(' AND ');
    const SORT_MAP = { closed_at: 't.closed_at', opened_at: 't.opened_at', pnl: 't.pnl', symbol: 't.symbol', lot_size: 't.lot_size' };
    const sortExpr = SORT_MAP[sort_by] || 't.closed_at';
    const sortDir = sort_dir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Count total
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM trades t WHERE ${whereClause}`, params
    );
    const total = parseInt(countResult.rows[0].count);

    // Fetch trades with account & broker info
    const result = await pool.query(
      `SELECT t.*, a.account_name, a.account_number, b.display_name as broker_name
       FROM trades t
       JOIN accounts a ON a.id = t.account_id
       JOIN brokers b ON b.id = a.broker_id
       WHERE ${whereClause}
       ORDER BY ${sortExpr} ${sortDir}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      trades: result.rows,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    console.error('Get trades error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/trades/stats
router.get('/stats', async (req, res) => {
  try {
    const { view = 'all', broker_id, account_id, from, to } = req.query;
    const accountIds = await getFilteredAccountIds(req.user.id, view, broker_id, account_id);

    if (accountIds.length === 0) {
      return res.json({
        total_trades: 0, total_pnl: 0, avg_pnl: 0, win_rate: 0,
        winning_trades: 0, losing_trades: 0, best_trade: 0, worst_trade: 0,
        avg_win: 0, avg_loss: 0, profit_factor: 0, total_volume: 0,
        symbols: [],
      });
    }

    let dateFilter = '';
    let params = [accountIds];
    let paramIdx = 2;

    if (from) {
      const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(from);
      if (isDateOnly) {
        dateFilter += ` AND DATE(closed_at AT TIME ZONE 'Asia/Bangkok') >= $${paramIdx}`;
        params.push(from);
      } else {
        dateFilter += ` AND closed_at >= $${paramIdx}`;
        params.push(from);
      }
      paramIdx++;
    }
    if (to) {
      const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(to);
      if (isDateOnly) {
        dateFilter += ` AND DATE(closed_at AT TIME ZONE 'Asia/Bangkok') <= $${paramIdx}`;
        params.push(to);
      } else {
        dateFilter += ` AND closed_at <= $${paramIdx}`;
        params.push(to);
      }
      paramIdx++;
    }

    const stats = await pool.query(
      `SELECT 
        COUNT(*) as total_trades,
        COALESCE(SUM(pnl), 0) as total_pnl,
        COALESCE(AVG(pnl), 0) as avg_pnl,
        COUNT(*) FILTER (WHERE pnl > 0) as winning_trades,
        COUNT(*) FILTER (WHERE pnl <= 0) as losing_trades,
        COALESCE(MAX(pnl), 0) as best_trade,
        COALESCE(MIN(pnl), 0) as worst_trade,
        COALESCE(AVG(pnl) FILTER (WHERE pnl > 0), 0) as avg_win,
        COALESCE(AVG(pnl) FILTER (WHERE pnl <= 0), 0) as avg_loss,
        COALESCE(SUM(lot_size), 0) as total_volume,
        COALESCE(SUM(pnl) FILTER (WHERE pnl > 0), 0) as gross_profit,
        COALESCE(ABS(SUM(pnl) FILTER (WHERE pnl <= 0)), 0) as gross_loss
       FROM trades 
       WHERE account_id = ANY($1) AND status = 'CLOSED' ${dateFilter}`,
      params
    );

    const s = stats.rows[0];
    const totalTrades = parseInt(s.total_trades);
    const winRate = totalTrades > 0 ? ((s.winning_trades / totalTrades) * 100).toFixed(1) : 0;
    const profitFactor = parseFloat(s.gross_loss) > 0 ? 
      (parseFloat(s.gross_profit) / parseFloat(s.gross_loss)).toFixed(2) : 0;

    // Symbol breakdown
    const symbolStats = await pool.query(
      `SELECT symbol, COUNT(*) as count, COALESCE(SUM(pnl), 0) as pnl
       FROM trades WHERE account_id = ANY($1) AND status = 'CLOSED' ${dateFilter}
       GROUP BY symbol ORDER BY pnl DESC`,
      params
    );

    res.json({
      total_trades: totalTrades,
      total_pnl: parseFloat(s.total_pnl),
      avg_pnl: parseFloat(s.avg_pnl),
      win_rate: parseFloat(winRate),
      winning_trades: parseInt(s.winning_trades),
      losing_trades: parseInt(s.losing_trades),
      best_trade: parseFloat(s.best_trade),
      worst_trade: parseFloat(s.worst_trade),
      avg_win: parseFloat(s.avg_win),
      avg_loss: parseFloat(s.avg_loss),
      profit_factor: parseFloat(profitFactor),
      total_volume: parseFloat(s.total_volume),
      symbols: symbolStats.rows,
    });
  } catch (err) {
    console.error('Trade stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/trades/symbols — unique symbols
router.get('/symbols', async (req, res) => {
  try {
    const accountIds = await getFilteredAccountIds(req.user.id, 'all');
    const result = await pool.query(
      'SELECT DISTINCT symbol FROM trades WHERE account_id = ANY($1) ORDER BY symbol',
      [accountIds]
    );
    res.json(result.rows.map(r => r.symbol));
  } catch (err) {
    console.error('Get symbols error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /trades:
 *   post:
 *     summary: Place a manual trade order
 *     tags: [Trades]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [account_id, symbol, side, lot_size]
 *             properties:
 *               account_id: { type: integer }
 *               symbol: { type: string }
 *               side: { type: string, enum: [BUY, SELL] }
 *               lot_size: { type: number }
 *               order_type: { type: string, enum: [MARKET, LIMIT, STOP] }
 *     responses:
 *       201:
 *         description: Order placed successfully
 */
router.post('/', auditLog('PLACE_TRADE', 'ORDER'), async (req, res) => {
  try {
    const { account_id, symbol, side, lot_size, order_type = 'MARKET', entry_price = null, sl = null, tp = null, slPip = null, tpPip = null } = req.body;
    
    if (!account_id || !symbol || !side || !lot_size) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify account ownership
    const account = await pool.query(`
      SELECT a.*, b.display_name as broker_name 
      FROM accounts a 
      LEFT JOIN brokers b ON a.broker_id = b.id 
      WHERE a.id = $1 AND a.user_id = $2
    `, [account_id, req.user.id]);
    if (account.rows.length === 0) {
      return res.status(403).json({ error: 'Account not found or not authorized' });
    }

    // 🛡️ PRE-TRADE RISK CHECK (blocks risky orders before execution)
    const riskResult = await PreTradeRiskCheck.validate(
      req.user.id, account_id, symbol, side, lot_size
    );
    
    if (!riskResult.allowed) {
      return res.status(422).json({ 
        error: riskResult.reason, 
        risk_blocked: true,
        warnings: riskResult.warnings 
      });
    }

    // Insert into orders table (simulating OMS)
    const orderResult = await pool.query(
      `INSERT INTO orders (account_id, symbol, side, order_type, quantity, price, stop_loss, take_profit, sl_pips, tp_pips, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PENDING') RETURNING *`,
      [account_id, symbol.toUpperCase(), side.toUpperCase(), order_type.toUpperCase(), lot_size, entry_price, sl, tp, slPip, tpPip]
    );
    
    const masterOrderId = orderResult.rows[0].id;

    // COPY TRADING: Check if master and clone orders for slaves
    if (account.rows[0].is_master) {
      const slaves = await pool.query(
        `SELECT id FROM accounts WHERE copy_target_id = $1 AND is_active = true`,
        [account_id]
      );
      for (const slave of slaves.rows) {
        // Skip risk check for slaves for now, or just let execution engine fail it later
        await pool.query(
          `INSERT INTO orders (account_id, symbol, side, order_type, quantity, price, stop_loss, take_profit, sl_pips, tp_pips, copy_source_id, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PENDING')`,
          [slave.id, symbol.toUpperCase(), side.toUpperCase(), order_type.toUpperCase(), lot_size, entry_price, sl, tp, slPip, tpPip, masterOrderId]
        );
      }
    }

    // 🔔 Auto-trigger Line + Telegram Notify
    const tradeInfo = {
      broker_name: account.rows[0].broker_name || 'Unknown',
      account_number: account.rows[0].account_number || '',
      account_name: account.rows[0].account_name || '',
      symbol: symbol.toUpperCase(),
      side: side.toUpperCase(),
      lot_size,
      entry_price,
      stop_loss: sl,
      take_profit: tp,
      timeframe: req.body.tf || '-',
      pattern: order_type
    };
    LineNotify.notifyTradeOpened(req.user.id, tradeInfo).catch(err => console.warn('[LineNotify] Trade notify failed:', err.message));
    TelegramNotify.notifyTradeOpened(req.user.id, tradeInfo).catch(err => console.warn('[TelegramNotify] Trade notify failed:', err.message));

    res.status(201).json({ 
      success: true, 
      order: { ...orderResult.rows[0], lot_size }, 
      message: 'Order submitted successfully',
      risk_warnings: riskResult.warnings.length > 0 ? riskResult.warnings : undefined
    });
  } catch (err) {
    console.error('Place trade error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// sync and sync-all routes removed

// GET /api/trades/live/:accountId
router.get('/live/:accountId', auditLog('VIEW_LIVE_TRADES', 'ACCOUNT'), async (req, res) => {
  try {
    const accountId = req.params.accountId;
    
    // Fetch open trades from local database
    const dbPositions = await pool.query(`
      SELECT ticket, symbol, side, lot_size, entry_price, current_price, pnl, status, opened_at, stop_loss, take_profit
      FROM trades
      WHERE account_id = $1 AND status = 'OPEN'
    `, [accountId]);

    res.json(dbPositions.rows);
  } catch (err) {
    console.error('Live trades error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/trades/sync-live — Save live (open) trades to history if not exist
router.post('/sync-live', async (req, res) => {
  try {
    const { trades: liveTrades } = req.body;
    if (!Array.isArray(liveTrades) || liveTrades.length === 0) {
      return res.json({ success: true, synced: 0, message: 'No trades to sync' });
    }

    // Get all active account IDs for this user to verify ownership and fetch meta
    const userAccounts = await pool.query(
      `SELECT a.id, a.account_number, a.account_name, b.name as broker_name 
       FROM accounts a LEFT JOIN brokers b ON a.broker_id = b.id 
       WHERE a.user_id = $1 AND a.is_active = true`,
      [req.user.id]
    );
    const validAccountMap = {};
    for (const acc of userAccounts.rows) {
      validAccountMap[acc.id.toString()] = acc;
    }

    const validAccountIds = Object.keys(validAccountMap);
    if (validAccountIds.length === 0) {
      return res.json({ success: true, synced: 0, skipped: liveTrades.length, message: 'No valid accounts found.' });
    }

    // Find existing open tickets to distinguish new vs existing
    const existingQuery = await pool.query(
      `SELECT ticket FROM trades WHERE account_id = ANY($1) AND status = 'OPEN'`,
      [validAccountIds]
    );
    const existingTickets = new Set(existingQuery.rows.map(r => String(r.ticket)));

    let synced = 0;
    let skipped = 0;

    const LineNotify = require('../services/lineNotify');
    const TelegramNotify = require('../services/telegramNotify');

    for (const trade of liveTrades) {
      const accountId = (trade._accountId || trade.account_id || '').toString();
      if (!accountId || !validAccountMap[accountId]) {
        skipped++;
        continue;
      }

      const ticket = (trade.ticket || '').toString();
      if (!ticket) {
        skipped++;
        continue;
      }

      const symbol = trade.symbol || 'UNKNOWN';
      const side = (trade.side || 'BUY').toUpperCase();
      const lotSize = parseFloat(trade.lot_size) || 0;
      const entryPrice = parseFloat(trade.entry_price) || 0;
      const currentPrice = parseFloat(trade.current_price) || 0;
      const pnl = parseFloat(trade.pnl) || 0;
      const openedAt = trade.opened_at || new Date().toISOString();
      const sl = trade.stop_loss || null;
      const tp = trade.take_profit || null;

      const isNew = !existingTickets.has(ticket);
      if (isNew) {
        const accountMeta = validAccountMap[accountId];
        const tradeInfo = {
          broker_name: accountMeta.broker_name || 'Unknown',
          account_number: accountMeta.account_number || '',
          account_name: accountMeta.account_name || 'Unknown',
          symbol: symbol,
          side: side,
          lot_size: lotSize,
          entry_price: entryPrice,
          stop_loss: sl || '-',
          take_profit: tp || '-',
          timeframe: '-',
          pattern: 'EXTERNAL'
        };
        TelegramNotify.notifyTradeOpened(req.user.id, tradeInfo).catch(()=>{});
        LineNotify.notifyTradeOpened(req.user.id, tradeInfo).catch(()=>{});
        existingTickets.add(ticket); // prevents duplicate notify edge case
      }

      const insertQuery = `
        INSERT INTO trades (
          account_id, ticket, symbol, side, lot_size, entry_price, exit_price, pnl,
          commission, swap, opened_at, closed_at, status, magic_number, stop_loss, take_profit
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 0, $9, NULL, 'OPEN', 0, $10, $11)
        ON CONFLICT (account_id, ticket) DO UPDATE SET
          pnl = EXCLUDED.pnl,
          exit_price = EXCLUDED.exit_price,
          stop_loss = EXCLUDED.stop_loss,
          take_profit = EXCLUDED.take_profit,
          status = CASE 
            WHEN trades.status = 'CLOSED' THEN trades.status
            ELSE EXCLUDED.status
          END
      `;

      await pool.query(insertQuery, [
        parseInt(accountId), ticket, symbol, side, lotSize, entryPrice, currentPrice, pnl, openedAt, sl, tp
      ]);
      synced++;
    }

    res.json({ success: true, synced, skipped, message: `บันทึก ${synced} ออเดอร์เข้าประวัติเรียบร้อย` });
  } catch (err) {
    console.error('Sync live trades error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
