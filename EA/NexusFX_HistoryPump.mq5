//+------------------------------------------------------------------+
//|                                         NexusFX_HistoryPump.mq5  |
//|                                     Copyright 2026, NexusFX Co.  |
//|                                             https://nexusfx.com  |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, NexusFX Co."
#property link      "https://nexusfx.com"
#property version   "1.04"   // อัปเดต Version ตรงนี้ให้เห็นชัดๆ!
#property script_show_inputs

input string   InpGatewayURL        = "http://127.0.0.1:3000/api/ingest"; 
input string   InpBrokerName        = "EXNESS";                       
input int      InpBarsToPump        = 500000;

string TimeframeToString(ENUM_TIMEFRAMES tf) {
    if(tf == PERIOD_M1) return "M1";
    if(tf == PERIOD_M2) return "M2";
    if(tf == PERIOD_M3) return "M3";
    if(tf == PERIOD_M4) return "M4";
    if(tf == PERIOD_M5) return "M5";
    if(tf == PERIOD_M6) return "M6";
    if(tf == PERIOD_M10) return "M10";
    if(tf == PERIOD_M12) return "M12";
    if(tf == PERIOD_M15) return "M15";
    if(tf == PERIOD_M20) return "M20";
    if(tf == PERIOD_M30) return "M30";
    if(tf == PERIOD_H1) return "H1";
    if(tf == PERIOD_H2) return "H2";
    if(tf == PERIOD_H3) return "H3";
    if(tf == PERIOD_H4) return "H4";
    if(tf == PERIOD_H6) return "H6";
    if(tf == PERIOD_H8) return "H8";
    if(tf == PERIOD_H12) return "H12";
    if(tf == PERIOD_D1) return "D1";
    if(tf == PERIOD_W1) return "W1";
    if(tf == PERIOD_MN1) return "MN1";
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
    string targetSymbols[] = {
        "AUDUSD", "BTCUSD", "EURUSD", "GBPUSD", "GBPJPY", 
        "XAUUSD", "USDJPY", "NZDUSD", "USDCAD", "USDCHF"
    };
    int totalSymbols = ArraySize(targetSymbols);
    Print("🚀 Starting SUPER PUMP for ", totalSymbols, " SPECIFIC symbols!");
    
    ENUM_TIMEFRAMES tfs[] = {
        PERIOD_M1, PERIOD_M2, PERIOD_M3, PERIOD_M4, PERIOD_M5, PERIOD_M6, PERIOD_M10, PERIOD_M12, PERIOD_M15, PERIOD_M20, PERIOD_M30,
        PERIOD_H1, PERIOD_H2, PERIOD_H3, PERIOD_H4, PERIOD_H6, PERIOD_H8, PERIOD_H12,
        PERIOD_D1, PERIOD_W1, PERIOD_MN1
    };
    int numTfs = ArraySize(tfs);
    
    // Loop through the specific target symbols
    for(int s=0; s<totalSymbols; s++) {
        string currentSymbol = targetSymbols[s];
        SymbolSelect(currentSymbol, true); // Force MT5 to add it to Market Watch if missing
        Print(">>> Processing Symbol [", s+1, "/", totalSymbols, "]: ", currentSymbol);
        
        // Get the correct decimal digits for each symbol to format JSON properly (e.g. 5 for EURUSD, 2 or 3 for JPY)
        int currentDigits = (int)SymbolInfoInteger(currentSymbol, SYMBOL_DIGITS);
        
        // Loop through all Timeframes for this symbol
        for(int i=0; i<numTfs; i++) {
            MqlRates rates[];
            ArraySetAsSeries(rates, true);
            
            int copied = CopyRates(currentSymbol, tfs[i], 0, InpBarsToPump, rates);
            
            if (copied <= 0) {
               Print("⚠️ Warning: No data or error fetching ", currentSymbol, " over ", TimeframeToString(tfs[i]));
               continue;
            }
            
            Print("Fetched ", copied, " bars for ", currentSymbol, " TF: ", TimeframeToString(tfs[i]));
            
            int chunkSize = 1000;
            int totalChunks = (copied / chunkSize) + 1;
            
            // Break down the symbol/timeframe data into JSON chunks
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
                    jsonPayload += "\"symbol\":\"" + currentSymbol + "\",";
                    jsonPayload += "\"timeframe\":\"" + TimeframeToString(tfs[i]) + "\",";
                    jsonPayload += "\"timestamp\":" + IntegerToString(rates[k].time) + ",";
                    jsonPayload += "\"open\":" + DoubleToString(rates[k].open, currentDigits) + ",";
                    jsonPayload += "\"high\":" + DoubleToString(rates[k].high, currentDigits) + ",";
                    jsonPayload += "\"low\":" + DoubleToString(rates[k].low, currentDigits) + ",";
                    jsonPayload += "\"close\":" + DoubleToString(rates[k].close, currentDigits) + ",";
                    jsonPayload += "\"volume\":" + IntegerToString(rates[k].tick_volume);
                    jsonPayload += "}";
                    
                    isFirst = false;
                }
                jsonPayload += "]";
                
                // Send chunk securely over HTTP
                SendToGateway(jsonPayload);
                Sleep(200); 
            }
        }
    }
    Print("🚀 ALL Market Watch Symbols Data Pump Completed!");
    Print("=================================================");
}
