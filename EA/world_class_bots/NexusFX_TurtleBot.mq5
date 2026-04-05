//+------------------------------------------------------------------+
//|                                             NexusFX_TurtleBot.mq5|
//|                                    Copyright 2026, NexusFX Corp. |
//+------------------------------------------------------------------+
#property copyright "NexusFX"
#property link      "https://nexusfx.biz"
#property version   "1.00"

#include <Trade\Trade.mqh>
#include "NexusFX_Dashboard_v2.mqh"
CTrade trade;

input int    DonchianPeriod = 20;
input int    ATRPeriod      = 14;
input double RiskPercent    = 1.0;
input ulong  MagicNumber    = 22222;

int handleATR;
double atrBuf[];

int OnInit() 
{ 
   trade.SetExpertMagicNumber(MagicNumber); 
   handleATR = iATR(_Symbol, PERIOD_CURRENT, ATRPeriod);
   ArraySetAsSeries(atrBuf, true);
   DASH_PREFIX = "NXTUR_";
   Dash_CreatePanel("NexusFX TurtleBot", MagicNumber);
   return(INIT_SUCCEEDED); 
}
void OnDeinit(const int reason) { 
   IndicatorRelease(handleATR); 
   Dash_DeletePanel(); 
}

void OnTick()
{
   int pos = PositionsTotal();
   double pnl = 0;
   for(int i=0; i<pos; i++) if(PositionGetSymbol(i)==_Symbol) pnl+=PositionGetDouble(POSITION_PROFIT);
   
   string sigStatus = (pos > 0) ? "IN TRADE" : "WAITING BREAKOUT";
   Dash_UpdatePanel(sigStatus, (pos > 0) ? BuyColor : NeutralColor, pos, pnl);

   if(pos > 0) return;

   double high20[], low20[];
   if(CopyHigh(_Symbol, PERIOD_CURRENT, 1, DonchianPeriod, high20) < DonchianPeriod) return;
   if(CopyLow(_Symbol, PERIOD_CURRENT, 1, DonchianPeriod, low20) < DonchianPeriod) return;
   if(CopyBuffer(handleATR, 0, 0, 1, atrBuf) < 1) return;

   double maxH = high20[ArrayMaximum(high20, 0, WHOLE_ARRAY)];
   double minL = low20[ArrayMinimum(low20, 0, WHOLE_ARRAY)];
   
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double lot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN); // Replace with ATR math
   double atr = atrBuf[0];

   if(ask > maxH) 
   {
      trade.Buy(lot, _Symbol, ask, ask - (atr * 2), ask + (atr * 6), "Turtle Buy");
   }
   else if(bid < minL)
   {
      trade.Sell(lot, _Symbol, bid, bid + (atr * 2), bid - (atr * 6), "Turtle Sell");
   }
}
