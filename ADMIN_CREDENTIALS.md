# 🔐 QuantumTraffic Engine - Admin Panel Credentials

## Default Admin Login

**Access URL**: https://trafficbuster.my.id:5353

### Default Credentials:
```
Username: admin
Password: quantum2025
```

---

## ⚠️ IMPORTANT SECURITY NOTICE

**CHANGE THE DEFAULT PASSWORD IMMEDIATELY IN PRODUCTION!**

---

## How to Change Admin Password

### Method 1: Edit the API Route (Recommended for Production)

1. Edit the login API file:
```bash
nano /app/admin-panel/src/app/api/auth/login/route.ts
```

2. Change the password:
```typescript
const DEFAULT_ADMIN = {
  username: 'admin',
  password: 'YOUR_SECURE_PASSWORD_HERE',  // Change this!
}
```

3. Rebuild admin panel:
```bash
cd /app/admin-panel
npm run build
bash /app/simple-admin-start.sh
```

### Method 2: Use Environment Variable (Better for Production)

1. Add to `/app/backend-v13/.env`:
```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password-here
```

2. Update the API route to read from env:
```typescript
const DEFAULT_ADMIN = {
  username: process.env.ADMIN_USERNAME || 'admin',
  password: process.env.ADMIN_PASSWORD || 'quantum2025',
}
```

---

## Admin Panel Features

Currently available:
- ✅ Login/Logout
- ✅ Dashboard overview
- ✅ System status display
- ✅ Backend connection info
- ⏳ Runner management (coming soon)
- ⏳ User management (coming soon)
- ⏳ License management (coming soon)

---

## Accessing Admin Panel

### 1. Start Admin Panel
```bash
sudo bash /app/simple-admin-start.sh
```

### 2. Open Browser
Navigate to: `https://trafficbuster.my.id:5353`

### 3. Login
- Username: `admin`
- Password: `quantum2025`

### 4. After Login
You'll see the dashboard with:
- Backend status
- Runner count (currently 0)
- Active jobs count
- System information
- Quick action buttons

---

## Troubleshooting Login Issues

### Issue: "Invalid username or password"
**Solution**: 
- Make sure you're using correct credentials: `admin` / `quantum2025`
- Check caps lock is off
- Clear browser cache and cookies

### Issue: "Network error"
**Solution**:
```bash
# Check admin panel is running
lsof -i :5353

# Check logs
tail -50 /app/logs/admin.log

# Restart admin panel
bash /app/simple-admin-start.sh
```

### Issue: "Cannot connect to admin panel"
**Solution**:
```bash
# Check backend is running first
curl -k https://localhost:5252/health

# Start everything
sudo bash /app/start-all.sh

# Wait 10 seconds then try again
```

---

## Security Best Practices

### 1. Change Default Password
```bash
# Edit password in code
nano /app/admin-panel/src/app/api/auth/login/route.ts

# Or use environment variable
echo "ADMIN_PASSWORD=MySecurePass123!" >> /app/backend-v13/.env
```

### 2. Use Strong Password
- Minimum 12 characters
- Mix of uppercase, lowercase, numbers, symbols
- Not a dictionary word
- Unique password (not reused)

### 3. Limit Access
- Use firewall to restrict admin panel access
- Only allow specific IP addresses if possible
```bash
# Allow only from specific IP
sudo ufw allow from YOUR_IP_ADDRESS to any port 5353
```

### 4. Enable HTTPS Only
- Already configured with SSL certificates
- Never access over plain HTTP

### 5. Monitor Login Attempts
```bash
# Check admin panel logs for failed logins
grep -i "invalid\|failed" /app/logs/admin.log
```

---

## JWT Token Configuration

Admin panel uses JWT tokens for session management.

**Token Expiration**: 24 hours (default)

**JWT Secret**: Configured in `/app/backend-v13/.env`
```env
JWT_SECRET=quantum-ultra-secure-jwt-secret-production-2025
```

**To change JWT secret**:
```bash
# Generate new secret
NEW_SECRET=$(openssl rand -base64 32)

# Update .env
echo "JWT_SECRET=$NEW_SECRET" >> /app/backend-v13/.env

# Rebuild admin panel
cd /app/admin-panel
npm run build
bash /app/simple-admin-start.sh
```

---

## Session Management

- **Token stored in**: `localStorage` (browser)
- **Token lifetime**: 24 hours
- **Auto-logout**: On token expiration
- **Logout**: Removes token from localStorage

### Manual Logout via Browser Console
```javascript
localStorage.removeItem('admin_token')
window.location.href = '/login'
```

---

## Adding More Admin Users (Future Enhancement)

Current version supports single admin user. To add multiple users:

1. Create users database/file
2. Update login API to check against database
3. Implement user management UI
4. Add role-based permissions

Example structure for future:
```typescript
const ADMIN_USERS = [
  { username: 'admin', password: 'hashed_password', role: 'super_admin' },
  { username: 'operator', password: 'hashed_password', role: 'operator' },
]
```

---

## Quick Reference

| Item | Value |
|------|-------|
| **URL** | https://trafficbuster.my.id:5353 |
| **Default Username** | admin |
| **Default Password** | quantum2025 |
| **Token Expiry** | 24 hours |
| **JWT Secret** | In `/app/backend-v13/.env` |
| **Login API** | `/api/auth/login` |
| **Dashboard** | `/dashboard` |

---

## 🎯 REMEMBER

1. ⚠️ **Change default password immediately in production**
2. 🔒 Use strong, unique passwords
3. 🔐 Keep JWT_SECRET secure
4. 📊 Monitor login attempts
5. 🚫 Restrict access to admin panel
6. ✅ Use HTTPS only (already configured)

---

**Need help?** Check `/app/PRODUCTION_GUIDE.md` for more information.
