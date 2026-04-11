//+------------------------------------------------------------------+
//|                                     NexusFX_DataFeeder_v0.0.1.mq5 |
//|                                     Copyright 2026, NexusFX Co.  |
//|                                             https://nexusfx.biz  |
//| Created: 2026-04-01                                              |
//| Updated: 2026-04-08                                              |
//+------------------------------------------------------------------+
#property copyright   "Copyright 2026, NexusFX Co."
#property link        "https://nexusfx.biz"
#property version   "1.01"
#property description "Data Feeder with Dashboard - v0.0.1"
#property strict

input string   InpGatewayURL        = "https://nexusfx.biz/api/bridge/feed";   // http://203.151.66.51:4000/api/bridge/feed
input string   InpFeedToken         = "NEXUS_FEED_SECRET_123";
input string   InpBrokerName        = "EXNESS";                           

string targetSymbols[] = {
    "AUDUSD", "BTCUSD", "EURUSD", "GBPJPY", "GBPUSD", "NZDUSD", "USDCAD", "USDCHF", "USDJPY", "XAUUSD"
};

// Global variables for dashboard
string dash_status = "Waiting...";
string dash_last_update = "-";
string dash_pulled_symbols = "";
int    dash_payload_count = 0;
int    dash_fail_count = 0;

int g_PanelX = 20;
int g_PanelY = 20;
bool g_minimized = false;

void DrawDashboard() {
    RemoveDashboard();
    int x = g_PanelX;
    int y = g_PanelY;
    int y_gap = 25;
    int width = 500;
    int height = g_minimized ? 35 : 180;
    
    // Background
    ObjectCreate(0, "DF_BG", OBJ_RECTANGLE_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "DF_BG", OBJPROP_XDISTANCE, x - 10);
    ObjectSetInteger(0, "DF_BG", OBJPROP_YDISTANCE, y - 10);
    ObjectSetInteger(0, "DF_BG", OBJPROP_XSIZE, width);
    ObjectSetInteger(0, "DF_BG", OBJPROP_YSIZE, height);
    ObjectSetInteger(0, "DF_BG", OBJPROP_BGCOLOR, clrBlack);
    ObjectSetInteger(0, "DF_BG", OBJPROP_COLOR, clrDodgerBlue);
    ObjectSetInteger(0, "DF_BG", OBJPROP_BORDER_TYPE, BORDER_FLAT);
    ObjectSetInteger(0, "DF_BG", OBJPROP_CORNER, CORNER_LEFT_UPPER);
    ObjectSetInteger(0, "DF_BG", OBJPROP_SELECTABLE, true);
    
    // Title
    UpdateLabel("DF_Title", "🚀 NexusFX DataFeeder (v1.01)", x, y, clrCyan, 12, "Arial Bold");
    UpdateLabel("DF_Toggle", g_minimized ? "[+]" : "[-]", x + width - 40, y, clrOrange, 12, "Arial Bold");
    
    if(g_minimized) return;

    y += y_gap;
    UpdateLabel("DF_Lbl1", "Gateway URL:", x, y, clrLightGray);
    UpdateLabel("DF_Val1", InpGatewayURL, x + 120, y, clrWhite);
    y += y_gap;

    UpdateLabel("DF_Lbl2", "Status:", x, y, clrLightGray);
    color statusClr = (StringFind(dash_status, "ERROR") >= 0 || StringFind(dash_status, "WARNING") >= 0 || StringFind(dash_status, "❌") >= 0) ? clrRed : clrLime;
    UpdateLabel("DF_Val2", dash_status, x + 120, y, statusClr);
    y += y_gap;

    UpdateLabel("DF_Lbl3", "Last Update:", x, y, clrLightGray);
    UpdateLabel("DF_Val3", dash_last_update, x + 120, y, clrYellow);
    y += y_gap;

    UpdateLabel("DF_Lbl4", "Symbols Active:", x, y, clrLightGray);
    UpdateLabel("DF_Val4", dash_pulled_symbols, x + 120, y, clrWhite);
    y += y_gap;

    string recordsText = StringFormat("%d records pushed (Failed: %d)", dash_payload_count, dash_fail_count);
    UpdateLabel("DF_Lbl5", "Records Pushed:", x, y, clrLightGray);
    UpdateLabel("DF_Val5", recordsText, x + 120, y, clrLightSkyBlue);
    
    ChartRedraw(0);
}

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

void RemoveDashboard() {
    ObjectsDeleteAll(0, "DF_");
}

void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam) {
    if(id == CHARTEVENT_OBJECT_CLICK && sparam == "DF_Toggle") {
        g_minimized = !g_minimized;
        DrawDashboard();
    }
    if(id == CHARTEVENT_OBJECT_DRAG && sparam == "DF_BG") {
        g_PanelX = (int)ObjectGetInteger(0, sparam, OBJPROP_XDISTANCE) + 10;
        g_PanelY = (int)ObjectGetInteger(0, sparam, OBJPROP_YDISTANCE) + 10;
        DrawDashboard();
    }
    if(id == CHARTEVENT_OBJECT_CLICK && sparam == "DF_BG") {
        ObjectSetInteger(0, "DF_BG", OBJPROP_SELECTED, false); 
    }
}

int OnInit() {
    EventSetTimer(1); 
    DrawDashboard();
    Print("NexusFX_DataFeeder (v0.0.1) started.");
    return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) {
    EventKillTimer();
    RemoveDashboard();
    Print("NexusFX_DataFeeder stopped.");
}

string TimeframeToString(ENUM_TIMEFRAMES tf) {
    if(tf == PERIOD_M1) return "M1";
    if(tf == PERIOD_M5) return "M5";
    if(tf == PERIOD_M15) return "M15";
    if(tf == PERIOD_M30) return "M30";
    if(tf == PERIOD_H1) return "H1";
    if(tf == PERIOD_H4) return "H4";
    if(tf == PERIOD_D1) return "D1";
    if(tf == PERIOD_W1) return "W1";
    if(tf == PERIOD_MN1) return "MN1";
    return "UNK";
}

void OnTimer() {
    int totalSymbols = ArraySize(targetSymbols);
    string jsonPayload = "{\"candles\":[";
    bool isFirst = true;
    int payloadCount = 0;
    int failCount = 0;
    
    // Define the TFs to ingest
    ENUM_TIMEFRAMES tfs[] = { PERIOD_M1, PERIOD_M5, PERIOD_M15, PERIOD_M30, PERIOD_H1, PERIOD_H4, PERIOD_D1, PERIOD_W1, PERIOD_MN1 };
    int numTfs = ArraySize(tfs);

    string activeSymbols = "";
    int activeSymCount = 0;

    for(int s=0; s<totalSymbols; s++) {
        string sym = targetSymbols[s];
        SymbolSelect(sym, true); 
        int digits = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
        
        bool symHasData = false;
        
        for(int i=0; i<numTfs; i++) {
            MqlRates rates[];
            ArraySetAsSeries(rates, true);
            if(CopyRates(sym, tfs[i], 0, 1, rates) <= 0) {
                failCount++;
                continue;
            }
            
            symHasData = true;
            
            if(!isFirst) jsonPayload += ",";
            jsonPayload += "{";
            jsonPayload += "\"broker\":\"" + InpBrokerName + "\",";
            jsonPayload += "\"symbol\":\"" + sym + "\",";
            jsonPayload += "\"interval\":\"" + TimeframeToString(tfs[i]) + "\",";
            jsonPayload += "\"open_time\":" + IntegerToString(rates[0].time) + ",";
            jsonPayload += "\"open\":" + DoubleToString(rates[0].open, digits) + ",";
            jsonPayload += "\"high\":" + DoubleToString(rates[0].high, digits) + ",";
            jsonPayload += "\"low\":" + DoubleToString(rates[0].low, digits) + ",";
            jsonPayload += "\"close\":" + DoubleToString(rates[0].close, digits) + ",";
            jsonPayload += "\"volume\":" + IntegerToString(rates[0].tick_volume);
            jsonPayload += "}";
            
            isFirst = false;
            payloadCount++;
        }
        
        if (symHasData) {
            if (activeSymCount > 0) activeSymbols += ", ";
            activeSymbols += sym;
            activeSymCount++;
        }
    }
    jsonPayload += "]}";
    
    dash_payload_count = payloadCount;
    dash_fail_count = failCount;
    if (activeSymbols == "") {
        dash_pulled_symbols = "None (Check symbol names)";
    } else {
        dash_pulled_symbols = activeSymbols;
    }
    dash_last_update = TimeToString(TimeGMT() + (7 * 3600), TIME_DATE|TIME_SECONDS);
    
    if(payloadCount > 0) {
        char post[], result[];
        string headers = "Content-Type: application/json\r\n";
        headers += "x-feed-token: " + InpFeedToken + "\r\n";
        StringToCharArray(jsonPayload, post, 0, WHOLE_ARRAY, CP_UTF8);
        ArrayResize(post, ArraySize(post) - 1); 
        
        string result_headers;
        int res = WebRequest("POST", InpGatewayURL, headers, 3000, post, result, result_headers);
        
        if(res == 200 || res == 201) {
            dash_status = "✅ Pushing " + IntegerToString(payloadCount) + " records OK";
            // Print("[SUCCESS] Pushed ", payloadCount, " records."); // Uncomment to spam logs
        } else {
            string errorDetails = CharArrayToString(result);
            if (res == -1) {
                dash_status = "❌ HTTP -1 (Node.js offline?)";
            } else {
                dash_status = "❌ ERROR " + IntegerToString(res);
            }
            Print("[ERROR] WebRequest failed. Status: ", res, " | Details: ", errorDetails);
        }
    } else {
       dash_status = "⚠️ No data pulled (Check Market Watch)";
    }
    
    DrawDashboard();
}
