//+------------------------------------------------------------------+
//|                                                NexusFX_SMCBot.mq5|
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

input double RiskPercent = 1.0;
input int    MaxPositions= 3; // จำกัดจำนวนไม้ Pyramiding
input ulong  MagicNumber = 11111;

int OnInit() { 
   trade.SetExpertMagicNumber(MagicNumber); 
   DASH_PREFIX = "NXSMC_";
   Dash_CreatePanel("NexusFX SMCBot (Pro)", MagicNumber);
   return(INIT_SUCCEEDED); 
}
void OnDeinit(const int reason) { Dash_DeletePanel(); }

void OnTick()
{
   int pos = PositionsTotal();
   double pnl = 0;
   for(int i=0; i<pos; i++) if(PositionGetSymbol(i)==_Symbol) pnl+=PositionGetDouble(POSITION_PROFIT);
   
   string sigStatus = (pos > 0) ? "IN TRADE" : "SCANNING (FVG)";
   color  sigColor  = (pos > 0) ? BuyColor : NeutralColor;
   Dash_UpdatePanel(sigStatus, sigColor, pos, pnl);

   if(pos >= MaxPositions) return;
   if(pos > 0 && pnl <= 0) return; // ออกเพิ่มเฉพาะตอนกำไร
   if(!g_DashIsRunning) return; // ถ้ากด Stop Bot ไว้ ไม่ให้เปิดไม้ใหม่

   // SMC Logic: Detect Bullish/Bearish Fair Value Gap (FVG)
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   if(CopyRates(_Symbol, PERIOD_CURRENT, 1, 3, rates) < 3) return;
   
   double gapBullish = rates[0].low - rates[2].high; // Candle 3 Low > Candle 1 High
   double gapBearish = rates[2].low - rates[0].high; // Candle 3 High < Candle 1 Low
   
   double lot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN); // Basic lot
   
   if(gapBullish > 0 && rates[1].close > rates[1].open) // Bullish FVG
   {
      string bName = "FVG_B_" + IntegerToString(rates[1].time);
      if(ObjectFind(0, bName) < 0) {
         ObjectCreate(0, bName, OBJ_RECTANGLE, 0, rates[2].time, rates[2].high, rates[0].time, rates[0].low);
         ObjectSetInteger(0, bName, OBJPROP_COLOR, clrGold); 
         ObjectSetInteger(0, bName, OBJPROP_BACK, true);
         ObjectSetInteger(0, bName, OBJPROP_FILL, true);
      }
      double sl = rates[2].low;
      trade.Buy(lot, _Symbol, 0, sl, 0, "SMC Buy FVG");
   }
   else if(gapBearish > 0 && rates[1].close < rates[1].open) // Bearish FVG
   {
      string bName = "FVG_S_" + IntegerToString(rates[1].time);
      if(ObjectFind(0, bName) < 0) {
         ObjectCreate(0, bName, OBJ_RECTANGLE, 0, rates[2].time, rates[0].high, rates[0].time, rates[2].low);
         ObjectSetInteger(0, bName, OBJPROP_COLOR, clrDarkOrchid);
         ObjectSetInteger(0, bName, OBJPROP_BACK, true);
         ObjectSetInteger(0, bName, OBJPROP_FILL, true);
      }
      double sl = rates[2].high;
      trade.Sell(lot, _Symbol, 0, sl, 0, "SMC Sell FVG");
   }
}
