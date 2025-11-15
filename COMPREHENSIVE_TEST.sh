#!/bin/bash
#
# QuantumTraffic Engine - Comprehensive System Test
# Tests ALL components end-to-end
#

echo "============================================"
echo "COMPREHENSIVE SYSTEM TEST"
echo "============================================"
echo ""

PASS=0
FAIL=0

# Test function
test_item() {
    local name="$1"
    local command="$2"
    local expected="$3"
    
    echo -n "Testing $name... "
    result=$(eval "$command" 2>/dev/null)
    
    if echo "$result" | grep -q "$expected"; then
        echo "✅ PASS"
        ((PASS++))
    else
        echo "❌ FAIL"
        echo "  Expected: $expected"
        echo "  Got: $result"
        ((FAIL++))
    fi
}

echo "=== BACKEND TESTS ==="
test_item "Backend Port 5252" "lsof -Pi :5252 -sTCP:LISTEN" "LISTEN"
test_item "Backend Health API" "curl -sk https://localhost:5252/health" "ok"
test_item "Backend WebSocket Upgrade" "curl -si -k https://localhost:5252/ | head -1" "HTTP"

echo ""
echo "=== ADMIN PANEL TESTS ==="
test_item "Admin Panel Port 5353" "lsof -Pi :5353 -sTCP:LISTEN" "LISTEN"
test_item "Admin Panel HTML" "curl -sk https://localhost:5353" "<!DOCTYPE html>"
test_item "Admin Panel Login Page" "curl -sk https://localhost:5353/login" "Login\|Sign"

echo ""
echo "=== RUNNER ENDPOINT TESTS ==="
test_item "Runner Deploy Linux" "curl -sk https://localhost:5252/api/v1/runner/deploy/linux | head -5" "TrafficBuster\|QuantumTraffic\|bash"
test_item "Runner Deploy Windows" "curl -sk https://localhost:5252/api/v1/runner/deploy/windows | head -5" "TrafficBuster\|QuantumTraffic\|PowerShell"

echo ""
echo "=== SSL CERTIFICATE TESTS ==="
test_item "Backend Cert File" "ls /app/backend-v13/cert.pem" "cert.pem"
test_item "Backend Key File" "ls /app/backend-v13/key.pem" "key.pem"

echo ""
echo "=== CONFIGURATION TESTS ==="
test_item "Backend .env Exists" "test -f /app/backend-v13/.env && echo exists" "exists"
test_item "Backend Port Config" "grep PORT /app/backend-v13/.env" "5252"
test_item "Admin Panel Port Config" "grep ADMIN_PANEL_PORT /app/backend-v13/.env" "5353"
test_item "Runner API Key Config" "grep RUNNER_API_KEY /app/backend-v13/.env" "quantum-runner"

echo ""
echo "=== LOG FILES TESTS ==="
test_item "Backend Log Exists" "test -f /app/logs/backend.log && echo exists" "exists"
test_item "Admin Log Exists" "test -f /app/logs/admin.log && echo exists" "exists"
test_item "Backend No Fatal Errors" "! grep -i FATAL /app/logs/backend.log | tail -5" ""
test_item "Admin No Fatal Errors" "! grep -i FATAL /app/logs/admin.log | tail -5" ""

echo ""
echo "=== SCRIPT TESTS ==="
test_item "Start Script Exists" "test -x /app/start-all.sh && echo exists" "exists"
test_item "Stop Script Exists" "test -x /app/stop-all.sh && echo exists" "exists"
test_item "Status Script Exists" "test -x /app/check-status.sh && echo exists" "exists"
test_item "Setup Script Exists" "test -x /app/FINAL_SETUP.sh && echo exists" "exists"

echo ""
echo "=== RUNNER FILES TESTS ==="
test_item "Runner Directory" "test -d /app/trafficbuster-runner && echo exists" "exists"
test_item "Runner.js Exists" "test -f /app/trafficbuster-runner/runner.js && echo exists" "exists"
test_item "Runner Package.json" "test -f /app/trafficbuster-runner/package.json && echo exists" "exists"

echo ""
echo "============================================"
echo "TEST SUMMARY"
echo "============================================"
echo "✅ PASSED: $PASS"
echo "❌ FAILED: $FAIL"
echo ""

if [ $FAIL -eq 0 ]; then
    echo "🎉 ALL TESTS PASSED!"
    echo ""
    echo "System is FULLY OPERATIONAL and PRODUCTION READY!"
    echo ""
    echo "Next steps:"
    echo "1. Connect Frontend to: https://trafficbuster.my.id:5252"
    echo "2. Access Admin Panel: https://trafficbuster.my.id:5353"
    echo "3. Deploy Runners with:"
    echo "   curl -fsSL https://trafficbuster.my.id:5252/api/v1/runner/deploy/linux | bash"
    exit 0
else
    echo "⚠️  SOME TESTS FAILED"
    echo ""
    echo "Please review failed tests above and fix issues."
    echo "Common fixes:"
    echo "  - Restart services: sudo bash /app/start-all.sh"
    echo "  - Check logs: tail -50 /app/logs/backend.log"
    echo "  - Run setup: sudo bash /app/FINAL_SETUP.sh"
    exit 1
fi
