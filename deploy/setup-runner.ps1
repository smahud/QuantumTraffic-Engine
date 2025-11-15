# TrafficBuster Runner - Windows Setup Script
#
# Skrip ini akan:
# 1. Install Chocolatey (jika belum ada)
# 2. Install Node.js LTS dan Git
# 3. Clone repository Runner
# 4. Install dependencies termasuk Playwright browsers
# 5. Setup konfigurasi .env
#
# Usage:
#   iwr -useb http://YOUR_BACKEND/api/v1/runner/deploy/windows | iex
#

$ErrorActionPreference = "Stop"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "TrafficBuster Runner - Windows Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "⚠️  Warning: Not running as Administrator" -ForegroundColor Yellow
    Write-Host "Some installations may require elevated privileges" -ForegroundColor Yellow
    Write-Host ""
}

# Install Chocolatey if not present
Write-Host "[1/6] Checking Chocolatey..." -ForegroundColor Green
if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Chocolatey..."
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    
    # Reload environment
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
} else {
    Write-Host "Chocolatey already installed" -ForegroundColor Gray
}

# Install Node.js
Write-Host ""
Write-Host "[2/6] Checking Node.js..." -ForegroundColor Green
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Node.js LTS..."
    choco install nodejs-lts -y
    
    # Reload environment
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
} else {
    $nodeVersion = node --version
    Write-Host "Node.js already installed: $nodeVersion" -ForegroundColor Gray
}

# Install Git
Write-Host ""
Write-Host "[3/6] Checking Git..." -ForegroundColor Green
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Git..."
    choco install git -y
    
    # Reload environment
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
} else {
    $gitVersion = git --version
    Write-Host "Git already installed: $gitVersion" -ForegroundColor Gray
}

# Setup Runner directory
Write-Host ""
Write-Host "[4/6] Setting up TrafficBuster Runner..." -ForegroundColor Green
$runnerDir = "$env:USERPROFILE\trafficbuster-runner"

if (Test-Path $runnerDir) {
    Write-Host "Runner directory exists, updating..."
    Set-Location $runnerDir
    git pull 2>&1 | Out-Null
} else {
    Write-Host "Creating runner directory..."
    
    # Repository URL (replace with actual repo)
    $repoUrl = $env:RUNNER_REPO_URL
    if (-not $repoUrl) {
        $repoUrl = "https://github.com/yourusername/trafficbuster-runner.git"
    }
    
    if ($repoUrl -eq "https://github.com/yourusername/trafficbuster-runner.git") {
        Write-Host "Repository URL not configured. Creating directory manually..."
        New-Item -ItemType Directory -Path $runnerDir -Force | Out-Null
        Set-Location $runnerDir
        
        # Create package.json
        $packageJson = @'
{
  "name": "trafficbuster-runner",
  "version": "1.0.0",
  "main": "runner.js",
  "dependencies": {
    "playwright": "^1.45.3",
    "ws": "^8.18.3",
    "dotenv": "^17.2.3"
  }
}
'@
        Set-Content -Path "package.json" -Value $packageJson
        
        Write-Host "⚠️  Please manually copy runner.js to $runnerDir" -ForegroundColor Yellow
        Write-Host "Or set RUNNER_REPO_URL environment variable" -ForegroundColor Yellow
    } else {
        git clone $repoUrl $runnerDir
        Set-Location $runnerDir
    }
}

# Install npm dependencies
Write-Host ""
Write-Host "[5/6] Installing npm dependencies..." -ForegroundColor Green
npm install

# Install Playwright browsers
Write-Host ""
Write-Host "Installing Playwright browsers (this may take a while)..." -ForegroundColor Green
npx playwright install --with-deps

# Setup .env file
Write-Host ""
Write-Host "[6/6] Setting up configuration..." -ForegroundColor Green
if (-not (Test-Path ".env")) {
    $envContent = @"
# Backend-Orchestrator Configuration
BE_HOST=trafficbuster.my.id:5252
RUNNER_API_KEY=quantum-runner-secure-key-production-2025

# Runner Configuration
RUNNER_OS=windows
RUNNER_BROWSER=chrome
HEADLESS=true

# Connection Settings (Optimized)
RECONNECT_DELAY=5000
HEARTBEAT_INTERVAL=30000

# SSL Verification (set to false for self-signed certs)
NODE_TLS_REJECT_UNAUTHORIZED=0
"@
    Set-Content -Path ".env" -Value $envContent
    Write-Host "Created .env file with default configuration" -ForegroundColor Gray
} else {
    Write-Host ".env file already exists, skipping..." -ForegroundColor Gray
}

# Create start script
$startScript = @'
@echo off
echo Starting TrafficBuster Runner...
node runner.js
pause
'@
Set-Content -Path "start-runner.bat" -Value $startScript

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Edit configuration:" -ForegroundColor White
Write-Host "   notepad $runnerDir\.env" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Set your Backend host and API key:" -ForegroundColor White
Write-Host "   BE_HOST=your-backend-host.com:3000" -ForegroundColor Gray
Write-Host "   RUNNER_API_KEY=your-secret-key" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Start the runner:" -ForegroundColor White
Write-Host "   cd $runnerDir" -ForegroundColor Gray
Write-Host "   npm start" -ForegroundColor Gray
Write-Host ""
Write-Host "   (Or double-click start-runner.bat)" -ForegroundColor Gray
Write-Host ""
Write-Host "4. To run as Windows Service:" -ForegroundColor White
Write-Host "   choco install nssm -y" -ForegroundColor Gray
Write-Host "   nssm install TrafficBusterRunner node $runnerDir\runner.js" -ForegroundColor Gray
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
