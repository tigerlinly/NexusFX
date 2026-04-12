//+------------------------------------------------------------------+
//|                                       NexusFX_PriceActionBot.mq5 |
//|                                    Copyright 2026, NexusFX Corp. |
//|                   Price Action + RSI + Market Structure Strategy  |
//|    Based on: Gold Market Analysis (W/M Pattern, Swing 1-5, DZ)   |
//+------------------------------------------------------------------+
#property copyright "NexusFX"
#property link      "https://nexusfx.biz"
#property version   "1.00" // Gold PA Strategy Edition

#include <Trade\Trade.mqh>
#include "NexusFX_Dashboard.mqh"
CTrade trade;

// ============================================================
// INPUT PARAMETERS
// ============================================================
input string   RunMagic = "PABot";              // PABot for Bot, PA for App Auto
input ulong    MagicNumber = 801;

// --- Timeframe Settings ---
input ENUM_TIMEFRAMES EntryTF  = PERIOD_M5;     // TF หาจุดเข้าเทรด (M1/M5)
input ENUM_TIMEFRAMES TrendTF  = PERIOD_H1;     // TF ดูเทรนด์หลัก
input int      Trend_MA_Period = 50;            // MA Period สำหรับดูเทรนด์

// --- W/M Pattern Detection ---
input int      SwingLookback    = 20000;        // จำนวนแท่งเทียนย้อนหลังสำหรับหา Swing High/Low (ปรับมองย้อนหลัง ~3 เดือน)
input int      SwingStrength    = 3;            // ความแข็งแกร่งของจุด Swing (แท่งซ้าย/ขวา)
input double   PatternTolerancePct = 0.3;       // % ความคลาดเคลื่อนที่ยอมรับสำหรับ W/M CF (0.3%)

// --- RSI Settings ---
input int      RSI_Period       = 14;           // RSI Period
input double   RSI_OVB          = 70.0;         // RSI Overbought Level
input double   RSI_OVS          = 30.0;         // RSI Oversold Level
input bool     UseRSIDivergence = true;         // ใช้ RSI Divergence เป็นสัญญาณยืนยัน
input int      DivLookback      = 10;           // จำนวนแท่งย้อนหลังสำหรับหา Divergence

// --- Demand Zone / Supply Zone ---
input int      DZ_Lookback      = 20000;        // จำนวนแท่งย้อนหลังหา Zone (ปรับมองย้อนหลัง ~3 เดือน)
input double   DZ_TouchTolerance = 5.0;         // Pips ที่ยอมรับว่า "ชนแนว"

// --- Fibonacci 61.8 ---
input bool     UseFiboConfluence = true;        // ใช้ Fibo 61.8 เป็น Confluence
input double   FiboLevel         = 0.618;       // ระดับ Fibo (61.8%)
input double   FiboTolerance     = 5.0;         // Pips ที่ยอมรับว่าอยู่ในโซน Fibo

// --- Pyramiding (การซอยไม้/เติมไม้) ---
input int      MaxPositions       = 5;          // ไม้เต็มที่ (ทุนน้อย 3-5 ไม้)
input double   ScaleStepPips      = 15.0;       // ระยะห่างระหว่างไม้
input double   ScaleLotMultiplier = 0.5;        // ยิ่งสับยิ่งเล็กลง

// --- Risk Management & Target ---
input double   RiskPercent          = 1.0;      // คำนวณ Lot จากทุน
input double   DailyProfitTargetPct = 0.0;      // หยุดเมื่อกำไรชนเป้า/วัน
input double   DailyDrawdownPct     = 5.0;      // ตัดขาดทุนถ้าลบเกินเป้า/วัน
input int      MaxSpreadPoints      = 30;       // 30 points = 3 pips
input double   InitialTPPips        = 300.0;    // TP ตั้งก่อนถึงแนวต้าน/แนวรับ
input double   SL_BufferPips        = 5.0;      // ระยะเผื่อ SL หลังโครงสร้าง W/M

// --- TP Strategy: ปิดก่อนถึงแนวต้าน/แนวรับ ---
input double   TP_BeforeSR_Pips     = 10.0;     // ตั้ง TP ก่อนถึง S/R กี่ pips
input bool     UseRSI_TP            = true;     // ใช้ RSI OVB/OVS เป็นจุดปิดกำไร

// --- Session Filter ---
input bool     UseSessionFilter = false;
input int      SessionStartHour = 14;
input int      SessionEndHour   = 22;

// --- Breakeven & Trailing SL ---
input double   BreakevenPips  = 20.0;          // ราคาวิ่งกำไรเท่านี้แล้วย้าย SL มาจุดเปิด
input double   LockProfitPips = 5.0;           // ล็อคกำไรไว้เท่านี้เมื่อถึง Breakeven
input int      TrailingBars   = 3;             // จำนวนแท่งย้อนหลัง สำหรับ Swing Trail
input double   TrailMinGap    = 10.0;          // SL ต้องห่างจากราคาอย่างน้อยกี่ Pips

// --- Trailing TP (เลื่อน TP เมื่อราคาไหลลื่น) ---
input bool     UseTrailingTP      = true;      // เปิดระบบเลื่อน TP ตามกำไร
input double   TP_TrailStepPips   = 30.0;      // ทุกครั้งที่ราคาวิ่งกำไรเพิ่ม 30 pip → ขยับ TP
input double   TP_ExtendPips      = 20.0;      // ขยับ TP ไปข้างหน้าอีก 20 pip
input double   SL_StepUpPips      = 15.0;      // พร้อมกัน ขยับ SL ขึ้นตาม 15 pip
input bool     UsePartialClose    = true;      // ปิดบางส่วนที่เป้าแรก
input double   PartialClosePct    = 50.0;      // ปิด 50% ที่เป้า TP แรก

// --- Visual Drawing (ตีเส้นบนกราฟ) ---
input bool     DrawDemandSupplyZone = true;     // วาดกล่อง Demand/Supply Zone
input bool     DrawWM_Pattern       = true;     // ตีเส้นโครงสร้าง W/M Pattern
input bool     DrawNeckline         = true;     // ตีเส้น Neckline ของ W/M
input bool     DrawFiboLevel        = true;     // ตีเส้น Fibonacci 61.8%
input bool     DrawTrendLine        = true;     // ตีเส้น Trend/MA label
input color    DemandZoneColor      = clrGold;          // สีโซน Demand
input color    SupplyZoneColor      = clrDeepPink;      // สีโซน Supply
input color    WPatternColor        = clrLime;          // สีเส้น W Pattern
input color    MPatternColor        = clrRed;           // สีเส้น M Pattern
input color    NecklineColor        = clrDodgerBlue;    // สี Neckline
input color    FiboColor            = clrOrange;        // สี Fibo 61.8
input color    UptrendColor         = clrLime;          // สีเส้น Uptrend
input color    DowntrendColor       = clrRed;           // สีเส้น Downtrend

// ============================================================
// GLOBAL STATE
// ============================================================
int    handleRSI;
int    handleTrendMA;
double pointUnit;
bool   haltForToday = false;
int    currentDayCheck = 0;

// Swing Point Storage
double swingHighs[];  // เก็บจุด Swing High
double swingLows[];   // เก็บจุด Swing Low
int    swingHighIdx[]; // Index ของ Swing High
int    swingLowIdx[];  // Index ของ Swing Low

// Pattern State
int    lastSignalBar = 0;    // ป้องกันสัญญาณซ้ำ
 int    swingCount    = 0;    // การนับสวิง 1-5 (Delta Swing)
string lastPattern   = "---"; // Pattern ล่าสุด (W CF / M CF)
int    lastConfluence = 0;    // Confluence Score ล่าสุด

// Trailing State (per-position tracking via global counters)
int    trailPhase    = 0;    // 0=Init, 1=BE, 2=LockProfit, 3=SwingTrail
int    tpStepCount   = 0;    // จำนวนครั้งที่ TP ถูกเลื่อน
double lastTrailTP   = 0;    // TP ล่าสุดที่ถูก trail
bool   partialClosed = false; // Partial close แล้วหรือยัง

// Visual Drawing Prefix
string VIS_PREFIX = "PA_VIS_";
int    visObjCount = 0;       // นับ object ที่สร้าง

// ============================================================
// INITIALIZATION
// ============================================================
int OnInit() {
   trade.SetExpertMagicNumber(MagicNumber);
   
   pointUnit = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   if(SymbolInfoInteger(_Symbol, SYMBOL_DIGITS) == 5 || SymbolInfoInteger(_Symbol, SYMBOL_DIGITS) == 3) {
       pointUnit *= 10;
   }
   
   handleRSI     = iRSI(_Symbol, EntryTF, RSI_Period, PRICE_CLOSE);
   handleTrendMA = iMA(_Symbol, TrendTF, Trend_MA_Period, 0, MODE_SMA, PRICE_CLOSE);
   
   if(handleRSI == INVALID_HANDLE || handleTrendMA == INVALID_HANDLE) {
      Print("❌ PriceActionBot: Failed to create indicators");
      return INIT_FAILED;
   }
   
   DASH_PREFIX = "NXPA_";
   Dash_CreatePanel("NexusFX PA Bot (Gold)", MagicNumber, EnumToString(EntryTF), EnumToString(TrendTF));
   
   Print("✅ NexusFX PriceActionBot v1.00 initialized | Strategy: W/M + RSI + Swing(1-5)");
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) {
   IndicatorRelease(handleRSI);
   IndicatorRelease(handleTrendMA);
   Dash_DeletePanel();
   CleanupVisualObjects(); // ลบเส้นทั้งหมด
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
bool IsNewBar() {
   static datetime lastTime = 0;
   datetime currTime = iTime(_Symbol, EntryTF, 0);
   if (currTime != lastTime) { lastTime = currTime; return true; }
   return false;
}

bool IsSpreadOK() {
   if(MaxSpreadPoints <= 0) return true;
   return (SymbolInfoInteger(_Symbol, SYMBOL_SPREAD) <= MaxSpreadPoints);
}

bool IsInSession() {
   if(!UseSessionFilter) return true; 
   MqlDateTime dt; TimeToStruct(TimeCurrent(), dt);
   return (dt.hour >= SessionStartHour && dt.hour <= SessionEndHour);
}

void CheckDailyTargetAndDrawdown() {
   MqlDateTime dt; TimeToStruct(TimeCurrent(), dt);
   if(currentDayCheck != dt.day_of_year) {
      currentDayCheck = dt.day_of_year;
      haltForToday = false; 
   }
   if(haltForToday || (DailyProfitTargetPct <= 0 && DailyDrawdownPct <= 0)) return;

   datetime startOfDay = iTime(_Symbol, PERIOD_D1, 0);
   HistorySelect(startOfDay, TimeCurrent());
   double dailyNet = 0;
   
   for(int i=0; i<HistoryDealsTotal(); i++) {
      ulong deal = HistoryDealGetTicket(i);
      if(HistoryDealGetInteger(deal, DEAL_MAGIC) == MagicNumber) {
         dailyNet += HistoryDealGetDouble(deal, DEAL_PROFIT) + HistoryDealGetDouble(deal, DEAL_COMMISSION) + HistoryDealGetDouble(deal, DEAL_SWAP);
      }
   }
   
   for(int i=PositionsTotal()-1; i>=0; i--) {
      if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == MagicNumber) {
         dailyNet += PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
      }
   }
   
   double pPct = (dailyNet / AccountInfoDouble(ACCOUNT_BALANCE)) * 100.0;
   if(DailyProfitTargetPct > 0 && pPct >= DailyProfitTargetPct) haltForToday = true;
   if(DailyDrawdownPct > 0 && pPct <= -DailyDrawdownPct) haltForToday = true;
}

double CalculateDynamicLot(double slRiskPips, double riskPct) {
   if(riskPct <= 0 || slRiskPips <= 0) return SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double moneyRisk = AccountInfoDouble(ACCOUNT_BALANCE) * (riskPct / 100.0);
   double tpv = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   double ts = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   double slPts = slRiskPips * (pointUnit / SymbolInfoDouble(_Symbol, SYMBOL_POINT));
   if(slPts == 0) return SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   
   double lossPerLot = (slPts / ts) * tpv;
   double lot = moneyRisk / lossPerLot;
   double vStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   return MathMax(SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN), MathFloor(lot / vStep) * vStep);
}

double CalculateScaleLot(double lastLot) {
   double newLot = lastLot * ScaleLotMultiplier;
   double vStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   return MathMax(SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN), MathFloor(newLot / vStep) * vStep);
}

int GetTrendDirection() {
   double maVal[]; ArraySetAsSeries(maVal, true);
   if(CopyBuffer(handleTrendMA, 0, 0, 1, maVal) < 1) return 0;
   double price = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   if(price > maVal[0]) return  1; // Uptrend
   if(price < maVal[0]) return -1; // Downtrend
   return 0;
}

double GetRSI(int shift=0) {
   double rsiVal[]; ArraySetAsSeries(rsiVal, true);
   if(CopyBuffer(handleRSI, 0, shift, 1, rsiVal) < 1) return 50.0;
   return rsiVal[0];
}

string GetOrderComment(string actionParams) {
   string entryTfStr = EnumToString(EntryTF); string trendTfStr = EnumToString(TrendTF);
   StringReplace(entryTfStr, "PERIOD_", ""); StringReplace(trendTfStr, "PERIOD_", "");
   return StringFormat("%s PA (%s/%s) %s", RunMagic, entryTfStr, trendTfStr, actionParams);
}

// ============================================================
// SWING POINT DETECTION (หา Swing High / Swing Low)
// ============================================================
void FindSwingPoints() {
   ArrayResize(swingHighs, 0);
   ArrayResize(swingLows, 0);
   ArrayResize(swingHighIdx, 0);
   ArrayResize(swingLowIdx, 0);
   
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   int copied = CopyRates(_Symbol, EntryTF, 0, SwingLookback + SwingStrength + 1, rates);
   if(copied < SwingLookback) return;
   
   for(int i = SwingStrength; i < copied - SwingStrength; i++) {
      // --- Check Swing High ---
      bool isSwingHigh = true;
      for(int j = 1; j <= SwingStrength; j++) {
         if(rates[i].high <= rates[i-j].high || rates[i].high <= rates[i+j].high) {
            isSwingHigh = false;
            break;
         }
      }
      if(isSwingHigh) {
         int sz = ArraySize(swingHighs);
         ArrayResize(swingHighs, sz+1);
         ArrayResize(swingHighIdx, sz+1);
         swingHighs[sz] = rates[i].high;
         swingHighIdx[sz] = i;
      }
      
      // --- Check Swing Low ---
      bool isSwingLow = true;
      for(int j = 1; j <= SwingStrength; j++) {
         if(rates[i].low >= rates[i-j].low || rates[i].low >= rates[i+j].low) {
            isSwingLow = false;
            break;
         }
      }
      if(isSwingLow) {
         int sz = ArraySize(swingLows);
         ArrayResize(swingLows, sz+1);
         ArrayResize(swingLowIdx, sz+1);
         swingLows[sz] = rates[i].low;
         swingLowIdx[sz] = i;
      }
   }
}

// ============================================================
// W PATTERN DETECTION (W CF ยกโล - BUY Signal)
// W = Double Bottom with Higher Low confirmation
// ============================================================
bool DetectW_Pattern(double &sl, double &tp) {
   int shCount = ArraySize(swingLows);
   int shHighCount = ArraySize(swingHighs);
   if(shCount < 3 || shHighCount < 1) return false;
   
   // ต้องการ: Low1 -> High1 -> Low2 (ยกโล = Low2 > Low1) -> Break High1
   double low1  = swingLows[2];   // จุดต่ำสุดที่ 1 (W ซ้าย)
   double low2  = swingLows[1];   // จุดต่ำสุดที่ 2 (W ขวา) - ต้องยกโล
   double low0  = swingLows[0];   // จุดต่ำสุดล่าสุด
   
   // [FIX#2] หา Neckline: Swing High ที่อยู่ระหว่าง Low1 กับ Low2
   double high1 = 0;
   int low1BarIdx = swingLowIdx[2];
   int low2BarIdx = swingLowIdx[1];
   int neckBarIdx = 0; // เก็บตำแหน่ง Neckline bar สำหรับวาดเส้น
   for(int k = 0; k < shHighCount; k++) {
      if(swingHighIdx[k] > low2BarIdx && swingHighIdx[k] < low1BarIdx) {
         if(swingHighs[k] > high1) {
            high1 = swingHighs[k];
            neckBarIdx = swingHighIdx[k];
         }
      }
   }
   if(high1 == 0) return false; // ไม่เจอ Neckline ระหว่าง Low1-Low2
   
   double tolerance = high1 * (PatternTolerancePct / 100.0);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   
   // === เงื่อนไข W CF ยกโล ===
   // 1. Low2 ต้องสูงกว่า Low1 (ยกโล = Higher Low)
   // 2. ราคาปัจจุบันต้องทะลุ High1 (Neckline Break = ยกไฮชนะ)
   // 3. Low0 (ล่าสุด) ไม่ต่ำกว่า Low2 (ยืนแนวรับได้)
   if(low2 > low1 && low0 >= low2 - tolerance && ask > high1) {
      // SL ใต้ฐาน W (จุดต่ำสุด) + Buffer
      sl = MathMin(low1, low2) - (SL_BufferPips * pointUnit);
      
      // TP ก่อนถึง S/R ถัดไป
      double slPips = (ask - sl) / pointUnit;
      tp = ask + ((slPips * 2.0) * pointUnit); // R:R 1:2 เป็นอย่างน้อย
      
      // [FIX#3] ปรับ TP ให้ "ก่อนถึง" แนวต้าน + Minimum R:R Guard
      if(shHighCount >= 2) {
         double nearestResistance = 0;
         for(int i = 0; i < shHighCount; i++) {
            if(swingHighs[i] > ask && (nearestResistance == 0 || swingHighs[i] < nearestResistance)) {
               nearestResistance = swingHighs[i];
            }
         }
         if(nearestResistance > ask) {
            double tpCandidate = nearestResistance - (TP_BeforeSR_Pips * pointUnit);
            double minTP = ask + ((slPips * 1.5) * pointUnit); // ขั้นต่ำ R:R 1:1.5
            // ถ้าแนวต้านใกล้เกินไป (R:R < 1:1) → ข้ามเทรดนี้
            if(tpCandidate < ask + (slPips * pointUnit)) return false;
            tp = MathMax(tpCandidate, minTP);
         }
      }
      
      // === VISUAL: วาดโครงสร้าง W + Neckline ===
      DrawW_PatternLines(low1, low2, high1, low1BarIdx, low2BarIdx, neckBarIdx);
      DrawNecklineLevel(high1, "W");
      
      return true;
   }
   
   return false;
}

// ============================================================
// M PATTERN DETECTION (M CF ไฮต่ำ - SELL Signal)
// M = Double Top with Lower High confirmation
// ============================================================
bool DetectM_Pattern(double &sl, double &tp) {
   int shCount = ArraySize(swingHighs);
   int slCount = ArraySize(swingLows);
   if(shCount < 3 || slCount < 1) return false;
   
   // ต้องการ: High1 -> Low1 -> High2 (ไฮต่ำ = High2 < High1) -> Break Low1
   double high1 = swingHighs[2];  // จุดสูงสุดที่ 1 (M ซ้าย)
   double high2 = swingHighs[1];  // จุดสูงสุดที่ 2 (M ขวา) - ต้องไฮต่ำ
   double high0 = swingHighs[0];  // จุดสูงสุดล่าสุด
   
   // [FIX#2] หา Neckline: Swing Low ที่อยู่ระหว่าง High1 กับ High2
   double low1 = 999999;
   int high1BarIdx = swingHighIdx[2];
   int high2BarIdx = swingHighIdx[1];
   int neckBarIdx = 0; // เก็บตำแหน่ง Neckline bar
   for(int k = 0; k < slCount; k++) {
      if(swingLowIdx[k] > high2BarIdx && swingLowIdx[k] < high1BarIdx) {
         if(swingLows[k] < low1) {
            low1 = swingLows[k];
            neckBarIdx = swingLowIdx[k];
         }
      }
   }
   if(low1 >= 999999) return false; // ไม่เจอ Neckline ระหว่าง High1-High2
   
   double tolerance = high1 * (PatternTolerancePct / 100.0);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   
   // === เงื่อนไข M CF ไฮต่ำ ===
   // 1. High2 ต้องต่ำกว่า High1 (ไฮต่ำ = Lower High)
   // 2. ราคาปัจจุบันต้องหลุด Low1 (Neckline Break = โลต่ำชนะ)
   // 3. High0 (ล่าสุด) ไม่สูงกว่า High2 (ไม่ยืนแนวต้าน)
   if(high2 < high1 && high0 <= high2 + tolerance && bid < low1) {
      // SL เหนือยอด M (จุดสูงสุด) + Buffer
      sl = MathMax(high1, high2) + (SL_BufferPips * pointUnit);
      
      // TP ก่อนถึง S/R ถัดไป
      double slPips = (sl - bid) / pointUnit;
      tp = bid - ((slPips * 2.0) * pointUnit); // R:R 1:2 เป็นอย่างน้อย
      
      // [FIX#3] ปรับ TP ให้ "ก่อนถึง" แนวรับ + Minimum R:R Guard
      if(slCount >= 2) {
         double nearestSupport = 0;
         for(int i = 0; i < slCount; i++) {
            if(swingLows[i] < bid && (nearestSupport == 0 || swingLows[i] > nearestSupport)) {
               nearestSupport = swingLows[i];
            }
         }
         if(nearestSupport > 0) {
            double tpCandidate = nearestSupport + (TP_BeforeSR_Pips * pointUnit);
            double minTP = bid - ((slPips * 1.5) * pointUnit); // ขั้นต่ำ R:R 1:1.5
            // ถ้าแนวรับใกล้เกินไป (R:R < 1:1) → ข้ามเทรดนี้
            if(tpCandidate > bid - (slPips * pointUnit)) return false;
            tp = MathMin(tpCandidate, minTP);
         }
      }
      
      // === VISUAL: วาดโครงสร้าง M + Neckline ===
      DrawM_PatternLines(high1, high2, low1, high1BarIdx, high2BarIdx, neckBarIdx);
      DrawNecklineLevel(low1, "M");
      
      return true;
   }
   
   return false;
}

// ============================================================
// RSI DIVERGENCE DETECTION
// Bullish Div: Price makes Lower Low, RSI makes Higher Low
// Bearish Div: Price makes Higher High, RSI makes Lower High
// ============================================================
int DetectRSIDivergence() {
   if(!UseRSIDivergence) return 0;
   
   double rsiArr[]; ArraySetAsSeries(rsiArr, true);
   if(CopyBuffer(handleRSI, 0, 0, DivLookback + 5, rsiArr) < DivLookback) return 0;
   
   MqlRates rates[]; ArraySetAsSeries(rates, true);
   if(CopyRates(_Symbol, EntryTF, 0, DivLookback + 5, rates) < DivLookback) return 0;
   
   // หา ค่า RSI ต่ำสุด/สูงสุด และราคา ต่ำสุด/สูงสุด ใน 2 ช่วง
   int halfLB = DivLookback / 2;
   
   // ช่วงล่าสุด (recent)
   double recentPriceLow = rates[1].low, recentPriceHigh = rates[1].high;
   double recentRSILow = rsiArr[1], recentRSIHigh = rsiArr[1];
   for(int i = 1; i <= halfLB; i++) {
      if(rates[i].low < recentPriceLow)   { recentPriceLow = rates[i].low; recentRSILow = rsiArr[i]; }
      if(rates[i].high > recentPriceHigh) { recentPriceHigh = rates[i].high; recentRSIHigh = rsiArr[i]; }
   }
   
   // ช่วงก่อนหน้า (previous)
   double prevPriceLow = rates[halfLB+1].low, prevPriceHigh = rates[halfLB+1].high;
   double prevRSILow = rsiArr[halfLB+1], prevRSIHigh = rsiArr[halfLB+1];
   for(int i = halfLB+1; i < DivLookback; i++) {
      if(rates[i].low < prevPriceLow)   { prevPriceLow = rates[i].low; prevRSILow = rsiArr[i]; }
      if(rates[i].high > prevPriceHigh) { prevPriceHigh = rates[i].high; prevRSIHigh = rsiArr[i]; }
   }
   
   // === Bullish Divergence (ดัก Buy) ===
   // Price: Lower Low, RSI: Higher Low (RSI ยกโล)
   if(recentPriceLow < prevPriceLow && recentRSILow > prevRSILow) {
      return 1; // Bullish Div
   }
   
   // === Bearish Divergence (ดัก Sell) ===
   // Price: Higher High, RSI: Lower High (RSI ไฮต่ำ)
   if(recentPriceHigh > prevPriceHigh && recentRSIHigh < prevRSIHigh) {
      return -1; // Bearish Div
   }
   
   return 0;
}

// ============================================================
// PRICE ACTION CANDLE CONFIRMATION (PA Buy / PA Sell)
// ============================================================
bool IsPA_BuyCandle() {
   MqlRates rates[]; ArraySetAsSeries(rates, true);
   if(CopyRates(_Symbol, EntryTF, 1, 2, rates) < 2) return false;
   
   double body = MathAbs(rates[0].close - rates[0].open);
   double range = rates[0].high - rates[0].low;
   double lowerWick = MathMin(rates[0].open, rates[0].close) - rates[0].low;
   
   if(range == 0) return false;
   
   // PA Buy: แท่ง Bullish + ไส้ล่างยาว (ถอดไส้ยาว)
   // 1. Close > Open (แท่งเขียว)
   // 2. ไส้ล่าง >= 60% ของ Range ทั้งหมด (Pin Bar / Hammer)
   bool isBullishCandle = rates[0].close > rates[0].open;
   bool hasLongLowerWick = (lowerWick / range) >= 0.6;
   
   // หรือ: Bullish Engulfing (แท่งเขียวกลืนแท่งแดง)
   bool isBullishEngulfing = (rates[0].close > rates[0].open) && 
                             (rates[1].close < rates[1].open) &&
                             (rates[0].close > rates[1].open) && 
                             (rates[0].open < rates[1].close);
   
   return (isBullishCandle && hasLongLowerWick) || isBullishEngulfing;
}

bool IsPA_SellCandle() {
   MqlRates rates[]; ArraySetAsSeries(rates, true);
   if(CopyRates(_Symbol, EntryTF, 1, 2, rates) < 2) return false;
   
   double body = MathAbs(rates[0].close - rates[0].open);
   double range = rates[0].high - rates[0].low;
   double upperWick = rates[0].high - MathMax(rates[0].open, rates[0].close);
   
   if(range == 0) return false;
   
   // PA Sell: แท่ง Bearish + ไส้บนยาว (Shooting Star / Inverted Pin)
   // 1. Close < Open (แท่งแดง)
   // 2. ไส้บน >= 60% ของ Range ทั้งหมด
   bool isBearishCandle = rates[0].close < rates[0].open;
   bool hasLongUpperWick = (upperWick / range) >= 0.6;
   
   // หรือ: Bearish Engulfing (แท่งแดงกลืนแท่งเขียว)
   bool isBearishEngulfing = (rates[0].close < rates[0].open) && 
                             (rates[1].close > rates[1].open) &&
                             (rates[0].open > rates[1].close) && 
                             (rates[0].close < rates[1].open);
   
   return (isBearishCandle && hasLongUpperWick) || isBearishEngulfing;
}

// ============================================================
// DEMAND ZONE DETECTION (แนวรับเส้นสีทอง)
// ============================================================
bool IsInDemandZone(double price) {
   MqlRates rates[]; ArraySetAsSeries(rates, true);
   if(CopyRates(_Symbol, EntryTF, 0, DZ_Lookback, rates) < DZ_Lookback) return false;
   
   double tolerance = DZ_TouchTolerance * pointUnit;
   
   // หา Strong Support Zone: จุดที่ราคาเด้งกลับอย่างรุนแรง (Bullish Rejection)
   for(int i = 5; i < DZ_Lookback - 1; i++) {
      double lowerBody = MathMin(rates[i].open, rates[i].close);
      double wickLen = lowerBody - rates[i].low;
      double bodyLen = MathAbs(rates[i].close - rates[i].open);
      
      // [FIX#4] แท่งที่มี Rejection แรง (ไส้ล่างยาว > 2x ตัวแท่ง, ไม่นับ Doji)
      if(bodyLen > 0 && wickLen > bodyLen * 2.0 && rates[i].close > rates[i].open) {
         double zoneTop = lowerBody;
         double zoneBot = rates[i].low;
         
         if(price >= zoneBot - tolerance && price <= zoneTop + tolerance) {
            return true;
         }
      }
   }
   
   return false;
}

bool IsInSupplyZone(double price) {
   MqlRates rates[]; ArraySetAsSeries(rates, true);
   if(CopyRates(_Symbol, EntryTF, 0, DZ_Lookback, rates) < DZ_Lookback) return false;
   
   double tolerance = DZ_TouchTolerance * pointUnit;
   
   // หา Strong Resistance Zone: จุดที่ราคาถูกปฏิเสธอย่างรุนแรง (Bearish Rejection)
   for(int i = 5; i < DZ_Lookback - 1; i++) {
      double upperBody = MathMax(rates[i].open, rates[i].close);
      double wickLen = rates[i].high - upperBody;
      double bodyLen = MathAbs(rates[i].close - rates[i].open);
      
      // [FIX#4] แท่งที่มี Rejection แรง (ไส้บนยาว > 2x ตัวแท่ง, ไม่นับ Doji)
      if(bodyLen > 0 && wickLen > bodyLen * 2.0 && rates[i].close < rates[i].open) {
         double zoneTop = rates[i].high;
         double zoneBot = upperBody;
         
         if(price >= zoneBot - tolerance && price <= zoneTop + tolerance) {
            return true;
         }
      }
   }
   
   return false;
}

// ============================================================
// FIBONACCI 61.8 CONFLUENCE CHECK
// ============================================================
bool IsNearFibo618(double price, int direction) {
   if(!UseFiboConfluence) return true; // ถ้าไม่ใช้ ถือว่า pass เสมอ
   
   // หาช่วง Swing สำหรับวาด Fibo
   if(ArraySize(swingHighs) < 1 || ArraySize(swingLows) < 1) return false;
   
   double fiboTol = FiboTolerance * pointUnit;
   
   if(direction == 1) { // Buy: Fibo จาก High ลง Low
      double swHigh = swingHighs[0]; // จุดสูงสุดล่าสุด
      double swLow = swingLows[0];   // จุดต่ำสุดล่าสุด
      if(swHigh <= swLow) return false;
      
      double fibo618 = swHigh - ((swHigh - swLow) * FiboLevel);
      return (price >= fibo618 - fiboTol && price <= fibo618 + fiboTol);
   }
   else if(direction == -1) { // Sell: Fibo จาก Low ขึ้น High
      double swLow = swingLows[0];
      double swHigh = swingHighs[0];
      if(swHigh <= swLow) return false;
      
      double fibo618 = swLow + ((swHigh - swLow) * FiboLevel);
      return (price >= fibo618 - fiboTol && price <= fibo618 + fiboTol);
   }
   
   return false;
}

// ============================================================
// CONFLUENCE SCORE CALCULATOR
// จุดเข้า = Zone + Structure(W/M) + PA + RSI
// ============================================================
int CalculateConfluence(int direction) {
   int score = 0;
   double rsi = GetRSI(1);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   
   if(direction == 1) { // === BUY Confluence ===
      // 1. RSI ในโซน Oversold หรือ Divergence
      if(rsi <= RSI_OVS) score += 2;
      else if(rsi <= RSI_OVS + 10) score += 1;
      if(DetectRSIDivergence() == 1) score += 2; // Bullish Divergence
      
      // 2. PA Buy Confirmation (ถอดไส้ยาว / Engulfing)
      if(IsPA_BuyCandle()) score += 2;
      
      // 3. Demand Zone (แนวรับเส้นสีทอง)
      if(IsInDemandZone(ask)) score += 2;
      
      // 4. Fibonacci 61.8 Confluence
      if(IsNearFibo618(ask, 1)) score += 1;
      
      // 5. Trend Filter (ราคา > MA = Uptrend)
      if(GetTrendDirection() >= 0) score += 1;
   }
   else if(direction == -1) { // === SELL Confluence ===
      // 1. RSI ในโซน Overbought หรือ Divergence
      if(rsi >= RSI_OVB) score += 2;
      else if(rsi >= RSI_OVB - 10) score += 1;
      if(DetectRSIDivergence() == -1) score += 2; // Bearish Divergence
      
      // 2. PA Sell Confirmation (ถอดไส้บน / Engulfing)
      if(IsPA_SellCandle()) score += 2;
      
      // 3. Supply Zone
      if(IsInSupplyZone(bid)) score += 2;
      
      // 4. Fibonacci 61.8 Confluence
      if(IsNearFibo618(bid, -1)) score += 1;
      
      // 5. Trend Filter (ราคา < MA = Downtrend)
      if(GetTrendDirection() <= 0) score += 1;
   }
   
   return score;
}

// ============================================================
// RSI-BASED EXIT (ปิดกำไรเมื่อ RSI สุดรอบ)
// ============================================================
void CheckRSI_Exit() {
   if(!UseRSI_TP) return;
   
   double rsi = GetRSI(0);
   
   for(int i = PositionsTotal()-1; i >= 0; i--) {
      if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == MagicNumber) {
         double profit = PositionGetDouble(POSITION_PROFIT);
         ulong ticket = PositionGetInteger(POSITION_TICKET);
         ENUM_POSITION_TYPE pType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
         
         // ปิดเมื่อ RSI สุดรอบ + กำไรเป็นบวก (เก็บก่อน!)
         if(profit > 0) {
            if(pType == POSITION_TYPE_BUY && rsi >= RSI_OVB) {
               trade.PositionClose(ticket);
               Print("🎯 PA Bot: RSI OVB Exit (BUY) | RSI=", DoubleToString(rsi,1), " | Profit=$", DoubleToString(profit,2));
            }
            else if(pType == POSITION_TYPE_SELL && rsi <= RSI_OVS) {
               trade.PositionClose(ticket);
               Print("🎯 PA Bot: RSI OVS Exit (SELL) | RSI=", DoubleToString(rsi,1), " | Profit=$", DoubleToString(profit,2));
            }
         }
      }
   }
}

// ============================================================
// DRAW VISUAL MARKERS ON CHART
// ============================================================
void DrawPatternMarker(string name, datetime time, double price, int direction, string label) {
   if(ObjectFind(0, name) >= 0) return;
   
   ObjectCreate(0, name, OBJ_ARROW, 0, time, price);
   ObjectSetInteger(0, name, OBJPROP_ARROWCODE, direction > 0 ? 233 : 234); // Up/Down arrow
   ObjectSetInteger(0, name, OBJPROP_COLOR, direction > 0 ? clrLime : clrRed);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, 2);
   
   // Label
   string lblName = name + "_lbl";
   ObjectCreate(0, lblName, OBJ_TEXT, 0, time, price + (direction > 0 ? -10 : 10) * pointUnit);
   ObjectSetString(0, lblName, OBJPROP_TEXT, label);
   ObjectSetInteger(0, lblName, OBJPROP_COLOR, direction > 0 ? clrLime : clrRed);
   ObjectSetInteger(0, lblName, OBJPROP_FONTSIZE, 8);
}

// ============================================================
// VISUAL: CLEANUP ALL VISUAL OBJECTS
// ============================================================
void CleanupVisualObjects() {
   int total = ObjectsTotal(0);
   for(int i = total - 1; i >= 0; i--) {
      string objName = ObjectName(0, i);
      if(StringFind(objName, VIS_PREFIX) == 0 || StringFind(objName, "PA_W_") == 0 || StringFind(objName, "PA_M_") == 0) {
         ObjectDelete(0, objName);
      }
   }
   visObjCount = 0;
   ChartRedraw(0);
}

// ============================================================
// VISUAL: DEMAND ZONE RECTANGLE (กล่องสีทอง)
// ============================================================
void DrawDemandZoneBox(double zoneBot, double zoneTop, datetime timeStart) {
   if(!DrawDemandSupplyZone) return;
   
   string name = VIS_PREFIX + "DZ_" + IntegerToString(visObjCount++);
   datetime timeEnd = TimeCurrent() + PeriodSeconds(EntryTF) * 20; // ยืดไป 20 แท่ง
   
   ObjectCreate(0, name, OBJ_RECTANGLE, 0, timeStart, zoneBot, timeEnd, zoneTop);
   ObjectSetInteger(0, name, OBJPROP_COLOR, DemandZoneColor);
   ObjectSetInteger(0, name, OBJPROP_STYLE, STYLE_DOT);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, 1);
   ObjectSetInteger(0, name, OBJPROP_FILL, true);         // เติมสี
   ObjectSetInteger(0, name, OBJPROP_BACK, true);         // วาดหลังราคา
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   
   // Label
   string lbl = VIS_PREFIX + "DZL_" + IntegerToString(visObjCount++);
   ObjectCreate(0, lbl, OBJ_TEXT, 0, timeStart, zoneTop + 2 * pointUnit);
   ObjectSetString(0, lbl, OBJPROP_TEXT, "DEMAND ZONE");
   ObjectSetInteger(0, lbl, OBJPROP_COLOR, DemandZoneColor);
   ObjectSetInteger(0, lbl, OBJPROP_FONTSIZE, 7);
}

// ============================================================
// VISUAL: SUPPLY ZONE RECTANGLE (กล่องสีชมพู)
// ============================================================
void DrawSupplyZoneBox(double zoneBot, double zoneTop, datetime timeStart) {
   if(!DrawDemandSupplyZone) return;
   
   string name = VIS_PREFIX + "SZ_" + IntegerToString(visObjCount++);
   datetime timeEnd = TimeCurrent() + PeriodSeconds(EntryTF) * 20;
   
   ObjectCreate(0, name, OBJ_RECTANGLE, 0, timeStart, zoneBot, timeEnd, zoneTop);
   ObjectSetInteger(0, name, OBJPROP_COLOR, SupplyZoneColor);
   ObjectSetInteger(0, name, OBJPROP_STYLE, STYLE_DOT);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, 1);
   ObjectSetInteger(0, name, OBJPROP_FILL, true);
   ObjectSetInteger(0, name, OBJPROP_BACK, true);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   
   string lbl = VIS_PREFIX + "SZL_" + IntegerToString(visObjCount++);
   ObjectCreate(0, lbl, OBJ_TEXT, 0, timeStart, zoneBot - 2 * pointUnit);
   ObjectSetString(0, lbl, OBJPROP_TEXT, "SUPPLY ZONE");
   ObjectSetInteger(0, lbl, OBJPROP_COLOR, SupplyZoneColor);
   ObjectSetInteger(0, lbl, OBJPROP_FONTSIZE, 7);
}

// ============================================================
// VISUAL: W PATTERN STRUCTURE LINES (เส้น V-V ของ W)
// Low1 ── High1 (Neckline) ── Low2 ── ราคาปัจจุบัน
// ============================================================
void DrawW_PatternLines(double low1, double low2, double high1, int low1Idx, int low2Idx, int highIdx) {
   if(!DrawWM_Pattern) return;
   
   MqlRates rates[]; ArraySetAsSeries(rates, true);
   CopyRates(_Symbol, EntryTF, 0, SwingLookback + SwingStrength + 1, rates);
   
   // เส้น Low1 → High1 (ขาขึ้นซ้าย)
   string line1 = VIS_PREFIX + "W1_" + IntegerToString(visObjCount++);
   ObjectCreate(0, line1, OBJ_TREND, 0, rates[low1Idx].time, low1, rates[highIdx].time, high1);
   ObjectSetInteger(0, line1, OBJPROP_COLOR, WPatternColor);
   ObjectSetInteger(0, line1, OBJPROP_STYLE, STYLE_SOLID);
   ObjectSetInteger(0, line1, OBJPROP_WIDTH, 2);
   ObjectSetInteger(0, line1, OBJPROP_RAY_RIGHT, false);
   ObjectSetInteger(0, line1, OBJPROP_BACK, false);
   
   // เส้น High1 → Low2 (ขาลงกลาง)
   string line2 = VIS_PREFIX + "W2_" + IntegerToString(visObjCount++);
   ObjectCreate(0, line2, OBJ_TREND, 0, rates[highIdx].time, high1, rates[low2Idx].time, low2);
   ObjectSetInteger(0, line2, OBJPROP_COLOR, WPatternColor);
   ObjectSetInteger(0, line2, OBJPROP_STYLE, STYLE_SOLID);
   ObjectSetInteger(0, line2, OBJPROP_WIDTH, 2);
   ObjectSetInteger(0, line2, OBJPROP_RAY_RIGHT, false);
   
   // เส้น Low2 → ราคาปัจจุบัน (ขาขึ้นขวา = Break Neckline)
   string line3 = VIS_PREFIX + "W3_" + IntegerToString(visObjCount++);
   ObjectCreate(0, line3, OBJ_TREND, 0, rates[low2Idx].time, low2, TimeCurrent(), SymbolInfoDouble(_Symbol, SYMBOL_ASK));
   ObjectSetInteger(0, line3, OBJPROP_COLOR, WPatternColor);
   ObjectSetInteger(0, line3, OBJPROP_STYLE, STYLE_DASH);
   ObjectSetInteger(0, line3, OBJPROP_WIDTH, 2);
   ObjectSetInteger(0, line3, OBJPROP_RAY_RIGHT, false);
   
   // Label: "W" ที่ Neckline
   string wlbl = VIS_PREFIX + "WLBL_" + IntegerToString(visObjCount++);
   ObjectCreate(0, wlbl, OBJ_TEXT, 0, rates[highIdx].time, high1 + 5 * pointUnit);
   ObjectSetString(0, wlbl, OBJPROP_TEXT, "\x57 CF \x0e22\x0e01\x0e42\x0e25");  // W CF ยกโล
   ObjectSetInteger(0, wlbl, OBJPROP_COLOR, WPatternColor);
   ObjectSetInteger(0, wlbl, OBJPROP_FONTSIZE, 9);
}

// ============================================================
// VISUAL: M PATTERN STRUCTURE LINES (เส้น Λ-Λ ของ M)
// High1 ── Low1 (Neckline) ── High2 ── ราคาปัจจุบัน
// ============================================================
void DrawM_PatternLines(double high1, double high2, double low1, int high1Idx, int high2Idx, int lowIdx) {
   if(!DrawWM_Pattern) return;
   
   MqlRates rates[]; ArraySetAsSeries(rates, true);
   CopyRates(_Symbol, EntryTF, 0, SwingLookback + SwingStrength + 1, rates);
   
   // เส้น High1 → Low1 (ขาลงซ้าย)
   string line1 = VIS_PREFIX + "M1_" + IntegerToString(visObjCount++);
   ObjectCreate(0, line1, OBJ_TREND, 0, rates[high1Idx].time, high1, rates[lowIdx].time, low1);
   ObjectSetInteger(0, line1, OBJPROP_COLOR, MPatternColor);
   ObjectSetInteger(0, line1, OBJPROP_STYLE, STYLE_SOLID);
   ObjectSetInteger(0, line1, OBJPROP_WIDTH, 2);
   ObjectSetInteger(0, line1, OBJPROP_RAY_RIGHT, false);
   
   // เส้น Low1 → High2 (ขาขึ้นกลาง)
   string line2 = VIS_PREFIX + "M2_" + IntegerToString(visObjCount++);
   ObjectCreate(0, line2, OBJ_TREND, 0, rates[lowIdx].time, low1, rates[high2Idx].time, high2);
   ObjectSetInteger(0, line2, OBJPROP_COLOR, MPatternColor);
   ObjectSetInteger(0, line2, OBJPROP_STYLE, STYLE_SOLID);
   ObjectSetInteger(0, line2, OBJPROP_WIDTH, 2);
   ObjectSetInteger(0, line2, OBJPROP_RAY_RIGHT, false);
   
   // เส้น High2 → ราคาปัจจุบัน (ขาลงขวา = Break Neckline)
   string line3 = VIS_PREFIX + "M3_" + IntegerToString(visObjCount++);
   ObjectCreate(0, line3, OBJ_TREND, 0, rates[high2Idx].time, high2, TimeCurrent(), SymbolInfoDouble(_Symbol, SYMBOL_BID));
   ObjectSetInteger(0, line3, OBJPROP_COLOR, MPatternColor);
   ObjectSetInteger(0, line3, OBJPROP_STYLE, STYLE_DASH);
   ObjectSetInteger(0, line3, OBJPROP_WIDTH, 2);
   ObjectSetInteger(0, line3, OBJPROP_RAY_RIGHT, false);
   
   // Label: "M" ที่ Neckline
   string mlbl = VIS_PREFIX + "MLBL_" + IntegerToString(visObjCount++);
   ObjectCreate(0, mlbl, OBJ_TEXT, 0, rates[lowIdx].time, low1 - 5 * pointUnit);
   ObjectSetString(0, mlbl, OBJPROP_TEXT, "M CF \x0e44\x0e2e\x0e15\x0e48\x0e33");  // M CF ไฮต่ำ
   ObjectSetInteger(0, mlbl, OBJPROP_COLOR, MPatternColor);
   ObjectSetInteger(0, mlbl, OBJPROP_FONTSIZE, 9);
}

// ============================================================
// VISUAL: NECKLINE (เส้นประสีฟ้าระดับ Neckline)
// ============================================================
void DrawNecklineLevel(double necklinePrice, string patternType) {
   if(!DrawNeckline) return;
   
   string name = VIS_PREFIX + "NL_" + patternType + "_" + IntegerToString(visObjCount++);
   ObjectCreate(0, name, OBJ_HLINE, 0, 0, necklinePrice);
   ObjectSetInteger(0, name, OBJPROP_COLOR, NecklineColor);
   ObjectSetInteger(0, name, OBJPROP_STYLE, STYLE_DASHDOTDOT);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, 1);
   ObjectSetInteger(0, name, OBJPROP_BACK, true);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   
   string lbl = VIS_PREFIX + "NLL_" + IntegerToString(visObjCount++);
   ObjectCreate(0, lbl, OBJ_TEXT, 0, TimeCurrent(), necklinePrice + 2 * pointUnit);
   ObjectSetString(0, lbl, OBJPROP_TEXT, "Neckline " + patternType + " " + DoubleToString(necklinePrice, (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS)));
   ObjectSetInteger(0, lbl, OBJPROP_COLOR, NecklineColor);
   ObjectSetInteger(0, lbl, OBJPROP_FONTSIZE, 7);
}

// ============================================================
// VISUAL: FIBONACCI 61.8% LEVEL
// ============================================================
void DrawFibo618Line(double fiboPrice, int direction) {
   if(!DrawFiboLevel) return;
   
   string name = VIS_PREFIX + "FIB_" + IntegerToString(visObjCount++);
   ObjectCreate(0, name, OBJ_HLINE, 0, 0, fiboPrice);
   ObjectSetInteger(0, name, OBJPROP_COLOR, FiboColor);
   ObjectSetInteger(0, name, OBJPROP_STYLE, STYLE_DASHDOT);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, 1);
   ObjectSetInteger(0, name, OBJPROP_BACK, true);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   
   string lbl = VIS_PREFIX + "FIBL_" + IntegerToString(visObjCount++);
   double offset = (direction > 0 ? -5 : 5) * pointUnit;
   ObjectCreate(0, lbl, OBJ_TEXT, 0, TimeCurrent(), fiboPrice + offset);
   ObjectSetString(0, lbl, OBJPROP_TEXT, "Fibo 61.8% " + DoubleToString(fiboPrice, (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS)));
   ObjectSetInteger(0, lbl, OBJPROP_COLOR, FiboColor);
   ObjectSetInteger(0, lbl, OBJPROP_FONTSIZE, 7);
}

// ============================================================
// VISUAL: DRAW ALL DETECTED ZONES (Demand + Supply)
// เรียกทุก NewBar เพื่อ update ตำแหน่ง Zone
// ============================================================
void DrawAllDetectedZones() {
   if(!DrawDemandSupplyZone) return;
   
   MqlRates rates[]; ArraySetAsSeries(rates, true);
   if(CopyRates(_Symbol, EntryTF, 0, DZ_Lookback, rates) < DZ_Lookback) return;
   
   double tolerance = DZ_TouchTolerance * pointUnit;
   int zonesDrawn = 0;
   
   for(int i = 5; i < DZ_Lookback - 1 && zonesDrawn < 5; i++) {
      double upperBody = MathMax(rates[i].open, rates[i].close);
      double lowerBody = MathMin(rates[i].open, rates[i].close);
      double bodyLen = MathAbs(rates[i].close - rates[i].open);
      double lowerWick = lowerBody - rates[i].low;
      double upperWick = rates[i].high - upperBody;
      
      if(bodyLen <= 0) continue;
      
      // Demand Zone (ไส้ล่างยาว + แท่งเขียว)
      if(lowerWick > bodyLen * 2.0 && rates[i].close > rates[i].open) {
         DrawDemandZoneBox(rates[i].low, lowerBody, rates[i].time);
         zonesDrawn++;
      }
      // Supply Zone (ไส้บนยาว + แท่งแดง)
      if(upperWick > bodyLen * 2.0 && rates[i].close < rates[i].open) {
         DrawSupplyZoneBox(upperBody, rates[i].high, rates[i].time);
         zonesDrawn++;
      }
   }
}

// ============================================================
// VISUAL: DRAW FIBO 61.8 FOR CURRENT SWING
// ============================================================
void DrawCurrentFibo() {
   if(!DrawFiboLevel || !UseFiboConfluence) return;
   if(ArraySize(swingHighs) < 1 || ArraySize(swingLows) < 1) return;
   
   double swHigh = swingHighs[0];
   double swLow = swingLows[0];
   if(swHigh <= swLow) return;
   
   // Buy Fibo (High → Low)
   double fibo618_buy = swHigh - ((swHigh - swLow) * FiboLevel);
   DrawFibo618Line(fibo618_buy, 1);
   
   // Sell Fibo (Low → High)  
   double fibo618_sell = swLow + ((swHigh - swLow) * FiboLevel);
   if(MathAbs(fibo618_buy - fibo618_sell) > 5 * pointUnit) {
      DrawFibo618Line(fibo618_sell, -1);
   }
}

// ============================================================
// VISUAL: TRENDLINE อัตโนมัติ (จาก Swing Points)
// Uptrend   = ลากเส้นเชื่อม Higher Low 2 จุด
// Downtrend = ลากเส้นเชื่อม Lower High 2 จุด
// ============================================================
void DrawTrendLines() {
   if(!DrawTrendLine) return;
   
   MqlRates rates[]; ArraySetAsSeries(rates, true);
   if(CopyRates(_Symbol, EntryTF, 0, SwingLookback + SwingStrength + 1, rates) < SwingLookback) return;
   
   int shCount = ArraySize(swingHighs);
   int slCount = ArraySize(swingLows);
   
   // ============================================================
   // UPTREND LINE: เชื่อม Higher Low 2 จุด (จุดต่ำสุดยกขึ้น)
   // หา Swing Low 2 จุดติดกันที่ Low[1] > Low[0] (Higher Low)
   // ============================================================
   if(slCount >= 2) {
      // หาคู่ Higher Low: สแกนจากเก่าไปใหม่
      for(int i = 0; i < slCount - 1; i++) {
         // จุดใหม่กว่า (index น้อย = ใหม่กว่า) และจุดเก่าที่ Higher Low
         if(swingLows[i] > swingLows[i+1]) {
            int idx1 = swingLowIdx[i+1]; // จุดเก่า (ซ้าย)
            int idx2 = swingLowIdx[i];   // จุดใหม่ (ขวา)
            
            string name = VIS_PREFIX + "UTrend_" + IntegerToString(visObjCount++);
            ObjectCreate(0, name, OBJ_TREND, 0, 
                        rates[idx1].time, swingLows[i+1],   // จุดเริ่มต้น
                        rates[idx2].time, swingLows[i]);     // จุดปลาย
            ObjectSetInteger(0, name, OBJPROP_COLOR, UptrendColor);
            ObjectSetInteger(0, name, OBJPROP_STYLE, STYLE_SOLID);
            ObjectSetInteger(0, name, OBJPROP_WIDTH, 2);
            ObjectSetInteger(0, name, OBJPROP_RAY_RIGHT, true);  // ยืดไปขวา
            ObjectSetInteger(0, name, OBJPROP_BACK, false);
            ObjectSetInteger(0, name, OBJPROP_SELECTABLE, true); // ย้ายได้
            
            // Label
            string lbl = VIS_PREFIX + "UTL_" + IntegerToString(visObjCount++);
            ObjectCreate(0, lbl, OBJ_TEXT, 0, rates[idx2].time, swingLows[i] - 3 * pointUnit);
            ObjectSetString(0, lbl, OBJPROP_TEXT, "\x25B2 Uptrend");  // ▲ Uptrend
            ObjectSetInteger(0, lbl, OBJPROP_COLOR, UptrendColor);
            ObjectSetInteger(0, lbl, OBJPROP_FONTSIZE, 8);
            
            break; // วาดแค่เส้นเดียว (เส้นล่าสุด)
         }
      }
   }
   
   // ============================================================
   // DOWNTREND LINE: เชื่อม Lower High 2 จุด (จุดสูงสุดลดลง)
   // หา Swing High 2 จุดติดกันที่ High[1] < High[0] (Lower High)
   // ============================================================
   if(shCount >= 2) {
      for(int i = 0; i < shCount - 1; i++) {
         // จุดใหม่ต่ำกว่าจุดเก่า = Lower High
         if(swingHighs[i] < swingHighs[i+1]) {
            int idx1 = swingHighIdx[i+1]; // จุดเก่า (ซ้าย)
            int idx2 = swingHighIdx[i];   // จุดใหม่ (ขวา)
            
            string name = VIS_PREFIX + "DTrend_" + IntegerToString(visObjCount++);
            ObjectCreate(0, name, OBJ_TREND, 0, 
                        rates[idx1].time, swingHighs[i+1],  // จุดเริ่มต้น
                        rates[idx2].time, swingHighs[i]);    // จุดปลาย
            ObjectSetInteger(0, name, OBJPROP_COLOR, DowntrendColor);
            ObjectSetInteger(0, name, OBJPROP_STYLE, STYLE_SOLID);
            ObjectSetInteger(0, name, OBJPROP_WIDTH, 2);
            ObjectSetInteger(0, name, OBJPROP_RAY_RIGHT, true);  // ยืดไปขวา
            ObjectSetInteger(0, name, OBJPROP_BACK, false);
            ObjectSetInteger(0, name, OBJPROP_SELECTABLE, true);
            
            // Label
            string lbl = VIS_PREFIX + "DTL_" + IntegerToString(visObjCount++);
            ObjectCreate(0, lbl, OBJ_TEXT, 0, rates[idx2].time, swingHighs[i] + 3 * pointUnit);
            ObjectSetString(0, lbl, OBJPROP_TEXT, "\x25BC Downtrend");  // ▼ Downtrend
            ObjectSetInteger(0, lbl, OBJPROP_COLOR, DowntrendColor);
            ObjectSetInteger(0, lbl, OBJPROP_FONTSIZE, 8);
            
            break; // วาดแค่เส้นเดียว (เส้นล่าสุด)
         }
      }
   }
}

// ============================================================
// MAIN ONTICK LOGIC
// ============================================================
void OnTick()
{
   CheckDailyTargetAndDrawdown();

   int posBuy = 0, posSell = 0;
   double pnl = 0, lastBuyPrice = 0, lastSellPrice = 999999;
   double lastBuyLot = 0.01, lastSellLot = 0.01;
   
   for(int i = PositionsTotal()-1; i >= 0; i--) {
      if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == MagicNumber) {
         ENUM_POSITION_TYPE pType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
         pnl += PositionGetDouble(POSITION_PROFIT);
         double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
         double vol = PositionGetDouble(POSITION_VOLUME);
         
         if(pType == POSITION_TYPE_BUY) {
            posBuy++; if(openPrice > lastBuyPrice) { lastBuyPrice = openPrice; lastBuyLot = vol; }
         } else if(pType == POSITION_TYPE_SELL) {
            posSell++; if(openPrice < lastSellPrice) { lastSellPrice = openPrice; lastSellLot = vol; }
         }
      }
   }
   
   int totalPos = posBuy + posSell;
   // [FIX#6] Reset swingCount + trailing state เมื่อปิดออเดอร์ทั้งหมด
   if(totalPos == 0 && swingCount > 0) {
      swingCount = 0;
      trailPhase = 0;
      tpStepCount = 0;
      lastTrailTP = 0;
      partialClosed = false;
   }
   double rsiNow = GetRSI(0);
   
   string sigStatus = haltForToday ? "HALT (Daily Limit)" : 
                      ((totalPos > 0) ? StringFormat("IN TRADE | RSI:%.0f", rsiNow) : 
                      StringFormat("SCANNING (W/M) | RSI:%.0f", rsiNow));
   Dash_UpdatePanel(sigStatus, haltForToday ? clrRed : ((totalPos > 0) ? BuyColor : NeutralColor), totalPos, pnl);
   
   // === PA Status Dashboard ===
   if(totalPos == 0) { lastPattern = "---"; lastConfluence = 0; }
   Dash_UpdatePA(lastConfluence, swingCount, trailPhase, lastPattern, tpStepCount);

   if(!g_DashIsRunning || haltForToday) return;
   
   // === RSI-Based Smart Exit (กฎเหล็ก: เก็บกำไรเมื่อ RSI สุดรอบ) ===
   if(totalPos > 0) CheckRSI_Exit();

   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);

   // ============================================================
   // 1. Entry Logic: W/M Pattern + Confluence (Zone + PA + RSI)
   // ============================================================
   if (totalPos == 0 && IsInSession() && IsSpreadOK() && IsNewBar()) {
      // [FIX#1] ป้องกันสัญญาณซ้ำซ้อนในแท่งเทียนเดียวกัน
      int currentBar = iBars(_Symbol, EntryTF);
      if(currentBar == lastSignalBar) return;
      // อัพเดท Swing Points
      FindSwingPoints();
      
      // === VISUAL: ลบเส้นเก่า + วาด Zone/Fibo/Trendline ใหม่ ===
      CleanupVisualObjects();
      DrawAllDetectedZones();
      DrawCurrentFibo();
      DrawTrendLines();
      
      double slPrice = 0, tpPrice = 0;
      
      // --- ตรวจหา W Pattern (W CF ยกโล = BUY) ---
      if(DetectW_Pattern(slPrice, tpPrice)) {
         int confluence = CalculateConfluence(1);
         
         // ต้องได้ Confluence >= 4 (จาก 10) จึงจะเข้าเทรด
         // Zone(2) + PA(2) = 4 เป็นขั้นต่ำ
         if(confluence >= 4) {
            double slPips = (ask - slPrice) / pointUnit;
            double lotToOpen = CalculateDynamicLot(slPips, RiskPercent);
            
            string comment = GetOrderComment(StringFormat("W-Buy CF:%d RSI:%.0f", confluence, rsiNow));
            if(trade.Buy(lotToOpen, _Symbol, ask, slPrice, tpPrice, comment)) {
               Print("✅ PA Bot BUY: W CF ยกโล | Confluence=", confluence, 
                     " | SL=", DoubleToString(slPips,1), "pip | RSI=", DoubleToString(rsiNow,1));
               DrawPatternMarker("PA_W_" + IntegerToString((int)TimeCurrent()), TimeCurrent(), ask, 1, "W CF");
               lastSignalBar = currentBar; // [FIX#1]
               swingCount = 1;
               lastPattern = "W CF";
               lastConfluence = confluence;
            }
         }
      }
      
      // --- ตรวจหา M Pattern (M CF ไฮต่ำ = SELL) ---
      if(totalPos == 0 && DetectM_Pattern(slPrice, tpPrice)) {
         int confluence = CalculateConfluence(-1);
         
         if(confluence >= 4) {
            double slPips = (slPrice - bid) / pointUnit;
            double lotToOpen = CalculateDynamicLot(slPips, RiskPercent);
            
            string comment = GetOrderComment(StringFormat("M-Sell CF:%d RSI:%.0f", confluence, rsiNow));
            if(trade.Sell(lotToOpen, _Symbol, bid, slPrice, tpPrice, comment)) {
               Print("✅ PA Bot SELL: M CF ไฮต่ำ | Confluence=", confluence,
                     " | SL=", DoubleToString(slPips,1), "pip | RSI=", DoubleToString(rsiNow,1));
               DrawPatternMarker("PA_M_" + IntegerToString((int)TimeCurrent()), TimeCurrent(), bid, -1, "M CF");
               lastSignalBar = currentBar; // [FIX#1]
               swingCount = 1;
               lastPattern = "M CF";
               lastConfluence = confluence;
            }
         }
      }
   }

   // ============================================================
   // 2. Pyramiding: เติมไม้เมื่อโครงสร้างยืนยันซ้ำ (M CF / W CF ซ้อน)
   // ============================================================
   if (totalPos > 0 && totalPos < MaxPositions && IsInSession() && IsSpreadOK() && IsNewBar()) {
      FindSwingPoints();
      
      if (posBuy > 0 && ask >= lastBuyPrice + (ScaleStepPips * pointUnit)) {
          // [FIX#5] เติมไม้ Buy: PA + RSI ไม่ OVB + Confluence ≥ 2 + Swing ≤ 5
          if(swingCount >= 5) { /* Delta Swing จบ ไม่เติมไม้ */ }
          else {
             int scaleCF = CalculateConfluence(1);
             if(IsPA_BuyCandle() && rsiNow < RSI_OVB - 5 && scaleCF >= 2) {
                 double sl = bid - ((ScaleStepPips*2) * pointUnit);
                 double tp = ask + (InitialTPPips * pointUnit);
                 double scaleLot = CalculateScaleLot(lastBuyLot);
                 trade.Buy(scaleLot, _Symbol, 0, sl, tp, GetOrderComment(StringFormat("Scale BUY #%d CF:%d SW:%d", totalPos+1, scaleCF, swingCount+1)));
                 swingCount++;
                 Print("📈 PA Bot Scale BUY #", totalPos+1, " | Swing:", swingCount, " | CF:", scaleCF);
             }
          }
      }
      else if (posSell > 0 && bid <= lastSellPrice - (ScaleStepPips * pointUnit)) {
          // [FIX#5] เติมไม้ Sell: PA + RSI ไม่ OVS + Confluence ≥ 2 + Swing ≤ 5
          if(swingCount >= 5) { /* Delta Swing จบ ไม่เติมไม้ */ }
          else {
             int scaleCF = CalculateConfluence(-1);
             if(IsPA_SellCandle() && rsiNow > RSI_OVS + 5 && scaleCF >= 2) {
                 double sl = ask + ((ScaleStepPips*2) * pointUnit);
                 double tp = bid - (InitialTPPips * pointUnit);
                 double scaleLot = CalculateScaleLot(lastSellLot);
                 trade.Sell(scaleLot, _Symbol, 0, sl, tp, GetOrderComment(StringFormat("Scale SELL #%d CF:%d SW:%d", totalPos+1, scaleCF, swingCount+1)));
                 swingCount++;
                 Print("📉 PA Bot Scale SELL #", totalPos+1, " | Swing:", swingCount, " | CF:", scaleCF);
             }
          }
      }
   }

   // ============================================================
   // 3. Advanced Trailing SL & TP System
   // ---
   // Phase 0: ไม่ทำอะไร (ยังไม่ถึง breakeven)
   // Phase 1: BREAKEVEN — ย้าย SL มาจุดเปิด + ล็อคกำไรเล็กน้อย
   // Phase 2: LOCK PROFIT — SL ขยับตามทุกครั้งที่ TP ถูกเลื่อน
   // Phase 3: SWING TRAIL — SL ยึด Swing Low/High ล่าสุด
   // + Trailing TP: เลื่อน TP ไปข้างหน้าเมื่อราคาไหลลื่น
   // + Partial Close: ปิด 50% เมื่อถึง TP milestone แรก
   // ============================================================
   if(IsNewBar() && totalPos > 0) {
      // เตรียมข้อมูล Swing สำหรับ Structure-based Trail
      double tbLow  = iLow(_Symbol, EntryTF, iLowest(_Symbol, EntryTF, MODE_LOW, TrailingBars, 1));
      double tbHigh = iHigh(_Symbol, EntryTF, iHighest(_Symbol, EntryTF, MODE_HIGH, TrailingBars, 1));
      double trailMinGapPts = TrailMinGap * pointUnit;

      for(int i = PositionsTotal()-1; i >= 0; i--) {
         if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == MagicNumber) {
            ulong  ticket = PositionGetInteger(POSITION_TICKET);
            double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
            double slPrice   = PositionGetDouble(POSITION_SL);
            double tpPrice   = PositionGetDouble(POSITION_TP);
            double volume    = PositionGetDouble(POSITION_VOLUME);
            ENUM_POSITION_TYPE pType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
            
            double newSL = slPrice;
            double newTP = tpPrice;
            double profitPips = 0;
            
            // ================================================================
            // BUY POSITION
            // ================================================================
            if(pType == POSITION_TYPE_BUY) {
               profitPips = (bid - openPrice) / pointUnit;
               
               // --- Phase 1: BREAKEVEN ---
               // เงื่อนไข: ราคาวิ่งกำไร >= BreakevenPips
               // การทำงาน: ย้าย SL มาที่ จุดเปิด + LockProfitPips
               if(profitPips >= BreakevenPips && trailPhase < 1) {
                  double beSL = openPrice + (LockProfitPips * pointUnit);
                  if(slPrice < beSL) {
                     newSL = beSL;
                     trailPhase = 1;
                     Print("🔒 Phase 1 BREAKEVEN: SL → ", DoubleToString(newSL, (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS)),
                           " | Lock +", DoubleToString(LockProfitPips,1), "pip");
                  }
               }
               
               // --- Partial Close: ปิด 50% เมื่อได้กำไร >= BreakevenPips * 2 ---
               // เงื่อนไข: กำไร >= 40 pip (BE*2) + ยังไม่เคย partial close
               if(UsePartialClose && !partialClosed && profitPips >= BreakevenPips * 2.0) {
                  double closeVol = NormalizeDouble(volume * (PartialClosePct / 100.0), 2);
                  double vStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
                  closeVol = MathMax(SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN), MathFloor(closeVol / vStep) * vStep);
                  if(closeVol < volume) {
                     trade.PositionClosePartial(ticket, closeVol);
                     partialClosed = true;
                     Print("💰 Partial Close ", DoubleToString(PartialClosePct,0), "% @ +",
                           DoubleToString(profitPips,1), "pip | Closed: ", DoubleToString(closeVol,2), " lots");
                  }
               }
               
               // --- Phase 2: TRAILING TP + SL STEP ---
               // เงื่อนไข: ทุกๆ TP_TrailStepPips (30 pip) ที่ราคาวิ่งเพิ่ม
               // การทำงาน: ขยับ TP ไปข้างหน้า + ขยับ SL ตาม
               if(UseTrailingTP && trailPhase >= 1) {
                  // นับว่าราคาวิ่งเกินจุดเลื่อนครั้งถัดไปหรือยัง
                  double nextStepLevel = openPrice + ((tpStepCount + 1) * TP_TrailStepPips * pointUnit);
                  if(bid >= nextStepLevel) {
                     tpStepCount++;
                     trailPhase = 2;
                     
                     // ขยับ TP ไปข้างหน้า
                     newTP = tpPrice + (TP_ExtendPips * pointUnit);
                     
                     // ขยับ SL ตาม (ล็อคกำไรเพิ่มทุก step)
                     double stepSL = openPrice + (tpStepCount * SL_StepUpPips * pointUnit);
                     if(stepSL > newSL) newSL = stepSL;
                     
                     Print("📈 Phase 2 TRAIL TP Step#", tpStepCount,
                           " | TP → ", DoubleToString(newTP, (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS)),
                           " | SL → ", DoubleToString(newSL, (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS)),
                           " | Profit: +", DoubleToString(profitPips,1), "pip");
                  }
               }
               
               // --- Phase 3: SWING STRUCTURE TRAIL ---
               // เงื่อนไข: SL ผ่านจุด breakeven แล้ว + มี Swing Low ใหม่
               // การทำงาน: ย้าย SL ไปยัง Swing Low ล่าสุดของ N แท่ง
               if(newSL >= openPrice) {
                  double swingTrailSL = tbLow - (2 * pointUnit);
                  // Swing เป้าใหม่ต้อง: สูงกว่า SL เดิม + ห่างจากราคาพอ
                  if(swingTrailSL > newSL && swingTrailSL < bid - trailMinGapPts) {
                     newSL = swingTrailSL;
                     if(trailPhase < 3) trailPhase = 3;
                     Print("🏗️ Phase 3 SWING TRAIL: SL → Swing Low ",
                           DoubleToString(newSL, (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS)));
                  }
               }
            }
            // ================================================================
            // SELL POSITION
            // ================================================================
            else if(pType == POSITION_TYPE_SELL) {
               profitPips = (openPrice - ask) / pointUnit;
               
               // --- Phase 1: BREAKEVEN ---
               if(profitPips >= BreakevenPips && trailPhase < 1) {
                  double beSL = openPrice - (LockProfitPips * pointUnit);
                  if(slPrice > beSL || slPrice == 0) {
                     newSL = beSL;
                     trailPhase = 1;
                     Print("🔒 Phase 1 BREAKEVEN (SELL): SL → ", DoubleToString(newSL, (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS)));
                  }
               }
               
               // --- Partial Close ---
               if(UsePartialClose && !partialClosed && profitPips >= BreakevenPips * 2.0) {
                  double closeVol = NormalizeDouble(volume * (PartialClosePct / 100.0), 2);
                  double vStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
                  closeVol = MathMax(SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN), MathFloor(closeVol / vStep) * vStep);
                  if(closeVol < volume) {
                     trade.PositionClosePartial(ticket, closeVol);
                     partialClosed = true;
                     Print("💰 Partial Close (SELL) ", DoubleToString(PartialClosePct,0), "% @ +",
                           DoubleToString(profitPips,1), "pip");
                  }
               }
               
               // --- Phase 2: TRAILING TP + SL STEP ---
               if(UseTrailingTP && trailPhase >= 1) {
                  double nextStepLevel = openPrice - ((tpStepCount + 1) * TP_TrailStepPips * pointUnit);
                  if(ask <= nextStepLevel) {
                     tpStepCount++;
                     trailPhase = 2;
                     
                     newTP = tpPrice - (TP_ExtendPips * pointUnit);
                     
                     double stepSL = openPrice - (tpStepCount * SL_StepUpPips * pointUnit);
                     if(stepSL < newSL || newSL == 0) newSL = stepSL;
                     
                     Print("📉 Phase 2 TRAIL TP Step#", tpStepCount, " (SELL)",
                           " | TP → ", DoubleToString(newTP, (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS)),
                           " | SL → ", DoubleToString(newSL, (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS)));
                  }
               }
               
               // --- Phase 3: SWING STRUCTURE TRAIL ---
               if(newSL <= openPrice && newSL > 0) {
                  double swingTrailSL = tbHigh + (2 * pointUnit);
                  if(swingTrailSL < newSL && swingTrailSL > ask + trailMinGapPts) {
                     newSL = swingTrailSL;
                     if(trailPhase < 3) trailPhase = 3;
                     Print("🏗️ Phase 3 SWING TRAIL (SELL): SL → Swing High ",
                           DoubleToString(newSL, (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS)));
                  }
               }
            }
            
            // === Apply SL/TP modification ===
            bool slChanged = (newSL != slPrice && newSL != 0);
            bool tpChanged = (newTP != tpPrice && newTP != 0);
            if(slChanged || tpChanged) {
               double finalSL = slChanged ? newSL : slPrice;
               double finalTP = tpChanged ? newTP : tpPrice;
               if(trade.PositionModify(ticket, finalSL, finalTP)) {
                  if(slChanged) Print("   ↳ SL modified → ", DoubleToString(finalSL, (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS)));
                  if(tpChanged) Print("   ↳ TP modified → ", DoubleToString(finalTP, (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS)));
               }
            }
         }
      }
   }
}
//+------------------------------------------------------------------+
