//+------------------------------------------------------------------+
//|                                     NexusFX_FollowerTrend.mq5 |
//|                                    Copyright 2026, NexusFX Corp. |
//+------------------------------------------------------------------+
#property copyright "NexusFX"
#property link      "https://nexusfx.biz"
#property version   "3.00" // Institutional Grade Edition

#include <Trade\Trade.mqh>
#include "NexusFX_Dashboard.mqh"
CTrade trade;

// ============================================================
// INPUT PARAMETERS
// ============================================================
input string   RunMagic = "FollowerTrend";        // FollowerTrend for Bot, FollowerTrend for App Auto
input ulong    MagicNumber = 103;

// --- Timeframe Settings ---
input ENUM_TIMEFRAMES EntryTF = PERIOD_M15;    // TF ที่ใช้หาจุดเข้าและ Fast EMA
input ENUM_TIMEFRAMES TrendTF = PERIOD_H1;     // TF ที่ใช้ดู Trend (Slow EMA)

// --- กลยุทธ์ (Strategy Settings) ---
input int      FastEMA     = 50;
input int      SlowEMA     = 200;

// --- Pyramiding (การสับไม้) ---
input int      MaxPositions       = 50;   
input double   ScaleStepPips      = 20.0;  
input double   ScaleLotMultiplier = 0.5;       // ยิ่งสับยิ่งเล็กลง ลดความผันผวนเวลาโดนลาก
input double   TestPullbackPips   = 40.0;      // ระยะย่อออกไม้เทส (ก่อนชนแนวเทรนด์)

// --- Risk Management & Target ---
input double   RiskPercent          = 1.0;     // คำนวณ Lot จากทุน
input double   DailyProfitTargetPct = 0.0;     // หยุดเมื่อกำไรชนเป้า/วัน
input double   DailyDrawdownPct     = 5.0;     // ตัดขาดทุนถ้าลบเกินเป้า/วัน
input int      MaxSpreadPoints      = 30;      // 30 points = 3 pips
input double   InitialSLPips        = 200.0; 
input double   InitialTPPips        = 1000.0;

// --- Session Filter ---
input bool     UseSessionFilter = false;       // หากมีสัญญาณแต่ไม่ใช่เวลา จะเข้าหรือไม่ (false = เข้าชัวร์)
input int      SessionStartHour = 14;          // ตลาดยุโรป
input int      SessionEndHour   = 22;          // ตลาดอเมริกา

// --- Breakeven & Trailing ---
input double   BreakevenPips  = 30.0;  
input double   LockProfitPips = 5.0;   
input int      TrailingBars    = 2;    

// ============================================================
// GLOBAL STATE
// ============================================================
int handleFast, handleSlow;
double pointUnit;
bool   haltForToday = false;
int    currentDayCheck = 0;

int OnInit() {
   trade.SetExpertMagicNumber(MagicNumber);
   
   handleFast = iMA(_Symbol, EntryTF, FastEMA, 0, MODE_EMA, PRICE_CLOSE);
   handleSlow = iMA(_Symbol, TrendTF, SlowEMA, 0, MODE_EMA, PRICE_CLOSE);
   
   // --- วาดเส้น EMA ลงกราฟเพื่อให้ผู้ใช้มองเห็นเทรนด์ (Visual Trend) ---
   ChartIndicatorAdd(0, 0, handleFast);
   ChartIndicatorAdd(0, 0, handleSlow);
   
   pointUnit = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   if(SymbolInfoInteger(_Symbol, SYMBOL_DIGITS) == 5 || SymbolInfoInteger(_Symbol, SYMBOL_DIGITS) == 3) {
       pointUnit *= 10;
   }
   
   DASH_PREFIX = "NXTrd_";
   Dash_CreatePanel("Follower Trend Bot", MagicNumber, EnumToString(EntryTF), EnumToString(TrendTF));
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) { 
   IndicatorRelease(handleFast); 
   IndicatorRelease(handleSlow); 
   Dash_DeletePanel(); 
}

bool IsNewBar() {
   static datetime lastTime = 0;
   datetime currTime = iTime(_Symbol, EntryTF, 0);
   if (currTime != lastTime) { lastTime = currTime; return true; }
   return false;
}

//+------------------------------------------------------------------+
// FILTER HELPER FUNCTIONS
//+------------------------------------------------------------------+
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

double CalculateDynamicLot(double riskPct) {
   if(riskPct <= 0) return SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double moneyRisk = AccountInfoDouble(ACCOUNT_BALANCE) * (riskPct / 100.0);
   double tpv = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   double ts = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   double slPts = InitialSLPips * (pointUnit / SymbolInfoDouble(_Symbol, SYMBOL_POINT));
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

string GetOrderComment(string actionParams) {
   string entryTfStr = EnumToString(EntryTF); string trendTfStr = EnumToString(TrendTF);
   StringReplace(entryTfStr, "PERIOD_", ""); StringReplace(trendTfStr, "PERIOD_", "");
   return StringFormat("%s TrendFollower (%s/%s) %s", RunMagic, entryTfStr, trendTfStr, actionParams);
}

//+------------------------------------------------------------------+
// ON TICK LOGIC
//+------------------------------------------------------------------+
void OnTick() {
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
   string sigStatus = haltForToday ? "HALT (Daily Limit Reached)" : ((totalPos > 0) ? "IN TRADE (Scaling)" : "SCAN PA @ TREND");
   Dash_UpdatePanel(sigStatus, haltForToday ? clrRed : ((totalPos > 0) ? BuyColor : NeutralColor), totalPos, pnl);

   if(!g_DashIsRunning || haltForToday) return; 

   double fastBuf[], slowBuf[];
   ArraySetAsSeries(fastBuf, true); ArraySetAsSeries(slowBuf, true);
   if(CopyBuffer(handleFast, 0, 0, 2, fastBuf) < 2) return;
   if(CopyBuffer(handleSlow, 0, 0, 2, slowBuf) < 2) return;

   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   
   bool isUptrend   = fastBuf[0] > slowBuf[0];
   bool isDowntrend = fastBuf[0] < slowBuf[0];

   double open1  = iOpen(_Symbol, EntryTF, 1);
   double close1 = iClose(_Symbol, EntryTF, 1);
   double high1  = iHigh(_Symbol, EntryTF, 1);
   double low1   = iLow(_Symbol, EntryTF, 1);
   
   double open2  = iOpen(_Symbol, EntryTF, 2);
   double close2 = iClose(_Symbol, EntryTF, 2);
   
   bool isPullbackRedToGreen = (close2 < open2) && (close1 > open1);
   bool isPullbackGreenToRed = (close2 > open2) && (close1 < open1);

   bool isBullishPA = (close1 > open1) && (low1 <= fastBuf[1] && close1 >= fastBuf[1]); 
   bool isBearishPA = (close1 < open1) && (high1 >= fastBuf[1] && close1 <= fastBuf[1]); 

   bool isBullishTest = isPullbackRedToGreen && (low1 > fastBuf[1]) && (low1 <= fastBuf[1] + (TestPullbackPips * pointUnit));
   bool isBearishTest = isPullbackGreenToRed && (high1 < fastBuf[1]) && (high1 >= fastBuf[1] - (TestPullbackPips * pointUnit));

   // ============================================================
   // 1. Entry Order (With Spread & Session)
   // ============================================================
   if (totalPos == 0 && IsInSession() && IsSpreadOK()) {
      double lotToOpen = CalculateDynamicLot(RiskPercent);
      
      if (isUptrend && isBullishPA) {
         double sl = bid - (InitialSLPips * pointUnit);
         double tp = ask + (InitialTPPips * pointUnit);
         trade.Buy(lotToOpen, _Symbol, 0, sl, tp, GetOrderComment("PA Trend Buy"));
         return;
      }
      else if (isDowntrend && isBearishPA) {
         double sl = ask + (InitialSLPips * pointUnit);
         double tp = bid - (InitialTPPips * pointUnit);
         trade.Sell(lotToOpen, _Symbol, 0, sl, tp, GetOrderComment("PA Trend Sell"));
         return;
      }
      else if (isUptrend && isBullishTest) {
         double sl = bid - (InitialSLPips * pointUnit);
         double tp = ask + (InitialTPPips * pointUnit);
         trade.Buy(lotToOpen, _Symbol, 0, sl, tp, GetOrderComment("Test Order Buy"));
         return;
      }
      else if (isDowntrend && isBearishTest) {
         double sl = ask + (InitialSLPips * pointUnit);
         double tp = bid - (InitialTPPips * pointUnit);
         trade.Sell(lotToOpen, _Symbol, 0, sl, tp, GetOrderComment("Test Order Sell"));
         return;
      }
   }
   
   // ============================================================
   // 2. Pyramiding Dynamic Lot (Anti-Martingale)
   // ============================================================
   if (totalPos > 0 && totalPos < MaxPositions && IsInSession() && IsSpreadOK()) {
      if (posBuy > 0 && ask >= lastBuyPrice + (ScaleStepPips * pointUnit)) {
          double sl = bid - (InitialSLPips * pointUnit);
          double tp = ask + (InitialTPPips * pointUnit);
          double scaleLot = CalculateScaleLot(lastBuyLot);
          trade.Buy(scaleLot, _Symbol, 0, sl, tp, GetOrderComment(StringFormat("Scale BUY #%d", totalPos+1)));
      }
      else if (posSell > 0 && bid <= lastSellPrice - (ScaleStepPips * pointUnit)) {
          double sl = ask + (InitialSLPips * pointUnit);
          double tp = bid - (InitialTPPips * pointUnit);
          double scaleLot = CalculateScaleLot(lastSellLot);
          trade.Sell(scaleLot, _Symbol, 0, sl, tp, GetOrderComment(StringFormat("Scale SELL #%d", totalPos+1)));
      }
   }

   // ============================================================
   // 3. Breakeven & Trailing Bar
   // ============================================================
   if(IsNewBar() && totalPos > 0) {
      double tbLow  = iLow(_Symbol, EntryTF, iLowest(_Symbol, EntryTF, MODE_LOW, TrailingBars, 1));
      double tbHigh = iHigh(_Symbol, EntryTF, iHighest(_Symbol, EntryTF, MODE_HIGH, TrailingBars, 1));

      for(int i = PositionsTotal()-1; i >= 0; i--) {
         if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == MagicNumber) {
            ulong  ticket = PositionGetInteger(POSITION_TICKET);
            double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
            double slPrice   = PositionGetDouble(POSITION_SL);
            double tpPrice   = PositionGetDouble(POSITION_TP);
            ENUM_POSITION_TYPE pType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
            
            double newSL = slPrice;
            
            if(pType == POSITION_TYPE_BUY) {
               if(bid >= openPrice + (BreakevenPips * pointUnit)) {
                  double beSL = openPrice + (LockProfitPips * pointUnit);
                  if (slPrice < beSL) newSL = beSL;
               }
               if(newSL >= openPrice) {
                  double trailTarget = tbLow - (2 * pointUnit);
                  if (trailTarget > newSL && trailTarget < bid - (10 * pointUnit)) newSL = trailTarget;
               }
            } 
            else if(pType == POSITION_TYPE_SELL) {
               if(ask <= openPrice - (BreakevenPips * pointUnit)) {
                  double beSL = openPrice - (LockProfitPips * pointUnit);
                  if (slPrice > beSL || slPrice == 0) newSL = beSL; 
               }
               if(newSL <= openPrice || newSL == 0) {
                  double trailTarget = tbHigh + (2 * pointUnit);
                  if ((trailTarget < newSL || newSL == 0) && trailTarget > ask + (10 * pointUnit)) newSL = trailTarget;
               }
            }
            
            if (newSL != slPrice && newSL != 0) {
               trade.PositionModify(ticket, newSL, tpPrice);
            }
         }
      }
   }
}
