//+------------------------------------------------------------------+
//|                                              NexusFX_PairsBot.mq5|
//|                                    Copyright 2026, NexusFX Corp. |
//+------------------------------------------------------------------+
#property copyright "NexusFX"
#property link      "https://nexusfx.biz"
#property version   "3.00" // Institutional Grade Edition

#include <Trade\Trade.mqh>
#include "NexusFX_Dashboard_v2.mqh"
CTrade tradeA, tradeB;

// ============================================================
// INPUT PARAMETERS
// ============================================================
input string   RunMagic = "PairsBot";        // PairsBot for Bot, Pairs for App Auto
input ulong    MagicNumber = 904;

// --- Pairs Settings ---
input string   SymbolA = "EURUSD";
input string   SymbolB = "GBPUSD";
input double   SpreadThreshold = 0.0050; // Divergence condition
input double   ExpectedMeanRatio = 1.1500; // Expected historical mean

// --- Timeframe Settings ---
input ENUM_TIMEFRAMES EntryTF = PERIOD_H1;  // สำหรับวางกรอบเงื่อนไขใน Dashboard
input ENUM_TIMEFRAMES TrendTF = PERIOD_D1;  // สำหรับแสดงผลใน Comment

// --- Risk Management & Target ---
input double   RiskPercent          = 1.0;     // คำนวณ Lot
input double   TargetProfit         = 5.0;     // Profit Goal (Account Currency) to close pair
input double   DailyProfitTargetPct = 3.0;     // หยุดเมื่อกำไรชนเป้า/วัน
input double   DailyDrawdownPct     = 5.0;     // ตัดขาดทุนถ้าลบเกินเป้า/วัน
input double   InitialSLPips        = 500.0;   // SL คุ้มครองพอร์ตกรณีคู่เงินฉีกขาดถาวร

// --- Session Filter ---
input bool     UseSessionFilter = false;       // หากมีสัญญาณแต่ไม่ใช่เวลา จะเข้าหรือไม่
input int      SessionStartHour = 14;          // ตลาดยุโรป
input int      SessionEndHour   = 22;          // ตลาดอเมริกา

// ============================================================
// GLOBAL STATE
// ============================================================
bool   haltForToday = false;
int    currentDayCheck = 0;
double pointUnitA, pointUnitB;

int OnInit() { 
   tradeA.SetExpertMagicNumber(MagicNumber);
   tradeB.SetExpertMagicNumber(MagicNumber);
   
   pointUnitA = SymbolInfoDouble(SymbolA, SYMBOL_POINT);
   if(SymbolInfoInteger(SymbolA, SYMBOL_DIGITS) == 5 || SymbolInfoInteger(SymbolA, SYMBOL_DIGITS) == 3) pointUnitA *= 10;
   
   pointUnitB = SymbolInfoDouble(SymbolB, SYMBOL_POINT);
   if(SymbolInfoInteger(SymbolB, SYMBOL_DIGITS) == 5 || SymbolInfoInteger(SymbolB, SYMBOL_DIGITS) == 3) pointUnitB *= 10;
   
   DASH_PREFIX = "NXP_";
   Dash_CreatePanel("NexusFX Stat-Arb Pairs", MagicNumber, EnumToString(EntryTF), EnumToString(TrendTF));
   return(INIT_SUCCEEDED); 
}

void OnDeinit(const int reason) { Dash_DeletePanel(); }

//+------------------------------------------------------------------+
// FILTER HELPER FUNCTIONS
//+------------------------------------------------------------------+
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

   datetime startOfDay = iTime(SymbolA, PERIOD_D1, 0);
   HistorySelect(startOfDay, TimeCurrent());
   double dailyNet = 0;
   
   for(int i=0; i<HistoryDealsTotal(); i++) {
      ulong deal = HistoryDealGetTicket(i);
      if(HistoryDealGetInteger(deal, DEAL_MAGIC) == MagicNumber) {
         dailyNet += HistoryDealGetDouble(deal, DEAL_PROFIT) + HistoryDealGetDouble(deal, DEAL_COMMISSION) + HistoryDealGetDouble(deal, DEAL_SWAP);
      }
   }
   
   for(int i=PositionsTotal()-1; i>=0; i--) {
      string sym = PositionGetSymbol(i);
      if((sym == SymbolA || sym == SymbolB) && PositionGetInteger(POSITION_MAGIC) == MagicNumber) {
         dailyNet += PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
      }
   }
   
   double pPct = (dailyNet / AccountInfoDouble(ACCOUNT_BALANCE)) * 100.0;
   if(DailyProfitTargetPct > 0 && pPct >= DailyProfitTargetPct) haltForToday = true;
   if(DailyDrawdownPct > 0 && pPct <= -DailyDrawdownPct) haltForToday = true;
}

double CalculateDynamicLot(string sym, double pUnit) {
   if(RiskPercent <= 0) return SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);
   double moneyRisk = AccountInfoDouble(ACCOUNT_BALANCE) * (RiskPercent / 100.0) / 2.0; // หาร 2 เพราะเปิด 2 คู่ (Hedging)
   double tpv = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE);
   double ts = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_SIZE);
   double slPts = InitialSLPips * (pUnit / SymbolInfoDouble(sym, SYMBOL_POINT));
   if(slPts == 0) return SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);
   
   double lossPerLot = (slPts / ts) * tpv;
   double lot = moneyRisk / lossPerLot;
   double vStep = SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP);
   return MathMax(SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN), MathFloor(lot / vStep) * vStep);
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

   int pos = 0;
   double pnl = 0;
   for(int i = PositionsTotal()-1; i >= 0; i--) {
       string sym = PositionGetSymbol(i);
       if((sym == SymbolA || sym == SymbolB) && PositionGetInteger(POSITION_MAGIC) == MagicNumber) {
           pnl += PositionGetDouble(POSITION_PROFIT);
           pos++;
       }
   }
   
   string sigStatus = haltForToday ? "HALT (Daily Limit Reached)" : ((pos > 0) ? "HEDGING PAIRS" : "SCANNING SPREAD");
   Dash_UpdatePanel(sigStatus, haltForToday ? clrRed : ((pos > 0) ? BuyColor : NeutralColor), pos, pnl);

   // --- Clearance Logic (ปิดรวบยอดฮุบกำไร) ---
   if(pos > 0) {
      if(pnl >= TargetProfit) {
         for(int i = PositionsTotal() - 1; i >= 0; i--) {
            string sym = PositionGetSymbol(i);
            if((sym == SymbolA || sym == SymbolB) && PositionGetInteger(POSITION_MAGIC) == MagicNumber) {
               CTrade clearTrade;
               clearTrade.PositionClose(PositionGetTicket(i));
            }
         }
      }
      return; 
   }

   if(!g_DashIsRunning || haltForToday) return; 

   // --- Arbitrage Entry Logic ---
   double priceA_Bid = SymbolInfoDouble(SymbolA, SYMBOL_BID);
   double priceA_Ask = SymbolInfoDouble(SymbolA, SYMBOL_ASK);
   double priceB_Bid = SymbolInfoDouble(SymbolB, SYMBOL_BID);
   double priceB_Ask = SymbolInfoDouble(SymbolB, SYMBOL_ASK);
   
   if(priceA_Bid == 0 || priceB_Bid == 0) return;

   // Stat Arb Logic: Mean Reversion based on historical price ratio
   double ratio = priceA_Bid / priceB_Bid;

   if(IsInSession()) {
       double lotA = CalculateDynamicLot(SymbolA, pointUnitA);
       double lotB = CalculateDynamicLot(SymbolB, pointUnitB);

       if(ratio > ExpectedMeanRatio + SpreadThreshold)
       {
          // Ratio is too high -> Sell A, Buy B
          double sl_A = priceA_Ask + (InitialSLPips * pointUnitA);
          tradeA.Sell(lotA, SymbolA, priceA_Bid, sl_A, 0, GetOrderComment("StatArb Sell A"));
          
          double sl_B = priceB_Bid - (InitialSLPips * pointUnitB);
          tradeB.Buy(lotB, SymbolB, priceB_Ask, sl_B, 0, GetOrderComment("StatArb Buy B"));
       }
       else if(ratio < ExpectedMeanRatio - SpreadThreshold)
       {
          // Ratio is too low -> Buy A, Sell B
          double sl_A = priceA_Bid - (InitialSLPips * pointUnitA);
          tradeA.Buy(lotA, SymbolA, priceA_Ask, sl_A, 0, GetOrderComment("StatArb Buy A"));
          
          double sl_B = priceB_Ask + (InitialSLPips * pointUnitB);
          tradeB.Sell(lotB, SymbolB, priceB_Bid, sl_B, 0, GetOrderComment("StatArb Sell B"));
       }
   }
}
