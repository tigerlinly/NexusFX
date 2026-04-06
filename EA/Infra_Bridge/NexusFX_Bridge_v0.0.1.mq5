//+------------------------------------------------------------------+
//|                                              NexusFX_Bridge.mq5  |
//|                                    Copyright 2026, NexusFX Corp. |
//+------------------------------------------------------------------+
#property copyright "NexusFX"
#property link      "https://nexusfx.com"
#property version   "0.0.1"
#property strict

//--- Input parameters
input string   API_URL = "http://YOUR_VPS_IP:5000"; // Web Service URL 
input string   BRIDGE_TOKEN = "";                   // EA Bridge Token (จากหน้าระบบ)
input int      SyncDelayMS = 3000;                  // ความถี่ในการ Sync (มิลลิวินาที)

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   if (BRIDGE_TOKEN == "") {
      Alert("NexusFX Error: Please enter BRIDGE_TOKEN in inputs!");
      return(INIT_FAILED);
   }

   // Enable millisecond timer
   EventSetMillisecondTimer(SyncDelayMS);
   Print("NexusFX Bridge Started. Sync every ", SyncDelayMS/1000.0, " seconds.");
   
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("NexusFX Bridge Stopped.");
}

//+------------------------------------------------------------------+
//| Timer function                                                   |
//+------------------------------------------------------------------+
void OnTimer()
{
   SendSyncData();
}

//+------------------------------------------------------------------+
//| Send Sync Data to Backend (Balance, Equity, Trades)              |
//+------------------------------------------------------------------+
void SendSyncData()
{
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity  = AccountInfoDouble(ACCOUNT_EQUITY);

   // สร้าง Payload เป็น JSON แบบรวดเร็ว
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
         int type = (int)PositionGetInteger(POSITION_TYPE); // 0=BUY, 1=SELL
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

   // แปลงข้อมูลเป็น Char Array สำหรับ POST request
   char post_data[];
   int str_len = StringToCharArray(json, post_data, 0, WHOLE_ARRAY, CP_UTF8);
   
   // เราลบ null terminator ตอนส่ง
   if (str_len > 0) ArrayResize(post_data, str_len - 1); 

   string headers = "Content-Type: application/json\r\n";
   headers += "x-bridge-token: " + BRIDGE_TOKEN + "\r\n";
   
   string result_headers;
   char result_data[];
   
   string url = API_URL + "/api/bridge/sync";

   // Call WebRequest
   int res = WebRequest("POST", url, headers, 3000, post_data, result_data, result_headers);
   
   // พิมพ์เตือนถ้าพัง
   if(res == 401) {
      Print("NexusFX Error: Invalid Bridge Token.");
      EventKillTimer(); // ปิดการส่งถ้า Token ผิด
   } else if (res == 1) { // 1 = ERROR_NOT_PERMISSION_URL ในบางแพลตฟอร์ม
      Print("NexusFX Error: WebRequest failed! Did you allow the URL in MT5 Tools -> Options -> Expert Advisors?");
      EventKillTimer();
   } else if (res == 200) {
      // Process pending commands
      string response_text = CharArrayToString(result_data);
      ProcessPendingCommands(response_text);
   } else {
      Print("Sync failed. Error HTTP code: ", res);
   }
}

//+------------------------------------------------------------------+
//| Simple JSON Extractor (Manual Parse)                             |
//+------------------------------------------------------------------+
string ExtractJsonValue(string json, string key) {
   string searchObj = "\"" + key + "\":";
   int start = StringFind(json, searchObj);
   if(start == -1) return "";
   
   start += StringLen(searchObj);
   
   // Check if string
   if(StringSubstr(json, start, 1) == "\"") {
      start++; // skip quote
      int end = StringFind(json, "\"", start);
      return StringSubstr(json, start, end - start);
   } else {
      // Find next comma or bracket
      int endComma = StringFind(json, ",", start);
      int endBracket = StringFind(json, "}", start);
      int end = -1;
      
      if(endComma != -1 && endBracket != -1) end = MathMin(endComma, endBracket);
      else if(endComma != -1) end = endComma;
      else if(endBracket != -1) end = endBracket;
      
      if(end != -1) {
         string val = StringSubstr(json, start, end - start);
         StringReplace(val, " ", ""); // strip spaces
         return val;
      }
   }
   return "";
}

//+------------------------------------------------------------------+
//| Order Execution                                                  |
//+------------------------------------------------------------------+
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
   if(StringLen(commands_str) <= 2) return; // Empty array
   
   // Loop through objects
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
