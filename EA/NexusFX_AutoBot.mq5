//+------------------------------------------------------------------+
//|                                              NexusFX_AutoBot.mq5 |
//|                                    Copyright 2026, NexusFX Corp. |
//+------------------------------------------------------------------+
#property copyright "NexusFX"
#property link      "https://nexusfx.biz"
#property version   "1.00"
#property strict

#include <Trade\Trade.mqh>

//--- Input parameters
input double   LotSize         = 0.01;      // หลอดเริ่มต้น (Lot Size)
input int      StopLossPoints  = 300;       // Stop Loss (Points / จุด)
input int      TakeProfitPoints= 600;       // Take Profit (Points / จุด)
input int      TrailingStop    = 200;       // เลื่อน SL ตามกำไรเมื่อกำไรเกินกี่จุด (Trailing Stop)
input int      TrailingStep    = 50;        // ขยับทีละกี่จุด (Step)
input int      FastEMA         = 9;         // เส้น EMA เร็ว
input int      SlowEMA         = 21;        // เส้น EMA ช้า
input ulong    MagicNumber     = 999911;    // รหัสประจำตัว EA (กันไปยุ่งออเดอร์มือ)

//--- Global variables
CTrade         trade;
int            handleFastEMA;
int            handleSlowEMA;
double         emaFastBuffer[];
double         emaSlowBuffer[];

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   trade.SetExpertMagicNumber(MagicNumber);
   
   // Create Indicator Handles
   handleFastEMA = iMA(_Symbol, PERIOD_CURRENT, FastEMA, 0, MODE_EMA, PRICE_CLOSE);
   handleSlowEMA = iMA(_Symbol, PERIOD_CURRENT, SlowEMA, 0, MODE_EMA, PRICE_CLOSE);
   
   if(handleFastEMA == INVALID_HANDLE || handleSlowEMA == INVALID_HANDLE)
   {
      Print("Error creating EMA handles");
      return(INIT_FAILED);
   }
   
   ArraySetAsSeries(emaFastBuffer, true);
   ArraySetAsSeries(emaSlowBuffer, true);

   Print("NexusFX AutoBot Started: Magic ", MagicNumber);
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   IndicatorRelease(handleFastEMA);
   IndicatorRelease(handleSlowEMA);
   Print("NexusFX AutoBot Stopped.");
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   // 1. ตรวจสอบว่าไม่มีออเดอร์เปิดอยู่เลย (หรืออาจจะประยุกต์เปิดหลายออเดอร์ก็ได้)
   int openPositions = PositionsTotal();
   bool hasMyOrder = false;
   
   for(int i = openPositions - 1; i >= 0; i--)
   {
      string symbol = PositionGetSymbol(i);
      if(symbol == _Symbol)
      {
         ulong magic = PositionGetInteger(POSITION_MAGIC);
         if(magic == MagicNumber)
         {
            hasMyOrder = true;
            // -- ทำการจัดการ Trailing Stop ถ้ากราฟวิ่งชนระยะ --
            ManageTrailingStop();
         }
      }
   }
   
   // 2. ถ้าไม่มีออเดอร์ค้าง ให้หาจังหวะเข้า
   if(!hasMyOrder)
   {
      CheckEntrySignal();
   }
}

//+------------------------------------------------------------------+
//| Check Entry Signal (EMA Crossover)                               |
//+------------------------------------------------------------------+
void CheckEntrySignal()
{
   // ก๊อปปี้ค่า EMA แท่งล่าสุดและแท่งก่อนหน้า (index 1 คือแท่งที่เพิ่งปิด, index 2 คือแท่งก่อนหน้า)
   if(CopyBuffer(handleFastEMA, 0, 1, 2, emaFastBuffer) <= 0) return;
   if(CopyBuffer(handleSlowEMA, 0, 1, 2, emaSlowBuffer) <= 0) return;
   
   double fastCurrent = emaFastBuffer[0]; // bar 1 (เพิ่งปิด)
   double fastPrev    = emaFastBuffer[1]; // bar 2
   
   double slowCurrent = emaSlowBuffer[0];
   double slowPrev    = emaSlowBuffer[1];
   
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   
   // เงื่อนไข Buy: เส้นเร็วตัดเส้นช้าขึ้น
   if(fastPrev < slowPrev && fastCurrent > slowCurrent)
   {
      double sl = ask - (StopLossPoints * point);
      double tp = ask + (TakeProfitPoints * point);
      Print("Signal BUY Detected. Opening Buy...");
      trade.Buy(LotSize, _Symbol, ask, sl, tp, "NexusFX AutoBot Buy");
   }
   // เงื่อนไข Sell: เส้นเร็วตัดเส้นช้าลง
   else if(fastPrev > slowPrev && fastCurrent < slowCurrent)
   {
      double sl = bid + (StopLossPoints * point);
      double tp = bid - (TakeProfitPoints * point);
      Print("Signal SELL Detected. Opening Sell...");
      trade.Sell(LotSize, _Symbol, bid, sl, tp, "NexusFX AutoBot Sell");
   }
}

//+------------------------------------------------------------------+
//| Manage Trailing Stop (เลื่อนกำไร และขยับ TP หนี)                   |
//+------------------------------------------------------------------+
void ManageTrailingStop()
{
   if(TrailingStop == 0) return; // ปิดทิ้งถ้าไม่ได้ตั้งค่า
   
   double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      string symbol = PositionGetSymbol(i);
      if(symbol == _Symbol)
      {
         ulong ticket = PositionGetInteger(POSITION_TICKET);
         ulong magic = PositionGetInteger(POSITION_MAGIC);
         
         if(magic == MagicNumber)
         {
            double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
            double currentSL = PositionGetDouble(POSITION_SL);
            double currentTP = PositionGetDouble(POSITION_TP);
            long type = PositionGetInteger(POSITION_TYPE);
            
            // กรณีไม้ BUY
            if(type == POSITION_TYPE_BUY)
            {
               // ถ้าราคาวิ่งเกินระยะ Trailing
               if(bid - openPrice > TrailingStop * point)
               {
                  // คำนวณ SL และ TP ใหม่ที่ควรจะเป็น
                  double newSL = bid - (TrailingStop * point);
                  
                  // ถ้ายังไม่มี SL หรือ SL ใหม่สูงกว่า SL เก่า + Step ถึงจะยอมขยับ
                  if(currentSL == 0.0 || newSL > currentSL + (TrailingStep * point))
                  {
                     // ให้เป้า TP ขยับหนีขึ้นไปเรื่อยๆ เพื่อกินคำโต (รักษาระยะ TP ห่างจากราคาปัจจุบัน)
                     double newTP = bid + (TakeProfitPoints * point);
                     
                     trade.PositionModify(ticket, newSL, newTP);
                     Print("Trailing SL/TP Modified BUY: ", ticket, " New SL: ", newSL, " New TP: ", newTP);
                  }
               }
            }
            // กรณีไม้ SELL
            else if(type == POSITION_TYPE_SELL)
            {
               if(openPrice - ask > TrailingStop * point)
               {
                  double newSL = ask + (TrailingStop * point);
                  if(currentSL == 0.0 || newSL < currentSL - (TrailingStep * point))
                  {
                     double newTP = ask - (TakeProfitPoints * point);
                     
                     trade.PositionModify(ticket, newSL, newTP);
                     Print("Trailing SL/TP Modified SELL: ", ticket, " New SL: ", newSL, " New TP: ", newTP);
                  }
               }
            }
         }
      }
   }
}
