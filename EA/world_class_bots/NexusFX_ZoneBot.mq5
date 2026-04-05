//+------------------------------------------------------------------+
//|                                               NexusFX_ZoneBot.mq5|
//|                                    Copyright 2026, NexusFX Corp. |
//+------------------------------------------------------------------+
#property copyright "NexusFX"
#property link      "https://nexusfx.biz"
#property version   "1.00"

#include <Trade\Trade.mqh>
#include "NexusFX_Dashboard_v2.mqh"
CTrade trade;

input double BaseLot       = 0.01;
input double Multiplier    = 1.5;
input int    ZonePips      = 300; // Gap before hedging
input double TargetProfit  = 10.0; // Account currency
input ulong  MagicNumber   = 44444;

int OnInit() { 
   trade.SetExpertMagicNumber(MagicNumber); 
   DASH_PREFIX = "NXZON_";
   Dash_CreatePanel("NexusFX Zone Recovery", MagicNumber);
   return(INIT_SUCCEEDED); 
}
void OnDeinit(const int reason) { Dash_DeletePanel(); }

void OnTick()
{
   int totalTrades = 0;
   double netProfit = 0.0;
   double lastBuyPrice = 0, lastSellPrice = 0;

   // Analyze existing orders in recovery grid
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == MagicNumber)
      {
         totalTrades++;
         netProfit += PositionGetDouble(POSITION_PROFIT);
         double price = PositionGetDouble(POSITION_PRICE_OPEN);
         if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) lastBuyPrice = MathMax(lastBuyPrice, price);
         if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_SELL) lastSellPrice = (lastSellPrice==0) ? price : MathMin(lastSellPrice, price);
      }
   }

   string sigStatus = (totalTrades > 0) ? StringFormat("GRID LEVEL %d", totalTrades) : "WAITING";
   Dash_UpdatePanel(sigStatus, (totalTrades > 1) ? SellColor : BuyColor, totalTrades, netProfit);

   // Closure condition
   if(totalTrades > 0 && netProfit >= TargetProfit)
   {
      trade.PositionClose(_Symbol);
      return;
   }

   if(totalTrades == 0)
   {
      trade.Buy(BaseLot, _Symbol, 0, 0, 0, "Zone Initial");
      return;
   }

   // Grid trigger rule
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   double nextLot = BaseLot * MathPow(Multiplier, totalTrades);

   if(totalTrades > 0 && netProfit < 0)
   {
      if(lastBuyPrice > 0 && lastSellPrice == 0 && bid < lastBuyPrice - (ZonePips * point))
      {
         trade.Sell(nextLot, _Symbol, 0, 0, 0, "Zone Hedge Sell");
      }
      else if(lastSellPrice > 0 && lastBuyPrice == 0 && ask > lastSellPrice + (ZonePips * point))
      {
         trade.Buy(nextLot, _Symbol, 0, 0, 0, "Zone Hedge Buy");
      }
   }
}
