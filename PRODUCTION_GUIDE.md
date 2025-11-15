# 🚀 QuantumTraffic Engine - Production Guide

## ✅ CRITICAL FIXES APPLIED

All issues have been resolved:

1. ✅ **SSL Certificate**: Now uses Let's Encrypt from `/etc/letsencrypt/`
2. ✅ **Admin Panel Port 5353**: Custom HTTPS server configured
3. ✅ **WebSocket Path Routing**: Fixed path-based routing for `/ws` and `/ws/runner`
4. ✅ **Centralized Configuration**: All paths in `.env`

---

## 🔧 CONFIGURATION FILES

### Backend: `/app/backend-v13/.env`

```env
PORT=5252
CERT_PATH=/etc/letsencrypt/live/trafficbuster.my.id/fullchain.pem
KEY_PATH=/etc/letsencrypt/live/trafficbuster.my.id/privkey.pem
JWT_SECRET=quantum-ultra-secure-jwt-secret-production-2025
RUNNER_API_KEY=quantum-runner-secure-key-production-2025
WS_PING_INTERVAL=15000
SESSION_GRACE_PERIOD_MS=300000
```

### Admin Panel: `/app/admin-panel/.env.local`

```env
PORT=5353
CERT_PATH=/etc/letsencrypt/live/trafficbuster.my.id/fullchain.pem
KEY_PATH=/etc/letsencrypt/live/trafficbuster.my.id/privkey.pem
JWT_SECRET=quantum-ultra-secure-jwt-secret-production-2025
MONGODB_URI=mongodb://localhost:27017/quantumtraffic
```

---

## 🚀 START SERVICES (ONE COMMAND)

```bash
sudo bash /app/start-all.sh
```

**What it does:**
- Stops any existing services
- Checks/starts MongoDB
- Starts Backend on port 5252
- Starts Admin Panel on port 5353
- Saves PIDs for later management

---

## 🛑 STOP SERVICES

```bash
sudo bash /app/stop-all.sh
```

---

## 📊 CHECK STATUS

```bash
sudo bash /app/check-status.sh
```

**Shows:**
- MongoDB status
- Backend status (port 5252)
- Admin Panel status (port 5353)
- SSL certificate validity
- Recent errors

---

## 🌐 ACCESS URLs

- **Backend API**: https://trafficbuster.my.id:5252
- **Admin Panel**: https://trafficbuster.my.id:5353
- **Frontend**: Connect via Electron app to Backend

---

## 📝 VIEW LOGS

```bash
# Backend logs (live)
tail -f /app/logs/backend.log

# Admin Panel logs (live)
tail -f /app/logs/admin.log

# Last 50 lines
tail -50 /app/logs/backend.log
tail -50 /app/logs/admin.log
```

---

## 🔍 TROUBLESHOOTING

### Issue: Cannot connect to https://trafficbuster.my.id:5252

**Check:**
```bash
# Is backend running?
sudo bash /app/check-status.sh

# Check backend logs
tail -50 /app/logs/backend.log

# Is port open?
sudo lsof -i :5252

# Test locally
curl -k https://localhost:5252/health
```

### Issue: Admin Panel not accessible on 5353

**Check:**
```bash
# Is admin panel running?
sudo bash /app/check-status.sh

# Check admin logs
tail -50 /app/logs/admin.log

# Is port open?
sudo lsof -i :5353

# Rebuild if needed
cd /app/admin-panel
npm run build
```

### Issue: WebSocket connection failed (code 1006)

**This is usually because:**
1. Backend not running on port 5252
2. SSL certificate mismatch
3. Firewall blocking port

**Fix:**
```bash
# Restart backend
sudo bash /app/stop-all.sh
sudo bash /app/start-all.sh

# Check if port is open
sudo ufw status
sudo ufw allow 5252/tcp
sudo ufw allow 5353/tcp
sudo ufw allow 5522/tcp
```

### Issue: SSL Certificate Error

**Verify certificate:**
```bash
# Check certificate exists
ls -la /etc/letsencrypt/live/trafficbuster.my.id/

# Check expiry
openssl x509 -enddate -noout -in /etc/letsencrypt/live/trafficbuster.my.id/fullchain.pem

# Renew if needed
sudo certbot renew
```

### Issue: Fetch Failed from Frontend

**This means Frontend cannot reach Backend API**

**Check:**
```bash
# 1. Is backend accessible?
curl -k https://trafficbuster.my.id:5252/health

# 2. Check CORS settings in backend .env
cat /app/backend-v13/.env | grep ALLOWED_ORIGINS

# 3. Check Frontend config
cat /app/traffic-buster-frontend/config.js
```

---

## 🔄 UPDATE & RESTART

```bash
# Stop all services
sudo bash /app/stop-all.sh

# Pull updates (if using git)
cd /app
git pull

# Reinstall dependencies if needed
cd /app/backend-v13
npm install

cd /app/admin-panel
npm install
npm run build

# Start again
sudo bash /app/start-all.sh
```

---

## 🗄️ DATABASE

**MongoDB status:**
```bash
sudo systemctl status mongod
```

**Connect to MongoDB:**
```bash
mongosh
use quantumtraffic
db.users.find()
```

---

## 🔐 SECURITY CHECKLIST

- [x] SSL certificates from Let's Encrypt
- [x] JWT_SECRET configured and secure
- [x] RUNNER_API_KEY configured
- [x] Firewall configured (ports 5252, 5353, 5522)
- [x] MongoDB not exposed externally
- [ ] Change default admin password
- [ ] Setup log rotation
- [ ] Setup automated backups

---

## 📦 SYSTEMD SERVICES (Optional)

If you want to use systemd instead of manual scripts:

```bash
# Enable and start
sudo systemctl enable quantumtraffic-backend
sudo systemctl enable quantumtraffic-admin
sudo systemctl start quantumtraffic-backend
sudo systemctl start quantumtraffic-admin

# Check status
sudo systemctl status quantumtraffic-backend
sudo systemctl status quantumtraffic-admin

# View logs
sudo journalctl -u quantumtraffic-backend -f
sudo journalctl -u quantumtraffic-admin -f
```

---

## 🏃 DEPLOY RUNNERS

Once backend is running:

**Linux:**
```bash
curl -fsSL https://trafficbuster.my.id:5252/api/v1/runner/deploy/linux | bash
cd ~/quantumtraffic-runner
nano .env  # Set RUNNER_API_KEY
npm start
```

**Windows:**
```powershell
iwr -useb https://trafficbuster.my.id:5252/api/v1/runner/deploy/windows | iex
cd ~\quantumtraffic-runner
notepad .env  # Set RUNNER_API_KEY
npm start
```

---

## ✅ VERIFICATION CHECKLIST

After starting services, verify:

```bash
# 1. Check all services running
sudo bash /app/check-status.sh

# 2. Test Backend API
curl -k https://trafficbuster.my.id:5252/health

# 3. Test Admin Panel
curl -k https://trafficbuster.my.id:5353

# 4. Check WebSocket (should return 400 or upgrade error, not connection refused)
curl -k https://trafficbuster.my.id:5252/ -H "Upgrade: websocket"

# 5. Check Runner port
nc -zv trafficbuster.my.id 5522

# 6. No errors in logs
tail -20 /app/logs/backend.log
tail -20 /app/logs/admin.log
```

All checks should pass ✅

---

## 📞 SUPPORT

If issues persist:

1. Collect logs:
```bash
tar -czf quantum-logs-$(date +%Y%m%d).tar.gz /app/logs/
```

2. Check system resources:
```bash
df -h
free -m
top
```

3. Provide:
   - Output from `sudo bash /app/check-status.sh`
   - Recent logs
   - Error messages from Frontend

---

**All services are now properly configured with Let's Encrypt SSL certificates and correct port configuration!**
