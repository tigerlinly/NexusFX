const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:nexusfx_secure_password@139.59.96.10:5432/nexusfx' });

async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'orders'");
    console.log(res.rows.map(r => r.column_name).join(', '));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    pool.end();
  }
}
run();
