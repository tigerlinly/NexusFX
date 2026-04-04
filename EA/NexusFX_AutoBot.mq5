//+------------------------------------------------------------------+
//|                                              NexusFX_AutoBot.mq5 |
//|                                    Copyright 2026, NexusFX Corp. |
//+------------------------------------------------------------------+
#property copyright "NexusFX"
#property link      "https://nexusfx.biz"
#property version   "3.00"
#property strict

#include <Trade\Trade.mqh>

//--- Input parameters
input group    "=== Risk Management ==="
input double   RiskPercent      = 1.0;        // ความเสี่ยงต่อออเดอร์ (% ของทุน)
input double   FixedLotSize     = 0.0;        // Lot คงที่ (0 = ใช้ Risk%)
input int      MaxPositions     = 3;          // จำนวนไม้สูงสุดที่เปิดพร้อมกัน

input group    "=== Entry & Exit ==="
input int      StopLossPoints   = 300;        // Stop Loss (Points)
input int      TakeProfitPoints = 600;        // Take Profit (Points)
input int      TrailingStop     = 200;        // Trailing Stop (Points, 0=ปิด)
input int      TrailingStep     = 50;         // Trailing Step (Points)
input int      BreakevenPoints  = 150;        // Breakeven Trigger (Points, 0=ปิด)
input int      BreakevenOffset  = 10;         // Breakeven SL Offset (Points, บวกเพิ่มเพื่อค่า spread)

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
input bool     UseBreakout      = true;       // ใช้กลยุทธ์ Breakout (H1)
input int      BreakoutPeriod   = 20;         // จำนวนแท่ง H1 (หา High/Low)

input group    "=== Session Filter ==="
input bool     UseSessionFilter = false;      // กรองเวลาเทรด
input int      SessionStart1    = 8;          // London Open (GMT hour)
input int      SessionEnd1      = 12;         // London Close
input int      SessionStart2    = 13;         // NY Open (GMT hour)
input int      SessionEnd2      = 17;         // NY Close
input int      GMT_Offset       = 0;          // Server GMT offset

input group    "=== Confidence Scoring ==="
input int      MinConfidence    = 50;         // คะแนนขั้นต่ำที่จะเปิดออเดอร์ (0-100)
input int      Weight_Breakout  = 30;         // น้ำหนัก Breakout H1
input int      Weight_EMACross  = 30;         // น้ำหนัก EMA Cross
input int      Weight_RSI       = 20;         // น้ำหนัก RSI
input int      Weight_MACD      = 20;         // น้ำหนัก MACD
input int      Weight_BB        = 15;         // น้ำหนัก Bollinger Bands
input int      Weight_Pattern   = 15;         // น้ำหนัก Candlestick Pattern

input group    "=== Display ==="
input bool     ShowPanel        = true;       // แสดง Dashboard Panel
input int      PanelX           = 10;         // ตำแหน่ง X
input int      PanelY           = 25;         // ตำแหน่ง Y
input color    PanelBgColor     = C'20,25,35';
input color    PanelBorderColor = C'40,50,70';
input color    TextColor        = clrWhite;
input color    BuyColor         = C'0,230,118';
input color    SellColor        = C'255,82,82';
input color    NeutralColor     = C'120,130,150';
input color    WarnColor        = C'255,170,50';

input group    "=== System ==="
input ulong    MagicNumber      = 999911;     // Magic Number

//--- Global variables
CTrade         trade;
int            handleFastEMA, handleSlowEMA, handleEMA200;
int            handleRSI, handleMACD, handleBB;
int            handleHTF_EMA9, handleHTF_EMA21;
double         emaFastBuf[], emaSlowBuf[], ema200Buf[], rsiBuf[];
double         macdMainBuf[], macdSignalBuf[];
double         bbUpperBuf[], bbMiddleBuf[], bbLowerBuf[];
double         htfEma9Buf[], htfEma21Buf[];

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

//+------------------------------------------------------------------+
int OnInit()
{
   trade.SetExpertMagicNumber(MagicNumber);
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
   
   // Set as series
   ArraySetAsSeries(emaFastBuf, true);   ArraySetAsSeries(emaSlowBuf, true);
   ArraySetAsSeries(ema200Buf, true);    ArraySetAsSeries(rsiBuf, true);
   ArraySetAsSeries(macdMainBuf, true);  ArraySetAsSeries(macdSignalBuf, true);
   ArraySetAsSeries(bbUpperBuf, true);   ArraySetAsSeries(bbMiddleBuf, true);
   ArraySetAsSeries(bbLowerBuf, true);   ArraySetAsSeries(htfEma9Buf, true);
   ArraySetAsSeries(htfEma21Buf, true);
   
   if(ShowPanel) CreatePanel();
   
   Print("⚡ NexusFX AutoBot v3.0 | Magic: ", MagicNumber);
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
   DeletePanel();
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
   
   // Session check
   g_inSession = CheckSession();
   
   // Entry
   if(g_myPositions < MaxPositions && g_inSession)
      CheckEntrySignal();
   else if(!g_inSession)
   {
      g_signalText = "⏸ OUTSIDE SESSION";
      g_signalColor = WarnColor;
   }
   
   if(ShowPanel) UpdatePanel();
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
   
   // Breakout H1
   if(UseBreakout)
   {
      double htfHigh[], htfLow[];
      if(CopyHigh(_Symbol, PERIOD_H1, 1, BreakoutPeriod, htfHigh) == BreakoutPeriod &&
         CopyLow(_Symbol, PERIOD_H1, 1, BreakoutPeriod, htfLow) == BreakoutPeriod)
      {
         g_highestH1 = htfHigh[ArrayMaximum(htfHigh, 0, WHOLE_ARRAY)];
         g_lowestH1  = htfLow[ArrayMinimum(htfLow, 0, WHOLE_ARRAY)];
         
         double price = SymbolInfoDouble(_Symbol, SYMBOL_BID);
         if(price > g_highestH1) g_brkText = "▲ Break UP";
         else if(price < g_lowestH1) g_brkText = "▼ Break DOWN";
         else g_brkText = "Inside Range";
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
   
   // 8. Breakout H1
   if(UseBreakout && g_highestH1 > 0 && g_lowestH1 > 0)
   {
      double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      if(ask > g_highestH1) { buyScore += Weight_Breakout; details += "BrkUP "; }
      else if(bid < g_lowestH1) { sellScore += Weight_Breakout; details += "BrkDN "; }
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
      if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == MagicNumber)
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
//| CHECK ENTRY SIGNAL                                               |
//+------------------------------------------------------------------+
bool CheckEntrySignal()
{
   // Calculate confidence scores
   CalculateConfidence(g_buyScore, g_sellScore, g_scoreDetails);
   
   double ask   = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid   = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   
   // BUY
   if(g_buyScore >= MinConfidence && g_buyScore > g_sellScore)
   {
      double lot = CalculateLotSize();
      double sl  = ask - (StopLossPoints * point);
      double tp  = ask + (TakeProfitPoints * point);
      
      g_signalText  = StringFormat("◉ BUY (%d%%)", g_buyScore);
      g_signalColor = BuyColor;
      g_lastAction  = StringFormat("BUY %.2f @ %.5f", lot, ask);
      g_lastSignalTime = TimeCurrent();
      
      Print("✅ BUY Signal | Score: ", g_buyScore, "% | Lot: ", lot, " (", g_lotMethod, ") | ", g_scoreDetails);
      
      if(trade.Buy(lot, _Symbol, ask, sl, tp, StringFormat("NXBot Buy %d%%", g_buyScore)))
         return true;
      else
         Print("❌ Buy failed: ", trade.ResultRetcode());
   }
   // SELL
   else if(g_sellScore >= MinConfidence && g_sellScore > g_buyScore)
   {
      double lot = CalculateLotSize();
      double sl  = bid + (StopLossPoints * point);
      double tp  = bid - (TakeProfitPoints * point);
      
      g_signalText  = StringFormat("◉ SELL (%d%%)", g_sellScore);
      g_signalColor = SellColor;
      g_lastAction  = StringFormat("SELL %.2f @ %.5f", lot, bid);
      g_lastSignalTime = TimeCurrent();
      
      Print("✅ SELL Signal | Score: ", g_sellScore, "% | Lot: ", lot, " (", g_lotMethod, ") | ", g_scoreDetails);
      
      if(trade.Sell(lot, _Symbol, bid, sl, tp, StringFormat("NXBot Sell %d%%", g_sellScore)))
         return true;
      else
         Print("❌ Sell failed: ", trade.ResultRetcode());
   }
   else
   {
      g_signalText  = StringFormat("SCANNING (B:%d S:%d)", g_buyScore, g_sellScore);
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
   
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(PositionGetSymbol(i) != _Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
      
      ulong  ticket    = PositionGetInteger(POSITION_TICKET);
      double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      double currentSL = PositionGetDouble(POSITION_SL);
      double currentTP = PositionGetDouble(POSITION_TP);
      long   type      = PositionGetInteger(POSITION_TYPE);
      
      if(type == POSITION_TYPE_BUY)
      {
         // SL ยังอยู่ต่ำกว่าราคาเข้า = ยังไม่ breakeven
         if(currentSL < openPrice && bid - openPrice >= BreakevenPoints * point)
         {
            double newSL = openPrice + BreakevenOffset * point;
            if(trade.PositionModify(ticket, newSL, currentTP))
               Print("⚖️ Breakeven BUY #", ticket, " SL → ", newSL);
         }
      }
      else if(type == POSITION_TYPE_SELL)
      {
         if(currentSL > openPrice && openPrice - ask >= BreakevenPoints * point)
         {
            double newSL = openPrice - BreakevenOffset * point;
            if(trade.PositionModify(ticket, newSL, currentTP))
               Print("⚖️ Breakeven SELL #", ticket, " SL → ", newSL);
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
   
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(PositionGetSymbol(i) != _Symbol) continue;
      if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
      
      ulong  ticket    = PositionGetInteger(POSITION_TICKET);
      double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      double currentSL = PositionGetDouble(POSITION_SL);
      double currentTP = PositionGetDouble(POSITION_TP);
      long   type      = PositionGetInteger(POSITION_TYPE);
      
      if(type == POSITION_TYPE_BUY)
      {
         if(bid - openPrice > TrailingStop * point)
         {
            double newSL = bid - (TrailingStop * point);
            if(currentSL == 0.0 || newSL > currentSL + (TrailingStep * point))
            {
               double newTP = bid + (TakeProfitPoints * point);
               trade.PositionModify(ticket, newSL, newTP);
               Print("📈 Trail BUY #", ticket, " SL:", newSL, " TP:", newTP);
            }
         }
      }
      else if(type == POSITION_TYPE_SELL)
      {
         if(openPrice - ask > TrailingStop * point)
         {
            double newSL = ask + (TrailingStop * point);
            if(currentSL == 0.0 || newSL < currentSL - (TrailingStep * point))
            {
               double newTP = ask - (TakeProfitPoints * point);
               trade.PositionModify(ticket, newSL, newTP);
               Print("📈 Trail SELL #", ticket, " SL:", newSL, " TP:", newTP);
            }
         }
      }
   }
}

//+------------------------------------------------------------------+
//| CREATE PANEL                                                     |
//+------------------------------------------------------------------+
void CreatePanel()
{
   int pw = 340;
   int ph = 540;
   
   CreateRect(PREFIX+"BG", PanelX, PanelY, pw, ph, PanelBgColor, PanelBorderColor);
   CreateRect(PREFIX+"TBG", PanelX, PanelY, pw, 26, C'25,32,48', PanelBorderColor);
   CreateLbl(PREFIX+"Title", PanelX+10, PanelY+5, "⚡ NexusFX AutoBot v3.0", TextColor, 10, true);
   CreateLbl(PREFIX+"Magic", PanelX+pw-85, PanelY+7, "Magic: "+IntegerToString(MagicNumber), NeutralColor, 7, false);
   
   int y = PanelY + 34;
   int lx = PanelX + 12;
   int vx = PanelX + 140;
   int h  = 16;
   
   // ACCOUNT
   CreateLbl(PREFIX+"S1", lx, y, "── ACCOUNT ──────────────", C'60,70,100', 7, true); y+=h+2;
   CreateLbl(PREFIX+"LBal",  lx, y, "Balance:", NeutralColor, 8, false);
   CreateLbl(PREFIX+"VBal",  vx, y, "-", TextColor, 8, true); y+=h;
   CreateLbl(PREFIX+"LEq",   lx, y, "Equity:", NeutralColor, 8, false);
   CreateLbl(PREFIX+"VEq",   vx, y, "-", TextColor, 8, true); y+=h;
   CreateLbl(PREFIX+"LMgn",  lx, y, "Free Margin:", NeutralColor, 8, false);
   CreateLbl(PREFIX+"VMgn",  vx, y, "-", TextColor, 8, true); y+=h+4;
   
   // SIGNAL
   CreateLbl(PREFIX+"S2", lx, y, "── SIGNAL ───────────────", C'60,70,100', 7, true); y+=h+2;
   CreateLbl(PREFIX+"LSig",   lx, y, "Signal:", NeutralColor, 8, false);
   CreateLbl(PREFIX+"VSig",   vx, y, "-", NeutralColor, 9, true); y+=h;
   CreateLbl(PREFIX+"LTrend", lx, y, "Trend:", NeutralColor, 8, false);
   CreateLbl(PREFIX+"VTrend", vx, y, "-", TextColor, 8, true); y+=h;
   CreateLbl(PREFIX+"LPat",   lx, y, "Pattern:", NeutralColor, 8, false);
   CreateLbl(PREFIX+"VPat",   vx, y, "-", TextColor, 8, false); y+=h;
   CreateLbl(PREFIX+"LSess",  lx, y, "Session:", NeutralColor, 8, false);
   CreateLbl(PREFIX+"VSess",  vx, y, "-", TextColor, 8, false); y+=h+4;
   
   // INDICATORS
   CreateLbl(PREFIX+"S3", lx, y, "── INDICATORS ───────────", C'60,70,100', 7, true); y+=h+2;
   CreateLbl(PREFIX+"LEf", lx, y, StringFormat("EMA(%d):", FastEMA), NeutralColor, 8, false);
   CreateLbl(PREFIX+"VEf", vx, y, "-", TextColor, 8, true); y+=h;
   CreateLbl(PREFIX+"LEs", lx, y, StringFormat("EMA(%d):", SlowEMA), NeutralColor, 8, false);
   CreateLbl(PREFIX+"VEs", vx, y, "-", TextColor, 8, true); y+=h;
   CreateLbl(PREFIX+"LRsi",  lx, y, StringFormat("RSI(%d):", RSI_Period), NeutralColor, 8, false);
   CreateLbl(PREFIX+"VRsi",  vx, y, "-", TextColor, 8, true); y+=h;
   CreateLbl(PREFIX+"LMacd", lx, y, "MACD:", NeutralColor, 8, false);
   CreateLbl(PREFIX+"VMacd", vx, y, "-", TextColor, 8, false); y+=h;
   CreateLbl(PREFIX+"LBb",   lx, y, "BB:", NeutralColor, 8, false);
   CreateLbl(PREFIX+"VBb",   vx, y, "-", TextColor, 8, false); y+=h;
   if(UseMTF) {
      CreateLbl(PREFIX+"LHtf",  lx, y, "HTF:", NeutralColor, 8, false);
      CreateLbl(PREFIX+"VHtf",  vx, y, "-", TextColor, 8, false); y+=h;
   }
   if(UseBreakout) {
      CreateLbl(PREFIX+"LBrk",  lx, y, "Breakout:", NeutralColor, 8, false);
      CreateLbl(PREFIX+"VBrk",  vx, y, "-", TextColor, 8, false); y+=h;
   }
   y+=4;
   
   // SCORING
   CreateLbl(PREFIX+"S4", lx, y, "── CONFIDENCE SCORE ─────", C'60,70,100', 7, true); y+=h+2;
   CreateLbl(PREFIX+"LScBuy",  lx, y, "Buy Score:", NeutralColor, 8, false);
   CreateLbl(PREFIX+"VScBuy",  vx, y, "-", BuyColor, 9, true); y+=h;
   CreateLbl(PREFIX+"LScSell", lx, y, "Sell Score:", NeutralColor, 8, false);
   CreateLbl(PREFIX+"VScSell", vx, y, "-", SellColor, 9, true); y+=h;
   CreateLbl(PREFIX+"LScMin",  lx, y, "Min Required:", NeutralColor, 8, false);
   CreateLbl(PREFIX+"VScMin",  vx, y, IntegerToString(MinConfidence)+"%", WarnColor, 8, true); y+=h;
   CreateLbl(PREFIX+"LDet",    lx, y, "Details:", NeutralColor, 8, false);
   CreateLbl(PREFIX+"VDet",    vx, y, "-", NeutralColor, 7, false); y+=h+4;
   
   // LOT & POSITIONS
   CreateLbl(PREFIX+"S5", lx, y, "── LOT & POSITIONS ──────", C'60,70,100', 7, true); y+=h+2;
   CreateLbl(PREFIX+"LLot",  lx, y, "Lot Size:", NeutralColor, 8, false);
   CreateLbl(PREFIX+"VLot",  vx, y, "-", TextColor, 8, true); y+=h;
   CreateLbl(PREFIX+"LPos",  lx, y, "Positions:", NeutralColor, 8, false);
   CreateLbl(PREFIX+"VPos",  vx, y, "-", TextColor, 8, true); y+=h;
   CreateLbl(PREFIX+"LPnl",  lx, y, "Float PnL:", NeutralColor, 8, false);
   CreateLbl(PREFIX+"VPnl",  vx, y, "-", TextColor, 8, true); y+=h+4;
   
   // LAST ACTION
   CreateLbl(PREFIX+"LAct", lx, y, "", NeutralColor, 7, false);
   
   ChartRedraw();
}

//+------------------------------------------------------------------+
//| UPDATE PANEL                                                     |
//+------------------------------------------------------------------+
void UpdatePanel()
{
   int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   
   // Account
   SetText(PREFIX+"VBal", StringFormat("$%.2f", AccountInfoDouble(ACCOUNT_BALANCE)));
   SetText(PREFIX+"VEq",  StringFormat("$%.2f", AccountInfoDouble(ACCOUNT_EQUITY)));
   SetText(PREFIX+"VMgn", StringFormat("$%.2f", AccountInfoDouble(ACCOUNT_MARGIN_FREE)));
   
   // Signal
   SetText(PREFIX+"VSig", g_signalText); SetColor(PREFIX+"VSig", g_signalColor);
   SetText(PREFIX+"VTrend", g_trendText);
   SetColor(PREFIX+"VTrend", (g_emaFast > g_emaSlow) ? BuyColor : SellColor);
   SetText(PREFIX+"VPat", g_patternText);
   SetText(PREFIX+"VSess", g_sessionText);
   
   // Indicators
   SetText(PREFIX+"VEf", DoubleToString(g_emaFast, digits));
   SetText(PREFIX+"VEs", DoubleToString(g_emaSlow, digits));
   SetText(PREFIX+"VRsi", StringFormat("%.1f", g_rsi));
   SetColor(PREFIX+"VRsi", g_rsi > 70 ? SellColor : g_rsi < 30 ? BuyColor : NeutralColor);
   
   if(UseMACD)
   {
      SetText(PREFIX+"VMacd", StringFormat("%.5f (%s)", g_macdHist, g_macdText));
      SetColor(PREFIX+"VMacd", g_macdHist > 0 ? BuyColor : SellColor);
   }
   if(UseBB) SetText(PREFIX+"VBb", g_bbText);
   if(UseMTF) { SetText(PREFIX+"VHtf", g_htfText);
      SetColor(PREFIX+"VHtf", StringFind(g_htfText, "Bull") >= 0 ? BuyColor : SellColor); }
   if(UseBreakout) {
      SetText(PREFIX+"VBrk", g_brkText);
      SetColor(PREFIX+"VBrk", StringFind(g_brkText, "UP") >= 0 ? BuyColor : (StringFind(g_brkText, "DOWN") >= 0 ? SellColor : NeutralColor));
   }
   
   // Scoring
   SetText(PREFIX+"VScBuy",  StringFormat("%d%%", g_buyScore));
   SetText(PREFIX+"VScSell", StringFormat("%d%%", g_sellScore));
   SetColor(PREFIX+"VScBuy",  g_buyScore >= MinConfidence ? BuyColor : NeutralColor);
   SetColor(PREFIX+"VScSell", g_sellScore >= MinConfidence ? SellColor : NeutralColor);
   SetText(PREFIX+"VDet", g_scoreDetails);
   
   // Lot & Positions
   double lot = CalculateLotSize();
   SetText(PREFIX+"VLot", StringFormat("%.2f (%s)", lot, g_lotMethod));
   SetText(PREFIX+"VPos", StringFormat("%d / %d", g_myPositions, MaxPositions));
   SetColor(PREFIX+"VPos", g_myPositions >= MaxPositions ? SellColor : g_myPositions > 0 ? BuyColor : NeutralColor);
   SetText(PREFIX+"VPnl", StringFormat("$%.2f", g_totalProfit));
   SetColor(PREFIX+"VPnl", g_totalProfit >= 0 ? BuyColor : SellColor);
   
   // Last Action
   if(g_lastAction != "")
   {
      int elapsed = (int)(TimeCurrent() - g_lastSignalTime);
      SetText(PREFIX+"LAct", StringFormat("Last: %s (%ds ago)", g_lastAction, elapsed));
   }
   
   ChartRedraw();
}

//+------------------------------------------------------------------+
//| HELPERS                                                          |
//+------------------------------------------------------------------+
void CreateRect(string name, int x, int y, int w, int h, color bg, color border)
{
   if(ObjectFind(0,name)>=0) ObjectDelete(0,name);
   ObjectCreate(0,name,OBJ_RECTANGLE_LABEL,0,0,0);
   ObjectSetInteger(0,name,OBJPROP_CORNER,CORNER_LEFT_UPPER);
   ObjectSetInteger(0,name,OBJPROP_XDISTANCE,x);
   ObjectSetInteger(0,name,OBJPROP_YDISTANCE,y);
   ObjectSetInteger(0,name,OBJPROP_XSIZE,w);
   ObjectSetInteger(0,name,OBJPROP_YSIZE,h);
   ObjectSetInteger(0,name,OBJPROP_BGCOLOR,bg);
   ObjectSetInteger(0,name,OBJPROP_COLOR,border);
   ObjectSetInteger(0,name,OBJPROP_BORDER_TYPE,BORDER_FLAT);
   ObjectSetInteger(0,name,OBJPROP_WIDTH,1);
   ObjectSetInteger(0,name,OBJPROP_BACK,false);
   ObjectSetInteger(0,name,OBJPROP_SELECTABLE,false);
}

void CreateLbl(string name, int x, int y, string text, color clr, int sz, bool bold)
{
   if(ObjectFind(0,name)>=0) ObjectDelete(0,name);
   ObjectCreate(0,name,OBJ_LABEL,0,0,0);
   ObjectSetInteger(0,name,OBJPROP_CORNER,CORNER_LEFT_UPPER);
   ObjectSetInteger(0,name,OBJPROP_XDISTANCE,x);
   ObjectSetInteger(0,name,OBJPROP_YDISTANCE,y);
   ObjectSetString(0,name,OBJPROP_TEXT,text);
   ObjectSetInteger(0,name,OBJPROP_COLOR,clr);
   ObjectSetInteger(0,name,OBJPROP_FONTSIZE,sz);
   ObjectSetString(0,name,OBJPROP_FONT,bold?"Arial Bold":"Arial");
   ObjectSetInteger(0,name,OBJPROP_BACK,false);
   ObjectSetInteger(0,name,OBJPROP_SELECTABLE,false);
}

void SetText(string name, string text) { ObjectSetString(0,name,OBJPROP_TEXT,text); }
void SetColor(string name, color clr)  { ObjectSetInteger(0,name,OBJPROP_COLOR,clr); }

void DeletePanel()
{
   for(int i = ObjectsTotal(0,0,-1)-1; i>=0; i--)
   { string n=ObjectName(0,i); if(StringFind(n,PREFIX)==0) ObjectDelete(0,n); }
   ChartRedraw();
}
//+------------------------------------------------------------------+
