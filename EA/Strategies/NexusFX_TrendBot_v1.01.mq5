//+------------------------------------------------------------------+
//|                                             NexusFX_TrendBot.mq5 |
//|                                    Copyright 2026, NexusFX Corp. |
//| Created: 2026-04-01                                              |
//| Updated: 2026-04-08                                              |
//+------------------------------------------------------------------+
#property copyright "NexusFX"
#property link      "https://nexusfx.biz"
#property version   "1.01"

#include <Trade\Trade.mqh>
#include "..\world_class_bots\NexusFX_Dashboard_v2.mqh"
CTrade trade;

input double   RiskPercent = 1.0;
input int      FastEMA     = 50;
input int      SlowEMA     = 200;
input ulong    MagicNumber = 88882;

int handleFast, handleSlow;
double fastBuf[], slowBuf[];

int OnInit() {
   trade.SetExpertMagicNumber(MagicNumber);
   handleFast = iMA(_Symbol, PERIOD_CURRENT, FastEMA, 0, MODE_EMA, PRICE_CLOSE);
   handleSlow = iMA(_Symbol, PERIOD_CURRENT, SlowEMA, 0, MODE_EMA, PRICE_CLOSE);
   ArraySetAsSeries(fastBuf, true); 
   ArraySetAsSeries(slowBuf, true);
   
   DASH_PREFIX = "NXTrd_";
   Dash_CreatePanel("NexusFX TrendBot", MagicNumber);
   return INIT_SUCCEEDED;
}
void OnDeinit(const int reason) { 
   IndicatorRelease(handleFast); 
   IndicatorRelease(handleSlow); 
   Dash_DeletePanel(); 
}

void OnTick() {
   int pos = 0;
   double pnl = 0;
   for(int i=0; i<PositionsTotal(); i++) 
   {
      if(PositionGetSymbol(i)==_Symbol && PositionGetInteger(POSITION_MAGIC)==MagicNumber) {
         pos++;
         pnl += PositionGetDouble(POSITION_PROFIT);
      }
   }
   
   string sigStatus = (pos > 0) ? "IN TRADE" : "SCAN EMA CROSS";
   Dash_UpdatePanel(sigStatus, (pos > 0) ? BuyColor : NeutralColor, pos, pnl);

   if(pos > 0) return;

   if(CopyBuffer(handleFast, 0, 0, 2, fastBuf) < 2) return;
   if(CopyBuffer(handleSlow, 0, 0, 2, slowBuf) < 2) return;

   double lot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   
   // Golden Cross (เทรนด์ขาขึ้น)
   if(fastBuf[1] <= slowBuf[1] && fastBuf[0] > slowBuf[0])
   {
      double sl = SymbolInfoDouble(_Symbol, SYMBOL_BID) - (200 * point);
      trade.Buy(lot, _Symbol, 0, sl, 0, "Golden Cross Buy");
   }
   // Death Cross (เทรนด์ขาลง)
   else if(fastBuf[1] >= slowBuf[1] && fastBuf[0] < slowBuf[0])
   {
      double sl = SymbolInfoDouble(_Symbol, SYMBOL_ASK) + (200 * point);
      trade.Sell(lot, _Symbol, 0, sl, 0, "Death Cross Sell");
   }
}
