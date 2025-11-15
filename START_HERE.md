# 🚀 QuantumTraffic Engine - Quick Start Guide

## ⚡ INSTANT SETUP (3 Commands)

```bash
# 1. Run complete setup (fixes all dependencies)
sudo bash /app/FINAL_SETUP.sh

# 2. Start all services
sudo bash /app/start-all.sh

# 3. Check status
sudo bash /app/check-status.sh
```

**That's it!** Backend will be running on port 5252.

---

## 📊 Verify Everything Works

```bash
# Check if backend is running
curl -k https://localhost:5252/health

# Should return: {"status":"ok"}
```

---

## 🌐 Access URLs

- **Backend API**: `https://trafficbuster.my.id:5252`
- **Admin Panel**: `https://trafficbuster.my.id:5353` (optional)
- **Runner WebSocket**: `wss://trafficbuster.my.id:5252/ws/runner`

---

## 📝 View Logs

```bash
# Backend logs (real-time)
tail -f /app/logs/backend.log

# Admin panel logs (real-time)
tail -f /app/logs/admin.log

# Last 50 lines
tail -50 /app/logs/backend.log
```

---

## 🛑 Stop Services

```bash
sudo bash /app/stop-all.sh
```

---

## 🔄 Restart Services

```bash
# Stop first
sudo bash /app/stop-all.sh

# Wait 2 seconds
sleep 2

# Start again
sudo bash /app/start-all.sh
```

---

## 🧪 Test Frontend Connection

1. Open Electron Frontend App
2. Login dengan credentials Anda
3. Backend harus connect ke `https://trafficbuster.my.id:5252`
4. WebSocket harus connect tanpa error 1006

---

## 🏃 Deploy Runners

Setelah Backend running:

**Linux Runner:**
```bash
curl -fsSL https://trafficbuster.my.id:5252/api/v1/runner/deploy/linux | bash
cd ~/quantumtraffic-runner
nano .env  # Edit RUNNER_API_KEY
npm start
```

**Windows Runner:**
```powershell
iwr -useb https://trafficbuster.my.id:5252/api/v1/runner/deploy/windows | iex
cd ~\quantumtraffic-runner
notepad .env  # Edit RUNNER_API_KEY
npm start
```

---

## ⚙️ Configuration Files

**Backend**: `/app/backend-v13/.env`
```env
PORT=5252
CERT_PATH=/app/backend-v13/cert.pem
KEY_PATH=/app/backend-v13/key.pem
JWT_SECRET=quantum-ultra-secure-jwt-secret-production-2025
RUNNER_API_KEY=quantum-runner-secure-key-production-2025
```

**Admin Panel**: `/app/admin-panel/.env.local`
```env
PORT=5353
CERT_PATH=/app/backend-v13/cert.pem
KEY_PATH=/app/backend-v13/key.pem
```

---

## 🐛 Troubleshooting

### Backend Won't Start

```bash
# Check logs
tail -50 /app/logs/backend.log

# Reinstall dependencies
cd /app/backend-v13
npm install

# Try starting manually
cd /app/backend-v13
node server.js
```

### Frontend Cannot Connect (Error 1006)

```bash
# 1. Check backend is running
curl -k https://localhost:5252/health

# 2. Check port is open
sudo lsof -i :5252

# 3. Check firewall
sudo ufw allow 5252/tcp

# 4. Restart backend
sudo bash /app/stop-all.sh
sudo bash /app/start-all.sh
```

### "Module not found" Error

```bash
# Run setup script again
sudo bash /app/FINAL_SETUP.sh

# This will install all missing dependencies
```

---

## 📚 Additional Documentation

- **Complete Guide**: `/app/PRODUCTION_GUIDE.md`
- **Implementation Details**: `/app/IMPLEMENTATION_SUMMARY.md`
- **Migration Guide**: `/app/MIGRATION_TO_QUANTUM.md`

---

## 🔐 Security Notes

**Default Credentials:**
- JWT_SECRET: `quantum-ultra-secure-jwt-secret-production-2025`
- RUNNER_API_KEY: `quantum-runner-secure-key-production-2025`

**⚠️ IMPORTANT**: Change these in production!

Edit `/app/backend-v13/.env`:
```bash
nano /app/backend-v13/.env
# Change JWT_SECRET and RUNNER_API_KEY
# Then restart: sudo bash /app/stop-all.sh && sudo bash /app/start-all.sh
```

---

## ✅ Quick Health Check

```bash
# Run this to verify everything
sudo bash /app/check-status.sh
```

Expected output:
```
✅ Backend (Port 5252): Running
✅ Admin Panel (Port 5353): Running
✅ SSL Certificates: Valid
```

---

## 🆘 If Nothing Works

1. **Full Reset:**
```bash
sudo bash /app/stop-all.sh
sudo bash /app/FINAL_SETUP.sh
sudo bash /app/start-all.sh
```

2. **Check System Resources:**
```bash
df -h          # Disk space
free -m        # Memory
top            # CPU
```

3. **Collect Logs:**
```bash
tar -czf ~/quantum-debug-$(date +%Y%m%d).tar.gz /app/logs/
```

---

## 📞 Quick Commands Reference

| Command | Purpose |
|---------|---------|
| `sudo bash /app/FINAL_SETUP.sh` | One-time setup |
| `sudo bash /app/start-all.sh` | Start services |
| `sudo bash /app/stop-all.sh` | Stop services |
| `sudo bash /app/check-status.sh` | Check status |
| `tail -f /app/logs/backend.log` | View backend logs |
| `curl -k https://localhost:5252/health` | Test backend |

---

**🎉 Backend is Production Ready!**

Just run: `sudo bash /app/FINAL_SETUP.sh && sudo bash /app/start-all.sh`
