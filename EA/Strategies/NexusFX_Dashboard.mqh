//+------------------------------------------------------------------+
//|                                         NexusFX_Dashboard.mqh |
//|                                    Copyright 2026, NexusFX Corp. |
//+------------------------------------------------------------------+
#property copyright "NexusFX"
#property link      "https://nexusfx.biz"

#include <Trade\Trade.mqh>

input color  PanelBgColor     = C'22,26,38'; 
input color  PanelBorderColor = C'45,55,75';
input color  TextColor        = C'220,225,235';
input color  NeutralColor     = C'130,140,160';
input color  BuyColor         = C'0,210,135';
input color  SellColor        = C'255,80,100';

string DASH_PREFIX = "NXDB2_";
int g_PanelX = 20;
int g_PanelY = 20;
ulong dash_magic = 0;
bool g_DashIsRunning = true; // For Start/Stop control
string g_botName = "";

void Dash_CreateRect(string name, int x, int y, int w, int h, color bg, color border, bool draggable = false)
{
   if(ObjectFind(0,name)>=0) ObjectDelete(0,name);
   ObjectCreate(0,name,OBJ_RECTANGLE_LABEL,0,0,0);
   ObjectSetInteger(0,name,OBJPROP_CORNER,CORNER_LEFT_UPPER);
   ObjectSetInteger(0,name,OBJPROP_XDISTANCE,x);
   ObjectSetInteger(0,name,OBJPROP_YDISTANCE,y);
   ObjectSetInteger(0,name,OBJPROP_XSIZE,w);
   ObjectSetInteger(0,name,OBJPROP_YSIZE,h);
   ObjectSetInteger(0,name,OBJPROP_BGCOLOR,bg);
   ObjectSetInteger(0,name,OBJPROP_COLOR,border);
   ObjectSetInteger(0,name,OBJPROP_BORDER_TYPE,BORDER_FLAT);
   ObjectSetInteger(0,name,OBJPROP_WIDTH,1);
   ObjectSetInteger(0,name,OBJPROP_BACK,false); // ให้อยู่หน้าสุด
   ObjectSetInteger(0,name,OBJPROP_ZORDER,30000); // ให้อยู่หน้าสุด
   ObjectSetInteger(0,name,OBJPROP_SELECTABLE,draggable);
   ObjectSetInteger(0,name,OBJPROP_SELECTED,false);
}

void Dash_CreateLbl(string name, int x, int y, string text, color clr, int sz, bool bold)
{
   if(ObjectFind(0,name)>=0) ObjectDelete(0,name);
   ObjectCreate(0,name,OBJ_LABEL,0,0,0);
   ObjectSetInteger(0,name,OBJPROP_CORNER,CORNER_LEFT_UPPER);
   ObjectSetInteger(0,name,OBJPROP_XDISTANCE,x);
   ObjectSetInteger(0,name,OBJPROP_YDISTANCE,y);
   ObjectSetString(0,name,OBJPROP_TEXT,text);
   ObjectSetInteger(0,name,OBJPROP_COLOR,clr);
   ObjectSetInteger(0,name,OBJPROP_FONTSIZE,sz);
   ObjectSetString(0,name,OBJPROP_FONT,bold?"Arial Bold":"Arial");
   ObjectSetInteger(0,name,OBJPROP_BACK,false); // ให้อยู่หน้าสุด
   ObjectSetInteger(0,name,OBJPROP_ZORDER,30010); // ให้อยู่หน้าสุด
   ObjectSetInteger(0,name,OBJPROP_SELECTABLE,false);
}

void Dash_CreateBtn(string name, int x, int y, int w, int h, string text, color bg)
{
   if(ObjectFind(0,name)>=0) ObjectDelete(0,name);
   ObjectCreate(0,name,OBJ_BUTTON,0,0,0);
   ObjectSetInteger(0,name,OBJPROP_CORNER,CORNER_LEFT_UPPER);
   ObjectSetInteger(0,name,OBJPROP_XDISTANCE,x);
   ObjectSetInteger(0,name,OBJPROP_YDISTANCE,y);
   ObjectSetInteger(0,name,OBJPROP_XSIZE,w);
   ObjectSetInteger(0,name,OBJPROP_YSIZE,h);
   ObjectSetString(0,name,OBJPROP_TEXT,text);
   ObjectSetInteger(0,name,OBJPROP_BGCOLOR,bg);
   ObjectSetInteger(0,name,OBJPROP_COLOR,clrWhite);
   ObjectSetInteger(0,name,OBJPROP_BORDER_COLOR,PanelBorderColor);
   ObjectSetInteger(0,name,OBJPROP_FONTSIZE,8);
   ObjectSetString(0,name,OBJPROP_FONT,"Arial");
   ObjectSetInteger(0,name,OBJPROP_STATE,false);
   ObjectSetInteger(0,name,OBJPROP_ZORDER,30010); // ให้อยู่หน้าสุด
   ObjectSetInteger(0,name,OBJPROP_BACK,false); // ให้อยู่หน้าสุด
}

void Dash_CreateEdit(string name, int x, int y, int w, int h, string text, color bg, color clr)
{
   if(ObjectFind(0,name)>=0) ObjectDelete(0,name);
   ObjectCreate(0,name,OBJ_EDIT,0,0,0);
   ObjectSetInteger(0,name,OBJPROP_CORNER,CORNER_LEFT_UPPER);
   ObjectSetInteger(0,name,OBJPROP_XDISTANCE,x);
   ObjectSetInteger(0,name,OBJPROP_YDISTANCE,y);
   ObjectSetInteger(0,name,OBJPROP_XSIZE,w);
   ObjectSetInteger(0,name,OBJPROP_YSIZE,h);
   ObjectSetString(0,name,OBJPROP_TEXT,text);
   ObjectSetInteger(0,name,OBJPROP_BGCOLOR,bg);
   ObjectSetInteger(0,name,OBJPROP_COLOR,clr);
   ObjectSetInteger(0,name,OBJPROP_BORDER_COLOR,PanelBorderColor);
   ObjectSetInteger(0,name,OBJPROP_FONTSIZE,9);
   ObjectSetString(0,name,OBJPROP_FONT,"Arial");
   ObjectSetInteger(0,name,OBJPROP_ALIGN,ALIGN_CENTER);
   ObjectSetInteger(0,name,OBJPROP_ZORDER,30010); 
   ObjectSetInteger(0,name,OBJPROP_BACK,false); 
   ObjectSetInteger(0,name,OBJPROP_SELECTABLE,false);
}

void Dash_CreatePanel(string botName, ulong magicNumber, string entryTF="Auto", string trendTF="Auto")
{
   dash_magic = magicNumber;
   g_botName = botName;
   int pw = 404;
   int ph = 205;
   
   Dash_CreateRect(DASH_PREFIX+"BG", g_PanelX, g_PanelY, pw, ph, PanelBgColor, PanelBorderColor, true);
   Dash_CreateRect(DASH_PREFIX+"TBG", g_PanelX, g_PanelY, pw, 26, C'25,32,48', PanelBorderColor, false);
   
   Dash_CreateLbl(DASH_PREFIX+"Title", g_PanelX+10, g_PanelY+5, "⚡ " + botName + (g_DashIsRunning ? "" : " [HALTED]"), TextColor, 10, true);
   Dash_CreateLbl(DASH_PREFIX+"DragTip", g_PanelX+pw-110, g_PanelY+6, "(Double-Click to move)", NeutralColor, 7, false);

   int y = g_PanelY + 32;
   int h = 18;
   int lx = g_PanelX + 12;
   int vx = g_PanelX + 75;
   
   // Top Texts Offset (Status / Pos / TFs)
   int cx = g_PanelX + 155;
   int vcx = g_PanelX + 215;
   
   // Action Buttons Offset
   int rx = g_PanelX + 195;
   
   // --- Row 1 ---
   Dash_CreateLbl(DASH_PREFIX+"LMag", lx, y, "Magic No.:", NeutralColor, 9, false);
   Dash_CreateLbl(DASH_PREFIX+"VMag", vx, y, IntegerToString(magicNumber), clrYellow, 9, true); 
   Dash_CreateLbl(DASH_PREFIX+"LSig", cx, y, "Status:", NeutralColor, 9, false);
   Dash_CreateLbl(DASH_PREFIX+"VSig", vcx, y, "SCANNING", NeutralColor, 9, true); 
   y+=h;
   
   // --- Row 2 ---
   Dash_CreateLbl(DASH_PREFIX+"LBal", lx, y, "Balance:", NeutralColor, 9, false);
   Dash_CreateLbl(DASH_PREFIX+"VBal", vx, y, "-", TextColor, 9, true); 
   Dash_CreateLbl(DASH_PREFIX+"LPos", cx, y, "Pos / PnL:", NeutralColor, 9, false);
   Dash_CreateLbl(DASH_PREFIX+"VPos", vcx, y, "0", TextColor, 9, true);
   Dash_CreateLbl(DASH_PREFIX+"VPnl", vcx+20, y, " | $0.00", TextColor, 9, true); 
   y+=h;
   
   // --- Row 3 ---
   Dash_CreateLbl(DASH_PREFIX+"LEq", lx, y, "Equity:", NeutralColor, 9, false);
   Dash_CreateLbl(DASH_PREFIX+"VEq", vx, y, "-", TextColor, 9, true); 
   Dash_CreateLbl(DASH_PREFIX+"LTFs", cx, y, "TFs (E|T):", NeutralColor, 9, false);
   Dash_CreateLbl(DASH_PREFIX+"VTFs", vcx, y, entryTF + " | " + trendTF, clrCyan, 9, true);
   y+=h;
   
   // --- Row 4 (Lot Tools & Sync) ---
   Dash_CreateLbl(DASH_PREFIX+"LMan", lx, y+2, "Lot|Cnt:", NeutralColor, 8, false);
   Dash_CreateEdit(DASH_PREFIX+"ELots", lx+75, y, 35, 18, "0.01", C'25,32,48', TextColor);
   Dash_CreateEdit(DASH_PREFIX+"ECnt",  lx+115, y, 55, 18, "1",    C'25,32,48', TextColor);
   Dash_CreateBtn(DASH_PREFIX+"BtnBuy", rx, y-1, 55, 20, "BUY",  BuyColor);
   Dash_CreateBtn(DASH_PREFIX+"BtnSell",rx+60, y-1, 55, 20, "SELL", SellColor);
   Dash_CreateBtn(DASH_PREFIX+"BtnSync", rx+125, y-1, 72, 20, "♽ SYNC", C'50,100,180');
   y+=h+10;
   
   // --- Row 5 (TP Tools & Start) ---
   Dash_CreateLbl(DASH_PREFIX+"LTP", lx, y+2, "TP PIP | Point:", NeutralColor, 8, false);
   Dash_CreateEdit(DASH_PREFIX+"ETP", lx+75, y, 35, 18, "0", C'25,32,48', TextColor);
   Dash_CreateEdit(DASH_PREFIX+"ETPPoint", lx+115, y, 55, 18, "0", C'25,32,48', TextColor);
   Dash_CreateBtn(DASH_PREFIX+"BtnTPBuy", rx, y-1, 55, 20, "TP BUY", BuyColor);
   Dash_CreateBtn(DASH_PREFIX+"BtnTPSell", rx+60, y-1, 55, 20, "TP SELL", SellColor);
   Dash_CreateBtn(DASH_PREFIX+"BtnStart", rx+125, y-1, 72, 20, "▶ START", C'40,110,60');
   y+=h+10;

   // --- Row 6 (SL Tools & Stop) ---
   Dash_CreateLbl(DASH_PREFIX+"LSL", lx, y+2, "SL PIP | Point:", NeutralColor, 8, false);
   Dash_CreateEdit(DASH_PREFIX+"ESL", lx+75, y, 35, 18, "0", C'25,32,48', TextColor);
   Dash_CreateEdit(DASH_PREFIX+"ESLPoint", lx+115, y, 55, 18, "0", C'25,32,48', TextColor);
   Dash_CreateBtn(DASH_PREFIX+"BtnSLBuy", rx, y-1, 55, 20, "SL BUY", BuyColor);
   Dash_CreateBtn(DASH_PREFIX+"BtnSLSell", rx+60, y-1, 55, 20, "SL SELL", SellColor);
   Dash_CreateBtn(DASH_PREFIX+"BtnStop",  rx+125, y-1, 72, 20, "⏸ STOP", C'120,50,30');
   y+=h+10;
   
   // --- Row 7 (Close Controls) ---
   Dash_CreateBtn(DASH_PREFIX+"BtnCloseBuy",  lx,      y, 72, 22, "Close BUY",  C'0,150,100');
   Dash_CreateBtn(DASH_PREFIX+"BtnCloseSell", lx+77,   y, 72, 22, "Close SELL", C'0,150,100');
   Dash_CreateBtn(DASH_PREFIX+"BtnCloseWin",  lx+154,  y, 72, 22, "Close Win",  C'0,150,100');
   Dash_CreateBtn(DASH_PREFIX+"BtnCloseLoss", lx+231,  y, 72, 22, "Close Loss", C'180,50,70');
   Dash_CreateBtn(DASH_PREFIX+"BtnCloseAll",  lx+308,  y, 72, 22, "Close All",  C'150,30,30');
   
   ChartRedraw();
}

void Dash_UpdatePanel(string signalStatus, color signalColor, int positions, double pnl)
{
   if(GlobalVariableCheck("NEXUS_KILL_SWITCH") && GlobalVariableGet("NEXUS_KILL_SWITCH") == 1.0) {
      g_DashIsRunning = false;
      ObjectSetString(0, DASH_PREFIX+"Title", OBJPROP_TEXT, "⚡ " + g_botName + " [GLOBAL HALT]");
      ObjectSetInteger(0, DASH_PREFIX+"Title", OBJPROP_COLOR, clrRed);
   }

   ObjectSetString(0, DASH_PREFIX+"VBal", OBJPROP_TEXT, StringFormat("$%.2f", AccountInfoDouble(ACCOUNT_BALANCE)));
   ObjectSetString(0, DASH_PREFIX+"VEq", OBJPROP_TEXT, StringFormat("$%.2f", AccountInfoDouble(ACCOUNT_EQUITY)));
   
   if(!g_DashIsRunning) {
      ObjectSetString(0, DASH_PREFIX+"VSig", OBJPROP_TEXT, "BOT HALTED");
      ObjectSetInteger(0, DASH_PREFIX+"VSig", OBJPROP_COLOR, clrRed);
   } else {
      ObjectSetString(0, DASH_PREFIX+"VSig", OBJPROP_TEXT, signalStatus);
      ObjectSetInteger(0, DASH_PREFIX+"VSig", OBJPROP_COLOR, signalColor);
   }
   
   ObjectSetString(0, DASH_PREFIX+"VPos", OBJPROP_TEXT, IntegerToString(positions));
   ObjectSetInteger(0, DASH_PREFIX+"VPos", OBJPROP_COLOR, positions > 0 ? BuyColor : NeutralColor);
   
   ObjectSetString(0, DASH_PREFIX+"VPnl", OBJPROP_TEXT, StringFormat(" | $%.2f", pnl));
   ObjectSetInteger(0, DASH_PREFIX+"VPnl", OBJPROP_COLOR, pnl > 0 ? BuyColor : (pnl < 0 ? SellColor : NeutralColor));
   
   ChartRedraw();
}

void Dash_DeletePanel()
{
   for(int i = ObjectsTotal(0,0,-1)-1; i>=0; i--)
   { string n=ObjectName(0,i); if(StringFind(n,DASH_PREFIX)==0) ObjectDelete(0,n); }
   ChartRedraw();
}

void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam) {
    if(id == CHARTEVENT_OBJECT_CLICK) {
        if(StringFind(sparam, DASH_PREFIX+"Btn") == 0) {
            ObjectSetInteger(0, sparam, OBJPROP_STATE, false); // Detoggle button
            
            if(sparam == DASH_PREFIX+"BtnStart") {
                if(GlobalVariableCheck("NEXUS_KILL_SWITCH") && GlobalVariableGet("NEXUS_KILL_SWITCH") == 1.0) {
                     Alert("NexusFX: Cannot start bot. GLOBAL ADMIN KILL SWITCH is active!");
                } else {
                     g_DashIsRunning = true;
                     ObjectSetString(0, DASH_PREFIX+"Title", OBJPROP_TEXT, "⚡ " + g_botName);
                     ObjectSetInteger(0, DASH_PREFIX+"Title", OBJPROP_COLOR, TextColor);
                     ChartRedraw();
                }
            }
            if(sparam == DASH_PREFIX+"BtnStop") {
                g_DashIsRunning = false;
                ObjectSetString(0, DASH_PREFIX+"Title", OBJPROP_TEXT, "⚡ " + g_botName + " [HALTED]");
                ChartRedraw();
            }
            
            if(StringFind(sparam, "Close") > 0) {
                CTrade dashTrade;
                for(int i = PositionsTotal() - 1; i >= 0; i--) {
                    ulong magic = PositionGetInteger(POSITION_MAGIC);
                    if(magic != dash_magic) continue; // เลือกปิดเฉพาะไม้ที่เป็นของ Bot ตัวนี้
                    
                    double prof = PositionGetDouble(POSITION_PROFIT);
                    ulong tk = PositionGetTicket(i);
                    long type = PositionGetInteger(POSITION_TYPE);
                    
                    if(sparam == DASH_PREFIX+"BtnCloseWin" && prof > 0.0) dashTrade.PositionClose(tk);
                    if(sparam == DASH_PREFIX+"BtnCloseLoss" && prof < 0.0) dashTrade.PositionClose(tk);
                    if(sparam == DASH_PREFIX+"BtnCloseBuy" && type == POSITION_TYPE_BUY) dashTrade.PositionClose(tk);
                    if(sparam == DASH_PREFIX+"BtnCloseSell" && type == POSITION_TYPE_SELL) dashTrade.PositionClose(tk);
                    if(sparam == DASH_PREFIX+"BtnCloseAll") dashTrade.PositionClose(tk);
                }
            }
            
            if(sparam == DASH_PREFIX+"BtnSync") {
                Alert("NexusFX: Manual Sync Requested for " + g_botName);
                
                // --- Visual Feedback ---
                ObjectSetString(0, DASH_PREFIX+"BtnSync", OBJPROP_TEXT, "⏳ SYNCING");
                ObjectSetInteger(0, DASH_PREFIX+"BtnSync", OBJPROP_BGCOLOR, C'200,100,0'); // Orange
                ChartRedraw();
                
                if(GlobalVariableCheck("NX_SYNC_REQUEST_" + IntegerToString(dash_magic))) {
                    GlobalVariableSet("NX_SYNC_REQUEST_" + IntegerToString(dash_magic), 1.0);
                } else {
                    GlobalVariableTemp("NX_SYNC_REQUEST_" + IntegerToString(dash_magic));
                    GlobalVariableSet("NX_SYNC_REQUEST_" + IntegerToString(dash_magic), 1.0);
                }
                
                Sleep(800);
                ObjectSetString(0, DASH_PREFIX+"BtnSync", OBJPROP_TEXT, "♽ SYNC");
                ObjectSetInteger(0, DASH_PREFIX+"BtnSync", OBJPROP_BGCOLOR, C'50,100,180'); // Original blue
                ChartRedraw();
            }
            
            if(sparam == DASH_PREFIX+"BtnBuy" || sparam == DASH_PREFIX+"BtnSell") {
                double lots = StringToDouble(ObjectGetString(0, DASH_PREFIX+"ELots", OBJPROP_TEXT));
                int cnt = (int)StringToInteger(ObjectGetString(0, DASH_PREFIX+"ECnt", OBJPROP_TEXT));
                
                Print("🔘 Button Clicked: ", sparam, " | Lots: ", lots, " | Cnt: ", cnt);
                
                if(lots > 0 && cnt > 0) {
                    CTrade dashTrade;
                    dashTrade.SetExpertMagicNumber(dash_magic);
                    dashTrade.SetDeviationInPoints(500); // Allow deviation
                    
                    for(int i=0; i<cnt; i++) {
                        bool res = false;
                        if(sparam == DASH_PREFIX+"BtnBuy") {
                            res = dashTrade.Buy(lots, _Symbol, 0.0, 0, 0, "Manual Buy " + g_botName);
                        } else {
                            res = dashTrade.Sell(lots, _Symbol, 0.0, 0, 0, "Manual Sell " + g_botName);
                        }
                        
                        if(!res) {
                            Print("❌ Manual Trade Error: ", dashTrade.ResultRetcode(), " - ", dashTrade.ResultRetcodeDescription());
                        } else {
                            Print("✅ Manual Trade Success!");
                        }
                    }
                }
            }
            
            if(sparam == DASH_PREFIX+"BtnTPBuy" || sparam == DASH_PREFIX+"BtnTPSell" || 
               sparam == DASH_PREFIX+"BtnSLBuy" || sparam == DASH_PREFIX+"BtnSLSell") {
                
                double tpPips = StringToDouble(ObjectGetString(0, DASH_PREFIX+"ETP", OBJPROP_TEXT));
                double tpPoint = StringToDouble(ObjectGetString(0, DASH_PREFIX+"ETPPoint", OBJPROP_TEXT));
                double slPips = StringToDouble(ObjectGetString(0, DASH_PREFIX+"ESL", OBJPROP_TEXT));
                double slPoint = StringToDouble(ObjectGetString(0, DASH_PREFIX+"ESLPoint", OBJPROP_TEXT));
                
                CTrade dashTrade;
                dashTrade.SetExpertMagicNumber(dash_magic);
                double dashPointUnit = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
                if(SymbolInfoInteger(_Symbol, SYMBOL_DIGITS) == 5 || SymbolInfoInteger(_Symbol, SYMBOL_DIGITS) == 3) {
                    dashPointUnit *= 10; // Convert to Pips
                }
                
                // Calculate Average Open Price (Volume Weighted)
                double totalVolBuy = 0, totalVolSell = 0;
                double weightedPriceBuy = 0, weightedPriceSell = 0;
                for(int i = PositionsTotal() - 1; i >= 0; i--) {
                    ulong tk = PositionGetTicket(i);
                    if(PositionGetInteger(POSITION_MAGIC) != dash_magic) continue;
                    long type = PositionGetInteger(POSITION_TYPE);
                    double vol = PositionGetDouble(POSITION_VOLUME);
                    double price = PositionGetDouble(POSITION_PRICE_OPEN);
                    
                    if(type == POSITION_TYPE_BUY) {
                        totalVolBuy += vol;
                        weightedPriceBuy += price * vol;
                    } else if(type == POSITION_TYPE_SELL) {
                        totalVolSell += vol;
                        weightedPriceSell += price * vol;
                    }
                }
                double avgBuy = totalVolBuy > 0 ? weightedPriceBuy / totalVolBuy : 0;
                double avgSell = totalVolSell > 0 ? weightedPriceSell / totalVolSell : 0;
                
                for(int i = PositionsTotal() - 1; i >= 0; i--) {
                    ulong magic = PositionGetInteger(POSITION_MAGIC);
                    if(magic != dash_magic) continue;
                    
                    ulong tk = PositionGetTicket(i);
                    long type = PositionGetInteger(POSITION_TYPE);
                    double currentSL = PositionGetDouble(POSITION_SL);
                    double currentTP = PositionGetDouble(POSITION_TP);
                    
                    double newSL = currentSL;
                    double newTP = currentTP;
                    bool modify = false;
                    
                    if(sparam == DASH_PREFIX+"BtnTPBuy" && type == POSITION_TYPE_BUY) {
                         if(tpPoint > 0) newTP = NormalizeDouble(tpPoint, (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS));
                         else if(tpPips > 0 && avgBuy > 0) newTP = NormalizeDouble(avgBuy + (tpPips * dashPointUnit), (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS));
                         if(newTP != currentTP) modify = true;
                    }
                    if(sparam == DASH_PREFIX+"BtnTPSell" && type == POSITION_TYPE_SELL) {
                         if(tpPoint > 0) newTP = NormalizeDouble(tpPoint, (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS));
                         else if(tpPips > 0 && avgSell > 0) newTP = NormalizeDouble(avgSell - (tpPips * dashPointUnit), (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS));
                         if(newTP != currentTP) modify = true;
                    }
                    
                    if(sparam == DASH_PREFIX+"BtnSLBuy" && type == POSITION_TYPE_BUY) {
                         if(slPoint > 0) newSL = NormalizeDouble(slPoint, (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS));
                         else if(slPips > 0 && avgBuy > 0) newSL = NormalizeDouble(avgBuy - (slPips * dashPointUnit), (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS));
                         if(newSL != currentSL) modify = true;
                    }
                    if(sparam == DASH_PREFIX+"BtnSLSell" && type == POSITION_TYPE_SELL) {
                         if(slPoint > 0) newSL = NormalizeDouble(slPoint, (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS));
                         else if(slPips > 0 && avgSell > 0) newSL = NormalizeDouble(avgSell + (slPips * dashPointUnit), (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS));
                         if(newSL != currentSL) modify = true;
                    }
                    
                    if(modify) {
                         dashTrade.PositionModify(tk, newSL, newTP);
                    }
                }
            }
        }
    }
    // Handle Window Dragging
    else if (id == CHARTEVENT_OBJECT_DRAG && sparam == DASH_PREFIX+"BG") {
        g_PanelX = (int)ObjectGetInteger(0, sparam, OBJPROP_XDISTANCE);
        g_PanelY = (int)ObjectGetInteger(0, sparam, OBJPROP_YDISTANCE);
        
        // Re-align all components based on new X,Y
        Dash_CreatePanel(g_botName, dash_magic);
        // Automatically deselect the background so they don't have to keep double-clicking to interact
        ObjectSetInteger(0, sparam, OBJPROP_SELECTED, false);
        ChartRedraw();
    }
}
//+------------------------------------------------------------------+
