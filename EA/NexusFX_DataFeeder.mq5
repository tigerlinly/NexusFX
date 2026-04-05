//+------------------------------------------------------------------+
//|                                         NexusFX_DataFeeder.mq5   |
//|                                     Copyright 2026, NexusFX Co.  |
//|                                             https://nexusfx.com  |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, NexusFX Co."
#property link      "https://nexusfx.com"
#property version   "1.04" // อัปเดตเวอร์ชันให้โชว์ Error ละเอียด
#property strict
#property description "Real-time Live Data Feeder for NexusFX Data Center"
#property description "Last Modified: 2026-04-05"

input string   InpGatewayURL        = "http://127.0.0.1:3000/api/ingest"; // Endpoint
input string   InpBrokerName        = "EXNESS";                           // Broker ID tag

int OnInit() {
    EventSetTimer(1); 
    Print("NexusFX_DataFeeder (v1.04) MULTI-SYMBOL & FULL-TF started.");
    return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) {
    EventKillTimer();
    Print("NexusFX_DataFeeder stopped.");
}

void OnTick() {
    // Disabled. Using OnTimer for batch fetching 10 symbols.
}

string targetSymbols[] = {
    "AUDUSD", "EURUSD", "GBPUSD", "GBPJPY", "XAUUSD", 
    "USDJPY", "NZDUSD", "USDCAD", "USDCHF", "BTCUSD"
};

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

void OnTimer() {
    int totalSymbols = ArraySize(targetSymbols);
    string jsonPayload = "[";
    bool isFirst = true;
    int payloadCount = 0;
    
    ENUM_TIMEFRAMES tfs[] = {
        PERIOD_M1, PERIOD_M2, PERIOD_M3, PERIOD_M4, PERIOD_M5, PERIOD_M6, PERIOD_M10, PERIOD_M12, PERIOD_M15, PERIOD_M20, PERIOD_M30,
        PERIOD_H1, PERIOD_H2, PERIOD_H3, PERIOD_H4, PERIOD_H6, PERIOD_H8, PERIOD_H12,
        PERIOD_D1, PERIOD_W1, PERIOD_MN1
    };
    int numTfs = ArraySize(tfs);

    for(int s=0; s<totalSymbols; s++) {
        string sym = targetSymbols[s];
        SymbolSelect(sym, true); 
        int digits = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
        
        for(int i=0; i<numTfs; i++) {
            MqlRates rates[];
            ArraySetAsSeries(rates, true);
            if(CopyRates(sym, tfs[i], 0, 1, rates) <= 0) continue;
            
            if(!isFirst) jsonPayload += ",";
            jsonPayload += "{";
            jsonPayload += "\"broker\":\"" + InpBrokerName + "\",";
            jsonPayload += "\"symbol\":\"" + sym + "\",";
            jsonPayload += "\"timeframe\":\"" + TimeframeToString(tfs[i]) + "\",";
            jsonPayload += "\"timestamp\":" + IntegerToString(rates[0].time) + ",";
            jsonPayload += "\"open\":" + DoubleToString(rates[0].open, digits) + ",";
            jsonPayload += "\"high\":" + DoubleToString(rates[0].high, digits) + ",";
            jsonPayload += "\"low\":" + DoubleToString(rates[0].low, digits) + ",";
            jsonPayload += "\"close\":" + DoubleToString(rates[0].close, digits) + ",";
            jsonPayload += "\"volume\":" + IntegerToString(rates[0].tick_volume);
            jsonPayload += "}";
            
            isFirst = false;
            payloadCount++;
        }
    }
    jsonPayload += "]";
    
    if(payloadCount > 0) {
        char post[], result[];
        string headers = "Content-Type: application/json\r\n";
        StringToCharArray(jsonPayload, post, 0, WHOLE_ARRAY, CP_UTF8);
        ArrayResize(post, ArraySize(post) - 1); 
        
        string result_headers;
        int res = WebRequest("POST", InpGatewayURL, headers, 3000, post, result, result_headers);
        if(res != 200 && res != 201) {
            string errorDetails = CharArrayToString(result);
            Print("[ERROR] Gateway rejected real-time batch. HTTP Status: ", res, " | Details: ", errorDetails);
        }
    }
}
