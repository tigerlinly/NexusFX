//+------------------------------------------------------------------+
//|                                         NexusFX_HistoryPump.mq5  |
//|                                     Copyright 2026, NexusFX Co.  |
//|                                             https://nexusfx.com  |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, NexusFX Co."
#property link      "https://nexusfx.com"
#property version   "0.0.3"
#property script_show_inputs

input string   InpGatewayURL        = "http://127.0.0.1:4000/api/ingest"; // เปลี่ยนเป็นพอร์ต 4000
input string   InpBrokerName        = "EXNESS";                       
input int      InpMonthsToPump      = 1; // ดึงข้อมูลย้อนหลัง (เดือน) 

string TimeframeToString(ENUM_TIMEFRAMES tf) {
    if(tf == PERIOD_M1) return "M1";
    if(tf == PERIOD_M5) return "M5";
    if(tf == PERIOD_M10) return "M10";
    if(tf == PERIOD_M15) return "M15";
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
    Print("🚀 Starting SUPER PUMP (Last ", InpMonthsToPump, " Months) for ", totalSymbols, " SPECIFIC symbols!");
    
    ENUM_TIMEFRAMES tfs[] = {
        PERIOD_M1, PERIOD_M5, PERIOD_M15, PERIOD_M30,
        PERIOD_H1, PERIOD_H4, PERIOD_D1, PERIOD_W1, PERIOD_MN1
    };
    int numTfs = ArraySize(tfs);
    
    // กำหนดเวลาดึงข้อมูลย้อนหลัง 1 เดือนเป๊ะๆ เพื่อกันข้อมูลซ้ำซ้อน
    datetime endTime = TimeCurrent();
    datetime startTime = endTime - (InpMonthsToPump * 30 * 24 * 60 * 60);

    for(int s=0; s<totalSymbols; s++) {
        string currentSymbol = targetSymbols[s];
        SymbolSelect(currentSymbol, true); // Force MT5 to add it to Market Watch if missing
        Print(">>> Processing Symbol [", s+1, "/", totalSymbols, "]: ", currentSymbol);
        
        int currentDigits = (int)SymbolInfoInteger(currentSymbol, SYMBOL_DIGITS);
        
        for(int i=0; i<numTfs; i++) {
            MqlRates rates[];
            ArraySetAsSeries(rates, true);
            
            // ใช้ CopyRates ระบุ เวลาเริ่ม-จบ เพื่อบังคับให้ MT5 โหลดข้อมูลที่ขาดหาย (Fill gaps)
            int copied = CopyRates(currentSymbol, tfs[i], startTime, endTime, rates);
            
            if (copied <= 0) {
               Print("⚠️ Warning: No data or error fetching ", currentSymbol, " over ", TimeframeToString(tfs[i]), ". Please scroll chart manually to download history from Broker.");
               // สั่ง Sleep เพื่อให้ Broker ส่งข้อมูลมาทันในรอบหน้า
               Sleep(500);
               continue;
            }
            
            Print("Fetched ", copied, " bars for ", currentSymbol, " TF: ", TimeframeToString(tfs[i]));
            
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
                
                SendToGateway(jsonPayload);
                Sleep(200); 
            }
        }
    }
    Print("🚀 ALL Market Watch Symbols Data Pump Completed!");
    Print("=================================================");
}
