# 📡 คู่มือเชื่อมต่อ TradingView Webhook กับ NexusFX Bot

> เชื่อมระบบแจ้งเตือนของ TradingView เข้ากับ NexusFX Trading Bot เพื่อส่งคำสั่ง Buy/Sell อัตโนมัติ

---

## 🔧 ขั้นตอนการตั้งค่า

### ขั้นตอนที่ 1: สร้าง Bot ใน NexusFX

1. เข้าสู่ระบบ NexusFX ที่ `https://nexusfx.biz`
2. ไปที่เมนู **"🤖 Bots"** ที่แถบด้านซ้าย
3. กดปุ่ม **"สร้างบอทใหม่"**
4. กรอกข้อมูล:
   - **ชื่อบอท:** เช่น `Gold Scalper Bot`
   - **บัญชี:** เลือกบัญชีเทรดที่ต้องการ
   - **Parameters:** ใส่ `webhook_secret` เพื่อความปลอดภัย
     ```json
     {
       "webhook_secret": "my-secret-key-12345"
     }
     ```
5. กด **"บันทึก"** → จด `Bot ID` ไว้ (เช่น ID = `7`)

### ขั้นตอนที่ 2: ตั้งค่า Webhook URL

Webhook URL ของคุณจะมีรูปแบบดังนี้:

```
https://nexusfx.biz/api/webhooks/bot/{BOT_ID}/signal
```

ตัวอย่าง:
```
https://nexusfx.biz/api/webhooks/bot/7/signal
```

### ขั้นตอนที่ 3: สร้าง Alert ใน TradingView

1. เปิดกราฟใน **TradingView** (เช่น XAUUSD)
2. ตั้ง **Indicator/Strategy** ที่คุณต้องการ (เช่น EMA Cross, RSI, etc.)
3. คลิก **"Alerts"** (สัญลักษณ์นาฬิกาปลุก 🔔)
4. สร้าง Alert ใหม่:
   - **Condition:** เลือก Indicator ที่ต้องการ
   - **Once Per Bar Close:** ✅ (แนะนำ)
5. ในแท็บ **"Notifications"**:
   - เปิด **"Webhook URL"**
   - วาง URL: `https://nexusfx.biz/api/webhooks/bot/7/signal`
6. ในช่อง **"Message"** ใส่ JSON ดังนี้:

---

## 📨 รูปแบบ Webhook Message (JSON)

### สำหรับสั่ง BUY:
```json
{
  "action": "BUY",
  "symbol": "XAUUSD",
  "volume": 0.01,
  "price": {{close}},
  "secret_token": "my-secret-key-12345"
}
```

### สำหรับสั่ง SELL:
```json
{
  "action": "SELL",
  "symbol": "XAUUSD",
  "volume": 0.01,
  "price": {{close}},
  "secret_token": "my-secret-key-12345"
}
```

> **หมายเหตุ:** `{{close}}` เป็นตัวแปรของ TradingView ที่จะแทนค่าราคาปิดของแท่งเทียนอัตโนมัติ

---

## 📐 ตัวแปร TradingView ที่ใช้ได้

| ตัวแปร | ความหมาย |
|--------|----------|
| `{{close}}` | ราคาปิดของแท่งเทียน |
| `{{open}}` | ราคาเปิดของแท่งเทียน |
| `{{high}}` | ราคาสูงสุดของแท่งเทียน |
| `{{low}}` | ราคาต่ำสุดของแท่งเทียน |
| `{{volume}}` | Volume ของแท่งเทียน |
| `{{ticker}}` | ชื่อสัญลักษณ์ (เช่น XAUUSD) |
| `{{exchange}}` | ชื่อ Exchange |
| `{{time}}` | เวลาที่ Alert เกิดขึ้น |

---

## 🧪 ทดสอบ Webhook ด้วย cURL

คุณสามารถทดสอบ Webhook ด้วยคำสั่งนี้:

```bash
curl -X POST https://nexusfx.biz/api/webhooks/bot/7/signal \
  -H "Content-Type: application/json" \
  -d '{
    "action": "BUY",
    "symbol": "XAUUSD",
    "volume": 0.01,
    "price": 2340.50,
    "secret_token": "my-secret-key-12345"
  }'
```

**ผลตอบกลับที่ถูกต้อง:**
```json
{
  "success": true,
  "message": "Signal processed and order queued.",
  "order_id": 42
}
```

---

## ⚠️ ข้อควรระวัง

1. **ตรวจสอบ Bot Status:** Bot ต้องอยู่ในสถานะ **ACTIVE** ระบบถึงจะรับ Signal
2. **Secret Token:** หาก Bot มีการตั้ง `webhook_secret` ไว้ ต้องส่ง `secret_token` ที่ตรงกัน มิฉะนั้นจะถูก Reject
3. **Volume:** ระวังขนาด Lot Size ให้เหมาะสมกับทุน (แนะนำ 0.01 สำหรับทดสอบ)
4. **Kill Switch:** หาก Admin เปิด Kill Switch ระบบจะหยุดรับ Signal ทั้งหมด

---

## 📊 ตรวจสอบ Log

หลังจาก TradingView ยิง Signal มาแล้ว คุณสามารถตรวจสอบ Log ได้ที่:

1. เข้าเมนู **"🤖 Bots"**
2. คลิกที่ Bot ของคุณ
3. ดูแท็บ **"Event Logs"** จะเห็นรายการ:
   - `SIGNAL_RECEIVED` — รับสัญญาณสำเร็จ
   - `WARNING` — Signal ถูกปฏิเสธ (Bot ปิดอยู่)
   - `ERROR` — Token ไม่ถูกต้อง

---

## 🚀 Pine Script ตัวอย่าง (EMA Crossover)

```pinescript
//@version=5
strategy("NexusFX EMA Cross", overlay=true)

fast = ta.ema(close, 8)
slow = ta.ema(close, 21)

plot(fast, "EMA 8", color=color.green)
plot(slow, "EMA 21", color=color.red)

if ta.crossover(fast, slow)
    strategy.entry("Buy", strategy.long)
    alert('{"action":"BUY","symbol":"' + syminfo.ticker + '","volume":0.01,"price":' + str.tostring(close) + ',"secret_token":"my-secret-key-12345"}', alert.freq_once_per_bar_close)

if ta.crossunder(fast, slow)
    strategy.entry("Sell", strategy.short)
    alert('{"action":"SELL","symbol":"' + syminfo.ticker + '","volume":0.01,"price":' + str.tostring(close) + ',"secret_token":"my-secret-key-12345"}', alert.freq_once_per_bar_close)
```

---

> 📌 **สำคัญ:** คู่มือนี้เป็นเวอร์ชัน v1.0 — สำหรับคำถามเพิ่มเติม ติดต่อ Admin ผ่านระบบ NexusFX หรือ Line Official
