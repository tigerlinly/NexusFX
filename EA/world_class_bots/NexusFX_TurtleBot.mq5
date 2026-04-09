//+------------------------------------------------------------------+
//|                                             NexusFX_TurtleBot.mq5|
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
input string   RunMagic = "TurtleBot";       // TurtleBot for Bot, Turtle for App Auto
input ulong    MagicNumber = 906;

// --- Timeframe Settings ---
input ENUM_TIMEFRAMES EntryTF = PERIOD_D1;     // Turtle ปกติใช้ D1
input ENUM_TIMEFRAMES TrendTF = PERIOD_W1;     // เทรนด์อ้างอิง W1

// --- Turtle Original Logic ---
input int      DonchianPeriod = 20;    // 20-Day Breakout
input int      ATRPeriod      = 14;

// --- Pyramiding (การสับไม้ตามหลัก Turtle) ---
input int      MaxPositions       = 4;         // Turtle มักซอยไม้ไม่เกิน 4-5 ไม้
input double   AtrScaleMultiplier = 0.5;       // จะสับไม้เมื่อราคาวิ่งไป 0.5 ATR
input double   ScaleLotMultiplier = 1.0;       // Turtle แท้จะออก Lot เท่าเดิม (Anti-martingale ตั้ง 0.5 ได้)

// --- Risk Management & Target ---
input double   RiskPercent          = 1.0;     // เสี่ยงต่อไม้ 1% (Turtle Rule)
input double   DailyProfitTargetPct = 5.0;     // หยุดเมื่อกำไรชนเป้า/วัน
input double   DailyDrawdownPct     = 5.0;     // ตัดขาดทุนถ้าลบเกินเป้า/วัน
input int      MaxSpreadPoints      = 30;      // 30 points = 3 pips
input double   TakeProfitATR        = 6.0;     // เป้ากำไร 6 ATR (หรือใช้ Trailing Stop ก็ได้)

// --- Session Filter ---
input bool     UseSessionFilter = false;       // หากมีสัญญาณแต่ไม่ใช่เวลา จะเข้าหรือไม่ (false = เข้าชัวร์)
input int      SessionStartHour = 14;          // ตลาดยุโรป
input int      SessionEndHour   = 22;          // ตลาดอเมริกา

// ============================================================
// GLOBAL STATE
// ============================================================
int handleATR;
double pointUnit;
bool   haltForToday = false;
int    currentDayCheck = 0;

int OnInit() 
{ 
   trade.SetExpertMagicNumber(MagicNumber); 
   handleATR = iATR(_Symbol, EntryTF, ATRPeriod);
   
   pointUnit = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   if(SymbolInfoInteger(_Symbol, SYMBOL_DIGITS) == 5 || SymbolInfoInteger(_Symbol, SYMBOL_DIGITS) == 3) {
       pointUnit *= 10;
   }
   
   DASH_PREFIX = "NXTUR_";
   Dash_CreatePanel("NexusFX TurtleBot", MagicNumber, EnumToString(EntryTF), EnumToString(TrendTF));
   return(INIT_SUCCEEDED); 
}

void OnDeinit(const int reason) { 
   IndicatorRelease(handleATR); 
   Dash_DeletePanel(); 
}

//+------------------------------------------------------------------+
// FILTER HELPER FUNCTIONS
//+------------------------------------------------------------------+
bool IsNewBar() {
   static datetime lastTime = 0;
   datetime currTime = iTime(_Symbol, EntryTF, 0);
   if (currTime != lastTime) { lastTime = currTime; return true; }
   return false;
}

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

double CalculateDynamicLot(double slDistance, double riskPct) {
   if(riskPct <= 0 || slDistance <= 0) return SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double moneyRisk = AccountInfoDouble(ACCOUNT_BALANCE) * (riskPct / 100.0);
   double tpv = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   double ts = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   
   double lossPerLot = (slDistance / ts) * tpv;
   double lot = moneyRisk / lossPerLot;
   double vStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   return MathMax(SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN), MathFloor(lot / vStep) * vStep);
}

double CalculateScaleLot(double lastLot) {
   double newLot = lastLot * ScaleLotMultiplier;
   double vStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   return MathMax(SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN), MathFloor(newLot / vStep) * vStep);
}

string GetOrderComment(string actionParams) {
   string entryTfStr = EnumToString(EntryTF); string trendTfStr = EnumToString(TrendTF);
   StringReplace(entryTfStr, "PERIOD_", ""); StringReplace(trendTfStr, "PERIOD_", "");
   return StringFormat("%s Turtle (%s/%s) %s", RunMagic, entryTfStr, trendTfStr, actionParams);
}

//+------------------------------------------------------------------+
// ON TICK LOGIC
//+------------------------------------------------------------------+
void OnTick()
{
   CheckDailyTargetAndDrawdown();

   int posBuy = 0, posSell = 0;
   double pnl = 0, lastBuyPrice = 0, lastSellPrice = 999999;
   double lastBuyLot = 0.01, lastSellLot = 0.01;
   
   for(int i=PositionsTotal()-1; i>=0; i--) {
      if(PositionGetSymbol(i)==_Symbol && PositionGetInteger(POSITION_MAGIC)==MagicNumber) {
         pnl+=PositionGetDouble(POSITION_PROFIT);
         ENUM_POSITION_TYPE pType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
         double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
         double vol = PositionGetDouble(POSITION_VOLUME);
         if(pType == POSITION_TYPE_BUY) {
            posBuy++; if(openPrice > lastBuyPrice) { lastBuyPrice = openPrice; lastBuyLot = vol; }
         } else if(pType == POSITION_TYPE_SELL) {
            posSell++; if(openPrice < lastSellPrice) { lastSellPrice = openPrice; lastSellLot = vol; }
         }
      }
   }
   
   int totalPos = posBuy + posSell;
   string sigStatus = haltForToday ? "HALT (Daily Limit Reached)" : ((totalPos > 0) ? "IN TRADE (Pyramiding)" : "WAITING BREAKOUT");
   Dash_UpdatePanel(sigStatus, haltForToday ? clrRed : ((totalPos > 0) ? BuyColor : NeutralColor), totalPos, pnl);

   if(!g_DashIsRunning || haltForToday) return; 

   double atrBufData[]; ArraySetAsSeries(atrBufData, true);
   double high20[], low20[]; ArraySetAsSeries(high20, true); ArraySetAsSeries(low20, true);
   
   if(CopyHigh(_Symbol, EntryTF, 1, DonchianPeriod, high20) < DonchianPeriod) return;
   if(CopyLow(_Symbol, EntryTF, 1, DonchianPeriod, low20) < DonchianPeriod) return;
   if(CopyBuffer(handleATR, 0, 0, 1, atrBufData) < 1) return;

   double maxH = high20[ArrayMaximum(high20, 0, WHOLE_ARRAY)];
   double minL = low20[ArrayMinimum(low20, 0, WHOLE_ARRAY)];
   double atr = atrBufData[0];
   
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);

   // วาดเส้น Donchian
   if(ObjectFind(0, "Tur_Max") < 0) ObjectCreate(0, "Tur_Max", OBJ_HLINE, 0, 0, maxH);
   ObjectSetDouble(0, "Tur_Max", OBJPROP_PRICE, maxH);
   ObjectSetInteger(0, "Tur_Max", OBJPROP_COLOR, clrLime);
   
   if(ObjectFind(0, "Tur_Min") < 0) ObjectCreate(0, "Tur_Min", OBJ_HLINE, 0, 0, minL);
   ObjectSetDouble(0, "Tur_Min", OBJPROP_PRICE, minL);
   ObjectSetInteger(0, "Tur_Min", OBJPROP_COLOR, clrOrangeRed);
   ChartRedraw();

   // ============================================================
   // 1. Entry Order (20-Day Breakout + Risk 1% of 2-ATR)
   // ============================================================
   if(totalPos == 0 && IsInSession() && IsSpreadOK()) 
   {
      double slDistance = atr * 2; // กฎดั้งเดิม Turtle เผื่อ SL ไว้ 2 ATR
      double lotToOpen = CalculateDynamicLot(slDistance, RiskPercent);
      
      if(ask > maxH) 
      {
         double sl = ask - slDistance;
         double tp = ask + (atr * TakeProfitATR);
         trade.Buy(lotToOpen, _Symbol, ask, sl, tp, GetOrderComment("Donchian BO Buy"));
      }
      else if(bid < minL)
      {
         double sl = bid + slDistance;
         double tp = bid - (atr * TakeProfitATR);
         trade.Sell(lotToOpen, _Symbol, bid, sl, tp, GetOrderComment("Donchian BO Sell"));
      }
   }

   // ============================================================
   // 2. Pyramiding by 0.5 ATR (เพิ่มไม้เมื่อถูกทาง)
   // ============================================================
   if (totalPos > 0 && totalPos < MaxPositions && IsInSession() && IsSpreadOK()) {
      double scaleStep = atr * AtrScaleMultiplier; 
      
      if (posBuy > 0 && ask >= lastBuyPrice + scaleStep) {
          double sl = bid - (atr * 2);
          double tp = ask + (atr * TakeProfitATR);
          double scaleLot = CalculateScaleLot(lastBuyLot);
          trade.Buy(scaleLot, _Symbol, 0, sl, tp, GetOrderComment(StringFormat("Scale BUY #%d", totalPos+1)));
          // *หมายเหตุ* Turtle จริงๆ เมื่อเข้าอีกไม้ จะเลื่อน SL ของไม้เก่าตามด้วย 
      }
      else if (posSell > 0 && bid <= lastSellPrice - scaleStep) {
          double sl = ask + (atr * 2);
          double tp = bid - (atr * TakeProfitATR);
          double scaleLot = CalculateScaleLot(lastSellLot);
          trade.Sell(scaleLot, _Symbol, 0, sl, tp, GetOrderComment(StringFormat("Scale SELL #%d", totalPos+1)));
      }
   }
}
