# 📝 QuantumTraffic Engine - Environment Configuration Guide

## 🎯 Centralized Configuration

**ALL global settings are in ONE file**: `/app/backend-v13/.env`

Both Backend and Admin Panel read from this central configuration file.

---

## 📁 File Structure

```
/app/backend-v13/.env              # ⭐ MAIN CONFIG (all global variables)
/app/admin-panel/.env.local        # Local overrides only (optional)
/app/trafficbuster-runner/.env     # Runner-specific config
```

---

## ⚙️ Main Configuration: `/app/backend-v13/.env`

### Server Configuration
```env
NODE_ENV=production
DOMAIN=trafficbuster.my.id
HOSTNAME=trafficbuster.my.id
```

### Port Configuration (All Centralized)
```env
PORT=5252                    # Backend API port
BACKEND_PORT=5252            # Same as PORT
FRONTEND_PORT=5252           # Frontend connects here
ADMIN_PANEL_PORT=5353        # Admin panel HTTPS port
RUNNER_PORT=5522             # Runner WebSocket port
```

### SSL Certificates (with Fallback)
```env
# Primary (Let's Encrypt)
CERT_PATH=/etc/letsencrypt/live/trafficbuster.my.id/fullchain.pem
KEY_PATH=/etc/letsencrypt/live/trafficbuster.my.id/privkey.pem

# Fallback (Self-signed)
FALLBACK_CERT_PATH=/app/backend-v13/cert.pem
FALLBACK_KEY_PATH=/app/backend-v13/key.pem
```

**How it works:**
- System tries primary certificates first
- If not found, automatically uses fallback
- No manual switching needed

### Security Keys
```env
JWT_SECRET=quantum-ultra-secure-jwt-secret-production-2025
RUNNER_API_KEY=quantum-runner-secure-key-production-2025
ADMIN_API_KEY=quantum-admin-api-key-production-2025
JWT_EXP=24h
```

### WebSocket Configuration
```env
WS_USER_PATH=/ws              # Frontend WebSocket
WS_RUNNER_PATH=/ws/runner     # Runner WebSocket
WS_PING_INTERVAL=15000        # 15 seconds
WS_PING_TIMEOUT=60000         # 60 seconds
WS_HEARTBEAT_INTERVAL=15000   # 15 seconds

# Session
SESSION_GRACE_PERIOD_MS=300000      # 5 minutes
SESSION_CLEAN_INTERVAL_MS=120000    # 2 minutes

# Runner
RUNNER_HEARTBEAT_INTERVAL=30000     # 30 seconds
RUNNER_TIMEOUT=120000               # 2 minutes
```

### CORS & Origins
```env
ALLOWED_ORIGINS=https://trafficbuster.my.id:5252,https://trafficbuster.my.id:5353,https://localhost:5252,https://localhost:5353
```

### Database
```env
MONGODB_URI=mongodb://localhost:27017/quantumtraffic
MONGODB_HOST=localhost
MONGODB_PORT=27017
MONGODB_DB=quantumtraffic
```

### Paths & Directories
```env
APP_ROOT=/app
BACKEND_DIR=/app/backend-v13
ADMIN_DIR=/app/admin-panel
RUNNER_DIR=/app/trafficbuster-runner
LOGS_DIR=/app/logs
BACKUP_DIR=/app/backups
CERT_DIR=/app/certificates
```

### Logging
```env
LOG_LEVEL=info
LOG_FILE=/app/logs/backend.log
ADMIN_LOG_FILE=/app/logs/admin.log
VERBOSE_LOGGING=false
DEBUG=false
```

---

## 🔧 How Services Load Configuration

### Backend (`/app/backend-v13/server.js`)
```javascript
require('dotenv').config();  // Loads from .env in same directory
```

### Admin Panel (`/app/admin-panel/server.js`)
```javascript
// Load centralized config first
require('dotenv').config({ path: '/app/backend-v13/.env' });
// Then load local overrides if any
require('dotenv').config({ path: '.env.local' });
```

### Runner (`/app/trafficbuster-runner/runner.js`)
```javascript
require('dotenv').config();  // Loads from its own .env
```

---

## 🎛️ Override Strategy

**Priority order (highest to lowest):**
1. Local `.env.local` in admin-panel (if exists)
2. Central `/app/backend-v13/.env` (main config)
3. Environment variables set in system
4. Default values in code

**Example:**
If `ADMIN_PANEL_PORT` is set in both files:
- Admin panel uses value from `.env.local` first
- Falls back to `/app/backend-v13/.env` if not in local
- Falls back to default 5353 if not in either

---

## 📝 Updating Configuration

### Method 1: Edit Main Config (Recommended)
```bash
# Edit centralized config
nano /app/backend-v13/.env

# Restart services
sudo bash /app/stop-all.sh
sudo bash /app/start-all.sh
```

### Method 2: Edit Specific Service
```bash
# For admin-panel specific override
nano /app/admin-panel/.env.local

# Restart only admin panel
pkill -f "admin-panel"
cd /app/admin-panel && npm run dev &
```

---

## 🔐 Security Best Practices

### 1. Change Default Keys
```bash
# Generate new JWT secret
JWT_SECRET=$(openssl rand -base64 32)

# Generate new runner API key
RUNNER_API_KEY=$(openssl rand -base64 32)

# Update in .env
nano /app/backend-v13/.env
```

### 2. Restrict CORS
```env
# Production: Only allow specific domains
ALLOWED_ORIGINS=https://trafficbuster.my.id:5252,https://trafficbuster.my.id:5353

# Development: Can include localhost
ALLOWED_ORIGINS=https://trafficbuster.my.id:5252,https://localhost:5252
```

### 3. Use Let's Encrypt
```bash
# Install certbot
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d trafficbuster.my.id

# Update .env to point to Let's Encrypt
CERT_PATH=/etc/letsencrypt/live/trafficbuster.my.id/fullchain.pem
KEY_PATH=/etc/letsencrypt/live/trafficbuster.my.id/privkey.pem
```

---

## 🧪 Testing Configuration

### Verify Backend Loads Config
```bash
cd /app/backend-v13
node -e "require('dotenv').config(); console.log('PORT:', process.env.PORT)"
# Should output: PORT: 5252
```

### Verify Admin Panel Loads Config
```bash
cd /app/admin-panel
node -e "require('dotenv').config({path:'/app/backend-v13/.env'}); console.log('ADMIN_PANEL_PORT:', process.env.ADMIN_PANEL_PORT)"
# Should output: ADMIN_PANEL_PORT: 5353
```

### Check All Environment Variables
```bash
# Show all configured variables
cat /app/backend-v13/.env | grep -v '^#' | grep -v '^$'
```

---

## 📋 Configuration Checklist

After editing `.env`, verify:

- [ ] All ports configured correctly
- [ ] SSL certificate paths valid
- [ ] JWT_SECRET is secure (32+ characters)
- [ ] RUNNER_API_KEY is secure (32+ characters)
- [ ] CORS origins include your domain
- [ ] MongoDB URI is correct
- [ ] Log paths exist
- [ ] Restart services after changes

---

## 🆘 Troubleshooting

### Issue: Service not loading config

**Solution:**
```bash
# Check .env file exists
ls -la /app/backend-v13/.env

# Check file permissions
chmod 644 /app/backend-v13/.env

# Check dotenv is installed
cd /app/backend-v13 && npm list dotenv
cd /app/admin-panel && npm list dotenv
```

### Issue: Wrong port being used

**Solution:**
```bash
# Check what's in .env
grep PORT /app/backend-v13/.env

# Check if environment variable overrides it
echo $PORT

# Unset environment variable if needed
unset PORT
```

### Issue: Certificate not found

**Solution:**
```bash
# Check primary cert path
ls -la /etc/letsencrypt/live/trafficbuster.my.id/

# Check fallback cert path
ls -la /app/backend-v13/*.pem

# Generate fallback if missing
cd /app/backend-v13
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

---

## 📚 Quick Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 5252 | Backend API port |
| `ADMIN_PANEL_PORT` | 5353 | Admin panel port |
| `RUNNER_PORT` | 5522 | Runner WebSocket port |
| `CERT_PATH` | Let's Encrypt path | SSL certificate |
| `JWT_SECRET` | (generated) | JWT signing key |
| `RUNNER_API_KEY` | (generated) | Runner auth key |
| `MONGODB_URI` | mongodb://localhost:27017/quantumtraffic | Database |

---

**Remember**: Edit `/app/backend-v13/.env` for global changes!
