const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:nexusfx_secure_password@139.59.96.10:5432/nexusfx' });

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE accounts
      ADD COLUMN IF NOT EXISTS connection_type VARCHAR(20) DEFAULT 'TYPE_3_METAAPI',
      ADD COLUMN IF NOT EXISTS bridge_token VARCHAR(255) DEFAULT '',
      ADD COLUMN IF NOT EXISTS is_master BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS copy_target_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS api_credentials JSONB;
    `);
    
    await client.query(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS copy_source_id INTEGER REFERENCES orders(id) ON DELETE SET NULL;
    `);
    
    console.log('✅ Accounts and Orders tables altered successfully on PRODUCTION.');
  } catch (err) {
    console.error('❌ Error altering table:', err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
