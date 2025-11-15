# TrafficBuster Runner

Aplikasi standalone Node.js yang menjalankan Playwright untuk TrafficBuster.

## Instalasi

### Windows
```powershell
# Via PowerShell (otomatis)
iwr -useb http://YOUR_BACKEND_HOST/api/v1/runner/deploy/windows | iex

# Manual
git clone <repo>
cd trafficbuster-runner
npm install
npx playwright install --with-deps
copy .env.example .env
# Edit .env dengan konfigurasi Anda
npm start
```

### Linux (Debian/Ubuntu)
```bash
# Via curl (otomatis)
curl -fsSL http://YOUR_BACKEND_HOST/api/v1/runner/deploy/linux | bash

# Manual
sudo apt-get update
sudo apt-get install -y nodejs npm git xvfb
git clone <repo>
cd trafficbuster-runner
npm install
npx playwright install --with-deps
cp .env.example .env
# Edit .env dengan konfigurasi Anda
npm start
```

### macOS
```bash
brew install node git
git clone <repo>
cd trafficbuster-runner
npm install
npx playwright install --with-deps
cp .env.example .env
# Edit .env dengan konfigurasi Anda
npm start
```

## Konfigurasi

Edit file `.env`:

```env
BE_HOST=backend.example.com:3000
RUNNER_API_KEY=your-secure-api-key-here
RUNNER_OS=windows  # atau linux, macos
RUNNER_BROWSER=chrome
HEADLESS=true  # set false untuk headful mode
```

## Menjalankan

```bash
npm start
```

Runner akan otomatis:
1. Connect ke Backend-Orchestrator
2. Register diri dengan OS dan Browser info
3. Menunggu job dari Backend
4. Menjalankan Playwright dengan human behavior simulation
5. Kirim progress real-time ke Backend

## Troubleshooting

### Connection Refused
- Pastikan Backend-Orchestrator sudah running
- Periksa BE_HOST di .env
- Periksa firewall

### Browser Launch Failed
- Jalankan `npx playwright install --with-deps`
- Untuk Linux server tanpa DE, pastikan Xvfb terinstall

### Authentication Failed
- Periksa RUNNER_API_KEY match dengan Backend
