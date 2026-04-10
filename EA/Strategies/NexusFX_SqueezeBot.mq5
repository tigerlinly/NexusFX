//+------------------------------------------------------------------+
//|                                           NexusFX_SqueezeBot.mq5 |
//|                                    Copyright 2026, NexusFX Corp. |
//+------------------------------------------------------------------+
#property copyright "NexusFX"
#property link      "https://nexusfx.biz"
#property version   "3.01" // Institutional Grade Edition

#include <Trade\Trade.mqh>
#include "NexusFX_Dashboard.mqh"
CTrade trade;

// ============================================================
// INPUT PARAMETERS
// ============================================================
input string   RunMagic = "SqueezeBot";  
input ulong    MagicNumber = 102;

// --- Timeframe Settings ---
input ENUM_TIMEFRAMES EntryTF = PERIOD_M15;    
input ENUM_TIMEFRAMES TrendTF = PERIOD_H4;     

// --- Pyramiding (การสับไม้) ---
input int      MaxPositions       = 50;           
input double   ScaleStepPips      = 20.0;         
input double   ScaleLotMultiplier = 0.5; // ป้องกันความเสี่ยง ออกไม้สับเล็กลงครึ่งนึง (Anti-Martingale)

// --- Risk Management & Target ---
input double   RiskPercent          = 1.0;    // คำนวณ Lot จาก % ทุน
input double   DailyProfitTargetPct = 0.0;    // เลิกเทรดเมื่อกำไรถึง % ต่อวัน
input double   DailyDrawdownPct     = 5.0;    // เลิกเทรดเมื่อลบถึง % ต่อวัน
input int      MaxSpreadPoints      = 30;     // ป้องกันช่วงข่าว Spread ถ่าง (30 points = 3 pips)
input double   InitialSLPips        = 200.0;  
input double   InitialTPPips        = 1000.0; 

// --- Session Filter ---
input bool     UseSessionFilter = false;      // ตั้ง false เพื่อให้เข้าเทรดได้ตลอดถ้าสัญญาณสวย
input int      SessionStartHour = 14;         // London Open
input int      SessionEndHour   = 22;         // NY Overlap End

// --- Trailing Stop & Breakeven ---
input double   BreakevenPips   = 30.0;         
input double   LockProfitPips  = 5.0;          
input int      TrailingBars    = 2;            

// --- Indicators Config ---
input int      BB_Period       = 20;
input double   BB_Dev          = 2.0;
input int      KC_ATR_Period   = 20;
input double   KC_Multiplier   = 1.5;
input int      Trend_MA_Period = 200;
input int      MACD_Fast = 12, MACD_Slow = 26, MACD_Signal = 9;

// ============================================================
// GLOBAL HANDLES
// ============================================================
int    handleBB, handleKC_ATR, handleMACD, handleTrend_MA;
double pointUnit;
bool   haltForToday = false;
int    currentDayCheck = 0;

//+------------------------------------------------------------------+
int OnInit() {
   trade.SetExpertMagicNumber(MagicNumber);
   handleBB       = iBands(_Symbol, EntryTF, BB_Period, 0, BB_Dev, PRICE_CLOSE);
   handleKC_ATR   = iATR(_Symbol, EntryTF, KC_ATR_Period);
   handleMACD     = iMACD(_Symbol, EntryTF, MACD_Fast, MACD_Slow, MACD_Signal, PRICE_CLOSE);
   handleTrend_MA = iMA(_Symbol, TrendTF, Trend_MA_Period, 0, MODE_SMA, PRICE_CLOSE);

   DASH_PREFIX = "NXSqz_";
   Dash_CreatePanel("Nexus Squeeze Bot", MagicNumber, EnumToString(EntryTF), EnumToString(TrendTF));

   pointUnit = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   if(SymbolInfoInteger(_Symbol, SYMBOL_DIGITS) == 5 || SymbolInfoInteger(_Symbol, SYMBOL_DIGITS) == 3)
      pointUnit *= 10;

   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) {
   IndicatorRelease(handleBB); IndicatorRelease(handleKC_ATR);
   IndicatorRelease(handleMACD); IndicatorRelease(handleTrend_MA);
   Dash_DeletePanel();
}

bool IsNewBar() {
   static datetime lastTime = 0;
   datetime currTime = iTime(_Symbol, EntryTF, 0); 
   if(currTime != lastTime) { lastTime = currTime; return true; }
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
      haltForToday = false; // รีเซ็ตทุกวันใหม่
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

//+------------------------------------------------------------------+
// VOLUME SPIKE FILTER
//+------------------------------------------------------------------+
bool HasVolumeSpike() {
   long vol[]; ArraySetAsSeries(vol, true);
   if(CopyTickVolume(_Symbol, EntryTF, 0, 21, vol) < 21) return false;
   long sum = 0; for(int i = 1; i <= 20; i++) sum += vol[i];
   double avgVol = (double)sum / 20.0;
   return ((double)vol[0] > (avgVol * 1.5) || (double)vol[1] > (avgVol * 1.5));
}

//+------------------------------------------------------------------+
// SQUEEZE DETECT & SIGNAL
//+------------------------------------------------------------------+
bool IsSqueezeOn() {
   double bbUp[], bbLow[], bbMid[], atr[];
   ArraySetAsSeries(bbUp, true); ArraySetAsSeries(bbLow, true);
   ArraySetAsSeries(bbMid, true); ArraySetAsSeries(atr, true);
   if(CopyBuffer(handleBB, 1, 1, 1, bbUp) < 1) return true;
   if(CopyBuffer(handleBB, 2, 1, 1, bbLow) < 1) return true;
   if(CopyBuffer(handleBB, 0, 1, 1, bbMid) < 1) return true;
   if(CopyBuffer(handleKC_ATR, 0, 1, 1, atr) < 1) return true;

   double mid = bbMid[0];
   double kcUp = mid + (KC_Multiplier * atr[0]);
   double kcLow = mid - (KC_Multiplier * atr[0]);
   return (bbUp[0] <= kcUp && bbLow[0] >= kcLow); 
}

int GetMomentumDirection() {
   double macdHist[]; ArraySetAsSeries(macdHist, true);
   if(CopyBuffer(handleMACD, 2, 1, 3, macdHist) < 3) return 0;
   if(macdHist[0] > 0 && macdHist[1] > 0) return  1; 
   if(macdHist[0] < 0 && macdHist[1] < 0) return -1; 
   return 0;
}

int GetTrendDirection() {
   double maVal[]; ArraySetAsSeries(maVal, true);
   if(CopyBuffer(handleTrend_MA, 0, 0, 1, maVal) < 1) return 0;
   double price = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   if(price > maVal[0]) return  1;
   if(price < maVal[0]) return -1;
   return 0;
}

string GetOrderComment(string actionParams) {
   string eTfStr = EnumToString(EntryTF); StringReplace(eTfStr, "PERIOD_", "");
   string tTfStr = EnumToString(TrendTF); StringReplace(tTfStr, "PERIOD_", "");
   return StringFormat("%s Squeeze (%s/%s) %s", RunMagic, eTfStr, tTfStr, actionParams);
}

//+------------------------------------------------------------------+
// CORE LOGIC UPDATE
//+------------------------------------------------------------------+
void OnTick() {
   CheckDailyTargetAndDrawdown(); // 4. Daily Target Check

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
         } else { 
            posSell++; if(openPrice < lastSellPrice) { lastSellPrice = openPrice; lastSellLot = vol; }
         }
      }
   }

   int totalPos = posBuy + posSell;
   bool squeezeOn = IsSqueezeOn();
   
   string dashStatus = haltForToday ? "HALT (Daily Limit Reached)" : (totalPos > 0) ? "IN TRADE (Scaling)" : (squeezeOn ? "SQZ ON (Accumulating)" : "SQZ OFF (Fire!)");
   Dash_UpdatePanel(dashStatus, haltForToday ? clrRed : ((totalPos > 0) ? BuyColor : (squeezeOn ? NeutralColor : clrLime)), totalPos, pnl);

   if(!g_DashIsRunning || haltForToday) return;

   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);

   // ============================================================
   // 1. SMART ENTRY (Session & Spread filter)
   // ============================================================
   if(totalPos == 0 && !squeezeOn && HasVolumeSpike() && IsInSession() && IsSpreadOK()) { 
      int momentum = GetMomentumDirection();
      int trend    = GetTrendDirection();
      double lotToOpen = CalculateDynamicLot(RiskPercent);

      if(momentum == 1 && trend >= 0) {
         double sl = ask - (InitialSLPips * pointUnit);
         double tp = ask + (InitialTPPips * pointUnit);
         trade.Buy(lotToOpen, _Symbol, ask, sl, tp, GetOrderComment("Fire BUY"));
      }
      else if(momentum == -1 && trend <= 0) {
         double sl = bid + (InitialSLPips * pointUnit);
         double tp = bid - (InitialTPPips * pointUnit);
         trade.Sell(lotToOpen, _Symbol, bid, sl, tp, GetOrderComment("Fire SELL"));
      }
   }

   // ============================================================
   // 2. PROFIT-BASED PYRAMIDING & DYNAMIC LOT (Anti-Martingale)
   // ============================================================
   if(totalPos > 0 && totalPos < MaxPositions && IsSpreadOK() && IsInSession()) {
      if(posBuy > 0 && ask >= lastBuyPrice + (ScaleStepPips * pointUnit)) {
         double sl = bid - (InitialSLPips * pointUnit);
         double tp = ask + (InitialTPPips * pointUnit);
         double scaleLot = CalculateScaleLot(lastBuyLot); // สับไม้เริ่มเล็กลง
         trade.Buy(scaleLot, _Symbol, 0, sl, tp, GetOrderComment(StringFormat("Scale BUY #%d", totalPos+1)));
      }
      else if(posSell > 0 && bid <= lastSellPrice - (ScaleStepPips * pointUnit)) {
         double sl = ask + (InitialSLPips * pointUnit);
         double tp = bid - (InitialTPPips * pointUnit);
         double scaleLot = CalculateScaleLot(lastSellLot); // สับไม้เริ่มเล็กลง
         trade.Sell(scaleLot, _Symbol, 0, sl, tp, GetOrderComment(StringFormat("Scale SELL #%d", totalPos+1)));
      }
   }

   // ============================================================
   // 3. ADVANCED TRAILING STOP & BREAKEVEN
   // ============================================================
   if(IsNewBar() && totalPos > 0) {
      double tbLow  = iLow(_Symbol, EntryTF, iLowest(_Symbol, EntryTF, MODE_LOW, TrailingBars, 1));
      double tbHigh = iHigh(_Symbol, EntryTF, iHighest(_Symbol, EntryTF, MODE_HIGH, TrailingBars, 1));

      for(int i = PositionsTotal()-1; i >= 0; i--) {
         if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == MagicNumber) {
            ulong  ticket    = PositionGetInteger(POSITION_TICKET);
            double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
            double slPrice   = PositionGetDouble(POSITION_SL);
            double tpPrice   = PositionGetDouble(POSITION_TP);
            ENUM_POSITION_TYPE pType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);

            double newSL = slPrice;

            if(pType == POSITION_TYPE_BUY) {
               if(bid >= openPrice + (BreakevenPips * pointUnit)) {
                  double beSL = openPrice + (LockProfitPips * pointUnit);
                  if(slPrice < beSL) newSL = beSL;
               }
               if(newSL >= openPrice) {
                  double trailTarget = tbLow - (2 * pointUnit); 
                  if(trailTarget > newSL && trailTarget < bid - (10 * pointUnit)) newSL = trailTarget;
               }
            } else { 
               if(ask <= openPrice - (BreakevenPips * pointUnit)) {
                  double beSL = openPrice - (LockProfitPips * pointUnit);
                  if(slPrice > beSL || slPrice == 0) newSL = beSL;
               }
               if(newSL <= openPrice || newSL == 0) {
                  double trailTarget = tbHigh + (2 * pointUnit);
                  if((trailTarget < newSL || newSL == 0) && trailTarget > ask + (10 * pointUnit)) newSL = trailTarget;
               }
            }

            if(newSL != slPrice && newSL != 0) {
               trade.PositionModify(ticket, newSL, tpPrice);
            }
         }
      }
   }
}
