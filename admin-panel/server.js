const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: '.env.local' });

// Always use production mode since we built the app
const dev = false;
const hostname = process.env.HOSTNAME || 'trafficbuster.my.id';
const port = parseInt(process.env.PORT || process.env.ADMIN_PANEL_PORT || '5353', 10);

// SSL Certificate paths (same as backend)
const certPath = process.env.CERT_PATH || '/etc/letsencrypt/live/trafficbuster.my.id/fullchain.pem';
const keyPath = process.env.KEY_PATH || '/etc/letsencrypt/live/trafficbuster.my.id/privkey.pem';

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
