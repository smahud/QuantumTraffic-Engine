# TrafficBuster - Distributed 3-Tier Architecture

Proyek ini telah direfactor dari arsitektur **Monolithic** menjadi **Distributed 3-Tier**.

## 🏗️ Arsitektur Baru

```
┌─────────────┐         ┌──────────────────┐         ┌──────────────────┐
│  Frontend   │ ◄────── │  Backend         │ ◄────── │  Runner(s)       │
│  (Electron) │  HTTP   │  (Orchestrator)  │   WSS   │  (Playwright)    │
│             │  WSS    │                  │         │                  │
└─────────────┘         └──────────────────┘         └──────────────────┘
     UI/Control           Hub Pusat                    Executor Pool
```

### Komponen:

1. **Frontend (Electron)** - `/app/traffic-buster-frontend/`
   - UI/Remote control
   - Tidak berubah dari versi sebelumnya
   
2. **Backend-Orchestrator** - `/app/backend-v13/`
   - Hub pusat yang mengelola:
     - User authentication & sessions
     - Dataset management (Targets, Proxies, Platforms)
     - Job management & scheduling
     - **Runner pool management** (BARU)
     - **Smart job dispatcher** (BARU)
   - **TIDAK** menjalankan Playwright
   - Menerima progress dari Runner dan meneruskan ke Frontend

3. **Runner** - `/app/trafficbuster-runner/`
   - Aplikasi Node.js standalone
   - Dapat di-deploy di mesin terpisah (Windows/Linux/macOS)
   - Menjalankan Playwright dengan human behavior simulation
   - Auto-register ke Backend via WebSocket
   - Menerima job dari Backend dan kirim progress real-time

## 📦 Struktur Folder

```
/app/
├── backend-v13/              # Backend-Orchestrator
│   ├── lib/
│   │   ├── runnerManager.js  # 🆕 Pool management
│   │   ├── jobManager.js     # ✏️ Refactored (delegator)
│   │   └── ...
│   ├── websocket.js          # ✏️ Updated (Runner WSS endpoint)
│   ├── app.js                # ✏️ Updated (Runner APIs)
│   └── ...
│
├── trafficbuster-runner/     # 🆕 Runner Application
│   ├── runner.js             # Main runner app
│   ├── package.json          
│   ├── .env.example
│   └── README.md
│
├── traffic-buster-frontend/  # Frontend (Electron)
│   └── ...
│
└── deploy/                    # 🆕 Deploy Scripts
    ├── setup-runner.sh       # Linux auto-install
    └── setup-runner.ps1      # Windows auto-install
```

## 🚀 Quick Start

### 1. Setup Backend-Orchestrator

```bash
cd /app/backend-v13

# Install dependencies (Playwright sudah dihapus!)
npm install

# Setup environment
cat > .env << EOF
PORT=3000
JWT_SECRET=your-jwt-secret-here
RUNNER_API_KEY=secure-runner-key-CHANGE-ME
ALLOWED_ORIGINS=http://localhost:5151
EOF

# Start backend
npm start
```

Backend akan listen di:
- Port 3000 (HTTP/API)
- `/ws` - User WebSocket
- `/ws/runner` - Runner WebSocket

### 2. Setup Runner(s)

#### Option A: Auto-install (Recommended)

**Linux:**
```bash
curl -fsSL http://localhost:3000/api/v1/runner/deploy/linux | bash
```

**Windows (PowerShell as Admin):**
```powershell
iwr -useb http://localhost:3000/api/v1/runner/deploy/windows | iex
```

#### Option B: Manual Setup

```bash
cd /app/trafficbuster-runner

# Install dependencies
npm install
npx playwright install --with-deps

# Setup .env
cat > .env << EOF
BE_HOST=localhost:3000
RUNNER_API_KEY=secure-runner-key-CHANGE-ME
RUNNER_OS=linux
RUNNER_BROWSER=chrome
HEADLESS=true
EOF

# Start runner
npm start
```

### 3. Setup Frontend (Electron)

```bash
cd /app/traffic-buster-frontend

npm install
npm start
```

## 🔧 Konfigurasi

### Backend Environment Variables

```env
PORT=3000                          # Backend port
JWT_SECRET=secret                  # JWT signing key
RUNNER_API_KEY=key                 # Runner authentication key
ALLOWED_ORIGINS=http://localhost   # CORS origins
BODY_LIMIT=32kb                    # Request body limit
JWT_EXP=8h                         # JWT expiration
```

### Runner Environment Variables

```env
BE_HOST=localhost:3000             # Backend host:port
RUNNER_API_KEY=key                 # Must match backend
RUNNER_OS=windows                  # windows|linux|macos
RUNNER_BROWSER=chrome              # chrome|firefox|safari
HEADLESS=true                      # true|false
```

## 📡 API Endpoints (New)

### Runner Management

**GET /api/v1/runners/available-platforms** (Authenticated)
- Returns platforms available from online runners
- Frontend uses this to show only executable platforms

**GET /api/v1/runners/status** (Admin only)
- Returns all runners status and info

### Deploy Scripts

**GET /api/v1/runner/deploy/linux** (Public)
- Returns Linux setup script

**GET /api/v1/runner/deploy/windows** (Public)
- Returns Windows setup script

## 🔄 Job Flow (New Architecture)

```
1. User starts job dari Frontend
   ↓
2. Frontend kirim job config ke Backend (/api/v1/run/start)
   ↓
3. Backend (jobManager) cari Runner yang sesuai platform
   ↓
4. Backend dispatch job ke Runner via WebSocket
   ↓
5. Runner eksekusi Playwright flows dengan human behavior
   ↓
6. Runner kirim progress updates ke Backend
   ↓
7. Backend forward progress ke Frontend
   ↓
8. Runner kirim job complete ke Backend
   ↓
9. Backend update job status dan notify Frontend
```

## 🎯 Key Changes Summary

### Backend (Orchestrator)

✅ **REMOVED:**
- Playwright dependency
- `playwrightEngine.js` (deprecated)
- `flowWorker.js` (deprecated)
- Direct Playwright execution

✅ **ADDED:**
- `lib/runnerManager.js` - Runner pool management
- Runner WebSocket endpoint (`/ws/runner`)
- Runner API endpoints
- Smart job dispatcher

✅ **MODIFIED:**
- `lib/jobManager.js` - Now delegates to Runner
- `websocket.js` - Handles Runner connections
- `app.js` - New Runner endpoints

### Runner (New Component)

✅ **CREATED:**
- Standalone Node.js application
- Auto-registers to Backend
- Playwright execution engine
- Human behavior simulation
- Real-time progress reporting
- Automatic reconnection

### Deploy Scripts (New)

✅ **CREATED:**
- `setup-runner.sh` - Linux auto-installer
  - Supports Debian/Ubuntu/RedHat
  - Installs Xvfb for headful without DE
  - Installs all Playwright dependencies
  
- `setup-runner.ps1` - Windows auto-installer
  - Installs Chocolatey, Node.js, Git
  - Installs Playwright browsers
  - Creates start scripts

## 🧪 Testing

### Test Backend-Orchestrator

```bash
cd /app/backend-v13
npm start
```

Check logs: Backend should start without Playwright errors.

### Test Runner Connection

```bash
cd /app/trafficbuster-runner
npm start
```

Expected logs:
```
[INFO] Connecting to Backend: localhost:3000
[INFO] ✅ Connected to Backend-Orchestrator
[INFO] ✅ Registered as runner: runner_xxxxx
```

### Test Job Execution

1. Start Frontend
2. Login
3. Create a job
4. Check logs:
   - Backend: "Job dispatched to runner runner_xxxxx"
   - Runner: "📥 Received new job: job_xxxxx"
   - Runner: "Starting job job_xxxxx"

## 🐛 Troubleshooting

### Backend: "No available runners online"

- Pastikan minimal 1 Runner sudah connect
- Check Runner logs untuk connection errors
- Verify RUNNER_API_KEY match

### Runner: "Connection Refused"

- Pastikan Backend sudah running
- Check BE_HOST di Runner .env
- Check firewall rules

### Runner: "Authentication Failed"

- Verify RUNNER_API_KEY match dengan Backend
- Check Runner logs untuk detail error

### Platform tidak muncul di Frontend

- Pastikan Runner dengan OS yang sesuai sudah online
- Call API `/api/v1/runners/available-platforms` untuk debug
- Check `data/fingerprints.json` di Backend

## 📝 Migration Notes

Jika upgrade dari versi lama:

1. ✅ Backend sudah tidak butuh Playwright - lebih ringan!
2. ✅ Job execution sekarang distributed - bisa scale horizontal
3. ✅ Frontend tetap compatible - no changes needed
4. ⚠️ Harus setup minimal 1 Runner untuk eksekusi job
5. ⚠️ Platform dinamis - hanya tampil jika Runner online

## 🔐 Security Notes

- Runner API Key harus secure dan match
- Runner connections authenticated via API Key
- WebSocket connections isolated (User vs Runner)
- Deploy scripts bisa di-protect dengan auth jika perlu

## 🎉 Benefits

1. **Scalability**: Tambah Runner untuk increase capacity
2. **Flexibility**: Runner bisa Windows/Linux/macOS
3. **Reliability**: Backend lebih stabil tanpa Playwright
4. **Performance**: Backend lebih ringan
5. **Maintenance**: Easier to update Runner vs Backend

## 📚 Next Steps

1. Deploy Backend ke production server
2. Deploy Runner di multiple machines (Windows/Linux)
3. Update Frontend untuk dynamic platform selection (FE-1)
4. Implement Runner health monitoring
5. Add Runner auto-scaling logic

---

**Refactor Status: ✅ COMPLETE**

- ✅ BE-1: Remove Playwright from Backend
- ✅ BE-2: Create runnerManager.js
- ✅ BE-3: Runner WebSocket endpoint
- ✅ BE-4: Refactor jobManager.js
- ✅ BE-5: Progress forwarding (integrated in BE-3)
- ✅ BE-6: Deprecate playwrightEngine.js
- ✅ R-1: Create Runner project
- ✅ R-2: Create runner.js
- ✅ R-3: Job listener implementation
- ✅ R-4: Human behavior logic
- ✅ D-1: Deploy API endpoints
- ✅ D-2: Linux setup script
- ✅ D-3: Windows setup script
