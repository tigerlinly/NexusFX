/**
 * =============================================
 * NEXUSFX — Signal Engine
 * วิเคราะห์ Price Action จริง และออก BUY/SELL Signal
 * ตามกลยุทธ์ของแต่ละ Bot
 * =============================================
 *
 * กลยุทธ์ที่รองรับ:
 *   Scalper   → RSI Reversal + Engulfing/Pin Bar (M5)
 *   Swing     → MACD Cross + EMA200 Trend Filter (H1)
 *   Grid      → Bollinger Bands Touch + RSI (M15)
 *   Martingale→ EMA9/21 Cross + Momentum (M5)
 *   Custom    → RSI + EMA Cross (M5)
 */

const { analyze } = require('./priceAnalyzer');
const { pool }    = require('../config/database');

// =============================================
// SYMBOL SETS PER STRATEGY
// =============================================
const STRATEGY_SYMBOLS = {
  Scalper:    ['XAUUSD', 'EURUSD', 'GBPUSD'],
  Swing:      ['XAUUSD', 'EURUSD', 'GBPUSD'],
  Grid:       ['XAUUSD', 'EURUSD'],
  Martingale: ['BTCUSDT', 'ETHUSDT', 'XAUUSD'],
  Custom:     ['XAUUSD', 'EURUSD', 'BTCUSDT'],
};

// Interval per strategy
const STRATEGY_INTERVAL = {
  Scalper:    '5m',
  Swing:      '1h',
  Grid:       '15m',
  Martingale: '5m',
  Custom:     '5m',
};

// =============================================
// SIGNAL GENERATORS PER STRATEGY
// =============================================

/**
 * SCALPER — RSI Reversal + Price Action Pattern (M5)
 *
 * BUY:  RSI < 35 (oversold) + (Bullish Engulfing OR Hammer Pin Bar)
 * SELL: RSI > 65 (overbought) + (Bearish Engulfing OR Shooting Star)
 */
async function analyzeScalper(symbol) {
  const data = await analyze(symbol, '5m', 80);
  const { rsi, engulfing, pin_bar } = { ...data.indicators, ...data.patterns };

  if (rsi === null) return null;

  const bullishPattern = engulfing === 'bullish' || pin_bar === 'hammer';
  const bearishPattern = engulfing === 'bearish' || pin_bar === 'shooting_star';

  // BUY Signal
  if (rsi < 35 && bullishPattern) {
    const confidence = calcConfidence([
      rsi < 30 ? 40 : 20,                    // RSI strength
      engulfing === 'bullish' ? 35 : 0,       // Engulfing
      pin_bar === 'hammer' ? 25 : 0,          // Pin Bar
    ]);
    return {
      symbol,
      side: 'BUY',
      confidence,
      reason: `RSI oversold (${rsi}) + ${engulfing === 'bullish' ? 'Bullish Engulfing' : 'Hammer Pin Bar'}`,
      indicators: { rsi },
    };
  }

  // SELL Signal
  if (rsi > 65 && bearishPattern) {
    const confidence = calcConfidence([
      rsi > 70 ? 40 : 20,
      engulfing === 'bearish' ? 35 : 0,
      pin_bar === 'shooting_star' ? 25 : 0,
    ]);
    return {
      symbol,
      side: 'SELL',
      confidence,
      reason: `RSI overbought (${rsi}) + ${engulfing === 'bearish' ? 'Bearish Engulfing' : 'Shooting Star'}`,
      indicators: { rsi },
    };
  }

  return null;
}

/**
 * SWING — MACD Cross + EMA200 Trend Filter (H1)
 *
 * BUY:  Price > EMA200 (uptrend) + MACD Line crossed above Signal
 * SELL: Price < EMA200 (downtrend) + MACD Line crossed below Signal
 * Extra: RSI between 40–60 (not exhausted)
 */
async function analyzeSwing(symbol) {
  const data = await analyze(symbol, '1h', 220); // 220 bars for EMA200
  const { macd, ema200, rsi, trend_up, trend_down } = data.indicators;
  const price = data.current_price;

  if (!macd || !price) return null;

  // BUY Signal
  if (
    trend_up &&
    macd.crossedUp &&
    rsi > 40 && rsi < 65 // momentum zone, not overbought
  ) {
    const confidence = calcConfidence([
      40,                              // MACD cross
      ema200 ? 35 : 20,               // EMA200 trend confirms
      rsi > 45 && rsi < 55 ? 25 : 10, // RSI in neutral zone
    ]);
    return {
      symbol,
      side: 'BUY',
      confidence,
      reason: `MACD crossed UP + Uptrend (Price > EMA${ema200 ? '200' : '21'}) + RSI ${rsi}`,
      indicators: { macd: macd.macd, signal: macd.signal, rsi, ema200 },
    };
  }

  // SELL Signal
  if (
    trend_down &&
    macd.crossedDown &&
    rsi > 35 && rsi < 60
  ) {
    const confidence = calcConfidence([
      40,
      ema200 ? 35 : 20,
      rsi > 45 && rsi < 55 ? 25 : 10,
    ]);
    return {
      symbol,
      side: 'SELL',
      confidence,
      reason: `MACD crossed DOWN + Downtrend (Price < EMA${ema200 ? '200' : '21'}) + RSI ${rsi}`,
      indicators: { macd: macd.macd, signal: macd.signal, rsi, ema200 },
    };
  }

  return null;
}

/**
 * GRID — Bollinger Bands Touch + RSI Confirmation (M15)
 *
 * BUY:  Price ≤ Lower Band (percentB < 0.05) + RSI < 40
 * SELL: Price ≥ Upper Band (percentB > 0.95) + RSI > 60
 */
async function analyzeGrid(symbol) {
  const data = await analyze(symbol, '15m', 60);
  const { bb, rsi } = data.indicators;

  if (!bb || rsi === null) return null;

  // BUY: Price at or below lower band, RSI confirms oversold
  if (bb.percentB < 0.05 && rsi < 40) {
    const confidence = calcConfidence([
      bb.percentB < 0.02 ? 45 : 30,  // How far below lower band
      rsi < 30 ? 35 : 20,             // RSI strength
      25,                              // Always add grid score
    ]);
    return {
      symbol,
      side: 'BUY',
      confidence,
      reason: `BB Lower Band touch (B%: ${(bb.percentB * 100).toFixed(1)}%) + RSI ${rsi} oversold`,
      indicators: { rsi, bb_percentB: bb.percentB, bb_lower: bb.lower, price: bb.price },
    };
  }

  // SELL: Price at or above upper band, RSI confirms overbought
  if (bb.percentB > 0.95 && rsi > 60) {
    const confidence = calcConfidence([
      bb.percentB > 0.98 ? 45 : 30,
      rsi > 70 ? 35 : 20,
      25,
    ]);
    return {
      symbol,
      side: 'SELL',
      confidence,
      reason: `BB Upper Band touch (B%: ${(bb.percentB * 100).toFixed(1)}%) + RSI ${rsi} overbought`,
      indicators: { rsi, bb_percentB: bb.percentB, bb_upper: bb.upper, price: bb.price },
    };
  }

  return null;
}

/**
 * MARTINGALE — EMA9/EMA21 Cross + Momentum (M5)
 *
 * BUY:  EMA9 just crossed ABOVE EMA21 + MACD histogram positive
 * SELL: EMA9 just crossed BELOW EMA21 + MACD histogram negative
 *
 * ⚠️ Martingale doubles lot on loss — risky but high reward
 */
async function analyzeMartingale(symbol) {
  const data = await analyze(symbol, '5m', 80);
  const { ema9, ema21, ema_cross_up, ema_cross_down, macd, rsi } = data.indicators;

  if (ema9 === null || ema21 === null || !macd) return null;

  // BUY: EMA cross up + MACD confirms
  if (ema_cross_up && macd.histogram > 0) {
    const confidence = calcConfidence([
      50,                        // EMA cross (primary)
      macd.histogram > 0 ? 30 : 10,
      rsi && rsi < 60 ? 20 : 5, // Not overbought
    ]);
    return {
      symbol,
      side: 'BUY',
      confidence,
      reason: `EMA9 crossed above EMA21 + MACD positive (${macd.histogram.toFixed(4)})`,
      indicators: { ema9, ema21, macd: macd.macd, histogram: macd.histogram, rsi },
    };
  }

  // SELL: EMA cross down + MACD confirms
  if (ema_cross_down && macd.histogram < 0) {
    const confidence = calcConfidence([
      50,
      macd.histogram < 0 ? 30 : 10,
      rsi && rsi > 40 ? 20 : 5,
    ]);
    return {
      symbol,
      side: 'SELL',
      confidence,
      reason: `EMA9 crossed below EMA21 + MACD negative (${macd.histogram.toFixed(4)})`,
      indicators: { ema9, ema21, macd: macd.macd, histogram: macd.histogram, rsi },
    };
  }

  return null;
}

/**
 * CUSTOM — RSI + EMA Cross Combo (M5)
 *
 * BUY:  RSI < 45 (not overbought) + EMA9 > EMA21 (bullish)
 * SELL: RSI > 55 (not oversold) + EMA9 < EMA21 (bearish)
 */
async function analyzeCustom(symbol) {
  const data = await analyze(symbol, '5m', 60);
  const { rsi, ema9, ema21, trend_up, trend_down, macd } = data.indicators;
  const { engulfing } = data.patterns;

  if (rsi === null || ema9 === null) return null;

  const macdBullish = macd ? macd.histogram > 0 : false;
  const macdBearish = macd ? macd.histogram < 0 : false;

  // BUY
  if (rsi < 45 && trend_up && macdBullish) {
    const confidence = calcConfidence([
      engulfing === 'bullish' ? 40 : 20,
      rsi < 35 ? 35 : 20,
      macdBullish ? 25 : 0,
    ]);
    return {
      symbol,
      side: 'BUY',
      confidence,
      reason: `EMA Bullish + RSI ${rsi} + MACD positive${engulfing === 'bullish' ? ' + Engulfing' : ''}`,
      indicators: { rsi, ema9, ema21 },
    };
  }

  // SELL
  if (rsi > 55 && trend_down && macdBearish) {
    const confidence = calcConfidence([
      engulfing === 'bearish' ? 40 : 20,
      rsi > 65 ? 35 : 20,
      macdBearish ? 25 : 0,
    ]);
    return {
      symbol,
      side: 'SELL',
      confidence,
      reason: `EMA Bearish + RSI ${rsi} + MACD negative${engulfing === 'bearish' ? ' + Engulfing' : ''}`,
      indicators: { rsi, ema9, ema21 },
    };
  }

  return null;
}

// =============================================
// MAIN: Generate Signal for a Bot
// =============================================
async function generateSignal(bot) {
  const strategyType = bot.strategy_type || 'Custom';

  // Use bot's configured symbols or default set
  const botSymbols = bot.parameters?.symbols
    ? (Array.isArray(bot.parameters.symbols) ? bot.parameters.symbols : [bot.parameters.symbols])
    : STRATEGY_SYMBOLS[strategyType] || STRATEGY_SYMBOLS.Custom;

  // Analyzer function per strategy
  const analyzerFn = {
    Scalper:    analyzeScalper,
    Swing:      analyzeSwing,
    Grid:       analyzeGrid,
    Martingale: analyzeMartingale,
    Custom:     analyzeCustom,
  }[strategyType] || analyzeCustom;

  // Check if there's already an open position for any of these symbols (avoid overtrading)
  const existingRes = await pool.query(
    `SELECT symbol FROM orders WHERE account_id = $1 AND status = 'FILLED' AND bot_id = $2`,
    [bot.account_id, bot.id]
  );
  const openSymbols = new Set(existingRes.rows.map(r => r.symbol.toUpperCase()));

  const signals = [];

  // Scan each symbol
  for (const symbol of botSymbols) {
    if (openSymbols.has(symbol.toUpperCase())) {
      console.log(`[SignalEngine] Skip ${symbol} — already has open position`);
      continue;
    }

    try {
      const signal = await analyzerFn(symbol);
      if (signal) {
        signals.push({ ...signal, strategy: strategyType });
        console.log(`✅ [SignalEngine] ${strategyType} | ${symbol} → ${signal.side} | Confidence: ${signal.confidence}% | ${signal.reason}`);
      } else {
        console.log(`⏳ [SignalEngine] ${strategyType} | ${symbol} → No signal`);
      }
    } catch (err) {
      console.warn(`⚠️ [SignalEngine] ${symbol} analysis error: ${err.message}`);
    }
  }

  if (signals.length === 0) return null;

  // Return highest confidence signal
  signals.sort((a, b) => b.confidence - a.confidence);
  return signals[0];
}

// =============================================
// HELPER
// =============================================
function calcConfidence(scores) {
  const total = scores.reduce((a, b) => a + b, 0);
  return Math.min(100, Math.max(0, total));
}

module.exports = { generateSignal, STRATEGY_SYMBOLS, STRATEGY_INTERVAL };
