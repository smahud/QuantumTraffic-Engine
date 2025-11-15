#!/bin/bash
#
# QuantumTraffic Engine - Backend Auto-Deployment Script
# 
# This script will:
# 1. Install all backend dependencies
# 2. Setup MongoDB
# 3. Generate SSL certificates
# 4. Configure environment
# 5. Install Admin Panel dependencies
# 6. Setup systemd services
# 7. Configure firewall
#
# Usage:
#   sudo bash setup-backend.sh
#

set -e

echo "============================================"
echo "QuantumTraffic Engine - Backend Setup"
echo "============================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root (sudo)"
  exit 1
fi

# Detect distro
if [ -f /etc/debian_version ]; then
    DISTRO="debian"
    PKG_MANAGER="apt-get"
elif [ -f /etc/redhat-release ]; then
    DISTRO="redhat"
    PKG_MANAGER="yum"
else
    echo "❌ Unsupported Linux distribution"
    exit 1
fi

echo "Detected distro: $DISTRO"
echo ""

# ========================================
# STEP 1: Install System Dependencies
# ========================================
echo "[1/9] Installing system dependencies..."

if [ "$DISTRO" = "debian" ]; then
    $PKG_MANAGER update -qq
    $PKG_MANAGER install -y curl wget git build-essential openssl
elif [ "$DISTRO" = "redhat" ]; then
    $PKG_MANAGER update -y -q
    $PKG_MANAGER install -y curl wget git gcc-c++ make openssl
fi

echo "✅ System dependencies installed"
echo ""

# ========================================
# STEP 2: Install Node.js
# ========================================
echo "[2/9] Installing Node.js 20.x..."

if ! command -v node &> /dev/null; then
    if [ "$DISTRO" = "debian" ]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        $PKG_MANAGER install -y nodejs
    elif [ "$DISTRO" = "redhat" ]; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
        $PKG_MANAGER install -y nodejs
    fi
else
    echo "Node.js already installed: $(node --version)"
fi

echo "✅ Node.js installed"
echo ""

# ========================================
# STEP 3: Install MongoDB
# ========================================
echo "[3/9] Installing MongoDB..."

if ! command -v mongod &> /dev/null; then
    if [ "$DISTRO" = "debian" ]; then
        # Import MongoDB GPG key
        curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
            gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
        
        # Add MongoDB repository
        echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] http://repo.mongodb.org/apt/debian bookworm/mongodb-org/7.0 main" | \
            tee /etc/apt/sources.list.d/mongodb-org-7.0.list
        
        $PKG_MANAGER update -qq
        $PKG_MANAGER install -y mongodb-org
        
    elif [ "$DISTRO" = "redhat" ]; then
        # Add MongoDB repository
        cat > /etc/yum.repos.d/mongodb-org-7.0.repo << EOF
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/\$releasever/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-7.0.asc
EOF
        
        $PKG_MANAGER install -y mongodb-org
    fi
    
    # Enable and start MongoDB
    systemctl enable mongod
    systemctl start mongod
    
    echo "✅ MongoDB installed and started"
else
    echo "MongoDB already installed"
    systemctl status mongod --no-pager || systemctl start mongod
fi

echo ""

# ========================================
# STEP 4: Setup Project Directory
# ========================================
echo "[4/9] Setting up project directory..."

PROJECT_DIR="/app"
BACKEND_DIR="$PROJECT_DIR/backend-v13"
ADMIN_DIR="$PROJECT_DIR/admin-panel"
CERT_DIR="$PROJECT_DIR/certificates"
LOG_DIR="$PROJECT_DIR/logs"
BACKUP_DIR="$PROJECT_DIR/backups"

# Create directories
mkdir -p "$CERT_DIR" "$LOG_DIR" "$BACKUP_DIR"

# Set proper permissions
chmod 755 "$PROJECT_DIR"
chmod 700 "$CERT_DIR"
chmod 755 "$LOG_DIR"

echo "✅ Directories created"
echo ""

# ========================================
# STEP 5: Generate SSL Certificates
# ========================================
echo "[5/9] Generating SSL certificates..."

if [ ! -f "$CERT_DIR/cert.pem" ] || [ ! -f "$CERT_DIR/key.pem" ]; then
    openssl req -x509 -newkey rsa:4096 \
        -keyout "$CERT_DIR/key.pem" \
        -out "$CERT_DIR/cert.pem" \
        -days 365 -nodes \
        -subj "/C=ID/ST=Jakarta/L=Jakarta/O=QuantumTraffic/OU=Engine/CN=trafficbuster.my.id"
    
    chmod 600 "$CERT_DIR/key.pem"
    chmod 644 "$CERT_DIR/cert.pem"
    
    echo "✅ SSL certificates generated"
else
    echo "SSL certificates already exist"
fi

# Copy certificates to backend directory (backward compatibility)
cp "$CERT_DIR/cert.pem" "$BACKEND_DIR/cert.pem" 2>/dev/null || true
cp "$CERT_DIR/key.pem" "$BACKEND_DIR/key.pem" 2>/dev/null || true

echo ""

# ========================================
# STEP 6: Install Backend Dependencies
# ========================================
echo "[6/9] Installing backend dependencies..."

cd "$BACKEND_DIR"

if [ ! -d "node_modules" ]; then
    npm install --production
    echo "✅ Backend dependencies installed"
else
    echo "Backend dependencies already installed"
fi

echo ""

# ========================================
# STEP 7: Install Admin Panel Dependencies
# ========================================
echo "[7/9] Installing admin panel dependencies..."

cd "$ADMIN_DIR"

if [ ! -d "node_modules" ]; then
    npm install
    npm run build
    echo "✅ Admin panel built"
else
    echo "Admin panel already built"
fi

echo ""

# ========================================
# STEP 8: Configure Environment
# ========================================
echo "[8/9] Configuring environment..."

cd "$BACKEND_DIR"

if [ ! -f ".env" ]; then
    if [ -f ".env.production.example" ]; then
        cp .env.production.example .env
        
        # Generate secure keys
        JWT_SECRET=$(openssl rand -base64 32)
        RUNNER_API_KEY=$(openssl rand -base64 32)
        
        # Update .env with generated keys
        sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
        sed -i "s|RUNNER_API_KEY=.*|RUNNER_API_KEY=$RUNNER_API_KEY|" .env
        
        # Update certificate paths
        sed -i "s|CERT_PATH=.*|CERT_PATH=$CERT_DIR/cert.pem|" .env
        sed -i "s|KEY_PATH=.*|KEY_PATH=$CERT_DIR/key.pem|" .env
        
        echo "✅ Environment configured with secure keys"
        echo ""
        echo "📝 Generated Keys (SAVE THESE!):"
        echo "JWT_SECRET=$JWT_SECRET"
        echo "RUNNER_API_KEY=$RUNNER_API_KEY"
        echo ""
    else
        echo "⚠️ .env.production.example not found, skipping"
    fi
else
    echo ".env already exists"
fi

echo ""

# ========================================
# STEP 9: Create Systemd Services
# ========================================
echo "[9/9] Creating systemd services..."

# Backend service
cat > /etc/systemd/system/quantumtraffic-backend.service << EOF
[Unit]
Description=QuantumTraffic Engine - Backend
After=network.target mongod.service
Wants=mongod.service

[Service]
Type=simple
User=root
WorkingDirectory=$BACKEND_DIR
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=append:$LOG_DIR/backend.log
StandardError=append:$LOG_DIR/backend-error.log

[Install]
WantedBy=multi-user.target
EOF

# Admin Panel service
cat > /etc/systemd/system/quantumtraffic-admin.service << EOF
[Unit]
Description=QuantumTraffic Engine - Admin Panel
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$ADMIN_DIR
Environment="NODE_ENV=production"
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=append:$LOG_DIR/admin.log
StandardError=append:$LOG_DIR/admin-error.log

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
systemctl daemon-reload

# Enable services
systemctl enable quantumtraffic-backend
systemctl enable quantumtraffic-admin

echo "✅ Systemd services created and enabled"
echo ""

# ========================================
# CONFIGURE FIREWALL
# ========================================
echo "Configuring firewall..."

if command -v ufw &> /dev/null; then
    # UFW (Ubuntu/Debian)
    ufw allow 5252/tcp comment "QuantumTraffic Backend"
    ufw allow 5353/tcp comment "QuantumTraffic Admin Panel"
    ufw allow 5522/tcp comment "QuantumTraffic Runner"
    echo "✅ UFW rules added"
elif command -v firewall-cmd &> /dev/null; then
    # FirewallD (RedHat/CentOS)
    firewall-cmd --permanent --add-port=5252/tcp
    firewall-cmd --permanent --add-port=5353/tcp
    firewall-cmd --permanent --add-port=5522/tcp
    firewall-cmd --reload
    echo "✅ Firewall rules added"
else
    echo "⚠️ No firewall detected, please configure manually"
fi

echo ""

# ========================================
# FINAL STATUS
# ========================================
echo "============================================"
echo "✅ Setup Complete!"
echo "============================================"
echo ""
echo "📁 Installation Directory: $PROJECT_DIR"
echo "🔐 Certificates: $CERT_DIR"
echo "📝 Logs: $LOG_DIR"
echo "💾 Backups: $BACKUP_DIR"
echo ""
echo "🚀 To start services:"
echo "   sudo systemctl start quantumtraffic-backend"
echo "   sudo systemctl start quantumtraffic-admin"
echo ""
echo "📊 To check status:"
echo "   sudo systemctl status quantumtraffic-backend"
echo "   sudo systemctl status quantumtraffic-admin"
echo ""
echo "📄 To view logs:"
echo "   sudo tail -f $LOG_DIR/backend.log"
echo "   sudo tail -f $LOG_DIR/admin.log"
echo ""
echo "🔧 Configuration file:"
echo "   $BACKEND_DIR/.env"
echo ""
echo "🌐 Access URLs:"
echo "   Backend: https://trafficbuster.my.id:5252"
echo "   Admin Panel: https://trafficbuster.my.id:5353"
echo ""
echo "📦 Deploy Runner:"
echo "   curl -fsSL https://trafficbuster.my.id:5252/api/v1/runner/deploy/linux | bash"
echo ""
echo "============================================"
