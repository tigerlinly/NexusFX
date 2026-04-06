---
description: NexusFX - Deploy to INET Production (Docker + GitHub Actions CI/CD)
---

# NexusFX Deploy Workflow

> **Note:** GitHub Actions CI/CD is active — pushing to `main` auto-deploys via `.github/workflows/deploy.yml`
> ⚠️ SSH ไม่สามารถเข้าถึงจากภายนอกได้ (Firewall บล็อก) — ใช้ CI/CD เท่านั้น

## 🖥️ Server Information (จำไว้ตลอด)

| รายการ | ค่า |
|---|---|
| **Provider** | INET (Thailand) |
| **Server IP** | `203.151.66.51` |
| **OS** | Ubuntu (Docker) |
| **App Directory** | `/var/www/nexusfx` |
| **Domain** | `nexusfx.biz` |
| **SSH Access** | ❌ ไม่สามารถ SSH จากภายนอก (Firewall) — ใช้ CI/CD |

## 🐳 Docker Containers

| Container Name | Image | Port | Role |
|---|---|---|---|
| `nexusfx-web` | nexusfx-web (nginx) | 80:80, 443:443 | Frontend (Vite + Nginx + SSL) |
| `nexusfx-api` | nexusfx-api (node:20) | 4000:4000 | Backend API (Express) |
| `nexusfx-db` | postgres:16-alpine | 5433:5432 | Database (PostgreSQL 16) |

## 📋 Deploy Steps

### Step 1: Build Frontend (Local)
// turbo
```bash
cd c:\Task\freelancce\trading\NexusFX\frontend
npm run build
```

### Step 2: Git Commit & Push (auto-triggers CI/CD deploy)
```bash
cd c:\Task\freelancce\trading\NexusFX
git add -A
git commit -m "description of changes"
git push origin main
```

### Step 3: Verify Deployment
- เปิด GitHub Actions: https://github.com/tigerlinly/NexusFX/actions
- ตรวจสอบว่า "Deploy to INET Production" workflow สำเร็จ (✅)
- เปิด https://nexusfx.biz เพื่อตรวจสอบหน้าเว็บ

## 🔧 Quick Commands (ผ่าน GitHub Actions เท่านั้น)

> เนื่องจาก SSH ไม่สามารถเข้าถึงจากภายนอก คำสั่งด้านล่างต้องรันผ่าน CI/CD หรือ INET console

```bash
# ดู logs backend
docker logs -f nexusfx-api --tail=100

# ดู logs frontend
docker logs -f nexusfx-web --tail=100

# ดู logs database
docker logs -f nexusfx-db --tail=100

# Restart เฉพาะ backend
docker-compose restart api

# Restart เฉพาะ frontend
docker-compose restart web

# Rebuild & restart เฉพาะ backend (มีการเปลี่ยน code)
docker-compose up -d --build api

# Rebuild & restart เฉพาะ frontend (มีการเปลี่ยน code)
docker-compose up -d --build web

# เข้า database
docker exec -it nexusfx-db psql -U postgres -d nexusfx

# Backup database
docker exec nexusfx-db pg_dump -U postgres nexusfx > backup_$(date +%Y%m%d).sql
```

## ⚡ Quick Deploy (เมื่อแก้ไขเสร็จ)

```bash
# === บน Local (Windows) ===
cd c:\Task\freelancce\trading\NexusFX\frontend
npm run build

cd c:\Task\freelancce\trading\NexusFX
git add -A
git commit -m "fix: description"
git push origin main

# === CI/CD จะ deploy อัตโนมัติ ===
# ตรวจสอบที่: https://github.com/tigerlinly/NexusFX/actions
```

## 🗄️ Database Access (จาก Local)

```bash
# เชื่อมต่อ Production DB จากเครื่อง Local (Port 5433)
DATABASE_URL=postgresql://postgres:nexusfx_secure_password@203.151.66.51:5433/nexusfx node script.js
```
