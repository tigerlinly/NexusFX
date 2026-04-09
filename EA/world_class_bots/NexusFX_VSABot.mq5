//+------------------------------------------------------------------+
//|                                                NexusFX_VSABot.mq5|
//|                                    Copyright 2026, NexusFX Corp. |
//| Created: 2026-04-01                                              |
//| Updated: 2026-04-09                                              |
//+------------------------------------------------------------------+
#property copyright "NexusFX"
#property link      "https://nexusfx.biz"
#property version   "1.00"

#include <Trade\Trade.mqh>
#include "NexusFX_Dashboard_v2.mqh"
CTrade trade;

// ============================================================
// INPUT PARAMETERS
// ============================================================
input string   RunMagic = "VSABot";            // VSABot for Bot, VSA for App Auto
input ulong    MagicNumber = 907;

input ENUM_TIMEFRAMES EntryTF = PERIOD_M15;
input ENUM_TIMEFRAMES TrendTF = PERIOD_H4;

input double VolThreshold= 2.0;

// --- Institutional Risk Controls ---
input double   RiskPercent = 1.0;            // % Risk Per Trade
input double   ScaleLotMultiplier = 0.5;     // Anti-martingale Pyramiding (0.5 = Halve lot on add)
input int      MaxPyramidOrders = 3;         // Max orders in same direction

input int      MaxSpreadPoints = 150;        // Max Spread limit
input int      StartHour = 2;                // Trading Start (Broker Time)
input int      EndHour = 22;                 // Trading End (Broker Time)

input double   DailyTargetUSD = 1000.0;      // Daily Target (Halt if reached)
input double   DailyDrawdownUSD = -500.0;    // Daily Drawdown Limit (Halt if reached)

// ============================================================
// GLOBAL VARIABLES
// ============================================================
double startBalanceOfDay;
bool   dailyHalt = false;
datetime lastHaltDay = 0;

int OnInit() { 
   trade.SetExpertMagicNumber(MagicNumber); 
   DASH_PREFIX = "NXVSA_";
   Dash_CreatePanel("NexusFX VSABot", MagicNumber, EnumToString(EntryTF), EnumToString(TrendTF));
   
   startBalanceOfDay = AccountInfoDouble(ACCOUNT_BALANCE);
   return(INIT_SUCCEEDED); 
}

void OnDeinit(const int reason) { 
   Dash_DeletePanel(); 
}

// ============================================================
// CORE LOGIC
// ============================================================
void OnTick()
{
   CheckDailyTargetAndDrawdown();
   if(dailyHalt) return;

   int pos = PositionsTotal();
   double pnl = 0;
   int myPos = 0;
   
   for(int i=0; i<pos; i++) {
        if(PositionGetSymbol(i)==_Symbol && PositionGetInteger(POSITION_MAGIC)==MagicNumber) {
            pnl += PositionGetDouble(POSITION_PROFIT);
            myPos++;
        }
   }
   
   string sigStatus = (myPos > 0) ? "IN TRADE" : "SCAN VOLUME";
   Dash_UpdatePanel(sigStatus, (myPos > 0) ? BuyColor : NeutralColor, myPos, pnl);

   if(!g_DashIsRunning) return; // External Stop
   if(!CheckSpreadAndSession()) return; // Risk Filters

   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   if(CopyRates(_Symbol, EntryTF, 1, 10, rates) < 10) return;

   // VSA Logic: Analyze High Volume on Narrow Spread
   double avgVol = 0;
   for(int i=1; i<10; i++) avgVol += (double)rates[i].tick_volume;
   avgVol /= 9;

   double spread0 = rates[0].high - rates[0].low;
   double vol0 = (double)rates[0].tick_volume;

   if(vol0 > avgVol * VolThreshold && spread0 < SymbolInfoDouble(_Symbol, SYMBOL_POINT) * 100)
   {
      // Anti-martingale Pyramiding logic
      if(myPos >= MaxPyramidOrders) return;
      double tradeLot = CalculateScaleLot(myPos);

      double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      
      if(rates[0].close > rates[0].low + (spread0 * 0.7))
      {
         string arName = "VSA_Arr_" + IntegerToString(rates[0].time);
         if(ObjectFind(0, arName) < 0) {
             ObjectCreate(0, arName, OBJ_ARROW_UP, 0, rates[0].time, rates[0].low);
             ObjectSetInteger(0, arName, OBJPROP_COLOR, clrDodgerBlue);
             ObjectSetInteger(0, arName, OBJPROP_WIDTH, 3);
         }
         
         double sl = rates[0].low - (5 * SymbolInfoDouble(_Symbol, SYMBOL_POINT));
         string cmt = GetOrderComment("Acc", "VSA Accumulation");
         trade.Buy(tradeLot, _Symbol, ask, sl, 0, cmt);
      }
      else if(rates[0].close < rates[0].low + (spread0 * 0.3))
      {
         string arName = "VSA_Arr_" + IntegerToString(rates[0].time);
         if(ObjectFind(0, arName) < 0) {
             ObjectCreate(0, arName, OBJ_ARROW_DOWN, 0, rates[0].time, rates[0].high);
             ObjectSetInteger(0, arName, OBJPROP_COLOR, clrCrimson);
             ObjectSetInteger(0, arName, OBJPROP_WIDTH, 3);
         }
         
         double sl = rates[0].high + (5 * SymbolInfoDouble(_Symbol, SYMBOL_POINT));
         string cmt = GetOrderComment("Dist", "VSA Distribution");
         trade.Sell(tradeLot, _Symbol, bid, sl, 0, cmt);
      }
   }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================
bool CheckSpreadAndSession()
{
   MqlDateTime dt;
   TimeCurrent(dt);
   if(dt.hour < StartHour || dt.hour >= EndHour) return false;
   
   long spread = SymbolInfoInteger(_Symbol, SYMBOL_SPREAD);
   if(spread > MaxSpreadPoints) return false;
   
   return true;
}

double CalculateScaleLot(int currentPos)
{
   double baseLot = AccountInfoDouble(ACCOUNT_BALANCE) * (RiskPercent / 100.0) / 1000.0;
   if(baseLot < SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN))
      baseLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
      
   double lot = baseLot * MathPow(ScaleLotMultiplier, currentPos);
   
   if(lot < SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN))
      lot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
      
   lot = NormalizeDouble(lot, 2);
   return lot;
}

void CheckDailyTargetAndDrawdown()
{
   MqlDateTime dt;
   TimeCurrent(dt);
   datetime today = dt.day_of_year;
   
   if(today != lastHaltDay)
   {
      startBalanceOfDay = AccountInfoDouble(ACCOUNT_BALANCE);
      dailyHalt = false;
      lastHaltDay = today;
      g_DashIsRunning = true; 
   }
   
   double currentEq = AccountInfoDouble(ACCOUNT_EQUITY);
   double dailyPnl = currentEq - startBalanceOfDay;
   
   if(dailyPnl >= DailyTargetUSD)
   {
      dailyHalt = true;
      g_DashIsRunning = false;
      Print("[VSABot] Daily Target Reached! Halting trading.");
   }
   else if(dailyPnl <= DailyDrawdownUSD)
   {
      dailyHalt = true;
      g_DashIsRunning = false;
      Print("[VSABot] Daily Drawdown Reached! Halting trading.");
   }
}

string GetOrderComment(string actionParams, string extraMsg)
{
   string entryTfStr = EnumToString(EntryTF);
   StringReplace(entryTfStr, "PERIOD_", "");
   string trendTfStr = EnumToString(TrendTF);
   StringReplace(trendTfStr, "PERIOD_", "");
   
   return StringFormat("%s VSA (%s/%s) %s", RunMagic, entryTfStr, trendTfStr, actionParams);
}
