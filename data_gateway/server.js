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
      
      // แปลง Unix Timestamp จากวินาทีเป็น Timestamp with Timezone ของระบบ และเพิ่ม ::numeric ป้องกัน Postgres ตีความผิดเป็น Text
      insertQuery += `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, to_timestamp($${paramIndex++}), $${paramIndex++}::numeric, $${paramIndex++}::numeric, $${paramIndex++}::numeric, $${paramIndex++}::numeric, $${paramIndex++}::numeric)`;
      
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

// --- Phase 3: Trade Execution Queue (In-Memory for High-Speed Polling) ---
// In a real production system, this could be backed by Redis or PostgreSQL
const tradeQueue = [];
let taskCounter = 1000;

// API สำหรับฝั่งระบบแม่ (NestJS, Strategy) เพื่อสั่งยิงออเดอร์เข้ามาเข้าคิว
app.post('/api/trade/execute', (req, res) => {
  const { apiKey, action, symbol, volume, sl, tp, ticket } = req.body;
  if(!apiKey || !action || !symbol || !volume) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const taskId = `CMD_${taskCounter++}`;
  tradeQueue.push({
    taskId,
    apiKey, // ใช้ API Key เช็คพอร์ตปลายทาง
    action: action.toUpperCase(),
    symbol: symbol.toUpperCase(),
    volume,
    sl: sl || 0,
    tp: tp || 0,
    ticket: ticket || 0,
    status: 'PENDING',
    createdAt: new Date()
  });

  console.log(`[Queue] Added Trade Signal -> ${taskId} | ${action} ${symbol} ${volume}`);
  res.status(200).json({ success: true, taskId, message: 'Trade added to execution queue' });
});

// API สำหรับ NexusAPI_Bridge.mq5 วิ่งมาขอออเดอร์ไปยิง (Polling)
app.get('/api/trade/poll', (req, res) => {
  // EA ส่ง API Key มาใน Header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.send("NONE");
  }

  const clientApiKey = authHeader.replace('Bearer ', '');

  // ค้นหาออเดอร์ในคิวที่เป็นของรหัส API นี้และยังรอดำเนินการ
  const pendingTradeIndex = tradeQueue.findIndex(t => t.apiKey === clientApiKey && t.status === 'PENDING');

  if (pendingTradeIndex === -1) {
    // ถ้าไม่มี จบด้วย "NONE"
    return res.send("NONE");
  }

  const trade = tradeQueue[pendingTradeIndex];
  // อัปเดตสถานะหลบการดึงซ้ำให้เป็น PROCESSING
  trade.status = 'PROCESSING';
  
  // แปลงให้อยู่ในฟอร์แมตดิบที่ MQL5 อ่านง่ายๆ: 
  // รหัสคำสั่ง|แอคชัน|คู่เงิน|Lot|SL|TP|เลขTicket
  const responseRaw = `${trade.taskId}|${trade.action}|${trade.symbol}|${trade.volume}|${trade.sl}|${trade.tp}|${trade.ticket}`;
  
  console.log(`[Bridge_Sent] ✈️ ${clientApiKey} Pulled -> ${responseRaw}`);
  res.send(responseRaw);
});

// API สำหรับ NexusAPI_Bridge.mq5 ส่งใบเสร็จกลับมารายงานผล (Callback)
app.post('/api/trade/callback', (req, res) => {
  const { task_id, status, message } = req.body;
  if(!task_id || !status) {
    return res.status(400).json({ error: 'Missing task_id or status' });
  }

  const trade = tradeQueue.find(t => t.taskId === task_id);
  if(trade) {
    trade.status = status; // 'SUCCESS' or 'FAILED'
    trade.executionMessage = message;
    trade.completedAt = new Date();
    
    console.log(`[Bridge_Reply] 📩 ${task_id} Execution: ${status} [${message || ''}]`);
    // หากบันทึกสำเร็จ อาจจะยิงข้อมูลนี้เข้า Database ต่อไป
  }

  res.status(200).json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 NexusFX Data Gateway listening on port ${PORT}`);
  console.log(`Connected to TimescaleDB at ${process.env.DATABASE_URL?.split('@')[1] || 'Unknown'}`);
});
