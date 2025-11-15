# 🚀 Migration to QuantumTraffic Engine

## Rebranding & Configuration Centralization

### Changes:
1. **Project Name**: TrafficBuster → **QuantumTraffic Engine**
2. **Domain**: trafficbuster.my.id:5252
3. **GitHub**: https://github.com/smahud/QuantumTraffic-Engine
4. **Centralized Config**: All ports/certificates in BE .env

### Port Standardization:
- Backend: **5252** (HTTPS)
- Frontend: **5252** (connects to backend)
- Admin Panel: **5353** (HTTPS)
- Runner: **5522** (WebSocket to BE)

### Critical Fixes Applied:
1. ✅ WebSocket stability (heartbeat optimized)
2. ✅ Session timeout increased
3. ✅ Auto-reconnect improved
4. ✅ Central configuration in BE
5. ✅ Certificate paths centralized
6. ✅ Deploy scripts fixed
7. ✅ BE auto-deploy script created

## Migration Steps:

### 1. Update Backend Configuration
```bash
cd /app/backend-v13
cp .env.example .env.production

# Edit .env.production with:
# - All ports
# - Certificate paths
# - Domain configuration
# - Runner API keys
```

### 2. Deploy Backend (One Command)
```bash
cd /app
bash deploy/setup-backend.sh
```

### 3. Deploy Runners
```bash
# Linux
curl -fsSL https://trafficbuster.my.id:5252/api/v1/runner/deploy/linux | bash

# Windows
iwr -useb https://trafficbuster.my.id:5252/api/v1/runner/deploy/windows | iex
```

### 4. Start Admin Panel
```bash
cd /app/admin-panel
npm run build
npm start
```

## Configuration Reference:

See `/app/backend-v13/.env.production.example` for complete configuration.
