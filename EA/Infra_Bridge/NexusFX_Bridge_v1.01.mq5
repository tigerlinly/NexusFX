//+------------------------------------------------------------------+
//|                                              NexusFX_Bridge.mq5  |
//|                                    Copyright 2026, NexusFX Corp. |
//| Created: 2026-04-01                                              |
//| Updated: 2026-04-08                                              |
//+------------------------------------------------------------------+
#property copyright "NexusFX"
#property link      "https://nexusfx.com"
#property version   "1.01"
#property strict

//--- Input parameters
input string   API_URL = "http://203.151.66.51:4000"; // Web Service URL 
input string   BRIDGE_TOKEN = "";                   // EA Bridge Token (จากหน้าระบบ)
input int      SyncDelayMS = 3000;                  // ความถี่ในการ Sync (มิลลิวินาที)

//--- Dashboard Globals
string dash_status = "Waiting...";
string dash_last_update = "-";
string dash_balance = "0.00";
string dash_equity = "0.00";
string dash_http_code = "-";

int g_PanelX = 20;
int g_PanelY = 20;
bool g_minimized = false;
void UpdateLabel(string name, string text, int x, int y, color clr, int fontsize=10, string font="Arial") {
    if(ObjectFind(0, name) < 0) {
        ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
        ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
    }
    ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
    ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
    ObjectSetString(0, name, OBJPROP_TEXT, text);
    ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
    ObjectSetInteger(0, name, OBJPROP_FONTSIZE, fontsize);
    ObjectSetString(0, name, OBJPROP_FONT, font);
}

void DrawDashboard() {
    RemoveDashboard();
    int x = g_PanelX;
    int y = g_PanelY;
    int y_gap = 25;
    int width = 450;
    int height = g_minimized ? 35 : 180;
    
    // Background
    ObjectCreate(0, "BRG_BG", OBJ_RECTANGLE_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "BRG_BG", OBJPROP_XDISTANCE, x - 10);
    ObjectSetInteger(0, "BRG_BG", OBJPROP_YDISTANCE, y - 10);
    ObjectSetInteger(0, "BRG_BG", OBJPROP_XSIZE, width);
    ObjectSetInteger(0, "BRG_BG", OBJPROP_YSIZE, height);
    ObjectSetInteger(0, "BRG_BG", OBJPROP_BGCOLOR, C'15,20,30');
    ObjectSetInteger(0, "BRG_BG", OBJPROP_COLOR, clrDodgerBlue);
    ObjectSetInteger(0, "BRG_BG", OBJPROP_BORDER_TYPE, BORDER_FLAT);
    ObjectSetInteger(0, "BRG_BG", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "BRG_BG", OBJPROP_SELECTABLE, true);
    
    UpdateLabel("BRG_Title", "🌉 NexusFX Bridge (Two-Way Sync)", x, y, clrCyan, 12, "Arial Bold");
    UpdateLabel("BRG_Toggle", g_minimized ? "[+]" : "[-]", x + width - 40, y, clrOrange, 12, "Arial Bold");
    
    if(g_minimized) return;
    
    y += y_gap;
    UpdateLabel("BRG_Lbl1", "Server URL:", x, y, clrLightGray);
    UpdateLabel("BRG_Val1", API_URL, x + 100, y, clrWhite);
    y += y_gap;

    UpdateLabel("BRG_Lbl2", "Status:", x, y, clrLightGray);
    color statusClr = (StringFind(dash_status, "ERROR") >= 0 || StringFind(dash_status, "❌") >= 0) ? clrRed : clrLime;
    UpdateLabel("BRG_Val2", dash_status, x + 100, y, statusClr);
    y += y_gap;

    UpdateLabel("BRG_Lbl3", "Last Sync:", x, y, clrLightGray);
    UpdateLabel("BRG_Val3", dash_last_update, x + 100, y, clrYellow);
    y += y_gap;

    UpdateLabel("BRG_Lbl4", "Balance / Eq:", x, y, clrLightGray);
    UpdateLabel("BRG_Val4", "$" + dash_balance + "  /  $" + dash_equity, x + 100, y, clrWhite);
    y += y_gap;

    UpdateLabel("BRG_Lbl5", "HTTP Code:", x, y, clrLightGray);
    UpdateLabel("BRG_Val5", dash_http_code, x + 100, y, clrOrange);
    
    ChartRedraw(0);
}

void RemoveDashboard() {
    ObjectsDeleteAll(0, "BRG_");
}

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   if (BRIDGE_TOKEN == "") {
      dash_status = "❌ ERROR: No Token!";
      dash_http_code = "WAIT";
      DrawDashboard();
      Alert("NexusFX Error: Please enter BRIDGE_TOKEN in inputs!");
      return(INIT_FAILED);
   }

   DrawDashboard();
   EventSetMillisecondTimer(SyncDelayMS);
   Print("NexusFX Bridge Started. Sync every ", SyncDelayMS/1000.0, " seconds.");
   
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   RemoveDashboard();
   Print("NexusFX Bridge Stopped.");
}

void OnTimer()
{
   SendSyncData();
}

void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam) {
    if(id == CHARTEVENT_OBJECT_CLICK && sparam == "BRG_Toggle") {
        g_minimized = !g_minimized;
        DrawDashboard();
    }
    if(id == CHARTEVENT_OBJECT_DRAG && sparam == "BRG_BG") {
        g_PanelX = (int)ObjectGetInteger(0, sparam, OBJPROP_XDISTANCE) + 10;
        g_PanelY = (int)ObjectGetInteger(0, sparam, OBJPROP_YDISTANCE) + 10;
        DrawDashboard();
    }
    if(id == CHARTEVENT_OBJECT_CLICK && sparam == "BRG_BG") {
        ObjectSetInteger(0, "BRG_BG", OBJPROP_SELECTED, false); 
    }
}

void SendSyncData()
{
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity  = AccountInfoDouble(ACCOUNT_EQUITY);
   
   dash_balance = DoubleToString(balance, 2);
   dash_equity = DoubleToString(equity, 2);

   string json = "{";
   json += "\"balance\":" + DoubleToString(balance, 2) + ",";
   json += "\"equity\":" + DoubleToString(equity, 2) + ",";
   json += "\"trades\":[";

   int total = PositionsTotal();
   bool first = true;
   for(int i = 0; i < total; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0)
      {
         string symbol = PositionGetString(POSITION_SYMBOL);
         int type = (int)PositionGetInteger(POSITION_TYPE); 
         double lots = PositionGetDouble(POSITION_VOLUME);
         double open_price = PositionGetDouble(POSITION_PRICE_OPEN);
         double sl = PositionGetDouble(POSITION_SL);
         double tp = PositionGetDouble(POSITION_TP);
         double current_price = PositionGetDouble(POSITION_PRICE_CURRENT);
         double profit = PositionGetDouble(POSITION_PROFIT);
         long open_time = PositionGetInteger(POSITION_TIME);

         if(!first) json += ",";
         
         json += "{";
         json += "\"ticket\":\"" + IntegerToString(ticket) + "\",";
         json += "\"symbol\":\"" + symbol + "\",";
         json += "\"type\":" + IntegerToString(type) + ",";
         json += "\"lots\":" + DoubleToString(lots, 2) + ",";
         json += "\"open_price\":" + DoubleToString(open_price, 5) + ",";
         json += "\"sl\":" + DoubleToString(sl, 5) + ",";
         json += "\"tp\":" + DoubleToString(tp, 5) + ",";
         json += "\"current_price\":" + DoubleToString(current_price, 5) + ",";
         json += "\"profit\":" + DoubleToString(profit, 2) + ",";
         json += "\"open_time\":" + IntegerToString(open_time);
         json += "}";
         
         first = false;
      }
   }
   json += "]}";

   char post_data[];
   int str_len = StringToCharArray(json, post_data, 0, WHOLE_ARRAY, CP_UTF8);
   if (str_len > 0) ArrayResize(post_data, str_len - 1); 

   string headers = "Content-Type: application/json\r\n";
   headers += "x-bridge-token: " + BRIDGE_TOKEN + "\r\n";
   
   string result_headers;
   char result_data[];
   string url = API_URL + "/api/bridge/sync";

   int res = WebRequest("POST", url, headers, 3000, post_data, result_data, result_headers);
   dash_http_code = IntegerToString(res);
   dash_last_update = TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS);

   if(res == 401 || res == 403 || res == 404) {
      dash_status = "❌ Token Invalid / Rejected (" + IntegerToString(res) + ")";
      EventKillTimer(); 
   } else if (res == -1 || res == 1) { 
      dash_status = "❌ MT5 Blocked WebRequest URL";
      EventKillTimer();
   } else if (res == 200 || res == 201) {
      dash_status = "✅ Connected & Syncing";
      string response_text = CharArrayToString(result_data);
      ProcessPendingCommands(response_text);
      ProcessKillSwitch(response_text);
   } else {
      string err_txt = CharArrayToString(result_data);
      if(StringLen(err_txt) > 30) err_txt = StringSubstr(err_txt, 0, 30);
      dash_status = "⚠️ Error: " + err_txt;
   }
   
   DrawDashboard();
}

string ExtractJsonValue(string json, string key) {
   string searchObj = "\"" + key + "\":";
   int start = StringFind(json, searchObj);
   if(start == -1) return "";
   
   start += StringLen(searchObj);
   
   if(StringSubstr(json, start, 1) == "\"") {
      start++; 
      int end = StringFind(json, "\"", start);
      return StringSubstr(json, start, end - start);
   } else {
      int endComma = StringFind(json, ",", start);
      int endBracket = StringFind(json, "}", start);
      int end = -1;
      
      if(endComma != -1 && endBracket != -1) end = MathMin(endComma, endBracket);
      else if(endComma != -1) end = endComma;
      else if(endBracket != -1) end = endBracket;
      
      if(end != -1) {
         string val = StringSubstr(json, start, end - start);
         StringReplace(val, " ", ""); 
         return val;
      }
   }
   return "";
}

void ProcessKillSwitch(string response) {
   string kill_val = ExtractJsonValue(response, "kill_switch");
   if(kill_val == "true") {
      GlobalVariableSet("NEXUS_KILL_SWITCH", 1.0);
      dash_status = "⚠️ GLOBAL KILL SWITCH ACTIVE";
   } else {
      if(GlobalVariableCheck("NEXUS_KILL_SWITCH")) {
         GlobalVariableDel("NEXUS_KILL_SWITCH");
      }
   }
}

#include <Trade\Trade.mqh>
CTrade trade;

void ProcessPendingCommands(string response)
{
   int pending_start = StringFind(response, "\"pending_commands\":[");
   if(pending_start == -1) return;
   
   int commands_array_start = pending_start + 20;
   int commands_array_end = StringFind(response, "]", commands_array_start);
   if(commands_array_end == -1) return;
   
   string commands_str = StringSubstr(response, commands_array_start, commands_array_end - commands_array_start);
   if(StringLen(commands_str) <= 2) return; 
   
   int pos = 0;
   while(true) {
      int obj_start = StringFind(commands_str, "{", pos);
      if(obj_start == -1) break;
      
      int obj_end = StringFind(commands_str, "}", obj_start);
      if(obj_end == -1) break;
      
      string cmd_obj = StringSubstr(commands_str, obj_start, obj_end - obj_start + 1);
      
      string order_id = ExtractJsonValue(cmd_obj, "id");
      string symbol   = ExtractJsonValue(cmd_obj, "symbol");
      string side     = ExtractJsonValue(cmd_obj, "side");
      double lot_size = StringToDouble(ExtractJsonValue(cmd_obj, "quantity"));
      
      if(order_id != "" && symbol != "") {
         ExecuteOrder(order_id, symbol, side, lot_size);
      }
      
      pos = obj_end + 1;
   }
}

void ExecuteOrder(string order_id, string symbol, string side, double lot)
{
   Print("Executing Command from NexusFX: ", side, " ", lot, " ", symbol);
   bool success = false;
   ulong ticket = 0;
   double exec_price = 0;
   string error_msg = "";
   
   if(side == "BUY") {
      success = trade.Buy(lot, symbol);
   } else if (side == "SELL") {
      success = trade.Sell(lot, symbol);
   } else {
      error_msg = "Unknown side: " + side;
   }
   
   if(success) {
      ticket = trade.ResultOrder();
      exec_price = trade.ResultPrice();
   } else {
      error_msg = IntegerToString(trade.ResultRetcode());
   }
   
   ReportCommandResult(order_id, success, ticket, exec_price, error_msg);
}

void ReportCommandResult(string order_id, bool success, ulong ticket, double price, string err)
{
   string json = "{";
   json += "\"order_id\":" + order_id + ",";
   json += "\"success\":" + (success ? "true" : "false") + ",";
   json += "\"ticket\":\"" + IntegerToString(ticket) + "\",";
   json += "\"execution_price\":" + DoubleToString(price, 5) + ",";
   json += "\"error_message\":\"" + err + "\"";
   json += "}";
   
   char post_data[];
   int str_len = StringToCharArray(json, post_data, 0, WHOLE_ARRAY, CP_UTF8);
   if (str_len > 0) ArrayResize(post_data, str_len - 1); 
   
   string headers = "Content-Type: application/json\r\nx-bridge-token: " + BRIDGE_TOKEN + "\r\n";
   string result_headers;
   char result_data[];
   
   string url = API_URL + "/api/bridge/command-result";
   WebRequest("POST", url, headers, 3000, post_data, result_data, result_headers);
}
