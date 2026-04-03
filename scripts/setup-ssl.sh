#!/bin/bash
# ==============================================
# NexusFX SSL Setup Script (Let's Encrypt)
# Run on server: bash scripts/setup-ssl.sh
# ==============================================

set -e

DOMAIN="nexusfx.biz"
EMAIL="admin@nexusfx.biz"
APP_DIR="/var/www/nexusfx"

echo "🔒 NexusFX SSL Setup - Let's Encrypt"
echo "======================================"
echo "Domain: $DOMAIN"
echo ""

# Step 1: Ensure containers are running
echo "📦 Step 1: Checking containers..."
cd $APP_DIR
docker-compose up -d web
sleep 3

# Step 2: Request SSL certificate
echo ""
echo "🔐 Step 2: Requesting SSL certificate..."
docker run --rm \
  -v nexusfx_certbot-etc:/etc/letsencrypt \
  -v nexusfx_certbot-var:/var/lib/letsencrypt \
  --network="host" \
  certbot/certbot certonly \
  --standalone \
  --preferred-challenges http \
  --agree-tos \
  --no-eff-email \
  --email $EMAIL \
  -d $DOMAIN \
  -d www.$DOMAIN \
  --force-renewal

# Step 3: Update Nginx config for SSL
echo ""
echo "🔧 Step 3: Updating Nginx config for SSL..."
cat > $APP_DIR/frontend/nginx.conf << 'NGINX_CONF'
# HTTP → HTTPS redirect
server {
    listen 80;
    server_name nexusfx.biz www.nexusfx.biz;

    # ACME challenge for Certbot renewal
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name nexusfx.biz www.nexusfx.biz;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/nexusfx.biz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nexusfx.biz/privkey.pem;

    # SSL parameters
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/javascript application/javascript application/json application/xml image/svg+xml;

    client_max_body_size 10M;

    # Frontend (SPA)
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }

    # API Proxy
    location /api/ {
        proxy_pass http://api:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
    }

    # WebSocket proxy
    location /socket.io/ {
        proxy_pass http://api:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # Block dotfiles
    location ~ /\. {
        deny all;
    }
}
NGINX_CONF

# Step 4: Rebuild web container with SSL config
echo ""
echo "🔄 Step 4: Rebuilding web container with SSL..."
docker-compose up -d --build web

echo ""
echo "✅ SSL Setup Complete!"
echo "   https://nexusfx.biz should now work"
echo ""
echo "📋 Auto-renewal is handled by the certbot container."
echo "   To manually renew: docker-compose run certbot renew"
