/**
 * =============================================
 * NEXUSFX — Risk Calculator Service
 * คำนวณ Stop Loss, Take Profit, Trailing Stop
 * ตามประเภทกลยุทธ์และคู่เงิน
 * =============================================
 */

// =============================================
// PIP SIZE PER SYMBOL
// =============================================
function getPipSize(symbol) {
  const sym = (symbol || '').toUpperCase().replace('/', '');
  if (sym.includes('XAUUSD') || sym.includes('GOLD')) return 0.1;  // Gold: $0.1 per pip
  if (sym.includes('XAGUSD') || sym.includes('SILVER')) return 0.001;
  if (sym.includes('BTC')) return 1.0;     // Bitcoin: $1 per pip
  if (sym.includes('ETH')) return 0.1;    // Ethereum: $0.1 per pip
  if (sym.includes('JPY')) return 0.01;   // Yen pairs: 0.01 per pip
  return 0.0001;                           // Major FX: 0.0001 per pip (EURUSD, GBPUSD, etc.)
}

// =============================================
// STRATEGY RISK PROFILES
// =============================================
const STRATEGY_CONFIG = {
  Scalper: {
    sl_pips: 15,                   // SL ห่างจาก entry 15 pips
    tp_ratio: 1.5,                 // TP = 1.5x SL (Risk:Reward 1:1.5)
    trail_trigger_pips: 10,        // เริ่ม Trailing หลังกำไร 10 pips
    trail_distance_pips: 8,        // ระยะ SL ตาม trailing: 8 pips ห่างจาก peak
    breakeven_trigger_pips: 12,    // ย้าย SL ไป breakeven หลังกำไร 12 pips
    description: 'Scalping: SL แคบ, TP เล็ก, Trailing ไว',
  },
  Swing: {
    sl_pips: 50,
    tp_ratio: 2.5,                 // Risk:Reward 1:2.5
    trail_trigger_pips: 35,
    trail_distance_pips: 25,
    breakeven_trigger_pips: 40,
    description: 'Swing Trade: SL กว้าง, TP สูง, Trailing ตาม trend',
  },
  Grid: {
    sl_pips: 30,
    tp_ratio: 1.0,                 // Risk:Reward 1:1 (grid lock)
    trail_trigger_pips: 20,
    trail_distance_pips: 15,
    breakeven_trigger_pips: 25,
    description: 'Grid: SL ปานกลาง, TP เท่ากัน, Trailing ตาม grid',
  },
  Martingale: {
    sl_pips: 80,
    tp_ratio: 1.2,
    trail_trigger_pips: 55,
    trail_distance_pips: 40,
    breakeven_trigger_pips: 65,
    description: 'Martingale: SL กว้าง, TP ปาน, Trailing ระยะยาว',
  },
  Custom: {
    sl_pips: 25,
    tp_ratio: 2.0,
    trail_trigger_pips: 15,
    trail_distance_pips: 12,
    breakeven_trigger_pips: 18,
    description: 'Custom: ค่าเริ่มต้นทั่วไป',
  },
};

// =============================================
// MAIN CALCULATOR
// =============================================
class RiskCalculator {

  /**
   * คำนวณ SL, TP, Trailing params จาก strategy + entry price
   * @param {string} strategyType - Scalper | Swing | Grid | Martingale | Custom
   * @param {string} symbol - XAUUSD | EURUSD | BTCUSDT etc.
   * @param {string} side - BUY | SELL
   * @param {number} entryPrice - ราคาที่เข้า (0 = Market)
   * @param {object} customParams - override params from bot.parameters
   * @returns {object}
   */
  calculate(strategyType, symbol, side, entryPrice = 0, customParams = {}) {
    const config = STRATEGY_CONFIG[strategyType] || STRATEGY_CONFIG.Custom;
    const pip = getPipSize(symbol);

    // Allow custom override from bot parameters
    const sl_pips    = parseFloat(customParams.sl_pips)    || config.sl_pips;
    const tp_ratio   = parseFloat(customParams.tp_ratio)   || config.tp_ratio;
    const trail_trigger = parseFloat(customParams.trail_trigger_pips) || config.trail_trigger_pips;
    const trail_dist = parseFloat(customParams.trail_distance_pips)   || config.trail_distance_pips;
    const be_trigger = parseFloat(customParams.breakeven_trigger_pips) || config.breakeven_trigger_pips;

    const slDistance  = sl_pips * pip;
    const tpDistance  = sl_pips * tp_ratio * pip;

    let stop_loss = null;
    let take_profit = null;

    if (entryPrice && entryPrice > 0) {
      if (side === 'BUY') {
        stop_loss   = parseFloat((entryPrice - slDistance).toFixed(getDecimals(symbol)));
        take_profit = parseFloat((entryPrice + tpDistance).toFixed(getDecimals(symbol)));
      } else {
        stop_loss   = parseFloat((entryPrice + slDistance).toFixed(getDecimals(symbol)));
        take_profit = parseFloat((entryPrice - tpDistance).toFixed(getDecimals(symbol)));
      }
    }

    return {
      stop_loss,
      take_profit,
      sl_pips,
      tp_pips: parseFloat((sl_pips * tp_ratio).toFixed(1)),
      pip_size: pip,
      trailing_stop_enabled: true,
      trailing_distance_pips: trail_dist,
      trail_trigger_pips: trail_trigger,
      breakeven_trigger_pips: be_trigger,
      risk_reward: `1:${tp_ratio}`,
      strategy_info: config.description,
    };
  }

  /**
   * คำนวณ SL/TP ใหม่หลังจาก trailing condition triggered
   * @param {object} order - order record from DB
   * @param {number} currentPrice - ราคาปัจจุบัน
   * @returns {object} { new_sl, new_tp, action }
   */
  calculateTrailing(order, currentPrice) {
    const { side, current_sl, current_tp, trailing_distance_pips, trail_trigger_pips,
            breakeven_trigger_pips, entry_price, pip_size, breakeven_triggered,
            peak_price } = order;

    const pip = parseFloat(pip_size) || getPipSize(order.symbol);
    const trailDist = parseFloat(trailing_distance_pips) || 8;
    const trailTrigger = parseFloat(trail_trigger_pips) || 10;
    const beTrigger = parseFloat(breakeven_trigger_pips) || 12;
    const entry = parseFloat(entry_price);

    if (!currentPrice || !entry) return null;

    const isBuy = side === 'BUY';
    const currentProfit_pips = isBuy
      ? (currentPrice - entry) / pip
      : (entry - currentPrice) / pip;

    const newPeak = peak_price
      ? (isBuy ? Math.max(parseFloat(peak_price), currentPrice) : Math.min(parseFloat(peak_price), currentPrice))
      : currentPrice;

    let new_sl = parseFloat(current_sl);
    let new_tp = parseFloat(current_tp);
    let action = null;

    // 1. Move SL to BREAKEVEN once profit hits breakeven trigger
    if (!breakeven_triggered && currentProfit_pips >= beTrigger) {
      new_sl = isBuy
        ? Math.max(new_sl, entry + pip * 1)   // Entry + 1 pip (cover spread)
        : Math.min(new_sl, entry - pip * 1);
      action = 'BREAKEVEN';
    }

    // 2. TRAILING STOP — moves SL behind peak price
    if (currentProfit_pips >= trailTrigger) {
      const trailSL = isBuy
        ? newPeak - (trailDist * pip)   // BUY: SL ตามหลัง peak X pips
        : newPeak + (trailDist * pip);  // SELL: SL ตามหน้า peak X pips

      if (isBuy && trailSL > new_sl) {
        new_sl = parseFloat(trailSL.toFixed(getDecimals(order.symbol)));
        action = action === 'BREAKEVEN' ? 'BREAKEVEN+TRAIL' : 'TRAIL';
      } else if (!isBuy && trailSL < new_sl) {
        new_sl = parseFloat(trailSL.toFixed(getDecimals(order.symbol)));
        action = action === 'BREAKEVEN' ? 'BREAKEVEN+TRAIL' : 'TRAIL';
      }
    }

    // 3. TRAIL TP — ยกระดับ TP ให้สูงขึ้นตาม momentum (เลื่อน 50% ของระยะ trail)
    if (current_tp && currentProfit_pips >= trailTrigger * 1.5) {
      const tpBoost = trailDist * pip * 0.5;
      if (isBuy && new_tp) {
        const boostedTp = parseFloat(current_tp) + tpBoost;
        new_tp = parseFloat(boostedTp.toFixed(getDecimals(order.symbol)));
      } else if (!isBuy && new_tp) {
        const boostedTp = parseFloat(current_tp) - tpBoost;
        new_tp = parseFloat(boostedTp.toFixed(getDecimals(order.symbol)));
      }
    }

    return {
      new_sl: new_sl || null,
      new_tp: new_tp || null,
      new_peak: newPeak,
      action,
      profit_pips: parseFloat(currentProfit_pips.toFixed(1)),
      breakeven_triggered: breakeven_triggered || action?.includes('BREAKEVEN'),
    };
  }

  /**
   * Get pip size for a symbol
   */
  getPipSize(symbol) {
    return getPipSize(symbol);
  }
}

// =============================================
// HELPERS
// =============================================
function getDecimals(symbol) {
  const sym = (symbol || '').toUpperCase();
  if (sym.includes('BTC'))  return 2;
  if (sym.includes('ETH'))  return 3;
  if (sym.includes('XAU'))  return 2;
  if (sym.includes('JPY'))  return 3;
  return 5; // FX majors (5 decimal)
}

module.exports = new RiskCalculator();
module.exports.getPipSize = getPipSize;
module.exports.STRATEGY_CONFIG = STRATEGY_CONFIG;
