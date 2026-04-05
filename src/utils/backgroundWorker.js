/**
 * Background Worker Client
 *
 * Submits long-running LLM and image generation jobs to the
 * rpg-background-worker server plugin so they complete even if the browser
 * is closed. Falls back gracefully when the plugin is unavailable.
 */

import { getRequestHeaders } from '../../../../../../../script.js';

const PLUGIN_BASE = '/api/plugins/rpg-background-worker';
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

let _pluginAvailable = null; // null = unchecked, true/false = checked

/**
 * Checks whether the background worker plugin is installed and responding.
 * Result is cached for the session.
 * @returns {Promise<boolean>}
 */
export async function isBackgroundWorkerAvailable() {
    if (_pluginAvailable !== null) return _pluginAvailable;
    try {
        const resp = await fetch(`${PLUGIN_BASE}/health`, {
            method: 'GET',
            headers: getRequestHeaders(),
        });
        _pluginAvailable = resp.ok;
    } catch {
        _pluginAvailable = false;
    }
    if (!_pluginAvailable) {
        console.info('[RPG BG Worker] Plugin not available — background processing disabled.');
    }
    return _pluginAvailable;
}

/** Force re-check on next availability test (e.g. after server restart). */
export function resetAvailabilityCache() {
    _pluginAvailable = null;
}

/**
 * Submits a job to the background worker and returns the job ID.
 * @param {string} type - Job type ('tracker_update' | 'avatar_pipeline')
 * @param {object} payload - Job payload
 * @returns {Promise<string>} Job ID
 */
async function enqueueJob(type, payload) {
    const resp = await fetch(`${PLUGIN_BASE}/enqueue`, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ type, payload }),
    });
    if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`Background worker enqueue failed (${resp.status}): ${text}`);
    }
    const { jobId } = await resp.json();
    return jobId;
}

/**
 * Polls for job completion, resolving with the result or rejecting on failure.
 * If the browser closes while polling, the job continues server-side and the
 * result can be retrieved later via fetchCompletedJobs().
 *
 * @param {string} jobId
 * @param {object} [options]
 * @param {number} [options.timeoutMs]
 * @param {Function} [options.onProgress] - Called with progress string when available
 * @returns {Promise<object>} Job result
 */
async function waitForJob(jobId, { timeoutMs = POLL_TIMEOUT_MS, onProgress } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        try {
            const resp = await fetch(`${PLUGIN_BASE}/jobs/${jobId}`, {
                headers: getRequestHeaders(),
            });
            if (!resp.ok) continue;
            const job = await resp.json();
            if (job.progress && onProgress) onProgress(job.progress);
            if (job.status === 'completed') return job.result;
            if (job.status === 'failed') throw new Error(`Background job failed: ${job.error}`);
            // pending | running → keep polling
        } catch (err) {
            if (err.message.startsWith('Background job failed:')) throw err;
            // Network error → retry
        }
    }
    throw new Error('Background job timed out');
}

/**
 * Deletes a job from the server (clean-up after results are consumed).
 * @param {string} jobId
 */
export async function deleteJob(jobId) {
    try {
        await fetch(`${PLUGIN_BASE}/jobs/${jobId}`, {
            method: 'DELETE',
            headers: getRequestHeaders(),
        });
    } catch { /* best-effort */ }
}

/**
 * Fetches all completed jobs from the server.
 * Used on startup to pick up results from jobs that ran while the browser was closed.
 * @returns {Promise<Array<{id, type, result, error, status}>>}
 */
export async function fetchAllJobs() {
    try {
        const resp = await fetch(`${PLUGIN_BASE}/jobs`, { headers: getRequestHeaders() });
        if (!resp.ok) return [];
        return await resp.json();
    } catch {
        return [];
    }
}

// ─── High-level API ───────────────────────────────────────────────────────────

/**
 * Runs a tracker update LLM call via the background worker.
 * If the browser closes mid-call, the job continues server-side.
 *
 * @param {Array} messages - Pre-built message array for the LLM
 * @param {object} apiConfig - { baseUrl, model, maxTokens, temperature, apiKey }
 * @param {object} [stOptions] - { stBaseUrl, authHeaders } for ST-internal mode
 * @param {string} [mode] - 'external' | 'st' (default 'external')
 * @returns {Promise<string>} LLM response text
 */
export async function runTrackerUpdateInBackground(messages, apiConfig, stOptions = {}, mode = 'external', preGeneratedResponse = null) {
    const internalHeaders = getRequestHeaders();
    internalHeaders['X-ST-Internal'] = 'true';

    const jobId = await enqueueJob('tracker_update', {
        mode,
        messages,
        apiConfig,
        preGeneratedResponse,
        stBaseUrl: stOptions.stBaseUrl || `http://127.0.0.1:${window.location.port || (window.location.protocol === 'https:' ? '443' : '80')}`,
        authHeaders: stOptions.authHeaders || internalHeaders,
    });
    const result = await waitForJob(jobId);
    await deleteJob(jobId);
    return result.response;
}

/**
 * Runs a full avatar generation pipeline (LLM prompt + ComfyUI image + optional expressions)
 * via the background worker.
 *
 * @param {object} params
 * @param {string} params.characterName
 * @param {string} params.folderName - Sanitized folder name for expression sprites
 * @param {Array}  params.llmMessages - Pre-built messages for the avatar prompt LLM call
 * @param {string} params.mode - 'external' | 'st'
 * @param {object} params.apiConfig - External LLM config
 * @param {object} params.stOptions - { stBaseUrl, authHeaders } for ST mode
 * @param {object} params.imageConfig - { comfyUrl, apiWorkflow, characterDescriptionNodeId, removeSpriteBg }   
 * @param {object} params.expressionConfig - { enabled, expressions, modifiers }
 * @param {Function} [params.onProgress]
 * @returns {Promise<{imagePath: string, expressionPaths: object, avatarPrompt: string}>}
 */
export async function runAvatarPipelineInBackground(params) {
    const {
        characterName, folderName, llmMessages, mode,
        apiConfig, stOptions = {}, imageConfig, expressionConfig,
        preGeneratedResponse,
        onProgress,
    } = params;

    const internalHeaders = getRequestHeaders();
    internalHeaders['X-ST-Internal'] = 'true';

    const jobId = await enqueueJob('avatar_pipeline', {
        characterName,
        folderName,
        llmMessages,
        mode,
        apiConfig,
        stBaseUrl: stOptions.stBaseUrl || `http://127.0.0.1:${window.location.port || (window.location.protocol === 'https:' ? '443' : '80')}`,
        authHeaders: stOptions.authHeaders || internalHeaders,
        imageConfig,
        expressionConfig,
        preGeneratedResponse,
    });
    const result = await waitForJob(jobId, { onProgress });
    await deleteJob(jobId);
    return result;
}
