//+------------------------------------------------------------------+
//|                                         NexusFX_HistoryPump.mq5  |
//|                                     Copyright 2026, NexusFX Co.  |
//|                                             https://nexusfx.com  |
//| Created: 2026-04-01                                              |
//| Updated: 2026-04-08                                              |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, NexusFX Co."
#property link      "https://nexusfx.com"
#property version   "1.05"
// ถูกปรับเปลี่ยนจาก Script เป็น Expert Advisor (EA) เพื่อให้ทำงานตลอดเวลา

input string   InpGatewayURL        = "http://127.0.0.1:4000/api/ingest"; 
input string   InpBrokerName        = "EXNESS";                       
input int      InpMaxYearsIfNoData  = 2; // ย้อนหลังสูงสุดกี่ปี (หากไม่มีประวัติ)

datetime lastWeeklyRun = 0;
datetime lastMonthlyRun = 0;
datetime lastUpdateTime = 0;

int g_PanelX = 20;
int g_PanelY = 30;
bool g_minimized = false;
long tf_counts[9]; // เก็บจำนวนแท่งข้อมูลของแต่ละ TF แจกแจงตาม Dashboard

ENUM_TIMEFRAMES tfs[] = {
    PERIOD_M1, PERIOD_M5, PERIOD_M15, PERIOD_M30,
    PERIOD_H1, PERIOD_H4, PERIOD_D1, PERIOD_W1, PERIOD_MN1
};

string targetSymbols[] = {
    "AUDUSD", "BTCUSD", "EURUSD", "GBPUSD", "GBPJPY", "XAUUSD", "USDJPY", "NZDUSD", "USDCAD", "USDCHF"
};

//+------------------------------------------------------------------+
//| Helper Methods                                                   |
//+------------------------------------------------------------------+
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

int GetTFIndex(string tf_str) {
    for(int i=0; i<ArraySize(tfs); i++) {
        if(TimeframeToString(tfs[i]) == tf_str) return i;
    }
    return -1;
}

bool SendToGateway(string json) {
    char post[], result[];
    string headers = "Content-Type: application/json\r\n";
    
    StringToCharArray(json, post, 0, WHOLE_ARRAY, CP_UTF8);
    ArrayResize(post, ArraySize(post) - 1); 
    if (ArraySize(post) <= 2) return true; 

    string result_headers;
    int res = WebRequest("POST", InpGatewayURL, headers, 5000, post, result, result_headers);
    if(res != 200 && res != 201) return false;
    return true;
}

void GetMonthBounds(int year, int month, datetime &startT, datetime &endT) {
    MqlDateTime dt;
    dt.year = year;    dt.mon = month;    dt.day = 1;
    dt.hour = 0;       dt.min = 0;        dt.sec = 0;
    startT = StructToTime(dt);
    if (month == 12) { dt.year = year + 1; dt.mon = 1; } 
    else             { dt.mon = month + 1; dt.year = year; }
    endT = StructToTime(dt) - 1; 
}

//+------------------------------------------------------------------+
//| Pumping Engine                                                   |
//+------------------------------------------------------------------+
void PerformPump(bool createSummaryCSV) {
    Print("🚀 History Pump Started! mode: ", createSummaryCSV ? "MONTHLY" : "WEEKLY");
    int totalSymbols = ArraySize(targetSymbols);
    int numTfs = ArraySize(tfs);
    
    MqlDateTime currentDt;
    TimeCurrent(currentDt);
    
    int startYear = currentDt.year - InpMaxYearsIfNoData;
    int startMonth = currentDt.mon;

    for(int s=0; s<totalSymbols; s++) {
        string currentSymbol = targetSymbols[s];
        SymbolSelect(currentSymbol, true); 
        int currentDigits = (int)SymbolInfoInteger(currentSymbol, SYMBOL_DIGITS);
        
        for(int i=0; i<numTfs; i++) {
            for(int y = startYear; y <= currentDt.year; y++) {
                int m_start = (y == startYear) ? startMonth : 1;
                int m_end = (y == currentDt.year) ? currentDt.mon : 12;
                
                for(int m = m_start; m <= m_end; m++) {
                    datetime m_start_time, m_end_time;
                    GetMonthBounds(y, m, m_start_time, m_end_time);
                    string tf_str = TimeframeToString(tfs[i]);
                    string key = StringFormat("NX_%s_%s_%04d%02d", currentSymbol, tf_str, y, m);
                    
                    long saved_count = (long)GlobalVariableGet(key);
                    MqlRates rates[];
                    ArraySetAsSeries(rates, false);
                    int copied = CopyRates(currentSymbol, tfs[i], m_start_time, m_end_time, rates);
                    bool is_current_month = (y == currentDt.year && m == currentDt.mon);
                    
                    if(saved_count > 0 && saved_count == copied && !is_current_month) continue; 
                    if (copied <= 0) continue;
                    
                    bool all_success = true;
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
                            jsonPayload += "\"timeframe\":\"" + tf_str + "\",";
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
                        if(!SendToGateway(jsonPayload)) all_success = false;
                        Sleep(50); 
                    }
                    
                    if(all_success && copied > 0) GlobalVariableSet(key, copied);
                } 
            } 
        } 
    } 
    
    // Create Summary CSV ONLY if triggered as Monthly task
    if(createSummaryCSV) {
        int file = FileOpen("NexusFX\\HistoryPumpSummary.csv", FILE_WRITE|FILE_CSV|FILE_ANSI, ",");
        if(file != INVALID_HANDLE) {
            FileWrite(file, "Period", "Symbol", "Timeframe", "BarCount");
            int totalVars = GlobalVariablesTotal();
            for(int i=0; i<totalVars; i++) {
                string name = GlobalVariableName(i);
                if(StringFind(name, "NX_") == 0) {
                    string parts[];
                    StringSplit(name, '_', parts);
                    if(ArraySize(parts) == 4) {
                        FileWrite(file, parts[3], parts[1], parts[2], DoubleToString(GlobalVariableGet(name), 0));
                    }
                }
            }
            FileClose(file);
            Print("📄 Monthly Summary saved to: MQL5\\Files\\NexusFX\\HistoryPumpSummary.csv");
        }
    }

    lastUpdateTime = TimeCurrent();
    UpdateTFStats();
    DrawDashboard();
    Print("✅ PUMP FINISHED!");
}

//+------------------------------------------------------------------+
//| Dashboard Management                                             |
//+------------------------------------------------------------------+
void UpdateTFStats() {
    ArrayInitialize(tf_counts, 0);
    int totalVars = GlobalVariablesTotal();
    for(int i=0; i<totalVars; i++) {
        string name = GlobalVariableName(i);
        if(StringFind(name, "NX_") == 0) {
            string parts[];
            StringSplit(name, '_', parts);
            if(ArraySize(parts) == 4) {
                int idx = GetTFIndex(parts[2]);
                if(idx >= 0) tf_counts[idx] += (long)GlobalVariableGet(name);
            }
        }
    }
}

void CreateLabel(string name, string text, int x, int y, color clr) {
    if(ObjectFind(0, name) < 0) ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
    ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
    ObjectSetString(0, name, OBJPROP_TEXT, text);
    ObjectSetString(0, name, OBJPROP_FONT, "Segoe UI");
    ObjectSetInteger(0, name, OBJPROP_FONTSIZE, 10);
    ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
    ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
}

void DeleteDashboard() {
    ObjectsDeleteAll(0, "PumpDash_");
}

void DrawDashboard() {
    DeleteDashboard();
    int width = 230;
    int height = g_minimized ? 35 : 190;
    
    // Background (Draggable)
    ObjectCreate(0, "PumpDash_BG", OBJ_RECTANGLE_LABEL, 0, 0, 0);
    ObjectSetInteger(0, "PumpDash_BG", OBJPROP_XDISTANCE, g_PanelX);
    ObjectSetInteger(0, "PumpDash_BG", OBJPROP_YDISTANCE, g_PanelY);
    ObjectSetInteger(0, "PumpDash_BG", OBJPROP_XSIZE, width);
    ObjectSetInteger(0, "PumpDash_BG", OBJPROP_YSIZE, height);
    ObjectSetInteger(0, "PumpDash_BG", OBJPROP_BGCOLOR, C'20,25,35');
    ObjectSetInteger(0, "PumpDash_BG", OBJPROP_BORDER_COLOR, C'0,230,118');
    ObjectSetInteger(0, "PumpDash_BG", OBJPROP_SELECTABLE, true);
    
    // Title & Toggle
    CreateLabel("PumpDash_Title", "🚀 HistoryPump v0.0.5", g_PanelX+10, g_PanelY+7, clrWhite);
    CreateLabel("PumpDash_Toggle", g_minimized ? "[+]" : "[-]", g_PanelX + width - 30, g_PanelY+7, clrOrange);
    
    if(g_minimized) return;
    
    // Status
    string lastUpdStr = (lastUpdateTime == 0) ? "Never" : TimeToString(lastUpdateTime, TIME_DATE|TIME_MINUTES);
    CreateLabel("PumpDash_LastUpd", "Last Pump: " + lastUpdStr, g_PanelX+10, g_PanelY+35, clrLightGray);
    CreateLabel("PumpDash_Info", "Next: Sun @06:00 (W), 1st @06:00 (M)", g_PanelX+10, g_PanelY+55, C'100,100,100');
    
    // Matrix TF info
    int rowCount = 0;
    for(int i=0; i<ArraySize(tfs); i++) {
        int r = rowCount / 2;
        int c = rowCount % 2;
        int xx = g_PanelX + 10 + (c * 100);
        int yy = g_PanelY + 80 + (r * 20);
        
        string valText = (tf_counts[i] == 0) ? "No data" : IntegerToString(tf_counts[i]);
        CreateLabel("PumpDash_TF_"+IntegerToString(i), TimeframeToString(tfs[i]) + ": " + valText, xx, yy, C'0,230,118');
        rowCount++;
    }
    
    ChartRedraw();
}

//+------------------------------------------------------------------+
//| EA Events                                                        |
//+------------------------------------------------------------------+
int OnInit() {
    UpdateTFStats();
    DrawDashboard();
    EventSetTimer(60); // Check every minute for Schedule Trigger
    
    // Start First Pump Right Away for initialization!
    datetime firstPumpDelay = TimeCurrent() + 5; 
    Print("EA Initialized. First background pump will run shortly...");
    return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) {
    EventKillTimer();
    DeleteDashboard();
    ChartRedraw();
}

void OnTick() {
    // Only check timer in OnTimer, save resources here.
}

void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam) {
    // Toggle Minimize/Maximize
    if(id == CHARTEVENT_OBJECT_CLICK && sparam == "PumpDash_Toggle") {
        g_minimized = !g_minimized;
        DrawDashboard();
    }
    
    // Drag Dashboard
    if(id == CHARTEVENT_OBJECT_DRAG && sparam == "PumpDash_BG") {
        g_PanelX = (int)ObjectGetInteger(0, sparam, OBJPROP_XDISTANCE);
        g_PanelY = (int)ObjectGetInteger(0, sparam, OBJPROP_YDISTANCE);
        DrawDashboard();
    }
    
    // Handle double-clicking background to force Pump? (Hidden shortcut)
    if(id == CHARTEVENT_OBJECT_CLICK && sparam == "PumpDash_BG") {
        ObjectSetInteger(0, "PumpDash_BG", OBJPROP_SELECTED, false); 
    }
}

void OnTimer() {
    MqlDateTime dt;
    TimeCurrent(dt);
    
    // เช็คอัปเดตรายเดือน (วันที่ 1 เวลา 06:00:00) => รัน Monthly Scan (มี CSV Summary)
    if(dt.day == 1 && dt.hour == 6 && dt.min == 0) {
        if(TimeCurrent() - lastMonthlyRun > 120) { // กันรันเบิ้ลใน 1 นาที
            lastMonthlyRun = TimeCurrent();
            PerformPump(true); 
        }
    }
    // เช็คอัปเดตรายสัปดาห์ (วันอาทิตย์ (0) เวลา 06:00:00) => รัน Weekly Scan (กวาด History แต่ไม่มี CSV)
    else if(dt.day_of_week == 0 && dt.hour == 6 && dt.min == 0) {
        // ต้องไม่ใช่วันที่ 1 (มิฉะนั้นจะรันซ้อนกับรายเดือน)
        if(dt.day != 1 && (TimeCurrent() - lastWeeklyRun > 120)) {
            lastWeeklyRun = TimeCurrent();
            PerformPump(false); 
        }
    }
}
