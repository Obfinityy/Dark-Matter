const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status = 0, code = 'REQUEST_FAILED') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request(path, options = {}) {
  const headers = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {})
  };

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' });
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

export function registerAccount(payload) {
  return request('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
}

export function loginAccount(payload) {
  return request('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
}

export function logoutAccount() {
  return request('/auth/logout', { method: 'POST' });
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
    const res = await fetch(`${API_BASE}/infinite/chat`, {
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
  const source = new EventSource(`${API_BASE}/scans/${encodeURIComponent(scanId)}/events`, { withCredentials: true });
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
    `${API_BASE}/assessments/${encodeURIComponent(assessmentId)}/events`,
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
  const url = `${API_BASE}/computer-tasks/${encodeURIComponent(taskId)}/events`;
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
  // EventSource cannot set headers, so replay is driven explicitly through
  // getJobEventHistory() by the caller; Last-Event-ID is only honoured when the
  // browser reconnects on its own.
  const url = `${API_BASE}/jobs/${encodeURIComponent(jobId)}/events`;
  const source = lastEventId ? new EventSource(`${url}?lastEventId=${encodeURIComponent(lastEventId)}`, { withCredentials: true }) : new EventSource(url, { withCredentials: true });

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
    'brain.thinking', 'brain.decision', 'brain.unavailable',
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
  // Autonomous Bug Bounty Agent
  createJob,
  listJobs,
  getJobState,
  getJobActivity,
  getJobEventHistory,
  pauseJob,
  continueJob,
  resumeJob,
  cancelJob,
  askJob,
  subscribeToJobEvents,
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
