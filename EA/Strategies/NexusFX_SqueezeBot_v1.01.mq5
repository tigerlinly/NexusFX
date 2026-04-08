//+------------------------------------------------------------------+
//|                                           NexusFX_SqueezeBot.mq5 |
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
input int      BB_Period   = 20;
input double   BB_Dev      = 2.0;
input double   SqueezePips = 100.0; // Distance max for sideway box
input ulong    MagicNumber = 88881;

// --- การเข้าไม้ & สับไม้ (Pyramiding) ---
input int      MaxPositions   = 300;   // จำกัดจำนวนไม้ (Pyramiding)
input double   ScaleStepPips  = 10.0;  // ระยะห่างสับไม้ (Pips)

// --- การจัดการความเสี่ยง (Risk Management) ---
input double   InitialSLPips  = 200.0; // SL เบื้องต้น (กรณีทะลุกรอบแรง)
input double   BreakevenPips  = 30.0;  // ระยะล็อคหน้าทุน
input double   LockProfitPips = 5.0;   // ล็อคกำไร
input bool     TrailByBar     = true;  // ขยับ SL ตามแท่งเทียน

int handleBB;
double bbUpBuf[], bbLowBuf[];
double pointUnit;

int OnInit() {
   trade.SetExpertMagicNumber(MagicNumber);
   handleBB = iBands(_Symbol, PERIOD_CURRENT, BB_Period, 0, BB_Dev, PRICE_CLOSE);
   ArraySetAsSeries(bbUpBuf, true);
   ArraySetAsSeries(bbLowBuf, true);
   DASH_PREFIX = "NXSqz_";
   Dash_CreatePanel("Nexus Squeeze Bot", MagicNumber);
   ChartIndicatorAdd(0, 0, handleBB); // วาด BB ลงกราฟ
   
   pointUnit = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   if(SymbolInfoInteger(_Symbol, SYMBOL_DIGITS) == 5 || SymbolInfoInteger(_Symbol, SYMBOL_DIGITS) == 3) {
       pointUnit *= 10;
   }
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) { IndicatorRelease(handleBB); Dash_DeletePanel(); }

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
   string sigStatus = (totalPos > 0) ? "IN TRADE (Scaling)" : "SCAN BB SQUEEZE";
   Dash_UpdatePanel(sigStatus, (totalPos > 0) ? BuyColor : NeutralColor, totalPos, pnl);

   if(!g_DashIsRunning) return; 

   if(CopyBuffer(handleBB, 1, 0, 2, bbUpBuf) < 2) return;
   if(CopyBuffer(handleBB, 2, 0, 2, bbLowBuf) < 2) return;

   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double lot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   
   double prevBBWidth = (bbUpBuf[1] - bbLowBuf[1]) / pointUnit; // Using pointUnit so SqueezePips correctly compares to standard pips
   
   // 1. Entry Order
   if (totalPos == 0) {
      if(prevBBWidth < SqueezePips) 
      {
         if(ask > bbUpBuf[0]) {
            double sl = MathMax(bbLowBuf[0], ask - (InitialSLPips * pointUnit));
            trade.Buy(lot, _Symbol, ask, sl, 0, "Squeeze Buy");
            return;
         }
         else if(bid < bbLowBuf[0]) {
            double sl = MathMin(bbUpBuf[0], bid + (InitialSLPips * pointUnit));
            trade.Sell(lot, _Symbol, bid, sl, 0, "Squeeze Sell");
            return;
         }
      }
   }
   
   // 2. Pyramiding (สับไม้)
   if (totalPos > 0 && totalPos < MaxPositions) {
      if (posBuy > 0 && ask >= lastBuyPrice + (ScaleStepPips * pointUnit)) {
          double sl = bid - (InitialSLPips * pointUnit);
          trade.Buy(lot, _Symbol, 0, sl, 0, "Scale-In Squeeze Buy");
      }
      else if (posSell > 0 && bid <= lastSellPrice - (ScaleStepPips * pointUnit)) {
          double sl = ask + (InitialSLPips * pointUnit);
          trade.Sell(lot, _Symbol, 0, sl, 0, "Scale-In Squeeze Sell");
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
