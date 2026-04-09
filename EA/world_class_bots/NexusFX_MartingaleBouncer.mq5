//+------------------------------------------------------------------+
//|                                    NexusFX_MartingaleBouncer.mq5 |
//|                                    Copyright 2026, NexusFX Corp. |
//+------------------------------------------------------------------+
#property copyright "NexusFX"
#property link      "https://nexusfx.biz"
#property version   "3.01"

#include <Trade\Trade.mqh>
#include "NexusFX_Dashboard_v2.mqh"
CTrade trade;

input string   RunMagic = "MartingaleBouncer";
input ulong    MagicNumber = 903;
input ENUM_TIMEFRAMES EntryTF = PERIOD_M15;
input ENUM_TIMEFRAMES TrendTF = PERIOD_H1;

// --- Bollinger Bouncer ---
input int      BandsPeriod   = 20;
input double   BandsShift    = 2.0;
input double   BaseLot       = 0.01;

// --- High Profit Martingale ---
input double   Multiplier    = 2.0;       // เอาคืนไว (Martingale แก่นแท้)
input int      MaxSteps      = 6;         // บังคับหยุดที่ 6 ไม้ กันล้างพอร์ต!
input double   StepPips      = 150.0;     // ถ้าผิดทางเกินนี่ เปิดไม้เบิ้ล
input double   BasketTakeProfit = 10.0;   // รีบรวบเมื่อหักลบกลบหนี้ชนะ

// --- Risk Caps ---
input double   DailyProfitTargetPct = 5.0;
input double   DailyDrawdownPct     = 15.0; // Margin ลึกสำหรับ Martingale

int handleBands;
double pointUnit;
bool haltForToday = false;
int currentDayCheck = 0;

int OnInit() {
   trade.SetExpertMagicNumber(MagicNumber);
   handleBands = iBands(_Symbol, EntryTF, BandsPeriod, 0, BandsShift, PRICE_CLOSE);
   pointUnit = (SymbolInfoInteger(_Symbol, SYMBOL_DIGITS) == 5 || SymbolInfoInteger(_Symbol, SYMBOL_DIGITS) == 3) ? SymbolInfoDouble(_Symbol, SYMBOL_POINT) * 10 : SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   DASH_PREFIX = "NXMB_"; Dash_CreatePanel("NexusFX M-Bouncer", MagicNumber, EnumToString(EntryTF), EnumToString(TrendTF));
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) { IndicatorRelease(handleBands); Dash_DeletePanel(); }

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
   if(DailyDrawdownPct > 0 && pPct <= -DailyDrawdownPct) {
      // Force Hard Stop Loss & Clear
      for(int i=PositionsTotal()-1; i>=0; i--) if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == MagicNumber) trade.PositionClose(PositionGetTicket(i));
      haltForToday = true;
   }
}

bool IsNewBar() {
   static datetime lastT = 0; datetime curT = iTime(_Symbol, EntryTF, 0);
   if(curT != lastT) { lastT = curT; return true; } return false;
}

string GetOrderComment(string actionParams) {
   string entryTfStr = EnumToString(EntryTF); string trendTfStr = EnumToString(TrendTF);
   StringReplace(entryTfStr, "PERIOD_", ""); StringReplace(trendTfStr, "PERIOD_", "");
   return StringFormat("%s (%s/%s) %s", RunMagic, entryTfStr, trendTfStr, actionParams);
}

void OnTick() {
   CheckDailyTargetAndDrawdown();
   int pBuy=0, pSell=0; double netPnl=0;
   double lastBuyPrice = 0, lastSellPrice = 9999999, lastBuyVol = 0, lastSellVol = 0;
   for(int i=PositionsTotal()-1; i>=0; i--) {
      if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == MagicNumber) {
         netPnl += PositionGetDouble(POSITION_PROFIT);
         double pr = PositionGetDouble(POSITION_PRICE_OPEN), vol = PositionGetDouble(POSITION_VOLUME);
         if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) { pBuy++; if(pr < lastBuyPrice || lastBuyPrice==0) { lastBuyPrice = pr; lastBuyVol = vol; } }
         else { pSell++; if(pr > lastSellPrice || lastSellPrice==9999999) { lastSellPrice = pr; lastSellVol = vol; } }
      }
   }
   
   int tot = pBuy + pSell;
   Dash_UpdatePanel(haltForToday ? "HALT" : (tot > 0 ? "MARTINGALE ACTIVE" : "SCANNING BOUNCE"), haltForToday ? clrRed : clrMagenta, tot, netPnl);
   
   if(tot > 0 && netPnl >= BasketTakeProfit) {
      for(int i=PositionsTotal()-1; i>=0; i--) if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == MagicNumber) trade.PositionClose(PositionGetTicket(i));
      return;
   }
   if(haltForToday || !g_DashIsRunning) return;

   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK), bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double vStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);

   if(tot == 0 && IsNewBar()) {
      double up[], mb[], dn[]; ArraySetAsSeries(up, true); ArraySetAsSeries(mb, true); ArraySetAsSeries(dn, true);
      CopyBuffer(handleBands, 1, 1, 1, up); CopyBuffer(handleBands, 2, 1, 1, dn); // Pev Closed Bar
      MqlRates r[]; ArraySetAsSeries(r, true); CopyRates(_Symbol, EntryTF, 1, 1, r);
      
      // Buy if bounced from Lower Band (Closed inside)
      if(r[0].low < dn[0] && r[0].close > dn[0]) trade.Buy(BaseLot, _Symbol, ask, 0, 0, GetOrderComment("Bouncer Buy"));
      // Sell if bounced from Upper Band
      else if(r[0].high > up[0] && r[0].close < up[0]) trade.Sell(BaseLot, _Symbol, bid, 0, 0, GetOrderComment("Bouncer Sell"));
   }
   else if(tot > 0 && tot < MaxSteps) {
      double spacing = StepPips * pointUnit;
      if(pBuy > 0 && ask <= lastBuyPrice - spacing) {
         double nl = MathMax(SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN), MathFloor((lastBuyVol * Multiplier)/vStep)*vStep);
         trade.Buy(nl, _Symbol, ask, 0, 0, GetOrderComment("Margin xB"));
      }
      else if(pSell > 0 && bid >= lastSellPrice + spacing) {
         double nl = MathMax(SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN), MathFloor((lastSellVol * Multiplier)/vStep)*vStep);
         trade.Sell(nl, _Symbol, bid, 0, 0, GetOrderComment("Margin xS"));
      }
   }
}
