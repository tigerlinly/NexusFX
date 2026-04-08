//+------------------------------------------------------------------+
//|                                          NexusFX_BreakoutBot.mq5 |
//|                                    Copyright 2026, NexusFX Corp. |
//| Created: 2026-04-01                                              |
//| Updated: 2026-04-08                                              |
//+------------------------------------------------------------------+
#property copyright "NexusFX"
#property link      "https://nexusfx.biz"
#property version   "1.02" // Updated version

#include <Trade\Trade.mqh>
#include "..\world_class_bots\NexusFX_Dashboard_v2.mqh"
CTrade trade;

input double   RiskPercent = 1.0;
input ENUM_TIMEFRAMES BreakoutTF = PERIOD_H1;
input int      Lookback    = 20;
input ulong    MagicNumber = 88883;

// --- การเข้าไม้ & สับไม้ (Pyramiding) ---
input int      MaxPositions   = 300;   // จำกัดจำนวนไม้ (Pyramiding)
input double   ScaleStepPips  = 10.0;  // ระยะห่างสับไม้ (Pips)

// --- การจัดการความเสี่ยง (Risk Management) ---
input double   InitialSLPips  = 200.0; // SL สูงสุด (กรณีทะลุกรอบกว้างมาก)
input double   BreakevenPips  = 30.0;  // ระยะล็อคหน้าทุน
input double   LockProfitPips = 5.0;   // ล็อคกำไร
input bool     TrailByBar     = true;  // ขยับ SL ตามแท่งเทียน

double pointUnit;

int OnInit() {
   trade.SetExpertMagicNumber(MagicNumber);
   DASH_PREFIX = "NXBrk_";
   Dash_CreatePanel("Nexus Breakout Bot", MagicNumber);
   
   pointUnit = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   if(SymbolInfoInteger(_Symbol, SYMBOL_DIGITS) == 5 || SymbolInfoInteger(_Symbol, SYMBOL_DIGITS) == 3) {
       pointUnit *= 10;
   }
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) { Dash_DeletePanel(); }

bool IsNewBar() {
   static datetime lastTime = 0;
   datetime currTime = iTime(_Symbol, PERIOD_CURRENT, 0);
   if (currTime != lastTime) { lastTime = currTime; return true; }
   return false;
}

void OnTick() {
   int posBuy = 0, posSell = 0;
   double pnl = 0;
   double lastBuyPrice = 0, lastSellPrice = 999999;
   
   for(int i = PositionsTotal()-1; i >= 0; i--) {
      if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == MagicNumber) {
         ENUM_POSITION_TYPE pType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
         pnl += PositionGetDouble(POSITION_PROFIT);
         double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
         
         if(pType == POSITION_TYPE_BUY) {
            posBuy++;
            if(openPrice > lastBuyPrice) lastBuyPrice = openPrice;
         } else if(pType == POSITION_TYPE_SELL) {
            posSell++;
            if(openPrice < lastSellPrice) lastSellPrice = openPrice;
         }
      }
   }
   
   int totalPos = posBuy + posSell;
   string sigStatus = (totalPos > 0) ? "IN TRADE (Scaling)" : "WAITING BREAKOUT";
   Dash_UpdatePanel(sigStatus, (totalPos > 0) ? BuyColor : NeutralColor, totalPos, pnl);

   if(!g_DashIsRunning) return; 

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

   // --- วาดเส้น Zone ---
   if(ObjectFind(0, "Brk_Max") < 0) ObjectCreate(0, "Brk_Max", OBJ_HLINE, 0, 0, H1_Max);
   ObjectSetDouble(0, "Brk_Max", OBJPROP_PRICE, H1_Max);
   ObjectSetInteger(0, "Brk_Max", OBJPROP_COLOR, clrCyan);
   ObjectSetInteger(0, "Brk_Max", OBJPROP_STYLE, STYLE_DASH);
   
   if(ObjectFind(0, "Brk_Min") < 0) ObjectCreate(0, "Brk_Min", OBJ_HLINE, 0, 0, H1_Min);
   ObjectSetDouble(0, "Brk_Min", OBJPROP_PRICE, H1_Min);
   ObjectSetInteger(0, "Brk_Min", OBJPROP_COLOR, clrMagenta);
   ObjectSetInteger(0, "Brk_Min", OBJPROP_STYLE, STYLE_DASH);
   ChartRedraw();
   // -------------------------------------------------------------

   // 1. Entry Order
   if (totalPos == 0) {
      if(ask > H1_Max) {
         double sl = MathMax(H1_Min, ask - (InitialSLPips * pointUnit));
         trade.Buy(lot, _Symbol, ask, sl, 0, "Breakout UP");
         return;
      }
      else if(bid < H1_Min) {
         double sl = MathMin(H1_Max, bid + (InitialSLPips * pointUnit));
         trade.Sell(lot, _Symbol, bid, sl, 0, "Breakout DOWN");
         return;
      }
   }
   
   // 2. Pyramiding (สับไม้)
   if (totalPos > 0 && totalPos < MaxPositions) {
      if (posBuy > 0 && ask >= lastBuyPrice + (ScaleStepPips * pointUnit)) {
          double sl = bid - (InitialSLPips * pointUnit);
          trade.Buy(lot, _Symbol, 0, sl, 0, "Scale-In Breakout Buy");
      }
      else if (posSell > 0 && bid <= lastSellPrice - (ScaleStepPips * pointUnit)) {
          double sl = ask + (InitialSLPips * pointUnit);
          trade.Sell(lot, _Symbol, 0, sl, 0, "Scale-In Breakout Sell");
      }
   }

   // 3. Breakeven & Trailing Bar
   bool newBar = IsNewBar();
   double low1   = iLow(_Symbol, PERIOD_CURRENT, 1);
   double high1  = iHigh(_Symbol, PERIOD_CURRENT, 1);

   for(int i = PositionsTotal()-1; i >= 0; i--) {
      if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == MagicNumber) {
         ulong  ticket = PositionGetInteger(POSITION_TICKET);
         double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
         double slPrice   = PositionGetDouble(POSITION_SL);
         ENUM_POSITION_TYPE pType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
         
         double breakevenSL = 0.0;
         double newSL = slPrice;
         
         if(pType == POSITION_TYPE_BUY) {
            if (bid >= openPrice + (BreakevenPips * pointUnit)) {
               breakevenSL = openPrice + (LockProfitPips * pointUnit);
               if (slPrice < breakevenSL) newSL = breakevenSL;
            }
            if (TrailByBar && newBar && newSL >= openPrice) {
               double trailTarget = low1 - (2 * pointUnit);
               if (trailTarget > newSL && trailTarget < bid - (10 * pointUnit)) newSL = trailTarget;
            }
         } 
         else if(pType == POSITION_TYPE_SELL) {
            if (ask <= openPrice - (BreakevenPips * pointUnit)) {
               breakevenSL = openPrice - (LockProfitPips * pointUnit);
               if (slPrice > breakevenSL || slPrice == 0) newSL = breakevenSL; 
            }
            if (TrailByBar && newBar && (newSL <= openPrice || newSL == 0)) {
               double trailTarget = high1 + (2 * pointUnit);
               if ((trailTarget < newSL || newSL == 0) && trailTarget > ask + (10 * pointUnit)) newSL = trailTarget;
            }
         }
         
         if (newSL != slPrice && newSL != 0) {
            trade.PositionModify(ticket, newSL, PositionGetDouble(POSITION_TP));
         }
      }
   }
}

