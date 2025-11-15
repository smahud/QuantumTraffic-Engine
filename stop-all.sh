#!/bin/bash
#
# QuantumTraffic Engine - Stop All Services
#

echo "============================================"
echo "QuantumTraffic Engine - Stopping Services"
echo "============================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root (sudo)"
  exit 1
fi

# Stop by PID if available
if [ -f "/app/backend.pid" ]; then
    BACKEND_PID=$(cat /app/backend.pid)
    echo "Stopping Backend (PID: $BACKEND_PID)..."
    kill -15 $BACKEND_PID 2>/dev/null || true
    rm /app/backend.pid
fi

if [ -f "/app/admin.pid" ]; then
    ADMIN_PID=$(cat /app/admin.pid)
    echo "Stopping Admin Panel (PID: $ADMIN_PID)..."
    kill -15 $ADMIN_PID 2>/dev/null || true
    rm /app/admin.pid
fi

# Stop systemd services
echo "Stopping systemd services..."
systemctl stop quantumtraffic-backend 2>/dev/null || true
systemctl stop quantumtraffic-admin 2>/dev/null || true

# Kill any remaining node processes on ports
echo "Cleaning up remaining processes..."
lsof -ti:5252 | xargs kill -9 2>/dev/null || true
lsof -ti:5353 | xargs kill -9 2>/dev/null || true
lsof -ti:5522 | xargs kill -9 2>/dev/null || true

echo ""
echo "✅ All services stopped"
