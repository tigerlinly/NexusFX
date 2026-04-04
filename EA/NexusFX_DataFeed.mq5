//+------------------------------------------------------------------+
//|                                             NexusFX_DataFeed.mq5 |
//|                                    Copyright 2026, NexusFX Corp. |
//+------------------------------------------------------------------+
#property copyright "NexusFX"
#property link      "https://nexusfx.biz"
#property version   "1.00"
#property strict

//--- Input parameters
input string   API_URL = "http://139.59.96.10:4000"; // Web Service URL 
input string   FEED_TOKEN = "NEXUS_FEED_SECRET_123";  // Secret Token for backend
input int      SyncDelaySec = 60;                     // ความถี่ในการส่งข้อมูลกราฟ (วินาที) (แนะนำ 60)
input string   SymbolsToTrack = "XAUUSD,EURUSD,GBPUSD,USDJPY,BTCUSD"; // คู่เงินที่ต้องการดึง (คั่นด้วย comma)

string symbols[];

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("NexusFX DataFeed Started. Initializing symbols...");
   
   ushort u_sep = StringGetCharacter(",", 0);
   StringSplit(SymbolsToTrack, u_sep, symbols);
   
   for (int i=0; i<ArraySize(symbols); i++) {
       StringTrimLeft(symbols[i]);
       StringTrimRight(symbols[i]);
   }

   EventSetTimer(SyncDelaySec);
   
   // Sync immediately on start
   SendCandleData();
   
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("NexusFX DataFeed Stopped.");
}

//+------------------------------------------------------------------+
//| Timer function                                                   |
//+------------------------------------------------------------------+
void OnTimer()
{
   SendCandleData();
}

//+------------------------------------------------------------------+
//| Send OHLC Data to Backend                                        |
//+------------------------------------------------------------------+
void SendCandleData()
{
   string json = "{\"candles\":[";
   bool first = true;
   
   // We will fetch M1, M5, M15, M30, H1, H4, D1
   ENUM_TIMEFRAMES tfs[] = {PERIOD_M1, PERIOD_M5, PERIOD_M15, PERIOD_M30, PERIOD_H1, PERIOD_H4, PERIOD_D1};
   string tf_names[] = {"1m", "5m", "15m", "30m", "1h", "4h", "1d"};
   
   for(int s = 0; s < ArraySize(symbols); s++) 
   {
      string sym = symbols[s];
      
      for(int t = 0; t < ArraySize(tfs); t++) 
      {
         ENUM_TIMEFRAMES tf = tfs[t];
         string tf_name = tf_names[t];
         
         MqlRates rates[];
         ArraySetAsSeries(rates, true);
         // Get the last 2 candles (index 1 is latest closed candle, index 0 is current forming candle)
         // We should send the LIVE forming candle as well, backend can just "upsert" it.
         int copied = CopyRates(sym, tf, 0, 2, rates); 
         if(copied > 0)
         {
            for(int k=0; k<copied; k++) {
               if(!first) json += ",";
               
               // Notice rates[k].time is in Seconds since 1970
               long time_ms = (long)rates[k].time * 1000;
               
               json += "{";
               json += "\"symbol\":\"" + sym + "\",";
               json += "\"interval\":\"" + tf_name + "\",";
               json += "\"open_time\":" + IntegerToString(time_ms) + ",";
               json += "\"open\":" + DoubleToString(rates[k].open, 5) + ",";
               json += "\"high\":" + DoubleToString(rates[k].high, 5) + ",";
               json += "\"low\":" + DoubleToString(rates[k].low, 5) + ",";
               json += "\"close\":" + DoubleToString(rates[k].close, 5) + ",";
               json += "\"volume\":" + IntegerToString((long)rates[k].tick_volume);
               json += "}";
               
               first = false;
            }
         }
      }
   }
   
   json += "]}";

   char post_data[];
   int str_len = StringToCharArray(json, post_data, 0, WHOLE_ARRAY, CP_UTF8);
   if (str_len > 0) ArrayResize(post_data, str_len - 1); 

   string headers = "Content-Type: application/json\r\n";
   headers += "x-feed-token: " + FEED_TOKEN + "\r\n";
   
   string result_headers;
   char result_data[];
   string url = API_URL + "/api/bridge/feed";

   int res = WebRequest("POST", url, headers, 5000, post_data, result_data, result_headers);
   
   if(res == 200) {
      Print("DataFeed Sync: Success");
   } else {
      Print("DataFeed Sync failed. HTTP code: ", res);
   }
}
//+------------------------------------------------------------------+
