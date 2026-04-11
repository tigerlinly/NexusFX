# 🔐 สรุปข้อมูลการเข้าถึงระบบ NexusFX (System Credentials)

เอกสารนี้รวบรวม User, Password, IP และ Port สำหรับเซิร์ฟเวอร์ฐานข้อมูลและระบบต่างๆ ภายในแอปพลิเคชัน NexusFX

---

## 1. 🗄️ ฐานข้อมูล `nexusfx-db` (เฉพาะข้อมูลเว็บแอปพลิเคชัน)
ฐานข้อมูลที่ถูกสร้างขึ้นมาจาก `docker-compose.yml` (หากรันเป็น Container แยกต่างหาก)
- **IP Address:** `203.151.66.51` (INET Server)
- **Port:** `5433` (ทำ Port Mapping ออกมาเพื่อหลบไม่ให้ชนกับ 5432 เดิม)
- **User:** `postgres`
- **Password:** `nexusfx_secure_password` (ค่าเริ่มต้นใน docker-compose)
- **Database Name:** `nexusfx`

---

## 2. 🗄️ ฐานข้อมูลหลัก `nexusfx-datacenter-db` (ข้อมูล Data Feed / MT5)
ฐานข้อมูล TimescaleDB ที่รันอยู่บน INET เป็นหลัก (อันแรกสุด)
- **IP Address:** `203.151.66.51`
- **Port:** `5432`
- **User:** `nexus_admin`
- **Password:** `N3xusFX_DataC3nter2026!`
- **Database Name:** `nexusfx_datacenter`

---

## 3. 🌐 ระบบเว็บหน้าบ้าน (NexusFX Web Admin Panel)
ระบบจัดการพอร์ตลงทุน, สร้าง License และสถิติต่างๆ
- **URL เข้าใช้งาน:** `https://nexusfx.biz` หรือ `http://203.151.66.51`
- **Username / Email:** อีเมลของคุณที่สมัครเป็น Admin (เช่น `admin@nexusfx.biz`)
- **Password เริ่มต้น:** `123456` (หากลืมรหัสผ่าน สามารถเข้าไปที่ CWD `backend` บนเซิร์ฟเวอร์แล้วรันคำสั่ง `node resetPasswords.js` เพื่อรีเซ็ตทุกคนกลับเป็น 123456)

---

## 4. 🤖 ระบบฝั่งบอท (EA / DataFeeder)
ไม่มี Username/Password แบบตรงๆ จะใช้ระบบจัดการสิทธิ์ (Token) ดังนี้:
- **API URL:** `https://nexusfx.biz/api/` หรือ `http://203.151.66.51/api/`
- **License Key:** ขอดึงมาจากหน้า Web Admin เพื่อนำไปกรอกบน EA
- **Agent Code:** ใช้สำหรับผูกตอนสมัครเพื่อคำนวณค่าคอมมิชชั่น
- **MT5 Account ID:** ระบบจะตรวจสอบว่าเข้าใช้งานถูกบัญชีหรือไม่

---

## 5. 🔑 กุญแจเข้ารหัส API (Environment Variables - `.env`)
รหัสเหล่านี้ตั้งอยู่ฝั่งเซิร์ฟเวอร์ `backend/.env` ลับเสมอ
- **JWT_SECRET:** ใช้สำหรับเข้ารหัสผู้ใช้ล็อกอิน
- **ENCRYPTION_KEY:** กุญแจ (ยาว 32 ตัวอักษร) ที่ใช้เข้ารหัสพาสเวิร์ด Broker ก่อนเก็บลง Database ป้องกันการโจรกรรมข้อมูล
