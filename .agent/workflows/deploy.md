---
description: NexusFX - Deploy to DigitalOcean Production (Docker)
---

# NexusFX Deploy Workflow

## 🖥️ Server Information (จำไว้ตลอด)

| รายการ | ค่า |
|---|---|
| **Provider** | DigitalOcean Droplet |
| **Droplet Name** | `nexusfx-server` |
| **Droplet ID** | `561586482` |
| **Public IP** | `139.59.96.10` |
| **Private IP** | `10.15.0.6` |
| **OS** | Ubuntu 24.04.3 LTS |
| **App Directory** | `/var/www/nexusfx` |
| **Domain** | `nexusfx.biz` |

## 🐳 Docker Containers

| Container Name | Image | Port | Role |
|---|---|---|---|
| `nexusfx-web` | nexusfx-web (nginx) | 80:80 | Frontend (Vite + Nginx) |
| `nexusfx-api` | nexusfx-api (node:20) | 4000:4000 | Backend API (Express) |
| `nexusfx-db` | postgres:16-alpine | 5432:5432 | Database (PostgreSQL 16) |

## 📋 Deploy Steps

### Step 1: Build Frontend (Local)
// turbo
```bash
cd c:\Task\freelancce\trading\NexusFX\frontend
npm run build
```

### Step 2: Git Commit & Push
```bash
cd c:\Task\freelancce\trading\NexusFX
git add -A
git commit -m "description of changes"
git push origin main
```

### Step 3: SSH to Server & Pull
```bash
ssh root@139.59.96.10
cd /var/www/nexusfx
git pull origin main
```

### Step 4: Rebuild & Restart Docker Containers
```bash
# Rebuild only changed services (backend + frontend)
docker-compose up -d --build api web

# Or rebuild all including db
docker-compose up -d --build

# View logs to check for errors
docker-compose logs -f --tail=50
```

### Step 5: Verify Deployment
```bash
# Check all containers are running & healthy
docker ps

# Check API health
curl http://localhost:4000/api/health

# Check frontend
curl -I http://localhost:80
```

## 🔧 Quick Commands (บน Server)

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

# === บน Server (SSH: root@139.59.96.10) ===
cd /var/www/nexusfx
git pull origin main
docker-compose up -d --build api web
docker ps
```
