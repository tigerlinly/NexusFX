//+------------------------------------------------------------------+
//|                                       NexusFX_AlphaScalper.mq5 |
//|                                    Copyright 2026, NexusFX Corp. |
//+------------------------------------------------------------------+
#property copyright "NexusFX"
#property link      "https://nexusfx.biz"
#property version   "3.00" // Institutional Grade Edition

#include <Trade\Trade.mqh>
#include "NexusFX_Dashboard.mqh"
CTrade trade;

input string   RunMagic = "AlphaScalper";      // "AlphaScalper" for Bot, "AlphaScalper" for App Auto
input ulong    MagicNumber = 901;

input ENUM_TIMEFRAMES EntryTF = PERIOD_M5;
input ENUM_TIMEFRAMES TrendTF = PERIOD_H1;

// --- Scalping & Trailing ---
input double   RiskPercent          = 2.0;    // ซิ่งหน่อยเพื่อ Max Profit
input int      RSI_Period           = 7;      // RSI ไวๆ
input int      Trend_MA_Period      = 50; 
input double   InitialSLPips        = 50.0;   // SL แคบ
input double   TrailingStartPips    = 15.0;   // รีบยกบังทุนทันที
input double   TrailingDistancePips = 5.0;    

// --- Risk Limits ---
input double   DailyProfitTargetPct = 10.0;   
input double   DailyDrawdownPct     = 5.0;    
input int      MaxSpreadPoints      = 15;     // เคร่งครัดมาก (1.5 pips)
input bool     UseSessionFilter = true;       // Scalp ควรเล่นตอนมีสภาพคล่อง
input int      SessionStartHour = 14;         // London
input int      SessionEndHour   = 22;         // NY

int handleRSI, handleMA;
double pointUnit;
bool haltForToday = false;
int currentDayCheck = 0;

int OnInit() {
   trade.SetExpertMagicNumber(MagicNumber);
   handleRSI = iRSI(_Symbol, EntryTF, RSI_Period, PRICE_CLOSE);
   handleMA  = iMA(_Symbol, TrendTF, Trend_MA_Period, 0, MODE_EMA, PRICE_CLOSE);
   
   pointUnit = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   if(SymbolInfoInteger(_Symbol, SYMBOL_DIGITS) == 5 || SymbolInfoInteger(_Symbol, SYMBOL_DIGITS) == 3) pointUnit *= 10;

   DASH_PREFIX = "NXALP_";
   Dash_CreatePanel("NexusFX Alpha Scalper", MagicNumber, EnumToString(EntryTF), EnumToString(TrendTF));
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) { IndicatorRelease(handleRSI); IndicatorRelease(handleMA); Dash_DeletePanel(); }

bool IsSpreadOK() { return (MaxSpreadPoints <= 0 || SymbolInfoInteger(_Symbol, SYMBOL_SPREAD) <= MaxSpreadPoints); }
bool IsInSession() {
   if(!UseSessionFilter) return true;
   MqlDateTime dt; TimeToStruct(TimeCurrent(), dt);
   return (dt.hour >= SessionStartHour && dt.hour <= SessionEndHour);
}
bool IsNewBar() {
   static datetime lastT = 0; datetime curT = iTime(_Symbol, EntryTF, 0);
   if(curT != lastT) { lastT = curT; return true; } return false;
}

void CheckDailyTargetAndDrawdown() {
   MqlDateTime dt; TimeToStruct(TimeCurrent(), dt);
   if(currentDayCheck != dt.day_of_year) { currentDayCheck = dt.day_of_year; haltForToday = false; }
   if(haltForToday) return;

   HistorySelect(iTime(_Symbol, PERIOD_D1, 0), TimeCurrent());
   double dailyNet = 0;
   for(int i=0; i<HistoryDealsTotal(); i++) {
      ulong d = HistoryDealGetTicket(i);
      if(HistoryDealGetInteger(d, DEAL_MAGIC) == MagicNumber) dailyNet += HistoryDealGetDouble(d, DEAL_PROFIT) + HistoryDealGetDouble(d, DEAL_COMMISSION) + HistoryDealGetDouble(d, DEAL_SWAP);
   }
   for(int i=PositionsTotal()-1; i>=0; i--) {
      if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == MagicNumber) dailyNet += PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
   }
   double pPct = (dailyNet / AccountInfoDouble(ACCOUNT_BALANCE)) * 100.0;
   if(DailyProfitTargetPct > 0 && pPct >= DailyProfitTargetPct) haltForToday = true;
   if(DailyDrawdownPct > 0 && pPct <= -DailyDrawdownPct) haltForToday = true;
}

double GetDynamicLot(double slPips) {
   if(slPips <= 0 || RiskPercent <= 0) return SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double risk = AccountInfoDouble(ACCOUNT_BALANCE) * (RiskPercent / 100.0);
   double vStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   double pVal = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE) / SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   double lot = risk / (slPips * pointUnit * pVal);
   return MathMax(SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN), MathFloor(lot / vStep) * vStep);
}

void OnTick() {
   CheckDailyTargetAndDrawdown();
   int pos = 0; double pnl = 0;
   for(int i=PositionsTotal()-1; i>=0; i--) {
      if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == MagicNumber) {
         pos++; pnl += PositionGetDouble(POSITION_PROFIT);
      }
   }
   Dash_UpdatePanel(haltForToday ? "HALT" : (pos > 0 ? "SCALPING" : "SCANNING"), haltForToday ? clrRed : clrLime, pos, pnl);
   if(haltForToday || !g_DashIsRunning) return;

   // 1. Manage Trailing Stop (Max Profit logic)
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   for(int i=PositionsTotal()-1; i>=0; i--) {
      if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == MagicNumber) {
         ulong ticket = PositionGetInteger(POSITION_TICKET);
         double open = PositionGetDouble(POSITION_PRICE_OPEN);
         double sl = PositionGetDouble(POSITION_SL);
         ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
         
         if(type == POSITION_TYPE_BUY) {
            if(bid > open + (TrailingStartPips * pointUnit)) {
               double newSL = bid - (TrailingDistancePips * pointUnit);
               if(newSL > sl) trade.PositionModify(ticket, newSL, 0);
            }
         } else {
            if(ask < open - (TrailingStartPips * pointUnit)) {
               double newSL = ask + (TrailingDistancePips * pointUnit);
               if(newSL < sl || sl == 0) trade.PositionModify(ticket, newSL, 0);
            }
         }
      }
   }

   // 2. Entry Logic
   if(pos == 0 && IsInSession() && IsSpreadOK() && IsNewBar()) {
      double rBuf[], mBuf[]; ArraySetAsSeries(rBuf, true); ArraySetAsSeries(mBuf, true);
      CopyBuffer(handleRSI, 0, 1, 2, rBuf); CopyBuffer(handleMA, 0, 1, 2, mBuf);
      
      double price = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      double lot = GetDynamicLot(InitialSLPips);
      string cmnt = RunMagic + " Alpha Scalp";

      if(price > mBuf[0] && rBuf[0] < 30 && rBuf[1] >= 30) { // Trend Up, RSI crossover from oversold
         trade.Buy(lot, _Symbol, ask, ask - (InitialSLPips * pointUnit), 0, cmnt);
      }
      else if(price < mBuf[0] && rBuf[0] > 70 && rBuf[1] <= 70) {
         trade.Sell(lot, _Symbol, bid, bid + (InitialSLPips * pointUnit), 0, cmnt);
      }
   }
}
