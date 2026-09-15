#!/bin/bash
# ==============================================================================
# Drishti Platform - DigitalOcean / Ubuntu Production Automated Setup Script
# Works on: Ubuntu 22.04 / 24.04 LTS x64 (DigitalOcean Droplet)
# ==============================================================================

set -e

echo "🚀 ============================================================"
echo "   Starting Drishti Production Deployment (DigitalOcean)"
echo "   ============================================================"

# 1. Update system packages
echo "📦 Step 1: Updating packages..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw build-essential nginx mysql-server

# 2. Install Node.js 20 LTS
echo "🟢 Step 2: Installing Node.js 20 LTS..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

# 3. Install PM2 for 24/7 process management
echo "⚙️ Step 3: Installing PM2 process supervisor..."
sudo npm install -g pm2

# 4. Configure Firewall for Ports 80, 443, and 22
echo "🛡️ Step 4: Configuring UFW firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# 5. Configure MySQL Database
echo "🐬 Step 5: Setting up MySQL database 'drishti_db'..."
sudo systemctl enable mysql
sudo systemctl start mysql

sudo mysql -e "CREATE DATABASE IF NOT EXISTS drishti_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'newpassword';"
sudo mysql -e "FLUSH PRIVILEGES;"
echo "✅ MySQL configured."

# 6. Install Dependencies & Build Frontend
echo "🏗️ Step 6: Building Drishti Client & Server..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

mkdir -p server/uploads

# Build client
cd client
npm install
npm run build

# Install server dependencies
cd ../server
npm install
cd ..

# Ensure .env exists in server
if [ ! -f "server/.env" ]; then
    echo "Creating server/.env..."
    cat > server/.env <<'ENVEOF'
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=newpassword
DB_NAME=drishti_db
JWT_SECRET=drishti_ve_cell_akgec_secret_key_2024
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=rohankr.renu@gmail.com
SMTP_PASS=jmcz rego npow ydvc
FRONTEND_URL=http://localhost:5000
ENVEOF
fi

# 7. Configure Nginx Reverse Proxy (with WebSocket & Uploads support)
echo "🌐 Step 7: Configuring Nginx Reverse Proxy..."
NGINX_CONF="/etc/nginx/sites-available/drishti"

sudo bash -c "cat > $NGINX_CONF" <<'EOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 25M;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/drishti /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

# 8. Start Application with PM2
echo "⚡ Step 8: Starting Drishti under PM2 supervisor..."
pm2 delete drishti 2>/dev/null || true
pm2 start server/index.js --name "drishti" --time

# Configure PM2 to auto-restart on reboot
pm2 save
pm2 startup systemd -u $USER --hp $HOME 2>/dev/null || true

PUBLIC_IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')

echo ""
echo "============================================================"
echo "🎉 SUCCESS! Drishti is live 24/7 on DigitalOcean!"
echo "   Public IP Address: $PUBLIC_IP"
echo "   Web Portal:        http://$PUBLIC_IP"
echo "   Admin Dashboard:   http://$PUBLIC_IP/admin"
echo "   Quiz Arena:        http://$PUBLIC_IP/quiz"
echo "============================================================"
