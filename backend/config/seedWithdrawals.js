const { pool, initDatabase } = require('./database');

async function seedWithdrawals() {
  await initDatabase();
  
  const userRes = await pool.query("SELECT id FROM users WHERE username = 'demo'");
  if (userRes.rows.length === 0) { console.log('No demo user'); process.exit(1); }
  const userId = userRes.rows[0].id;
  
  const accs = await pool.query('SELECT id FROM accounts WHERE user_id = $1', [userId]);
  const accountIds = accs.rows.map(r => r.id);
  
  // Clear existing
  await pool.query('DELETE FROM withdrawals WHERE user_id = $1', [userId]);
  
  const methods = ['Bank Transfer', 'USD/USDT (TRC20)', 'Crypto BTC', 'Local Transfer'];
  
  for (const accId of accountIds) {
    const numW = Math.floor(Math.random() * 3) + 2; // 2-4 withdrawals per account
    for (let i = 0; i < numW; i++) {
      const amount = (Math.random() * 500 + 100).toFixed(2);
      const method = methods[Math.floor(Math.random() * methods.length)];
      const daysAgo = Math.floor(Math.random() * 60) + 1;
      await pool.query(
        `INSERT INTO withdrawals(user_id, account_id, amount, method, status, withdrawn_at) 
         VALUES($1, $2, $3, $4, 'COMPLETED', NOW() - ($5 || ' days')::interval)`,
        [userId, accId, amount, method, daysAgo]
      );
    }
  }
  
  const total = await pool.query('SELECT COUNT(*) as cnt, SUM(amount) as total FROM withdrawals WHERE user_id = $1', [userId]);
  console.log(`✅ Seeded ${total.rows[0].cnt} withdrawals, total: $${parseFloat(total.rows[0].total).toFixed(2)}`);
  await pool.end();
}

seedWithdrawals().catch(e => { console.error(e); process.exit(1); });
