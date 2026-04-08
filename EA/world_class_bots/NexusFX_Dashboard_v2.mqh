//+------------------------------------------------------------------+
//|                                         NexusFX_Dashboard_v2.mqh |
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
   ObjectSetInteger(0,name,OBJPROP_BACK,false);
   ObjectSetInteger(0,name,OBJPROP_ZORDER,100);
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
   ObjectSetInteger(0,name,OBJPROP_BACK,false);
   ObjectSetInteger(0,name,OBJPROP_ZORDER,101);
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
   ObjectSetInteger(0,name,OBJPROP_ZORDER,101);
   ObjectSetInteger(0,name,OBJPROP_BACK,false);
}

void Dash_CreatePanel(string botName, ulong magicNumber)
{
   dash_magic = magicNumber;
   g_botName = botName;
   int pw = 280;
   int ph = 275; // ขยายความสูงเพิ่มสำหรับปุ่ม Start/Stop
   
   Dash_CreateRect(DASH_PREFIX+"BG", g_PanelX, g_PanelY, pw, ph, PanelBgColor, PanelBorderColor, true);
   Dash_CreateRect(DASH_PREFIX+"TBG", g_PanelX, g_PanelY, pw, 26, C'25,32,48', PanelBorderColor, false);
   
   Dash_CreateLbl(DASH_PREFIX+"Title", g_PanelX+10, g_PanelY+5, "⚡ " + botName + (g_DashIsRunning ? "" : " [HALTED]"), TextColor, 10, true);
   
   int h = 18;
   int y = g_PanelY + 34;
   int lx = g_PanelX + 12;
   int vx = g_PanelX + 100;
   
   Dash_CreateLbl(DASH_PREFIX+"S1", lx, y, "── ACCOUNT ────────────────", C'60,70,100', 8, true); y+=h+4;
   Dash_CreateLbl(DASH_PREFIX+"LBal", lx, y, "Balance:", NeutralColor, 9, false);
   Dash_CreateLbl(DASH_PREFIX+"VBal", vx, y, "-", TextColor, 9, true); y+=h;
   Dash_CreateLbl(DASH_PREFIX+"LEq", lx, y, "Equity:", NeutralColor, 9, false);
   Dash_CreateLbl(DASH_PREFIX+"VEq", vx, y, "-", TextColor, 9, true); y+=h;
   Dash_CreateLbl(DASH_PREFIX+"LMgn", lx, y, "Margin:", NeutralColor, 8, false);
   Dash_CreateLbl(DASH_PREFIX+"VMgn", vx, y, "-", TextColor, 8, true); y+=h+4;
   
   Dash_CreateLbl(DASH_PREFIX+"S2", lx, y, "── STATUS ─────────────────", C'60,70,100', 8, true); y+=h+4;
   
   Dash_CreateLbl(DASH_PREFIX+"LMag", lx, y, "Magic No.:", NeutralColor, 9, false);
   Dash_CreateLbl(DASH_PREFIX+"VMag", vx, y, IntegerToString(magicNumber), clrYellow, 9, true); y+=h;

   Dash_CreateLbl(DASH_PREFIX+"LSig", lx, y, "Status:", NeutralColor, 9, false);
   Dash_CreateLbl(DASH_PREFIX+"VSig", vx, y, "SCANNING", NeutralColor, 9, true); y+=h;
   Dash_CreateLbl(DASH_PREFIX+"LPos", lx, y, "Positions:", NeutralColor, 9, false);
   Dash_CreateLbl(DASH_PREFIX+"VPos", vx, y, "0", TextColor, 9, true); y+=h;
   Dash_CreateLbl(DASH_PREFIX+"LPnl", lx, y, "Float PnL:", NeutralColor, 9, false);
   Dash_CreateLbl(DASH_PREFIX+"VPnl", vx, y, "$0.00", TextColor, 9, true); y+=h+4;
   
   Dash_CreateLbl(DASH_PREFIX+"S3", lx, y, "── ACTIONS ────────────────", C'60,70,100', 8, true); y+=h+4;
   Dash_CreateBtn(DASH_PREFIX+"BtnStart",  lx,      y, 120, 22, "▶ START BOT",  C'40,110,60');
   Dash_CreateBtn(DASH_PREFIX+"BtnStop",   lx+126,  y, 120, 22, "⏸ STOP BOT",   C'120,50,30');
   y += 28;
   Dash_CreateBtn(DASH_PREFIX+"BtnCloseWin",  lx,      y, 78, 22, "Close Win",  C'0,150,100');
   Dash_CreateBtn(DASH_PREFIX+"BtnCloseLoss", lx+84,  y, 78, 22, "Close Loss", C'180,50,70');
   Dash_CreateBtn(DASH_PREFIX+"BtnCloseAll",  lx+168, y, 78, 22, "Close All",  C'150,30,30');

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
   ObjectSetString(0, DASH_PREFIX+"VMgn", OBJPROP_TEXT, StringFormat("$%.2f", AccountInfoDouble(ACCOUNT_MARGIN_FREE)));
   
   if(!g_DashIsRunning) {
      ObjectSetString(0, DASH_PREFIX+"VSig", OBJPROP_TEXT, "BOT HALTED");
      ObjectSetInteger(0, DASH_PREFIX+"VSig", OBJPROP_COLOR, clrRed);
   } else {
      ObjectSetString(0, DASH_PREFIX+"VSig", OBJPROP_TEXT, signalStatus);
      ObjectSetInteger(0, DASH_PREFIX+"VSig", OBJPROP_COLOR, signalColor);
   }
   
   ObjectSetString(0, DASH_PREFIX+"VPos", OBJPROP_TEXT, IntegerToString(positions));
   ObjectSetInteger(0, DASH_PREFIX+"VPos", OBJPROP_COLOR, positions > 0 ? BuyColor : NeutralColor);
   
   ObjectSetString(0, DASH_PREFIX+"VPnl", OBJPROP_TEXT, StringFormat("$%.2f", pnl));
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
                    
                    if(sparam == DASH_PREFIX+"BtnCloseWin" && prof > 0.0) dashTrade.PositionClose(tk);
                    if(sparam == DASH_PREFIX+"BtnCloseLoss" && prof < 0.0) dashTrade.PositionClose(tk);
                    if(sparam == DASH_PREFIX+"BtnCloseAll") dashTrade.PositionClose(tk);
                }
            }
        }
        else if (sparam == DASH_PREFIX+"BG") {
            ObjectSetInteger(0, sparam, OBJPROP_SELECTED, false); 
        }
    }
    else if (id == CHARTEVENT_OBJECT_DRAG && sparam == DASH_PREFIX+"BG") {
        g_PanelX = (int)ObjectGetInteger(0, sparam, OBJPROP_XDISTANCE);
        g_PanelY = (int)ObjectGetInteger(0, sparam, OBJPROP_YDISTANCE);
        // Re-align all components based on new X,Y
        Dash_CreatePanel(g_botName, dash_magic);
    }
}
//+------------------------------------------------------------------+
