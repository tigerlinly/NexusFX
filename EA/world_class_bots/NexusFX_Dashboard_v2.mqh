//+------------------------------------------------------------------+
//|                                         NexusFX_Dashboard_v2.mqh |
//|                                    Copyright 2026, NexusFX Corp. |
//+------------------------------------------------------------------+
#property copyright "NexusFX"
#property link      "https://nexusfx.biz"

input color  PanelBgColor     = C'22,26,38'; 
input color  PanelBorderColor = C'45,55,75';
input color  TextColor        = C'220,225,235';
input color  NeutralColor     = C'130,140,160';
input color  BuyColor         = C'0,210,135';
input color  SellColor        = C'255,80,100';

string DASH_PREFIX = "NXDB2_";
int g_PanelX = 20;
int g_PanelY = 20;

void Dash_CreateRect(string name, int x, int y, int w, int h, color bg, color border)
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
   ObjectSetInteger(0,name,OBJPROP_SELECTABLE,false);
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
   ObjectSetInteger(0,name,OBJPROP_SELECTABLE,false);
}

void Dash_CreatePanel(string botName, ulong magicNumber)
{
   int pw = 280;
   int ph = 195;
   
   Dash_CreateRect(DASH_PREFIX+"BG", g_PanelX, g_PanelY, pw, ph, PanelBgColor, PanelBorderColor);
   Dash_CreateRect(DASH_PREFIX+"TBG", g_PanelX, g_PanelY, pw, 26, C'25,32,48', PanelBorderColor);
   
   Dash_CreateLbl(DASH_PREFIX+"Title", g_PanelX+10, g_PanelY+5, "⚡ " + botName, TextColor, 10, true);
   
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
   Dash_CreateLbl(DASH_PREFIX+"LSig", lx, y, "Status:", NeutralColor, 9, false);
   Dash_CreateLbl(DASH_PREFIX+"VSig", vx, y, "SCANNING", NeutralColor, 9, true); y+=h;
   Dash_CreateLbl(DASH_PREFIX+"LPos", lx, y, "Positions:", NeutralColor, 9, false);
   Dash_CreateLbl(DASH_PREFIX+"VPos", vx, y, "0", TextColor, 9, true); y+=h;
   Dash_CreateLbl(DASH_PREFIX+"LPnl", lx, y, "Float PnL:", NeutralColor, 9, false);
   Dash_CreateLbl(DASH_PREFIX+"VPnl", vx, y, "$0.00", TextColor, 9, true);
   
   ChartRedraw();
}

void Dash_UpdatePanel(string signalStatus, color signalColor, int positions, double pnl)
{
   ObjectSetString(0, DASH_PREFIX+"VBal", OBJPROP_TEXT, StringFormat("$%.2f", AccountInfoDouble(ACCOUNT_BALANCE)));
   ObjectSetString(0, DASH_PREFIX+"VEq", OBJPROP_TEXT, StringFormat("$%.2f", AccountInfoDouble(ACCOUNT_EQUITY)));
   ObjectSetString(0, DASH_PREFIX+"VMgn", OBJPROP_TEXT, StringFormat("$%.2f", AccountInfoDouble(ACCOUNT_MARGIN_FREE)));
   
   ObjectSetString(0, DASH_PREFIX+"VSig", OBJPROP_TEXT, signalStatus);
   ObjectSetInteger(0, DASH_PREFIX+"VSig", OBJPROP_COLOR, signalColor);
   
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
//+------------------------------------------------------------------+
