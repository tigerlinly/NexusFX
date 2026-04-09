//+------------------------------------------------------------------+
//|                                                NexusFX_SMCBot.mq5|
//|                                    Copyright 2026, NexusFX Corp. |
//+------------------------------------------------------------------+
#property copyright "NexusFX"
#property link      "https://nexusfx.biz"
#property version   "3.00" // Institutional Grade Edition

#include <Trade\Trade.mqh>
#include "NexusFX_Dashboard_v2.mqh"
CTrade trade;

// ============================================================
// INPUT PARAMETERS
// ============================================================
input string   RunMagic = "SMCBot";      // SMCBot for Bot, SMC for App Auto
input ulong    MagicNumber = 905;

// --- Timeframe Settings ---
input ENUM_TIMEFRAMES EntryTF = PERIOD_M15;    // TF ที่ใช้หา FVG (Fair Value Gap)
input ENUM_TIMEFRAMES TrendTF = PERIOD_H1;     // TF ที่ใช้ดู Trend (SMA Filter)
input int      Trend_MA_Period = 200;

// --- Pyramiding (การสับไม้) ---
input int      MaxPositions       = 5;         // SMC ไม้น้อย ปรับไว้ที่ 5 ไม้ เต็มที่
input double   ScaleStepPips      = 20.0;  
input double   ScaleLotMultiplier = 0.5;       // ยิ่งสับยิ่งเล็กลง ลดความผันผวนเวลาโดนลาก

// --- Risk Management & Target ---
input double   RiskPercent          = 1.0;     // คำนวณ Lot จากทุน
input double   DailyProfitTargetPct = 3.0;     // หยุดเมื่อกำไรชนเป้า/วัน
input double   DailyDrawdownPct     = 5.0;     // ตัดขาดทุนถ้าลบเกินเป้า/วัน
input int      MaxSpreadPoints      = 30;      // 30 points = 3 pips
input double   InitialTPPips        = 500.0;   // รันกำไร SMC มักจะยาว

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
int    handleTrendMA;
double pointUnit;
bool   haltForToday = false;
int    currentDayCheck = 0;

int OnInit() { 
   trade.SetExpertMagicNumber(MagicNumber); 
   
   pointUnit = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   if(SymbolInfoInteger(_Symbol, SYMBOL_DIGITS) == 5 || SymbolInfoInteger(_Symbol, SYMBOL_DIGITS) == 3) {
       pointUnit *= 10;
   }
   
   handleTrendMA = iMA(_Symbol, TrendTF, Trend_MA_Period, 0, MODE_SMA, PRICE_CLOSE);
   
   DASH_PREFIX = "NXSMC_";
   Dash_CreatePanel("NexusFX SMCBot (Pro)", MagicNumber, EnumToString(EntryTF), EnumToString(TrendTF));
   return(INIT_SUCCEEDED); 
}
void OnDeinit(const int reason) { 
   IndicatorRelease(handleTrendMA);
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

double CalculateDynamicLot(double slRiskPips, double riskPct) {
   if(riskPct <= 0) return SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
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

string GetOrderComment(string actionParams) {
   string entryTfStr = EnumToString(EntryTF); string trendTfStr = EnumToString(TrendTF);
   StringReplace(entryTfStr, "PERIOD_", ""); StringReplace(trendTfStr, "PERIOD_", "");
   return StringFormat("%s (%s/%s) %s", RunMagic, entryTfStr, trendTfStr, actionParams);
}

//+------------------------------------------------------------------+
// ON TICK LOGIC
//+------------------------------------------------------------------+
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
   string sigStatus = haltForToday ? "HALT (Daily Limit Reached)" : ((totalPos > 0) ? "IN TRADE (Scaling)" : "SCANNING (FVG)");
   Dash_UpdatePanel(sigStatus, haltForToday ? clrRed : ((totalPos > 0) ? BuyColor : NeutralColor), totalPos, pnl);

   if(!g_DashIsRunning || haltForToday) return;

   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);

   // ============================================================
   // 1. Entry Order (FVG Detection + Session & Spread filter)
   // ============================================================
   if (totalPos == 0 && IsInSession() && IsSpreadOK() && IsNewBar()) { 
      MqlRates rates[];
      ArraySetAsSeries(rates, true);
      // อ่านข้อมูล 3 แท่งก่อนหน้า (ดึงจาก index 1 ถึง 3 ของ History)
      if(CopyRates(_Symbol, EntryTF, 1, 3, rates) == 3) {
         double gapBullish = rates[0].low - rates[2].high; // Candle 1 Low > Candle 3 High
         double gapBearish = rates[2].low - rates[0].high; // Candle 3 Low > Candle 1 High
         
         int trend = GetTrendDirection();

         if(gapBullish > 0 && rates[1].close > rates[1].open && trend >= 0) // Bullish FVG
         {
            string bName = "FVG_B_" + IntegerToString((int)rates[1].time);
            if(ObjectFind(0, bName) < 0) {
               ObjectCreate(0, bName, OBJ_RECTANGLE, 0, rates[2].time, rates[2].high, rates[0].time, rates[0].low);
               ObjectSetInteger(0, bName, OBJPROP_COLOR, clrGold); 
               ObjectSetInteger(0, bName, OBJPROP_BACK, true);
               ObjectSetInteger(0, bName, OBJPROP_FILL, true);
            }
            
            double sl = rates[2].low; // Swing Low of the starting candle
            double slPips = (ask - sl) / pointUnit;
            double lotToOpen = CalculateDynamicLot(slPips, RiskPercent);
            double tp = ask + (InitialTPPips * pointUnit);
            
            trade.Buy(lotToOpen, _Symbol, ask, sl, tp, GetOrderComment("FVG Buy"));
         }
         else if(gapBearish > 0 && rates[1].close < rates[1].open && trend <= 0) // Bearish FVG
         {
            string bName = "FVG_S_" + IntegerToString((int)rates[1].time);
            if(ObjectFind(0, bName) < 0) {
               ObjectCreate(0, bName, OBJ_RECTANGLE, 0, rates[2].time, rates[0].high, rates[0].time, rates[2].low);
               ObjectSetInteger(0, bName, OBJPROP_COLOR, clrDarkOrchid);
               ObjectSetInteger(0, bName, OBJPROP_BACK, true);
               ObjectSetInteger(0, bName, OBJPROP_FILL, true);
            }
            
            double sl = rates[2].high; // Swing High of the starting candle
            double slPips = (sl - bid) / pointUnit;
            double lotToOpen = CalculateDynamicLot(slPips, RiskPercent);
            double tp = bid - (InitialTPPips * pointUnit);
            
            trade.Sell(lotToOpen, _Symbol, bid, sl, tp, GetOrderComment("FVG Sell"));
         }
      }
   }

   // ============================================================
   // 2. Pyramiding Dynamic Lot (Anti-Martingale)
   // ============================================================
   if (totalPos > 0 && totalPos < MaxPositions && IsInSession() && IsSpreadOK()) {
      if (posBuy > 0 && ask >= lastBuyPrice + (ScaleStepPips * pointUnit)) {
          // ใช้ SL ที่กว้างพอประมาณสำหรับการ Scale In SMC
          double sl = bid - ((ScaleStepPips*2) * pointUnit);
          double tp = ask + (InitialTPPips * pointUnit);
          double scaleLot = CalculateScaleLot(lastBuyLot);
          trade.Buy(scaleLot, _Symbol, 0, sl, tp, GetOrderComment(StringFormat("Scale BUY #%d", totalPos+1)));
      }
      else if (posSell > 0 && bid <= lastSellPrice - (ScaleStepPips * pointUnit)) {
          double sl = ask + ((ScaleStepPips*2) * pointUnit);
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
