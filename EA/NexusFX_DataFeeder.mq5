//+------------------------------------------------------------------+
//|                                           NexusFX_DataFeeder.mq5 |
//|                                      Copyright 2026, NexusFX Co. |
//|                                              https://nexusfx.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, NexusFX Co."
#property link      "https://nexusfx.com"
#property version   "1.01"
#property description "Data Gateway Feeder for NexusFX Data Center"
#property description "This EA pumps market prices into TimescaleDB."
#property description "Last Modified: 2026-04-05"

//===================================================================
// PARAMETERS
//===================================================================
input string   InpGatewayURL        = "http://127.0.0.1:3000/api/ingest"; // API Gateway URL
input string   InpBrokerName        = "GbeBrokers";                       // Broker Name Tag
input int      InpUpdateInterval    = 5;                                  // Sync Interval (Seconds)

//===================================================================
// GLOBAL VARIABLES
//===================================================================
string TimeframeToString(ENUM_TIMEFRAMES tf) {
    if(tf == PERIOD_M1) return "M1";
    if(tf == PERIOD_M5) return "M5";
    if(tf == PERIOD_M15) return "M15";
    if(tf == PERIOD_M30) return "M30";
    if(tf == PERIOD_H1) return "H1";
    if(tf == PERIOD_H4) return "H4";
    if(tf == PERIOD_D1) return "D1";
    return "UNKNOWN";
}

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("---------------------------------------------------------");
   Print("[NexusFX DataFeeder] Starting engine...");
   Print("Gateway Target: ", InpGatewayURL);
   Print("IMPORTANT: Please ensure you have added the Gateway URL");
   Print("to 'Allowed WebRequest URLs' in Tools -> Options -> Expert Advisors");
   Print("---------------------------------------------------------");
   
   // Request data push on a fixed timer rate
   EventSetTimer(InpUpdateInterval);
   
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("[NexusFX DataFeeder] Engine stopped.");
}

//+------------------------------------------------------------------+
//| Timer function                                                   |
//+------------------------------------------------------------------+
void OnTimer()
{
   // Array of timeframes we want to collect and stream simultaneously
   ENUM_TIMEFRAMES tfs[] = {PERIOD_M1, PERIOD_M5, PERIOD_M15, PERIOD_H1};
   int numTfs = ArraySize(tfs);
   
   string jsonPayload = "[";
   bool isFirst = true;

   for(int i=0; i<numTfs; i++) {
       MqlRates rates[];
       ArraySetAsSeries(rates, true);
       
       // Get both Current Candle (Unclosed/Index 0) and Previous Candle (Closed/Index 1)
       int copied = CopyRates(_Symbol, tfs[i], 0, 2, rates);
       
       if(copied > 0) {
           for(int k=0; k<copied; k++) {
               if(!isFirst) jsonPayload += ",";
               
               jsonPayload += "{";
               jsonPayload += "\"broker\":\"" + InpBrokerName + "\",";
               jsonPayload += "\"symbol\":\"" + _Symbol + "\",";
               jsonPayload += "\"timeframe\":\"" + TimeframeToString(tfs[i]) + "\",";
               jsonPayload += "\"timestamp\":" + IntegerToString(rates[k].time) + ",";
               jsonPayload += "\"open\":" + DoubleToString(rates[k].open, _Digits) + ",";
               jsonPayload += "\"high\":" + DoubleToString(rates[k].high, _Digits) + ",";
               jsonPayload += "\"low\":" + DoubleToString(rates[k].low, _Digits) + ",";
               jsonPayload += "\"close\":" + DoubleToString(rates[k].close, _Digits) + ",";
               jsonPayload += "\"volume\":" + IntegerToString(rates[k].tick_volume);
               jsonPayload += "}";
               
               isFirst = false;
           }
       }
   }
   
   jsonPayload += "]";
   
   // Dispatch to Data Center
   SendToGateway(jsonPayload);
}

//+------------------------------------------------------------------+
//| HTTP POST Request Handler                                        |
//+------------------------------------------------------------------+
void SendToGateway(string json) {
    char post[], result[];
    string headers = "Content-Type: application/json\r\n";
    
    StringToCharArray(json, post, 0, WHOLE_ARRAY, CP_UTF8);
    ArrayResize(post, ArraySize(post) - 1); // Remove trailing null terminator
    int post_size = ArraySize(post);
    
    // Safety check - avoid sending empty payloads
    if (post_size <= 2) return; 

    string result_headers;
    int res = WebRequest("POST", InpGatewayURL, headers, 1000, post, result, result_headers);
    
    // Ignore HTTP 200/201 (success), only log HTTP errors
    if(res != 200 && res != 201) {
        if (res == 4014) {
            Print("[ERROR] WebRequest blocked (4014) - You must allow URL '", InpGatewayURL, "' in MT5 Options.");
        } else {
            Print("[ERROR] DataFeeder Failed. HTTP Status: ", res, " | GetLastError: ", GetLastError());
        }
    }
}
//+------------------------------------------------------------------+

