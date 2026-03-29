# 🗺️ NexusFX — แผนงานที่ทำได้ตอนนี้ + ลำดับก่อน-หลัง

> **วันที่:** 29 มีนาคม 2026
> 
> แบ่งงานเป็น 2 กลุ่ม: **ทำได้เลยตอนนี้** (เขียนโค้ดอย่างเดียว) vs **ต้องมีสิ่งภายนอก** (server, API key, เงิน)

---

## 🟢 ทำได้เลยตอนนี้ (เขียนโค้ดอย่างเดียว ไม่ต้องพึ่งอะไรข้างนอก)

### ระดับ 1 — ต้องทำก่อน Production (Security & Stability)

| ลำดับ | งาน | เวลาประมาณ | ทำไมต้องทำก่อน |
|-------|------|-----------|--------------|
| **1.1** | 🔒 **CORS Lock Down** — เปลี่ยน `origin: '*'` → whitelist เฉพาะ domain จริง | 10 นาที | ตอนนี้ใครก็ยิง API ได้ ถ้าขึ้น production จะโดนโจมตี |
| **1.2** | 🔒 **Rate Limiting** — ติด `express-rate-limit` ที่ API | 30 นาที | ป้องกัน brute force login, API abuse |
| **1.3** | 🔒 **API Key Encryption** — เข้ารหัส MetaAPI token, Binance key ก่อนเก็บ DB | 1-2 ชม. | ตอนนี้เก็บ plaintext ถ้า DB หลุด API key ถูกขโมย |
| **1.4** | 🔒 **CORS socket.io** — lock origin ของ Socket.io ด้วย | 10 นาที | เหมือน 1.1 แต่สำหรับ WebSocket |
| **1.5** | 🔒 **Helmet.js** — เพิ่ม security headers | 15 นาที | ป้องกัน XSS, clickjacking |

### ระดับ 2 — ฟีเจอร์ที่ขาด (ทำให้ระบบสมบูรณ์ขึ้น)

| ลำดับ | งาน | เวลาประมาณ | เหตุผล |
|-------|------|-----------|--------|
| **2.1** | 📊 **PDF Report Export** — เพิ่ม library `pdfkit` หรือ `puppeteer` สร้าง PDF จาก report | 2-3 ชม. | ตอนนี้ export ได้แค่ CSV ลูกค้าอยากได้ PDF |
| **2.2** | 🤖 **Line Notify Auto Trigger** — ให้ส่ง Line แจ้งเตือนอัตโนมัติเมื่อเปิด/ปิด trade | 1-2 ชม. | Service มีอยู่แล้ว แค่ต่อ trigger เข้า trade flow |
| **2.3** | 🛡️ **Audit Middleware ครอบคลุม** — ใส่ audit log ทุก route สำคัญ | 1-2 ชม. | Middleware มีแล้ว แค่ยังไม่ได้ใช้ทุก route |
| **2.4** | 📋 **Membership Plans DB** — ย้ายแพลนจาก hardcoded UI → ดึงจาก DB | 1-2 ชม. | ทำให้ admin จัดการแพลนได้เอง |
| **2.5** | 🎯 **Group Auto Stop-Loss** — trigger ปิดไม้อัตโนมัติเมื่อกลุ่มขาดทุนเกิน % | 2-3 ชม. | Emergency close มี แค่ต้องเพิ่ม auto-trigger logic |
| **2.6** | 💰 **Profit Sharing Calculator** — คำนวณส่วนแบ่งกำไร leader ↔ member | 2-3 ชม. | ตาราง group + trades มีพร้อม แค่เขียน calc logic |

### ระดับ 3 — Polish & UX

| ลำดับ | งาน | เวลาประมาณ | เหตุผล |
|-------|------|-----------|--------|
| **3.1** | 🐳 **Dockerfile + docker-compose** — ครอบ backend + db | 1-2 ชม. | ทำให้ deploy ง่ายขึ้น, dev environment เหมือนกัน |
| **3.2** | 📖 **API Documentation** — สร้าง Swagger/OpenAPI spec | 3-4 ชม. | ให้คนอื่นเข้าใจ API ได้ง่าย |
| **3.3** | 🎨 **Dashboard Widgets Drag & Drop** — ปรับปรุง UI widgets | 3-4 ชม. | ตอนนี้ basic มาก ยัง drag ไม่ได้ |
| **3.4** | ⚡ **Risk Engine Group-level** — เช็ค total exposure ของทั้งทีม | 2-3 ชม. | riskEngine.js มีแล้ว แค่เพิ่ม group-level check |

---

## 🟡 ต้องมีสิ่งภายนอก (ต้องตัดสินใจ/ซื้อ/ตั้งค่าก่อน)

| ลำดับ | งาน | ต้องมีอะไร | เวลาประมาณ |
|-------|------|-----------|-----------|
| **E.1** | 🌐 **Nginx + HTTPS (SSL)** | VPS + Domain name + Let's Encrypt | 1-2 ชม. |
| **E.2** | 💳 **Payment Gateway จริง** (Stripe/PromptPay/USDT) | บัญชี Stripe หรือ Omise, กำหนดช่องทางชำระเงิน | 4-8 ชม. |
| **E.3** | 🔐 **MFA / 2FA** | เลือกวิธี (TOTP/SMS/Email OTP) + library | 4-6 ชม. |
| **E.4** | 📊 **Binance Real Order Execution** | Binance API key (testnet ก่อน) | 4-6 ชม. |
| **E.5** | 🏗️ **CI/CD Pipeline** | GitHub Actions / GitLab CI config | 2-3 ชม. |
| **E.6** | 🏢 **B2B / White-label ทั้งหมด** | ต้องออกแบบ multi-tenant architecture ใหม่ | 2-4 สัปดาห์ |

---

## 📋 ลำดับแนะนำ (Recommended Order)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 สัปดาห์ที่ 1: Security First (ต้องทำก่อนขึ้น Production)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  วันที่ 1 (ครึ่งวัน):
  ├─ 1.1  CORS Lock Down           ⏱ 10 นาที
  ├─ 1.4  CORS Socket.io           ⏱ 10 นาที
  ├─ 1.5  Helmet.js                ⏱ 15 นาที
  └─ 1.2  Rate Limiting            ⏱ 30 นาที

  วันที่ 1-2:
  └─ 1.3  API Key Encryption       ⏱ 1-2 ชม.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 สัปดาห์ที่ 1-2: Complete Features
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  วันที่ 2-3:
  ├─ 2.2  Line Notify Auto Trigger ⏱ 1-2 ชม.
  ├─ 2.3  Audit Middleware ครบ      ⏱ 1-2 ชม.
  └─ 2.4  Membership Plans DB      ⏱ 1-2 ชม.

  วันที่ 3-4:
  ├─ 2.1  PDF Report Export        ⏱ 2-3 ชม.
  ├─ 2.5  Group Auto Stop-Loss     ⏱ 2-3 ชม.
  └─ 2.6  Profit Sharing Calculator⏱ 2-3 ชม.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 สัปดาห์ที่ 2: Infrastructure & Polish
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  วันที่ 5:
  ├─ 3.1  Docker Setup             ⏱ 1-2 ชม.
  └─ 3.4  Risk Engine Group-level  ⏱ 2-3 ชม.

  วันที่ 6-7:
  ├─ 3.2  API Documentation        ⏱ 3-4 ชม.
  └─ E.1  Nginx + HTTPS (SSL)     ⏱ 1-2 ชม. (ต้องมี VPS)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 สัปดาห์ที่ 3+: External Integrations (ต้องตัดสินใจ)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ├─ E.2  Payment Gateway          ⏱ 4-8 ชม.
  ├─ E.3  MFA / 2FA                ⏱ 4-6 ชม.
  ├─ E.4  Binance Real Orders      ⏱ 4-6 ชม.
  ├─ E.5  CI/CD Pipeline           ⏱ 2-3 ชม.
  └─ E.6  B2B White-label          ⏱ 2-4 สัปดาห์
```

---

## 🚀 สรุป: ถ้าจะเริ่มทำตอนนี้เลย

> [!TIP]
> **แนะนำเริ่มจากงาน Security (1.1 → 1.5)** เพราะทำเสร็จเร็ว (~1 ชม.) และจำเป็นที่สุดก่อนขึ้น production
> 
> หลังจากนั้นทำ **งานฟีเจอร์ (2.1 → 2.6)** เพื่อทำให้ระบบสมบูรณ์ขึ้น
> 
> สุดท้ายค่อยทำ **Infrastructure + External (3.x, E.x)** เมื่อพร้อม deploy จริง

**งานทั้งหมดที่ทำได้เลย (ไม่ต้องพึ่งอะไร) = 15 รายการ ใช้เวลาประมาณ 2-3 สัปดาห์**
**งานที่ต้องมีสิ่งภายนอก = 6 รายการ ขึ้นอยู่กับการตัดสินใจ**
