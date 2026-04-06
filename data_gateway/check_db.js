const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: 'postgresql://nexus_admin:N3xusFX_DataC3nter2026!@203.151.66.51:5432/nexus_datacenter?schema=public',
});

async function checkData() {
  const client = await pool.connect();
  try {
    console.log("--- NexusFX Data Check ---");
    
    // Count total records
    const countRes = await client.query('SELECT COUNT(*) FROM market_candles');
    console.log(`Total records in DB: ${countRes.rows[0].count}`);

    // Count by broker
    const brokerRes = await client.query('SELECT broker, COUNT(*) FROM market_candles GROUP BY broker');
    console.log('\nRecords by Broker:');
    brokerRes.rows.forEach(r => console.log(` - ${r.broker}: ${r.count}`));
    
    // Check latest 5 records
    const audRes = await client.query(`
      SELECT broker, symbol, timeframe, timestamp, close 
      FROM market_candles 
      WHERE symbol = 'AUDUSD' AND timeframe = 'M1'
      ORDER BY timestamp DESC LIMIT 3
    `);
    console.log('\nAUDUSD latest 3:');
    audRes.rows.forEach(r => console.log(`${r.broker} | ${r.timestamp} | C=${r.close}`));

    const btcRes = await client.query(`
      SELECT broker, symbol, timeframe, timestamp, close 
      FROM market_candles 
      WHERE symbol = 'BTCUSD' AND timeframe = 'M1'
      ORDER BY timestamp DESC LIMIT 3
    `);
    console.log('\nBTCUSD latest 3:');
    btcRes.rows.forEach(r => console.log(`${r.broker} | ${r.timestamp} | C=${r.close}`));
    
  } catch (err) {
    console.error('Error fetching data:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

checkData();
