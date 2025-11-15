/**
 * TRAFFICBUSTER RUNNER - runner.js
 * 
 * Aplikasi standalone yang menjalankan Playwright untuk TrafficBuster.
 * Terhubung ke Backend-Orchestrator via WebSocket dan menerima job.
 * 
 * FITUR:
 * - Auto-register ke Backend saat startup
 * - Menerima job dari Backend
 * - Eksekusi Playwright dengan human behavior simulation
 * - Kirim progress real-time ke Backend
 * - Retry connection jika Backend unavailable
 */

'use strict';

require('dotenv').config();
const WebSocket = require('ws');
const { chromium } = require('playwright');
const os = require('os');

// ========== KONFIGURASI ==========
const BE_HOST = process.env.BE_HOST || 'localhost:3000';
const RUNNER_API_KEY = process.env.RUNNER_API_KEY || 'default-runner-key-CHANGE-ME';
const RUNNER_OS = process.env.RUNNER_OS || detectOS();
const RUNNER_BROWSER = process.env.RUNNER_BROWSER || 'chrome';
const RECONNECT_DELAY = 5000; // 5 detik
const HEARTBEAT_INTERVAL = 30000; // 30 detik

// ========== STATE ==========
let ws = null;
let browserInstance = null;
let runnerId = null;
let currentJob = null;
let heartbeatTimer = null;
let reconnectTimer = null;

// ========== HELPER FUNCTIONS ==========

function detectOS() {
  const platform = os.platform();
  if (platform === 'win32') return 'windows';
  if (platform === 'darwin') return 'macos';
  if (platform === 'linux') return 'linux';
  return 'unknown';
}

function log(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, meta);
  
  // Forward log ke Backend jika ada job aktif
  if (ws && ws.readyState === WebSocket.OPEN && currentJob) {
    try {
      ws.send(JSON.stringify({
        type: 'log',
        jobId: currentJob.jobId,
        level: level,
        message: message,
        meta: meta
      }));
    } catch (e) {
      console.error(`Failed to forward log to backend: ${e.message}`);
    }
  }
}

async function getBrowser() {
  if (browserInstance) {
    return browserInstance;
  }
  
  log('info', 'Launching browser...');
  
  try {
    browserInstance = await chromium.launch({
      headless: process.env.HEADLESS !== 'false', // Default headless, set HEADLESS=false untuk headful
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    browserInstance.on('disconnected', () => {
      log('warn', 'Browser disconnected');
      browserInstance = null;
    });
    
    log('info', 'Browser launched successfully');
    return browserInstance;
    
  } catch (e) {
    log('error', `Failed to launch browser: ${e.message}`);
    throw e;
  }
}

async function closeBrowser() {
  if (browserInstance) {
    log('info', 'Closing browser...');
    try {
      await browserInstance.close();
    } catch (e) {
      log('warn', `Error closing browser: ${e.message}`);
    }
    browserInstance = null;
  }
}

// ========== FLOW EXECUTION ==========

function selectRandom(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

async function executeFlow(browser, target, jobConfig) {
  const { proxies = [], platforms = [], settings = {} } = jobConfig;
  const startTime = Date.now();
  
  let context;
  let selectedProxy = selectRandom(proxies.filter(p => p.enabled !== false));
  let selectedPlatform = selectRandom(platforms);
  
  // Default context options
  const contextOptions = {
    userAgent: selectedPlatform?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    viewport: { width: 1920, height: 1080 }
  };
  
  // Apply proxy if available
  if (selectedProxy) {
    contextOptions.proxy = {
      server: `${selectedProxy.host}:${selectedProxy.port}`,
      username: selectedProxy.username,
      password: selectedProxy.password
    };
    log('debug', `Using proxy: ${selectedProxy.host}:${selectedProxy.port}`);
  }
  
  // Apply platform viewport
  if (selectedPlatform && selectedPlatform.resolutions) {
    const res = selectRandom(selectedPlatform.resolutions);
    if (res && res.includes('x')) {
      const [w, h] = res.split('x').map(Number);
      if (w && h) {
        contextOptions.viewport = { width: w, height: h };
      }
    }
  }
  
  try {
    context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    
    // Navigate to target URL
    log('info', `Navigating to ${target.url}`);
    await page.goto(target.url, { timeout: 30000, waitUntil: 'domcontentloaded' });
    
    // ========== HUMAN BEHAVIOR SIMULATION ==========
    const humanSurfing = settings.humanSurfing || {};
    const sessionDuration = settings.sessionDuration || { min: 1000, max: 3000 };
    
    // Calculate dwell time
    const dwellMin = sessionDuration.min || 1000;
    const dwellMax = sessionDuration.max || 3000;
    const dwellTime = Math.floor(dwellMin + Math.random() * (dwellMax - dwellMin));
    
    // Auto scrolling
    if (humanSurfing.autoPageScrolling !== false) {
      log('debug', 'Auto scrolling...');
      await page.waitForTimeout(1000 + Math.random() * 2000);
      
      // Random scroll amount
      const scrollAmount = 500 + Math.random() * 1000;
      await page.mouse.wheel(0, scrollAmount);
      await page.waitForTimeout(500 + Math.random() * 1000);
    }
    
    // Dwell on page
    log('debug', `Dwelling for ${Math.round(dwellTime / 1000)}s...`);
    await page.waitForTimeout(dwellTime);
    
    // Auto clicking (if enabled)
    if (humanSurfing.autoClick) {
      const clickRatio = humanSurfing.clickRatio || 0.3;
      if (Math.random() < clickRatio) {
        log('debug', 'Attempting auto click...');
        try {
          const links = await page.$$('a[href]');
          if (links.length > 0) {
            const randomLink = links[Math.floor(Math.random() * links.length)];
            const href = await randomLink.getAttribute('href');
            
            // Check if internal or external
            const isInternal = href && (href.startsWith('/') || href.includes(new URL(target.url).hostname));
            
            if (isInternal || humanSurfing.allowExternalClick) {
              await randomLink.click({ timeout: 3000 });
              await page.waitForTimeout(2000 + Math.random() * 3000);
              log('debug', `Clicked link: ${href}`);
            }
          }
        } catch (e) {
          log('warn', `Click simulation failed: ${e.message}`);
        }
      }
    }
    
    // Close page and context
    await page.close();
    await context.close();
    
    const durationMs = Date.now() - startTime;
    log('info', `Flow completed for ${target.url} (Duration: ${durationMs}ms)`);
    
    return {
      success: true,
      targetId: target.id,
      durationMs: durationMs
    };
    
  } catch (e) {
    if (context) {
      try {
        await context.close();
      } catch (closeErr) {
        // Ignore close errors
      }
    }
    
    log('error', `Flow failed for ${target.url}: ${e.message}`);
    throw e;
  }
}

async function executeJob(jobConfig) {
  const { jobId, targets = [], settings = {} } = jobConfig;
  
  log('info', `Starting job ${jobId}`);
  log('info', `Total targets: ${targets.length}`);
  
  currentJob = { jobId: jobId, status: 'running', stats: { total: 0, done: 0, success: 0, fail: 0 } };
  
  try {
    const browser = await getBrowser();
    const instanceCount = settings.instanceCount || 1;
    
    log('info', `Running with ${instanceCount} parallel instances`);
    
    // Build work queue
    const workQueue = targets
      .filter(t => t.flowTarget > 0)
      .flatMap(t => Array(t.flowTarget || 0).fill(t));
    
    currentJob.stats.total = workQueue.length;
    
    if (workQueue.length === 0) {
      log('warn', 'No flows to execute (workQueue is empty)');
      sendJobComplete();
      return;
    }
    
    // Worker function
    const worker = async () => {
      while (workQueue.length > 0 && currentJob.status === 'running') {
        const target = workQueue.pop();
        if (!target) break;
        
        try {
          const result = await executeFlow(browser, target, jobConfig);
          
          currentJob.stats.done++;
          currentJob.stats.success++;
          
          // Send progress update to Backend
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'flowDoneUpdate',
              jobId: jobId,
              targetId: result.targetId,
              newFlowDone: currentJob.stats.done
            }));
          }
          
        } catch (flowError) {
          currentJob.stats.done++;
          currentJob.stats.fail++;
          log('error', `Flow failed: ${flowError.message}`);
        }
      }
    };
    
    // Run worker pool
    const workers = [];
    for (let i = 0; i < instanceCount; i++) {
      workers.push(worker());
    }
    
    await Promise.all(workers);
    
    if (currentJob.status === 'running') {
      log('info', `Job ${jobId} completed successfully`);
      sendJobComplete();
    }
    
  } catch (e) {
    log('error', `Job execution failed: ${e.message}`);
    sendJobComplete({ error: e.message });
  }
}

function sendJobComplete(extraData = {}) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  
  try {
    ws.send(JSON.stringify({
      type: 'jobComplete',
      jobId: currentJob.jobId,
      status: extraData.error ? 'failed' : 'completed',
      stats: currentJob.stats,
      ...extraData
    }));
    
    log('info', 'Job completion sent to backend');
  } catch (e) {
    log('error', `Failed to send job completion: ${e.message}`);
  }
  
  currentJob = null;
}

// ========== WEBSOCKET CONNECTION ==========

function connectToBackend() {
  const wsUrl = `ws://${BE_HOST}/ws/runner?apiKey=${encodeURIComponent(RUNNER_API_KEY)}`;
  
  log('info', `Connecting to Backend: ${BE_HOST}`);
  
  try {
    ws = new WebSocket(wsUrl);
    
    ws.on('open', () => {
      log('info', '✅ Connected to Backend-Orchestrator');
      
      // Send registration
      ws.send(JSON.stringify({
        type: 'register',
        os: RUNNER_OS,
        browser: RUNNER_BROWSER,
        capabilities: {
          headless: process.env.HEADLESS !== 'false',
          platform: os.platform(),
          arch: os.arch()
        }
      }));
      
      // Start heartbeat
      startHeartbeat();
      
      // Clear reconnect timer if any
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    });
    
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'registered') {
          runnerId = message.runnerId;
          log('info', `✅ Registered as runner: ${runnerId}`);
        }
        
        else if (message.type === 'newJob') {
          log('info', `📥 Received new job: ${message.jobConfig.jobId}`);
          
          // Send acknowledgment
          ws.send(JSON.stringify({
            type: 'jobAck',
            jobId: message.jobConfig.jobId,
            status: 'running'
          }));
          
          // Execute job
          await executeJob(message.jobConfig);
        }
        
        else if (message.type === 'stopJob') {
          log('info', `🛑 Received stop signal for job: ${message.jobId}`);
          if (currentJob && currentJob.jobId === message.jobId) {
            currentJob.status = 'stopped';
            sendJobComplete({ stopped: true });
          }
        }
        
        else if (message.type === 'heartbeatAck') {
          // Heartbeat acknowledged
        }
        
      } catch (e) {
        log('error', `Error processing message: ${e.message}`);
      }
    });
    
    ws.on('close', () => {
      log('warn', '❌ Connection to Backend closed');
      stopHeartbeat();
      scheduleReconnect();
    });
    
    ws.on('error', (err) => {
      log('error', `WebSocket error: ${err.message}`);
    });
    
  } catch (e) {
    log('error', `Failed to connect: ${e.message}`);
    scheduleReconnect();
  }
}

function startHeartbeat() {
  if (heartbeatTimer) return;
  
  heartbeatTimer = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'heartbeat' }));
    }
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  
  log('info', `Reconnecting in ${RECONNECT_DELAY / 1000} seconds...`);
  
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectToBackend();
  }, RECONNECT_DELAY);
}

// ========== SHUTDOWN HANDLER ==========

async function shutdown() {
  log('info', 'Shutting down runner...');
  
  stopHeartbeat();
  
  if (ws) {
    ws.close();
  }
  
  await closeBrowser();
  
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ========== STARTUP ==========

log('info', '='.repeat(60));
log('info', 'TRAFFICBUSTER RUNNER');
log('info', '='.repeat(60));
log('info', `OS: ${RUNNER_OS}`);
log('info', `Browser: ${RUNNER_BROWSER}`);
log('info', `Backend: ${BE_HOST}`);
log('info', '='.repeat(60));

connectToBackend();
