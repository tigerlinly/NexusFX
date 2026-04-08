//+------------------------------------------------------------------+
//|                                                NexusFX_VSABot.mq5|
//|                                    Copyright 2026, NexusFX Corp. |
//| Created: 2026-04-01                                              |
//| Updated: 2026-04-08                                              |
//+------------------------------------------------------------------+
#property copyright "NexusFX"
#property link      "https://nexusfx.biz"
#property version   "1.00"

#include <Trade\Trade.mqh>
#include "NexusFX_Dashboard_v2.mqh"
CTrade trade;

input ulong  MagicNumber = 55555;
input double VolThreshold = 2.0;

int OnInit() { 
   trade.SetExpertMagicNumber(MagicNumber); 
   DASH_PREFIX = "NXVSA_";
   Dash_CreatePanel("NexusFX Wyckoff VSA", MagicNumber);
   return(INIT_SUCCEEDED); 
}
void OnDeinit(const int reason) { Dash_DeletePanel(); }

void OnTick()
{
   int pos = PositionsTotal();
   double pnl = 0;
   for(int i=0; i<pos; i++) if(PositionGetSymbol(i)==_Symbol) pnl+=PositionGetDouble(POSITION_PROFIT);
   
   string sigStatus = (pos > 0) ? "IN TRADE" : "SCAN VOLUME";
   Dash_UpdatePanel(sigStatus, (pos > 0) ? BuyColor : NeutralColor, pos, pnl);

   if(pos > 0) return;

   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   if(CopyRates(_Symbol, PERIOD_CURRENT, 1, 10, rates) < 10) return;

   // VSA Logic: Analyze High Volume on Narrow Spread
   double avgVol = 0;
   for(int i=1; i<10; i++) avgVol += (double)rates[i].tick_volume;
   avgVol /= 9;

   double spread0 = rates[0].high - rates[0].low;
   double vol0 = (double)rates[0].tick_volume;

   if(vol0 > avgVol * VolThreshold && spread0 < SymbolInfoDouble(_Symbol, SYMBOL_POINT) * 100)
   {
      double lot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
      
      if(rates[0].close > rates[0].low + (spread0 * 0.7))
      {
         trade.Buy(lot, _Symbol, 0, rates[0].low, 0, "VSA Accumulation");
      }
      else if(rates[0].close < rates[0].low + (spread0 * 0.3))
      {
         trade.Sell(lot, _Symbol, 0, rates[0].high, 0, "VSA Distribution");
      }
   }
}
