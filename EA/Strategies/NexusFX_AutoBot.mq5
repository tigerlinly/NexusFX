//+------------------------------------------------------------------+
//|                                              NexusFX_AutoBot.mq5 |
//|                                    Copyright 2026, NexusFX Corp. |
//| Created: 2026-04-01                                              |
//| Updated: 2026-04-08                                              |
//+------------------------------------------------------------------+
#property copyright "NexusFX"
#property link      "https://nexusfx.biz"
#property version   "1.01"
#property strict

#include <Trade\Trade.mqh>
#include "NexusFX_Dashboard.mqh"

enum ENUM_TRADE_MODE
{
   MODE_CONFIDENCE_SCORE = 0, // สกอร์รวม (Confidence Score)
   MODE_EMA_ONLY = 1,         // ตัดกันของ EMA เท่านั้น
   MODE_RSI_ONLY = 2,         // RSI เท่านั้น
   MODE_MACD_ONLY = 3,        // ตัดกันของ MACD เท่านั้น
   MODE_PATTERN_ONLY = 4,     // แท่งเทียนกลับตัว (Pattern) อย่างเดียว
   MODE_BREAKOUT_ONLY = 5,    // Breakout H1 อย่างเดียว
   MODE_BREAKOUT_PATTERN = 6, // Breakout H1 + แท่งเทียนกลับตัว
   MODE_AUTO_DYNAMIC = 7      // AUTO: AI เลือกกลยุทธ์ตามสภาพตลาดอัตโนมัติ
};

//--- Input parameters
input group    "=== Strategy Mode ==="
input ENUM_TRADE_MODE TradeMode = MODE_CONFIDENCE_SCORE; // กลยุทธ์การเทรด

input group    "=== Risk Management ==="
input double   RiskPercent      = 1.0;        // ความเสี่ยงต่อออเดอร์ (% ของทุน)
input double   FixedLotSize     = 0.0;        // Lot คงที่ (0 = ใช้ Risk%)
input int      MaxPositions     = 100;        // จำนวนไม้สูงสุดที่เปิดค้างได้

input group    "=== Sniper Burst Mode ==="
input bool     EnableBurstMode   = true;      // สาดกระสุนรัวไม้ (แทนที่การออก 1 ไม้ใหญ่)
input double   BurstLotSize      = 0.01;      // ขนาด Lot ต่อไม้ที่ใช้ยิงรัว
input int      BurstNormalCount  = 5;         // ยิงกี่ไม้ ถ้ายืนยันสัญญาณปกติ (Score < 70)
input int      BurstStrongCount  = 5;         // ยิงกี่ไม้ ถ้าเข้าจุดสวยได้เปรียบ (Score 70-89)
input int      BurstExtremeCount = 5;         // ยิงกี่ไม้ ถ้าโคตรได้เปรียบ (Score >= 90)

input group    "=== Entry & Exit ==="
input int      StopLossPoints   = 5000;       // Stop Loss (Points)
input int      TakeProfitPoints = 10000;      // Take Profit (Points)
input int      TrailingStop     = 2000;       // Trailing Stop (Points, 0=ปิด)
input int      TrailingStart    = 2500;       // Trailing Start (Points, เริ่มทำงานเมื่อไหร่)
input int      TrailingStep     = 500;        // Trailing Step (Points)
input bool     TrailTP          = true;       // เลื่อน TP หนีราคาด้วย (Runaway TP)
input int      BreakevenPoints  = 1500;       // Breakeven Trigger (Points, 0=ปิด)
input int      BreakevenOffset  = 200;        // Breakeven SL Offset (Points, เผื่อ spread & comm)
input bool     CloseOnOpposite  = true;       // ปิดไม้อัตโนมัติเมื่อสัญญาณ EMA/MACD กลับด้าน

input group    "=== EMA Indicators ==="
input int      FastEMA          = 9;          // EMA เร็ว
input int      SlowEMA          = 21;         // EMA ช้า
input int      EMA200Period     = 200;        // EMA 200 (Trend Filter)
input bool     UseEMA200Filter  = false;      // ใช้ EMA200 กรอง Trend (ต้องมี 200 แท่ง)

input group    "=== RSI ==="
input int      RSI_Period       = 14;         // RSI Period
input double   RSI_BuyLevel     = 40;         // RSI ต่ำกว่านี้สนับสนุน Buy
input double   RSI_SellLevel    = 60;         // RSI สูงกว่านี้สนับสนุน Sell

input group    "=== MACD ==="
input bool     UseMACD          = true;       // ใช้ MACD ประกอบการตัดสินใจ
input int      MACD_Fast        = 12;         // MACD Fast EMA
input int      MACD_Slow        = 26;         // MACD Slow EMA
input int      MACD_Signal      = 9;          // MACD Signal

input group    "=== Bollinger Bands ==="
input bool     UseBB            = true;       // ใช้ Bollinger Bands
input int      BB_Period        = 20;         // BB Period
input double   BB_Deviation     = 2.0;        // BB Deviation

input group    "=== Candlestick Patterns ==="
input bool     UsePatterns      = true;       // ใช้ Candlestick Patterns
input double   EngulfMinRatio   = 1.2;        // Engulfing: Body ปัจจุบัน/ก่อนหน้า ขั้นต่ำ
input double   PinBarWickRatio  = 0.6;        // Pin Bar: Wick >=60% ของ Range
input double   DojiBodyRatio    = 0.05;       // Doji: Body < 5% ของ Range

input group    "=== Multi-Timeframe ==="
input bool     UseMTF           = false;      // ใช้ Multi-Timeframe Confirmation
input ENUM_TIMEFRAMES  HTF_Period = PERIOD_H1; // Higher Timeframe

input group    "=== Breakout Strategy ==="
input bool     UseBreakout        = true;       // ใช้กลยุทธ์ Breakout
input ENUM_TIMEFRAMES BoxTimeframe = PERIOD_CURRENT;  // Timeframe สำหรับวาดกรอบ
input int      BreakoutPeriod     = 3;          // จำนวนแท่งเทียนที่ใช้สร้างกรอบ
input int      BreakoutBufferPips = 2;          // ระยะเผื่อทะลุกรอบ (กรอง False Break)
input ENUM_TIMEFRAMES BreakoutTrendTF = PERIOD_CURRENT; // Timeframe สำหรับดูเทรนด์
input int      BreakoutTrendMA    = 50;         // เส้น MA บอกเทรนด์

input group    "=== Session Filter ==="
input bool     UseSessionFilter = false;      // กรองเวลาเทรด
input int      SessionStart1    = 8;          // London Open (GMT hour)
input int      SessionEnd1      = 12;         // London Close
input int      SessionStart2    = 13;         // NY Open (GMT hour)
input int      SessionEnd2      = 17;         // NY Close
input int      GMT_Offset       = 0;          // Server GMT offset

input group    "=== Confidence Scoring ==="
input int      MinConfidence    = 30;         // คะแนนขั้นต่ำที่จะเปิดออเดอร์ (0-100)
input int      Weight_Breakout  = 30;         // น้ำหนัก Breakout H1
input int      Weight_EMACross  = 30;         // น้ำหนัก EMA Cross
input int      Weight_RSI       = 20;         // น้ำหนัก RSI
input int      Weight_MACD      = 20;         // น้ำหนัก MACD
input int      Weight_BB        = 15;         // น้ำหนัก Bollinger Bands
input int      Weight_Pattern   = 15;         // น้ำหนัก Candlestick Pattern

input group    "=== Display ==="
input bool     DrawBreakoutBoxOverlay = true; // วาดกรอบ Breakout H1 บนกราฟ
input color    BoxColor         = C'40,50,70';// สีของกรอบ Breakout
input color    WarnColor        = C'255,170,50';

input group    "=== System ==="
input string   RunMagic         = "AutoBot";  // EA Name for Comment (fallback)
input ulong    MagicNumber      = 999000;     // Base Magic Number (e.g. 999000)

input group    "=== Web Bridge Sync ==="
input string   API_URL          = "http://203.151.66.51:4000"; // Web Service URL
input string   BRIDGE_TOKEN     = "";                      // EA Bridge Token
input int      SyncDelayMS      = 3000;                    // Sync frequency (ms)


//--- Global variables
CTrade         trade;
int            handleFastEMA, handleSlowEMA, handleEMA200;
int            handleRSI, handleMACD, handleBB;
int            handleHTF_EMA9, handleHTF_EMA21;
int            handleBreakoutTrendMA;
double         emaFastBuf[], emaSlowBuf[], ema200Buf[], rsiBuf[];
double         macdMainBuf[], macdSignalBuf[];
double         bbUpperBuf[], bbMiddleBuf[], bbLowerBuf[];
double         htfEma9Buf[], htfEma21Buf[];
double         brkTrendMaBuf[];
double         g_pointUnit = 0;

// Dashboard state
string         g_signalText     = "WAITING";
color          g_signalColor;
string         g_patternText    = "-";
string         g_trendText      = "-";
string         g_sessionText    = "-";
double         g_calcLot        = 0;
string         g_lotMethod      = "";
int            g_myPositions    = 0;
double         g_totalProfit    = 0;
datetime       g_lastSignalTime = 0;
string         g_lastAction     = "";
int            g_buyScore       = 0;
int            g_sellScore      = 0;
string         g_scoreDetails   = "";
string         g_macdText       = "-";
string         g_bbText         = "-";
string         g_htfText        = "-";
string         g_brkText        = "-";
bool           g_inSession      = true;
bool           g_breakevenDone[];

// Indicator values
double g_emaFast=0, g_emaSlow=0, g_ema200=0, g_rsi=0;
double g_macdMain=0, g_macdSignal=0, g_macdHist=0;
double g_bbUpper=0, g_bbMiddle=0, g_bbLower=0;
double g_highestH1=0, g_lowestH1=0;

#define PREFIX "NXBot3_"
ulong          g_magic          = 0;

//+------------------------------------------------------------------+
int OnInit()
{
   ulong tfOffset = (ulong)PeriodSeconds(_Period) / 60;
   g_magic = MagicNumber + tfOffset;
   
   trade.SetExpertMagicNumber(g_magic);
   g_signalColor = NeutralColor;
   
   // --- Indicator Handles ---
   handleFastEMA = iMA(_Symbol, PERIOD_CURRENT, FastEMA, 0, MODE_EMA, PRICE_CLOSE);
   handleSlowEMA = iMA(_Symbol, PERIOD_CURRENT, SlowEMA, 0, MODE_EMA, PRICE_CLOSE);
   handleRSI     = iRSI(_Symbol, PERIOD_CURRENT, RSI_Period, PRICE_CLOSE);
   
   if(handleFastEMA==INVALID_HANDLE || handleSlowEMA==INVALID_HANDLE || handleRSI==INVALID_HANDLE)
   { Print("❌ Error creating basic indicator handles"); return INIT_FAILED; }
   
   if(UseEMA200Filter)
   {
      handleEMA200 = iMA(_Symbol, PERIOD_CURRENT, EMA200Period, 0, MODE_EMA, PRICE_CLOSE);
      if(handleEMA200==INVALID_HANDLE) { Print("❌ EMA200 handle error"); return INIT_FAILED; }
   }
   
   if(UseMACD)
   {
      handleMACD = iMACD(_Symbol, PERIOD_CURRENT, MACD_Fast, MACD_Slow, MACD_Signal, PRICE_CLOSE);
      if(handleMACD==INVALID_HANDLE) { Print("❌ MACD handle error"); return INIT_FAILED; }
   }
   
   if(UseBB)
   {
      handleBB = iBands(_Symbol, PERIOD_CURRENT, BB_Period, 0, BB_Deviation, PRICE_CLOSE);
      if(handleBB==INVALID_HANDLE) { Print("❌ BB handle error"); return INIT_FAILED; }
   }
   
   if(UseMTF)
   {
      handleHTF_EMA9  = iMA(_Symbol, HTF_Period, FastEMA, 0, MODE_EMA, PRICE_CLOSE);
      handleHTF_EMA21 = iMA(_Symbol, HTF_Period, SlowEMA, 0, MODE_EMA, PRICE_CLOSE);
      if(handleHTF_EMA9==INVALID_HANDLE || handleHTF_EMA21==INVALID_HANDLE)
      { Print("❌ HTF handle error"); return INIT_FAILED; }
   }
   
   g_pointUnit = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   if(SymbolInfoInteger(_Symbol, SYMBOL_DIGITS) == 5 || SymbolInfoInteger(_Symbol, SYMBOL_DIGITS) == 3) {
       g_pointUnit *= 10;
   }
   
   if(UseBreakout)
   {
      handleBreakoutTrendMA = iMA(_Symbol, BreakoutTrendTF, BreakoutTrendMA, 0, MODE_SMA, PRICE_CLOSE);
      if(handleBreakoutTrendMA==INVALID_HANDLE) { Print("❌ Breakout Trend MA error"); return INIT_FAILED; }
   }
   
   // Set as series
   ArraySetAsSeries(emaFastBuf, true);   ArraySetAsSeries(emaSlowBuf, true);
   ArraySetAsSeries(ema200Buf, true);    ArraySetAsSeries(rsiBuf, true);
   ArraySetAsSeries(macdMainBuf, true);  ArraySetAsSeries(macdSignalBuf, true);
   ArraySetAsSeries(bbUpperBuf, true);   ArraySetAsSeries(bbMiddleBuf, true);
   ArraySetAsSeries(bbLowerBuf, true);   ArraySetAsSeries(htfEma9Buf, true);
   ArraySetAsSeries(htfEma21Buf, true);
   ArraySetAsSeries(brkTrendMaBuf, true);
   
   DASH_PREFIX = "NXAUT_";
   string trendStr = EnumToString(HTF_Period);
   if(UseBreakout) trendStr = EnumToString(BreakoutTrendTF);
   Dash_CreatePanel("NexusFX AutoBot", g_magic, EnumToString((ENUM_TIMEFRAMES)_Period), trendStr);
   
   if (BRIDGE_TOKEN != "") {
      EventSetMillisecondTimer(SyncDelayMS);
      Print("⚡ NexusFX AutoBot Bridge Enabled. Sync every ", SyncDelayMS/1000.0, "s.");
   }
   
   Print("⚡ NexusFX AutoBot v3.0 | Auto-Generated Magic: ", g_magic, " (Base: ", MagicNumber, ")");
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   IndicatorRelease(handleFastEMA);   IndicatorRelease(handleSlowEMA);
   IndicatorRelease(handleRSI);
   if(UseEMA200Filter) IndicatorRelease(handleEMA200);
   if(UseMACD)   IndicatorRelease(handleMACD);
   if(UseBB)     IndicatorRelease(handleBB);
   if(UseMTF)  { IndicatorRelease(handleHTF_EMA9); IndicatorRelease(handleHTF_EMA21); }
   if(UseBreakout) IndicatorRelease(handleBreakoutTrendMA);
   if(BRIDGE_TOKEN != "") EventKillTimer();
   Dash_DeletePanel();
   if(ObjectFind(0, PREFIX+"BrkBox") >= 0) ObjectDelete(0, PREFIX+"BrkBox");
}

//+------------------------------------------------------------------+
void OnTick()
{
   UpdateIndicators();
   CountMyPositions();
   
   // Breakeven management
   if(BreakevenPoints > 0 && g_myPositions > 0)
      ManageBreakeven();
   
   // Trailing stop management
   if(TrailingStop > 0 && g_myPositions > 0)
      ManageTrailingStop();
      
   // Close Opposite Signal
   if(CloseOnOpposite && g_myPositions > 0)
      CheckExitSignal();
   
   // Session check
   g_inSession = CheckSession();
   
   // Entry
   if(g_myPositions < MaxPositions && g_inSession && g_DashIsRunning)
      CheckEntrySignal();
   else if(!g_inSession)
   {
      g_signalText = "⏸ OUTSIDE SESSION";
      g_signalColor = WarnColor;
   }
   
   Dash_UpdatePanel(g_signalText, g_signalColor, g_myPositions, g_totalProfit);
}

//+------------------------------------------------------------------+
//| TIMER EVENT FOR SYNC                                             |
//+------------------------------------------------------------------+
void OnTimer()
{
   if (BRIDGE_TOKEN != "")
   {
      SendSyncData();
   }
}


//+------------------------------------------------------------------+
//| UPDATE INDICATORS                                                |
//+------------------------------------------------------------------+
void UpdateIndicators()
{
   if(CopyBuffer(handleFastEMA, 0, 1, 3, emaFastBuf) <= 0) return;
   if(CopyBuffer(handleSlowEMA, 0, 1, 3, emaSlowBuf) <= 0) return;
   if(CopyBuffer(handleRSI, 0, 1, 2, rsiBuf) <= 0) return;
   
   g_emaFast = emaFastBuf[0];
   g_emaSlow = emaSlowBuf[0];
   g_rsi     = rsiBuf[0];
   
   // EMA200
   if(UseEMA200Filter && CopyBuffer(handleEMA200, 0, 1, 2, ema200Buf) > 0)
      g_ema200 = ema200Buf[0];
   
   // MACD
   if(UseMACD)
   {
      if(CopyBuffer(handleMACD, 0, 1, 3, macdMainBuf) > 0 &&
         CopyBuffer(handleMACD, 1, 1, 3, macdSignalBuf) > 0)
      {
         g_macdMain   = macdMainBuf[0];
         g_macdSignal = macdSignalBuf[0];
         g_macdHist   = g_macdMain - g_macdSignal;
         
         bool macdCrossUp   = (macdMainBuf[1] < macdSignalBuf[1] && macdMainBuf[0] > macdSignalBuf[0]);
         bool macdCrossDown = (macdMainBuf[1] > macdSignalBuf[1] && macdMainBuf[0] < macdSignalBuf[0]);
         
         if(macdCrossUp)       g_macdText = "▲ Cross UP";
         else if(macdCrossDown) g_macdText = "▼ Cross DOWN";
         else if(g_macdHist > 0) g_macdText = "Bullish";
         else                    g_macdText = "Bearish";
      }
   }
   
   // Bollinger Bands
   if(UseBB)
   {
      if(CopyBuffer(handleBB, 1, 1, 2, bbUpperBuf) > 0 &&
         CopyBuffer(handleBB, 0, 1, 2, bbMiddleBuf) > 0 &&
         CopyBuffer(handleBB, 2, 1, 2, bbLowerBuf) > 0)
      {
         g_bbUpper  = bbUpperBuf[0];
         g_bbMiddle = bbMiddleBuf[0];
         g_bbLower  = bbLowerBuf[0];
         
         double price = SymbolInfoDouble(_Symbol, SYMBOL_BID);
         double bw = (g_bbUpper - g_bbLower) / g_bbMiddle * 100;
         
         if(price >= g_bbUpper)     g_bbText = StringFormat("OVERBOUGHT (BW:%.1f%%)", bw);
         else if(price <= g_bbLower) g_bbText = StringFormat("OVERSOLD (BW:%.1f%%)", bw);
         else if(bw < 1.5)           g_bbText = StringFormat("SQUEEZE! (BW:%.1f%%)", bw);
         else                        g_bbText = StringFormat("Normal (BW:%.1f%%)", bw);
      }
   }
   
   // Multi-Timeframe
   if(UseMTF)
   {
      if(CopyBuffer(handleHTF_EMA9, 0, 1, 2, htfEma9Buf) > 0 &&
         CopyBuffer(handleHTF_EMA21, 0, 1, 2, htfEma21Buf) > 0)
      {
         if(htfEma9Buf[0] > htfEma21Buf[0])
            g_htfText = "▲ HTF Bullish";
         else
            g_htfText = "▼ HTF Bearish";
      }
   }
   
   // Breakout Strategy
   if(UseBreakout)
   {
      double htfHigh[], htfLow[];
      if(CopyHigh(_Symbol, BoxTimeframe, 1, BreakoutPeriod, htfHigh) == BreakoutPeriod &&
         CopyLow(_Symbol, BoxTimeframe, 1, BreakoutPeriod, htfLow) == BreakoutPeriod)
      {
         g_highestH1 = htfHigh[ArrayMaximum(htfHigh, 0, WHOLE_ARRAY)];
         g_lowestH1  = htfLow[ArrayMinimum(htfLow, 0, WHOLE_ARRAY)];
         
         double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
         double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
         double bufferOffset = BreakoutBufferPips * g_pointUnit;
         
         if(ask > (g_highestH1 + bufferOffset)) g_brkText = "▲ Break UP";
         else if(bid < (g_lowestH1 - bufferOffset)) g_brkText = "▼ Break DOWN";
         else g_brkText = "Inside Range";
         
         if(DrawBreakoutBoxOverlay)
         {
            datetime t1 = iTime(_Symbol, BoxTimeframe, BreakoutPeriod);
            datetime t2 = iTime(_Symbol, BoxTimeframe, 0) + PeriodSeconds(BoxTimeframe);
            DrawBreakoutBox(PREFIX+"BrkBox", t1, g_highestH1, t2, g_lowestH1);
         }
      }
      else { g_brkText = "No Data"; g_highestH1 = 0; g_lowestH1 = 0; }
   }
   
   // Trend
   if(UseEMA200Filter && g_ema200 > 0)
   {
      double price = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      if(price > g_ema200 && g_emaFast > g_emaSlow)
         g_trendText = "▲ STRONG UP";
      else if(price < g_ema200 && g_emaFast < g_emaSlow)
         g_trendText = "▼ STRONG DOWN";
      else if(price > g_ema200)
         g_trendText = "▲ UPTREND";
      else
         g_trendText = "▼ DOWNTREND";
   }
   else
   {
      g_trendText = (g_emaFast > g_emaSlow) ? "▲ UPTREND" : "▼ DOWNTREND";
   }
}

//+------------------------------------------------------------------+
//| SESSION FILTER                                                   |
//+------------------------------------------------------------------+
bool CheckSession()
{
   if(!UseSessionFilter) { g_sessionText = "Always On"; return true; }
   
   MqlDateTime dt;
   TimeCurrent(dt);
   int h = (dt.hour + GMT_Offset + 24) % 24;
   
   bool inLondon = (h >= SessionStart1 && h < SessionEnd1);
   bool inNY     = (h >= SessionStart2 && h < SessionEnd2);
   
   if(inLondon)    g_sessionText = StringFormat("🟢 London (%02d:00)", h);
   else if(inNY)   g_sessionText = StringFormat("🟢 New York (%02d:00)", h);
   else            g_sessionText = StringFormat("🔴 Closed (%02d:00)", h);
   
   return (inLondon || inNY);
}

//+------------------------------------------------------------------+
//| CANDLESTICK PATTERNS                                             |
//+------------------------------------------------------------------+
string DetectPatterns(int &buyScore, int &sellScore)
{
   if(!UsePatterns) return "-";
   
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   if(CopyRates(_Symbol, PERIOD_CURRENT, 1, 3, rates) < 3) return "No Data";
   
   string patterns = "";
   
   // --- Engulfing ---
   double bodyPrev = MathAbs(rates[1].close - rates[1].open);
   double bodyCurr = MathAbs(rates[0].close - rates[0].open);
   
   if(bodyPrev > 0 && bodyCurr / bodyPrev >= EngulfMinRatio)
   {
      // Bullish Engulfing: prev red, curr green, curr body covers prev body
      if(rates[1].close < rates[1].open && rates[0].close > rates[0].open &&
         rates[0].close > rates[1].open && rates[0].open < rates[1].close)
      {
         patterns += "Bullish Engulfing ";
         buyScore += Weight_Pattern;
      }
      // Bearish Engulfing
      else if(rates[1].close > rates[1].open && rates[0].close < rates[0].open &&
              rates[0].open > rates[1].close && rates[0].close < rates[1].open)
      {
         patterns += "Bearish Engulfing ";
         sellScore += Weight_Pattern;
      }
   }
   
   // --- Pin Bar (Hammer / Shooting Star) ---
   double range0 = rates[0].high - rates[0].low;
   if(range0 > 0)
   {
      double body0      = MathAbs(rates[0].close - rates[0].open);
      double upperWick0 = rates[0].high - MathMax(rates[0].open, rates[0].close);
      double lowerWick0 = MathMin(rates[0].open, rates[0].close) - rates[0].low;
      
      if(body0 / range0 < 0.33)
      {
         if(lowerWick0 / range0 >= PinBarWickRatio)
         {
            patterns += "Hammer ";
            buyScore += Weight_Pattern;
         }
         else if(upperWick0 / range0 >= PinBarWickRatio)
         {
            patterns += "ShootingStar ";
            sellScore += Weight_Pattern;
         }
      }
      
      // --- Doji ---
      if(body0 / range0 < DojiBodyRatio)
      {
         patterns += "Doji ";
         // Doji = indecision, no directional score
      }
   }
   
   // --- Morning Star / Evening Star (3-candle pattern) ---
   double body2 = MathAbs(rates[2].close - rates[2].open);
   double body1 = MathAbs(rates[1].close - rates[1].open);
   double range1 = rates[1].high - rates[1].low;
   
   if(body2 > 0 && body1 > 0 && range1 > 0)
   {
      bool smallMiddle = (body1 / range1 < 0.3); // Middle candle has small body
      
      // Morning Star: big red → small body → big green
      if(rates[2].close < rates[2].open && smallMiddle && 
         rates[0].close > rates[0].open && bodyCurr > body2 * 0.5)
      {
         patterns += "MorningStar ";
         buyScore += Weight_Pattern;
      }
      // Evening Star: big green → small body → big red
      else if(rates[2].close > rates[2].open && smallMiddle && 
              rates[0].close < rates[0].open && bodyCurr > body2 * 0.5)
      {
         patterns += "EveningStar ";
         sellScore += Weight_Pattern;
      }
   }
   
   if(patterns == "") patterns = "No Pattern";
   return patterns;
}

//+------------------------------------------------------------------+
//| CONFIDENCE SCORING                                               |
//+------------------------------------------------------------------+
void CalculateConfidence(int &buyScore, int &sellScore, string &details)
{
   buyScore  = 0;
   sellScore = 0;
   details   = "";
   
   // 1. EMA Cross
   bool emaCrossUp   = (emaFastBuf[1] < emaSlowBuf[1] && emaFastBuf[0] > emaSlowBuf[0]);
   bool emaCrossDown = (emaFastBuf[1] > emaSlowBuf[1] && emaFastBuf[0] < emaSlowBuf[0]);
   bool emaAbove     = (g_emaFast > g_emaSlow);
   
   if(emaCrossUp)   { buyScore  += Weight_EMACross; details += "EMA↑ "; }
   else if(emaCrossDown) { sellScore += Weight_EMACross; details += "EMA↓ "; }
   else if(emaAbove) { buyScore  += Weight_EMACross / 3; details += "EMA> "; } // partial score for alignment
   else              { sellScore += Weight_EMACross / 3; details += "EMA< "; }
   
   // 2. RSI
   if(g_rsi < RSI_BuyLevel)       { buyScore  += Weight_RSI; details += StringFormat("RSI%.0f↑ ", g_rsi); }
   else if(g_rsi > RSI_SellLevel) { sellScore += Weight_RSI; details += StringFormat("RSI%.0f↓ ", g_rsi); }
   else { details += StringFormat("RSI%.0f○ ", g_rsi); }
   
   // 3. MACD
   if(UseMACD)
   {
      bool macdCrossUp   = (macdMainBuf[1] < macdSignalBuf[1] && macdMainBuf[0] > macdSignalBuf[0]);
      bool macdCrossDown = (macdMainBuf[1] > macdSignalBuf[1] && macdMainBuf[0] < macdSignalBuf[0]);
      
      if(macdCrossUp || g_macdHist > 0)
      { 
         int pts = macdCrossUp ? Weight_MACD : Weight_MACD / 2;
         buyScore += pts; 
         details += (macdCrossUp ? "MACD↑ " : "MACDh+ "); 
      }
      else if(macdCrossDown || g_macdHist < 0) 
      { 
         int pts = macdCrossDown ? Weight_MACD : Weight_MACD / 2;
         sellScore += pts; 
         details += (macdCrossDown ? "MACD↓ " : "MACDh- "); 
      }
   }
   
   // 4. Bollinger Bands
   if(UseBB)
   {
      double price = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      if(price <= g_bbLower)      { buyScore  += Weight_BB; details += "BB↑ "; }
      else if(price >= g_bbUpper) { sellScore += Weight_BB; details += "BB↓ "; }
      else
      {
         // Partial score if near band
         double range = g_bbUpper - g_bbLower;
         if(range > 0)
         {
            double pctB = (price - g_bbLower) / range;
            if(pctB < 0.2)      { buyScore  += Weight_BB / 2; details += "BBlow "; }
            else if(pctB > 0.8) { sellScore += Weight_BB / 2; details += "BBhi "; }
         }
      }
   }
   
   // 5. Candlestick Patterns
   string pat = DetectPatterns(buyScore, sellScore);
   g_patternText = pat;
   if(pat != "No Pattern" && pat != "No Data" && pat != "-")
      details += pat;
   
   // 6. EMA200 Trend Filter (bonus/penalty)
   if(UseEMA200Filter && g_ema200 > 0)
   {
      double price = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      if(price > g_ema200) { buyScore += 5; }
      else                 { sellScore += 5; }
   }
   
   // 7. Multi-Timeframe Confirmation (bonus/penalty)
   if(UseMTF && ArraySize(htfEma9Buf) > 0)
   {
      if(htfEma9Buf[0] > htfEma21Buf[0]) { buyScore  += 10; details += "HTF↑ "; }
      else                                { sellScore += 10; details += "HTF↓ "; }
   }
   
   // 8. Breakout Strategy (with Trend Filter & Buffer)
   if(UseBreakout && g_highestH1 > 0 && g_lowestH1 > 0)
   {
      double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      double bufferOffset = BreakoutBufferPips * g_pointUnit;
      
      int trend = 0;
      if(CopyBuffer(handleBreakoutTrendMA, 0, 0, 1, brkTrendMaBuf) > 0)
      {
         double price = SymbolInfoDouble(_Symbol, SYMBOL_BID);
         if(price > brkTrendMaBuf[0]) trend = 1;
         else if(price < brkTrendMaBuf[0]) trend = -1;
      }
      
      if(ask > (g_highestH1 + bufferOffset) && trend >= 0) 
      { buyScore += Weight_Breakout; details += "BrkUP "; }
      else if(bid < (g_lowestH1 - bufferOffset) && trend <= 0) 
      { sellScore += Weight_Breakout; details += "BrkDN "; }
   }
}

//+------------------------------------------------------------------+
//| COUNT MY POSITIONS                                               |
//+------------------------------------------------------------------+
void CountMyPositions()
{
   g_myPositions = 0;
   g_totalProfit = 0;
   
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == g_magic)
      {
         g_myPositions++;
         g_totalProfit += PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
      }
   }
}

//+------------------------------------------------------------------+
//| CALCULATE LOT SIZE                                               |
//+------------------------------------------------------------------+
double CalculateLotSize()
{
   if(FixedLotSize > 0)
   { g_lotMethod = "FIXED"; g_calcLot = FixedLotSize; return FixedLotSize; }
   
   g_lotMethod = StringFormat("RISK %.1f%%", RiskPercent);
   
   double balance    = AccountInfoDouble(ACCOUNT_BALANCE);
   double riskAmount = balance * RiskPercent / 100.0;
   double tickValue  = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   double tickSize   = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   double point      = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   double minLot     = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double maxLot     = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   double lotStep    = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   
   if(tickValue == 0 || tickSize == 0 || StopLossPoints == 0)
   { g_calcLot = minLot; return minLot; }
   
   double valuePerPoint = tickValue / tickSize * point;
   double calcLot = riskAmount / (StopLossPoints * valuePerPoint);
   
   calcLot = MathFloor(calcLot / lotStep) * lotStep;
   calcLot = MathMax(calcLot, minLot);
   calcLot = MathMin(calcLot, maxLot);
   
   g_calcLot = NormalizeDouble(calcLot, 2);
   return g_calcLot;
}

//+------------------------------------------------------------------+
//| GET ORDER COMMENT                                                |
//+------------------------------------------------------------------+
string GetOrderComment(string reason, string actionParams) {
   string entryTfStr = EnumToString((ENUM_TIMEFRAMES)_Period); 
   StringReplace(entryTfStr, "PERIOD_", "");
   
   string prefix = g_patternText;
   if(prefix == "" || prefix == "-" || prefix == "No Pattern") prefix = reason; 
   if(prefix == "") prefix = RunMagic;
   
   StringReplace(prefix, " ", ""); // Remove spaces to save space
   
   return StringFormat("%s (%s) %s", prefix, entryTfStr, actionParams);
}

//+------------------------------------------------------------------+
//| CHECK EXIT SIGNAL                                                |
//+------------------------------------------------------------------+
void CheckExitSignal()
{
   bool closeBuy = false;
   bool closeSell = false;
   string exitReason = "";
   
   // For Confidence mode or EMA mode, if we see exact opposite EMA cross
   if(TradeMode == MODE_CONFIDENCE_SCORE || TradeMode == MODE_EMA_ONLY || TradeMode == MODE_AUTO_DYNAMIC)
   {
      if(StringFind(g_scoreDetails, "EMA↓") >= 0) { closeBuy = true; exitReason = "EMA Cross Down"; }
      if(StringFind(g_scoreDetails, "EMA↑") >= 0) { closeSell = true; exitReason = "EMA Cross Up"; }
   }
   
   // For Confidence mode or MACD mode, if we see exact opposite MACD cross
   if(TradeMode == MODE_CONFIDENCE_SCORE || TradeMode == MODE_MACD_ONLY || TradeMode == MODE_AUTO_DYNAMIC)
   {
      if(StringFind(g_scoreDetails, "MACD↓") >= 0) { closeBuy = true; exitReason = "MACD Cross Down"; }
      if(StringFind(g_scoreDetails, "MACD↑") >= 0) { closeSell = true; exitReason = "MACD Cross Up"; }
   }

   if(closeBuy || closeSell)
   {
      for(int i = PositionsTotal() - 1; i >= 0; i--)
      {
         if(PositionGetSymbol(i) != _Symbol || PositionGetInteger(POSITION_MAGIC) != g_magic) continue;
         
         ulong ticket = PositionGetInteger(POSITION_TICKET);
         long type = PositionGetInteger(POSITION_TYPE);
         
         if(type == POSITION_TYPE_BUY && closeBuy)
         {
            if(trade.PositionClose(ticket))
            {
               Print("🔴 Exit BUY #", ticket, " Reason: ", exitReason);
               g_lastAction = "EXIT BUY (" + exitReason + ")";
            }
         }
         else if(type == POSITION_TYPE_SELL && closeSell)
         {
            if(trade.PositionClose(ticket))
            {
               Print("🔴 Exit SELL #", ticket, " Reason: ", exitReason);
               g_lastAction = "EXIT SELL (" + exitReason + ")";
            }
         }
      }
      CountMyPositions();
   }
}

//+------------------------------------------------------------------+
//| CHECK ENTRY SIGNAL                                               |
//+------------------------------------------------------------------+
bool CheckEntrySignal()
{
   // Calculate confidence scores
   CalculateConfidence(g_buyScore, g_sellScore, g_scoreDetails);
   
   double ask   = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid   = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   
   bool isBuySignal = false;
   bool isSellSignal = false;
   string signalReason = "";
   int buyScoreToUse = g_buyScore;
   int sellScoreToUse = g_sellScore;
   
   if(TradeMode == MODE_CONFIDENCE_SCORE)
   {
      isBuySignal = (g_buyScore >= MinConfidence && g_buyScore > g_sellScore);
      isSellSignal = (g_sellScore >= MinConfidence && g_sellScore > g_buyScore);
      signalReason = StringFormat("B:%d/S:%d", g_buyScore, g_sellScore);
   }
   else if(TradeMode == MODE_EMA_ONLY)
   {
      isBuySignal = (StringFind(g_scoreDetails, "EMA↑") >= 0);
      isSellSignal = (StringFind(g_scoreDetails, "EMA↓") >= 0);
      signalReason = "EMA Cross";
      buyScoreToUse = isBuySignal ? 100 : 0; sellScoreToUse = isSellSignal ? 100 : 0;
   }
   else if(TradeMode == MODE_RSI_ONLY)
   {
      isBuySignal = (StringFind(g_scoreDetails, "RSI") >= 0 && StringFind(g_scoreDetails, "↑") >= 0);
      isSellSignal = (StringFind(g_scoreDetails, "RSI") >= 0 && StringFind(g_scoreDetails, "↓") >= 0);
      signalReason = "RSI Reversal";
      buyScoreToUse = isBuySignal ? 100 : 0; sellScoreToUse = isSellSignal ? 100 : 0;
   }
   else if(TradeMode == MODE_MACD_ONLY)
   {
      isBuySignal = (StringFind(g_scoreDetails, "MACD↑") >= 0);
      isSellSignal = (StringFind(g_scoreDetails, "MACD↓") >= 0);
      signalReason = "MACD Cross";
      buyScoreToUse = isBuySignal ? 100 : 0; sellScoreToUse = isSellSignal ? 100 : 0;
   }
   else if(TradeMode == MODE_PATTERN_ONLY)
   {
      isBuySignal = (StringFind(g_scoreDetails, "Hammer") >= 0 || StringFind(g_scoreDetails, "Bullish Engulfing") >= 0 || StringFind(g_scoreDetails, "MorningStar") >= 0);
      isSellSignal = (StringFind(g_scoreDetails, "ShootingStar") >= 0 || StringFind(g_scoreDetails, "Bearish Engulfing") >= 0 || StringFind(g_scoreDetails, "EveningStar") >= 0);
      signalReason = "Pattern " + g_patternText;
      buyScoreToUse = isBuySignal ? 100 : 0; sellScoreToUse = isSellSignal ? 100 : 0;
   }
   else if(TradeMode == MODE_BREAKOUT_ONLY)
   {
      isBuySignal = (StringFind(g_scoreDetails, "BrkUP") >= 0);
      isSellSignal = (StringFind(g_scoreDetails, "BrkDN") >= 0);
      signalReason = "Breakout H1";
      buyScoreToUse = isBuySignal ? 100 : 0; sellScoreToUse = isSellSignal ? 100 : 0;
   }
   else if(TradeMode == MODE_BREAKOUT_PATTERN)
   {
      bool patBuy = (StringFind(g_scoreDetails, "Hammer") >= 0 || StringFind(g_scoreDetails, "Bullish Engulfing") >= 0 || StringFind(g_scoreDetails, "MorningStar") >= 0);
      bool patSell = (StringFind(g_scoreDetails, "ShootingStar") >= 0 || StringFind(g_scoreDetails, "Bearish Engulfing") >= 0 || StringFind(g_scoreDetails, "EveningStar") >= 0);
      
      isBuySignal = (StringFind(g_scoreDetails, "BrkUP") >= 0 && patBuy);
      isSellSignal = (StringFind(g_scoreDetails, "BrkDN") >= 0 && patSell);
      signalReason = "Brk+Pat";
      buyScoreToUse = isBuySignal ? 100 : 0; sellScoreToUse = isSellSignal ? 100 : 0;
   }
   else if(TradeMode == MODE_AUTO_DYNAMIC)
   {
      bool isSqueeze = (StringFind(g_bbText, "SQUEEZE") >= 0);
      bool isTrendEMA = (UseEMA200Filter && g_ema200 > 0) ? (MathAbs(bid - g_ema200) > 50 * point) : (MathAbs(g_emaFast - g_emaSlow) > 20 * point);
      
      if(isSqueeze)
      {
         // ตลาดไซด์เวย์แคบ (รอระเบิดเบรกเอาท์ หรือ เล่นชนขอบ RSI)
         if(StringFind(g_scoreDetails, "BrkUP") >= 0 || StringFind(g_scoreDetails, "BrkDN") >= 0) {
            isBuySignal = (StringFind(g_scoreDetails, "BrkUP") >= 0);
            isSellSignal = (StringFind(g_scoreDetails, "BrkDN") >= 0);
            signalReason = "Auto: Breakout from Squeeze";
         }
         else {
            isBuySignal = (StringFind(g_scoreDetails, "RSI") >= 0 && StringFind(g_scoreDetails, "↑") >= 0);
            isSellSignal = (StringFind(g_scoreDetails, "RSI") >= 0 && StringFind(g_scoreDetails, "↓") >= 0);
            signalReason = "Auto: RSI Reversal (Range)";
         }
      }
      else if(isTrendEMA)
      {
         // ตลาดมีเทรนด์ (ใช้เส้น EMA/MACD เป็นจุดเข้า)
         isBuySignal = (StringFind(g_scoreDetails, "EMA↑") >= 0 || StringFind(g_scoreDetails, "MACD↑") >= 0);
         isSellSignal = (StringFind(g_scoreDetails, "EMA↓") >= 0 || StringFind(g_scoreDetails, "MACD↓") >= 0);
         
         // กรองตามเทรนด์ EMA200
         if(UseEMA200Filter && g_ema200 > 0) {
            if(isBuySignal && ask < g_ema200) isBuySignal = false;
            if(isSellSignal && bid > g_ema200) isSellSignal = false;
         }
         signalReason = "Auto: Trend Follow";
      }
      else 
      {
         // ตลาดแกว่งกว้าง (พึ่งพาแท่งเทียนกลับตัว)
         isBuySignal = (StringFind(g_scoreDetails, "Hammer") >= 0 || StringFind(g_scoreDetails, "Bullish Engulfing") >= 0 || StringFind(g_scoreDetails, "MorningStar") >= 0);
         isSellSignal = (StringFind(g_scoreDetails, "ShootingStar") >= 0 || StringFind(g_scoreDetails, "Bearish Engulfing") >= 0 || StringFind(g_scoreDetails, "EveningStar") >= 0);
         signalReason = "Auto: Pattern Action";
      }
      
      buyScoreToUse = isBuySignal ? 100 : 0; sellScoreToUse = isSellSignal ? 100 : 0;
   }
   
   // BUY
   if(isBuySignal && !isSellSignal)
   {
      double sl = (StopLossPoints > 0) ? ask - (StopLossPoints * point) : 0.0;
      double tp = (TakeProfitPoints > 0) ? ask + (TakeProfitPoints * point) : 0.0;
      
      int execCount = 1;
      double execLot = CalculateLotSize();
      
      if(EnableBurstMode)
      {
         execLot = BurstLotSize;
         int scoreToCheck = (TradeMode == MODE_CONFIDENCE_SCORE || TradeMode == MODE_AUTO_DYNAMIC) ? g_buyScore : 50;
         
         if(scoreToCheck >= 90) execCount = BurstExtremeCount;
         else if(scoreToCheck >= 70) execCount = BurstStrongCount;
         else execCount = BurstNormalCount;
      }
      
      int success = 0;
      for(int i = 0; i < execCount; i++)
      {
         string cmnt = GetOrderComment(signalReason, StringFormat("Buy %d [B%d]", buyScoreToUse, i+1));
         bool res = trade.Buy(execLot, _Symbol, ask, sl, tp, cmnt);
         if(res) success++;
         else {
            Print("❌ Burst Buy failed at order ", i+1, ": ", trade.ResultRetcode());
            break; // Stop burst if error to prevent broker block
         }
         if(EnableBurstMode) Sleep(50); // กัน Broker บล็อคตอนยิงรัว
      }
      
      g_signalText  = StringFormat("◉ BUY (%s) x%d", signalReason, execCount);
      g_signalColor = BuyColor;
      g_lastAction  = StringFormat("BUY %.2f x%d", execLot, success);
      g_lastSignalTime = TimeCurrent();
      
      Print("✅ BUY Signal | Mode: ", EnumToString(TradeMode), " | Burst: ", success, "/", execCount, " | ", g_scoreDetails);
      return true;
   }
   // SELL
   else if(isSellSignal && !isBuySignal)
   {
      double sl = (StopLossPoints > 0) ? bid + (StopLossPoints * point) : 0.0;
      double tp = (TakeProfitPoints > 0) ? bid - (TakeProfitPoints * point) : 0.0;
      
      int execCount = 1;
      double execLot = CalculateLotSize();
      
      if(EnableBurstMode)
      {
         execLot = BurstLotSize;
         int scoreToCheck = (TradeMode == MODE_CONFIDENCE_SCORE || TradeMode == MODE_AUTO_DYNAMIC) ? g_sellScore : 50;
         
         if(scoreToCheck >= 90) execCount = BurstExtremeCount;
         else if(scoreToCheck >= 70) execCount = BurstStrongCount;
         else execCount = BurstNormalCount;
      }
      
      int success = 0;
      for(int i = 0; i < execCount; i++)
      {
         string cmnt = GetOrderComment(signalReason, StringFormat("Sell %d [B%d]", sellScoreToUse, i+1));
         bool res = trade.Sell(execLot, _Symbol, bid, sl, tp, cmnt);
         if(res) success++;
         else {
            Print("❌ Burst Sell failed at order ", i+1, ": ", trade.ResultRetcode());
            break;
         }
         if(EnableBurstMode) Sleep(50);
      }
      
      g_signalText  = StringFormat("◉ SELL (%s) x%d", signalReason, execCount);
      g_signalColor = SellColor;
      g_lastAction  = StringFormat("SELL %.2f x%d", execLot, success);
      g_lastSignalTime = TimeCurrent();
      
      Print("✅ SELL Signal | Mode: ", EnumToString(TradeMode), " | Burst: ", success, "/", execCount, " | ", g_scoreDetails);
      return true;
   }
   else
   {
      if(TradeMode == MODE_CONFIDENCE_SCORE)
         g_signalText  = StringFormat("SCANNING (B:%d S:%d)", g_buyScore, g_sellScore);
      else
      {
         string smode = EnumToString(TradeMode);
         StringReplace(smode, "MODE_", "");
         g_signalText  = StringFormat("SCANNING (%s)", smode);
      }
      g_signalColor = NeutralColor;
   }
   
   return false;
}

//+------------------------------------------------------------------+
//| MANAGE BREAKEVEN                                                 |
//+------------------------------------------------------------------+
void ManageBreakeven()
{
   double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   double bid   = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask   = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   
   double totalVolBuy = 0, totalVolSell = 0;
   double weightedPriceBuy = 0, weightedPriceSell = 0;
   for(int i = 0; i < PositionsTotal(); i++)
   {
      ulong tpTick = PositionGetTicket(i);
      if(tpTick == 0 || PositionGetString(POSITION_SYMBOL) != _Symbol || PositionGetInteger(POSITION_MAGIC) != g_magic) continue;
      long type = PositionGetInteger(POSITION_TYPE);
      double vol = PositionGetDouble(POSITION_VOLUME);
      double price = PositionGetDouble(POSITION_PRICE_OPEN);
      if(type == POSITION_TYPE_BUY) { totalVolBuy += vol; weightedPriceBuy += price * vol; }
      else if(type == POSITION_TYPE_SELL) { totalVolSell += vol; weightedPriceSell += price * vol; }
   }
   double avgOpenBuy = (totalVolBuy > 0) ? weightedPriceBuy / totalVolBuy : 0;
   double avgOpenSell = (totalVolSell > 0) ? weightedPriceSell / totalVolSell : 0;
   
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != g_magic) continue;
      
      double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      double currentSL = PositionGetDouble(POSITION_SL);
      double currentTP = PositionGetDouble(POSITION_TP);
      long   type      = PositionGetInteger(POSITION_TYPE);
      
      if(type == POSITION_TYPE_BUY && avgOpenBuy > 0)
      {
         // ใช้ราคาเฉลี่ยรวม เพื่อให้ขยับพร้อมกันทั้งแผง (Basket)
         if(currentSL == 0.0 || currentSL < avgOpenBuy + (BreakevenOffset * point * 0.5))
         {
            if(bid - avgOpenBuy >= BreakevenPoints * point)
            {
               double newSL = avgOpenBuy + BreakevenOffset * point;
               if(newSL != currentSL) {
                  if(trade.PositionModify(ticket, newSL, currentTP))
                     Print("⚖️ Breakeven BUY #", ticket, " SL → ", newSL);
                  else
                     Print("❌ Breakeven BUY Error: ", trade.ResultRetcode(), " - ", trade.ResultRetcodeDescription());
               }
            }
         }
      }
      else if(type == POSITION_TYPE_SELL && avgOpenSell > 0)
      {
         if(currentSL == 0.0 || currentSL > avgOpenSell - (BreakevenOffset * point * 0.5))
         {
            if(avgOpenSell - ask >= BreakevenPoints * point)
            {
               double newSL = avgOpenSell - BreakevenOffset * point;
               if(newSL != currentSL) {
                  if(trade.PositionModify(ticket, newSL, currentTP))
                     Print("⚖️ Breakeven SELL #", ticket, " SL → ", newSL);
                  else
                     Print("❌ Breakeven SELL Error: ", trade.ResultRetcode(), " - ", trade.ResultRetcodeDescription());
               }
            }
         }
      }
   }
}

//+------------------------------------------------------------------+
//| MANAGE TRAILING STOP                                             |
//+------------------------------------------------------------------+
void ManageTrailingStop()
{
   double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   double bid   = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask   = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   
   double totalVolBuy = 0, totalVolSell = 0;
   double weightedPriceBuy = 0, weightedPriceSell = 0;
   for(int i = 0; i < PositionsTotal(); i++)
   {
      ulong tpTick = PositionGetTicket(i);
      if(tpTick == 0 || PositionGetString(POSITION_SYMBOL) != _Symbol || PositionGetInteger(POSITION_MAGIC) != g_magic) continue;
      long type = PositionGetInteger(POSITION_TYPE);
      double vol = PositionGetDouble(POSITION_VOLUME);
      double price = PositionGetDouble(POSITION_PRICE_OPEN);
      if(type == POSITION_TYPE_BUY) { totalVolBuy += vol; weightedPriceBuy += price * vol; }
      else if(type == POSITION_TYPE_SELL) { totalVolSell += vol; weightedPriceSell += price * vol; }
   }
   double avgOpenBuy = (totalVolBuy > 0) ? weightedPriceBuy / totalVolBuy : 0;
   double avgOpenSell = (totalVolSell > 0) ? weightedPriceSell / totalVolSell : 0;
   
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != g_magic) continue;
      
      double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      double currentSL = PositionGetDouble(POSITION_SL);
      double currentTP = PositionGetDouble(POSITION_TP);
      long   type      = PositionGetInteger(POSITION_TYPE);
      
      if(type == POSITION_TYPE_BUY && avgOpenBuy > 0)
      {
         if(bid - avgOpenBuy >= TrailingStart * point) // รอให้กำไรเฉลี่ยถึงจุด TrailingStart ก่อน
         {
            double candleLow = iLow(_Symbol, PERIOD_CURRENT, 1);
            double offset    = (TrailingStop > 0 && TrailingStop < 1000) ? TrailingStop : 100; // หากตั้งค่าน้อยให้ใช้เป็น offset ได้
            double newSL     = candleLow - (offset * point);
            
            if(newSL > avgOpenBuy + (BreakevenOffset * point))
            {
               if(currentSL == 0.0 || newSL > currentSL + (TrailingStep * point))
               {
                  double newTP = currentTP;
                  if(TrailTP && TakeProfitPoints > 0) newTP = bid + (TakeProfitPoints * point);
                  
                  if(trade.PositionModify(ticket, newSL, newTP))
                     Print("📈 Trail BUY #", ticket, " SL:", newSL, " TP:", newTP);
                  else
                     Print("❌ Trail BUY Error: ", trade.ResultRetcode(), " - ", trade.ResultRetcodeDescription());
               }
            }
         }
      }
      else if(type == POSITION_TYPE_SELL && avgOpenSell > 0)
      {
         if(avgOpenSell - ask >= TrailingStart * point)
         {
            double candleHigh = iHigh(_Symbol, PERIOD_CURRENT, 1);
            double offset     = (TrailingStop > 0 && TrailingStop < 1000) ? TrailingStop : 100;
            double newSL      = candleHigh + (offset * point);
            
            if(newSL < avgOpenSell - (BreakevenOffset * point))
            {
               if(currentSL == 0.0 || newSL < currentSL - (TrailingStep * point))
               {
                  double newTP = currentTP;
                  if(TrailTP && TakeProfitPoints > 0) newTP = ask - (TakeProfitPoints * point);
                  
                  if(trade.PositionModify(ticket, newSL, newTP))
                     Print("📈 Trail SELL #", ticket, " SL:", newSL, " TP:", newTP);
                  else
                     Print("❌ Trail SELL Error: ", trade.ResultRetcode(), " - ", trade.ResultRetcodeDescription());
               }
            }
         }
      }
   }
}


//+------------------------------------------------------------------+
//| DRAW BREAKOUT BOX                                                |
//+------------------------------------------------------------------+
void DrawBreakoutBox(string name, datetime t1, double price1, datetime t2, double price2)
{
   if(ObjectFind(0, name) < 0)
   {
      ObjectCreate(0, name, OBJ_RECTANGLE, 0, t1, price1, t2, price2);
      ObjectSetInteger(0, name, OBJPROP_COLOR, BoxColor);
      ObjectSetInteger(0, name, OBJPROP_STYLE, STYLE_SOLID); // Outline
      ObjectSetInteger(0, name, OBJPROP_WIDTH, 1);
      ObjectSetInteger(0, name, OBJPROP_BACK, true); // Behind chart
      ObjectSetInteger(0, name, OBJPROP_FILL, false); // Don't fill
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
      ObjectSetString(0, name, OBJPROP_TOOLTIP, "H1 Breakout Range:\n" + DoubleToString(price1, 5) + " / " + DoubleToString(price2, 5));
   }
   else
   {
      ObjectSetInteger(0, name, OBJPROP_TIME, 0, t1);
      ObjectSetDouble(0, name, OBJPROP_PRICE, 0, price1);
      ObjectSetInteger(0, name, OBJPROP_TIME, 1, t2);
      ObjectSetDouble(0, name, OBJPROP_PRICE, 1, price2);
   }
}

//+------------------------------------------------------------------+
//| SEND SYNC DATA TO BACKEND                                        |
//+------------------------------------------------------------------+
void SendSyncData()
{
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity  = AccountInfoDouble(ACCOUNT_EQUITY);

   string json = "{";
   json += "\"balance\":" + DoubleToString(balance, 2) + ",";
   json += "\"equity\":" + DoubleToString(equity, 2) + ",";
   json += "\"trades\":[";

   int total = PositionsTotal();
   bool first = true;
   for(int i = 0; i < total; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0)
      {
         string sym = PositionGetString(POSITION_SYMBOL);
         int type = (int)PositionGetInteger(POSITION_TYPE); 
         double lots = PositionGetDouble(POSITION_VOLUME);
         double open_price = PositionGetDouble(POSITION_PRICE_OPEN);
         double sl = PositionGetDouble(POSITION_SL);
         double tp = PositionGetDouble(POSITION_TP);
         double current_price = PositionGetDouble(POSITION_PRICE_CURRENT);
         double profit = PositionGetDouble(POSITION_PROFIT);
         long open_time = PositionGetInteger(POSITION_TIME);
         long magic_number = PositionGetInteger(POSITION_MAGIC);

         if(!first) json += ",";
         
         json += "{";
         json += "\"ticket\":\"" + IntegerToString(ticket) + "\",";
         json += "\"symbol\":\"" + sym + "\",";
         json += "\"type\":" + IntegerToString(type) + ",";
         json += "\"lots\":" + DoubleToString(lots, 2) + ",";
         json += "\"open_price\":" + DoubleToString(open_price, 5) + ",";
         json += "\"sl\":" + DoubleToString(sl, 5) + ",";
         json += "\"tp\":" + DoubleToString(tp, 5) + ",";
         json += "\"current_price\":" + DoubleToString(current_price, 5) + ",";
         json += "\"profit\":" + DoubleToString(profit, 2) + ",";
         json += "\"magic_number\":" + IntegerToString(magic_number) + ",";
         json += "\"open_time\":" + IntegerToString(open_time);
         json += "}";
         
         first = false;
      }
   }
   json += "]}";

   char post_data[];
   int str_len = StringToCharArray(json, post_data, 0, WHOLE_ARRAY, CP_UTF8);
   if (str_len > 0) ArrayResize(post_data, str_len - 1); 

   string headers = "Content-Type: application/json\r\n";
   headers += "x-bridge-token: " + BRIDGE_TOKEN + "\r\n";
   
   string result_headers;
   char result_data[];
   string url = API_URL + "/api/bridge/sync";

   int res = WebRequest("POST", url, headers, 3000, post_data, result_data, result_headers);
   if(res == 200 || res == 201) {
      // Sync success
      string response_text = CharArrayToString(result_data);
      // Optional: Handle kill switch or return commands here if needed
   } else if (res > 0) {
      Print("NexusFX Bridge Error: HTTP ", res, " ", CharArrayToString(result_data));
   }
}

//+------------------------------------------------------------------+

