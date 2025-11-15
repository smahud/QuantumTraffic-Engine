/**
 * BACKEND - lib/jobManager.js (REFACTORED - DELEGATOR)
 * 
 * PERUBAHAN ARSITEKTUR:
 * - Job Manager sekarang adalah DELEGATOR, bukan EXECUTOR
 * - Tidak lagi memanggil playwrightEngine atau menjalankan Playwright lokal
 * - Mendelegasikan job ke Runner yang sesuai via runnerManager
 * - Menerima progress updates dari Runner via WebSocket
 * 
 * Credit: Refactor Arsitektur - 2025
 */

'use strict';

const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const { EventEmitter } = require('events');
const datasetStore = require('./datasetStore'); 
const historyManager = require('./historyManager');
const runnerManager = require('./runnerManager');

const JOBS_DIR = path.join(__dirname, '..', 'jobs');
const MAX_CONCURRENT_JOBS_PER_USER = 1;

const jobs = new Map(); // <jobId, Job>
const userJobs = new Map(); // <userId, Set<jobId>>

class Job extends EventEmitter {
  constructor(user, matrix, datasetRefs) {
    super();
    this.jobId = 'job_' + crypto.randomBytes(8).toString('hex');
    this.userId = user.username;
    this.status = 'pending';
    this.matrix = matrix;
    this.datasetRefs = datasetRefs;
    this.config = null;
    this.historyId = null;
    this.assignedRunnerId = null; // Runner yang menjalankan job ini
    this.stats = {
      totalFlows: 0,
      doneFlows: 0,
      totalClicks: 0,
      doneClicks: 0,
      success: 0,
      fail: 0,
      startTime: null
    };
    this.emitToUser = (type, payload) => {
      console.warn(`[Job ${this.jobId}] emitToUser (unpatched): ${type}`);
    };
  }

  async loadAsync() {
    this.status = 'loading';
    this.emitStatus();

    const { targetSet, proxySet, platformSet, settingsProfile, overrides } = this.datasetRefs;
    const userId = this.userId;

    try {
      // 1. Muat Settings (WAJIB)
      const settings = await datasetStore.getDataset(userId, 'settings', settingsProfile);
      if (!settings || typeof settings !== 'object') {
        throw new Error(`DATASET_NOT_FOUND: settings profile '${settingsProfile}' not found or empty`);
      }
      
      // 2. Muat Targets (WAJIB)
      const targets = await datasetStore.getDataset(userId, 'targets', targetSet);
      if (!targets || targets.length === 0) {
        throw new Error(`DATASET_NOT_FOUND: targets dataset '${targetSet}' not found or empty`);
      }

      // 3. Muat Proxies (Opsional)
      let proxies = [];
      if (proxySet) {
        if (!this.matrix.allowProxies) {
           throw new Error(`VALIDATION_ERROR: License does not allow proxies (feature: allowProxies)`);
        }
        try {
           proxies = await datasetStore.getDataset(userId, 'proxies', proxySet);
        } catch(e) {
           if (e.message === 'DATASET_NOT_FOUND') {
             this.emitLog('warn', `Proxy set '${proxySet}' not found, continuing without proxies.`);
           } else throw e;
        }
      }
      
      // 4. Muat Platforms (Opsional)
      let platforms = [];
      if (platformSet) {
        if (!this.matrix.allowPlatformCustom) {
           throw new Error(`VALIDATION_ERROR: License does not allow custom platforms (feature: allowPlatformCustom)`);
        }
         try {
           platforms = await datasetStore.getDataset(userId, 'platforms', platformSet);
         } catch(e) {
           if (e.message === 'DATASET_NOT_FOUND') {
             this.emitLog('warn', `Platform set '${platformSet}' not found, continuing without platforms.`);
           } else throw e;
         }
      }

      // 5. Gabungkan dan terapkan Overrides
      this.config = {
        ...settings, 
        ...overrides, 
        
        loadedData: {
          targets: targets,
          proxies: proxies,
          platforms: platforms
        }
      };
      
      this.stats.totalFlows = targets.reduce((sum, t) => sum + (t.flowTarget || 0), 0);
      this.stats.totalClicks = targets.reduce((sum, t) => sum + (t.clickTarget || 0), 0);
      
      try {
        await fs.mkdir(JOBS_DIR, { recursive: true });
        const jobFile = path.join(JOBS_DIR, `${this.jobId}.json`);
        await fs.writeFile(jobFile, JSON.stringify(this.config, null, 2), 'utf8');
      } catch (e) {
        console.warn(`[Job ${this.jobId}] Failed to save job config snapshot: ${e.message}`);
      }

    } catch (e) {
      this.status = 'failed';
      this.emitStatus();
      this.emitLog('error', `Failed to load job data: ${e.message}`);
      throw e; 
    }
  }

  /**
   * REFACTORED: Start job dengan mendelegasikan ke Runner
   * Tidak lagi menjalankan Playwright lokal!
   */
  async startDelegated() {
    this.status = 'running';
    this.stats.startTime = Date.now();
    this.emitStatus();
    this.emitLog('info', 'Job started - delegating to Runner');
    this.emitLog('info', `Total flows to execute: ${this.stats.totalFlows}`);
    this.emitLog('info', `Total clicks to execute: ${this.stats.totalClicks}`);
    
    // Tentukan platform request dari config
    let platformRequest = null;
    if (this.config.loadedData.platforms && this.config.loadedData.platforms.length > 0) {
      const firstPlatform = this.config.loadedData.platforms[0];
      platformRequest = {
        os: firstPlatform.os || firstPlatform.osDevice || 'windows',
        browser: firstPlatform.browser || 'chrome'
      };
      this.emitLog('info', `Requesting runner: ${platformRequest.os}/${platformRequest.browser}`);
    }
    
    // Cari Runner yang tersedia
    const runner = runnerManager.findAvailableRunner(platformRequest);
    
    if (!runner) {
      const errorMsg = platformRequest 
        ? `No available ${platformRequest.os}/${platformRequest.browser} runner online`
        : 'No available runners online';
      
      this.emitLog('error', errorMsg);
      this.status = 'failed';
      this.emitStatus();
      
      // Update history
      if (this.historyId) {
        historyManager.updateHistory(this.historyId, {
          stopTime: new Date().toISOString(),
          status: 'failed',
          duration: 0
        });
      }
      
      this.cleanup();
      return;
    }
    
    this.assignedRunnerId = runner.id;
    this.emitLog('info', `Job assigned to runner: ${runner.id} (${runner.os}/${runner.browser})`);
    
    // Dispatch job ke Runner
    try {
      const jobConfig = {
        jobId: this.jobId,
        userId: this.userId,
        targets: this.config.loadedData.targets,
        proxies: this.config.loadedData.proxies,
        platforms: this.config.loadedData.platforms,
        settings: {
          instanceCount: Math.min(
            this.config.instanceCount || 1,
            this.matrix.maxInstances || 1
          ),
          humanSurfing: this.config.humanSurfing || {},
          sessionDuration: this.config.sessionDuration || { min: 1000, max: 3000 },
          delayBetweenFlows: this.config.delayBetweenFlows || { min: 1000, max: 2000 }
        }
      };
      
      runnerManager.dispatchJobToRunner(runner.id, jobConfig);
      this.emitLog('info', 'Job dispatched to runner successfully');
      
    } catch (e) {
      this.emitLog('error', `Failed to dispatch job to runner: ${e.message}`);
      this.status = 'failed';
      this.emitStatus();
      
      if (this.historyId) {
        historyManager.updateHistory(this.historyId, {
          stopTime: new Date().toISOString(),
          status: 'failed',
          duration: 0
        });
      }
      
      this.cleanup();
    }
  }
  
  stop() {
    if (this.status === 'stopped' || this.status === 'failed' || this.status === 'stopping') {
      return;
    }
    
    this.status = 'stopping';
    this.emitStatus();
    this.emitLog('info', 'Job stopping...');

    // Jika job sedang dijalankan oleh Runner, kirim signal stop
    if (this.assignedRunnerId) {
      const runner = runnerManager.getRunnerInfo(this.assignedRunnerId);
      if (runner && runner.socket) {
        try {
          runner.socket.send(JSON.stringify({
            type: 'stopJob',
            jobId: this.jobId
          }));
          this.emitLog('info', 'Stop signal sent to runner');
        } catch (e) {
          console.warn(`[Job ${this.jobId}] Failed to send stop signal to runner: ${e.message}`);
        }
      }
    }

    setTimeout(() => {
      this.status = 'stopped';
      this.emitStatus();
      this.emitLog('info', 'Job stopped.');
      
      // Update history on stop
      if (this.historyId) {
        const stopTime = new Date().toISOString();
        const duration = this.stats.startTime 
          ? Math.floor((Date.now() - this.stats.startTime) / 1000) 
          : 0;
        
        historyManager.updateHistory(this.historyId, {
          stopTime: stopTime,
          status: 'stopped',
          duration: duration,
          stats: {
            totalFlow: this.stats.totalFlows,
            flowDone: this.stats.doneFlows,
            impressions: this.stats.doneFlows,
            clicks: this.stats.doneClicks,
            failedFlow: this.stats.fail
          }
        });
      }
      
      this.cleanup();
    }, 500); 
  }

  cleanup() {
    jobs.delete(this.jobId);
    const uJobs = userJobs.get(this.userId);
    if (uJobs) {
      uJobs.delete(this.jobId);
      if (uJobs.size === 0) {
        userJobs.delete(this.userId);
      }
    }
    
    // Mark runner as idle if still assigned
    if (this.assignedRunnerId) {
      runnerManager.markRunnerIdle(this.assignedRunnerId);
    }
    
    this.removeAllListeners();
  }

  emitStatus() {
    this.emitToUser('jobStatusUpdate', this.getStatusPayload());
  }

  emitLog(level, message, meta = {}) {
    this.emitToUser('log', { level, message, ...meta, ts: new Date().toISOString() });
  }

  getStatusPayload() {
    return {
      jobId: this.jobId,
      status: this.status,
      stats: this.stats,
      historyId: this.historyId,
      assignedRunnerId: this.assignedRunnerId,
      configSummary: {
        instanceCount: this.config?.instanceCount || 0,
        targets: this.datasetRefs.targetSet,
        proxies: this.datasetRefs.proxySet || 'None',
        platforms: this.datasetRefs.platformSet || 'None',
        settings: this.datasetRefs.settingsProfile,
      }
    };
  }
}

/**
 * Create job dengan race condition check & history creation
 */
async function createJob(user, matrix, datasetRefs) {
  const userId = user.username;
  
  // Race condition check: Stop previous job
  const existingJobs = listJobsForUser(userId);
  if (existingJobs.length > 0) {
    console.log(`[jobManager] User ${userId} has ${existingJobs.length} active job(s), stopping them first`);
    
    for (const existingJob of existingJobs) {
      const job = jobs.get(existingJob.jobId);
      if (job) {
        if (job.historyId) {
          const stopTime = new Date().toISOString();
          const duration = job.stats.startTime 
            ? Math.floor((Date.now() - job.stats.startTime) / 1000) 
            : 0;
          
          historyManager.updateHistory(job.historyId, {
            stopTime: stopTime,
            status: 'stopped',
            duration: duration,
            stats: {
              totalFlow: job.stats.totalFlows,
              flowDone: job.stats.doneFlows,
              impressions: job.stats.doneFlows,
              clicks: job.stats.doneClicks,
              failedFlow: job.stats.fail
            }
          });
        }
        
        job.stop();
      }
    }
    
    console.log('[jobManager] Waiting 2 seconds before starting new job...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  const userJobSet = userJobs.get(userId) || new Set();
  if (userJobSet.size >= MAX_CONCURRENT_JOBS_PER_USER) {
    throw new Error('JOB_LIMIT_REACHED');
  }

  const job = new Job(user, matrix, datasetRefs);
  await job.loadAsync();
  
  // Create history entry
  const historyId = `hist_${Date.now()}_${userId}_${Math.random().toString(36).substr(2, 9)}`;
  const startTime = new Date().toISOString();
  
  const historyEntry = {
    id: historyId,
    userId: userId,
    jobId: job.jobId,
    scheduleId: datasetRefs.scheduleId || null,
    startTime: startTime,
    stopTime: null,
    duration: 0,
    status: 'running',
    stats: {
      totalFlow: job.stats.totalFlows,
      flowDone: 0,
      impressions: 0,
      clicks: 0,
      failedFlow: 0
    },
    config: {
      targetSet: datasetRefs.targetSet,
      proxySet: datasetRefs.proxySet || null,
      platformSet: datasetRefs.platformSet || null,
      settingsProfile: datasetRefs.settingsProfile,
      instanceCount: job.config?.instanceCount || 1
    }
  };
  
  historyManager.addHistory(historyEntry);
  job.historyId = historyId;
  
  console.log(`[jobManager] Created job ${job.jobId} with history ${historyId}`);

  jobs.set(job.jobId, job);
  userJobSet.add(job.jobId);
  userJobs.set(userId, userJobSet);

  // REFACTORED: Start dengan delegasi ke Runner
  await job.startDelegated();

  return job.getStatusPayload();
}

function stopJob(userId, jobId) {
  const job = jobs.get(jobId);
  if (job && job.userId === userId && (job.status === 'running' || job.status === 'loading')) {
    job.stop();
    return job.getStatusPayload();
  }
  return null;
}

function stopAllJobsForUser(userId) {
  const jobIds = userJobs.get(userId) || new Set();
  let count = 0;
  for (const jobId of jobIds) {
    if (stopJob(userId, jobId)) {
      count++;
    }
  }
  return count;
}

function listJobsForUser(userId) {
  const jobIds = userJobs.get(userId) || new Set();
  return Array.from(jobIds).map(jobId => {
    const job = jobs.get(jobId);
    return job ? job.getStatusPayload() : null;
  }).filter(Boolean);
}

function getJobStatus(userId, jobId) {
  const job = jobs.get(jobId);
  if (job && job.userId === userId) {
    return job.getStatusPayload();
  }
  return null;
}

function getJobInstance(jobId) {
  return jobs.get(jobId) || null;
}

module.exports = {
  createJob,
  stopJob,
  stopAllJobsForUser,
  listJobsForUser,
  getJobStatus,
  getJobInstance 
};
