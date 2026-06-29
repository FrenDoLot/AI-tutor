#!/bin/bash
set -e

echo "=== AI Tutor — Deploy to VPS ==="

# 1. Install system dependencies
echo "[1/9] Installing system packages..."
apt update
apt install -y python3 python3-venv python3-pip python3-full nodejs npm nginx git certbot python3-certbot-nginx

# 2. Clone project
echo "[2/9] Cloning project..."
if [ -d /opt/ai-tutor ]; then
    echo "Directory /opt/ai-tutor already exists, pulling latest..."
    cd /opt/ai-tutor
    git pull
else
    cd /opt
    git clone https://github.com/FrenDoLot/AI-tutor.git ai-tutor
    cd /opt/ai-tutor
fi

# 3. Setup Python venv and backend
echo "[3/9] Setting up Python environment..."
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt

# 4. Setup frontend
echo "[4/9] Building frontend..."
cd frontend
npm install
npm run build
cd ..

# 5. Create .env if missing
echo "[5/9] Checking .env..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo ""
    echo "!!! IMPORTANT: Edit /opt/ai-tutor/.env and set MIMO_API_KEY !!!"
    echo "Run: nano /opt/ai-tutor/.env"
    echo ""
fi

# 6. Set permissions
echo "[6/9] Setting permissions..."
mkdir -p backend/data backend/backups
chown -R www-data:www-data backend/data backend/backups

# 7. Systemd service
echo "[7/9] Creating systemd service..."
cat > /etc/systemd/system/ai-tutor-backend.service << 'UNIT'
[Unit]
Description=AI Tutor FastAPI backend
After=network.target

[Service]
WorkingDirectory=/opt/ai-tutor
EnvironmentFile=/opt/ai-tutor/.env
ExecStart=/opt/ai-tutor/.venv/bin/uvicorn backend.app.main:app --host 127.0.0.1 --port 8001
Restart=always
RestartSec=5
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable ai-tutor-backend
systemctl restart ai-tutor-backend

# 8. Nginx config
echo "[8/9] Configuring nginx..."
cat > /etc/nginx/sites-available/ai-tutor << 'NGINX'
server {
    listen 80;
    server_name tutorai55.duckdns.org;

    root /opt/ai-tutor/frontend/dist;
    index index.html;

    client_max_body_size 25m;

    location /api/ {
        proxy_pass http://127.0.0.1:8001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/ai-tutor /etc/nginx/sites-enabled/ai-tutor
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# 9. SSL with certbot
echo "[9/9] Setting up HTTPS..."
echo ""
echo "Run this command to get SSL certificate:"
echo "  certbot --nginx -d tutorai55.duckdns.org"
echo ""

echo "=== Deploy complete ==="
echo ""
echo "Backend:  http://127.0.0.1:8001"
echo "Frontend: http://tutorai55.duckdns.org"
echo ""
echo "Next steps:"
echo "  1. Edit /opt/ai-tutor/.env — set MIMO_API_KEY and ADMIN_PASSWORD"
echo "  2. Run: systemctl restart ai-tutor-backend"
echo "  3. Run: certbot --nginx -d tutorai55.duckdns.org"
