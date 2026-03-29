
async function simulateOrder() {
  try {
    const payload = {
      bot_id: 1, // Assumes Bot ID 1 exists
      symbol: 'BTCUSDT',
      action: 'BUY',
      price: 65000,
      lot_size: 0.1,
      secret: 'YOUR_SECRET_TOKEN' // Assumes secret check is disabled or we can find it
    };
    
    // We will bypass the webhook by directly inserting via pool to simulate if the webhook is complex
    const { pool } = require('./backend/config/database');
    
    console.log('Inserting PENDING order...');
    const orderRes = await pool.query(
      `INSERT INTO orders (account_id, symbol, side, order_type, quantity, price, status) 
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING') RETURNING *`,
      [1, 'BTCUSDT', 'BUY', 'MARKET', 0.1, 65000] // Assuming Account ID 1 exists
    );
    
    console.log('Created PENDING order:', orderRes.rows[0].id);
    console.log('ExecutionEngine should pick this up automatically within 2 seconds!');
    
    setTimeout(() => {
      console.log('Done.');
      process.exit(0);
    }, 5000);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

simulateOrder();
