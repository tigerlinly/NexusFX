require('dotenv').config();
const { pool } = require('./config/database');
async function run() {
  try {
    await pool.query('ALTER TABLE trades ADD COLUMN IF NOT EXISTS stop_loss NUMERIC, ADD COLUMN IF NOT EXISTS take_profit NUMERIC');
    console.log("Success adding columns");
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
run();
