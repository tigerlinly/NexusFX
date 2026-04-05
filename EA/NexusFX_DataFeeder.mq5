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
    Print("NexusFX_DataFeeder (v1.03) MULTI-SYMBOL started.");
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
    "AUDUSD", "BTCUSD", "EURUSD", "GBPUSD", "GBPJPY", 
    "XAUUSD", "USDJPY", "NZDUSD", "USDCAD", "USDCHF"
};

void OnTimer() {
    int totalSymbols = ArraySize(targetSymbols);
    string jsonPayload = "[";
    bool isFirst = true;
    int payloadCount = 0;

    for(int s=0; s<totalSymbols; s++) {
        string sym = targetSymbols[s];
        SymbolSelect(sym, true); 
        int digits = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
        
        ENUM_TIMEFRAMES tfs[] = {PERIOD_M1, PERIOD_M5, PERIOD_M15, PERIOD_H1};
        string tfStrs[] = {"M1", "M5", "M15", "H1"};
        
        for(int i=0; i<4; i++) {
            MqlRates rates[];
            ArraySetAsSeries(rates, true);
            if(CopyRates(sym, tfs[i], 0, 1, rates) <= 0) continue;
            
            if(!isFirst) jsonPayload += ",";
            jsonPayload += "{";
            jsonPayload += "\"broker\":\"" + InpBrokerName + "\",";
            jsonPayload += "\"symbol\":\"" + sym + "\",";
            jsonPayload += "\"timeframe\":\"" + tfStrs[i] + "\",";
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
