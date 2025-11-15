#!/bin/bash
#
# TrafficBuster Runner - Linux Setup Script (Debian/Ubuntu)
# 
# Skrip ini akan:
# 1. Install Node.js, npm, git
# 2. Install Xvfb (Virtual Framebuffer) untuk headful mode tanpa DE
# 3. Clone repository Runner
# 4. Install dependencies termasuk Playwright browsers
# 5. Setup konfigurasi .env
#
# Usage:
#   curl -fsSL http://YOUR_BACKEND/api/v1/runner/deploy/linux | bash
#   atau
#   wget -qO- http://YOUR_BACKEND/api/v1/runner/deploy/linux | bash
#

set -e

echo "============================================"
echo "TrafficBuster Runner - Linux Setup"
echo "============================================"

# Detect distro
if [ -f /etc/debian_version ]; then
    DISTRO="debian"
elif [ -f /etc/redhat-release ]; then
    DISTRO="redhat"
else
    echo "Unsupported Linux distribution"
    exit 1
fi

# Update package lists
echo ""
echo "[1/6] Updating package lists..."
if [ "$DISTRO" = "debian" ]; then
    sudo apt-get update -qq
elif [ "$DISTRO" = "redhat" ]; then
    sudo yum update -y -q
fi

# Install Node.js
echo ""
echo "[2/6] Installing Node.js..."
if ! command -v node &> /dev/null; then
    if [ "$DISTRO" = "debian" ]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif [ "$DISTRO" = "redhat" ]; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo yum install -y nodejs
    fi
else
    echo "Node.js already installed: $(node --version)"
fi

# Install git, curl, Xvfb
echo ""
echo "[3/6] Installing dependencies (git, curl, xvfb)..."
if [ "$DISTRO" = "debian" ]; then
    sudo apt-get install -y git curl xvfb
    
    # Install additional GUI libraries required by Playwright
    sudo apt-get install -y \
        libnss3 \
        libnspr4 \
        libatk1.0-0 \
        libatk-bridge2.0-0 \
        libcups2 \
        libdrm2 \
        libdbus-1-3 \
        libxkbcommon0 \
        libxcomposite1 \
        libxdamage1 \
        libxfixes3 \
        libxrandr2 \
        libgbm1 \
        libpango-1.0-0 \
        libcairo2 \
        libasound2 \
        libatspi2.0-0
        
elif [ "$DISTRO" = "redhat" ]; then
    sudo yum install -y git curl xorg-x11-server-Xvfb
    
    # Install additional dependencies for Playwright
    sudo yum install -y \
        nss \
        nspr \
        atk \
        at-spi2-atk \
        cups-libs \
        libdrm \
        dbus-libs \
        libxkbcommon \
        libXcomposite \
        libXdamage \
        libXfixes \
        libXrandr \
        mesa-libgbm \
        pango \
        cairo \
        alsa-lib
fi

# Clone or update repository
echo ""
echo "[4/6] Setting up TrafficBuster Runner..."
RUNNER_DIR="$HOME/trafficbuster-runner"

if [ -d "$RUNNER_DIR" ]; then
    echo "Runner directory exists, updating..."
    cd "$RUNNER_DIR"
    git pull || echo "Git pull failed, continuing..."
else
    echo "Cloning runner repository..."
    # Replace with actual repository URL
    REPO_URL="${RUNNER_REPO_URL:-https://github.com/yourusername/trafficbuster-runner.git}"
    
    # If repo URL not available, create directory and download files manually
    if [ "$REPO_URL" = "https://github.com/yourusername/trafficbuster-runner.git" ]; then
        echo "Repository URL not configured. Creating directory..."
        mkdir -p "$RUNNER_DIR"
        cd "$RUNNER_DIR"
        
        # Download package.json
        echo '{"name":"trafficbuster-runner","version":"1.0.0","main":"runner.js","dependencies":{"playwright":"^1.45.3","ws":"^8.18.3","dotenv":"^17.2.3"}}' > package.json
        
        echo "Please manually copy runner.js to $RUNNER_DIR"
        echo "Or set RUNNER_REPO_URL environment variable before running this script"
    else
        git clone "$REPO_URL" "$RUNNER_DIR"
        cd "$RUNNER_DIR"
    fi
fi

# Install npm dependencies
echo ""
echo "[5/6] Installing npm dependencies..."
npm install

# Install Playwright browsers
echo ""
echo "Installing Playwright browsers (this may take a while)..."
npx playwright install --with-deps

# Setup .env file
echo ""
echo "[6/6] Setting up configuration..."
if [ ! -f .env ]; then
    cat > .env << EOF
# Backend-Orchestrator Configuration  
BE_HOST=trafficbuster.my.id:5252
RUNNER_API_KEY=default-runner-key-CHANGE-ME

# Runner Configuration
RUNNER_OS=linux
RUNNER_BROWSER=chrome
HEADLESS=true

# Connection Settings (Optimized)
RECONNECT_DELAY=5000
HEARTBEAT_INTERVAL=30000

# For headful mode on server without Desktop Environment, use Xvfb:
# DISPLAY=:99
EOF
    echo "Created .env file with default configuration"
else
    echo ".env file already exists, skipping..."
fi

# Create start script for Xvfb
cat > start-runner.sh << 'EOF'
#!/bin/bash
# Start Xvfb in background (for headful mode without DE)
Xvfb :99 -screen 0 1920x1080x24 &
export DISPLAY=:99

# Start runner
node runner.js
EOF

chmod +x start-runner.sh

echo ""
echo "============================================"
echo "✅ Setup Complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "1. Edit configuration:"
echo "   nano $RUNNER_DIR/.env"
echo ""
echo "2. Set your Backend host and API key:"
echo "   BE_HOST=your-backend-host.com:3000"
echo "   RUNNER_API_KEY=your-secret-key"
echo ""
echo "3. Start the runner:"
echo "   cd $RUNNER_DIR"
echo "   npm start"
echo ""
echo "   (For headful mode with Xvfb:)"
echo "   ./start-runner.sh"
echo ""
echo "4. To run as systemd service:"
echo "   sudo nano /etc/systemd/system/trafficbuster-runner.service"
echo ""
echo "============================================"
