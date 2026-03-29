const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:qwerty@localhost:5432/nexusfx' });

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE user_settings 
      ADD COLUMN IF NOT EXISTS notify_new_trade BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS metaapi_token VARCHAR(255) DEFAULT '',
      ADD COLUMN IF NOT EXISTS auto_sync BOOLEAN DEFAULT true;
    `);
    console.log('✅ Columns added successfully.');
  } catch (err) {
    console.error('❌ Error altering table:', err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
