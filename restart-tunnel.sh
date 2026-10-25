#!/bin/bash
# ==============================================================================
# Drishti Platform - Cloudflare Tunnel Fast Restarter for macOS (Apple Silicon M4)
# ==============================================================================

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "\n${CYAN}============================================================${NC}"
echo -e "${GREEN}⚡ Restarting Cloudflare Tunnel for Drishti Platform...${NC}"
echo -e "${CYAN}============================================================${NC}"

# 1. Kill any existing cloudflared processes
echo -e "${YELLOW}🛑 Stopping any previously running cloudflared instances...${NC}"
pkill -9 -f cloudflared 2>/dev/null || true
sleep 1

# 2. Check if local Drishti server is running on port 5000
if lsof -i :5000 >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Local Drishti server is detected on http://localhost:5000${NC}"
else
    echo -e "${YELLOW}⚠️  Notice: Port 5000 is not active yet.${NC}"
    echo -e "   Please ensure your server is running in another terminal:"
    echo -e "   ${CYAN}npm run start:m4${NC}  or  ${CYAN}npm start${NC}\n"
fi

# 3. Launch Cloudflare Tunnel with Live QR Generator
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

exec node server/scripts/run-tunnel.js
