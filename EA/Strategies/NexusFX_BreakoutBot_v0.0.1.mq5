//+------------------------------------------------------------------+
//|                                          NexusFX_BreakoutBot.mq5 |
//|                                    Copyright 2026, NexusFX Corp. |
//+------------------------------------------------------------------+
#property copyright "NexusFX"
#property link      "https://nexusfx.biz"
#property version   "0.0.1"

#include <Trade\Trade.mqh>
#include "world_class_bots\NexusFX_Dashboard_v2.mqh"
CTrade trade;

input double   RiskPercent = 1.0;
input ENUM_TIMEFRAMES BreakoutTF = PERIOD_H1;
input int      Lookback    = 20;
input ulong    MagicNumber = 88883;

int OnInit() {
   trade.SetExpertMagicNumber(MagicNumber);
   DASH_PREFIX = "NXBrk_";
   Dash_CreatePanel("NexusFX BreakoutBot", MagicNumber);
   return INIT_SUCCEEDED;
}
void OnDeinit(const int reason) { Dash_DeletePanel(); }

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
   
   string sigStatus = (pos > 0) ? "IN TRADE" : "WAITING BREAKOUT";
   Dash_UpdatePanel(sigStatus, (pos > 0) ? BuyColor : NeutralColor, pos, pnl);

   if(pos > 0) return;

   double highData[], lowData[];
   ArraySetAsSeries(highData, true);
   ArraySetAsSeries(lowData, true);
   
   if(CopyHigh(_Symbol, BreakoutTF, 1, Lookback, highData) < Lookback) return;
   if(CopyLow(_Symbol, BreakoutTF, 1, Lookback, lowData) < Lookback) return;
   
   double H1_Max = highData[ArrayMaximum(highData, 0, WHOLE_ARRAY)];
   double H1_Min = lowData[ArrayMinimum(lowData, 0, WHOLE_ARRAY)];

   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double lot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);

   // ทะลุกรอบ High รอสวน
   if(ask > H1_Max)
   {
      trade.Buy(lot, _Symbol, ask, H1_Min, 0, "Breakout UP");
   }
   // ทะลุกรอบ Low รอสวน
   else if(bid < H1_Min)
   {
      trade.Sell(lot, _Symbol, bid, H1_Max, 0, "Breakout DOWN");
   }
}
