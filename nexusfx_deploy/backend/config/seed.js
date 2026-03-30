const { pool } = require('./database');
const bcrypt = require('bcryptjs');

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // =============================================
    // SEED BROKERS
    // =============================================
    const brokers = [
      { name: 'exness', display_name: 'Exness', protocol: 'MT5' },
      { name: 'xm', display_name: 'XM Global', protocol: 'MT5' },
      { name: 'icmarkets', display_name: 'IC Markets', protocol: 'MT5' },
      { name: 'fbs', display_name: 'FBS', protocol: 'MT5' },
      { name: 'pepperstone', display_name: 'Pepperstone', protocol: 'MT5' },
    ];

    for (const b of brokers) {
      await client.query(
        `INSERT INTO brokers (name, display_name, protocol) 
         VALUES ($1, $2, $3) 
         ON CONFLICT DO NOTHING`,
        [b.name, b.display_name, b.protocol]
      );
    }
    console.log('✅ Brokers seeded');

    // =============================================
    // SEED DEMO USER
    // =============================================
    const passwordHash = await bcrypt.hash('demo1234', 12);
    const userResult = await client.query(
      `INSERT INTO users (username, email, password_hash, display_name) 
       VALUES ('demo', 'demo@nexusfx.com', $1, 'Demo Trader')
       ON CONFLICT (username) DO UPDATE SET password_hash = $1
       RETURNING id`,
      [passwordHash]
    );
    const userId = userResult.rows[0].id;
    console.log('✅ Demo user seeded (demo / demo1234)');

    // =============================================
    // SEED DEMO ACCOUNTS
    // =============================================
    const brokerResult = await client.query('SELECT id, name FROM brokers');
    const brokerMap = {};
    brokerResult.rows.forEach(r => brokerMap[r.name] = r.id);

    const accounts = [
      { broker: 'exness', number: '12345678', name: 'Exness Main', balance: 10000, equity: 10250 },
      { broker: 'exness', number: '12345679', name: 'Exness Scalping', balance: 5000, equity: 5120 },
      { broker: 'xm', number: '87654321', name: 'XM Standard', balance: 8000, equity: 7850 },
      { broker: 'icmarkets', number: '55667788', name: 'IC Raw Spread', balance: 15000, equity: 15430 },
    ];

    const accountIds = [];
    for (const a of accounts) {
      const res = await client.query(
        `INSERT INTO accounts (user_id, broker_id, account_number, account_name, balance, equity)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, broker_id, account_number) 
         DO UPDATE SET balance = $5, equity = $6
         RETURNING id`,
        [userId, brokerMap[a.broker], a.number, a.name, a.balance, a.equity]
      );
      accountIds.push(res.rows[0].id);
    }
    console.log('✅ Demo accounts seeded');

    // =============================================
    // SEED DEMO TRADES
    // =============================================
    const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD'];
    const sides = ['BUY', 'SELL'];
    const now = new Date();

    for (const accId of accountIds) {
      for (let d = 0; d < 30; d++) {
        const numTrades = 3 + Math.floor(Math.random() * 5);
        for (let t = 0; t < numTrades; t++) {
          const symbol = symbols[Math.floor(Math.random() * symbols.length)];
          const side = sides[Math.floor(Math.random() * 2)];
          const lot = (0.01 + Math.random() * 0.5).toFixed(2);
          const basePrice = symbol === 'XAUUSD' ? 2000 + Math.random() * 100 :
                           symbol === 'BTCUSD' ? 60000 + Math.random() * 5000 :
                           symbol === 'USDJPY' ? 150 + Math.random() * 5 :
                           1.0 + Math.random() * 0.3;
          const pips = (Math.random() * 100 - 40);
          const multiplier = symbol === 'XAUUSD' ? 1 :
                            symbol === 'BTCUSD' ? 1 :
                            symbol === 'USDJPY' ? 0.01 : 0.0001;
          const entryPrice = basePrice;
          const exitPrice = side === 'BUY' ? 
            basePrice + pips * multiplier : 
            basePrice - pips * multiplier;
          const pnl = (pips * parseFloat(lot) * (symbol === 'XAUUSD' ? 100 : symbol === 'BTCUSD' ? 1 : 10)).toFixed(2);

          const openDate = new Date(now);
          openDate.setDate(openDate.getDate() - d);
          openDate.setHours(Math.floor(Math.random() * 20) + 2, Math.floor(Math.random() * 60));
          
          const closeDate = new Date(openDate);
          closeDate.setMinutes(closeDate.getMinutes() + 5 + Math.floor(Math.random() * 240));

          await client.query(
            `INSERT INTO trades (account_id, ticket, symbol, side, lot_size, entry_price, exit_price, pnl, commission, swap, opened_at, closed_at, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'CLOSED')
             ON CONFLICT DO NOTHING`,
            [
              accId,
              `${accId}${d}${t}${Date.now()}`,
              symbol,
              side,
              lot,
              entryPrice.toFixed(6),
              exitPrice.toFixed(6),
              pnl,
              -(Math.random() * 3).toFixed(2),
              -(Math.random() * 1).toFixed(2),
              openDate.toISOString(),
              closeDate.toISOString()
            ]
          );
        }
      }
    }
    console.log('✅ Demo trades seeded (30 days × 4 accounts)');

    // =============================================
    // SEED DAILY AGGREGATES
    // =============================================
    for (const accId of accountIds) {
      for (let d = 0; d < 30; d++) {
        const reportDate = new Date(now);
        reportDate.setDate(reportDate.getDate() - d);
        const dateStr = reportDate.toISOString().split('T')[0];

        const tradeStats = await client.query(
          `SELECT 
            COALESCE(SUM(pnl), 0) as total_pnl,
            COUNT(*) as total_trades,
            COUNT(*) FILTER (WHERE pnl > 0) as winning_trades,
            COUNT(*) FILTER (WHERE pnl <= 0) as losing_trades,
            COALESCE(SUM(lot_size), 0) as total_volume,
            COALESCE(MAX(pnl), 0) as best_trade,
            COALESCE(MIN(pnl), 0) as worst_trade
           FROM trades 
           WHERE account_id = $1 AND DATE(closed_at) = $2`,
          [accId, dateStr]
        );

        const stats = tradeStats.rows[0];
        const winRate = stats.total_trades > 0 ? 
          ((stats.winning_trades / stats.total_trades) * 100).toFixed(2) : 0;

        await client.query(
          `INSERT INTO daily_aggregates (account_id, report_date, total_pnl, total_trades, winning_trades, losing_trades, win_rate, total_volume, best_trade, worst_trade)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (account_id, report_date) DO UPDATE SET 
             total_pnl = $3, total_trades = $4, winning_trades = $5, losing_trades = $6, 
             win_rate = $7, total_volume = $8, best_trade = $9, worst_trade = $10`,
          [accId, dateStr, stats.total_pnl, stats.total_trades, stats.winning_trades, 
           stats.losing_trades, winRate, stats.total_volume, stats.best_trade, stats.worst_trade]
        );
      }
    }
    console.log('✅ Daily aggregates computed');

    // =============================================
    // SEED DEFAULT DAILY TARGET
    // =============================================
    await client.query(
      `INSERT INTO daily_targets (user_id, target_amount, action_on_reach, is_active)
       VALUES ($1, 100, 'NOTIFY', true)
       ON CONFLICT DO NOTHING`,
      [userId]
    );
    console.log('✅ Default daily target seeded ($100)');

    // =============================================
    // SEED USER SETTINGS
    // =============================================
    await client.query(
      `INSERT INTO user_settings (user_id, theme_id)
       VALUES ($1, 'dark-trading')
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
    console.log('✅ User settings seeded');

    // =============================================
    // SEED WALLETS & GROUPS
    // =============================================
    await client.query(
      `INSERT INTO wallets (user_id, balance) VALUES ($1, 1000)
       ON CONFLICT DO NOTHING`,
      [userId]
    );
    console.log('✅ Demo wallet seeded ($1000)');

    const groupRes = await client.query(
      `INSERT INTO groups (group_name, description, lead_user_id, config)
       VALUES ('NexusFX Alpha Team', 'Premium Auto-Trading Group', $1, '{"max_drawdown": 500}')
       ON CONFLICT DO NOTHING RETURNING id`,
      [userId]
    );

    if (groupRes.rows.length > 0) {
      await client.query(
        `INSERT INTO group_members (group_id, user_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [groupRes.rows[0].id, userId]
      );
    }
    console.log('✅ Demo group seeded');

    // =============================================
    // SEED DEMO BOTS
    // =============================================
    for (const accId of accountIds) {
      await client.query(
        `INSERT INTO trading_bots (user_id, account_id, bot_name, strategy_type, status)
         VALUES ($1, $2, $3, 'Scalper AI', 'ACTIVE')
         ON CONFLICT DO NOTHING`,
        [userId, accId, `Bot for Acc ${accId}`]
      );
    }
    console.log('✅ Demo trading bots seeded');

    await client.query('COMMIT');
    console.log('\n🎉 All seed data created successfully!');
    console.log('   Login: demo / demo1234');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
