//+------------------------------------------------------------------+
//|                                         NexusFX_HistoryPump.mq5  |
//|                                     Copyright 2026, NexusFX Co.  |
//|                                             https://nexusfx.com  |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, NexusFX Co."
#property link      "https://nexusfx.com"
#property version   "0.0.4"
#property script_show_inputs

input string   InpGatewayURL        = "http://127.0.0.1:4000/api/ingest"; 
input string   InpBrokerName        = "EXNESS";                       
input int      InpMaxYearsIfNoData  = 2; // ย้อนหลังสูงสุดกี่ปี (หากไม่มีประวัติ)

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

bool SendToGateway(string json) {
    char post[], result[];
    string headers = "Content-Type: application/json\r\n";
    
    StringToCharArray(json, post, 0, WHOLE_ARRAY, CP_UTF8);
    ArrayResize(post, ArraySize(post) - 1); 
    int post_size = ArraySize(post);
    if (post_size <= 2) return true; 

    string result_headers;
    int res = WebRequest("POST", InpGatewayURL, headers, 5000, post, result, result_headers);
    
    if(res != 200 && res != 201) {
        string errorDetails = CharArrayToString(result);
        Print("[ERROR] HTTP Status: ", res, " | Details: ", errorDetails);
        return false;
    } else {
        Print("[SUCCESS] Batch sent. Size: ", post_size, " bytes.");
        return true;
    }
}

void GetMonthBounds(int year, int month, datetime &startT, datetime &endT) {
    MqlDateTime dt;
    dt.year = year;
    dt.mon = month;
    dt.day = 1;
    dt.hour = 0; dt.min = 0; dt.sec = 0;
    startT = StructToTime(dt);

    if (month == 12) {
        dt.year = year + 1;
        dt.mon = 1;
    } else {
        dt.mon = month + 1;
        dt.year = year;
    }
    endT = StructToTime(dt) - 1; 
}

void OnStart()
{
    Print("=================================================");
    string targetSymbols[] = {
        "AUDUSD", "BTCUSD", "EURUSD", "GBPUSD", "GBPJPY", 
        "XAUUSD", "USDJPY", "NZDUSD", "USDCAD", "USDCHF"
    };
    int totalSymbols = ArraySize(targetSymbols);
    Print("🚀 Starting SMART PUMP (Max ", InpMaxYearsIfNoData, " Years) with Deduplication!");
    
    ENUM_TIMEFRAMES tfs[] = {
        PERIOD_M1, PERIOD_M5, PERIOD_M15, PERIOD_M30,
        PERIOD_H1, PERIOD_H4, PERIOD_D1, PERIOD_W1, PERIOD_MN1
    };
    int numTfs = ArraySize(tfs);
    
    MqlDateTime currentDt;
    TimeCurrent(currentDt);
    
    int startYear = currentDt.year - InpMaxYearsIfNoData;
    int startMonth = currentDt.mon;

    for(int s=0; s<totalSymbols; s++) {
        string currentSymbol = targetSymbols[s];
        SymbolSelect(currentSymbol, true); 
        Print(">>> Processing Symbol [", s+1, "/", totalSymbols, "]: ", currentSymbol);
        
        int currentDigits = (int)SymbolInfoInteger(currentSymbol, SYMBOL_DIGITS);
        
        for(int i=0; i<numTfs; i++) {
            
            // Loop ทีละเดือนเพื่อประเมินข้อมูล
            for(int y = startYear; y <= currentDt.year; y++) {
                int m_start = (y == startYear) ? startMonth : 1;
                int m_end = (y == currentDt.year) ? currentDt.mon : 12;
                
                for(int m = m_start; m <= m_end; m++) {
                    datetime m_start_time, m_end_time;
                    GetMonthBounds(y, m, m_start_time, m_end_time);
                    
                    string tf_str = TimeframeToString(tfs[i]);
                    // สร้าง Key ใช้บันทึกว่าเดือนนี้ดึงไปกี่แท่งแล้ว e.g. NX_EURUSD_M1_202603
                    string key = StringFormat("NX_%s_%s_%04d%02d", currentSymbol, tf_str, y, m);
                    
                    long saved_count = (long)GlobalVariableGet(key);
                    
                    MqlRates rates[];
                    ArraySetAsSeries(rates, false); // ส่งตามเวลาเก่าสุด->ใหม่สุด
                    int copied = CopyRates(currentSymbol, tfs[i], m_start_time, m_end_time, rates);
                    
                    bool is_current_month = (y == currentDt.year && m == currentDt.mon);
                    
                    // ระบบป้องกันดึงข้อมูลซ้ำซ้อน (Deduplication Check)
                    if(saved_count > 0 && saved_count == copied && !is_current_month) {
                        // Print("✅ [SKIP] ", key, " | Data is complete (", copied, " bars). No missing data.");
                        continue; 
                    }
                    
                    if (copied <= 0) {
                       // Print("⚠️ [EMPTY] ", key, " | No data from broker.");
                       continue;
                    }
                    
                    Print("📥 [PUMPING] ", key, " | Missing/New Data Found! Fetching ", copied, " bars...");
                    
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
                        
                        if(!SendToGateway(jsonPayload)) {
                            all_success = false;
                        }
                        Sleep(100); 
                    }
                    
                    // ถ้าส่งข้อมูลสำเร็จทั้งหมด ให้จำไว้ว่าเดือนนี้ดึงไปกี่แท่งแล้ว
                    if(all_success && copied > 0) {
                        GlobalVariableSet(key, copied);
                    }
                } // end month
            } // end year
        } // end tf
    } // end symbol
    
    // สร้างไฟล์ Export สรุปการตรวจสอบแต่ละ TF ใน MQL5\Files\NexusFX\
    string folder = "NexusFX";
    // Check if folder exists or create it? MT5 FileOpen handles nested paths if we pass flag.
    int file = FileOpen(folder + "\\HistoryPumpSummary.csv", FILE_WRITE|FILE_CSV|FILE_ANSI, ",");
    if(file != INVALID_HANDLE) {
        FileWrite(file, "Period", "Symbol", "Timeframe", "BarCount");
        int totalVars = GlobalVariablesTotal();
        for(int i=0; i<totalVars; i++) {
            string name = GlobalVariableName(i);
            if(StringFind(name, "NX_") == 0) {
                // Parse key
                string parts[];
                StringSplit(name, '_', parts);
                if(ArraySize(parts) == 4) {
                    string sym = parts[1];
                    string tf = parts[2];
                    string yyyymm = parts[3];
                    string barCount = DoubleToString(GlobalVariableGet(name), 0);
                    FileWrite(file, yyyymm, sym, tf, barCount);
                }
            }
        }
        FileClose(file);
        Print("📄 Summary saved to: MQL5\\Files\\NexusFX\\HistoryPumpSummary.csv");
    }

    Print("🚀 SMART PUMP & Deduplication Check Completed!");
    Print("=================================================");
}
