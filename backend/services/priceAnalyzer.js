const { pool } = require('../config/database');

/**
 * =============================================
 * NEXUSFX — Price Analyzer
 * ดึงข้อมูล OHLCV Candles + คำนวณ Indicators จริง
 * Sources: Local PostgreSQL (market_candles) fallback to External APIs
 * =============================================
 */

// =============================================
// SYMBOL MAPPING
// =============================================
const BINANCE_SYMBOLS = {
  'XAUUSD':  'XAUUSDT',
  'XAUUSDT': 'XAUUSDT',
  'BTCUSDT': 'BTCUSDT',
  'ETHUSDT': 'ETHUSDT',
  'BTCUSD':  'BTCUSDT',
  'ETHUSD':  'ETHUSDT',
};

const YAHOO_SYMBOLS = {
  'EURUSD': 'EURUSD=X',
  'GBPUSD': 'GBPUSD=X',
  'USDJPY': 'USDJPY=X',
  'AUDUSD': 'AUDUSD=X',
  'USDCHF': 'USDCHF=X',
  'USDCAD': 'USDCAD=X',
};

// =============================================
// FETCH CANDLES (Unified)
// =============================================
async function fetchCandles(symbol, interval = '5m', limit = 100) {
  const sym = symbol.toUpperCase().replace('/', '');
  const dbInterval = mapToDbInterval(interval);

  try {
    // 1. Try to fetch from Local DB (Master Feed) first
    const res = await pool.query(
      `SELECT open_time as time, open, high, low, close, volume 
       FROM market_candles 
       WHERE symbol = $1 AND interval = $2 
       ORDER BY open_time DESC 
       LIMIT $3`,
      [sym, dbInterval, limit]
    );

    if (res.rows.length >= Math.min(limit, 10)) { // If we have decent amount of local data, use it
      // Sort ascending (oldest first) for indicator math
      return res.rows.sort((a, b) => Number(a.time) - Number(b.time)).map(row => ({
        time: Number(row.time),
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        volume: Number(row.volume)
      }));
    }
  } catch (dbErr) {
    console.error('Local DB fetch failed, falling back to APIs', dbErr);
  }

  // 2. Fallback to External APIs if Local DB lacks data
  console.log(`Falling back to External API for ${sym} ${interval}`);
  if (BINANCE_SYMBOLS[sym]) {
    return fetchFromBinance(BINANCE_SYMBOLS[sym], interval, limit);
  }
  if (YAHOO_SYMBOLS[sym]) {
    return fetchFromYahoo(YAHOO_SYMBOLS[sym], interval, limit);
  }

  throw new Error(`Unsupported symbol: ${symbol}`);
}

function mapToDbInterval(interval) {
  const map = {
    'M1': '1m', 'M5': '5m', 'M15': '15m', 'M30': '30m',
    'H1': '1h', 'H4': '4h', 'D1': '1d'
  };
  return map[interval.toUpperCase()] || interval.toLowerCase();
}

function mapToBinanceInterval(interval) {
  const map = {
    'M1': '1m', 'M2': '1m', 'M3': '3m', 'M4': '3m', 'M5': '5m', 'M6': '5m', 
    'M10': '5m', 'M12': '5m', 'M15': '15m', 'M20': '15m', 'M30': '30m',
    'H1': '1h', 'H2': '2h', 'H3': '2h', 'H4': '4h', 'H6': '6h', 'H8': '8h', 'H12': '12h',
    'D1': '1d', 'W1': '1w', 'WN': '1M'
  };
  return map[interval.toUpperCase()] || interval;
}

function mapToYahooInterval(interval) {
  const map = {
    'M1': '1m', 'M2': '2m', 'M3': '2m', 'M4': '2m', 'M5': '5m', 'M6': '5m', 
    'M10': '5m', 'M12': '5m', 'M15': '15m', 'M20': '15m', 'M30': '30m',
    'H1': '60m', 'H2': '60m', 'H3': '60m', 'H4': '60m', 'H6': '60m', 'H8': '60m', 'H12': '60m',
    'D1': '1d', 'W1': '1wk', 'WN': '1mo',
    '1m': '1m', '5m': '5m', '15m': '15m', '1h': '60m', '4h': '1h', '1d': '1d'
  };
  return map[interval.toUpperCase()] || map[interval] || '5m';
}

async function fetchFromBinance(symbol, interval, limit) {
  const binanceInt = mapToBinanceInterval(interval);
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${binanceInt}&limit=${limit}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!resp.ok) throw new Error(`Binance API error: ${resp.status}`);
  const data = await resp.json();

  return data.map(k => ({
    time:   parseInt(k[0]),
    open:   parseFloat(k[1]),
    high:   parseFloat(k[2]),
    low:    parseFloat(k[3]),
    close:  parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

async function fetchFromYahoo(symbol, interval, limit) {
  // Map to Yahoo intervals
  const yahooInterval = mapToYahooInterval(interval);
  const range = limit <= 100 ? '1d' : limit <= 500 ? '5d' : '1mo';

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${yahooInterval}&range=${range}`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(8000),
  });
  if (!resp.ok) throw new Error(`Yahoo Finance error: ${resp.status}`);
  const json = await resp.json();

  const chart = json.chart?.result?.[0];
  if (!chart) throw new Error('No Yahoo Finance data returned');

  const timestamps = chart.timestamp || [];
  const ohlcv = chart.indicators?.quote?.[0] || {};

  const candles = timestamps.map((t, i) => ({
    time:   t * 1000,
    open:   ohlcv.open?.[i]   ?? null,
    high:   ohlcv.high?.[i]   ?? null,
    low:    ohlcv.low?.[i]    ?? null,
    close:  ohlcv.close?.[i]  ?? null,
    volume: ohlcv.volume?.[i] ?? 0,
  })).filter(c => c.close !== null && c.close > 0);

  return candles.slice(-limit);
}

// =============================================
// INDICATORS
// =============================================

/**
 * RSI — Relative Strength Index (Wilder's method)
 */
function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;

  // Initial average gain/loss (simple average)
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  // Wilder's smoothing
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(2));
}

/**
 * EMA — สุดท้ายค่าเดียว
 */
function calcEMA(closes, period) {
  if (closes.length < period) return null;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b) / period;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return parseFloat(ema.toFixed(6));
}

/**
 * EMA Series — ส่งกลับ Array สำหรับ cross detection
 */
function calcEMASeries(closes, period) {
  if (closes.length < period) return [];
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b) / period;
  const result = [ema];
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

/**
 * MACD — (12,26,9)
 */
function calcMACD(closes) {
  if (closes.length < 35) return null; // Need at least 26+9

  const k12 = 2 / 13, k26 = 2 / 27, k9 = 2 / 10;

  // Build EMA12 and EMA26 at every point from i=26 onward
  let ema12 = closes.slice(0, 12).reduce((a, b) => a + b) / 12;
  let ema26 = closes.slice(0, 26).reduce((a, b) => a + b) / 26;

  // Advance ema12 to position 25
  for (let i = 12; i < 26; i++) ema12 = closes[i] * k12 + ema12 * (1 - k12);

  const macdHistory = [];
  for (let i = 26; i < closes.length; i++) {
    ema12 = closes[i] * k12 + ema12 * (1 - k12);
    ema26 = closes[i] * k26 + ema26 * (1 - k26);
    macdHistory.push(ema12 - ema26);
  }

  if (macdHistory.length < 9) return null;

  // Signal line = EMA9 of macdHistory
  let sigLine = macdHistory.slice(0, 9).reduce((a, b) => a + b) / 9;
  const sigHistory = [sigLine];
  for (let i = 9; i < macdHistory.length; i++) {
    sigLine = macdHistory[i] * k9 + sigLine * (1 - k9);
    sigHistory.push(sigLine);
  }

  const macd     = macdHistory[macdHistory.length - 1];
  const signal   = sigHistory[sigHistory.length - 1];
  const prevMacd = macdHistory[macdHistory.length - 2];
  const prevSig  = sigHistory[sigHistory.length - 2];

  return {
    macd:       parseFloat(macd.toFixed(6)),
    signal:     parseFloat(signal.toFixed(6)),
    histogram:  parseFloat((macd - signal).toFixed(6)),
    crossedUp:   prevMacd < prevSig && macd > signal,
    crossedDown: prevMacd > prevSig && macd < signal,
  };
}

/**
 * Bollinger Bands — SMA(20) ± 2 StdDev
 */
function calcBollingerBands(closes, period = 20, mult = 2) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const sma = slice.reduce((a, b) => a + b) / period;
  const variance = slice.reduce((s, v) => s + Math.pow(v - sma, 2), 0) / period;
  const std = Math.sqrt(variance);

  const upper  = parseFloat((sma + mult * std).toFixed(6));
  const lower  = parseFloat((sma - mult * std).toFixed(6));
  const middle = parseFloat(sma.toFixed(6));
  const price  = closes[closes.length - 1];

  return {
    upper, middle, lower,
    bandwidth:  parseFloat(((upper - lower) / middle * 100).toFixed(2)), // band width %
    percentB:   parseFloat(((price - lower) / (upper - lower)).toFixed(4)), // 0=lower, 1=upper
    price,
  };
}

/**
 * SMA — Simple Moving Average
 */
function calcSMA(closes, period) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return parseFloat((slice.reduce((a, b) => a + b) / period).toFixed(6));
}

// =============================================
// CANDLESTICK PATTERNS
// =============================================

/**
 * Engulfing Pattern
 * Returns: 'bullish' | 'bearish' | null
 */
function detectEngulfing(candles) {
  if (candles.length < 2) return null;
  const prev = candles[candles.length - 2];
  const curr = candles[candles.length - 1];

  const prevBearish = prev.close < prev.open;
  const prevBullish = prev.close > prev.open;

  // Bullish Engulfing: prev bearish, curr opens below prev close, closes above prev open
  if (
    prevBearish &&
    curr.open  <= prev.close &&
    curr.close >= prev.open  &&
    curr.close > curr.open
  ) return 'bullish';

  // Bearish Engulfing: prev bullish, curr opens above prev close, closes below prev open
  if (
    prevBullish &&
    curr.open  >= prev.close &&
    curr.close <= prev.open  &&
    curr.close < curr.open
  ) return 'bearish';

  return null;
}

/**
 * Pin Bar (Hammer / Shooting Star)
 * Returns: 'hammer' | 'shooting_star' | null
 */
function detectPinBar(candle) {
  const range = candle.high - candle.low;
  if (range === 0) return null;

  const body       = Math.abs(candle.close - candle.open);
  const upperWick  = candle.high - Math.max(candle.open, candle.close);
  const lowerWick  = Math.min(candle.open, candle.close) - candle.low;

  // Pin bar: body < 33% of range, one wick > 60% of range
  if (body / range < 0.33) {
    if (lowerWick / range >= 0.6) return 'hammer';           // Bullish (BUY)
    if (upperWick / range >= 0.6) return 'shooting_star';    // Bearish (SELL)
  }

  return null;
}

/**
 * Doji — body < 5% of range
 */
function detectDoji(candle) {
  const range = candle.high - candle.low;
  if (range === 0) return false;
  return Math.abs(candle.close - candle.open) / range < 0.05;
}

// =============================================
// FULL ANALYSIS (All Indicators at Once)
// =============================================
async function analyze(symbol, interval = '5m', limit = 100) {
  const candles = await fetchCandles(symbol, interval, limit);
  if (candles.length < 35) throw new Error(`Not enough candles (${candles.length}) for ${symbol}`);

  const closes = candles.map(c => c.close);

  const rsi  = calcRSI(closes);
  const macd = calcMACD(closes);
  const bb   = calcBollingerBands(closes);
  const sma200_available = closes.length >= 200;
  const ema9  = calcEMA(closes, 9);
  const ema21 = calcEMA(closes, 21);
  const ema50 = calcEMA(closes, 50);
  const ema200 = sma200_available ? calcEMA(closes, 200) : null;

  // EMA cross detection (last 2 values)
  const ema9Series  = calcEMASeries(closes, 9);
  const ema21Series = calcEMASeries(closes, 21);
  const ema9Prev  = ema9Series[ema9Series.length - 2]   ?? null;
  const ema21Prev = ema21Series[ema21Series.length - 2] ?? null;

  const emaCrossUp   = ema9Prev !== null && ema9Prev < ema21Prev && ema9 > ema21;
  const emaCrossDown = ema9Prev !== null && ema9Prev > ema21Prev && ema9 < ema21;

  const currentPrice = closes[closes.length - 1];

  const engulfing = detectEngulfing(candles);
  const pinBar    = detectPinBar(candles[candles.length - 1]);
  const doji      = detectDoji(candles[candles.length - 1]);

  return {
    symbol,
    interval,
    candles_count: candles.length,
    current_price: currentPrice,
    last_candle:   candles[candles.length - 1],
    indicators: {
      rsi, macd, bb,
      ema9, ema21, ema50, ema200,
      ema_cross_up: emaCrossUp, ema_cross_down: emaCrossDown,
      trend_up:   ema200 ? currentPrice > ema200 : ema9 > ema21,
      trend_down: ema200 ? currentPrice < ema200 : ema9 < ema21,
    },
    patterns: { engulfing, pin_bar: pinBar, doji },
  };
}

module.exports = {
  fetchCandles,
  analyze,
  calcRSI, calcEMA, calcEMASeries, calcMACD,
  calcBollingerBands, calcSMA,
  detectEngulfing, detectPinBar, detectDoji,
};
