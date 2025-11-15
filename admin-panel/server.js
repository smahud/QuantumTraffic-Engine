const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

// Load from centralized backend .env first, then local .env.local
require('dotenv').config({ path: '/app/backend-v13/.env' });
require('dotenv').config({ path: '.env.local' });

// Use development mode for now (production build has issues with PostCSS)
const dev = true;
const hostname = process.env.HOSTNAME || process.env.DOMAIN || 'trafficbuster.my.id';
const port = parseInt(process.env.ADMIN_PANEL_PORT || '5353', 10);

// SSL Certificate paths with fallback
const certPath = process.env.CERT_PATH || process.env.FALLBACK_CERT_PATH || '/app/backend-v13/cert.pem';
const keyPath = process.env.KEY_PATH || process.env.FALLBACK_KEY_PATH || '/app/backend-v13/key.pem';

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Load SSL certificates
  let httpsOptions;
  try {
    httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
    console.log(`[Admin Panel] SSL certificates loaded`);
    console.log(`[Admin Panel] Cert: ${certPath}`);
    console.log(`[Admin Panel] Key: ${keyPath}`);
  } catch (err) {
    console.error('FATAL: Unable to load SSL certificates for Admin Panel');
    console.error('Error:', err.message);
    console.error(`Cert path: ${certPath}`);
    console.error(`Key path: ${keyPath}`);
    process.exit(1);
  }

  createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  })
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`============================================`);
      console.log(`QuantumTraffic Engine - Admin Panel`);
      console.log(`============================================`);
      console.log(`> Ready on https://${hostname}:${port}`);
      console.log(`> Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`============================================`);
    });
});
