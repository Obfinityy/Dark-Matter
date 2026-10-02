import { getApiBase } from './backendMode.js';

/** API base URL — resolved at request time so Settings mode-switches apply instantly. */
function apiBase() {
  return getApiBase();
}

/**
 * JWT storage. The backend accepts BOTH the stateless JWT (Authorization
 * header) and the stateful session cookie — the header is preferred because
 * it also authenticates EventSource streams and cross-tab requests.
 */
const JWT_KEY = 'dm_jwt';

export function getStoredJwt() {
  try { return localStorage.getItem(JWT_KEY); } catch { return null; }
}

export function storeJwt(jwt) {
  try {
    if (jwt) localStorage.setItem(JWT_KEY, jwt);
    else localStorage.removeItem(JWT_KEY);
  } catch { /* storage unavailable — cookie auth still works */ }
}

export class ApiError extends Error {
  constructor(message, status = 0, code = 'REQUEST_FAILED') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request(path, options = {}) {
  const jwt = getStoredJwt();
  const headers = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    ...(options.headers || {})
  };

  let response;
  try {
    response = await fetch(`${apiBase()}${path}`, { ...options, headers, credentials: 'include' });
  } catch {
    throw new ApiError('DarkMatter backend is unavailable. Start the backend on port 4000 and try again.', 0, 'BACKEND_UNAVAILABLE');
  }

  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    throw new ApiError(
      body?.error?.message || `Backend request failed with status ${response.status}.`,
      response.status,
      body?.error?.code || 'REQUEST_FAILED'
    );
  }

  return body;
}

function cleanTargetCandidate(value) {
  return String(value || '')
    .trim()
    .replace(/^[([{<]+|[\])}>,;!?]+$/g, '');
}

export function normalizeTargetUrl(value) {
  const candidate = cleanTargetCandidate(value);
  if (!candidate) return '';
  if (/^https?:\/\//i.test(candidate)) return candidate;
  if (/^\/\//.test(candidate)) return `https:${candidate}`;
  return `https://${candidate}`;
}

export function extractTargetUrl(value) {
  const candidate = String(value || '').match(/(?:https?:\/\/|www\.)[^\s<>()]+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:\/[^\s<>()]*)?/i)?.[0];
  return normalizeTargetUrl(candidate);
}

// ─── Auth ─────────────────────────────────────────────────────────

export function getCurrentUser() {
  return request('/auth/me');
}

/**
 * Register. Payload: { email, password, name?, username? }.
 * The backend returns { user, token, jwt, jwtExpiresAt } — the JWT is stored
 * for the Authorization header; the session cookie is set by the response.
 */
export async function registerAccount(payload) {
  const body = await request('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
  if (body?.jwt) storeJwt(body.jwt);
  return body;
}

/**
 * Login with username OR email + password. Payload: { login, password }.
 */
export async function loginAccount(payload) {
  const body = await request('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
  if (body?.jwt) storeJwt(body.jwt);
  return body;
}

export async function logoutAccount() {
  try {
    await request('/auth/logout', { method: 'POST' });
  } finally {
    storeJwt(null);
  }
}

export function updateProfile(payload) {
  return request('/auth/me', { method: 'PUT', body: JSON.stringify(payload) });
}

export function changePassword(payload) {
  return request('/auth/password', { method: 'PUT', body: JSON.stringify(payload) });
}

// ─── Settings ─────────────────────────────────────────────────────

export function getProviders() {
  return request('/settings/providers');
}

export function getLocalAiHealth() {
  return request('/health/local-ai');
}

export function sendDirectChat(message, conversationId, truncateIndex = undefined) {
  return request('/infinite/chat', {
    method: 'POST',
    body: JSON.stringify({ message, conversationId, truncateIndex })
  });
}

export async function streamDirectChat(message, conversationId, truncateIndex, handlers = {}) {
  const { onState, onToken, onDone, onError } = handlers;
  try {
    const res = await fetch(`${apiBase()}/infinite/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      credentials: 'include',
      body: JSON.stringify({ message, conversationId, truncateIndex, stream: true })
    });

    if (!res.ok) {
      const errText = await res.text();
      let parsed = {};
      try { parsed = JSON.parse(errText); } catch(e) {}
      throw new Error(parsed?.error?.message || `HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (buffer.trim().startsWith('data: ')) {
          try {
            const data = JSON.parse(buffer.trim().slice(6));
            if (data.type === 'done' && onDone) onDone(data);
          } catch (e) {}
        }
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.type === 'state' && onState) {
              onState(data);
            } else if (data.type === 'token' && onToken) {
              onToken(data.delta, data.content);
            } else if (data.type === 'done' && onDone) {
              onDone(data);
            } else if (data.type === 'error' && onError) {
              onError(new Error(data.message));
            }
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    if (onError) onError(err);
    else throw err;
  }
}

export function getInfiniteHistory(conversationId) {
  return request(`/infinite/chat/${conversationId}`);
}

/** Agent permission mode prefs — backend contract for services/permissions.js. */
export function getPermissionModePrefs() {
  return request('/users/me/permissions');
}
export function setPermissionModePrefs(permissionMode) {
  return request('/users/me/permissions', {
    method: 'PUT',
    body: JSON.stringify({ permissionMode })
  });
}

// ─── Infinity Long-Context Engine ───────────────────────────────────

export function ingestDocument(conversationId, content, { title, kind, summarize } = {}) {
  return request('/infinite/ingest', {
    method: 'POST',
    body: JSON.stringify({ conversationId, content, title, kind, summarize })
  });
}

export function getIngestion(conversationId, inputId) {
  return request(`/infinite/ingest/${conversationId}/${inputId}`);
}

export function searchChunks(conversationId, query) {
  return request(`/infinite/search/${conversationId}`, {
    method: 'POST',
    body: JSON.stringify({ query })
  });
}

export function getExactChunk(conversationId, inputId, chunkRef) {
  return request(`/infinite/chunk/${conversationId}/${inputId}/${chunkRef}`);
}

export function summarizeDocument(conversationId, inputId) {
  return request(`/infinite/summarize/${conversationId}/${inputId}`, { method: 'POST' });
}

export function startGeneration(conversationId, genRequest, artifactHint) {
  return request('/infinite/generations', {
    method: 'POST',
    body: JSON.stringify({ conversationId, request: genRequest, artifactHint })
  });
}

export function getGeneration(generationId) {
  return request(`/infinite/generations/${generationId}`);
}

export function cancelGeneration(generationId) {
  return request(`/infinite/generations/${generationId}/cancel`, { method: 'POST' });
}

export function resumeGeneration(generationId) {
  return request(`/infinite/generations/${generationId}/resume`, { method: 'POST' });
}

export function listGenerations(conversationId) {
  const q = conversationId ? `?conversationId=${encodeURIComponent(conversationId)}` : '';
  return request(`/infinite/generations${q}`);
}

// ─── Infinity AI modes (plan / build / control) ──────────────────────────

/** Plan mode: NL idea → numbered step-by-step plan (planning only, never executes). */
export function planWithInfinity(instruction, conversationId) {
  return request('/infinite/plan', {
    method: 'POST',
    body: JSON.stringify({ instruction, conversationId })
  });
}

/** Build mode: generate a real project from a brief inside the agent workspace sandbox. */
export function buildWithInfinity(brief, conversationId) {
  return request('/infinite/build', {
    method: 'POST',
    body: JSON.stringify({ action: 'create', brief, conversationId })
  });
}

/** Build mode: list files in the sandboxed agent workspace. */
export function listWorkspaceFiles(subdir = '') {
  return request('/infinite/build', {
    method: 'POST',
    body: JSON.stringify({ action: 'list', subdir })
  });
}

/** Build mode: read one file from the sandboxed agent workspace. */
export function readWorkspaceFile(path) {
  return request('/infinite/build', {
    method: 'POST',
    body: JSON.stringify({ action: 'read', path })
  });
}

/**
 * Control mode: NL desktop command → validated GUI plan → executed.
 * @param {boolean} dryRun    validate + return the plan, execute nothing.
 * @param {boolean} simulate  run through the mock adapter (safe anywhere).
 */
export function controlComputer(instruction, conversationId, { dryRun = false, simulate = true } = {}) {
  return request('/infinite/control', {
    method: 'POST',
    body: JSON.stringify({ instruction, conversationId, dryRun, simulate })
  });
}

export function updateProviders(providers) {
  return request('/settings/providers', {
    method: 'PUT',
    body: JSON.stringify({ providers })
  });
}

// ─── Legacy Agent (old scan system) ───────────────────────────────

export function sendAgentMessage(payload) {
  return request('/agent/messages', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getScans() {
  return request('/scans');
}

export function getTools() {
  return request('/tools');
}

export function getScan(scanId) {
  return request(`/scans/${encodeURIComponent(scanId)}`);
}

export function subscribeToScanEvents(scanId, { onOpen, onEvent, onError } = {}) {
  const source = new EventSource(`${apiBase()}/scans/${encodeURIComponent(scanId)}/events`, { withCredentials: true });
  const eventTypes = [
    'scan.created', 'scan.phase', 'agent.plan', 'tool.requested',
    'tool.started', 'tool.completed', 'tool.failed', 'scan.failed', 'scan.cancelled'
  ];

  const handleEvent = (event) => {
    try {
      onEvent?.(JSON.parse(event.data));
    } catch {
      onError?.(new ApiError('Received an invalid event from the backend.', 0, 'INVALID_EVENT'));
    }
  };

  eventTypes.forEach((eventType) => source.addEventListener(eventType, handleEvent));
  source.onmessage = handleEvent;
  source.onopen = () => onOpen?.();
  source.onerror = () => onError?.(new ApiError('Live terminal connection was interrupted.', 0, 'EVENT_STREAM_UNAVAILABLE'));

  return () => {
    eventTypes.forEach((eventType) => source.removeEventListener(eventType, handleEvent));
    source.close();
  };
}

// ─── Assessment System ────────────────────────────────────────────

/** Create a new assessment and start the agent. */
export function createAssessment(payload) {
  return request('/assessments', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

/** List all assessments. */
export function listAssessments() {
  return request('/assessments');
}

/** Get assessment details. */
export function getAssessment(assessmentId) {
  return request(`/assessments/${encodeURIComponent(assessmentId)}`);
}

/** Start / resume an assessment. */
export function startAssessment(assessmentId) {
  return request(`/assessments/${encodeURIComponent(assessmentId)}/start`, { method: 'POST' });
}

/** Pause an assessment. */
export function pauseAssessment(assessmentId) {
  return request(`/assessments/${encodeURIComponent(assessmentId)}/pause`, { method: 'POST' });
}

/** Resume an assessment. */
export function resumeAssessment(assessmentId) {
  return request(`/assessments/${encodeURIComponent(assessmentId)}/resume`, { method: 'POST' });
}

/** Stop an assessment. */
export function stopAssessment(assessmentId) {
  return request(`/assessments/${encodeURIComponent(assessmentId)}/stop`, { method: 'POST' });
}

/** Get full investigation timeline. */
export function getAssessmentTimeline(assessmentId) {
  return request(`/assessments/${encodeURIComponent(assessmentId)}/timeline`);
}

/** Get assessment findings. */
export function getAssessmentFindings(assessmentId) {
  return request(`/assessments/${encodeURIComponent(assessmentId)}/findings`);
}

/** Get tool execution history. */
export function getAssessmentToolExecutions(assessmentId) {
  return request(`/assessments/${encodeURIComponent(assessmentId)}/tool-executions`);
}

/** Send a chat message to the assessment. */
export function sendAssessmentChat(assessmentId, message) {
  return request(`/assessments/${encodeURIComponent(assessmentId)}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message })
  });
}

/** Generate a report for the assessment. */
export function generateReport(assessmentId) {
  return request(`/assessments/${encodeURIComponent(assessmentId)}/report`, { method: 'POST' });
}

/** Get latest report. */
export function getLatestReport(assessmentId) {
  return request(`/assessments/${encodeURIComponent(assessmentId)}/report`);
}

/** List all report versions. */
export function listReportVersions(assessmentId) {
  return request(`/assessments/${encodeURIComponent(assessmentId)}/reports`);
}

/** List all user reports. */
export function listAllReports() {
  return request('/reports');
}

/** Subscribe to live assessment events via SSE. */
export function subscribeToAssessmentEvents(assessmentId, { onOpen, onEvent, onError } = {}) {
  const source = new EventSource(
    `${apiBase()}/assessments/${encodeURIComponent(assessmentId)}/events`,
    { withCredentials: true }
  );

  const handleEvent = (event) => {
    try {
      onEvent?.(JSON.parse(event.data));
    } catch {
      onError?.(new ApiError('Received an invalid event.', 0, 'INVALID_EVENT'));
    }
  };

  // Listen for all assessment event types
  const eventTypes = [
    'ASSESSMENT_CREATED', 'SCOPE_VALIDATED', 'AGENT_STARTED', 'PLAN_CREATED',
    'TOOL_REQUESTED', 'TOOL_STARTED', 'TOOL_COMPLETED', 'TOOL_FAILED',
    'TOOL_BLOCKED', 'TOOL_DEDUPLICATED', 'RESULT_PARSED',
    'OBSERVATION_CREATED', 'HYPOTHESIS_CREATED', 'HYPOTHESIS_UPDATED',
    'FINDING_CREATED', 'FINDING_VALIDATED', 'EVIDENCE_ADDED',
    'AGENT_DECISION', 'AGENT_CRASHED', 'PHASE_CHANGED', 'CHECKPOINT_SAVED',
    'ASSESSMENT_PAUSED', 'ASSESSMENT_RESUMED', 'ASSESSMENT_STOPPED',
    'ASSESSMENT_COMPLETED', 'ASSESSMENT_FAILED',
    'REPORT_GENERATION_STARTED', 'REPORT_GENERATED'
  ];

  eventTypes.forEach((type) => source.addEventListener(type, handleEvent));
  source.onmessage = handleEvent;
  source.onopen = () => onOpen?.();
  source.onerror = () => onError?.(new ApiError('Assessment event stream was interrupted.', 0, 'EVENT_STREAM_ERROR'));

  return () => {
    eventTypes.forEach((type) => source.removeEventListener(type, handleEvent));
    source.close();
  };
}

// ─── Autonomous Bug Bounty Agent (persistent jobs) ────────────────

/** Create an autonomous assessment job. Returns as soon as the job is queued. */
export function createJob(payload) {
  return request('/jobs', { method: 'POST', body: JSON.stringify(payload) });
}

/** List this user's autonomous jobs. */
export function listJobs() {
  return request('/jobs');
}

/** Full job state snapshot — the rehydration call after a refresh or reopen. */
export function getJobState(jobId) {
  return request(`/jobs/${encodeURIComponent(jobId)}`);
}

/** The job's live activity feed (the terminal). */
export function getJobActivity(jobId, limit = 300) {
  return request(`/jobs/${encodeURIComponent(jobId)}/activity?limit=${limit}`);
}

/** Posture score for the hunt's target, computed from real findings. */
export function getJobPosture(jobId) {
  return request(`/jobs/${encodeURIComponent(jobId)}/posture`);
}

/** Replayable event history — used to backfill anything missed while closed. */
export function getJobEventHistory(jobId, { after, limit = 500 } = {}) {
  const query = new URLSearchParams();
  if (after) query.set('after', after);
  query.set('limit', String(limit));
  return request(`/jobs/${encodeURIComponent(jobId)}/events/history?${query.toString()}`);
}

/** Pause: stop after the current safe atomic operation and persist state. */
export function pauseJob(jobId) {
  return request(`/jobs/${encodeURIComponent(jobId)}/pause`, { method: 'POST' });
}

/** Continue a paused job from its persisted checkpoint. */
export function continueJob(jobId) {
  return request(`/jobs/${encodeURIComponent(jobId)}/continue`, { method: 'POST' });
}

/** Resume an interrupted/waiting job (restart, phone outage, reconnect). */
export function resumeJob(jobId) {
  return request(`/jobs/${encodeURIComponent(jobId)}/resume`, { method: 'POST' });
}

/** Cancel permanently. Assessment history is preserved. */
export function cancelJob(jobId) {
  return request(`/jobs/${encodeURIComponent(jobId)}/cancel`, { method: 'POST' });
}

/** Ask the running agent about its own assessment. */
export function askJob(jobId, message) {
  return request(`/jobs/${encodeURIComponent(jobId)}/ask`, {
    method: 'POST',
    body: JSON.stringify({ message })
  });
}

/** Computer-control runtime status (the "hands" layer). */
export function getComputerStatus() {
  return request('/computer');
}

/** Take a live screenshot (read-only — for the screen viewer). */
export function takeComputerScreenshot({ includeBase64 = true } = {}) {
  return request('/computer/screenshot', {
    method: 'POST',
    body: JSON.stringify({ includeBase64 })
  });
}

/** Pause computer control from the website (agent stops clicking/typing). */
export function pauseComputer() {
  return request('/computer/pause', { method: 'POST' });
}

/** Resume computer control from the website. */
export function resumeComputer() {
  return request('/computer/resume', { method: 'POST' });
}

// ─── InfiniteChat Computer Tasks (natural-language desktop control) ──

export function createComputerTask(instruction, conversationId, followUpHint = null) {
  return request('/computer-tasks', {
    method: 'POST',
    body: JSON.stringify({ instruction, conversationId, followUpHint })
  });
}

export function listComputerTasks(conversationId = null) {
  const q = conversationId ? `?conversationId=${encodeURIComponent(conversationId)}` : '';
  return request(`/computer-tasks${q}`);
}

export function getComputerTask(taskId) {
  return request(`/computer-tasks/${encodeURIComponent(taskId)}`);
}

export function getComputerTaskActivity(taskId) {
  return request(`/computer-tasks/${encodeURIComponent(taskId)}/activity`);
}

export function answerComputerTask(taskId, message) {
  return request(`/computer-tasks/${encodeURIComponent(taskId)}/answer`, {
    method: 'POST',
    body: JSON.stringify({ message })
  });
}

export function cancelComputerTask(taskId) {
  return request(`/computer-tasks/${encodeURIComponent(taskId)}/cancel`, { method: 'POST' });
}

/** Subscribe to live computer-task events via SSE (replayed on reconnect). */
export function subscribeToComputerTaskEvents(taskId, { onOpen, onEvent, onError } = {}) {
  const url = `${apiBase()}/computer-tasks/${encodeURIComponent(taskId)}/events`;
  const source = new EventSource(url, { withCredentials: true });

  const handleEvent = (event) => {
    try {
      onEvent?.({ ...JSON.parse(event.data), __sseType: event.type });
    } catch {
      onError?.(new ApiError('Received an invalid computer-task event.', 0, 'INVALID_EVENT'));
    }
  };

  const eventTypes = [
    'task.created', 'task.started', 'task.decision', 'task.action_started',
    'task.observation', 'task.action_failed', 'task.brain_decision',
    'task.waiting_ai', 'task.waiting_computer', 'task.resumed',
    'task.ask_user', 'task.completed', 'task.failed', 'task.cancelled',
    'computer.probe', 'computer.state', 'computer.action', 'computer.observation', 'computer.error'
  ];
  eventTypes.forEach((type) => source.addEventListener(type, handleEvent));
  source.onmessage = handleEvent;
  source.onopen = () => onOpen?.();
  source.onerror = () => onError?.(new ApiError('Computer task event stream was interrupted.', 0, 'EVENT_STREAM_ERROR'));

  return () => {
    eventTypes.forEach((type) => source.removeEventListener(type, handleEvent));
    source.close();
  };
}

/** Computer-control capability probe result. */
export function getComputerCapabilities() {
  return request('/computer/capabilities');
}

/** Current browser/active-window state from the computer layer. */
export function getBrowserState() {
  return request('/computer/browser-state');
}

/** Subscribe to live job events via SSE, replaying from the last seen event. */
export function subscribeToJobEvents(jobId, { onOpen, onEvent, onError, lastEventId } = {}) {
  // EventSource cannot set headers, so the JWT rides as a query param —
  // the backend's getSessionToken() accepts ?accessToken= (see requestContext.js).
  const url = sseUrl(`/jobs/${encodeURIComponent(jobId)}/events`, lastEventId ? { lastEventId } : null);
  const source = new EventSource(url, { withCredentials: true });

  const handleEvent = (event) => {
    try {
      onEvent?.({ ...JSON.parse(event.data), __sseType: event.type });
    } catch {
      onError?.(new ApiError('Received an invalid job event.', 0, 'INVALID_EVENT'));
    }
  };

  const eventTypes = [
    'job.created', 'job.started', 'job.phase_changed', 'job.plan_updated',
    'job.paused', 'job.resumed', 'job.completed', 'job.failed', 'job.cancelled',
    'brain.thinking', 'brain.decision', 'brain.unavailable', 'brain.deterministic',
    'tool.started', 'tool.output', 'tool.failed',
    'browser.action', 'browser.observation',
    'computer.probe', 'computer.state', 'computer.action', 'computer.observation', 'computer.error',
    'finding.created', 'finding.updated', 'finding.rejected', 'observation.recorded',
    'hypothesis.created', 'hypothesis.updated',
    'report.started', 'report.progress', 'agent.chat'
  ];

  eventTypes.forEach((type) => source.addEventListener(type, handleEvent));
  source.onmessage = handleEvent;
  source.onopen = () => onOpen?.();
  source.onerror = () => onError?.(new ApiError('Job event stream was interrupted.', 0, 'EVENT_STREAM_ERROR'));

  return () => {
    eventTypes.forEach((type) => source.removeEventListener(type, handleEvent));
    source.close();
  };
}

// ─── Autonomous Agent: hunt detail ──────────────────────────────────

/** Findings board data — already sorted critical-first by the backend. */
export function getJobFindings(jobId) {
  return request(`/jobs/${encodeURIComponent(jobId)}/findings`);
}

/** Latest persisted final vulnerability report (404 until the hunt completes). */
export function getJobVulnerabilityReport(jobId) {
  return request(`/jobs/${encodeURIComponent(jobId)}/vulnerability-report`);
}

/** Live attack-surface map from the agent's state. */
export function getJobAttackSurface(jobId) {
  return request(`/jobs/${encodeURIComponent(jobId)}/attack-surface`);
}

/** Plain-language hunt diary entries. */
export function getJobDiary(jobId) {
  return request(`/jobs/${encodeURIComponent(jobId)}/diary`);
}

// ─── Hunt records: past reports (target dedup + history) ────────────

/** Browse completed hunt reports, newest first. */
export function listHuntRecords() {
  return request('/hunt-records');
}

/** Full hunt record including the archived report markdown. */
export function getHuntRecord(recordId) {
  return request(`/hunt-records/${encodeURIComponent(recordId)}`);
}

/** Download the archived report as Markdown (returns raw text). */
export async function downloadHuntRecordMarkdown(recordId) {
  const jwt = getStoredJwt();
  const response = await fetch(
    `${apiBase()}/hunt-records/${encodeURIComponent(recordId)}/report.md`,
    {
      headers: { Accept: 'text/markdown', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
      credentials: 'include'
    }
  );
  if (!response.ok) throw new ApiError('Could not download the report.', response.status, 'DOWNLOAD_FAILED');
  return response.text();
}

/**
 * Download a proof-only PoC artifact for one archived finding.
 * kind: 'poc' (default) or 'repro'; format for repro: 'curl' | 'python'.
 * Returns the file text; the caller triggers the browser download.
 */
export async function downloadFindingPoc(recordId, findingId, { kind = 'poc', format = 'curl' } = {}) {
  const jwt = getStoredJwt();
  const params = new URLSearchParams({ kind, format });
  const response = await fetch(
    `${apiBase()}/hunt-records/${encodeURIComponent(recordId)}/findings/${encodeURIComponent(findingId)}/poc?${params}`,
    {
      headers: { Accept: 'text/plain', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
      credentials: 'include'
    }
  );
  if (!response.ok) {
    let message = 'Could not download the PoC.';
    try {
      const body = await response.json();
      if (body?.error?.message) message = body.error.message;
    } catch { /* keep default */ }
    throw new ApiError(message, response.status, 'POC_DOWNLOAD_FAILED');
  }
  return response.text();
}

// ─── Alerts inbox ───────────────────────────────────────────────────

export function listAlerts(unreadOnly = false) {
  return request(`/alerts${unreadOnly ? '?unreadOnly=true' : ''}`);
}

export function markAlertRead(alertId) {
  return request(`/alerts/${encodeURIComponent(alertId)}/read`, { method: 'POST' });
}

export function markAllAlertsRead() {
  return request('/alerts/read-all', { method: 'POST' });
}

// ─── Multi-target queues ────────────────────────────────────────────

export function createQueue(payload) {
  // { name?, targets: string[], scope?, objective?, authorizationConfirmed: true }
  return request('/queues', { method: 'POST', body: JSON.stringify(payload) });
}

export function listQueues() {
  return request('/queues');
}

export function getQueue(queueId) {
  return request(`/queues/${encodeURIComponent(queueId)}`);
}

export function pauseQueue(queueId) {
  return request(`/queues/${encodeURIComponent(queueId)}/pause`, { method: 'POST' });
}

export function resumeQueue(queueId) {
  return request(`/queues/${encodeURIComponent(queueId)}/resume`, { method: 'POST' });
}

export function deleteQueue(queueId) {
  return request(`/queues/${encodeURIComponent(queueId)}`, { method: 'DELETE' });
}

// ─── Scheduled hunts ──────────────────────────────────────────────

export function createSchedule(payload) {
  // { name?, target, scope?, objective?, cadence: 'once'|'daily'|'weekly', nextRunAt? }
  return request('/schedules', { method: 'POST', body: JSON.stringify(payload) });
}

export function listSchedules() {
  return request('/schedules');
}

export function updateSchedule(scheduleId, payload) {
  return request(`/schedules/${encodeURIComponent(scheduleId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function deleteSchedule(scheduleId) {
  return request(`/schedules/${encodeURIComponent(scheduleId)}`, { method: 'DELETE' });
}

// ─── Payload library (self-learning) ──────────────────────────────

export function listPayloads({ technique = null, category = null, limit = 20 } = {}) {
  const query = new URLSearchParams();
  if (technique) query.set('technique', technique);
  if (category) query.set('category', category);
  query.set('limit', String(limit));
  return request(`/payload-library?${query.toString()}`);
}

export function getPayloadLibraryStats() {
  return request('/payload-library/stats');
}

// ─── Local models: Run Locally (Ollama) + curated library ──────────

/* ─── Local model runner (no Ollama): Download → Run on localhost ───
 * These back the new "Run Locally" flow: the backend downloads a GGUF from
 * Hugging Face, then spawns a bundled llama-server on 127.0.0.1 which
 * becomes the shared brain for Hunt and Infinity AI. */

/** Combined status: engine, downloads, running model, brain provider. */
export function getRunnerStatus() {
  return request('/model-runner/status');
}

/** Curated catalog merged with device compatibility verdicts. */
export function getRunnerLibrary() {
  return request('/model-runner/library');
}

/** Detected device: RAM, CPU, GPU, OS/arch. */
export function getRunnerDevice() {
  return request('/model-runner/device');
}

/** Start downloading the llama-server engine binary (one-time setup). */
export function downloadRunnerEngine() {
  return request('/model-runner/engine', { method: 'POST' });
}

/** EventSource cannot set headers — the JWT rides as ?accessToken= (see requestContext.js). */
function sseUrl(path, extraParams = null) {
  const params = new URLSearchParams(extraParams || {});
  const jwt = getStoredJwt();
  if (jwt) params.set('accessToken', jwt);
  const qs = params.toString();
  return `${apiBase()}${path}${qs ? `?${qs}` : ''}`;
}

/** Live engine download progress via SSE. Events: engine.progress / engine.done / engine.error */
export function subscribeToEngineStream({ onEvent, onError, onOpen } = {}) {
  const source = new EventSource(sseUrl('/model-runner/engine/stream'), { withCredentials: true });
  const handleEvent = (event) => {
    try {
      onEvent?.({ ...JSON.parse(event.data), __sseType: event.type });
    } catch {
      onError?.(new ApiError('Received an invalid engine event.', 0, 'INVALID_EVENT'));
    }
  };
  ['engine.progress', 'engine.done', 'engine.error'].forEach((type) => source.addEventListener(type, handleEvent));
  source.onmessage = handleEvent;
  source.onopen = () => onOpen?.();
  source.onerror = () => onError?.(new ApiError('Engine download stream was interrupted.', 0, 'EVENT_STREAM_ERROR'));
  return () => source.close();
}

/** Start downloading a model file. Payload: { modelId }. */
export function downloadRunnerModel(modelId) {
  return request('/model-runner/download', { method: 'POST', body: JSON.stringify({ modelId }) });
}

export function cancelRunnerDownload() {
  return request('/model-runner/download/cancel', { method: 'POST' });
}

/** Live model download progress via SSE. Events: download.progress / download.done / download.error */
export function subscribeToDownloadStream({ onEvent, onError, onOpen } = {}) {
  const source = new EventSource(sseUrl('/model-runner/download/stream'), { withCredentials: true });
  const handleEvent = (event) => {
    try {
      onEvent?.({ ...JSON.parse(event.data), __sseType: event.type });
    } catch {
      onError?.(new ApiError('Received an invalid download event.', 0, 'INVALID_EVENT'));
    }
  };
  ['download.progress', 'download.done', 'download.error'].forEach((type) => source.addEventListener(type, handleEvent));
  source.onmessage = handleEvent;
  source.onopen = () => onOpen?.();
  source.onerror = () => onError?.(new ApiError('Model download stream was interrupted.', 0, 'EVENT_STREAM_ERROR'));
  return () => source.close();
}

export function removeRunnerModel(modelId) {
  return request(`/model-runner/models/${encodeURIComponent(modelId)}`, { method: 'DELETE' });
}

/** Register a custom public Hugging Face GGUF. Payload: { name, repo, file, ... } */
export function addRunnerCustomModel(payload) {
  return request('/model-runner/custom', { method: 'POST', body: JSON.stringify(payload) });
}

/** Start the downloaded model on localhost. Payload: { modelId }. */
export function runRunnerModel(modelId) {
  return request('/model-runner/run', { method: 'POST', body: JSON.stringify({ modelId }) });
}

/** Stop the running model and free RAM/VRAM. */
export function stopRunnerModel() {
  return request('/model-runner/stop', { method: 'POST' });
}

/* ─── Per-model Download → Run (the Models page flow) ───────────────
 * These are the task-specified endpoints:
 *   POST /models/:id/download — starts a REAL streaming download
 *   GET  /models/:id/progress  — SSE with real 0% → 100% byte progress
 *   POST /models/:id/run       — Run + set as the ACTIVE localhost brain
 */

/** Start downloading a model's GGUF file (real streaming download). */
/**
 * Download a model file. `quant` picks the quantization for models that
 * offer several (Q4_K_M default — smallest; Q5_K_M / Q8_0 = smarter, bigger).
 */
export function downloadModelFile(modelId, { quant } = {}) {
  return request(`/models/${encodeURIComponent(modelId)}/download`, {
    method: 'POST',
    body: JSON.stringify({ ...(quant ? { quant } : {}) })
  });
}

/**
 * Run a downloaded model on localhost and make it the active brain.
 * `quant` picks which downloaded quantization to run; `contextSize` sets
 * the context window (clamped to the model's maximum).
 */
export function runModelFile(modelId, { quant, contextSize } = {}) {
  return request(`/models/${encodeURIComponent(modelId)}/run`, {
    method: 'POST',
    body: JSON.stringify({
      ...(quant ? { quant } : {}),
      ...(contextSize ? { contextSize } : {})
    })
  });
}

/** The caller's brain fallback chain (describe-only — nothing is started). */
export function getBrainChain() {
  return request('/model-runner/brain-chain');
}

/**
 * Live per-model download progress via SSE.
 * Events: progress { modelId, status, receivedBytes, totalBytes, percent }.
 * Terminal states: status 'done' (percent 100 — the row flips to Run),
 * 'error' or 'cancelled'.
 */
export function subscribeToModelProgress(modelId, { onEvent, onError, onOpen } = {}) {
  const source = new EventSource(sseUrl(`/models/${encodeURIComponent(modelId)}/progress`), { withCredentials: true });
  const handleEvent = (event) => {
    try {
      onEvent?.({ ...JSON.parse(event.data), __sseType: event.type });
    } catch {
      onError?.(new ApiError('Received an invalid model progress event.', 0, 'INVALID_EVENT'));
    }
  };
  source.addEventListener('progress', handleEvent);
  source.onmessage = handleEvent;
  source.onopen = () => onOpen?.();
  source.onerror = () => onError?.(new ApiError('Model download stream was interrupted.', 0, 'EVENT_STREAM_ERROR'));
  return () => source.close();
}

// ─── Remote GPU brain (Kaggle/Colab Gradio share link) ─────────────

/** Current remote-brain connection status for this user. */
export function getRemoteModelStatus() {
  return request('/remote-model');
}

/** Test a Gradio share URL without saving it. */
export function testRemoteModel(gradioUrl) {
  return request('/remote-model/test', { method: 'POST', body: JSON.stringify({ gradioUrl }) });
}

/** Connect a Gradio share URL and make it this user's brain. */
export function connectRemoteModel(gradioUrl, name) {
  return request('/remote-model/connect', { method: 'POST', body: JSON.stringify({ gradioUrl, name }) });
}

/** Disconnect the remote brain (back to the phone default). */
export function disconnectRemoteModel() {
  return request('/remote-model/disconnect', { method: 'POST' });
}

// ─── Combined API Client ──────────────────────────────────────────

export const apiClient = {
  getCurrentUser,
  registerAccount,
  loginAccount,
  logoutAccount,
  updateProfile,
  getProviders,
  getLocalAiHealth,
  sendDirectChat,
  updateProviders,
  sendAgentMessage,
  getScans,
  getTools,
  getScan,
  normalizeTargetUrl,
  subscribeToScanEvents,
  // Assessment system
  createAssessment,
  listAssessments,
  getAssessment,
  startAssessment,
  pauseAssessment,
  resumeAssessment,
  stopAssessment,
  getAssessmentTimeline,
  getAssessmentFindings,
  getAssessmentToolExecutions,
  sendAssessmentChat,
  generateReport,
  getLatestReport,
  listReportVersions,
  listAllReports,
  subscribeToAssessmentEvents,
  // Infinity Long-Context Engine
  ingestDocument,
  getIngestion,
  searchChunks,
  getExactChunk,
  summarizeDocument,
  startGeneration,
  getGeneration,
  cancelGeneration,
  resumeGeneration,
  listGenerations,
  planWithInfinity,
  buildWithInfinity,
  listWorkspaceFiles,
  readWorkspaceFile,
  controlComputer,
  // Autonomous Bug Bounty Agent
  createJob,
  listJobs,
  getJobState,
  getJobActivity,
  getJobPosture,
  getJobEventHistory,
  pauseJob,
  continueJob,
  resumeJob,
  cancelJob,
  askJob,
  subscribeToJobEvents,
  // Hunt detail
  getJobFindings,
  getJobVulnerabilityReport,
  getJobAttackSurface,
  getJobDiary,
  // Hunt records (past reports + dedup)
  listHuntRecords,
  getHuntRecord,
  downloadHuntRecordMarkdown,
  downloadFindingPoc,
  // Alerts
  listAlerts,
  markAlertRead,
  markAllAlertsRead,
  // Queues & schedules
  createQueue,
  listQueues,
  getQueue,
  pauseQueue,
  resumeQueue,
  deleteQueue,
  createSchedule,
  listSchedules,
  updateSchedule,
  deleteSchedule,
  // Payload library
  listPayloads,
  getPayloadLibraryStats,
  // Local models (Run Locally)
  getStoredJwt,
  storeJwt,
  // Local model runner (no Ollama): Download → Run on localhost
  getRunnerStatus,
  getRunnerLibrary,
  getRunnerDevice,
  downloadRunnerEngine,
  subscribeToEngineStream,
  downloadRunnerModel,
  cancelRunnerDownload,
  subscribeToDownloadStream,
  removeRunnerModel,
  addRunnerCustomModel,
  runRunnerModel,
  stopRunnerModel,
  // Computer control (Open-Interface adapter)
  getComputerStatus,
  getComputerCapabilities,
  getBrowserState,
  // InfiniteChat computer tasks
  createComputerTask,
  listComputerTasks,
  getComputerTask,
  getComputerTaskActivity,
  answerComputerTask,
  cancelComputerTask,
  subscribeToComputerTaskEvents
};
