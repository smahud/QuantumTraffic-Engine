/**
 * BACKEND - server.js (REPAIRED & REFACTORED)
 * (Prioritas 2: Implementasi Scheduler)
 * - (BARU) Mengimpor dan menginisialisasi 'scheduler'.
 */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const app = require('./app');
const { initializeWebSocket, shutdownWebSocket } = require('./websocket');
const { clearAllSessionsOnStartup } = require('./lib/userStore');

// Load centralized configuration from .env
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const PORT = parseInt(process.env.PORT) || 5252;
const SESSION_GRACE_PERIOD_MS = parseInt(process.env.SESSION_GRACE_PERIOD_MS) || 300000;
const SESSION_CLEAN_INTERVAL_MS = parseInt(process.env.SESSION_CLEAN_INTERVAL_MS) || 120000;
// (BARU) Impor scheduler
const { initializeScheduler } = require('./lib/scheduler');

// Session cleaner
let sessionCleanerStopFn = null;

const START_TS = Date.now();
const MAX_TRIES = 10;
const SHUTDOWN_TIMEOUT_MS = 8000;

const keyPath = path.join(__dirname, 'key.pem');
const certPath = path.join(__dirname, 'cert.pem');

let credentials;
try {
  const privateKey = fs.readFileSync(keyPath, 'utf8');
  const certificate = fs.readFileSync(certPath, 'utf8');
  credentials = { key: privateKey, cert: certificate };
  console.log('[startup] Loaded SSL certificate & key.');
} catch (err) {
  console.error('FATAL: Unable to load key.pem / cert.pem. Ensure TLS files exist. Exiting.');
  process.exit(1);
}

console.log('[startup] JWT secret present (length:', String(JWT_SECRET).length, ').');

const httpsServer = https.createServer(credentials, app);

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptimeSec: Math.round(process.uptime()),
    startedAt: new Date(START_TS).toISOString()
  });
});

(async () => {
  
  await clearAllSessionsOnStartup();

  console.log('[startup] WebSocket server ready.');
  initializeWebSocket(httpsServer);

  // Start session cleaner
  try {
    const { start: startSessionCleaner } = require('./lib/sessionCleaner');
    startSessionCleaner({ 
      intervalMs: SESSION_CLEAN_INTERVAL_MS, 
      graceMs: SESSION_GRACE_PERIOD_MS
    });
    const cleaner = require('./lib/sessionCleaner');
    sessionCleanerStopFn = cleaner.stop;
  } catch (e) {
    console.warn('sessionCleaner start failure:', e && e.message ? e.message : e);
  }

  // (BARU) Start scheduler
  try {
    initializeScheduler();
  } catch (e) {
     console.warn('Scheduler start failure:', e && e.message ? e.message : e);
  }


  // Robust port listen with retries
  function tryListen(port, attemptsLeft) {
    if (attemptsLeft <= 0) {
      console.error(`FATAL: Exhausted port attempts starting from ${PORT}. Consider setting PORT to an available port.`);
      process.exit(1);
    }

    httpsServer.once('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        console.warn(`[listen] Port ${port} in use. Trying ${port + 1} (remaining attempts: ${attemptsLeft - 1})`);
        httpsServer.removeAllListeners('error');
        httpsServer.removeAllListeners('listening');
        tryListen(port + 1, attemptsLeft - 1);
      } else {
        console.error('FATAL: Server listen error:', err);
        process.exit(1);
      }
    });

    httpsServer.once('listening', () => {
      const addr = httpsServer.address();
      const boundPort = addr && addr.port ? addr.port : port;
      httpsServer.removeAllListeners('error');
      httpsServer.removeAllListeners('listening');

      console.log('====================================================');
      console.log(`TrafficBuster Backend running at: https://localhost:${boundPort}`);
      console.log('====================================================');
      console.log(`[info] Grace Period (ms): ${SESSION_GRACE_PERIOD_MS}`);
      console.log('[info] Health check: GET /health');
    });

    httpsServer.listen(port);
  }
  
  tryListen(PORT, MAX_TRIES);

})(); 


// Graceful Shutdown
let shuttingDown = false;
async function shutdown(signal = 'manual') {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] Initiated by ${signal}. Attempting graceful close...`);

  // Stop session cleaner
  try {
    if (sessionCleanerStopFn) {
      sessionCleanerStopFn();
      console.log('[shutdown] sessionCleaner stopped.');
    }
  } catch (e) {
    console.warn('[shutdown] Error stopping sessionCleaner:', e && e.message ? e.message : e);
  }

  // Shutdown WebSocket
  try {
    shutdownWebSocket();
    console.log('[shutdown] WebSocket server closed.');
  } catch (e) {
    console.warn('[shutdown] Error shutting down WSS:', e && e.message ? e.message : e);
  }
  
  // Note: Playwright now handled by Runner, not Backend

  // Close HTTPS server
  try {
    httpsServer.close(() => {
      console.log('[shutdown] HTTPS server closed successfully.');
      process.exit(0);
    });
  } catch (e) {
    console.error('[shutdown] Error closing HTTPS server:', e && e.message ? e.message : e);
  }

  // Force exit after timeout
  setTimeout(() => {
    console.warn('[shutdown] Timeout reached. Forcing process exit.');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();
}

// Signal handlers
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Extra safety handlers
process.on('unhandledRejection', (reason) => {
  console.error('[error] Unhandled Promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[error] Uncaught Exception:', err && err.stack ? err.stack : err);
});

// Expose shutdown for external triggers
module.exports = { shutdown };
