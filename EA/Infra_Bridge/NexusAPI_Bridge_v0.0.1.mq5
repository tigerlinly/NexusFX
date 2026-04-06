//+------------------------------------------------------------------+
//|                                              NexusAPI_Bridge.mq5 |
//|                                      Copyright 2026, NexusFX Co. |
//|                                             https://nexusfx.com  |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, NexusFX Co."
#property link      "https://nexusfx.com"
#property version   "0.0.1"

#include <Trade\Trade.mqh>

//--- Inputs ---
input string   InpGatewayPollURL    = "http://127.0.0.1:3000/api/trade/poll";
input string   InpGatewayCallbackURL= "http://127.0.0.1:3000/api/trade/callback";
input string   InpAPIKey            = "NEXUS_TEST_KEY_123";
input int      InpPollIntervalMs    = 1000; // เช็คออเดอร์ใหม่ทุกๆ 1 วินาที

CTrade trade;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
    // ตั้งเวลาให้ EA ทำงานรัวๆ ตามมิลลิวินาที (Polling)
    EventSetMillisecondTimer(InpPollIntervalMs);
    Print("🚀 Nexus API Bridge Initialized. Polling every ", InpPollIntervalMs, " ms.");
    return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
    EventKillTimer();
    Print("🛑 Nexus API Bridge Stopped.");
}

//+------------------------------------------------------------------+
//| Timer function (หัวใจในการดึงออเดอร์)                            |
//+------------------------------------------------------------------+
void OnTimer()
{
    char post[], result[];
    // ใส่ API Key ไปใน Header เพื่อระบุตัวตนว่าเป็นพอร์ตไหน
    string headers = "Authorization: Bearer " + InpAPIKey + "\r\n";
    string result_headers;
    
    // ยิงไปถามเซิร์ฟเวอร์ด้วย GET Request ว่ามีออเดอร์ให้ยิงไหม (Polling)
    int res = WebRequest("GET", InpGatewayPollURL, headers, 3000, post, result, result_headers);
    
    // ถ้า Server ตอบกลับ 200 (Success)
    if(res == 200) {
        string responseText = CharArrayToString(result);
        
        // สมมติถ้าไม่มีออเดอร์ Server จะตอบกลับมาเป็นคำว่า "NONE"
        if (StringLen(responseText) > 0 && responseText != "NONE") {
            ProcessCommands(responseText);
        }
    } else if(res != 200 && res > 0) { 
        // ถ้าเข้าถึง Server ได้ แต่เกิด Error
        Print("[Bridge] Polling Error HTTP Status: ", res);
    }
}

//+------------------------------------------------------------------+
//| กระบวนการแกะคำสั่งและเล็งยิงออเดอร์                               |
//| เพื่อหลีกเลี่ยงความปวดหัวกับไลบรารี Parsing JSON ใน MQL5          |
//| เราให้ Node.js ส่งข้อความดิบมาเลยในรูปแบบ:                       |
//| รหัสคำสั่ง|แอคชัน|คู่เงิน|Lot|SL|TP|เลขTicket                       |
//| ตัวอย่าง: CMD_999|BUY|EURUSD|0.01|1.0500|1.0600|0                 |
//+------------------------------------------------------------------+
void ProcessCommands(string rawData)
{
    // ใช้ string split แยกหลายๆ คำสั่งเวลามีส่งมาพร้อมกันทีละเยอะๆ ด้วย Enter (\n)
    string commands[];
    int numCommands = StringSplit(rawData, '\n', commands);
    
    for(int i=0; i<numCommands; i++) {
        string cmd = commands[i];
        StringTrimLeft(cmd); StringTrimRight(cmd);
        if(StringLen(cmd) == 0) continue;
        
        string parts[];
        int numParts = StringSplit(cmd, '|', parts);
        if(numParts < 7) {
            Print("⚠️ Invalid command format received: ", cmd);
            continue;
        }
        
        string taskId = parts[0];
        string action = parts[1];
        string symbol = parts[2];
        double vol    = StringToDouble(parts[3]);
        double sl     = StringToDouble(parts[4]);
        double tp     = StringToDouble(parts[5]);
        ulong  ticket = StringToInteger(parts[6]); // ใช้แค่ตอนสั่งปิดไม้ หรือแก้ TP/SL
        
        bool success = false;
        string msg = "";
        
        Print("🎯 Executing Signal: ", action, " ", symbol, " Lot:", vol);
        
        // ระบบลั่นไก (Execution)
        if(action == "BUY") {
            success = trade.Buy(vol, symbol, 0, sl, tp);
            msg = success ? "Success" : "Failed Code: " + IntegerToString(trade.ResultRetcode());
        }
        else if(action == "SELL") {
            success = trade.Sell(vol, symbol, 0, sl, tp);
            msg = success ? "Success" : "Failed Code: " + IntegerToString(trade.ResultRetcode());
        }
        else if(action == "CLOSE") {
            success = trade.PositionClose(ticket);
            msg = success ? "Closed" : "Failed Code: " + IntegerToString(trade.ResultRetcode());
        }
        else {
            Print("❓ Unknown action: ", action);
            continue;
        }
        
        // ยิงกลับไปบอกเซิร์ฟเวอร์ว่างานที่สั่งมา เรา "ทำเสร็จแล้ว" หรือ "พัง" ถือเป็นการ Commit คิวงาน
        ReportTaskCompletion(taskId, success, msg);
    }
}

//+------------------------------------------------------------------+
//| ระบบส่งใบเสร็จกลับไปรายงานผลให้เซิร์ฟเวอร์                          |
//+------------------------------------------------------------------+
void ReportTaskCompletion(string taskId, bool success, string message)
{
    string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + InpAPIKey + "\r\n";
    char post[], result[];
    string result_headers;
    
    // สร้าง Payload JSON ส่งใบเสร็จ
    string status = success ? "SUCCESS" : "FAILED";
    string jsonPayload = "{\"task_id\":\"" + taskId + "\",\"status\":\"" + status + "\",\"message\":\"" + message + "\"}";
    
    StringToCharArray(jsonPayload, post, 0, WHOLE_ARRAY, CP_UTF8);
    ArrayResize(post, ArraySize(post) - 1); // ตัดขยะ \0 ป้องกันบัค Error 500 เหมือนตอน HistoryPump!
    
    int res = WebRequest("POST", InpGatewayCallbackURL, headers, 3000, post, result, result_headers);
    if(res == 200 || res == 201) {
        Print("✅ Feedback sent to server for Task: ", taskId);
    } else {
        Print("❌ Failed to send feedback to server. HTTP: ", res);
    }
}
