#!/bin/bash
#
# QuantumTraffic Engine - Restart Admin Panel Only
#

echo "============================================"
echo "Restarting Admin Panel"
echo "============================================"

# Stop admin panel
echo "Stopping admin panel..."
pkill -f "/app/admin-panel" || true
sleep 2

# Clean build if needed
if [ "$1" == "clean" ]; then
    echo "Cleaning build cache..."
    cd /app/admin-panel
    rm -rf .next
    npm run build
fi

# Start admin panel
echo "Starting admin panel..."
cd /app/admin-panel
nohup node server.js > /app/logs/admin.log 2>&1 &
ADMIN_PID=$!

echo "Admin Panel PID: $ADMIN_PID"
echo $ADMIN_PID > /app/admin.pid

sleep 5

# Check if running
if lsof -Pi :5353 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Admin Panel running on port 5353"
    echo "Access: https://trafficbuster.my.id:5353"
else
    echo "❌ Admin Panel failed to start"
    echo "Check logs: tail -50 /app/logs/admin.log"
    exit 1
fi

echo "============================================"
