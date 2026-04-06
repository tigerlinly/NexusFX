#!/bin/bash
# ============================================================
# 🚀 NexusFX — GitHub Self-hosted Runner Setup Script
# ใช้รันบน INET Server (203.151.66.51) เพื่อติดตั้ง runner
# ============================================================
#
# วิธีใช้:
# 1. Login เข้า INET Server (ผ่าน INET Control Panel หรือ VPN)
# 2. รันคำสั่ง: bash setup-github-runner.sh <RUNNER_TOKEN>
#
# RUNNER_TOKEN ดูได้จาก:
#   GitHub → Settings → Actions → Runners → New self-hosted runner
#   https://github.com/tigerlinly/NexusFX/settings/actions/runners/new
#
# ============================================================

set -e

RUNNER_TOKEN="${1}"
RUNNER_DIR="/home/github-runner"
REPO_URL="https://github.com/tigerlinly/NexusFX"

if [ -z "$RUNNER_TOKEN" ]; then
    echo "❌ กรุณาระบุ RUNNER_TOKEN"
    echo "   วิธีดู: ไปที่ https://github.com/tigerlinly/NexusFX/settings/actions/runners/new"
    echo "   ใช้งาน: bash setup-github-runner.sh <YOUR_TOKEN>"
    exit 1
fi

echo "📦 Step 1: สร้างโฟลเดอร์ Runner..."
sudo mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"

echo "📥 Step 2: ดาวน์โหลด GitHub Actions Runner..."
RUNNER_VERSION="2.321.0"
curl -o actions-runner-linux-x64.tar.gz -L \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
tar xzf actions-runner-linux-x64.tar.gz

echo "⚙️ Step 3: ตั้งค่า Runner..."
./config.sh --url "$REPO_URL" \
    --token "$RUNNER_TOKEN" \
    --name "inet-production" \
    --labels "self-hosted,inet,production" \
    --unattended \
    --replace

echo "🔧 Step 4: ติดตั้งเป็น systemd service..."
sudo ./svc.sh install
sudo ./svc.sh start

echo ""
echo "✅ ===== SETUP COMPLETE ====="
echo "   Runner Name : inet-production"
echo "   Runner Dir  : $RUNNER_DIR"
echo "   Status      : $(sudo ./svc.sh status)"
echo ""
echo "   ตอนนี้ push ไปยัง main branch แล้วจะ auto-deploy! 🎉"
echo "============================"
