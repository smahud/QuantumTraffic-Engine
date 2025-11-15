#!/bin/bash
#
# Test Runner Connection to Backend
#

echo "============================================"
echo "Runner Connection Test"
echo "============================================"
echo ""

# Check backend is running
echo "[1/4] Checking Backend..."
if lsof -Pi :5252 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Backend is running on port 5252"
else
    echo "❌ Backend is NOT running"
    echo "Start with: sudo bash /app/start-all.sh"
    exit 1
fi

# Test backend health
echo ""
echo "[2/4] Testing Backend API..."
HEALTH_CHECK=$(curl -sk https://localhost:5252/health 2>/dev/null)
if echo "$HEALTH_CHECK" | grep -q "ok"; then
    echo "✅ Backend health check passed"
else
    echo "❌ Backend health check failed"
    echo "Response: $HEALTH_CHECK"
    exit 1
fi

# Test runner endpoint
echo ""
echo "[3/4] Testing Runner Deploy Endpoint..."
DEPLOY_SCRIPT=$(curl -sk https://trafficbuster.my.id:5252/api/v1/runner/deploy/linux 2>/dev/null | head -5)
if echo "$DEPLOY_SCRIPT" | grep -q "TrafficBuster\|QuantumTraffic"; then
    echo "✅ Runner deploy endpoint accessible"
else
    echo "❌ Runner deploy endpoint failed"
    echo "Response: $DEPLOY_SCRIPT"
    exit 1
fi

# Test WebSocket
echo ""
echo "[4/4] Testing WebSocket Upgrade..."
WS_TEST=$(curl -sk -i https://localhost:5252/ws/runner 2>/dev/null | head -3)
if echo "$WS_TEST" | grep -q "400\|426\|Upgrade"; then
    echo "✅ WebSocket endpoint responding"
else
    echo "⚠️  WebSocket endpoint returned unexpected response"
    echo "Response: $WS_TEST"
fi

echo ""
echo "============================================"
echo "✅ Backend Ready for Runner Connections"
echo "============================================"
echo ""
echo "Deploy runner with:"
echo "  curl -fsSL https://trafficbuster.my.id:5252/api/v1/runner/deploy/linux | bash"
echo ""
echo "Or download and run manually:"
echo "  curl -k https://trafficbuster.my.id:5252/api/v1/runner/deploy/linux > setup-runner.sh"
echo "  bash setup-runner.sh"
echo ""
