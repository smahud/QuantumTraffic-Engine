#!/bin/bash
#
# QuantumTraffic Engine - Status Check
#

echo "============================================"
echo "QuantumTraffic Engine - System Status"
echo "============================================"
echo ""

# Check MongoDB
echo "📦 MongoDB:"
if systemctl is-active --quiet mongod; then
    echo "  ✅ Running"
else
    echo "  ❌ Not running"
fi

# Check Backend
echo ""
echo "⚙️  Backend (Port 5252):"
if lsof -Pi :5252 -sTCP:LISTEN -t >/dev/null ; then
    echo "  ✅ Running"
    BACKEND_PID=$(lsof -Pi :5252 -sTCP:LISTEN -t)
    echo "  PID: $BACKEND_PID"
    echo "  URL: https://trafficbuster.my.id:5252"
else
    echo "  ❌ Not running"
    echo "  Check logs: tail -50 /app/logs/backend.log"
fi

# Check Admin Panel
echo ""
echo "🎛️  Admin Panel (Port 5353):"
if lsof -Pi :5353 -sTCP:LISTEN -t >/dev/null ; then
    echo "  ✅ Running"
    ADMIN_PID=$(lsof -Pi :5353 -sTCP:LISTEN -t)
    echo "  PID: $ADMIN_PID"
    echo "  URL: https://trafficbuster.my.id:5353"
else
    echo "  ❌ Not running"
    echo "  Check logs: tail -50 /app/logs/admin.log"
fi

# Check Runner Port
echo ""
echo "🏃 Runner Port (5522):"
if lsof -Pi :5522 -sTCP:LISTEN -t >/dev/null ; then
    echo "  ✅ Listening"
else
    echo "  ⚠️  Not listening (Backend may not be fully started)"
fi

# Check SSL Certificates
echo ""
echo "🔐 SSL Certificates:"
if [ -f "/etc/letsencrypt/live/trafficbuster.my.id/fullchain.pem" ]; then
    echo "  ✅ Certificate found"
    CERT_EXPIRY=$(openssl x509 -enddate -noout -in /etc/letsencrypt/live/trafficbuster.my.id/fullchain.pem | cut -d= -f2)
    echo "  Expires: $CERT_EXPIRY"
else
    echo "  ❌ Certificate not found"
fi

# Recent Errors
echo ""
echo "⚠️  Recent Errors:"
echo "Backend:"
tail -5 /app/logs/backend.log 2>/dev/null | grep -i error || echo "  No recent errors"
echo ""
echo "Admin:"
tail -5 /app/logs/admin.log 2>/dev/null | grep -i error || echo "  No recent errors"

echo ""
echo "============================================"
