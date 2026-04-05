require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Pool } = require('pg');

const app = express();
app.use(express.json({ limit: '50mb' })); // รองรับแพ็คเกจข้อมูลราคาขนาดใหญ่
app.use(cors());
app.use(helmet());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 50, // รองรับ Connection ได้เยอะกว่าปกติเพราะเป็น Data Center
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// API สำหรับรับข้อมูลแท่งเทียนแบบ Batch (ทีละหลายๆ แท่ง)
// รูปแบบข้อมูล: [{ broker, symbol, timeframe, timestamp, open, high, low, close, volume }]
app.post('/api/ingest', async (req, res) => {
  const data = req.body;
  if (!Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ error: 'Payload must be a non-empty array of records.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // สร้างคำสั่ง Bulk Insert ที่มีประสิทธิภาพสำหรับ PostgreSQL
    let insertQuery = `
      INSERT INTO market_candles (broker, symbol, timeframe, "timestamp", open, high, low, close, volume)
      VALUES 
    `;
    const values = [];
    let paramIndex = 1;
    
    for (const record of data) {
      if (paramIndex > 1) insertQuery += ', ';
      
      // แปลง Unix Timestamp จากวินาทีเป็น Timestamp with Timezone ของระบบ
      insertQuery += `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, to_timestamp($${paramIndex++}), $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`;
      
      values.push(
        record.broker || 'GbeBrokers',
        record.symbol,
        record.timeframe,
        record.timestamp, // Unix timestamp in seconds
        record.open,
        record.high,
        record.low,
        record.close,
        record.volume
      );
    }
    
    // หากข้อมูลแท่งนั้นมีอยู่แล้ว ให้ทำการอัปเดตราคาล่าสุด (เหมาะสำหรับแท่งปัจจุบันที่ยังสวิงอยู่)
    insertQuery += ` ON CONFLICT (broker, symbol, timeframe, "timestamp") DO UPDATE SET 
      open = EXCLUDED.open,
      high = EXCLUDED.high,
      low = EXCLUDED.low,
      close = EXCLUDED.close,
      volume = EXCLUDED.volume;`;

    await client.query(insertQuery, values);
    await client.query('COMMIT');
    
    res.status(200).json({ success: true, count: data.length });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ingestion Error:', error.message);
    res.status(500).json({ error: 'Failed to ingest data', details: error.message });
  } finally {
    client.release();
  }
});

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'NexusFX Data Gateway' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 NexusFX Data Gateway listening on port ${PORT}`);
  console.log(`Connected to TimescaleDB at ${process.env.DATABASE_URL?.split('@')[1] || 'Unknown'}`);
});
