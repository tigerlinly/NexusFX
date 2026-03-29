/**
 * 🏦 NexusFX Broker Seed Script
 * Seed มาตรฐานโบรกเกอร์ Forex ระดับโลกที่ได้รับการกำกับดูแล
 * Usage: node scripts/seedBrokers.js
 */
const { pool, initDatabase } = require('../config/database');
require('dotenv').config();

const BROKERS = [
  {
    name: 'IC Markets',
    display_name: 'IC Markets',
    market_type: 'Forex, CFDs, Crypto',
    protocol: 'MT5',
    regulation: 'ASIC (Australia), CySEC (Cyprus), FSA (Seychelles)',
    country: 'Australia',
    website: 'https://www.icmarkets.com',
    max_leverage: '1:500',
    min_deposit: 200,
    spread_from: '0.0 pips',
    platforms: 'MT4, MT5, cTrader',
    rating: 4.7,
    description: 'โบรกเกอร์ ECN ชั้นนำจากออสเตรเลีย มี Spread ต่ำสุดในตลาด เหมาะสำหรับ Scalper และ EA Trader',
    logo_url: 'https://logo.clearbit.com/icmarkets.com',
  },
  {
    name: 'XM',
    display_name: 'XM Global',
    market_type: 'Forex, CFDs, Stocks',
    protocol: 'MT5',
    regulation: 'CySEC (Cyprus), ASIC (Australia), IFSC (Belize)',
    country: 'Cyprus',
    website: 'https://www.xm.com',
    max_leverage: '1:888',
    min_deposit: 5,
    spread_from: '0.6 pips',
    platforms: 'MT4, MT5',
    rating: 4.5,
    description: 'โบรกเกอร์ยอดนิยมที่สุดในเอเชีย มีโบนัสดี เปิดบัญชีขั้นต่ำแค่ $5 รองรับภาษาไทย',
    logo_url: 'https://logo.clearbit.com/xm.com',
  },
  {
    name: 'Exness',
    display_name: 'Exness',
    market_type: 'Forex, CFDs, Crypto',
    protocol: 'MT5',
    regulation: 'FCA (UK), CySEC (Cyprus), FSA (Seychelles)',
    country: 'Cyprus',
    website: 'https://www.exness.com',
    max_leverage: '1:Unlimited',
    min_deposit: 1,
    spread_from: '0.0 pips',
    platforms: 'MT4, MT5',
    rating: 4.6,
    description: 'โบรกเกอร์ที่มี Leverage สูงที่สุดในโลก (Unlimited) ถอนเงินเร็วมาก รองรับ Prompt Pay',
    logo_url: 'https://logo.clearbit.com/exness.com',
  },
  {
    name: 'Pepperstone',
    display_name: 'Pepperstone',
    market_type: 'Forex, CFDs, Indices',
    protocol: 'MT5',
    regulation: 'ASIC (Australia), FCA (UK), DFSA (Dubai), CySEC (Cyprus)',
    country: 'Australia',
    website: 'https://www.pepperstone.com',
    max_leverage: '1:500',
    min_deposit: 200,
    spread_from: '0.0 pips',
    platforms: 'MT4, MT5, cTrader, TradingView',
    rating: 4.8,
    description: 'โบรกเกอร์ระดับโลกจากออสเตรเลีย Execution เร็วมาก รองรับ TradingView โดยตรง',
    logo_url: 'https://logo.clearbit.com/pepperstone.com',
  },
  {
    name: 'FBS',
    display_name: 'FBS',
    market_type: 'Forex, CFDs, Metals',
    protocol: 'MT5',
    regulation: 'IFSC (Belize), CySEC (Cyprus), ASIC (Australia)',
    country: 'Belize',
    website: 'https://www.fbs.com',
    max_leverage: '1:3000',
    min_deposit: 1,
    spread_from: '0.5 pips',
    platforms: 'MT4, MT5',
    rating: 4.2,
    description: 'โบรกเกอร์ยอดนิยมในไทย มีโบนัสฝากเงิน 100% และ Leverage สูงถึง 1:3000',
    logo_url: 'https://logo.clearbit.com/fbs.com',
  },
  {
    name: 'FXGT',
    display_name: 'FXGT.com',
    market_type: 'Forex, Crypto, CFDs',
    protocol: 'MT5',
    regulation: 'FSA (Seychelles), VFSC (Vanuatu), CySEC (Cyprus)',
    country: 'Seychelles',
    website: 'https://www.fxgt.com',
    max_leverage: '1:1000',
    min_deposit: 5,
    spread_from: '0.0 pips',
    platforms: 'MT4, MT5',
    rating: 4.3,
    description: 'โบรกเกอร์ที่เน้น Crypto Trading มี Leverage สูง และโบนัสต้อนรับ สำหรับผู้เริ่มต้น',
    logo_url: 'https://logo.clearbit.com/fxgt.com',
  },
  {
    name: 'Tickmill',
    display_name: 'Tickmill',
    market_type: 'Forex, CFDs, Bonds',
    protocol: 'MT5',
    regulation: 'FCA (UK), CySEC (Cyprus), FSA (Seychelles)',
    country: 'United Kingdom',
    website: 'https://www.tickmill.com',
    max_leverage: '1:500',
    min_deposit: 100,
    spread_from: '0.0 pips',
    platforms: 'MT4, MT5',
    rating: 4.5,
    description: 'โบรกเกอร์ ECN ที่ได้รับรางวัล Best ECN Broker หลายปีซ้อน ค่าคอมมิชชั่นต่ำ',
    logo_url: 'https://logo.clearbit.com/tickmill.com',
  },
  {
    name: 'RoboForex',
    display_name: 'RoboForex',
    market_type: 'Forex, Stocks, CFDs',
    protocol: 'MT5',
    regulation: 'IFSC (Belize)',
    country: 'Belize',
    website: 'https://www.roboforex.com',
    max_leverage: '1:2000',
    min_deposit: 10,
    spread_from: '0.0 pips',
    platforms: 'MT4, MT5, cTrader, R StocksTrader',
    rating: 4.4,
    description: 'โบรกเกอร์ที่รองรับหลากหลายแพลตฟอร์ม มี CopyFX สำหรับ Copy Trade และ Leverage สูง',
    logo_url: 'https://logo.clearbit.com/roboforex.com',
  },
  {
    name: 'Vantage',
    display_name: 'Vantage Markets',
    market_type: 'Forex, CFDs, Crypto',
    protocol: 'MT5',
    regulation: 'ASIC (Australia), VFSC (Vanuatu), CIMA (Cayman)',
    country: 'Australia',
    website: 'https://www.vantagemarkets.com',
    max_leverage: '1:500',
    min_deposit: 50,
    spread_from: '0.0 pips',
    platforms: 'MT4, MT5, ProTrader',
    rating: 4.4,
    description: 'โบรกเกอร์ ECN จากออสเตรเลีย มีบัญชี RAW ECN Spread ต่ำ เหมาะกับ Day Trader',
    logo_url: 'https://logo.clearbit.com/vantagemarkets.com',
  },
  {
    name: 'OctaFX',
    display_name: 'OctaFX',
    market_type: 'Forex, CFDs, Crypto',
    protocol: 'MT5',
    regulation: 'CySEC (Cyprus), SVGFSA (SVG)',
    country: 'Cyprus',
    website: 'https://www.octafx.com',
    max_leverage: '1:500',
    min_deposit: 25,
    spread_from: '0.6 pips',
    platforms: 'MT4, MT5, OctaTrader',
    rating: 4.3,
    description: 'โบรกเกอร์ยอดนิยมในเอเชียตะวันออกเฉียงใต้ มี Copy Trading ในตัว ฝากถอนง่าย',
    logo_url: 'https://logo.clearbit.com/octafx.com',
  },
  {
    name: 'HFM',
    display_name: 'HFM (HotForex)',
    market_type: 'Forex, CFDs, Stocks, Bonds',
    protocol: 'MT5',
    regulation: 'FCA (UK), FSCA (South Africa), CySEC (Cyprus), FSA (Seychelles)',
    country: 'Cyprus',
    website: 'https://www.hfm.com',
    max_leverage: '1:1000',
    min_deposit: 5,
    spread_from: '0.0 pips',
    platforms: 'MT4, MT5, HFM App',
    rating: 4.5,
    description: 'โบรกเกอร์ที่ได้รับรางวัลมากที่สุดในโลก กำกับดูแลโดย 4 หน่วยงาน มีสินทรัพย์ให้เทรดมากกว่า 1,000 ตัว',
    logo_url: 'https://logo.clearbit.com/hfm.com',
  },
  {
    name: 'FXTM',
    display_name: 'FXTM (ForexTime)',
    market_type: 'Forex, CFDs, Metals',
    protocol: 'MT5',
    regulation: 'FCA (UK), CySEC (Cyprus), FSCA (South Africa)',
    country: 'Cyprus',
    website: 'https://www.forextime.com',
    max_leverage: '1:2000',
    min_deposit: 10,
    spread_from: '0.1 pips',
    platforms: 'MT4, MT5',
    rating: 4.4,
    description: 'โบรกเกอร์ที่เป็นที่นิยมในแอฟริกาและเอเชีย มี ECN Account และ Copy Trading',
    logo_url: 'https://logo.clearbit.com/forextime.com',
  },
];

async function seedBrokers() {
  try {
    console.log('🏦 Starting Broker Seed...\n');
    await initDatabase();

    for (const b of BROKERS) {
      const exists = await pool.query('SELECT id FROM brokers WHERE name = $1', [b.name]);
      if (exists.rows.length === 0) {
        await pool.query(
          `INSERT INTO brokers (name, display_name, market_type, protocol, regulation, country, website, max_leverage, min_deposit, spread_from, platforms, rating, description, logo_url, is_active)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true)`,
          [b.name, b.display_name, b.market_type, b.protocol, b.regulation, b.country, b.website, b.max_leverage, b.min_deposit, b.spread_from, b.platforms, b.rating, b.description, b.logo_url]
        );
        console.log(`   ✅ ${b.display_name} (${b.regulation})`);
      } else {
        console.log(`   ⚠️ ${b.display_name} already exists`);
      }
    }

    console.log(`\n🎉 Broker seed complete! ${BROKERS.length} brokers added.`);
  } catch (err) {
    console.error('❌ Broker seed error:', err);
  } finally {
    await pool.end();
  }
}

seedBrokers();
