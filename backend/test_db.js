require('dotenv').config();
const { pool } = require('./config/database');
async function run() {
  const result = await pool.query(`
    SELECT o.id, o.status, a.id as acc_id, a.broker_id, b.name as broker_name, a.user_id, a.name as acc_name
    FROM orders o 
    LEFT JOIN accounts a ON a.id = o.account_id 
    LEFT JOIN brokers b ON b.id = a.broker_id 
    WHERE o.status = 'PENDING'
  `);
  console.log('PENDING ORDERS:', result.rows);
  
  const bots = await pool.query("SELECT * FROM bots WHERE status = 'RUNNING'");
  console.log('RUNNING BOTS:', bots.rows);
  
  const brokers = await pool.query('SELECT * FROM brokers');
  console.log('ALL BROKERS:', brokers.rows);
  
  process.exit(0);
}
run();
