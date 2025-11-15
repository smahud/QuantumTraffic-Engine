/**
 * BACKEND - websocket.js
 * (UPDATED - REFACTOR ARSITEKTUR)
 * 
 * Mengelola DUA jenis WebSocket connection:
 * 1. User WebSocket (/ws atau default) - untuk Frontend clients
 * 2. Runner WebSocket (/ws/runner) - untuk Runner applications
 * 
 * Runner WebSocket menggunakan path /ws/runner dan API Key authentication
 */
'use strict';

const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./db');
const { getSession, updateSessionLastSeen } = require('./lib/userStore');
const { appendAudit } = require('./lib/audit');
const runnerManager = require('./lib/runnerManager');

// User WebSocket Server
let wss;
// Runner WebSocket Server
let runnerWSS;

function sendToUser(userId, payload) {
  if (!wss) return;
  const message = (typeof payload === 'string') ? payload : JSON.stringify(payload);
  wss.clients.forEach(client => {
    if (client.userId === userId) {
      try {
        client.send(message);
      } catch (e) {
        console.error(`[WSS] Gagal mengirim pesan ke ${userId}: ${e.message}`);
      }
    }
  });
}

function heartbeat() {
  this.isAlive = true;
}

function initializeWebSocket(httpsServer) {
  // ========== RUNNER WEBSOCKET SERVER (BARU) ==========
  initializeRunnerWebSocket(httpsServer);
  
  // ========== USER WEBSOCKET SERVER (EXISTING) ==========
  // Do NOT specify path - handle all WebSocket connections on root path
  wss = new WebSocketServer({ 
    server: httpsServer,
    noServer: false
  });

  wss.on('connection', async (ws, req) => {
    let token;
    
    try {
      const url = new URL(req.url, `wss://${req.headers.host}`);
      token = url.searchParams.get('token');
      if (!token) {
        throw new Error('Token tidak ditemukan di query URL');
      }
    } catch (e) {
      console.log('[WSS] Koneksi ditolak: Token tidak valid atau hilang.', e.message);
      ws.send(JSON.stringify({ success: false, code: 'TOKEN_MISSING', message: 'Token otentikasi tidak ditemukan.' }));
      ws.terminate();
      return;
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
      if (!decoded || !decoded.userId || !decoded.sessionId) {
        throw new Error('Payload token tidak valid');
      }
    } catch (err) {
      console.log(`[WSS] Koneksi ditolak (userId: ${decoded ? decoded.userId : 'unknown'}): Token tidak valid.`, err.message);
      ws.send(JSON.stringify({ success: false, code: 'TOKEN_INVALID', message: `Token tidak valid: ${err.message}` }));
      ws.terminate();
      return;
    }

    const { userId, sessionId } = decoded;
    
    // (PERBAIKAN NAMA FUNGSI)
    const sessionValid = await getSession(userId, sessionId);
    
    if (!sessionValid || sessionValid.status !== 'active') { // (PERBAIKAN LOGIKA)
      console.log(`[WSS] Koneksi ditolak (userId: ${userId}): Sesi ${sessionId} tidak aktif atau digantikan.`);
      ws.send(JSON.stringify({ success: false, code: 'SESSION_INVALID', message: 'Sesi ini telah digantikan oleh login baru.' }));
      ws.terminate();
      return;
    }

    console.log(`[WSS] Koneksi (userId: ${userId}) berhasil diautentikasi.`);
    ws.userId = userId;
    ws.sessionId = sessionId;
    ws.isAlive = true;
    ws.send(JSON.stringify({ success: true, type: 'status', status: 'connected', userId: userId, sessionId: sessionId }));

    ws.on('pong', heartbeat);

    ws.on('message', async (messageBuffer) => {
      try {
        const message = JSON.parse(messageBuffer.toString());
        if (message.type === 'heartbeat') {
          ws.send(JSON.stringify({ type: 'heartbeatAck' }));
          // (PERBAIKAN NAMA FUNGSI)
          await updateSessionLastSeen(ws.userId, ws.sessionId);
        }
      } catch (e) {
        console.log(`[WSS] (userId: ${ws.userId}) Menerima pesan tidak valid: ${e.message}`);
      }
    });

    ws.on('close', () => {
      console.log(`[WSS] Koneksi (userId: ${ws.userId}) ditutup.`);
    });
    ws.on('error', (err) => {
      console.error(`[WSS] Error pada koneksi (userId: ${ws.userId}):`, err);
    });
  });

  // Optimized ping interval for better stability
  const WS_PING_INTERVAL = parseInt(process.env.WS_PING_INTERVAL) || 15000; // 15s instead of 30s
  
  const interval = setInterval(() => {
    wss.clients.forEach(ws => {
      if (ws.isAlive === false) {
        console.log(`[WSS] (userId: ${ws.userId}) Ping timeout. Disconnecting.`);
        return ws.terminate();
      }
      ws.isAlive = false; 
      ws.ping();
    });
  }, WS_PING_INTERVAL); 

  wss.on('close', () => {
    clearInterval(interval);
  });
}

// ========== RUNNER WEBSOCKET INITIALIZATION (BARU) ==========
function initializeRunnerWebSocket(httpsServer) {
  runnerWSS = new WebSocketServer({ 
    server: httpsServer,
    path: '/ws/runner' // Path khusus untuk Runner connections
  });
  
  console.log('[WSS-Runner] Runner WebSocket Server initialized on /ws/runner');

  runnerWSS.on('connection', async (ws, req) => {
    console.log('[WSS-Runner] New runner connection attempt');
    
    // Authenticate Runner using API Key from header or query
    const apiKey = req.headers['x-runner-api-key'] || 
                   new URL(req.url, `wss://${req.headers.host}`).searchParams.get('apiKey');
    
    const expectedKey = process.env.RUNNER_API_KEY || 'default-runner-key-CHANGE-ME';
    
    if (!apiKey || apiKey !== expectedKey) {
      console.warn('[WSS-Runner] Connection rejected: Invalid API Key');
      ws.send(JSON.stringify({ 
        success: false, 
        code: 'AUTH_FAILED', 
        message: 'Invalid Runner API Key' 
      }));
      ws.terminate();
      return;
    }
    
    ws.isAlive = true;
    ws.runnerRegistered = false;
    
    // Send welcome message
    ws.send(JSON.stringify({ 
      success: true, 
      type: 'connected', 
      message: 'Runner authenticated. Please send registration message.' 
    }));
    
    ws.on('pong', () => { ws.isAlive = true; });
    
    ws.on('message', async (messageBuffer) => {
      try {
        const message = JSON.parse(messageBuffer.toString());
        
        // Handle Runner Registration
        if (message.type === 'register') {
          const runnerInfo = runnerManager.registerRunner(ws, {
            os: message.os || 'unknown',
            browser: message.browser || 'chrome',
            capabilities: message.capabilities || {}
          });
          
          ws.runnerRegistered = true;
          ws.send(JSON.stringify({ 
            success: true, 
            type: 'registered', 
            runnerId: runnerInfo.id,
            message: 'Runner registered successfully' 
          }));
        }
        
        // Handle Job Acknowledgment
        else if (message.type === 'jobAck') {
          console.log(`[WSS-Runner] Job ${message.jobId} acknowledged by runner ${ws.runnerId}`);
          // Forward acknowledgment to job owner
          const jobManager = require('./lib/jobManager');
          const jobInstance = jobManager.getJobInstance(message.jobId);
          if (jobInstance) {
            jobInstance.emitLog('info', `Runner acknowledged job execution`);
          }
        }
        
        // Handle Progress Update from Runner
        else if (message.type === 'flowDoneUpdate') {
          console.log(`[WSS-Runner] Progress update from runner ${ws.runnerId} for job ${message.jobId}`);
          // Forward to user
          const jobManager = require('./lib/jobManager');
          const jobInstance = jobManager.getJobInstance(message.jobId);
          if (jobInstance) {
            jobInstance.emitToUser('flowDoneUpdate', {
              targetId: message.targetId,
              flowDone: message.newFlowDone
            });
          }
        }
        
        // Handle Job Complete from Runner
        else if (message.type === 'jobComplete') {
          console.log(`[WSS-Runner] Job ${message.jobId} completed by runner ${ws.runnerId}`);
          
          // Mark runner as idle
          runnerManager.markRunnerIdle(ws.runnerId);
          
          // Notify job owner
          const jobManager = require('./lib/jobManager');
          const jobInstance = jobManager.getJobInstance(message.jobId);
          if (jobInstance) {
            jobInstance.emitLog('info', `Job completed by runner`);
            if (message.stats) {
              jobInstance.stats = { ...jobInstance.stats, ...message.stats };
            }
            jobInstance.stop();
          }
        }
        
        // Handle Heartbeat from Runner
        else if (message.type === 'heartbeat') {
          if (ws.runnerId) {
            runnerManager.updateRunnerHeartbeat(ws.runnerId);
          }
          ws.send(JSON.stringify({ type: 'heartbeatAck' }));
        }
        
        // Handle Log from Runner
        else if (message.type === 'log') {
          // Forward log to job owner
          const jobManager = require('./lib/jobManager');
          const jobInstance = jobManager.getJobInstance(message.jobId);
          if (jobInstance) {
            jobInstance.emitLog(message.level || 'info', message.message, message.meta);
          }
        }
        
      } catch (e) {
        console.error(`[WSS-Runner] Error processing message: ${e.message}`);
      }
    });
    
    ws.on('close', () => {
      console.log(`[WSS-Runner] Runner connection closed`);
      if (ws.runnerRegistered) {
        runnerManager.removeRunner(ws);
      }
    });
    
    ws.on('error', (err) => {
      console.error(`[WSS-Runner] WebSocket error:`, err);
    });
  });
  
  // Ping interval for Runner connections
  const runnerInterval = setInterval(() => {
    runnerWSS.clients.forEach(ws => {
      if (ws.isAlive === false) {
        console.log(`[WSS-Runner] Runner ping timeout, terminating connection`);
        if (ws.runnerRegistered) {
          runnerManager.removeRunner(ws);
        }
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);
  
  runnerWSS.on('close', () => {
    clearInterval(runnerInterval);
  });
}

function shutdownWebSocket() {
  if (wss) {
    console.log('[shutdown] Menutup semua koneksi User WebSocket...');
    wss.clients.forEach(client => {
      client.terminate();
    });
    wss.close();
  }
  
  if (runnerWSS) {
    console.log('[shutdown] Menutup semua koneksi Runner WebSocket...');
    runnerWSS.clients.forEach(client => {
      client.terminate();
    });
    runnerWSS.close();
  }
}

function getClientsSnapshot() {
  const users = wss ? Array.from(wss.clients).map(c => ({
    userId: c.userId,
    sessionId: c.sessionId,
    isAlive: c.isAlive
  })) : [];
  
  const runners = runnerWSS ? Array.from(runnerWSS.clients).map(c => ({
    runnerId: c.runnerId,
    registered: c.runnerRegistered,
    isAlive: c.isAlive
  })) : [];
  
  return { users, runners };
}

module.exports = { 
  initializeWebSocket, 
  sendToUser, 
  shutdownWebSocket,
  getClientsSnapshot
};
