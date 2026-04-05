//+------------------------------------------------------------------+
//|                                         NexusFX_HistoryPump.mq5  |
//|                                     Copyright 2026, NexusFX Co.  |
//|                                             https://nexusfx.com  |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, NexusFX Co."
#property link      "https://nexusfx.com"
#property version   "1.02"   // อัปเดต Version ตรงนี้ให้เห็นชัดๆ!
#property script_show_inputs

input string   InpGatewayURL        = "http://127.0.0.1:3000/api/ingest"; 
input string   InpBrokerName        = "EXNESS";                       
input int      InpBarsToPump        = 10000;

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

void SendToGateway(string json) {
    char post[], result[];
    string headers = "Content-Type: application/json\r\n";
    
    StringToCharArray(json, post, 0, WHOLE_ARRAY, CP_UTF8);
    ArrayResize(post, ArraySize(post) - 1); 
    int post_size = ArraySize(post);
    if (post_size <= 2) return; 

    string result_headers;
    int res = WebRequest("POST", InpGatewayURL, headers, 5000, post, result, result_headers);
    
    if(res != 200 && res != 201) {
        string errorDetails = CharArrayToString(result);
        // สังเกตบรรทัดนี้ จะไม่มีคำว่า GetLastError แล้ว
        Print("[ERROR] HTTP Status: ", res, " | Details: ", errorDetails);
    } else {
        Print("[SUCCESS] Batch sent. Size: ", post_size, " bytes.");
    }
}

void OnStart()
{
    Print("=================================================");
    Print("Starting Historical Data Pump for: ", InpBrokerName, " / ", _Symbol);
    
    ENUM_TIMEFRAMES tfs[] = {PERIOD_M1, PERIOD_M5, PERIOD_M15, PERIOD_H1};
    int numTfs = ArraySize(tfs);
    
    for(int i=0; i<numTfs; i++) {
        MqlRates rates[];
        ArraySetAsSeries(rates, true);
        
        int copied = CopyRates(_Symbol, tfs[i], 0, InpBarsToPump, rates);
        Print("Fetched ", copied, " bars for TF: ", TimeframeToString(tfs[i]));
        
        if(copied > 0) {
            int chunkSize = 1000;
            int totalChunks = (copied / chunkSize) + 1;
            
            for(int chunk = 0; chunk < totalChunks; chunk++) {
                string jsonPayload = "[";
                bool isFirst = true;
                
                int startIdx = chunk * chunkSize;
                int endIdx = startIdx + chunkSize;
                if(endIdx > copied) endIdx = copied;
                
                if (startIdx >= endIdx) break;
                
                for(int k=startIdx; k<endIdx; k++) {
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
                jsonPayload += "]";
                
                // Send chunk
                SendToGateway(jsonPayload);
                Sleep(200); 
            }
        }
    }
    Print("Data Pump Completed!");
    Print("=================================================");
}
