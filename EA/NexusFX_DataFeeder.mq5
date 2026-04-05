//+------------------------------------------------------------------+
//|                                         NexusFX_DataFeeder.mq5   |
//|                                     Copyright 2026, NexusFX Co.  |
//|                                             https://nexusfx.com  |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, NexusFX Co."
#property link      "https://nexusfx.com"
#property version   "1.02" // อัปเดตเวอร์ชันให้โชว์ Error ละเอียด
#property strict
#property description "Real-time Live Data Feeder for NexusFX Data Center"
#property description "Last Modified: 2026-04-05"

input string   InpGatewayURL        = "http://127.0.0.1:3000/api/ingest"; // Endpoint
input string   InpBrokerName        = "EXNESS";                           // Broker ID tag

int OnInit() {
    EventSetTimer(1); 
    Print("NexusFX_DataFeeder (v1.02) started for ", _Symbol);
    return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) {
    EventKillTimer();
    Print("NexusFX_DataFeeder stopped.");
}

void OnTick() {
    SendCurrentCandle(PERIOD_M1);
    SendCurrentCandle(PERIOD_M5);
    SendCurrentCandle(PERIOD_M15);
    SendCurrentCandle(PERIOD_H1);
}

void OnTimer() {
    // Backup sending in case of slow ticks
}

void SendCurrentCandle(ENUM_TIMEFRAMES tf) {
    MqlRates rates[];
    ArraySetAsSeries(rates, true);
    
    // Copy the current active candle (index 0)
    if(CopyRates(_Symbol, tf, 0, 1, rates) <= 0) return;
    
    // Construct JSON Payload for a Single Row (array format)
    string tfStr = "";
    if(tf == PERIOD_M1) tfStr = "M1";
    else if(tf == PERIOD_M5) tfStr = "M5";
    else if(tf == PERIOD_M15) tfStr = "M15";
    else if(tf == PERIOD_H1) tfStr = "H1";
    else return;

    string jsonPayload = "[{";
    jsonPayload += "\"broker\":\"" + InpBrokerName + "\",";
    jsonPayload += "\"symbol\":\"" + _Symbol + "\",";
    jsonPayload += "\"timeframe\":\"" + tfStr + "\",";
    jsonPayload += "\"timestamp\":" + IntegerToString(rates[0].time) + ",";
    jsonPayload += "\"open\":" + DoubleToString(rates[0].open, _Digits) + ",";
    jsonPayload += "\"high\":" + DoubleToString(rates[0].high, _Digits) + ",";
    jsonPayload += "\"low\":" + DoubleToString(rates[0].low, _Digits) + ",";
    jsonPayload += "\"close\":" + DoubleToString(rates[0].close, _Digits) + ",";
    jsonPayload += "\"volume\":" + IntegerToString(rates[0].tick_volume);
    jsonPayload += "}]";

    char post[], result[];
    string headers = "Content-Type: application/json\r\n";
    StringToCharArray(jsonPayload, post, 0, WHOLE_ARRAY, CP_UTF8);
    ArrayResize(post, ArraySize(post) - 1); 
    
    if(ArraySize(post) <= 2) return;

    string result_headers;
    int res = WebRequest("POST", InpGatewayURL, headers, 3000, post, result, result_headers);
    if(res != 200 && res != 201) {
        string errorDetails = CharArrayToString(result);
        // สังเกตโค้ดเปลี่ยนเป็นคำว่า Details เพื่อคายการตอบกลับจาก Express ออกมาครับ
        Print("[ERROR] Gateway rejected real-time tick. HTTP Status: ", res, " | Details: ", errorDetails);
    }
}
