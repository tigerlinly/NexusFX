# 🔐 NexusFX — Credentials & Password Handover

> ⚠️ **CONFIDENTIAL** — เอกสารนี้มีข้อมูลรหัสผ่านทั้งหมด ห้ามเผยแพร่

---

## 1. 🖥️ Server Access (DigitalOcean)

| Detail | Value |
|--------|-------|
| **IP** | `139.59.96.10` |
| **SSH User** | `root` |
| **SSH Password** | `4215Tiger` |
| **SSH Command** | `ssh root@139.59.96.10` |
| **Path** | `/var/www/nexusfx` |

---

## 2. 🗄️ Database Credentials

### 2.1 Development (Local)

| Key | Value |
|-----|-------|
| **Host** | `localhost:5432` |
| **Database** | `nexusfx_dev` |
| **User** | `postgres` |
| **Password** | `password` |
| **Connection** | `postgresql://postgres:password@localhost:5432/nexusfx_dev` |

### 2.2 QA / Staging

| Key | Value |
|-----|-------|
| **Host** | `db.qa-server.internal:5432` |
| **Database** | `nexusfx_qa` |
| **User** | `qa_user` |
| **Password** | `qa_password` |
| **Connection** | `postgresql://qa_user:qa_password@db.qa-server.internal:5432/nexusfx_qa` |

### 2.3 Production (DigitalOcean Docker)

| Key | Value |
|-----|-------|
| **Host** | `db:5432` (Docker internal) / `139.59.96.10:5432` (external) |
| **Database** | `nexusfx` |
| **User** | `postgres` |
| **Password** | `nexusfx_secure_password` (Docker default) |
| **Connection** | `postgresql://postgres:nexusfx_secure_password@db:5432/nexusfx` |
| **psql Command** | `docker exec -it nexusfx-db psql -U postgres -d nexusfx` |

---

## 3. 👥 Application Users (Production)

> รหัสผ่านรีเซ็ตด้วยสคริปต์ `resetPasswords.js` → Default password: **`123456`**

| ID | Username | Email | Role | Password |
|----|----------|-------|------|----------|
| 1 | **admin** | admin@nexusfx.biz | 🔴 admin | `123456` |
| 2 | MasterPong | pong@demo.com | user | `123456` |
| 3 | TraderJay | jay@demo.com | user | `123456` |
| 4 | GoldQueenFX | queen@demo.com | user | `123456` |
| 5 | SnipePro | snipe@demo.com | user | `123456` |
| 6 | CryptoSam | sam@demo.com | user | `123456` |
| 7 | FXSensei | sensei@demo.com | user | `123456` |
| 8 | PipHunter | pip@demo.com | user | `123456` |
| 9 | TraderNut | nut@demo.com | user | `123456` |
| 10 | **tiger** | tigerlinly@gmail.com | 🟡 team_lead | `123456` |
| 11 | u1 | u1@gmail.com | user | `123456` |
| 12 | demo | demo@gmail.com | user | `123456` |

> [!IMPORTANT]
> แนะนำให้เปลี่ยนรหัสผ่านทันทีหลังส่งมอบ โดยเฉพาะ admin และ tiger

---

## 4. 🔑 Security Keys

### 4.1 Development

| Key | Value |
|-----|-------|
| JWT Secret | `dev-secret-key-do-not-use-in-production` |
| Encryption Key | `dev-32-char-encryption-key-local` |
| Encryption Salt | `dev-salt` |

### 4.2 QA / Staging

| Key | Value |
|-----|-------|
| JWT Secret | `qa-secret-key-different-from-dev-and-prod` |
| Encryption Key | `qa-32-char-encryption-key-for-stg` |
| Encryption Salt | `qa-salt` |

### 4.3 Production

| Key | Value |
|-----|-------|
| JWT Secret | `nexusfx-production-secret-change-this` (Docker default fallback) |
| Encryption Key | `ab830ca6a75bde4ac4bb9dc6bcfe1118` (from .env template) |
| Encryption Salt | `239ee8d550319bff2b132b7887b35ea9` (from .env template) |

> [!WARNING]
> Production JWT_SECRET ใช้ค่า default fallback จาก docker-compose.yml
> แนะนำให้ตั้งค่าจริงใน `/var/www/nexusfx/.env` file

---

## 5. 📧 Email / SMTP

### Development
| Key | Value |
|-----|-------|
| Host | `smtp.mailtrap.io` |
| Port | `2525` |
| User | `dev_user` |
| Password | `dev_pass` |

### QA
| Key | Value |
|-----|-------|
| Host | `smtp.hostinger.com` |
| Port | `465` |
| User | `qa-tester@nexusfx.com` |
| Password | `qa-password` |

### Production
| Key | Value |
|-----|-------|
| Host | `smtp.hostinger.com` (template) |
| Port | `465` |
| User | `support@yourdomain.com` *(ต้องตั้งค่าจริง)* |
| Password | `your-secure-password` *(ต้องตั้งค่าจริง)* |

---

## 6. 💳 Third-Party API Keys

| Service | Environment | Key |
|---------|-------------|-----|
| **Stripe** | Test | `sk_test_1234567890abcdef` |
| **Stripe** | Production | *(ยังไม่ได้ตั้ง — ต้องใช้ `sk_live_...`)* |
| **MetaAPI** | Dev | `dev-metaapi-token` |
| **MetaAPI** | QA | `qa-metaapi-token` |
| **MetaAPI** | Prod | *(ตั้งค่าผ่าน Admin Config UI หรือ .env)* |

---

## 7. 🐙 GitHub Repository

| Detail | Value |
|--------|-------|
| **Repo** | `tigerlinly/NexusFX` |
| **Branch** | `main` |
| **CI/CD** | GitHub Actions (auto-deploy on push) |
| **Secrets** | `HOST=139.59.96.10`, `USERNAME=root`, `PASSWORD=4215Tiger` |

---

## 8. 🌐 URLs

| Environment | Frontend | API |
|-------------|----------|-----|
| **Development** | `http://localhost:5173` | `http://localhost:4000` |
| **QA** | `https://qa.nexusfx.com` | QA server |
| **Production** | `http://139.59.96.10` | `http://139.59.96.10:4000` |
| **Production (Domain)** | `https://nexusfx.biz` *(หลังชี้ DNS)* | Same origin (`/api/*`) |

---

## 9. 📋 สคริปต์สำคัญ

| Script | Purpose | Command |
|--------|---------|---------|
| `resetPasswords.js` | รีเซ็ตรหัสผ่าน user ทั้งหมดเป็น `123456` | `node resetPasswords.js` |
| `promote_admin.js` | เลื่อนสิทธิ์ user `tiger` และ `admin` เป็น admin | `node promote_admin.js` |
| `setup-ssl.sh` | ติดตั้ง SSL (Let's Encrypt) | `bash scripts/setup-ssl.sh` |

---

## 10. ⚡ Quick Start

### เข้าใช้งานหน้าเว็บ (Production)
```
URL:      http://139.59.96.10
Username: admin
Password: 123456
```

### SSH เข้า Server
```bash
ssh root@139.59.96.10
# Password: 4215Tiger
cd /var/www/nexusfx
```

### ดู Container Status
```bash
docker ps
docker logs nexusfx-api --tail 50
```

### เข้า Database โดยตรง
```bash
docker exec -it nexusfx-db psql -U postgres -d nexusfx
```

---

> **📌 หมายเหตุ:** ข้อมูลนี้ใช้สำหรับส่งมอบงานเท่านั้น  
> แนะนำให้เปลี่ยนรหัสผ่านทั้งหมดทันทีหลังรับมอบ
