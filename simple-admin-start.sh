#!/bin/bash
#
# Start Admin Panel in Production Mode (Built)
#

echo "Starting Admin Panel (Production Mode)..."

# Kill existing
pkill -f "/app/admin-panel" 2>/dev/null || true
sleep 2

# Build if not built
cd /app/admin-panel
if [ ! -d ".next" ] || [ ! -f ".next/BUILD_ID" ]; then
    echo "Building admin panel..."
    npm run build
fi

# Start in production mode
echo "Starting..."
NODE_ENV=production nohup node server.js > /app/logs/admin.log 2>&1 &
PID=$!
echo "Admin Panel PID: $PID"

sleep 5

# Check
if lsof -Pi :5353 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Admin Panel running on port 5353"
    echo "Access: https://trafficbuster.my.id:5353"
else
    echo "❌ Failed to start"
    tail -20 /app/logs/admin.log
    exit 1
fi
