require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function clearData() {
  const client = await pool.connect();
  try {
    console.log('Starting data cleanup...');
    await client.query('BEGIN');
    
    // ดูรายชื่อผู้ใช้ทั้งหมดในระบบก่อน
    const allUsers = await client.query(`SELECT id, username, email FROM users`);
    console.log(`\nTotal users in DB: ${allUsers.rowCount}`);

    // ค้นหา ID ของคนที่ "เก็บไว้" (tiger, demo, admin) ทั้งจากชื่อและอีเมล
    const res = await client.query(`
      SELECT id, username, email FROM users 
      WHERE username IN ('tiger', 'demo', 'admin')
         OR email LIKE 'tiger@%'
         OR email LIKE 'demo@%'
         OR email LIKE 'admin@%'
    `);
    
    const keepIds = res.rows.map(r => r.id);
    
    if (keepIds.length > 0) {
      console.log('\n✅ Keeping these users:');
      res.rows.forEach(r => console.log(`  - ${r.username} (${r.email})`));

      const result = await client.query(`
        DELETE FROM users 
        WHERE id != ALL($1::int[])
      `, [keepIds]);
      
      console.log(`\n🗑️ Deleted ${result.rowCount} users and all their related data (Trades, Accounts, Dashboard, etc.)`);
    } else {
      console.log('\n⚠️ Did not find tiger, demo, or admin in the database. Are you sure? (Keeping everything for safety. Modify script if you want to wipe all).');
    }

    // สั่งเก็บบันทึกการลบ
    await client.query('COMMIT');
    console.log('\n🎉 Cleanup finished successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error clearing data:', err);
  } finally {
    client.release();
    pool.end();
  }
}

clearData();
