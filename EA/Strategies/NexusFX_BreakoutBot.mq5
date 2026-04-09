//+------------------------------------------------------------------+
//|                                          NexusFX_BreakoutBot.mq5 |
//|                                    Copyright 2026, NexusFX Corp. |
////+------------------------------------------------------------------+
#property copyright "NexusFX"
#property link      "https://nexusfx.biz"
#property version   "2.00" // Institutional Grade Edition

#include <Trade\Trade.mqh>
#include "..\world_class_bots\NexusFX_Dashboard_v2.mqh"
CTrade trade;

// ============================================================
// INPUT PARAMETERS
// ============================================================
input string   RunMagic = "BreakoutBot"; // BreakoutBot for Bot, Breakout for App Auto
input ulong    MagicNumber = 101;

// --- Signal Config ---
input ENUM_TIMEFRAMES BreakoutTF = PERIOD_M15; 
input ENUM_TIMEFRAMES TrendTF    = PERIOD_H1;  
input int      Trend_MA_Period   = 200;        
input int      Lookback          = 20;         

// --- Pyramiding (การสับไม้) ---
input int      MaxPositions       = 50;   
input double   ScaleStepPips      = 20.0;  
input double   ScaleLotMultiplier = 0.5; // ยิ่งสับยิ่งเล็กลง ลดความผันผวนเวลาโดนลาก

// --- Risk Management & Target ---
input double   RiskPercent          = 1.0;     // คำนวณ Lot จากทุน
input double   DailyProfitTargetPct = 3.0;     // หยุดเมื่อกำไรชนเป้า/วัน
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
double pointUnit;
int    handleTrendMA;
bool   haltForToday = false;
int    currentDayCheck = 0;

int OnInit() {
   trade.SetExpertMagicNumber(MagicNumber);
   DASH_PREFIX = "NXBrk_";
   Dash_CreatePanel("Nexus Breakout Bot", MagicNumber);
   
   pointUnit = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   if(SymbolInfoInteger(_Symbol, SYMBOL_DIGITS) == 5 || SymbolInfoInteger(_Symbol, SYMBOL_DIGITS) == 3) {
       pointUnit *= 10;
   }

   handleTrendMA = iMA(_Symbol, TrendTF, Trend_MA_Period, 0, MODE_SMA, PRICE_CLOSE);
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) { 
   IndicatorRelease(handleTrendMA);
   Dash_DeletePanel(); 
}

bool IsNewBar() {
   static datetime lastTime = 0;
   datetime currTime = iTime(_Symbol, BreakoutTF, 0);
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

int GetTrendDirection() {
   double maVal[]; ArraySetAsSeries(maVal, true);
   if(CopyBuffer(handleTrendMA, 0, 0, 1, maVal) < 1) return 0;

   double price = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   if(price > maVal[0]) return  1; // Uptrend
   if(price < maVal[0]) return -1; // Downtrend
   return 0;
}

string GetOrderComment(string actionParams) {
   string entryTfStr = EnumToString(BreakoutTF); string trendTfStr = EnumToString(TrendTF);
   StringReplace(entryTfStr, "PERIOD_", ""); StringReplace(trendTfStr, "PERIOD_", "");
   return StringFormat("%s Breakout (%s/%s) %s", RunMagic, entryTfStr, trendTfStr, actionParams);
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
   string sigStatus = haltForToday ? "HALT (Daily Limit Reached)" : ((totalPos > 0) ? "IN TRADE (Scaling)" : "WAITING BREAKOUT");
   Dash_UpdatePanel(sigStatus, haltForToday ? clrRed : ((totalPos > 0) ? BuyColor : NeutralColor), totalPos, pnl);

   if(!g_DashIsRunning || haltForToday) return; 

   double highData[], lowData[];
   ArraySetAsSeries(highData, true); ArraySetAsSeries(lowData, true);
   
   if(CopyHigh(_Symbol, BreakoutTF, 1, Lookback, highData) < Lookback) return;
   if(CopyLow(_Symbol, BreakoutTF, 1, Lookback, lowData) < Lookback) return;
   
   double Brk_Max = highData[ArrayMaximum(highData, 0, WHOLE_ARRAY)];
   double Brk_Min = lowData[ArrayMinimum(lowData, 0, WHOLE_ARRAY)];

   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);

   // --- วาดเส้น Zone ---
   if(ObjectFind(0, "Brk_Max") < 0) ObjectCreate(0, "Brk_Max", OBJ_HLINE, 0, 0, Brk_Max);
   ObjectSetDouble(0, "Brk_Max", OBJPROP_PRICE, Brk_Max); ObjectSetInteger(0, "Brk_Max", OBJPROP_COLOR, clrCyan); ObjectSetInteger(0, "Brk_Max", OBJPROP_STYLE, STYLE_DASH);
   
   if(ObjectFind(0, "Brk_Min") < 0) ObjectCreate(0, "Brk_Min", OBJ_HLINE, 0, 0, Brk_Min);
   ObjectSetDouble(0, "Brk_Min", OBJPROP_PRICE, Brk_Min); ObjectSetInteger(0, "Brk_Min", OBJPROP_COLOR, clrMagenta); ObjectSetInteger(0, "Brk_Min", OBJPROP_STYLE, STYLE_DASH);
   ChartRedraw();
   // -------------------------------------------------------------

   // ============================================================
   // 1. Entry Order (With Spread & Session)
   // ============================================================
   if (totalPos == 0 && IsInSession() && IsSpreadOK()) {
      int trend = GetTrendDirection();
      double lotToOpen = CalculateDynamicLot(RiskPercent);
      
      if(ask > Brk_Max && trend >= 0) {
         double sl = MathMax(Brk_Min, ask - (InitialSLPips * pointUnit));
         double tp = ask + (InitialTPPips * pointUnit);
         trade.Buy(lotToOpen, _Symbol, ask, sl, tp, GetOrderComment("Breakout UP"));
         return;
      }
      else if(bid < Brk_Min && trend <= 0) {
         double sl = MathMin(Brk_Max, bid + (InitialSLPips * pointUnit));
         double tp = bid - (InitialTPPips * pointUnit);
         trade.Sell(lotToOpen, _Symbol, bid, sl, tp, GetOrderComment("Breakout DOWN"));
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
      double tbLow  = iLow(_Symbol, BreakoutTF, iLowest(_Symbol, BreakoutTF, MODE_LOW, TrailingBars, 1));
      double tbHigh = iHigh(_Symbol, BreakoutTF, iHighest(_Symbol, BreakoutTF, MODE_HIGH, TrailingBars, 1));

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
