/**
 * 🌱 NexusFX Production Seed Script
 * 
 * สร้างข้อมูลเริ่มต้นสำหรับ Production:
 * 1. Super Admin Account (admin / admin@nexusfx.biz)
 * 2. Demo Trader Accounts (สำหรับสร้างบรรยากาศ Community)
 * 3. Forum Posts + Comments (กระทู้หน้าม้าระดับมืออาชีพ)
 * 4. Leaderboard Seed Data
 * 
 * Usage: node scripts/seedProduction.js
 */

const bcrypt = require('bcryptjs');
const { pool, initDatabase } = require('../config/database');
require('dotenv').config();

async function seedProduction() {
  const client = await pool.connect();
  
  try {
    console.log('🌱 Starting NexusFX Production Seed...\n');

    // Ensure schema exists
    await initDatabase();

    await client.query('BEGIN');

    // =============================================
    // 1. SUPER ADMIN ACCOUNT
    // =============================================
    console.log('👑 Creating Super Admin account...');
    
    const adminRoleResult = await client.query("SELECT id FROM roles WHERE role_name = 'admin'");
    const adminRoleId = adminRoleResult.rows.length > 0 ? adminRoleResult.rows[0].id : null;

    const adminExists = await client.query("SELECT id FROM users WHERE username = 'admin'");
    let adminId;

    if (adminExists.rows.length === 0) {
      const adminHash = await bcrypt.hash('NexusFX@2026!', 12);
      const adminResult = await client.query(
        `INSERT INTO users (username, email, password_hash, display_name, role_id, is_active)
         VALUES ('admin', 'admin@nexusfx.biz', $1, 'NexusFX Admin', $2, true)
         RETURNING id`,
        [adminHash, adminRoleId]
      );
      adminId = adminResult.rows[0].id;

      // Create wallet for admin
      await client.query(
        `INSERT INTO wallets (user_id, balance, currency) VALUES ($1, 100000, 'USD')
         ON CONFLICT DO NOTHING`,
        [adminId]
      );

      // Create user_settings for admin
      await client.query(
        `INSERT INTO user_settings (user_id) VALUES ($1)
         ON CONFLICT DO NOTHING`,
        [adminId]
      );

      console.log('   ✅ Admin created: admin / NexusFX@2026!');
    } else {
      adminId = adminExists.rows[0].id;
      console.log('   ⚠️ Admin already exists, skipping...');
    }

    // =============================================
    // 2. DEMO TRADER ACCOUNTS (Community Members)
    // =============================================
    console.log('\n👥 Creating demo trader accounts...');

    const demoTraders = [
      { username: 'MasterPong', email: 'pong@demo.com', display: 'Master Pong 🏆', desc: 'Gold Specialist | Win Rate 78%' },
      { username: 'TraderJay', email: 'jay@demo.com', display: 'TraderJay', desc: 'Forex Scalper | 3 ปีประสบการณ์' },
      { username: 'GoldQueenFX', email: 'queen@demo.com', display: 'GoldQueen 👑', desc: 'ทองคำ & น้ำมัน Swing trader' },
      { username: 'SnipePro', email: 'snipe@demo.com', display: 'SnipePro', desc: 'ปิดไม้แม่น | Smart Money Trader' },
      { username: 'CryptoSam', email: 'sam@demo.com', display: 'CryptoSam', desc: 'BTC/ETH Analysis Expert' },
      { username: 'FXSensei', email: 'sensei@demo.com', display: 'FX Sensei 🥷', desc: 'สอนเทรดฟรี | Mentor' },
      { username: 'PipHunter', email: 'pip@demo.com', display: 'PipHunter', desc: 'EUR/USD Main | 500+ pips/month' },
      { username: 'TraderNut', email: 'nut@demo.com', display: 'Trader Nut', desc: 'เทรดวินัย = กำไรยั่งยืน 💪' },
    ];

    const traderIds = [];
    const userRoleResult = await client.query("SELECT id FROM roles WHERE role_name = 'user'");
    const userRoleId = userRoleResult.rows.length > 0 ? userRoleResult.rows[0].id : null;

    for (const trader of demoTraders) {
      const exists = await client.query('SELECT id FROM users WHERE username = $1', [trader.username]);
      if (exists.rows.length === 0) {
        const hash = await bcrypt.hash('demo1234', 12);
        const result = await client.query(
          `INSERT INTO users (username, email, password_hash, display_name, role_id, is_active)
           VALUES ($1, $2, $3, $4, $5, true) RETURNING id`,
          [trader.username, trader.email, hash, trader.display, userRoleId]
        );
        traderIds.push(result.rows[0].id);
        
        // Create wallet
        await client.query(
          `INSERT INTO wallets (user_id, balance, currency) VALUES ($1, $2, 'USD')
           ON CONFLICT DO NOTHING`,
          [result.rows[0].id, Math.floor(Math.random() * 50000) + 5000]
        );
        
        // Create user_settings
        await client.query(
          `INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
          [result.rows[0].id]
        );
      } else {
        traderIds.push(exists.rows[0].id);
      }
    }
    console.log(`   ✅ Created ${traderIds.length} demo traders`);

    // =============================================
    // 3. FORUM SEED POSTS (Professional-looking)
    // =============================================
    console.log('\n💬 Creating forum posts & comments...');

    const forumPosts = [
      {
        author_idx: 0, // MasterPong
        title: '🔥 วิเคราะห์ทองคำ (XAUUSD) สัปดาห์นี้ — แนวต้าน 2,350 เป็นจุดตัดสินใจ',
        content: `สวัสดีครับเทรดเดอร์ทุกท่าน!

จากการวิเคราะห์ทางเทคนิคสัปดาห์นี้ ทองคำกำลังเทสต์แนวต้านสำคัญที่ระดับ 2,350 USD

📊 Technical Analysis:
• H4: ราคาอยู่เหนือ EMA 50 และ EMA 200 → Bullish structure ยังคงอยู่
• D1: RSI อยู่ที่ 62 ยังไม่เข้า Overbought
• Weekly: Candle สัปดาห์ที่แล้วปิดเป็น Bullish Engulfing

🎯 แผนเทรดของผม:
• Buy Zone: 2,320 - 2,325
• SL: 2,310 (ต่ำกว่า Support)
• TP1: 2,345 | TP2: 2,360

⚠️ ข้อควรระวัง:
คืนวันพุธจะมีข่าว FOMC ซึ่งจะมีผลกระทบต่อดอลลาร์โดยตรง แนะนำให้ลดล็อตก่อนข่าว

ใครมีมุมมองอย่างไรมาแลกเปลี่ยนกันได้ครับ!`,
        category: 'analysis',
        views: 847,
        comments: [
          { author_idx: 1, content: 'เห็นด้วยครับพี่ปอง! Structure H4 ชัดเจนมาก ผม Entry ที่ 2,322 เมื่อวาน ตอนนี้ลอยไม้อยู่ +85 pips 🤑' },
          { author_idx: 2, content: 'ย้อนดู COT Report สัปดาห์ที่แล้วด้วยนะคะ Large Speculators ยังเพิ่ม Long positions ต่อเนื่อง — สอดคล้องกับ Bullish bias ของพี่!' },
          { author_idx: 3, content: 'zone 2,320-2,325 เป็น Demand zone ดีมากครับ ผมวาง Pending ไว้ที่ 2,321 SL 2,308 TP 2,350' },
          { author_idx: 5, content: 'สำหรับมือใหม่ที่อ่านกระทู้นี้ ขอเตือนว่าอย่าลืมจัดการ Risk ก่อนข่าว FOMC ด้วยนะครับ ใช้ lot ไม่เกิน 1-2% ของทุน!' },
        ]
      },
      {
        author_idx: 1, // TraderJay
        title: '💡 เทคนิค Scalping EURUSD ช่วง London Session ที่ผมใช้ทุกวัน',
        content: `แชร์เทคนิค Scalping ที่ผมใช้เทรด EURUSD ช่วง London Session ครับ ทำมาเกือบ 3 ปีแล้ว ค่อนข้างเสถียร

📌 Setup Rules:
1. เทรดเฉพาะช่วง 14:00-18:00 (เวลาไทย)
2. ใช้ EMA 8 + EMA 21 บน M5
3. เข้าเมื่อ Candle ปิดเหนือ/ต่ำกว่า EMA ทั้ง 2 เส้น
4. SL 8-12 pips | TP 15-20 pips (R:R อย่างน้อย 1:1.5)

📊 ผลลัพธ์เดือนที่แล้ว:
• เปิด 48 ไม้ | Win 31 ไม้ | Loss 17 ไม้
• Win Rate: 64.6%
• Net: +312 pips
• Max Drawdown: -45 pips

🔑 Key Point ที่ทำให้ระบบนี้ work ได้ คือ "วินัย" ครับ!
ถ้าเจอ 3 ไม้ Loss ติดกัน = หยุดเทรดวันนั้นทันที ไม่แก้มือ ไม่โกง SL

ใครลองแล้วผลเป็นอย่างไร มาแชร์กันได้ครับ!`,
        category: 'signals',
        views: 1234,
        comments: [
          { author_idx: 0, content: 'Setup เรียบง่ายแต่ได้ผลดีเลยครับ Jay! เรื่องวินัยคือหัวใจจริงๆ ใครเทรดอารมณ์ = พอร์ตพัง 📉' },
          { author_idx: 4, content: 'ลองเอา setup นี้ไปรันบน MT5 Backtest 3 เดือนย้อนหลัง ได้ Win Rate 61% ครับ ค่อนข้างใกล้เคียง! จะลองไลฟ์ดู 🔥' },
          { author_idx: 6, content: 'เทรด EUR/USD ช่วง London เหมือนกันเลยครับ ยืนยันว่า Volume ช่วงนั้นดีมาก spread แคบ ลื่นปรื๊ด' },
          { author_idx: 7, content: 'ขอบคุณที่แชร์ครับพี่ Jay! กำลังหา Scalping system อยู่พอดีเลย 🙏' },
        ]
      },
      {
        author_idx: 4, // CryptoSam
        title: '🚀 BTC ทำ New High! วิเคราะห์ Bitcoin Q2 2026 — จุดเข้าที่น่าสนใจ',
        content: `Bitcoin ทะลุ ATH อีกครั้ง! มาดู roadmap Q2 2026 กันครับ

📈 Fundamental Analysis:
• ETF Inflow ยังเข้าต่อเนื่อง สัปดาห์ละ $500M+
• Halving effect จะเริ่มเห็นชัดในไตรมาสนี้
• Macro: Fed ส่งสัญญาณ dovish → Dollar อ่อน → Crypto up

🔢 On-Chain Data:
• MVRV Ratio: 2.1 (ยังไม่ถึงจุด Bubble zone ที่ 3.5+)
• Active Addresses เพิ่มขึ้น 23% MoM
• Exchange Balance ลดลงต่อเนื่อง = คนถอนไปเก็บ

📊 Key Levels:
• Support: $78,000 - $80,000
• Resistance: $92,000 - $95,000
• Moon Target: $120,000 🌙

🔥 My Play:
DCA Buy ทุกสัปดาห์ + เก็บ Spot 70% / Futures 30%

ใครถือ BTC อยู่ยกมือ! 🙋‍♂️`,
        category: 'analysis',
        views: 2156,
        comments: [
          { author_idx: 0, content: 'ETF Inflow ช่วยได้มากจริงครับ institutional money เข้ามาเรื่อยๆ — ต้องถือยาวครับ BTC ไปไหนไม่ได้แล้ว 🚀' },
          { author_idx: 3, content: 'On-Chain data น่าสนใจมากครับ Sam! MVRV 2.1 ยังมี room ให้ขึ้นอีกเยอะ' },
          { author_idx: 5, content: 'สำหรับมือใหม่: DCA (Dollar Cost Average) คือกลยุทธ์ที่ปลอดภัยที่สุดสำหรับ Crypto ครับ ไม่ต้องจับจังหวะ ซื้อทุกสัปดาห์เท่าๆ กัน 👍' },
        ]
      },
      {
        author_idx: 5, // FXSensei
        title: '📚 [สอนฟรี] Risk Management สำหรับมือใหม่ — กฎ 10 ข้อที่ช่วยพอร์ตคุณรอด',
        content: `สวัสดีครับ! วันนี้ผมจะมาแชร์กฎ Risk Management 10 ข้อที่ผมสอนลูกศิษย์ทุกคน

🛡️ กฎ 10 ข้อ Risk Management:

1. ❌ ห้ามเสี่ยงเกิน 2% ของทุนต่อไม้
2. ⚖️ R:R ขั้นต่ำ 1:1.5 (ถ้า SL 20 pips → TP 30 pips ขึ้นไป)
3. 📊 ไม่เปิดเกิน 3 ไม้พร้อมกัน (ถ้าทุนน้อยกว่า $5,000)
4. 🚫 ไม่เฉลี่ยขาดทุน (Average Down) — ตัดขาดทุนเสมอ
5. 📅 ตรวจ Economic Calendar ก่อนเทรดทุกเช้า
6. 🧘 หยุดเทรดหลัง 3 ไม้ Loss ติด
7. 💰 ถอนกำไร 30% ทุกปลายเดือน
8. 📓 เขียน Trading Journal ทุกไม้
9. 🎯 เทรดเฉพาะคู่เงินที่คุณเข้าใจ (ไม่เกิน 3-4 คู่)
10. 🧠 อย่าเทรดตอนอารมณ์ไม่ดี หรือง่วงนอน

💡 Bonus Tip:
ใช้ Position Size Calculator เสมอ!
สูตร: Lot Size = (ทุน × 2%) ÷ (SL pips × Pip Value)

ถ้าทำตามกฎทั้ง 10 ข้อนี้ได้ ผมรับประกันว่าพอร์ตของคุณจะ "อยู่รอด" ในตลาดได้ยาวนานครับ!

แชร์ต่อได้เลยครับ ช่วยเหลือกันในคอมมูนิตี้ 🤝`,
        category: 'general',
        views: 3421,
        comments: [
          { author_idx: 7, content: 'กระทู้นี้ควรปักหมุดเลยครับอาจารย์! 🙏 ข้อ 6 ช่วยชีวิตผมมาหลายรอบ "หยุดเทรดหลัง 3 ไม้ loss" ง่ายแต่ทำจริงยากมาก' },
          { author_idx: 1, content: 'เห็นด้วย 100% ทุกข้อเลยครับ Sensei! โดยเฉพาะข้อ 4 เฉลี่ยขาดทุนทำพอร์ตพังมาแล้ว เจ็บปวด 😭' },
          { author_idx: 2, content: 'ข้อ 7 สำคัญมากค่ะ! ถอนกำไรออกบ้าง จะได้มี motivation เทรดต่อ ไม่ใช่กำไรอยู่แต่ในบัญชี สุดท้ายคืนตลาดหมด 💸' },
          { author_idx: 0, content: 'สุดยอดเลยครับ Sensei 🔥 ผมเทรดมา 5 ปี ก็ยังใช้กฎพวกนี้อยู่ทุกวัน มือใหม่ต้องอ่านบทความนี้!' },
          { author_idx: 3, content: 'สูตร Lot Size ตรงนั้นดีมากครับ ลองเอาไปทำเป็น Calculator ในเว็บ NexusFX ได้เลยนะ จะเป็นประโยชน์มาก! 👊' },
          { author_idx: 6, content: 'เพิ่มอีกข้อครับ: ห้ามเทรดด้วยเงินที่กู้มา และห้ามเทรดเงินที่สูญเสียไม่ได้ — สำคัญที่สุดเลย 🙏' },
        ]
      },
      {
        author_idx: 2, // GoldQueenFX
        title: '👑 แชร์ผลเทรดเดือนมีนาคม 2026 — ทองคำ +1,247 pips 🔥',
        content: `รายงานผลเทรดเดือนมีนาคม 2026 ค่ะ!

📊 Summary:
• คู่เงินหลัก: XAUUSD, XTIUSD (น้ำมัน)
• จำนวนไม้: 67 ไม้
• Win: 42 ไม้ | Loss: 25 ไม้
• Win Rate: 62.7%
• Total Pips: +1,247 pips ✨
• ROI: +18.3% (ทุนเริ่มต้น $10,000)

🏆 ไม้ที่ดีที่สุดของเดือน:
• XAUUSD Buy ที่ 2,285 → TP 2,342 = +570 pips 🤑
• XTIUSD Sell ที่ 78.50 → TP 74.20 = +430 pips

💡 สิ่งที่เรียนรู้เดือนนี้:
1. ข่าว NFP ทำให้ทองพุ่ง → ต้องรอ Retracement ก่อน Entry
2. น้ำมัน Correlate กับ DXY สูงมากช่วงนี้
3. ไม่ควรเทรดมากกว่า 3 ไม้/วัน (เคยเทรด 8 ไม้แล้ว loss เพราะเหนื่อย)

เดือนหน้ามาอัปเดตอีกนะคะ! ใครอยากตามซิกแนลกดติดตามได้เลย 💜`,
        category: 'master',
        views: 1876,
        comments: [
          { author_idx: 0, content: 'สุดยอดเลยครับ Queen! 18% ROI ในเดือนเดียว consistent มากๆ 🔥 ขอตามไม้ด้วยนะครับ!' },
          { author_idx: 1, content: 'Win Rate 62% แต่ได้กำไรเยอะขนาดนี้เพราะ R:R ดี เป็นตัวอย่างที่ชัดเจนมากว่า Win Rate ไม่ใช่ทุกอย่าง!' },
          { author_idx: 7, content: 'สมัคร Copy Trade ได้ที่ไหนครับพี่ Queen! อยากตามเทรดเลย 💰' },
          { author_idx: 5, content: 'ข้อ 3 นี่เห็นด้วยมากครับ — Over-trading คือศัตรูตัวฉกาจของนักเทรด ไม่ว่าจะเก่งแค่ไหน!' },
        ]
      },
      {
        author_idx: 6, // PipHunter
        title: '🎯 EUR/USD Weekly Outlook — เตรียมตัวรับ ECB Interest Rate Decision!',
        content: `ทุกคนเตรียมตัวรับข่าวสำคัญสัปดาห์หน้ากันด้วยนะครับ!

📅 Economic Calendar สัปดาห์หน้า:
• จันทร์: EU PMI
• อังคาร: US Consumer Confidence
• พุธ: ADP Non-Farm + FOMC Minutes
• พฤหัส: 🚨 ECB Interest Rate Decision + Press Conference
• ศุกร์: US NFP (Non-Farm Payrolls)

📊 EUR/USD Technical (Daily):
• Current: 1.0850
• Key Support: 1.0780 | 1.0720
• Key Resistance: 1.0920 | 1.0980
• Trend: Sideways → leaning Bullish

🔮 My Forecast:
ถ้า ECB คง rate ไว้ + ส่งสัญญาณ Hawkish → EUR จะแข็งค่า → EUR/USD ขึ้น 1.0920+
ถ้า ECB ส่งสัญญาณ Dovish + Possible cut → EUR อ่อน → EUR/USD ลง 1.0780

📌 Strategy:
• Wait & See จนถึงวันพฤหัส
• ถ้าราคา break 1.0920 → Buy ตาม Momentum
• ถ้าราคา break 1.0780 → Sell ตาม Breakdown

อย่าลืมตั้ง SL ก่อนข่าวเสมอนะครับ! Good luck ทุกคน 🍀`,
        category: 'signals',
        views: 956,
        comments: [
          { author_idx: 3, content: 'ECB สัปดาห์หน้าใหญ่มากครับ ผมจะลดขนาด Lot ลงครึ่งหนึ่งก่อนข่าว safe ไว้ก่อน 🛡️' },
          { author_idx: 0, content: 'สัปดาห์หน้ามี NFP ด้วยนี่ ข่าวหนักๆ มาติดๆ กันเลย ระวังกันด้วยนะพวกเรา! 💪' },
          { author_idx: 2, content: 'ผมเน้นเทรดทอง แต่ EUR/USD เทรดด้วยตอนมี setup ชัดๆ ตรงนี้ต้อง Wait & See เหมือนพี่ PipHunter เลยค่ะ' },
        ]
      },
      {
        author_idx: 3, // SnipePro
        title: '💎 Smart Money Concept (SMC) — ทำไมเล่นแบบ Retail ถึงแพ้ตลอด?',
        content: `วันนี้ผมจะมาเปลี่ยนมุมมองพวกคุณเกี่ยวกับการเทรดครับ

🤔 ทำไม 95% ของ Retail Trader ขาดทุน?

เพราะเราเทรด "ตามตลาด" แต่ Market Makers เทรด "สวนตลาด" ครับ!

📌 แนวคิด Smart Money Concept (SMC):
1. Liquidity Sweep: ราคาวิ่งไปกวาด SL ก่อน แล้วค่อยกลับตัว
2. Order Blocks (OB): แท่งเทียนสุดท้ายก่อนการเคลื่อนไหวใหญ่ = จุด Entry ชั้นเยี่ยม
3. Fair Value Gap (FVG): ช่องว่างระหว่างแท่งเทียน = ราคาจะกลับมาเติม
4. Break of Structure (BOS): สัญญาณยืนยัน Trend change

📊 ตัวอย่าง EURUSD เมื่อวาน:
• ราคาวิ่งขึ้นไปกวาด High เก่า (Liquidity grab)
• ทำ BOS ลง
• ย้อนกลับมาเทส OB ที่ 1.0865
• ผม Sell ที่ 1.0863 → TP 1.0820 = +43 pips ✅

🎓 Tips:
• เลิกใช้ Indicator มากเกินไป — ราคาคือ Indicator ที่ดีที่สุด
• ดู Higher Time Frame ก่อน (H4/D1) แล้วค่อยลงมา Entry ที่ M15/M5
• สังเกต "Manipulation" ก่อน = จุด Entry ที่ดีที่สุดมักเกิดหลังจากที่ตลาดหลอกเราแล้ว

ใครสนใจ SMC เพิ่มเติม คอมเมนต์ไว้ได้ครับ จะทำ Series สอนฟรี! 🔥`,
        category: 'analysis',
        views: 2543,
        comments: [
          { author_idx: 5, content: 'SMC เปลี่ยนเกมผมไปเลยครับ! จาก Indicator trader มาเป็น Price Action trader ผลลัพธ์ดีขึ้นเห็นได้ชัด 🎯' },
          { author_idx: 7, content: 'ขอ Series สอน SMC ครับพี่! เพิ่งเริ่มศึกษาอยู่ อยากเข้าใจเรื่อง Liquidity เพิ่มเติม 🙏' },
          { author_idx: 1, content: 'OB + FVG combo คือ setup ที่ Win Rate สูงมากเลยครับ ผมใช้ทุกวัน ยืนยัน! 💪' },
          { author_idx: 0, content: 'แนวคิดดีมากครับ SnipePro! อยากให้เขียนต่อเรื่อง Inducement กับ Mitigation Block ด้วยครับ' },
          { author_idx: 2, content: 'เอาเลยค่ะ! รอ Series SMC จาก SnipePro! 📚🔥' },
        ]
      },
      {
        author_idx: 7, // TraderNut
        title: '🙏 ขอบคุณชาว NexusFX ที่ช่วยกัน — จากขาดทุน 80% สู่กำไรต่อเนื่อง 4 เดือน!',
        content: `วันนี้อยากมาขอบคุณทุกคนในคอมมูนิตี้ NexusFX ครับ

📖 เรื่องราวของผม:
ผมเริ่มเทรดเมื่อ 2 ปีที่แล้ว เปิดบัญชี $3,000 
เดือนแรก: -70% 💀
เดือนที่สอง: ล้างพอร์ต 😭
เติมเงินใหม่ $2,000 แล้วก็ล้างอีก...

ผมเกือบเลิกเทรดแล้วครับ จนกระทั่ง...

🔄 จุดเปลี่ยน:
มาเจอ NexusFX Community ได้อ่านบทความของ FX Sensei เรื่อง Risk Management 
แล้วก็ได้ตาม Signal ของ MasterPong ช่วงแรก เรียนรู้วิธีคิดไปด้วย

📊 ผลลัพธ์ 4 เดือนหลังเปลี่ยนวิธีเทรด:
• เดือนที่ 1: +3.2% ✅
• เดือนที่ 2: +5.1% ✅
• เดือนที่ 3: +4.8% ✅
• เดือนที่ 4 (เดือนนี้): +6.3% ✅

ผมไม่ได้รวยเป็นล้าน แต่ผม "อยู่รอด" แล้วครับ!

🙏 ขอบคุณ:
@MasterPong สำหรับ Gold Analysis ทุกสัปดาห์
@FXSensei สำหรับบทเรียน Risk Management ที่เปลี่ยนชีวิต
@TraderJay สำหรับ Scalping setup ที่ work จริง

และขอบคุณแพลตฟอร์ม NexusFX ที่ทำให้เทรดเดอร์ไทยมีที่ๆ ดีๆ แลกเปลี่ยนกันครับ! 💜

ให้กำลังใจสู้ๆ นะครับทุกคน! ❤️‍🔥`,
        category: 'general',
        views: 4210,
        comments: [
          { author_idx: 5, content: 'น้ำตาจะไหลเลยครับน้อง Nut 😢 ดีใจที่สิ่งที่ผมสอนช่วยได้จริงๆ สู้ต่อไปนะครับ! Consistency มาก่อน Profitability เสมอ 💪' },
          { author_idx: 0, content: 'ยินดีมากๆ ครับน้อง! ROI 4-6% ต่อเดือนอย่างสม่ำเสมอ ดีกว่ากำไร 100% แล้วล้างพอร์ตครั้งต่อไปเยอะ! Keep it up! 🏆' },
          { author_idx: 1, content: 'เรื่องราวแบบนี้ให้กำลังใจมากเลยครับ! เห็นพัฒนาการที่ชัดเจน จาก Gambler สู่ Trader จริงๆ! 👏' },
          { author_idx: 2, content: 'ร้องไห้อ่านเลยค่ะ 😭💜 ทุกคนที่เทรดเป็นล้วนผ่านจุดที่เจ็บปวดมาก่อน ดีใจที่ไม่ยอมแพ้ค่ะ!' },
          { author_idx: 3, content: 'นี่คือ Testimonial ที่ดีที่สุดของ NexusFX เลยครับ! Community ที่ดีช่วยเปลี่ยนชีวิตคนได้จริงๆ 🙏' },
          { author_idx: 4, content: 'Welcome to the profitable side ครับน้อง! 🎉 จำไว้ว่า: Slow and steady wins the race! 🐢' },
          { author_idx: 6, content: 'Consistency is key ครับ! 4-6% ต่อเดือนถ้ารักษาได้ = ปีละ 60-80% ซึ่งเทียบเท่า Hedge Fund ระดับโลกเลยนะครับ! 🌍' },
        ]
      },
    ];

    let postCount = 0;
    let commentCount = 0;

    for (const post of forumPosts) {
      // Check if post already exists
      const existsCheck = await client.query('SELECT id FROM forums WHERE title = $1', [post.title]);
      if (existsCheck.rows.length > 0) continue;

      const authorId = traderIds[post.author_idx] || traderIds[0];
      
      const postResult = await client.query(
        `INSERT INTO forums (author_id, title, content, category, views, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '${Math.floor(Math.random() * 14) + 1} days')
         RETURNING id`,
        [authorId, post.title, post.content, post.category, post.views]
      );
      postCount++;
      
      const postId = postResult.rows[0].id;

      // Insert comments
      for (let i = 0; i < post.comments.length; i++) {
        const comment = post.comments[i];
        const commentAuthorId = traderIds[comment.author_idx] || traderIds[0];
        
        await client.query(
          `INSERT INTO forum_comments (post_id, author_id, content, created_at)
           VALUES ($1, $2, $3, NOW() - INTERVAL '${Math.floor(Math.random() * 13)} days ${Math.floor(Math.random() * 23)} hours')`,
          [postId, commentAuthorId, comment.content]
        );
        commentCount++;
      }

      // Add random likes
      const likeCount = Math.floor(Math.random() * 6) + 2;
      const shuffledTraders = [...traderIds].sort(() => Math.random() - 0.5);
      for (let i = 0; i < Math.min(likeCount, shuffledTraders.length); i++) {
        await client.query(
          `INSERT INTO forum_likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [shuffledTraders[i], postId]
        ).catch(() => {});
      }
    }

    console.log(`   ✅ Created ${postCount} forum posts with ${commentCount} comments`);

    // =============================================
    // 4. PIN IMPORTANT POST
    // =============================================
    console.log('\n📌 Pinning Risk Management post...');
    await client.query(
      `UPDATE forums SET is_pinned = true WHERE title LIKE '%Risk Management%'`
    );
    console.log('   ✅ Risk Management post pinned');

    await client.query('COMMIT');

    // =============================================
    // SUMMARY
    // =============================================
    console.log('\n' + '='.repeat(60));
    console.log('🎉 NexusFX Production Seed Complete!');
    console.log('='.repeat(60));
    console.log('\n👑 Super Admin:');
    console.log('   Username: admin');
    console.log('   Password: NexusFX@2026!');
    console.log('   Email:    admin@nexusfx.biz');
    console.log('\n👥 Demo Traders (8 accounts):');
    console.log('   Password: demo1234 (all)');
    console.log('\n💬 Forum: 8 posts with 35+ comments');
    console.log('\n🌐 Access: https://nexusfx.biz');
    console.log('='.repeat(60) + '\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed error:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seedProduction().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
