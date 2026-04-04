//+------------------------------------------------------------------+
//|                                              NexusFX_AutoBot.mq5 |
//|                                    Copyright 2026, NexusFX Corp. |
//+------------------------------------------------------------------+
#property copyright "NexusFX"
#property link      "https://nexusfx.biz"
#property version   "2.00"
#property strict

#include <Trade\Trade.mqh>

//--- Input parameters
input group    "=== Risk Management ==="
input double   RiskPercent      = 1.0;        // ความเสี่ยงต่อออเดอร์ (% ของทุน)
input double   FixedLotSize     = 0.0;        // Lot คงที่ (0 = ใช้ Risk%)
input int      MaxPositions     = 3;          // จำนวนไม้สูงสุดที่เปิดพร้อมกัน

input group    "=== Entry & Exit ==="
input int      StopLossPoints   = 300;        // Stop Loss (Points)
input int      TakeProfitPoints = 600;        // Take Profit (Points)
input int      TrailingStop     = 200;        // Trailing Stop (Points, 0=ปิด)
input int      TrailingStep     = 50;         // Trailing Step (Points)

input group    "=== Indicators ==="
input int      FastEMA          = 9;          // EMA เร็ว
input int      SlowEMA          = 21;         // EMA ช้า
input int      RSI_Period       = 14;         // RSI Period
input double   RSI_BuyLevel     = 40;         // RSI ต่ำกว่านี้สนับสนุน Buy
input double   RSI_SellLevel    = 60;         // RSI สูงกว่านี้สนับสนุน Sell

input group    "=== Display ==="
input bool     ShowPanel        = true;       // แสดง Dashboard Panel
input int      PanelX           = 10;         // ตำแหน่ง X
input int      PanelY           = 25;         // ตำแหน่ง Y
input color    PanelBgColor     = C'20,25,35';     // สีพื้น Panel
input color    PanelBorderColor = C'40,50,70';     // สี Border
input color    TextColor        = clrWhite;        // สีข้อความ
input color    BuyColor         = C'0,230,118';    // สี Buy
input color    SellColor        = C'255,82,82';    // สี Sell
input color    NeutralColor     = C'120,130,150';  // สีกลาง

input group    "=== System ==="
input ulong    MagicNumber      = 999911;     // รหัสประจำตัว EA

//--- Global variables
CTrade         trade;
int            handleFastEMA, handleSlowEMA, handleRSI;
double         emaFastBuffer[], emaSlowBuffer[], rsiBuffer[];

// Dashboard state
string         g_signalText     = "WAITING";
color          g_signalColor    = NeutralColor;
string         g_patternText    = "-";
string         g_trendText      = "-";
double         g_calcLot        = 0;
string         g_lotMethod      = "";
int            g_myPositions    = 0;
double         g_totalProfit    = 0;
datetime       g_lastSignalTime = 0;
string         g_lastAction     = "";
double         g_emaFastVal     = 0;
double         g_emaSlowVal     = 0;
double         g_rsiVal         = 0;

//--- Panel object names
#define PREFIX "NXAutoBot_"

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   trade.SetExpertMagicNumber(MagicNumber);
   
   // Create Indicator Handles
   handleFastEMA = iMA(_Symbol, PERIOD_CURRENT, FastEMA, 0, MODE_EMA, PRICE_CLOSE);
   handleSlowEMA = iMA(_Symbol, PERIOD_CURRENT, SlowEMA, 0, MODE_EMA, PRICE_CLOSE);
   handleRSI     = iRSI(_Symbol, PERIOD_CURRENT, RSI_Period, PRICE_CLOSE);
   
   if(handleFastEMA == INVALID_HANDLE || handleSlowEMA == INVALID_HANDLE || handleRSI == INVALID_HANDLE)
   {
      Print("Error creating indicator handles");
      return(INIT_FAILED);
   }
   
   ArraySetAsSeries(emaFastBuffer, true);
   ArraySetAsSeries(emaSlowBuffer, true);
   ArraySetAsSeries(rsiBuffer, true);

   if(ShowPanel) CreatePanel();
   
   Print("NexusFX AutoBot v2.0 Started | Magic: ", MagicNumber, " | Risk: ", RiskPercent, "%");
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   IndicatorRelease(handleFastEMA);
   IndicatorRelease(handleSlowEMA);
   IndicatorRelease(handleRSI);
   DeletePanel();
   Print("NexusFX AutoBot Stopped.");
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   // อัพเดต indicators
   UpdateIndicators();
   
   // นับ position ของเรา
   CountMyPositions();
   
   // ตรวจสอบสัญญาณ
   bool hasOpened = false;
   if(g_myPositions < MaxPositions)
   {
      hasOpened = CheckEntrySignal();
   }
   
   // จัดการ Trailing Stop
   if(g_myPositions > 0)
   {
      ManageTrailingStop();
   }
   
   // อัพเดต Panel
   if(ShowPanel) UpdatePanel();
}

//+------------------------------------------------------------------+
//| Update Indicator Values                                          |
//+------------------------------------------------------------------+
void UpdateIndicators()
{
   if(CopyBuffer(handleFastEMA, 0, 1, 3, emaFastBuffer) <= 0) return;
   if(CopyBuffer(handleSlowEMA, 0, 1, 3, emaSlowBuffer) <= 0) return;
   if(CopyBuffer(handleRSI, 0, 1, 2, rsiBuffer) <= 0) return;
   
   g_emaFastVal = emaFastBuffer[0];
   g_emaSlowVal = emaSlowBuffer[0];
   g_rsiVal     = rsiBuffer[0];
   
   // Trend
   if(g_emaFastVal > g_emaSlowVal)
      g_trendText = "▲ UPTREND";
   else if(g_emaFastVal < g_emaSlowVal)
      g_trendText = "▼ DOWNTREND";
   else
      g_trendText = "◆ SIDEWAYS";
}

//+------------------------------------------------------------------+
//| Count My Positions                                               |
//+------------------------------------------------------------------+
void CountMyPositions()
{
   g_myPositions = 0;
   g_totalProfit = 0;
   
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      string symbol = PositionGetSymbol(i);
      if(symbol == _Symbol)
      {
         ulong magic = PositionGetInteger(POSITION_MAGIC);
         if(magic == MagicNumber)
         {
            g_myPositions++;
            g_totalProfit += PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Calculate Lot Size (Risk-Based)                                  |
//+------------------------------------------------------------------+
double CalculateLotSize()
{
   // ถ้ากำหนด Lot คงที่
   if(FixedLotSize > 0)
   {
      g_lotMethod = "FIXED";
      g_calcLot = FixedLotSize;
      return FixedLotSize;
   }
   
   // คำนวณตาม Risk%
   g_lotMethod = StringFormat("RISK %.1f%%", RiskPercent);
   
   double balance    = AccountInfoDouble(ACCOUNT_BALANCE);
   double riskAmount = balance * RiskPercent / 100.0;
   double tickValue  = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   double tickSize   = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   double point      = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   double minLot     = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double maxLot     = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   double lotStep    = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   
   if(tickValue == 0 || tickSize == 0 || StopLossPoints == 0)
   {
      g_calcLot = minLot;
      return minLot;
   }
   
   // SL in price
   double slPrice = StopLossPoints * point;
   
   // Lot = riskAmount / (SL_points * tickValue/tickSize)
   double valuePerPoint = tickValue / tickSize * point;
   double calculatedLot = riskAmount / (StopLossPoints * valuePerPoint);
   
   // Round to lot step
   calculatedLot = MathFloor(calculatedLot / lotStep) * lotStep;
   
   // Clamp
   calculatedLot = MathMax(calculatedLot, minLot);
   calculatedLot = MathMin(calculatedLot, maxLot);
   
   g_calcLot = NormalizeDouble(calculatedLot, 2);
   return g_calcLot;
}

//+------------------------------------------------------------------+
//| Check Entry Signal (EMA Cross + RSI Filter)                      |
//+------------------------------------------------------------------+
bool CheckEntrySignal()
{
   if(CopyBuffer(handleFastEMA, 0, 1, 3, emaFastBuffer) <= 0) return false;
   if(CopyBuffer(handleSlowEMA, 0, 1, 3, emaSlowBuffer) <= 0) return false;
   if(CopyBuffer(handleRSI, 0, 1, 2, rsiBuffer) <= 0) return false;
   
   double fastCurrent = emaFastBuffer[0];
   double fastPrev    = emaFastBuffer[1];
   double slowCurrent = emaSlowBuffer[0];
   double slowPrev    = emaSlowBuffer[1];
   double rsi         = rsiBuffer[0];
   
   double ask   = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid   = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   
   // Detect Patterns
   bool emaCrossUp   = (fastPrev < slowPrev && fastCurrent > slowCurrent);
   bool emaCrossDown = (fastPrev > slowPrev && fastCurrent < slowCurrent);
   bool rsiBullish   = (rsi < RSI_BuyLevel);
   bool rsiBearish   = (rsi > RSI_SellLevel);
   
   // Update Pattern Text
   if(emaCrossUp)
      g_patternText = StringFormat("EMA CROSS UP + RSI(%.1f)", rsi);
   else if(emaCrossDown)
      g_patternText = StringFormat("EMA CROSS DOWN + RSI(%.1f)", rsi);
   else
      g_patternText = StringFormat("No Cross | RSI(%.1f)", rsi);
   
   // BUY Signal: EMA Cross Up + RSI not overbought
   if(emaCrossUp && rsiBullish)
   {
      double lot = CalculateLotSize();
      double sl  = ask - (StopLossPoints * point);
      double tp  = ask + (TakeProfitPoints * point);
      
      g_signalText  = "◉ BUY SIGNAL";
      g_signalColor = BuyColor;
      g_lastAction  = StringFormat("BUY %.2f lot @ %.5f | SL: %.5f | TP: %.5f", lot, ask, sl, tp);
      g_lastSignalTime = TimeCurrent();
      
      Print("✅ Signal BUY | Lot: ", lot, " (", g_lotMethod, ") | RSI: ", rsi);
      
      if(trade.Buy(lot, _Symbol, ask, sl, tp, "NexusFX AutoBot Buy"))
         return true;
      else
         Print("❌ Buy failed: ", trade.ResultRetcode());
   }
   // SELL Signal: EMA Cross Down + RSI not oversold
   else if(emaCrossDown && rsiBearish)
   {
      double lot = CalculateLotSize();
      double sl  = bid + (StopLossPoints * point);
      double tp  = bid - (TakeProfitPoints * point);
      
      g_signalText  = "◉ SELL SIGNAL";
      g_signalColor = SellColor;
      g_lastAction  = StringFormat("SELL %.2f lot @ %.5f | SL: %.5f | TP: %.5f", lot, bid, sl, tp);
      g_lastSignalTime = TimeCurrent();
      
      Print("✅ Signal SELL | Lot: ", lot, " (", g_lotMethod, ") | RSI: ", rsi);
      
      if(trade.Sell(lot, _Symbol, bid, sl, tp, "NexusFX AutoBot Sell"))
         return true;
      else
         Print("❌ Sell failed: ", trade.ResultRetcode());
   }
   else
   {
      g_signalText  = "SCANNING...";
      g_signalColor = NeutralColor;
   }
   
   return false;
}

//+------------------------------------------------------------------+
//| Manage Trailing Stop                                             |
//+------------------------------------------------------------------+
void ManageTrailingStop()
{
   if(TrailingStop == 0) return;
   
   double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   double bid   = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask   = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      string symbol = PositionGetSymbol(i);
      if(symbol == _Symbol)
      {
         ulong ticket = PositionGetInteger(POSITION_TICKET);
         ulong magic  = PositionGetInteger(POSITION_MAGIC);
         
         if(magic == MagicNumber)
         {
            double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
            double currentSL = PositionGetDouble(POSITION_SL);
            double currentTP = PositionGetDouble(POSITION_TP);
            long   type      = PositionGetInteger(POSITION_TYPE);
            
            if(type == POSITION_TYPE_BUY)
            {
               if(bid - openPrice > TrailingStop * point)
               {
                  double newSL = bid - (TrailingStop * point);
                  if(currentSL == 0.0 || newSL > currentSL + (TrailingStep * point))
                  {
                     double newTP = bid + (TakeProfitPoints * point);
                     trade.PositionModify(ticket, newSL, newTP);
                     Print("📈 Trailing BUY #", ticket, " SL: ", newSL, " TP: ", newTP);
                  }
               }
            }
            else if(type == POSITION_TYPE_SELL)
            {
               if(openPrice - ask > TrailingStop * point)
               {
                  double newSL = ask + (TrailingStop * point);
                  if(currentSL == 0.0 || newSL < currentSL - (TrailingStep * point))
                  {
                     double newTP = ask - (TakeProfitPoints * point);
                     trade.PositionModify(ticket, newSL, newTP);
                     Print("📈 Trailing SELL #", ticket, " SL: ", newSL, " TP: ", newTP);
                  }
               }
            }
         }
      }
   }
}

//+------------------------------------------------------------------+
//| CREATE PANEL                                                     |
//+------------------------------------------------------------------+
void CreatePanel()
{
   int panelW = 320;
   int panelH = 360;
   
   // Main Background
   CreateRectangle(PREFIX+"BG", PanelX, PanelY, panelW, panelH, PanelBgColor, PanelBorderColor);
   
   // Title Bar
   CreateRectangle(PREFIX+"TitleBG", PanelX, PanelY, panelW, 26, C'25,32,48', PanelBorderColor);
   CreateLabel(PREFIX+"Title", PanelX+10, PanelY+5, "⚡ NexusFX AutoBot v2.0", TextColor, 10, true);
   CreateLabel(PREFIX+"Magic", PanelX+panelW-85, PanelY+7, "Magic: "+IntegerToString(MagicNumber), NeutralColor, 7, false);
   
   int y = PanelY + 34;
   int lx = PanelX + 12;     // Label X
   int vx = PanelX + 130;    // Value X
   int lineH = 18;
   
   // --- Section: Account ---
   CreateLabel(PREFIX+"SecAcct", lx, y, "── ACCOUNT ──────────", C'60,70,100', 8, true); y += lineH+2;
   CreateLabel(PREFIX+"LblBal",  lx, y, "Balance:", NeutralColor, 9, false);
   CreateLabel(PREFIX+"ValBal",  vx, y, "-", TextColor, 9, true); y += lineH;
   CreateLabel(PREFIX+"LblEq",   lx, y, "Equity:", NeutralColor, 9, false);
   CreateLabel(PREFIX+"ValEq",   vx, y, "-", TextColor, 9, true); y += lineH;
   CreateLabel(PREFIX+"LblMgn",  lx, y, "Free Margin:", NeutralColor, 9, false);
   CreateLabel(PREFIX+"ValMgn",  vx, y, "-", TextColor, 9, true); y += lineH + 6;
   
   // --- Section: Signal ---
   CreateLabel(PREFIX+"SecSig", lx, y, "── SIGNAL & PATTERN ─", C'60,70,100', 8, true); y += lineH+2;
   CreateLabel(PREFIX+"LblSig",  lx, y, "Signal:", NeutralColor, 9, false);
   CreateLabel(PREFIX+"ValSig",  vx, y, "WAITING", NeutralColor, 10, true); y += lineH;
   CreateLabel(PREFIX+"LblTrend",lx, y, "Trend:", NeutralColor, 9, false);
   CreateLabel(PREFIX+"ValTrend",vx, y, "-", TextColor, 9, true); y += lineH;
   CreateLabel(PREFIX+"LblPat",  lx, y, "Pattern:", NeutralColor, 9, false);
   CreateLabel(PREFIX+"ValPat",  vx, y, "-", TextColor, 9, false); y += lineH + 6;
   
   // --- Section: Indicators ---
   CreateLabel(PREFIX+"SecInd", lx, y, "── INDICATORS ───────", C'60,70,100', 8, true); y += lineH+2;
   CreateLabel(PREFIX+"LblEmaF", lx, y, StringFormat("EMA(%d):", FastEMA), NeutralColor, 9, false);
   CreateLabel(PREFIX+"ValEmaF", vx, y, "-", TextColor, 9, true); y += lineH;
   CreateLabel(PREFIX+"LblEmaS", lx, y, StringFormat("EMA(%d):", SlowEMA), NeutralColor, 9, false);
   CreateLabel(PREFIX+"ValEmaS", vx, y, "-", TextColor, 9, true); y += lineH;
   CreateLabel(PREFIX+"LblRsi",  lx, y, StringFormat("RSI(%d):", RSI_Period), NeutralColor, 9, false);
   CreateLabel(PREFIX+"ValRsi",  vx, y, "-", TextColor, 9, true); y += lineH + 6;
   
   // --- Section: Lot & Position ---
   CreateLabel(PREFIX+"SecLot", lx, y, "── LOT & POSITIONS ──", C'60,70,100', 8, true); y += lineH+2;
   CreateLabel(PREFIX+"LblLot",  lx, y, "Lot Size:", NeutralColor, 9, false);
   CreateLabel(PREFIX+"ValLot",  vx, y, "-", TextColor, 9, true); y += lineH;
   CreateLabel(PREFIX+"LblPos",  lx, y, "Positions:", NeutralColor, 9, false);
   CreateLabel(PREFIX+"ValPos",  vx, y, "-", TextColor, 9, true); y += lineH;
   CreateLabel(PREFIX+"LblPnl",  lx, y, "Float PnL:", NeutralColor, 9, false);
   CreateLabel(PREFIX+"ValPnl",  vx, y, "-", TextColor, 9, true); y += lineH + 4;
   
   // --- Last Action ---
   CreateLabel(PREFIX+"LblAct", lx, y, "", NeutralColor, 7, false);
   
   ChartRedraw();
}

//+------------------------------------------------------------------+
//| UPDATE PANEL                                                     |
//+------------------------------------------------------------------+
void UpdatePanel()
{
   // Account
   double balance    = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity     = AccountInfoDouble(ACCOUNT_EQUITY);
   double freeMargin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   
   ObjectSetString(0, PREFIX+"ValBal", OBJPROP_TEXT, StringFormat("$%.2f", balance));
   ObjectSetString(0, PREFIX+"ValEq",  OBJPROP_TEXT, StringFormat("$%.2f", equity));
   ObjectSetString(0, PREFIX+"ValMgn", OBJPROP_TEXT, StringFormat("$%.2f", freeMargin));
   
   // Signal
   ObjectSetString(0, PREFIX+"ValSig",   OBJPROP_TEXT, g_signalText);
   ObjectSetInteger(0, PREFIX+"ValSig",  OBJPROP_COLOR, g_signalColor);
   
   // Trend
   ObjectSetString(0, PREFIX+"ValTrend", OBJPROP_TEXT, g_trendText);
   color trendColor = (g_emaFastVal > g_emaSlowVal) ? BuyColor : (g_emaFastVal < g_emaSlowVal) ? SellColor : NeutralColor;
   ObjectSetInteger(0, PREFIX+"ValTrend", OBJPROP_COLOR, trendColor);
   
   // Pattern
   ObjectSetString(0, PREFIX+"ValPat", OBJPROP_TEXT, g_patternText);
   
   // Indicators
   int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   ObjectSetString(0, PREFIX+"ValEmaF", OBJPROP_TEXT, DoubleToString(g_emaFastVal, digits));
   ObjectSetString(0, PREFIX+"ValEmaS", OBJPROP_TEXT, DoubleToString(g_emaSlowVal, digits));
   
   // RSI with color coding
   ObjectSetString(0, PREFIX+"ValRsi", OBJPROP_TEXT, StringFormat("%.1f", g_rsiVal));
   color rsiColor = NeutralColor;
   if(g_rsiVal > 70)      rsiColor = SellColor;
   else if(g_rsiVal < 30) rsiColor = BuyColor;
   else if(g_rsiVal > RSI_SellLevel) rsiColor = C'255,170,100';
   else if(g_rsiVal < RSI_BuyLevel)  rsiColor = C'100,200,150';
   ObjectSetInteger(0, PREFIX+"ValRsi", OBJPROP_COLOR, rsiColor);
   
   // Lot calculation
   double lot = CalculateLotSize();
   ObjectSetString(0, PREFIX+"ValLot", OBJPROP_TEXT, StringFormat("%.2f  (%s)", lot, g_lotMethod));
   
   // Positions
   ObjectSetString(0, PREFIX+"ValPos", OBJPROP_TEXT, StringFormat("%d / %d", g_myPositions, MaxPositions));
   color posColor = (g_myPositions >= MaxPositions) ? SellColor : (g_myPositions > 0) ? BuyColor : NeutralColor;
   ObjectSetInteger(0, PREFIX+"ValPos", OBJPROP_COLOR, posColor);
   
   // PnL
   ObjectSetString(0, PREFIX+"ValPnl", OBJPROP_TEXT, StringFormat("$%.2f", g_totalProfit));
   ObjectSetInteger(0, PREFIX+"ValPnl", OBJPROP_COLOR, g_totalProfit >= 0 ? BuyColor : SellColor);
   
   // Last Action
   string actText = "";
   if(g_lastAction != "")
   {
      datetime elapsed = TimeCurrent() - g_lastSignalTime;
      actText = StringFormat("Last: %s (%ds ago)", g_lastAction, (int)elapsed);
   }
   ObjectSetString(0, PREFIX+"LblAct", OBJPROP_TEXT, actText);
   
   ChartRedraw();
}

//+------------------------------------------------------------------+
//| Helper: Create Rectangle                                         |
//+------------------------------------------------------------------+
void CreateRectangle(string name, int x, int y, int w, int h, color bgColor, color borderColor)
{
   if(ObjectFind(0, name) >= 0) ObjectDelete(0, name);
   
   ObjectCreate(0, name, OBJ_RECTANGLE_LABEL, 0, 0, 0);
   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, name, OBJPROP_XSIZE, w);
   ObjectSetInteger(0, name, OBJPROP_YSIZE, h);
   ObjectSetInteger(0, name, OBJPROP_BGCOLOR, bgColor);
   ObjectSetInteger(0, name, OBJPROP_COLOR, borderColor);
   ObjectSetInteger(0, name, OBJPROP_BORDER_TYPE, BORDER_FLAT);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, 1);
   ObjectSetInteger(0, name, OBJPROP_BACK, false);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
}

//+------------------------------------------------------------------+
//| Helper: Create Label                                             |
//+------------------------------------------------------------------+
void CreateLabel(string name, int x, int y, string text, color clr, int fontSize, bool bold)
{
   if(ObjectFind(0, name) >= 0) ObjectDelete(0, name);
   
   ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
   ObjectSetString(0, name, OBJPROP_TEXT, text);
   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, fontSize);
   ObjectSetString(0, name, OBJPROP_FONT, bold ? "Arial Bold" : "Arial");
   ObjectSetInteger(0, name, OBJPROP_BACK, false);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
}

//+------------------------------------------------------------------+
//| Delete Panel Objects                                             |
//+------------------------------------------------------------------+
void DeletePanel()
{
   int total = ObjectsTotal(0, 0, -1);
   for(int i = total - 1; i >= 0; i--)
   {
      string name = ObjectName(0, i);
      if(StringFind(name, PREFIX) == 0)
         ObjectDelete(0, name);
   }
   ChartRedraw();
}
//+------------------------------------------------------------------+
