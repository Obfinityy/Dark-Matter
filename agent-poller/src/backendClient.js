/**
 * backendClient.js — HTTP client for the Infinity AI backend (Render).
 *
 * The poller PULLS: it lists the user's jobs, claims agent-executor jobs,
 * fetches brain links, posts progress events, and marks completion.
 * The backend never pushes commands and never routes computer-control —
 * this client only ever issues plain REST calls as the user.
 */
export function createBackendClient({ backendUrl, token, fetchImpl = fetch }) {
  const base = String(backendUrl || '').replace(/\/+$/, '');

  async function request(method, path, body) {
    const res = await fetchImpl(`${base}/api/v1${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { _raw: text };
    }
    if (!res.ok) {
      const err = new Error(
        `backend ${method} ${path} → ${res.status}: ${json?.error?.message || json?.error || text.slice(0, 200)}`
      );
      err.status = res.status;
      throw err;
    }
    return json;
  }

  return {
    /** GET /jobs — the user's jobs (the poller filters for claimable ones). */
    async listJobs() {
      const out = await request('GET', '/jobs');
      return out?.jobs || [];
    },

    /** POST /jobs/:id/claim — claim an executor='agent' job. */
    async claimJob(jobId, pollerId) {
      return request('POST', `/jobs/${encodeURIComponent(jobId)}/claim`, { pollerId });
    },

    /** GET /brain-links — the account's saved Kaggle brain links. */
    async getBrainLinks() {
      const out = await request('GET', '/brain-links');
      return out?.links || {};
    },

    /** POST /jobs/:id/events — stream hunt progress (agent.* namespace). */
    async postEvent(jobId, { type, level, message, data }) {
      return request('POST', `/jobs/${encodeURIComponent(jobId)}/events`, {
        type,
        level,
        message,
        data,
      });
    },

    /** GET /jobs/:id — fresh job state (status, pauseRequested, ...). */
    async getJob(jobId) {
      return request('GET', `/jobs/${encodeURIComponent(jobId)}`);
    },

    /** POST /jobs/:id/pause|continue|cancel — honor user controls from anywhere. */
    async controlJob(jobId, action) {
      const allowed = ['pause', 'continue', 'cancel'];
      if (!allowed.includes(action)) throw new Error(`unknown control action: ${action}`);
      return request('POST', `/jobs/${encodeURIComponent(jobId)}/${action}`);
    },
  };
}
