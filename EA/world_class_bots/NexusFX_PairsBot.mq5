//+------------------------------------------------------------------+
//|                                              NexusFX_PairsBot.mq5|
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

input string SymbolA = "EURUSD";
input string SymbolB = "GBPUSD";
input double SpreadThreshold = 0.0050; // Divergence condition
input ulong  MagicNumber = 33333;

int OnInit() { 
   trade.SetExpertMagicNumber(MagicNumber); 
   DASH_PREFIX = "NXP_";
   Dash_CreatePanel("NexusFX Stat-Arb Pairs", MagicNumber);
   return(INIT_SUCCEEDED); 
}
void OnDeinit(const int reason) { Dash_DeletePanel(); }

void OnTick()
{
   int pos = PositionsTotal();
   double pnl = 0;
   for(int i=0; i<pos; i++) if(PositionGetSymbol(i)==SymbolA || PositionGetSymbol(i)==SymbolB) pnl+=PositionGetDouble(POSITION_PROFIT);
   
   string sigStatus = (pos > 0) ? "HEDGING PAIRS" : "SCANNING SPREAD";
   Dash_UpdatePanel(sigStatus, (pos > 0) ? BuyColor : NeutralColor, pos, pnl);

   if(pos > 0) return; // Wait for positions to clear

   double priceA = SymbolInfoDouble(SymbolA, SYMBOL_BID);
   double priceB = SymbolInfoDouble(SymbolB, SYMBOL_BID);
   if(priceA == 0 || priceB == 0) return;

   // Stat Arb Logic: Mean Reversion based on historical price ratio
   double ratio = priceA / priceB;
   double meanRatio = 1.1500; // Expected historical mean

   double lot = 0.01;

   if(ratio > meanRatio + SpreadThreshold)
   {
      trade.Sell(lot, SymbolA, 0, 0, 0, "StatArb Sell A");
      trade.Buy(lot, SymbolB, 0, 0, 0, "StatArb Buy B");
   }
   else if(ratio < meanRatio - SpreadThreshold)
   {
      trade.Buy(lot, SymbolA, 0, 0, 0, "StatArb Buy A");
      trade.Sell(lot, SymbolB, 0, 0, 0, "StatArb Sell B");
   }
}
