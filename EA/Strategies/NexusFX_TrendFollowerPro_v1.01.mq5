//+------------------------------------------------------------------+
//|                                     NexusFX_TrendFollowerPro.mq5 |
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

// --- กลยุทธ์ (Strategy Settings) ---
input double   RiskPercent = 1.0;
input int      FastEMA     = 50;
input int      SlowEMA     = 200;
input ulong    MagicNumber = 88882;

// --- การเข้าไม้ & สับไม้ (Pyramiding) ---
input int      MaxPositions   = 100; // จำนวนไม้สูงสุด (สับไม้เต็มที่)
input double   ScaleStepPips  = 20.0; // ระยะห่างสับไม้ (Pips)

// --- การจัดการความเสี่ยง (Risk Management) ---
input double   InitialSLPips  = 200.0; // SL เริ่มต้น (Pips)
input double   BreakevenPips  = 30.0;  // กราฟวิ่งไปกี่ Pips ถึงจะกันหน้าทุน
input double   LockProfitPips = 5.0;   // จุดกันหน้าทุน + ล็อคกำไรนิดหน่อย (Pips)
input bool     TrailByBar     = true;  // ขยับ SL ตามแท่งเทียน (Trailing Bar)

int handleFast, handleSlow;
double fastBuf[], slowBuf[];
double pointUnit;

int OnInit() {
   trade.SetExpertMagicNumber(MagicNumber);
   handleFast = iMA(_Symbol, PERIOD_CURRENT, FastEMA, 0, MODE_EMA, PRICE_CLOSE);
   handleSlow = iMA(_Symbol, PERIOD_CURRENT, SlowEMA, 0, MODE_EMA, PRICE_CLOSE);
   ArraySetAsSeries(fastBuf, true); 
   ArraySetAsSeries(slowBuf, true);
   
   pointUnit = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   if(SymbolInfoInteger(_Symbol, SYMBOL_DIGITS) == 5 || SymbolInfoInteger(_Symbol, SYMBOL_DIGITS) == 3) {
       pointUnit *= 10; // Convert to standardized Pips
   }
   
   ChartIndicatorAdd(0, 0, handleFast);
   ChartIndicatorAdd(0, 0, handleSlow);
   
   DASH_PREFIX = "NXTrd_";
   Dash_CreatePanel("Trend Follower Pro", MagicNumber);
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) { 
   IndicatorRelease(handleFast); 
   IndicatorRelease(handleSlow); 
   Dash_DeletePanel(); 
}

bool IsNewBar() {
   static datetime lastTime = 0;
   datetime currTime = iTime(_Symbol, PERIOD_CURRENT, 0);
   if (currTime != lastTime) { lastTime = currTime; return true; }
   return false;
}

void OnTick() {
   // 1. ดึงข้อมูลสถานะไม้ทั้งหมด
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
            if(openPrice > lastBuyPrice) lastBuyPrice = openPrice; // ซื้อราคาสูงสุดรอบล่าสุด
         } else if(pType == POSITION_TYPE_SELL) {
            posSell++;
            if(openPrice < lastSellPrice) lastSellPrice = openPrice; // ขายราคาต่ำสุดรอบล่าสุด
         }
      }
   }
   
   int totalPos = posBuy + posSell;
   string sigStatus = (totalPos > 0) ? "IN TRADE (Scaling)" : "SCAN PA @ TREND";
   Dash_UpdatePanel(sigStatus, (totalPos > 0) ? BuyColor : NeutralColor, totalPos, pnl);
   
   if(!g_DashIsRunning) return; 

   // 2. ดึงข้อมูล EMA และ Price Action
   if(CopyBuffer(handleFast, 0, 0, 2, fastBuf) < 2) return;
   if(CopyBuffer(handleSlow, 0, 0, 2, slowBuf) < 2) return;

   double curPriceBid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double curPriceAsk = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double lot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   
   bool isUptrend   = fastBuf[0] > slowBuf[0];
   bool isDowntrend = fastBuf[0] < slowBuf[0];

   // ดึงข้อมูลแท่งเทียนก่อนหน้า (แท่ง [1])
   double open1  = iOpen(_Symbol, PERIOD_CURRENT, 1);
   double close1 = iClose(_Symbol, PERIOD_CURRENT, 1);
   double high1  = iHigh(_Symbol, PERIOD_CURRENT, 1);
   double low1   = iLow(_Symbol, PERIOD_CURRENT, 1);
   
   bool isBullishPA = (close1 > open1) && (low1 <= fastBuf[1] && close1 >= fastBuf[1]); // ชนแนวรับ EMA + เด้งกลับเขียว
   bool isBearishPA = (close1 < open1) && (high1 >= fastBuf[1] && close1 <= fastBuf[1]); // ชนแนวต้าน EMA + กดกลับแดง

   // -------------------------------------------------------------
   // 3. จังหวะเปิด Order ตะกร้าที่ 1 (ไม้แรก - อิง PA ที่แนวเทรนด์)
   // -------------------------------------------------------------
   if (totalPos == 0) {
      if (isUptrend && isBullishPA) {
         double sl = curPriceBid - (InitialSLPips * pointUnit);
         trade.Buy(lot, _Symbol, 0, sl, 0, "PA Trend Buy");
         return;
      }
      else if (isDowntrend && isBearishPA) {
         double sl = curPriceAsk + (InitialSLPips * pointUnit);
         trade.Sell(lot, _Symbol, 0, sl, 0, "PA Trend Sell");
         return;
      }
   }
   
   // -------------------------------------------------------------
   // 4. จังหวะ "สับไม้" (Pyramiding) - เพิ่มไม้เมื่อถูกทางตามระยะ Step
   // -------------------------------------------------------------
   if (totalPos > 0 && totalPos < MaxPositions) {
      if (posBuy > 0 && curPriceAsk >= lastBuyPrice + (ScaleStepPips * pointUnit)) {
          double sl = curPriceBid - (InitialSLPips * pointUnit);
          trade.Buy(lot, _Symbol, 0, sl, 0, "Scale-In Buy");
      }
      else if (posSell > 0 && curPriceBid <= lastSellPrice - (ScaleStepPips * pointUnit)) {
          double sl = curPriceAsk + (InitialSLPips * pointUnit);
          trade.Sell(lot, _Symbol, 0, sl, 0, "Scale-In Sell");
      }
   }

   // -------------------------------------------------------------
   // 5. ระบบกันหน้าทุน (Breakeven) และ ขยับ SL ต่อแท่งเทียน (Trailing Bar)
   // -------------------------------------------------------------
   bool newBar = IsNewBar();
   
   for(int i = PositionsTotal()-1; i >= 0; i--) {
      if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == MagicNumber) {
         ulong  ticket = PositionGetInteger(POSITION_TICKET);
         double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
         double slPrice   = PositionGetDouble(POSITION_SL);
         ENUM_POSITION_TYPE pType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
         
         double breakevenSL = 0.0;
         double newSL = slPrice;
         
         // 5.1 BUY Logic
         if(pType == POSITION_TYPE_BUY) {
            // A) ถ้าราคาวิ่งไปไกลพอ ให้คำนวณเป้าหมาย SL กันหน้าทุน
            if (curPriceBid >= openPrice + (BreakevenPips * pointUnit)) {
               breakevenSL = openPrice + (LockProfitPips * pointUnit);
               if (slPrice < breakevenSL) {
                  newSL = breakevenSL; // กันหน้าทุนได้แล้ว
               }
            }
            // B) ถ้าผู้ใช้ต้องการขยับ SL ต่อแท่ง (Trailing Bar) เมื่อแท่งใหม่เกิด
            if (TrailByBar && newBar && newSL >= openPrice) {
               // ขยับฐาน SL ตาม Low ของแท่งที่แล้ว ลบเผื่อนิดหน่อย
               double trailTarget = low1 - (2 * pointUnit);
               if (trailTarget > newSL && trailTarget < curPriceBid - (10 * pointUnit)) {
                   newSL = trailTarget;
               }
            }
         } 
         // 5.2 SELL Logic
         else if(pType == POSITION_TYPE_SELL) {
            if (curPriceAsk <= openPrice - (BreakevenPips * pointUnit)) {
               breakevenSL = openPrice - (LockProfitPips * pointUnit);
               if (slPrice > breakevenSL || slPrice == 0) {
                  newSL = breakevenSL; 
               }
            }
            if (TrailByBar && newBar && (newSL <= openPrice || newSL == 0)) {
               double trailTarget = high1 + (2 * pointUnit);
               if ((trailTarget < newSL || newSL == 0) && trailTarget > curPriceAsk + (10 * pointUnit)) {
                   newSL = trailTarget;
               }
            }
         }
         
         // จัดการปรับค่า SL
         if (newSL != slPrice && newSL != 0) {
            trade.PositionModify(ticket, newSL, PositionGetDouble(POSITION_TP));
         }
      }
   }
}

