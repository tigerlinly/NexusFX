//+------------------------------------------------------------------+
//|                                         NexusFX_GridMaster.mq5|
//|                                    Copyright 2026, NexusFX Corp. |
//+------------------------------------------------------------------+
#property copyright "NexusFX"
#property link      "https://nexusfx.biz"
#property version   "3.01"

#include <Trade\Trade.mqh>
#include "NexusFX_Dashboard.mqh"
CTrade trade;

input string   RunMagic = "GridMaster";
input ulong    MagicNumber = 902;
input ENUM_TIMEFRAMES EntryTF = PERIOD_H1;
input ENUM_TIMEFRAMES TrendTF = PERIOD_D1;

// --- Adaptive Grid Parameters ---
input double   InitialBaseLot       = 0.01;
input double   GridMultiplier       = 1.3;    // Martingale อ่อนๆ ไม่ให้ล้างพอร์ตไว
input int      MaxGridLevels        = 10;     // จำกัดกระสุน (รักษากำไรระยะยาว)
input double   GridSpacingBasePips  = 200.0;  // ฐานระยะห่าง
input bool     UseATRSpacing        = true;   // เปิดใช้ระยะกริดยืดหยุ่นตามความรุนแรงกราฟ
input int      ATR_Period           = 14;

// --- Profit Booking ---
input double   BasketProfitTarget   = 20.0;   // เก็บเงินสดต่อรอบตาข่าย (Account Currency)
input double   DailyProfitTargetPct = 5.0;
input double   DailyDrawdownPct     = 10.0;

int handleATR;
double pointUnit;
bool haltForToday = false;
int currentDayCheck = 0;

int OnInit() {
   trade.SetExpertMagicNumber(MagicNumber);
   handleATR = iATR(_Symbol, EntryTF, ATR_Period);
   pointUnit = (SymbolInfoInteger(_Symbol, SYMBOL_DIGITS) == 5 || SymbolInfoInteger(_Symbol, SYMBOL_DIGITS) == 3) ? SymbolInfoDouble(_Symbol, SYMBOL_POINT) * 10 : SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   DASH_PREFIX = "NXGRD_"; Dash_CreatePanel("NexusFX Grid Master", MagicNumber, EnumToString(EntryTF), EnumToString(TrendTF));
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) { IndicatorRelease(handleATR); Dash_DeletePanel(); }

void CheckDailyTargetAndDrawdown() {
   MqlDateTime dt; TimeToStruct(TimeCurrent(), dt);
   if(currentDayCheck != dt.day_of_year) { currentDayCheck = dt.day_of_year; haltForToday = false; }
   if(haltForToday) return;

   HistorySelect(iTime(_Symbol, PERIOD_D1, 0), TimeCurrent());
   double dailyNet = 0;
   for(int i=0; i<HistoryDealsTotal(); i++) { ulong d = HistoryDealGetTicket(i); if(HistoryDealGetInteger(d, DEAL_MAGIC) == MagicNumber) dailyNet += HistoryDealGetDouble(d, DEAL_PROFIT) + HistoryDealGetDouble(d, DEAL_COMMISSION) + HistoryDealGetDouble(d, DEAL_SWAP); }
   for(int i=PositionsTotal()-1; i>=0; i--) { if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == MagicNumber) dailyNet += PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP); }
   
   double pPct = (dailyNet / AccountInfoDouble(ACCOUNT_BALANCE)) * 100.0;
   if(DailyProfitTargetPct > 0 && pPct >= DailyProfitTargetPct) haltForToday = true;
   if(DailyDrawdownPct > 0 && pPct <= -DailyDrawdownPct) haltForToday = true;
}

string GetOrderComment(string actionParams) {
   string entryTfStr = EnumToString(EntryTF); string trendTfStr = EnumToString(TrendTF);
   StringReplace(entryTfStr, "PERIOD_", ""); StringReplace(trendTfStr, "PERIOD_", "");
   return StringFormat("%s (%s/%s) %s", RunMagic, entryTfStr, trendTfStr, actionParams);
}

void OnTick() {
   CheckDailyTargetAndDrawdown();
   int pBuy = 0, pSell = 0;
   double netPnl = 0, lastBuyPrice = 0, lastSellPrice = 9999999, lastBuyVol = 0, lastSellVol = 0;
   for(int i=PositionsTotal()-1; i>=0; i--) {
      if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == MagicNumber) {
         netPnl += PositionGetDouble(POSITION_PROFIT);
         double pr = PositionGetDouble(POSITION_PRICE_OPEN);
         double vol = PositionGetDouble(POSITION_VOLUME);
         if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) { pBuy++; if(pr < lastBuyPrice || lastBuyPrice==0) { lastBuyPrice = pr; lastBuyVol = vol; } }
         else { pSell++; if(pr > lastSellPrice || lastSellPrice==9999999) { lastSellPrice = pr; lastSellVol = vol; } }
      }
   }
   
   int tot = pBuy + pSell;
   Dash_UpdatePanel(haltForToday ? "HALT" : (tot > 0 ? "AUTO GRIDING" : "WAITING"), haltForToday ? clrRed : clrDodgerBlue, tot, netPnl);
   
   // 1. Cut Profit Basket
   if(tot > 0 && netPnl >= BasketProfitTarget) {
      for(int i=PositionsTotal()-1; i>=0; i--) if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == MagicNumber) trade.PositionClose(PositionGetTicket(i));
      return;
   }
   if(haltForToday || !g_DashIsRunning) return;

   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK), bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double vStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);

   // 2. Adaptive Spacing logic
   double spacing = GridSpacingBasePips * pointUnit;
   if(UseATRSpacing) { double aBuf[]; if(CopyBuffer(handleATR, 0, 0, 1, aBuf) > 0) spacing = MathMax(spacing, aBuf[0] * 1.5); } // Minimum = Base, Adaptive = 1.5 ATR

   // 3. Grid Engine
   if(tot == 0) {
      trade.Buy(InitialBaseLot, _Symbol, ask, 0, 0, GetOrderComment("Grid Start B"));
      trade.Sell(InitialBaseLot, _Symbol, bid, 0, 0, GetOrderComment("Grid Start S"));
   } else {
      if(pBuy > 0 && pBuy < MaxGridLevels && ask <= lastBuyPrice - spacing) {
         double nextLot = MathMax(SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN), MathFloor((lastBuyVol * GridMultiplier) / vStep) * vStep);
         trade.Buy(nextLot, _Symbol, ask, 0, 0, GetOrderComment("Grid Buy"));
      }
      if(pSell > 0 && pSell < MaxGridLevels && bid >= lastSellPrice + spacing) {
         double nextLot = MathMax(SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN), MathFloor((lastSellVol * GridMultiplier) / vStep) * vStep);
         trade.Sell(nextLot, _Symbol, bid, 0, 0, GetOrderComment("Grid Sell"));
      }
   }
}
