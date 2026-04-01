const { pool } = require('../backend/config/database');

async function run() {
  try {
    await pool.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS sync_schedules JSONB DEFAULT '["07:00"]'::jsonb`);
    console.log('Added column successfully');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
