const { pool } = require('./config/database');

async function updateStrategy() {
  try {
    const res = await pool.query(`SELECT id, strategy_details FROM strategies WHERE name ILIKE '%Breakout Bot%'`);
    if (res.rowCount === 0) {
      console.log('Strategy not found!');
      process.exit(0);
    }
    
    for (let row of res.rows) {
      const currentDetails = row.strategy_details || {};
      currentDetails.visual_details = `[Breakout Lines]
- Brk_Max (สีเขียวเหลือง): เส้นแนวต้านสูงสุดที่กลยุทธ์จับตามอง
- Brk_Min (สีส้มแดง): เส้นแนวรับต่ำสุดที่กลยุทธ์จับตามอง

[Zone Detection]
- เมื่อราคาเบรคเส้นใดเส้นหนึ่ง จะเปิดสถานะตามและลบเส้นนั้นทิ้ง
- หากเบรคแรงเกินไป (แท่งเทียนยาวผิดปกติ) ระบบจะไม่เปิดไม้เพื่อลดความเสี่ยงจากการ False Break`;
      
      await pool.query('UPDATE strategies SET strategy_details = $1 WHERE id = $2', [currentDetails, row.id]);
      console.log(`Updated Strategy ID: ${row.id}`);
    }
    console.log('Update success');
  } catch(e) {
    console.error('Error updating:', e);
  } finally {
    process.exit(0);
  }
}

updateStrategy();
