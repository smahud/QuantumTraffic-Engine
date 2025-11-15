/**
 * BACKEND - lib/runnerManager.js (BARU)
 * 
 * Mengelola pool Runner yang terhubung ke Backend-Orchestrator.
 * Runner adalah aplikasi standalone yang menjalankan Playwright.
 * 
 * FUNGSI UTAMA:
 * - registerRunner: Daftarkan Runner baru yang connect
 * - removeRunner: Hapus Runner yang disconnect
 * - findAvailableRunner: Cari Runner yang idle dan sesuai platform
 * - dispatchJobToRunner: Kirim job ke Runner spesifik
 * - getAvailablePlatforms: Dapatkan list platform dari Runner online
 */

'use strict';

const fs = require('fs').promises;
const path = require('path');

// Pool Runner yang terhubung: Map<runnerId, RunnerInfo>
const connectedRunners = new Map();

// Load master fingerprints untuk platform matching
let masterFingerprints = [];

/**
 * Load master fingerprints dari data/fingerprints.json
 */
async function loadMasterFingerprints() {
  try {
    const fingerprintsPath = path.join(__dirname, '..', 'data', 'fingerprints.json');
    const data = await fs.readFile(fingerprintsPath, 'utf8');
    masterFingerprints = JSON.parse(data);
    console.log(`[runnerManager] Loaded ${masterFingerprints.length} master fingerprints`);
  } catch (e) {
    console.warn(`[runnerManager] Failed to load fingerprints: ${e.message}`);
    masterFingerprints = [];
  }
}

// Load fingerprints saat module dimuat
loadMasterFingerprints();

/**
 * Register Runner baru yang connect via WebSocket
 * @param {WebSocket} ws - WebSocket connection
 * @param {object} details - { os, browser, capabilities }
 */
function registerRunner(ws, details) {
  const runnerId = `runner_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const runnerInfo = {
    id: runnerId,
    os: details.os || 'unknown',
    browser: details.browser || 'chrome',
    capabilities: details.capabilities || {},
    status: 'idle', // idle | busy
    socket: ws,
    registeredAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    currentJobId: null
  };
  
  connectedRunners.set(runnerId, runnerInfo);
  
  // Attach runnerId ke WebSocket untuk tracking
  ws.runnerId = runnerId;
  
  console.log(`[runnerManager] ✅ Runner registered: ${runnerId} (OS: ${runnerInfo.os}, Browser: ${runnerInfo.browser})`);
  console.log(`[runnerManager] Total runners online: ${connectedRunners.size}`);
  
  return runnerInfo;
}

/**
 * Remove Runner yang disconnect
 * @param {WebSocket} ws - WebSocket connection
 */
function removeRunner(ws) {
  const runnerId = ws.runnerId;
  
  if (!runnerId) {
    console.warn('[runnerManager] Attempted to remove runner without runnerId');
    return false;
  }
  
  const runner = connectedRunners.get(runnerId);
  if (runner) {
    console.log(`[runnerManager] ❌ Runner disconnected: ${runnerId} (OS: ${runner.os})`);
    
    // Jika Runner sedang menjalankan job, mark sebagai failed
    if (runner.currentJobId) {
      console.warn(`[runnerManager] Runner ${runnerId} disconnected while running job ${runner.currentJobId}`);
      // TODO: Notify job owner tentang kegagalan
    }
    
    connectedRunners.delete(runnerId);
    console.log(`[runnerManager] Total runners online: ${connectedRunners.size}`);
    return true;
  }
  
  return false;
}

/**
 * Find available Runner berdasarkan platform request
 * @param {object} platformRequest - { os, browser } atau null untuk any
 * @returns {object|null} - RunnerInfo atau null jika tidak ada
 */
function findAvailableRunner(platformRequest) {
  // Filter runners yang idle
  const availableRunners = Array.from(connectedRunners.values())
    .filter(r => r.status === 'idle');
  
  if (availableRunners.length === 0) {
    console.warn('[runnerManager] No idle runners available');
    return null;
  }
  
  // Jika tidak ada platform request, kembalikan random idle runner
  if (!platformRequest || !platformRequest.os) {
    const runner = availableRunners[Math.floor(Math.random() * availableRunners.length)];
    console.log(`[runnerManager] Selected random runner: ${runner.id} (OS: ${runner.os})`);
    return runner;
  }
  
  // Filter berdasarkan OS yang diminta
  const matchingRunners = availableRunners.filter(r => {
    const osMatch = r.os.toLowerCase() === platformRequest.os.toLowerCase();
    const browserMatch = !platformRequest.browser || 
                        r.browser.toLowerCase() === platformRequest.browser.toLowerCase();
    return osMatch && browserMatch;
  });
  
  if (matchingRunners.length === 0) {
    console.warn(`[runnerManager] No runners available for platform: ${platformRequest.os}/${platformRequest.browser || 'any'}`);
    return null;
  }
  
  // Pilih random dari matching runners
  const runner = matchingRunners[Math.floor(Math.random() * matchingRunners.length)];
  console.log(`[runnerManager] Selected runner: ${runner.id} (OS: ${runner.os}, Browser: ${runner.browser})`);
  return runner;
}

/**
 * Dispatch job ke Runner spesifik
 * @param {string} runnerId - ID Runner
 * @param {object} jobConfig - Job configuration + settings
 */
function dispatchJobToRunner(runnerId, jobConfig) {
  const runner = connectedRunners.get(runnerId);
  
  if (!runner) {
    throw new Error(`Runner ${runnerId} not found`);
  }
  
  if (runner.status !== 'idle') {
    throw new Error(`Runner ${runnerId} is not idle (current status: ${runner.status})`);
  }
  
  // Update runner status
  runner.status = 'busy';
  runner.currentJobId = jobConfig.jobId;
  runner.lastSeen = new Date().toISOString();
  
  // Send job ke Runner via WebSocket
  const message = {
    type: 'newJob',
    jobConfig: jobConfig
  };
  
  try {
    runner.socket.send(JSON.stringify(message));
    console.log(`[runnerManager] 📤 Job ${jobConfig.jobId} dispatched to runner ${runnerId}`);
    return true;
  } catch (e) {
    console.error(`[runnerManager] Failed to send job to runner ${runnerId}: ${e.message}`);
    runner.status = 'idle';
    runner.currentJobId = null;
    throw e;
  }
}

/**
 * Mark Runner sebagai idle setelah job selesai
 * @param {string} runnerId - ID Runner
 */
function markRunnerIdle(runnerId) {
  const runner = connectedRunners.get(runnerId);
  
  if (runner) {
    runner.status = 'idle';
    runner.currentJobId = null;
    runner.lastSeen = new Date().toISOString();
    console.log(`[runnerManager] Runner ${runnerId} marked as idle`);
  }
}

/**
 * Get list platform yang tersedia dari Runner online
 * Mengembalikan fingerprints yang OS-nya match dengan Runner online
 * @returns {Array} - Filtered fingerprints
 */
function getAvailablePlatforms() {
  if (connectedRunners.size === 0) {
    console.log('[runnerManager] No runners online, returning empty platforms');
    return [];
  }
  
  // Dapatkan unique OS dari semua runners
  const availableOS = new Set(
    Array.from(connectedRunners.values()).map(r => r.os.toLowerCase())
  );
  
  // Filter master fingerprints berdasarkan OS yang tersedia
  const availablePlatforms = masterFingerprints.filter(fp => {
    const fpOS = (fp.os || '').toLowerCase();
    return availableOS.has(fpOS);
  });
  
  console.log(`[runnerManager] Available platforms: ${availablePlatforms.length} (from ${availableOS.size} OS types)`);
  return availablePlatforms;
}

/**
 * Get list semua runners (untuk admin/monitoring)
 */
function getAllRunners() {
  return Array.from(connectedRunners.values()).map(r => ({
    id: r.id,
    os: r.os,
    browser: r.browser,
    status: r.status,
    currentJobId: r.currentJobId,
    registeredAt: r.registeredAt,
    lastSeen: r.lastSeen
  }));
}

/**
 * Get runner info by ID
 */
function getRunnerInfo(runnerId) {
  return connectedRunners.get(runnerId) || null;
}

/**
 * Update runner heartbeat
 */
function updateRunnerHeartbeat(runnerId) {
  const runner = connectedRunners.get(runnerId);
  if (runner) {
    runner.lastSeen = new Date().toISOString();
  }
}

module.exports = {
  registerRunner,
  removeRunner,
  findAvailableRunner,
  dispatchJobToRunner,
  markRunnerIdle,
  getAvailablePlatforms,
  getAllRunners,
  getRunnerInfo,
  updateRunnerHeartbeat,
  loadMasterFingerprints
};
