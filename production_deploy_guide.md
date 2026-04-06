# 🚀 คู่มือการนำ NexusFX ขึ้นระบบจริง (Production Deployment Guide)

เอกสารนี้ครอบคลุมวิธีการตั้งค่าและนำ NexusFX ขึ้นสู่ VPS/Server (INET Thailand) เพื่อให้ใช้งานได้จริงผ่านอินเทอร์เน็ต

> **โครงสร้างระบบที่แนะนำ**
> - **Frontend:** โฮสต์บน `Firebase Hosting` หรือ `Vercel` (เพื่อความเร็วและไม่มีค่าใช้จ่ายรายเดือน)
> - **Backend / Database:** รันบน `VPS (Linux Ubuntu)` ของคุณเอง (จากโปรเจกต์เดิมที่มี IP: `206.189.44.86`) + รันผ่าน `PM2`

---

## ส่วนที่ 1: การ Deploy Backend API (บน VPS ตัวจริง)

1. **อัปโหลด Source Code ขึ้น VPS**
   เมื่อเข้า VPS เซิร์ฟเวอร์ผ่าน SSH ได้แล้ว ให้โคลนหรืออัปโหลดโฟลเดอร์ `backend` ไปไว้ใน `/var/www/nexusfx/backend`

2. **ติดตั้ง Environment Variables (.env)**
   เปลี่ยนชื่อไฟล์ `.env.example` เป็น `.env` และกำหนดค่าจริงให้ตรงกับฐานข้อมูล Production
   ```env
   PORT=4000
   DB_USER=YOUR_POSTGRES_USER
   DB_HOST=127.0.0.1
   DB_NAME=nexusfx_prod
   DB_PASSWORD=YOUR_STRONG_PASSWORD
   DB_PORT=5432
   JWT_SECRET=YOUR_NEW_VERY_SECRET_KEY
   BINANCE_API_KEY=your_binance_key (Optional)
   BINANCE_API_SECRET=your_binance_secret (Optional)
   ```

3. **ติดตั้ง Dependencies และเครื่องมือทำงานเบื้องหลัง (PM2)**
   รันคำสั่งนี้บน VPS:
   ```bash
   cd /var/www/nexusfx/backend
   npm install --production
   npm install -g pm2
   ```

4. **เริ่มการทำงานด้วย PM2 (Background Cluster Mode)**
   เราได้สร้างไฟล์ `ecosystem.config.js` ไว้ให้แล้ว สามารถสั่งเริ่มระบบได้เลย:
   ```bash
   pm2 start ecosystem.config.js --env production
   pm2 save
   pm2 startup  # กด Enter และก๊อปปี้คำสั่งที่ระบบโชว์ไปแปะรันอีกรอบ เพื่อให้ PM2 เปิดตัวเองตอนรีสตาร์ทเซิร์ฟเวอร์
   ```

5. **ตั้งค่า Firewall & Nginx (Optional แต่แนะนำ)**
   ถ้าต้องการให้ API เป็น HTTPS ต้องใช้ Nginx ทำ Reverse Proxy ชี้มาที่พอร์ต `4000` ของเครื่อง
   แต่ถ้าใช้ทดสอบ ชั่วคราวสามารถยิงเข้า `http://206.189.44.86:4000` ได้เลย หากเปิด UFW Firewall ไว้

---

## ส่วนที่ 2: การ Deploy Frontend (Web App)

1. **ตั้งค่าไฟล์ฝั่งหน้าบ้าน (.env)**
   ในโฟลเดอร์ `frontend` บนคอมพิวเตอร์ของคุณ ให้สร้างไฟล์ `.env.production` (หรือตอน Build บน Git/Vercel ให้เซ็ตเป็น Environment ตัวแปรไว้) เพื่อบอกให้โค้ดยิงขอข้อมูลไปที่ VPS:
   ```env
   VITE_API_URL=http://206.189.44.86:4000/api
   VITE_WS_URL=http://206.189.44.86:4000
   ```
   *(หมายเหตุ: หากตอนหลัง Backend มีโดเมน HTTPS ก็สามารถมาเปลี่ยนเป็น https://api.yourdomain.com ได้มิต้องแก้โค้ดเลย)*

2. **สร้างไฟลล์ Build (Production Mode)**
   ทำการแพ็กโค้ดหน้าบ้าน:
   ```bash
   cd frontend
   npm run build
   ```
   ระบบจะรวมไฟล์ทุกอย่างและบีบอัดลงในโฟลเดอร์ `dist/`

3. **นำขึ้น Hosting (แบบ Firebase Hosting ที่ตั้งค่าไว้)**
   เนื่องจากมีไฟล์ `firebase.json` อยู่แล้ว สามารถรันได้ทันที:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init hosting  # เลือกโปรเจกต์ Firebase ของคุณ
   firebase deploy --only hosting
   ```

🎉 **เสร็จสมบูรณ์!** ระบบเทรดลูกผสมของคุณจะออนไลน์ และหน้าจอกดเทรดจะโต้ตอบสื่อสารกับระบบเซิร์ฟเวอร์หลังบ้าน VPS จริงๆ ของคุณ 100%!
