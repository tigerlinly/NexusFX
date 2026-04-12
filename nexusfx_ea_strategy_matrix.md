# 📊 สรุปตารางกลยุทธ์และระบบการเทรด NexusFX Ecosystem (Bot & App Auto)

ระบบของ NexusFX ทั้ง 12 กลยุทธ์ถูกออกแบบให้ทำงานได้แบบ 2 รูปแบบ (Hybrid) คือ
1. **Bot Trade:** ปล่อยให้ EA (ระบบอัตโนมัติ) วิเคราะห์และเปิด-ปิดออเดอร์ให้ทั้งหมด 100%
2. **App Auto Trade:** ใช้งานร่วมกับ Dashboard/Terminal บนจอ เพื่อรับสัญญาณจุดเข้า หรือให้เครื่องมือคอยจัดการจุดออก (Management) ผ่านชื่อ `RunMagic` 

> **หมายเหตุการควบคุมความเสี่ยง (Global Risk Management):** 
> *EA ทั้งหมดติดตั้งระบบ **Daily Profit / Drawdown Limit** (หยุดซิ่งอัตโนมัติเมื่อชนเป้า), **Session & Spread Filter** (ป้องกันปัญหาสเปรดถ่าง), และ **Anti-Martingale / Dynamic Lot** (คำนวณหลอดตามขนาดพอร์ต) เรียบร้อยแล้ว*

---

## 📋 Comprehensive Strategy Matrix

| 🤖 ชื่อบอท / กลยุทธ์ | 🧠 คอนเซปต์การเทรด (Concept) | 🎛 อินดิเคเตอร์ที่ใช้ (Indicators) | 🟢 จุดเข้า (Entry Logic) | 🔴 จุดออก (Exit Logic) | 🛡 การตั้งค่า SL / TP | ⏱ Timeframe | 💱 คู่เงิน/สินทรัพย์ที่เหมาะสม |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. BreakoutBot** | เทรดตามจังหวะทะลุกรอบแนวต้าน-แนวรับสำคัญ หาจังหวะระเบิดของราคา | Price Action, Fractals, Donchian Channels | ราคาทะลุ High/Low ก่อนหน้า (Breakout) พร้อม Volume ซัพพอร์ต | ราคาอ่อนแรง, กลับตัวทะลุฝั่งรตรงข้าม (Fakeout) หรือชนเป้า Trailing | **SL:** ขอบล่าง/บน ของกรอบ<br>**TP:** Dynamic/Trailing Stop | **Entry:** M15<br>**Trend:** H1 | XAUUSD, GBPJPY, คู่เงินที่วิ่งแรง |
| **2. SqueezeBot** | รอให้ราคาย่อสะสมพลังจนแคบสุดๆ (Squeeze) แล้วอัดตามตอนระเบิด | Bollinger Bands, Keltner Channels, Volume Spike | บีบอัดจนแบนแน่น และโวลุ่มพุ่งทะลุ Band ขอบบน/ล่าง | หลุดกรอบ Momentum หรือตัดเส้น MA กลาง | **SL:** 1 หรือ 2 ATR<br>**TP:** Dynamic R:R (1:2+) | **Entry:** M15<br>**Trend:** H4 | คู่สเปรดแคบ EURUSD, ทองคำ |
| **3. FollowerTrend** | ดักกินเทรนด์ยาวรันรอบใหญ่ "Trend is your friend" | Moving Averages (EMA 50/200), MACD | เกิด Golden Cross และ MACD มีแรงหนุน (Momentum ยาว) | เกิด Dead Cross, โมเมนตัมหดตัว หรือ หลุด Trailing Stop | **SL:** Swing Low/High ล่าสุด<br>**TP:** วางตามสัดส่วน R:R / Trailing | **Entry:** H1<br>**Trend:** D1 | คู่หลัก EURUSD, GBPUSD, JPY |
| **4. PairsBot** (StatArb) | ทำกำไรจากสถิติความห่างของคู่เงินที่วิ่งตามกัน (Statistical Arbitrage) | Spread Differential, Z-Score, Correlation | ความถ่างของ 2 คู่เงิน (Spread) กระชากผิดปกติเกิน Z-Score ที่ตั้งไว้ | ส่วนต่างราคาลู่กลับเข้าหาเส้นค่าเฉลี่ยปกติ (Mean Reversion) | **SL:** กำหนดจาก Max Z-Score<br>**TP:** ตัดรวบ 2 คู่เงินเมื่อพอร์ตบวก | **Entry:** H1<br>**Trend:** H1 | จับคู่: EURUSD กับ GBPUSD หรือ AUDUSD |
| **5. SMCBot** (Smart Money) | เทรดแบบรายใหญ่ (รอยเท้าสถาบันการเงิน) เก็บจังหวะกวาดสภาพคล่อง | Fair Value Gap (FVG), Order Block (OB), Liquidity | ราคากลับมาทดสอบ Order Block หรือเติมโหว่ FVG | กวาดสภาพคล่องด้านบน (Liquidity Sweep) / ชนโครงสร้างราคาต่อไป | **SL:** ใต้ OB หรือ FVG พอดี<br>**TP:** Liquidity Pool ถัดไป (Swing Hi/Lo) | **Entry:** M5<br>**Trend:** H1 | XAUUSD, EURUSD, GBPUSD |
| **6. ZoneBot** (Recovery) | เล่นกับโซนราคาแบบชัวร์ไฟ (Sure-Fire) หรือ Grid สลับทิศ แก้ทางไม้เสียด้วยคณิตศาสตร์ | Price Action Step / Zone Grids | ราคาวิ่งหลุดโซน ถ้าราคาพลิกกลับจะเปิดออเดอร์ไม้แก้ด้วย Lot ที่โตขึ้น | ถัวเฉลี่ยจนยอดรวม (Basket) ถึงจุด Break-even + กำไรนิดหน่อย | **SL:** ไม่มี SL ตายตัวสำหรับไม้เดี่ยว<br>**TP:** ปิดรวบรอบโซน (Basket TP) | **Entry:** H1<br>**Trend:** H4 | คู่วิ่ง Sideways กินขอบเขต GBPJPY |
| **7. TurtleBot** (เต่าเทรด) | เล่นเบรกเอาท์และซอยไม้แบบกองทุนระดับตำนาน (The Turtle Traders) | 20/55 Donchian Channels, ATR | ทะลุกรอบ Donchian 20 วัน | ทะลุเข้ากรอบ 10 วันทิศทางตรงกันข้าม | **SL:** 2 ATR (กว้าง)<br>**TP:** รันเทรนด์ไปเรื่อยๆ จนระบบถูก Stop out ฝั่งตรงข้าม | **Entry:** D1<br>**Trend:** W1 | ข้ามสินทรัพย์ได้หมด FX, XAU, Crypto |
| **8. AlphaScalper** | ฉกฉวยจังหวะเล็กๆ ในระดับนาที เก็บกำไรสั้นและไว (High Freuency) | Tick Volume, รอยตัด EMA เล็ก, RSI M1 | ราคากระชากแรงในช่วงเวลาสั้นมากๆ ใน M1 เข้าซื้อตอน Oversold | ฟันกำไรระดับ 3-10 Pips ต่อออเดอร์ | **SL:** ชิดมาก (2-5 Pips)<br>**TP:** แคบ (3-10 Pips) | **Entry:** M1 / M5<br>**Trend:** M15 | สเปรดต่ำพรีเมียม (EURUSD, USDJPY) |
| **9. GridMaster** | ปูพรมตาข่ายรับออเดอร์ทั้ง Buy / Sell ในตลาดที่วิ่งเป็นกรอบไซด์เวย์ | ATR (คำนวณระยะ Grid), Price Steps | วาง Pending Order/เปิดไม้ ตามระยะ Grid ที่คำนวณได้ | ถัวเฉลี่ยรวมเป็น Basket แล้วปิดทีเดียวเมื่อ Net Profit บวก | **SL:** ใช้งาน Equity Drawdown แทน<br>**TP:** ปิดรวบกำไร (Basket) | **Entry:** H1<br>**Trend:** D1 | วิ่งออกข้างบ่อยๆ AUDCAD, NZDCAD |
| **10. MartingaleBouncer** | สวนกลับตอนราคากระชากตกขอบรุนแรง (Mean Reversion) พร้อมระบบเบิ้ล | Bollinger Bands (BB) | ราคาหลุดขอบ Bands รุนแรงแล้วมีจังหวะวกกลับ | พุ่งกลับมาหาเส้นกึ่งกลาง (Mean MA) ปกติ | **SL:** Equity Protection อย่างเดียว<br>**TP:** ปิดรวบทั้งชุดเมื่อกลับมาบวก | **Entry:** M15<br>**Trend:** H1 | ไซด์เวย์ เช่น EURCHF, EURGBP |
| **11. VSABot** (Wyckoff) | วิเคราะห์แรงซื้อ/ขายของผู้เล่นรายใหญ่ด้วย Volume ผูกกับขนาดแท่งเทียน | Tick Volume, แท่งเทียน Spread (ความกว้าง Bar) | เกิด Volume มหาศาล แต่แท่งเทียนแคบ (Accumulation/Distribution) สวนทางกับแรงสะสม | เปลี่ยนเทรนด์ หรือ มี VSA Signal ฝั่งตรงข้าม | **SL:** ใต้/บน ไส้เทียน (สวิง) 5 Pips<br>**TP:** แนวรับต้านนัยยะสำคัญ | **Entry:** M15<br>**Trend:** H4 | สินทรัพย์ที่มี Volume หนัก (XAU, หลัก) |
| **12. PriceActionBot** (Gold PA) | เทรดด้วยโครงสร้างราคา W/M + RSI Divergence + Swing Counting (1-5) ดักจุดเข้าที่ Demand Zone/Supply Zone พร้อม Fibo 61.8 Confluence | RSI(14), MA(50), Fibonacci 61.8, Demand/Supply Zone, W/M Pattern | เกิดโครงสร้าง **W CF ยกโล** (Buy) หรือ **M CF ไฮต่ำ** (Sell) ที่แนวรับ/แนวต้าน พร้อม PA Candle ยืนยัน + RSI OVS/OVB/Divergence | RSI แตะ OVB(>70)/OVS(<30) ปิดกำไรทันที หรือ TP ก่อนถึงแนวต้าน/แนวรับ ตามรอบ Swing (Delta Swing 1-5) | **SL:** ใต้ฐาน W / เหนือยอด M + Buffer<br>**TP:** ก่อนถึง S/R / RSI สุดรอบ | **Entry:** M5<br>**Trend:** H1 | XAUUSD (ทองคำ), BTCUSD |

---

## 🎨 Visual Chart / Technical Object Reference (การวาดเส้นและออบเจ็กต์บนกราฟ)

EA ในระบบได้รับการอัพเกรดเป็น **Institutional Grade** สามารถวาด Object เชิงเทคนิคบนกราฟ MT5 ได้อัตโนมัติ เพื่อให้ผู้ใช้/แอดมินเห็นภาพกลยุทธ์ที่บอทกำลังทำงานอยู่ทันที:

| 🤖 ชื่อบอท | 🎨 Object ที่ระบบวาด | 🖍️ ความหมายและสี | 📍 วิธีการทำงาน (รหัสสี MT5) |
| :--- | :--- | :--- | :--- |
| **SMCBot** | `OBJ_RECTANGLE` (กรอบสี่เหลี่ยม) | ตีโซน Fair Value Gap (FVG)<br>• **สีทอง (GoldenRod):** Bearish FVG (Resistance)<br>• **สีม่วง (MediumPurple):** Bullish FVG (Support) | คำนวณช่วงโหว่ของแท่งเทียน 1 และ 3 แบบอัตโนมัติ |
| **FollowerTrend** | `ChartIndicatorAdd` (เส้นอินดิเคเตอร์) | โหลดเส้นกะแนวโน้มทันที<br>• **เส้นสีเหลือง:** Fast Trend (EMA 50)<br>• **เส้นสีแดง:** Slow Trend (EMA 200) | ดึง Handle จาก `iMA` และแปะลง Sub-window หลัก |
| **BreakoutBot** | `OBJ_HLINE` (เส้นแนวนอนแบบประ) | วัดกรอบ Breakout Range<br>• **สีฟ้า (DeepSkyBlue):** Brk_Max แนวต้าน<br>• **สีบานเย็น (Magenta):** Brk_Min แนวรับ | ตีเส้นขอบด้วย `STYLE_DASH` |
| **TurtleBot** | `OBJ_HLINE` (เส้นแนวนอนทึบ) | ตีกรอบ Donchian Channel<br>• **สีเขียว (LimeGreen):** Tur_Max (High 20 วัน)<br>• **สีส้มแดง (OrangeRed):** Tur_Min (Low 20 วัน) | ตีเส้นขอบแข็งด้วย `STYLE_SOLID` |
| **ZoneBot** | `OBJ_HLINE` (เส้นระบุโซน) | แยกขอบเขตเพื่อทำจุด Grid Recovery<br>• **สีฟ้า (DeepSkyBlue):** ZON_Max ด้านบน<br>• **สีส้ม (Orange):** ZON_Min ด้านล่าง | กริดโซนใช้ `STYLE_SOLID` |
| **PriceActionBot** | `OBJ_ARROW` (ลูกศร W/M) | มาร์กจุดเข้า Pattern<br>• **สีเขียว (Lime):** W CF ยกโล (BUY Signal)<br>• **สีแดง (Red):** M CF ไฮต่ำ (SELL Signal) | ยิงลูกศรพร้อม Label "W CF" / "M CF" อัตโนมัติ |

---

### คำอธิบายเพิ่มเติมสำหรับตาราง (Notes)
- **Timeframe:** `Entry` แปลว่าดูสัญญาณสั่งเปิดไม้, `Trend` แปลว่าใช้เพื่อกรองหาทิศทางหลัก เพื่อไม่ให้เข้าเทรดทวนกระแสใหญ่
- **การใช้กับ "App Auto":** ในกรอบการรัน EA จะมีตัวแปรออเดอร์ Comment เช่น `BreakoutBot VSA (M15/H4) Acc` หากเชื่อมกับระบบ App Auto ระบบอ่านหน้าจอหรือเทอร์มินัลของคุณก็สามารถตรวจสอบ String เหล่านี้เพื่อนับ Stat ของโรบอทแต่ละตัวแยกออกจากไม้ที่ User กดเทรดปกติได้เลยครับ
