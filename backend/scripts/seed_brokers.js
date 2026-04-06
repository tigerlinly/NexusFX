/**
 * 🏦 NexusFX - Seed Recommended Brokers
 * สคริปต์สำหรับเพิ่มข้อมูลโบรกเกอร์ที่แนะนำเข้าสู่ระบบ
 * 
 * Usage: node scripts/seed_brokers.js
 * 
 * หมายเหตุ: สคริปต์จะตรวจสอบก่อนว่าโบรกเกอร์มีอยู่แล้วหรือไม่ (ตาม name)
 *           ถ้ามีแล้วจะข้ามไป ไม่สร้างซ้ำ
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const brokers = [
  {
    name: 'Exness',
    display_name: 'Exness Global',
    market_type: 'Forex',
    protocol: 'MT5',
    logo_url: 'https://logo.clearbit.com/exness.com',
    is_active: true,
    regulation: 'FCA (UK), CySEC (Cyprus), FSA (Seychelles)',
    country: 'Cyprus',
    website: 'https://www.exness.com',
    max_leverage: '1:Unlimited',
    min_deposit: 1.00,
    description: 'โบรกเกอร์ระดับโลกที่มี Leverage สูงสุด Unlimited รองรับ MT5 เต็มรูปแบบ สเปรดต่ำเริ่มต้น 0.0 pip มีระบบฝาก-ถอนรวดเร็ว รองรับหลายสกุลเงิน',
    rating: 4.8,
    spread_from: '0.0 pip',
    platforms: 'MT4, MT5, Web Terminal',
  },
  {
    name: 'IC Markets',
    display_name: 'IC Markets',
    market_type: 'Forex',
    protocol: 'MT5',
    logo_url: 'https://logo.clearbit.com/icmarkets.com',
    is_active: true,
    regulation: 'ASIC (Australia), CySEC (Cyprus), FSA (Seychelles)',
    country: 'Australia',
    website: 'https://www.icmarkets.com',
    max_leverage: '1:500',
    min_deposit: 200.00,
    description: 'โบรกเกอร์ชั้นนำสำหรับเทรดเดอร์มืออาชีพ มี Raw Spread Account เริ่มต้น 0.0 pip ระบบ Execution เร็วมาก เหมาะกับ Scalping และ EA Trading',
    rating: 4.7,
    spread_from: '0.0 pip',
    platforms: 'MT4, MT5, cTrader',
  },
  {
    name: 'XM',
    display_name: 'XM Global',
    market_type: 'Forex',
    protocol: 'MT5',
    logo_url: 'https://logo.clearbit.com/xm.com',
    is_active: true,
    regulation: 'CySEC (Cyprus), ASIC (Australia), IFSC (Belize)',
    country: 'Cyprus',
    website: 'https://www.xm.com',
    max_leverage: '1:1000',
    min_deposit: 5.00,
    description: 'โบรกเกอร์ยอดนิยมสำหรับผู้เริ่มต้น มีโบนัสต้อนรับ 30 USD ไม่ต้องฝากเงิน บัญชี Micro เริ่มต้นได้ง่าย มีสื่อการเรียนรู้ครบครัน',
    rating: 4.5,
    spread_from: '0.6 pip',
    platforms: 'MT4, MT5, XM App',
  },
  {
    name: 'FBS',
    display_name: 'FBS Markets',
    market_type: 'Forex',
    protocol: 'MT5',
    logo_url: 'https://logo.clearbit.com/fbs.com',
    is_active: true,
    regulation: 'CySEC (Cyprus), ASIC (Australia), IFSC (Belize)',
    country: 'Belize',
    website: 'https://www.fbs.com',
    max_leverage: '1:3000',
    min_deposit: 1.00,
    description: 'โบรกเกอร์ที่มี Leverage สูงถึง 1:3000 เหมาะสำหรับเทรดเดอร์ที่ต้องการเทรดด้วยเงินน้อย มีโปรโมชั่นและโบนัสหลากหลาย',
    rating: 4.3,
    spread_from: '0.5 pip',
    platforms: 'MT4, MT5, FBS App',
  },
  {
    name: 'Pepperstone',
    display_name: 'Pepperstone',
    market_type: 'Forex',
    protocol: 'MT5',
    logo_url: 'https://logo.clearbit.com/pepperstone.com',
    is_active: true,
    regulation: 'FCA (UK), ASIC (Australia), CySEC (Cyprus), DFSA (Dubai)',
    country: 'Australia',
    website: 'https://www.pepperstone.com',
    max_leverage: '1:500',
    min_deposit: 200.00,
    description: 'โบรกเกอร์ที่ได้รางวัลมากมาย ระบบ Execution เร็วมาก สเปรดต่ำ เหมาะกับ Scalper และ Algo Trading รองรับ cTrader และ TradingView',
    rating: 4.7,
    spread_from: '0.0 pip',
    platforms: 'MT4, MT5, cTrader, TradingView',
  },
  {
    name: 'FXTM',
    display_name: 'FXTM (ForexTime)',
    market_type: 'Forex',
    protocol: 'MT5',
    logo_url: 'https://logo.clearbit.com/forextime.com',
    is_active: true,
    regulation: 'FCA (UK), CySEC (Cyprus), FSCA (South Africa)',
    country: 'Cyprus',
    website: 'https://www.forextime.com',
    max_leverage: '1:2000',
    min_deposit: 10.00,
    description: 'โบรกเกอร์ระดับสากลที่เชื่อถือได้ มี Leverage สูงถึง 1:2000 สำหรับบัญชี Advantage Plus รองรับ Copy Trading และมีเครื่องมือวิเคราะห์ครบ',
    rating: 4.4,
    spread_from: '0.1 pip',
    platforms: 'MT4, MT5, FXTM App',
  },
  {
    name: 'Tickmill',
    display_name: 'Tickmill',
    market_type: 'Forex',
    protocol: 'MT5',
    logo_url: 'https://logo.clearbit.com/tickmill.com',
    is_active: true,
    regulation: 'FCA (UK), CySEC (Cyprus), FSA (Seychelles)',
    country: 'UK',
    website: 'https://www.tickmill.com',
    max_leverage: '1:500',
    min_deposit: 100.00,
    description: 'โบรกเกอร์ที่ขึ้นชื่อเรื่อง Low Cost Trading ค่าคอมมิชชั่นต่ำมาก เหมาะกับ Day Trader และ High Volume Trader',
    rating: 4.5,
    spread_from: '0.0 pip',
    platforms: 'MT4, MT5, Tickmill App',
  },
  {
    name: 'RoboForex',
    display_name: 'RoboForex',
    market_type: 'Forex',
    protocol: 'MT5',
    logo_url: 'https://logo.clearbit.com/roboforex.com',
    is_active: true,
    regulation: 'IFSC (Belize)',
    country: 'Belize',
    website: 'https://www.roboforex.com',
    max_leverage: '1:2000',
    min_deposit: 10.00,
    description: 'โบรกเกอร์ที่รองรับ EA, Copy Trading และ PAMM Account มี Leverage สูงและสเปรดแคบ เหมาะกับ Automated Trading',
    rating: 4.3,
    spread_from: '0.0 pip',
    platforms: 'MT4, MT5, cTrader, R StocksTrader',
  },
  {
    name: 'Vantage',
    display_name: 'Vantage Markets',
    market_type: 'Forex',
    protocol: 'MT5',
    logo_url: 'https://logo.clearbit.com/vantagemarkets.com',
    is_active: true,
    regulation: 'ASIC (Australia), CIMA (Cayman Islands)',
    country: 'Australia',
    website: 'https://www.vantagemarkets.com',
    max_leverage: '1:500',
    min_deposit: 50.00,
    description: 'โบรกเกอร์ ECN ที่มีสเปรดต่ำ รองรับ MT5 และ ProTrader เหมาะกับเทรดเดอร์ที่ต้องการ Raw ECN Pricing',
    rating: 4.4,
    spread_from: '0.0 pip',
    platforms: 'MT4, MT5, ProTrader, TradingView',
  },
  {
    name: 'HFM',
    display_name: 'HFM (HotForex)',
    market_type: 'Forex',
    protocol: 'MT5',
    logo_url: 'https://logo.clearbit.com/hfm.com',
    is_active: true,
    regulation: 'FCA (UK), CySEC (Cyprus), DFSA (Dubai), FSA (Seychelles)',
    country: 'Cyprus',
    website: 'https://www.hfm.com',
    max_leverage: '1:2000',
    min_deposit: 0.00,
    description: 'โบรกเกอร์ที่ได้รับรางวัลมากกว่า 60 รางวัล มีบัญชี Zero Spread และ PAMM/HFcopy สำหรับ Social Trading ฝากขั้นต่ำ 0 ดอลลาร์',
    rating: 4.5,
    spread_from: '0.0 pip',
    platforms: 'MT4, MT5, HFM App',
  },
];

async function seedBrokers() {
  const client = await pool.connect();
  try {
    console.log('🏦 Starting broker seed process...\n');

    let inserted = 0;
    let skipped = 0;

    for (const broker of brokers) {
      // Check if broker already exists
      const existing = await client.query(
        'SELECT id FROM brokers WHERE name = $1',
        [broker.name]
      );

      if (existing.rows.length > 0) {
        console.log(`  ⏭️  ${broker.name} — already exists (ID: ${existing.rows[0].id}), skipping`);
        skipped++;
        continue;
      }

      const result = await client.query(
        `INSERT INTO brokers (name, display_name, market_type, protocol, logo_url, is_active,
         regulation, country, website, max_leverage, min_deposit, description, rating, spread_from, platforms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING id`,
        [
          broker.name, broker.display_name, broker.market_type, broker.protocol,
          broker.logo_url, broker.is_active, broker.regulation, broker.country,
          broker.website, broker.max_leverage, broker.min_deposit, broker.description,
          broker.rating, broker.spread_from, broker.platforms,
        ]
      );

      console.log(`  ✅ ${broker.display_name} — inserted (ID: ${result.rows[0].id})`);
      inserted++;
    }

    console.log(`\n📊 Summary: ${inserted} inserted, ${skipped} skipped (total ${brokers.length} brokers)`);
    console.log('🎉 Broker seed completed successfully!\n');
  } catch (err) {
    console.error('❌ Seed Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seedBrokers();
