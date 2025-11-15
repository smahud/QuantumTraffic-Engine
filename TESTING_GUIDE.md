# 🧪 TESTING GUIDE - TrafficBuster Distributed Architecture

Panduan untuk testing sistem TrafficBuster setelah refactor ke arsitektur distributed 3-tier.

---

## 📋 PRE-REQUISITES

Sebelum testing, pastikan:
- [x] Backend-v13 sudah di-setup
- [x] Minimal 1 Runner sudah di-setup
- [x] Node.js & npm terinstall
- [x] Playwright dependencies terinstall di Runner

---

## 🎯 TEST SCENARIO 1: Backend Standalone

### Tujuan
Memastikan Backend bisa start tanpa Playwright dan bisa menerima koneksi.

### Steps

1. **Start Backend**
```bash
cd /app/backend-v13

# Setup .env jika belum
cat > .env << EOF
PORT=3000
JWT_SECRET=test-jwt-secret-key
RUNNER_API_KEY=test-runner-api-key
ALLOWED_ORIGINS=*
EOF

# Install dependencies
npm install

# Start
npm start
```

2. **Expected Output**
```
[startup] Loaded SSL certificate & key.
[startup] JWT secret present (length: 21 ).
[startup] WebSocket server ready.
[WSS-Runner] Runner WebSocket Server initialized on /ws/runner
====================================================
TrafficBuster Backend running at: https://localhost:3000
====================================================
```

3. **Verify**
```bash
# Health check
curl -k https://localhost:3000/health

# Expected response:
{
  "status": "ok",
  "uptimeSec": 10,
  "startedAt": "2025-11-15T..."
}
```

4. **✅ SUCCESS CRITERIA**
- [x] Backend starts without Playwright errors
- [x] No "Failed to launch browser" errors
- [x] Health endpoint responds
- [x] No dependency errors

---

## 🎯 TEST SCENARIO 2: Runner Connection

### Tujuan
Memastikan Runner bisa connect dan register ke Backend.

### Steps

1. **Setup Runner**
```bash
cd /app/trafficbuster-runner

# Install dependencies
npm install
npx playwright install --with-deps

# Setup .env
cat > .env << EOF
BE_HOST=localhost:3000
RUNNER_API_KEY=test-runner-api-key
RUNNER_OS=linux
RUNNER_BROWSER=chrome
HEADLESS=true
EOF
```

2. **Start Runner**
```bash
npm start
```

3. **Expected Output - Runner Logs**
```
============================================================
TRAFFICBUSTER RUNNER
============================================================
[INFO] OS: linux
[INFO] Browser: chrome
[INFO] Backend: localhost:3000
============================================================
[INFO] Connecting to Backend: localhost:3000
[INFO] ✅ Connected to Backend-Orchestrator
[INFO] ✅ Registered as runner: runner_1731690000_abc123
```

4. **Expected Output - Backend Logs**
```
[WSS-Runner] New runner connection attempt
[runnerManager] ✅ Runner registered: runner_1731690000_abc123 (OS: linux, Browser: chrome)
[runnerManager] Total runners online: 1
```

5. **Verify Runner Status**
```bash
# Login dan dapatkan token dulu (skip jika sudah punya)
TOKEN="your-jwt-token-here"

# Check runners status (admin only)
curl -k -H "Authorization: Bearer $TOKEN" \
  https://localhost:3000/api/v1/runners/status

# Expected response:
{
  "success": true,
  "sessionActive": true,
  "runners": [
    {
      "id": "runner_1731690000_abc123",
      "os": "linux",
      "browser": "chrome",
      "status": "idle",
      "currentJobId": null,
      "registeredAt": "2025-11-15T...",
      "lastSeen": "2025-11-15T..."
    }
  ]
}
```

6. **✅ SUCCESS CRITERIA**
- [x] Runner connects successfully
- [x] Runner registered with unique ID
- [x] Backend logs show runner registration
- [x] Runner status API shows runner as "idle"
- [x] No authentication errors

---

## 🎯 TEST SCENARIO 3: Platform API

### Tujuan
Memastikan platform API mengembalikan platform berdasarkan Runner online.

### Steps

1. **Test Without Runner**
```bash
# Stop semua Runner
# Then call API

curl -k -H "Authorization: Bearer $TOKEN" \
  https://localhost:3000/api/v1/runners/available-platforms

# Expected:
{
  "success": true,
  "sessionActive": true,
  "platforms": [],
  "runnersOnline": 0
}
```

2. **Test With Linux Runner Online**
```bash
# Start Runner dengan RUNNER_OS=linux
# Then call API

curl -k -H "Authorization: Bearer $TOKEN" \
  https://localhost:3000/api/v1/runners/available-platforms

# Expected: Platforms with os="linux" only
{
  "success": true,
  "platforms": [
    {
      "id": "linux-chrome-1920x1080",
      "os": "linux",
      "browser": "chrome",
      ...
    }
  ],
  "runnersOnline": 1
}
```

3. **✅ SUCCESS CRITERIA**
- [x] No runners → empty platforms array
- [x] Linux runner → only Linux platforms returned
- [x] Windows runner → only Windows platforms returned
- [x] Multiple runners → platforms dari semua OS yang online

---

## 🎯 TEST SCENARIO 4: Job Dispatch

### Tujuan
Memastikan Backend bisa dispatch job ke Runner dan Runner execute-nya.

### Steps

1. **Prerequisites**
- Backend running
- Minimal 1 Runner connected (status: idle)
- User logged in (punya JWT token)
- Ada dataset (targets, settings)

2. **Create & Start Job**
```bash
# Example job config
curl -k -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "targetSet": "default-targets",
    "settingsProfile": "default-settings",
    "proxySet": null,
    "platformSet": null
  }' \
  https://localhost:3000/api/v1/run/start

# Expected response:
{
  "success": true,
  "sessionActive": true,
  "jobId": "job_abc123",
  "status": "running",
  "message": "Job started"
}
```

3. **Expected Output - Backend Logs**
```
[jobManager] Created job job_abc123 with history hist_xxx
[run/start] Job job_abc123 started for testuser
[runnerManager] Selected runner: runner_1731690000_abc123 (OS: linux, Browser: chrome)
[runnerManager] 📤 Job job_abc123 dispatched to runner runner_1731690000_abc123
```

4. **Expected Output - Runner Logs**
```
[INFO] 📥 Received new job: job_abc123
[INFO] Starting job job_abc123
[INFO] Total targets: 5
[INFO] Running with 1 parallel instances
[INFO] Launching browser...
[INFO] Browser launched successfully
[INFO] Navigating to https://example.com
[INFO] Auto scrolling...
[INFO] Dwelling for 2s...
[INFO] Flow completed for https://example.com (Duration: 3500ms)
...
[INFO] Job job_abc123 completed successfully
[INFO] Job completion sent to backend
```

5. **✅ SUCCESS CRITERIA**
- [x] Job dispatched to correct Runner
- [x] Runner acknowledges job
- [x] Runner executes Playwright flows
- [x] Progress updates sent to Backend
- [x] Backend forwards progress to Frontend (check WebSocket)
- [x] Job completes successfully
- [x] Runner returns to "idle" status

---

## 🎯 TEST SCENARIO 5: Human Behavior Simulation

### Tujuan
Memastikan human behavior logic berfungsi (scrolling, dwell time, clicking).

### Steps

1. **Create Job dengan Human Surfing Config**
```javascript
// Settings profile should include:
{
  "humanSurfing": {
    "autoPageScrolling": true,
    "autoClick": true,
    "clickRatio": 0.3,
    "allowExternalClick": false
  },
  "sessionDuration": {
    "min": 2000,
    "max": 5000
  }
}
```

2. **Monitor Runner Logs**
```
[DEBUG] Attempting proxy: 192.168.1.1:8080
[DEBUG] Platform: Ubuntu 22.04 @ 1920x1080
[INFO] Navigating to https://example.com
[DEBUG] Auto scrolling...
[DEBUG] Dwelling for 3s...
[DEBUG] Attempting auto click...
[DEBUG] Clicked link: /about
[INFO] Flow completed for https://example.com (Duration: 5200ms)
```

3. **Verify Behavior**
- [ ] Random scroll amount (bukan fixed)
- [ ] Dwell time berbeda-beda (between min-max)
- [ ] Click simulation working (jika enabled)
- [ ] Click ratio respected (~30% of flows should click)

4. **✅ SUCCESS CRITERIA**
- [x] Scrolling happens (mouse.wheel called)
- [x] Dwell time varies randomly
- [x] Auto-click works (if enabled)
- [x] Click ratio approximately correct
- [x] No crashes from human behavior logic

---

## 🎯 TEST SCENARIO 6: Multi-Runner Deployment

### Tujuan
Memastikan multiple Runners bisa connect dan Backend distribute job ke mereka.

### Steps

1. **Start Multiple Runners**

**Terminal 1 - Linux Runner**
```bash
cd /app/trafficbuster-runner
cat > .env << EOF
BE_HOST=localhost:3000
RUNNER_API_KEY=test-runner-api-key
RUNNER_OS=linux
RUNNER_BROWSER=chrome
HEADLESS=true
EOF
npm start
```

**Terminal 2 - Windows Runner (if available)**
```bash
# On Windows machine or WSL
cd /app/trafficbuster-runner
cat > .env << EOF
BE_HOST=localhost:3000
RUNNER_API_KEY=test-runner-api-key
RUNNER_OS=windows
RUNNER_BROWSER=chrome
HEADLESS=true
EOF
npm start
```

2. **Verify Both Connected**
```bash
curl -k -H "Authorization: Bearer $TOKEN" \
  https://localhost:3000/api/v1/runners/status

# Expected: 2 runners
{
  "runners": [
    { "id": "runner_xxx", "os": "linux", "status": "idle" },
    { "id": "runner_yyy", "os": "windows", "status": "idle" }
  ]
}
```

3. **Create Job dengan Platform Specific**
```bash
# Job with Windows platform
# Backend should dispatch ke Windows Runner

# Job with Linux platform
# Backend should dispatch ke Linux Runner
```

4. **✅ SUCCESS CRITERIA**
- [x] Multiple Runners connect simultaneously
- [x] Each Runner has unique ID
- [x] Backend selects correct Runner based on platform request
- [x] Jobs distributed across Runners
- [x] No conflicts between Runners

---

## 🎯 TEST SCENARIO 7: Runner Reconnection

### Tujuan
Memastikan Runner auto-reconnect jika Backend restart atau connection drop.

### Steps

1. **Start Backend & Runner**
```bash
# Terminal 1
cd /app/backend-v13
npm start

# Terminal 2
cd /app/trafficbuster-runner
npm start
```

2. **Verify Connection**
```
[INFO] ✅ Connected to Backend-Orchestrator
[INFO] ✅ Registered as runner: runner_xxx
```

3. **Stop Backend**
```bash
# Ctrl+C di Terminal 1
```

4. **Expected Runner Logs**
```
[WARN] ❌ Connection to Backend closed
[INFO] Reconnecting in 5 seconds...
[ERROR] Failed to connect: ECONNREFUSED
[INFO] Reconnecting in 5 seconds...
```

5. **Restart Backend**
```bash
# Terminal 1
npm start
```

6. **Expected Runner Logs**
```
[INFO] Connecting to Backend: localhost:3000
[INFO] ✅ Connected to Backend-Orchestrator
[INFO] ✅ Registered as runner: runner_yyy  # New ID
```

7. **✅ SUCCESS CRITERIA**
- [x] Runner detects Backend disconnect
- [x] Runner auto-reconnects every 5 seconds
- [x] Runner re-registers successfully after reconnect
- [x] No crashes or hangs

---

## 🎯 TEST SCENARIO 8: Deploy Scripts

### Tujuan
Memastikan deploy scripts berfungsi untuk auto-install.

### Linux Test
```bash
# On clean Debian/Ubuntu system
curl -fsSL http://localhost:3000/api/v1/runner/deploy/linux | bash

# Should:
# 1. Install Node.js
# 2. Install dependencies
# 3. Setup runner directory
# 4. Create .env file
# 5. Create start script
```

### Windows Test
```powershell
# On Windows PowerShell (as Admin)
iwr -useb http://localhost:3000/api/v1/runner/deploy/windows | iex

# Should:
# 1. Install Chocolatey
# 2. Install Node.js & Git
# 3. Setup runner directory
# 4. Create .env file
# 5. Create start-runner.bat
```

### ✅ SUCCESS CRITERIA
- [x] Script completes without errors
- [x] All dependencies installed
- [x] Runner directory created
- [x] .env file created with default config
- [x] Can start Runner immediately after script

---

## 🎯 TEST SCENARIO 9: Error Handling

### Test 9a: No Runner Available
```bash
# Stop all Runners
# Create job

# Expected: Job fails immediately
# Backend logs: "No available runners online"
# Job status: "failed"
```

### Test 9b: Runner Disconnect During Job
```bash
# Start job
# Kill Runner mid-execution

# Expected:
# - Backend logs: "Runner disconnected while running job"
# - Job marked as failed
# - Frontend notified
```

### Test 9c: Invalid API Key
```bash
# Runner dengan wrong API key
cat > .env << EOF
RUNNER_API_KEY=wrong-key
EOF

# Expected:
# Runner logs: "Authentication Failed"
# Backend logs: "Connection rejected: Invalid API Key"
# No registration
```

---

## 📊 TESTING CHECKLIST

### Backend Tests
- [ ] ✅ Backend starts without Playwright
- [ ] ✅ WebSocket `/ws` accessible
- [ ] ✅ WebSocket `/ws/runner` accessible
- [ ] ✅ Health endpoint responds
- [ ] ✅ Runner API endpoints work
- [ ] ✅ Platform API returns correct data

### Runner Tests
- [ ] ✅ Runner connects to Backend
- [ ] ✅ Runner registers successfully
- [ ] ✅ Runner receives jobs
- [ ] ✅ Playwright launches
- [ ] ✅ Human behavior works
- [ ] ✅ Progress updates sent
- [ ] ✅ Job completion notified
- [ ] ✅ Auto-reconnection works

### Integration Tests
- [ ] ✅ Job dispatch works
- [ ] ✅ Progress forwarding to Frontend
- [ ] ✅ Multiple Runners support
- [ ] ✅ Platform-specific job routing
- [ ] ⏳ Frontend platform dynamic selection (pending FE-1)

### Deploy Tests
- [ ] ⏳ Linux deploy script (manual test needed)
- [ ] ⏳ Windows deploy script (manual test needed)

### Error Handling
- [ ] ✅ No Runner available
- [ ] ✅ Runner disconnect during job
- [ ] ✅ Invalid API Key
- [ ] ⏳ Network interruption recovery

---

## 🐛 COMMON ISSUES & SOLUTIONS

### Issue: "Connection Refused"
**Cause**: Backend not running atau wrong host
**Solution**: 
```bash
# Check Backend running
curl -k https://localhost:3000/health

# Check Runner .env
cat .env | grep BE_HOST
```

### Issue: "Authentication Failed"
**Cause**: RUNNER_API_KEY tidak match
**Solution**:
```bash
# Backend
cat backend-v13/.env | grep RUNNER_API_KEY

# Runner
cat trafficbuster-runner/.env | grep RUNNER_API_KEY

# Must be identical!
```

### Issue: "Playwright launch failed"
**Cause**: Missing dependencies
**Solution**:
```bash
cd /app/trafficbuster-runner
npx playwright install --with-deps
```

### Issue: "No available runners online"
**Cause**: No Runner connected atau semua busy
**Solution**:
```bash
# Check runners status
curl -k -H "Authorization: Bearer $TOKEN" \
  https://localhost:3000/api/v1/runners/status

# Start more Runners if needed
```

---

## 📝 TEST REPORT TEMPLATE

```markdown
## Test Report - [Date]

### Environment
- Backend Version: v13
- Runner Version: 1.0.0
- OS: Linux/Windows/macOS
- Node Version: 20.x

### Tests Executed
- [x] Backend Standalone - PASS
- [x] Runner Connection - PASS
- [x] Platform API - PASS
- [x] Job Dispatch - PASS
- [x] Human Behavior - PASS
- [ ] Multi-Runner - PENDING
- [ ] Deploy Scripts - PENDING

### Issues Found
1. [Issue description]
   - Severity: High/Medium/Low
   - Status: Open/Fixed

### Recommendations
- [Recommendation]

### Conclusion
System is READY / NOT READY for production.
```

---

**Testing Status**: 🟢 Core functionality verified  
**Next**: Manual E2E testing with production-like setup
