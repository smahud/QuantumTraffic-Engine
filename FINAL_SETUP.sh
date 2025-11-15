#!/bin/bash
#
# QuantumTraffic Engine - FINAL COMPLETE SETUP
# Run this ONCE to fix all issues
#

set -e

echo "============================================"
echo "QuantumTraffic Engine - Final Setup"
echo "============================================"
echo ""

# Check root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root (sudo)"
  exit 1
fi

# ========================================
# STEP 1: Install Backend Dependencies
# ========================================
echo "[1/5] Installing Backend Dependencies..."
cd /app/backend-v13

if [ ! -d "node_modules" ] || [ ! -d "node_modules/express" ]; then
    echo "Installing backend packages..."
    npm install
    echo "✅ Backend dependencies installed"
else
    echo "Backend dependencies already installed"
fi

# ========================================
# STEP 2: Install Admin Panel Dependencies
# ========================================
echo ""
echo "[2/5] Installing Admin Panel Dependencies..."
cd /app/admin-panel

if [ ! -d "node_modules" ]; then
    echo "Installing admin panel packages..."
    npm install
    echo "✅ Admin panel dependencies installed"
else
    echo "Admin panel dependencies already installed"
fi

# Install missing dependencies
echo "Installing additional dependencies..."
npm install dotenv https 2>/dev/null || true

# Install Tailwind CSS v3 (compatible with Next.js 14)
echo "Installing Tailwind CSS v3..."
npm uninstall tailwindcss 2>/dev/null || true
npm install -D tailwindcss@3.4.1 postcss@8.4.35 autoprefixer@10.4.17

# Clean old configs
rm -f postcss.config.js tailwind.config.js

# Clean build cache
echo "Cleaning build cache..."
rm -rf .next

# Build admin panel
echo "Building admin panel..."
npm run build

echo "✅ Admin panel ready"

# ========================================
# STEP 3: Create Certificates if Missing
# ========================================
echo ""
echo "[3/5] Checking SSL Certificates..."

if [ ! -f "/app/backend-v13/cert.pem" ] || [ ! -f "/app/backend-v13/key.pem" ]; then
    echo "Generating self-signed certificates..."
    cd /app/backend-v13
    openssl req -x509 -newkey rsa:4096 \
        -keyout key.pem \
        -out cert.pem \
        -days 365 -nodes \
        -subj "/C=ID/ST=Jakarta/L=Jakarta/O=QuantumTraffic/OU=Engine/CN=trafficbuster.my.id"
    
    chmod 600 key.pem
    chmod 644 cert.pem
    echo "✅ Certificates generated"
else
    echo "Certificates already exist"
fi

# ========================================
# STEP 4: Create Required Directories
# ========================================
echo ""
echo "[4/5] Creating required directories..."
mkdir -p /app/logs
mkdir -p /app/backups
chmod 755 /app/logs /app/backups
echo "✅ Directories created"

# ========================================
# STEP 5: Fix Permissions
# ========================================
echo ""
echo "[5/5] Fixing permissions..."
chmod +x /app/start-all.sh
chmod +x /app/stop-all.sh
chmod +x /app/check-status.sh
echo "✅ Permissions fixed"

# ========================================
# FINAL CHECK
# ========================================
echo ""
echo "============================================"
echo "✅ Setup Complete!"
echo "============================================"
echo ""
echo "🔍 Verifying installation..."
echo ""

# Check backend
if [ -f "/app/backend-v13/node_modules/express/package.json" ]; then
    echo "✅ Backend dependencies: OK"
else
    echo "❌ Backend dependencies: MISSING"
fi

# Check admin
if [ -d "/app/admin-panel/node_modules" ]; then
    echo "✅ Admin dependencies: OK"
else
    echo "❌ Admin dependencies: MISSING"
fi

# Check certs
if [ -f "/app/backend-v13/cert.pem" ]; then
    echo "✅ SSL certificates: OK"
else
    echo "❌ SSL certificates: MISSING"
fi

echo ""
echo "============================================"
echo "🚀 Ready to Start!"
echo "============================================"
echo ""
echo "To start all services:"
echo "  sudo bash /app/start-all.sh"
echo ""
echo "To check status:"
echo "  sudo bash /app/check-status.sh"
echo ""
echo "To view logs:"
echo "  tail -f /app/logs/backend.log"
echo "  tail -f /app/logs/admin.log"
echo ""
echo "============================================"
