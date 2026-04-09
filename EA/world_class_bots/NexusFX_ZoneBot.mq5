//+------------------------------------------------------------------+
//|                                               NexusFX_ZoneBot.mq5|
//|                                    Copyright 2026, NexusFX Corp. |
//+------------------------------------------------------------------+
#property copyright "NexusFX"
#property link      "https://nexusfx.biz"
#property version   "3.00" // Institutional Grade Edition

#include <Trade\Trade.mqh>
#include "NexusFX_Dashboard_v2.mqh"
CTrade trade;

// ============================================================
// INPUT PARAMETERS
// ============================================================
input string   RunMagic = "ZoneBot";        // ZoneBot for Bot, Zone for App Auto
input ulong    MagicNumber = 908;

// --- Timeframe Settings ---
input ENUM_TIMEFRAMES EntryTF = PERIOD_M15;    
input ENUM_TIMEFRAMES TrendTF = PERIOD_H4;     

// --- Zone Recovery Matrix ---
input int      ZonePips      = 300;    // ความกว้างของ Zone/Grid Recovery (Pips)
input double   Multiplier    = 1.5;    // Martingale หลอดสำหรับเปิดไม้ฝั่งตรงข้าม
input double   TargetProfit  = 10.0;   // รวบยอดกำไรเมื่อ PnL (เงินสด) ถึงเป้า

// --- Risk Management & Target ---
input double   InitialRiskPct       = 1.0;     // คำนวณ Lot ไม้แรกจาก Zone Width
input double   DailyProfitTargetPct = 3.0;     // หยุดเมื่อกำไรชนเป้า/วัน
input double   DailyDrawdownPct     = 5.0;     // ตัดขาดทุนถ้าลบเกินเป้า/วัน
input int      MaxSpreadPoints      = 30;      // 30 points = 3 pips

// --- Session Filter ---
input bool     UseSessionFilter = false;       
input int      SessionStartHour = 14;          
input int      SessionEndHour   = 22;          

// ============================================================
// GLOBAL STATE
// ============================================================
double pointUnit;
bool   haltForToday = false;
int    currentDayCheck = 0;

int OnInit() { 
   trade.SetExpertMagicNumber(MagicNumber); 
   
   pointUnit = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   if(SymbolInfoInteger(_Symbol, SYMBOL_DIGITS) == 5 || SymbolInfoInteger(_Symbol, SYMBOL_DIGITS) == 3) {
       pointUnit *= 10;
   }
   
   DASH_PREFIX = "NXZON_";
   Dash_CreatePanel("NexusFX Zone Recovery", MagicNumber);
   return(INIT_SUCCEEDED); 
}

void OnDeinit(const int reason) { Dash_DeletePanel(); }

//+------------------------------------------------------------------+
// FILTER HELPER FUNCTIONS
//+------------------------------------------------------------------+
bool IsSpreadOK() {
   if(MaxSpreadPoints <= 0) return true;
   return (SymbolInfoInteger(_Symbol, SYMBOL_SPREAD) <= MaxSpreadPoints);
}

bool IsInSession() {
   if(!UseSessionFilter) return true; 
   MqlDateTime dt; TimeToStruct(TimeCurrent(), dt);
   return (dt.hour >= SessionStartHour && dt.hour <= SessionEndHour);
}

void CheckDailyTargetAndDrawdown() {
   MqlDateTime dt; TimeToStruct(TimeCurrent(), dt);
   if(currentDayCheck != dt.day_of_year) {
      currentDayCheck = dt.day_of_year;
      haltForToday = false; 
   }
   if(haltForToday || (DailyProfitTargetPct <= 0 && DailyDrawdownPct <= 0)) return;

   datetime startOfDay = iTime(_Symbol, PERIOD_D1, 0);
   HistorySelect(startOfDay, TimeCurrent());
   double dailyNet = 0;
   
   for(int i=0; i<HistoryDealsTotal(); i++) {
      ulong deal = HistoryDealGetTicket(i);
      if(HistoryDealGetInteger(deal, DEAL_MAGIC) == MagicNumber) {
         dailyNet += HistoryDealGetDouble(deal, DEAL_PROFIT) + HistoryDealGetDouble(deal, DEAL_COMMISSION) + HistoryDealGetDouble(deal, DEAL_SWAP);
      }
   }
   
   for(int i=PositionsTotal()-1; i>=0; i--) {
      if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == MagicNumber) {
         dailyNet += PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
      }
   }
   
   double pPct = (dailyNet / AccountInfoDouble(ACCOUNT_BALANCE)) * 100.0;
   if(DailyProfitTargetPct > 0 && pPct >= DailyProfitTargetPct) haltForToday = true;
   if(DailyDrawdownPct > 0 && pPct <= -DailyDrawdownPct) haltForToday = true;
}

double CalculateDynamicLot(double zoneWidthPips, double riskPct) {
   if(riskPct <= 0 || zoneWidthPips <= 0) return SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double moneyRisk = AccountInfoDouble(ACCOUNT_BALANCE) * (riskPct / 100.0);
   double tpv = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   double ts = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   double gapPoints = zoneWidthPips * (pointUnit / SymbolInfoDouble(_Symbol, SYMBOL_POINT));
   
   double lossPerLot = (gapPoints / ts) * tpv;
   double lot = moneyRisk / lossPerLot;
   double vStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   return MathMax(SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN), MathFloor(lot / vStep) * vStep);
}

string GetOrderComment(string actionParams) {
   string entryTfStr = EnumToString(EntryTF); string trendTfStr = EnumToString(TrendTF);
   StringReplace(entryTfStr, "PERIOD_", ""); StringReplace(trendTfStr, "PERIOD_", "");
   return StringFormat("%s (%s/%s) %s", RunMagic, entryTfStr, trendTfStr, actionParams);
}

//+------------------------------------------------------------------+
// ON TICK LOGIC
//+------------------------------------------------------------------+
void OnTick()
{
   CheckDailyTargetAndDrawdown();

   int totalTrades = 0;
   double netProfit = 0.0;
   double lastBuyPrice = 0, lastSellPrice = 0;
   double initialLot = 0.01; 

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == MagicNumber)
      {
         totalTrades++;
         netProfit += PositionGetDouble(POSITION_PROFIT);
         double price = PositionGetDouble(POSITION_PRICE_OPEN);
         
         // ดึง Lot ตั้งต้นเพื่อนำมาคูณทบให้แม่นยำ
         if(totalTrades == 1) initialLot = PositionGetDouble(POSITION_VOLUME); 
         
         if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) lastBuyPrice = MathMax(lastBuyPrice, price);
         if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_SELL) lastSellPrice = (lastSellPrice==0) ? price : MathMin(lastSellPrice, price);
      }
   }

   string sigStatus = haltForToday ? "HALT (Daily Limit Reached)" : ((totalTrades > 0) ? StringFormat("GRID LEVEL %d", totalTrades) : "WAITING");
   Dash_UpdatePanel(sigStatus, haltForToday ? clrRed : ((totalTrades > 1) ? SellColor : BuyColor), totalTrades, netProfit);

   // --- Clearance condition (รวบยอดฮุบกำไรทั้งตาข่าย) ---
   if(totalTrades > 0 && netProfit >= TargetProfit)
   {
      for(int i = PositionsTotal() - 1; i >= 0; i--) {
        if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == MagicNumber) {
           CTrade clearTrade;
           clearTrade.PositionClose(PositionGetTicket(i));
        }
      }
      ObjectDelete(0, "ZON_Max");
      ObjectDelete(0, "ZON_Min");
      return;
   }

   if(!g_DashIsRunning || haltForToday) return; 

   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);

   // ============================================================
   // 1. Initial Order Placement (เปิดกระดานกางตาข่าย)
   // ============================================================
   if(totalTrades == 0 && IsInSession() && IsSpreadOK())
   {
      // ใช้ความกว้างของ Zone คำนวณ Lot ไม้แรก (ถ้าผิดทางโดนชนอีกฝั่ง จะเสีย %Risk)
      double calculatedLot = CalculateDynamicLot(ZonePips, InitialRiskPct);
      trade.Buy(calculatedLot, _Symbol, ask, 0, 0, GetOrderComment("Initial Zone"));
      return;
   }

   // ============================================================
   // 2. Zone Recovery Grid Logic (ตามแก้ออเดอร์ Martingale)
   // ============================================================
   if(totalTrades > 0 && netProfit < 0)
   {
      double zoneHi = 0, zoneLo = 0;
      if(lastBuyPrice > 0 && lastSellPrice == 0) {
         zoneHi = lastBuyPrice;
         zoneLo = lastBuyPrice - (ZonePips * pointUnit);
      } else if(lastSellPrice > 0 && lastBuyPrice == 0) {
         zoneLo = lastSellPrice;
         zoneHi = lastSellPrice + (ZonePips * pointUnit);
      } else if(lastBuyPrice > 0 && lastSellPrice > 0) {
         zoneHi = MathMax(lastBuyPrice, lastSellPrice);
         zoneLo = MathMin(lastBuyPrice, lastSellPrice);
      }
      
      // วาดกรอบตาข่าย
      if(zoneHi > 0) {
         if(ObjectFind(0, "ZON_Max") < 0) ObjectCreate(0, "ZON_Max", OBJ_HLINE, 0, 0, zoneHi);
         ObjectSetDouble(0, "ZON_Max", OBJPROP_PRICE, zoneHi);
         ObjectSetInteger(0, "ZON_Max", OBJPROP_COLOR, clrDodgerBlue);
         ObjectSetInteger(0, "ZON_Max", OBJPROP_WIDTH, 2);
         
         if(ObjectFind(0, "ZON_Min") < 0) ObjectCreate(0, "ZON_Min", OBJ_HLINE, 0, 0, zoneLo);
         ObjectSetDouble(0, "ZON_Min", OBJPROP_PRICE, zoneLo);
         ObjectSetInteger(0, "ZON_Min", OBJPROP_COLOR, clrOrange);
         ObjectSetInteger(0, "ZON_Min", OBJPROP_WIDTH, 2);
      }

      // ตรวจจับการทะลุกรอบเพื่อ Hedge ย้อนกลับ 
      // ใช้พลังคูณ Multiplier ของไม้แรก
      double nextLot = initialLot * MathPow(Multiplier, totalTrades);
      double vStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
      nextLot = MathMax(SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN), MathFloor(nextLot / vStep) * vStep);

      // เงื่อนไขในการเข้า Hedge
      if(IsSpreadOK()) {
         if(lastBuyPrice > 0 && bid < zoneLo && (ask > zoneLo - (10*pointUnit))) // ถ้าลงมาชนแถวล่างเปิด Sell สวนดับเบิ้ล
         {
            // ตรวจสอบว่ามี Buy มากกว่า Sell
            int pB = 0, pS = 0;
            for(int j=PositionsTotal()-1; j>=0; j--) {
               if(PositionGetSymbol(j)==_Symbol && PositionGetInteger(POSITION_MAGIC)==MagicNumber){
                   if(PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY) pB++; else pS++;
               }
            }
            if(pB > pS) trade.Sell(nextLot, _Symbol, 0, 0, 0, GetOrderComment("Hedge Martingale (S)"));
         }
         else if(lastSellPrice > 0 && ask > zoneHi && (bid < zoneHi + (10*pointUnit))) // ถ้าโดดชนแถวบนเปิด Buy สวนดับเบิ้ล
         {
            // ตรวจสอบว่ามี Sell มากกว่า Buy
            int pB = 0, pS = 0;
            for(int j=PositionsTotal()-1; j>=0; j--) {
               if(PositionGetSymbol(j)==_Symbol && PositionGetInteger(POSITION_MAGIC)==MagicNumber){
                   if(PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY) pB++; else pS++;
               }
            }
            if(pS > pB) trade.Buy(nextLot, _Symbol, 0, 0, 0, GetOrderComment("Hedge Martingale (B)"));
         }
      }
   }
}
