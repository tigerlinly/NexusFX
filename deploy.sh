#!/bin/bash
# =============================================
# NexusFX Deploy Script — Run on VPS
# =============================================
set -e

APP_DIR="/var/www/nexusfx"
BACKUP_DIR="/var/www/nexusfx_backup_$(date +%Y%m%d_%H%M%S)"

echo "🚀 NexusFX Deployment Starting..."
echo "=================================="

# 1. Create app directory if not exists
if [ -d "$APP_DIR" ]; then
  echo "📦 Backing up current deployment to $BACKUP_DIR..."
  cp -r "$APP_DIR" "$BACKUP_DIR"
fi
mkdir -p "$APP_DIR/backend"
mkdir -p "$APP_DIR/frontend"

# 2. Extract new files
echo "📂 Extracting new deployment files..."
cd /tmp
if [ -f nexusfx_deploy.tar.gz ]; then
  tar xzf nexusfx_deploy.tar.gz
fi

# 3. Deploy Backend
echo ""
echo "⚙️  Deploying Backend..."
# Preserve .env if it exists
if [ -f "$APP_DIR/backend/.env" ]; then
  cp "$APP_DIR/backend/.env" /tmp/_nexusfx_env_backup
fi

rsync -av --exclude='node_modules' --exclude='.env' /tmp/nexusfx_deploy/backend/ "$APP_DIR/backend/"

# Restore .env
if [ -f /tmp/_nexusfx_env_backup ]; then
  cp /tmp/_nexusfx_env_backup "$APP_DIR/backend/.env"
  rm /tmp/_nexusfx_env_backup
fi

# Install dependencies
cd "$APP_DIR/backend"
npm install --production
echo "✅ Backend dependencies installed"

# 4. Deploy Frontend (dist)
echo ""
echo "🌐 Deploying Frontend..."
rm -rf "$APP_DIR/frontend/dist"
cp -r /tmp/nexusfx_deploy/frontend/dist "$APP_DIR/frontend/dist"
echo "✅ Frontend files copied"

# 5. Setup Nginx (if not configured)
if [ ! -f /etc/nginx/sites-available/nexusfx ]; then
  echo ""
  echo "🔧 Setting up Nginx config..."
  cat > /etc/nginx/sites-available/nexusfx << 'NGINX_CONF'
server {
    listen 80;
    server_name _;

    # Frontend (SPA)
    root /var/www/nexusfx/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;

        # Prevent caching index.html
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
        add_header Pragma "no-cache";
        add_header Expires "0";

        # Cache static assets with hashed filenames
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }

    # API Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket Proxy
    location /socket.io/ {
        proxy_pass http://127.0.0.1:4000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Swagger docs
    location /api-docs {
        proxy_pass http://127.0.0.1:4000/api-docs;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
NGINX_CONF

  ln -sf /etc/nginx/sites-available/nexusfx /etc/nginx/sites-enabled/nexusfx
  # Remove default if exists
  rm -f /etc/nginx/sites-enabled/default
  echo "✅ Nginx configured"
fi

# 6. Test & reload Nginx
echo ""
echo "🔄 Testing & reloading Nginx..."
nginx -t && systemctl reload nginx
echo "✅ Nginx reloaded"

# 7. Restart Backend with PM2
echo ""
echo "🔄 Restarting Backend with PM2..."
cd "$APP_DIR/backend"
if pm2 list 2>/dev/null | grep -q "nexusfx"; then
  pm2 restart nexusfx-backend --update-env
else
  pm2 start ecosystem.config.js --env production
  pm2 save
fi
echo "✅ Backend restarted"

# 8. Cleanup
rm -rf /tmp/nexusfx_deploy
rm -f /tmp/nexusfx_deploy.tar.gz

echo ""
echo "=================================="
echo "🎉 NexusFX Deployed Successfully!"
echo "=================================="
echo "🌐 Frontend: http://$(hostname -I | awk '{print $1}')"
echo "⚙️  Backend:  http://$(hostname -I | awk '{print $1}'):4000/api"
echo "📊 API Docs: http://$(hostname -I | awk '{print $1}'):4000/api-docs"
echo ""
pm2 status
