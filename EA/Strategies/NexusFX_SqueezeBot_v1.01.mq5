//+------------------------------------------------------------------+
//|                                           NexusFX_SqueezeBot.mq5 |
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
input int      BB_Period   = 20;
input double   BB_Dev      = 2.0;
input double   SqueezePips = 100.0; // Distance max for sideway box
input ulong    MagicNumber = 88881;

int handleBB;
double bbUpBuf[], bbLowBuf[];

int OnInit() {
   trade.SetExpertMagicNumber(MagicNumber);
   handleBB = iBands(_Symbol, PERIOD_CURRENT, BB_Period, 0, BB_Dev, PRICE_CLOSE);
   ArraySetAsSeries(bbUpBuf, true);
   ArraySetAsSeries(bbLowBuf, true);
   DASH_PREFIX = "NXSqz_";
   Dash_CreatePanel("NexusFX SqueezeBot", MagicNumber);
   return INIT_SUCCEEDED;
}
void OnDeinit(const int reason) { IndicatorRelease(handleBB); Dash_DeletePanel(); }

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
   
   string sigStatus = (pos > 0) ? "IN TRADE" : "SCAN BB SQUEEZE";
   Dash_UpdatePanel(sigStatus, (pos > 0) ? BuyColor : NeutralColor, pos, pnl);

   if(pos > 0) return; // One trade at a time

   if(CopyBuffer(handleBB, 1, 0, 2, bbUpBuf) < 2) return;
   if(CopyBuffer(handleBB, 2, 0, 2, bbLowBuf) < 2) return;

   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   
   double prevBBWidth = (bbUpBuf[1] - bbLowBuf[1]) / point;
   
   // ถ้าบีบแคบจนเป็นคอขวด (Sideways) แล้วระเบิดทะลุขอบ
   if(prevBBWidth < SqueezePips) 
   {
      double lot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
      
      if(ask > bbUpBuf[0]) 
      {
         trade.Buy(lot, _Symbol, ask, bbLowBuf[0], 0, "Squeeze Buy");
      }
      else if(bid < bbLowBuf[0]) 
      {
         trade.Sell(lot, _Symbol, bid, bbUpBuf[0], 0, "Squeeze Sell");
      }
   }
}
