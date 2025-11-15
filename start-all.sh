#!/bin/bash
#
# QuantumTraffic Engine - Start All Services
# Quick start script for production
#

echo "============================================"
echo "QuantumTraffic Engine - Starting Services"
echo "============================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root (sudo)"
  exit 1
fi

# Stop existing services if running
echo "[1/4] Stopping existing services..."
systemctl stop quantumtraffic-backend 2>/dev/null || true
systemctl stop quantumtraffic-admin 2>/dev/null || true
killall node 2>/dev/null || true
sleep 2

# Check MongoDB
echo "[2/4] Checking MongoDB..."
if ! systemctl is-active --quiet mongod; then
    echo "Starting MongoDB..."
    systemctl start mongod
    sleep 2
fi

# Start Backend
echo "[3/4] Starting Backend..."
cd /app/backend-v13

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env not found in /app/backend-v13"
    echo "Please create .env with proper configuration"
    exit 1
fi

# Start backend in background
NODE_ENV=production nohup node server.js > /app/logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID)"

# Wait for backend to start
sleep 5

# Check if backend is running
if ! ps -p $BACKEND_PID > /dev/null; then
    echo "❌ Backend failed to start. Check logs:"
    tail -20 /app/logs/backend.log
    exit 1
fi

# Start Admin Panel
echo "[4/4] Starting Admin Panel..."
cd /app/admin-panel

# Check if built
if [ ! -d ".next" ]; then
    echo "Building Admin Panel..."
    npm run build
fi

# Start admin panel in background
NODE_ENV=production nohup node server.js > /app/logs/admin.log 2>&1 &
ADMIN_PID=$!
echo "Admin Panel started (PID: $ADMIN_PID)"

# Wait for admin panel to start
sleep 3

# Save PIDs
echo $BACKEND_PID > /app/backend.pid
echo $ADMIN_PID > /app/admin.pid

echo ""
echo "============================================"
echo "✅ All Services Started"
echo "============================================"
echo ""
echo "📊 Status:"
echo "  Backend PID: $BACKEND_PID"
echo "  Admin PID: $ADMIN_PID"
echo ""
echo "🌐 Access URLs:"
echo "  Backend: https://trafficbuster.my.id:5252"
echo "  Admin Panel: https://trafficbuster.my.id:5353"
echo ""
echo "📄 Logs:"
echo "  Backend: /app/logs/backend.log"
echo "  Admin: /app/logs/admin.log"
echo ""
echo "🛑 To stop:"
echo "  sudo bash /app/stop-all.sh"
echo ""
echo "============================================"
