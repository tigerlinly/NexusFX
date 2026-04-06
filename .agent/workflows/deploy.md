---
description: NexusFX - Deploy to INET Production (Docker + GitHub Self-hosted Runner)
---

# NexusFX Deploy Workflow

> **Note:** GitHub Actions CI/CD ใช้ Self-hosted Runner บน INET Server
> ⚠️ SSH ไม่สามารถเข้าถึงจากภายนอกได้ (Firewall) — Runner ทำงานบนเครื่องโดยตรง

## 🖥️ Server Information

| รายการ | ค่า |
|---|---|
| **Provider** | INET (Thailand) |
| **Server IP** | `203.151.66.51` |
| **OS** | Ubuntu (Docker) |
| **App Directory** | `/var/www/nexusfx` |
| **Domain** | `nexusfx.biz` |
| **SSH Access** | ❌ Firewall บล็อก — ใช้ Self-hosted Runner |
| **SSH Credentials** | TECH-BIZ / 0611@Techbiz (ใช้ภายในเท่านั้น) |

## 🤖 Self-hosted Runner Setup (ครั้งแรกเท่านั้น)

1. Login เข้า INET Server (ผ่าน INET Control Panel)
2. ไปที่ https://github.com/tigerlinly/NexusFX/settings/actions/runners/new
3. คัดลอก Runner Token
4. รันสคริปต์:
```bash
cd /var/www/nexusfx
bash scripts/setup-github-runner.sh <RUNNER_TOKEN>
```

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

### Step 2: Git Commit & Push (auto-triggers deploy via Runner)
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

## 🔧 Quick Commands (รันบน Server ผ่าน INET Console)

```bash
# ดู logs backend
docker logs -f nexusfx-api --tail=100

# ดู logs frontend
docker logs -f nexusfx-web --tail=100

# ดู logs database
docker logs -f nexusfx-db --tail=100

# Restart เฉพาะ backend
docker-compose restart api

# Rebuild & restart (มีการเปลี่ยน code)
docker-compose up -d --build api web

# เข้า database
docker exec -it nexusfx-db psql -U postgres -d nexusfx

# Backup database
docker exec nexusfx-db pg_dump -U postgres nexusfx > backup_$(date +%Y%m%d).sql
```

## ⚡ Quick Deploy

```bash
# === บน Local (Windows) ===
cd c:\Task\freelancce\trading\NexusFX\frontend
npm run build

cd c:\Task\freelancce\trading\NexusFX
git add -A
git commit -m "fix: description"
git push origin main

# === Self-hosted Runner จะ deploy อัตโนมัติ ===
# ตรวจสอบที่: https://github.com/tigerlinly/NexusFX/actions
```

## 🗄️ Database Access (จาก Local)

```bash
# เชื่อมต่อ Production DB จากเครื่อง Local (Port 5433)
DATABASE_URL=postgresql://postgres:nexusfx_secure_password@203.151.66.51:5433/nexusfx node script.js
```
