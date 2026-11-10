// Dark Matter frontend — API client for the v1 backend contract.
// Auth: Bearer token from localStorage (`dm_token`) is attached to every
// request when present. Every call degrades gracefully when the backend
// is unreachable; callers receive { ok:false, error } and show honest toasts.
import { resolveApiBase } from '../config';

const TOKEN_KEY = 'dm_token';

export function getAuthToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setAuthToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* storage unavailable */ }
}

export function clearAuthToken() {
  setAuthToken('');
}

function apiUrl(path) {
  return `${resolveApiBase()}${path}`;
}

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function request(method, path, body, opts = {}) {
  // TIMEOUT (29 Oct 2026): fetch() has no built-in timeout — if the backend
  // hangs, await never resolves and callers (e.g. BrainConsole's
  // "Sending…") stick forever. Callers pass { timeout: ms }; we abort
  // via AbortController. A caller-provided opts.signal (user-initiated
  // Stop) takes precedence over the timeout controller.
  const controller = new AbortController();
  const timeoutMs = opts.timeout;
  const timeoutId = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
  const signal = opts.signal || controller.signal;
  try {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(apiUrl(path), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      // CHAT-ANSWERS (26 Oct 2026): Stop must abort the in-flight
      // chat fetch instead of letting it run and discarding the
      // result. The caller passes { signal } from an AbortController.
      // TIMEOUT (29 Oct 2026): if no caller signal, use our timeout
      // controller so a hung backend cannot stick the UI forever.
      signal,
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        // Prefer the human-readable message over the machine code so users
        // see WHY something failed.
        error: (data && (data.message || data.error)) || `Request failed (${res.status})`,
        // Keep the parsed body: some routes name the bad field in a
        // structured `errors: [{field, message}]` array (brain-action-
        // json 400s) with no top-level message — callers that show the
        // field need the body, not just the string.
        data,
      };
    }
    return { ok: true, status: res.status, data };
  } catch (err) {
    // An intentional abort is not a backend failure — the caller
    // distinguishes it so Stop never shows a "backend unreachable"
    // toast for a reply the user stopped on purpose.
    // TIMEOUT (29 Oct 2026): if WE aborted via the timeout (no caller
    // signal), report a timeout — the backend may still be processing,
    // so the caller should check the Action index rather than retry
    // blindly.
    if (err && err.name === 'AbortError') {
      if (timeoutMs && !opts.signal) {
        return { ok: false, error: 'Request timed out. The backend may still be processing — check the Action index before retrying.' };
      }
      return { ok: false, error: 'aborted', aborted: true };
    }
    return { ok: false, error: 'Backend unreachable. Check Settings → backend connection.' };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

const get = (path) => request('GET', path);
const post = (path, body, opts) => request('POST', path, body, opts);
const put = (path, body) => request('PUT', path, body);
const del = (path) => request('DELETE', path);

// LIVE REPORT (27 Oct 2026, feat/live-report-fix): the report
// endpoint returns raw `text/markdown`, NOT JSON — the generic
// request() above parses every body with res.json(), which throws
// on markdown, so fetchReportMarkdown silently got `data: null`
// and the Reports page showed "No report generated yet" forever,
// even though the backend returned a full report (HTTP 200).
// Text endpoints must use this raw-text twin instead.
async function requestText(method, path, opts = {}) {
  try {
    const headers = {};
    const token = getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(apiUrl(path), {
      method,
      headers,
      signal: opts.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      let error = `Request failed (${res.status})`;
      try {
        const data = JSON.parse(text);
        if (data && (data.message || data.error)) error = data.message || data.error;
      } catch { /* error body is not JSON — keep the status text */ }
      return { ok: false, status: res.status, error };
    }
    return { ok: true, status: res.status, data: text };
  } catch (err) {
    if (err && err.name === 'AbortError') return { ok: false, error: 'aborted', aborted: true };
    return { ok: false, error: 'Backend unreachable. Check Settings → backend connection.' };
  }
}

// --- Auth (invite-only, username based) --------------------------------------
export async function login(username, password) {
  return post('/api/v1/auth/login', { username, password });
}

export async function signup(username, password) {
  return post('/api/v1/auth/signup', { username, password });
}

export async function me() {
  return get('/api/v1/auth/me');
}

// --- Health ----------------------------------------------------------------
export async function health() {
  return get('/api/v1/health');
}

// --- Chat ------------------------------------------------------------------
export async function steerHunt(huntId, message) {
  return post(`/api/v1/hunts/${encodeURIComponent(huntId)}/steer`, { message });
}

// AGENT CHAT (3 Nov 2026, owner order): talk to the scan agent about an
// Autonomous hunt — Meta API answers from the hunt's own findings, scoped
// to bug-bounty + the current target.
export async function agentChat(huntId, message) {
  return post(`/api/v1/hunts/${encodeURIComponent(huntId)}/agent-chat`, { message });
}

// AI BEHAVIOUR ANALYSIS (8 Nov 2026, owner idea): one Meta AI call over
// the hunt's behaviour bundle, proposing NEW vulnerabilities beyond the
// predefined battery. Backend is idempotent — a stored result is
// returned and the provider is never called twice for one hunt.
export async function requestAiAnalysis(huntId) {
  return post(`/api/v1/hunts/${encodeURIComponent(huntId)}/ai-analysis`, {});
}

export async function getHuntBehaviour(huntId) {
  return get(`/api/v1/hunts/${encodeURIComponent(huntId)}/behaviour`);
}

export async function sendChat(message, huntId, history, opts) {
  const body = { message, ...(huntId ? { huntId } : {}) };
  // REAL-HUMAN (26 Oct 2026): the chatId tells the backend WHICH
  // thread to answer into when the question is queued for the
  // brain's next turn — without it the answer has no home.
  if (opts && opts.chatId) body.chatId = opts.chatId;
  // CHAT-ANSWERS (26 Oct 2026): carry the thread's recent history so
  // follow-ups are answered with context instead of cold.
  if (Array.isArray(history) && history.length) body.history = history;
  const res = await post('/api/v1/chat', body, opts);
  if (!res.ok) return res;
  const reply = (res.data && (res.data.reply || res.data.message)) || '';
  // CHAT-ANSWERS: return the whole response, not just the reply — the
  // old shape dropped `action` (and ai/scoped/busy), so the steering
  // mirroring in ChatPage (pause/resume/stop chips) never fired.
  return { ok: true, data: { ...(res.data || {}), reply } };
}

// --- Chat title sync (renames follow the account across devices) -----------
export async function getChatTitles() {
  return get('/api/v1/chats');
}

export async function getChatTombstones() {
  return get('/api/v1/chats/tombstones');
}

export async function syncChatTitles(chats, deleted) {
  return post('/api/v1/chats/sync', { chats, deleted });
}

// --- Chat message sync (full history follows the account across devices) ---
export async function getChatMessages(chatId) {
  return get(`/api/v1/chats/${encodeURIComponent(chatId)}/messages`);
}

export async function saveChatMessages(chatId, messages) {
  return post(`/api/v1/chats/${encodeURIComponent(chatId)}/messages`, {
    messages,
    updatedAt: new Date().toISOString(),
  });
}

// --- UPI payments / activation ---------------------------------------------
// Simplified activation (owner order 25 Oct 2026): the user pays Rs 10,000
// to the Obfinity UPI ID from any UPI app, then submits a claim (phone,
// WhatsApp, account details, UTR). The admin verifies the money arrived
// and activates the account for 1 day. No gateway, no OTP. A claim never
// auto-activates an account.
export async function getUpiDetails() {
  return get('/api/v1/payments/upi');
}

export async function getPaymentStatus() {
  return get('/api/v1/payments/status');
}

export async function submitPaymentClaim(payload) {
  return post('/api/v1/payments/claims', payload);
}

export async function getMyClaims() {
  return get('/api/v1/payments/claims/mine');
}

export async function listPaymentClaims() {
  return get('/api/v1/payments/claims');
}

export async function verifyPaymentClaim(id) {
  return post(`/api/v1/payments/claims/${encodeURIComponent(id)}/verify`, {});
}

export async function rejectPaymentClaim(id) {
  return post(`/api/v1/payments/claims/${encodeURIComponent(id)}/reject`, {});
}

// --- Hunts -----------------------------------------------------------------
/** The user's hunts from the backend (survives browser close — re-attach). */
export async function listHunts() {
  return get('/api/v1/hunts');
}

/** One hunt's full stored record (host-side hunts return the whole meta,
 *  including mode). Used when a hunt card predates the list carrying mode. */
export async function getHunt(id) {
  return get(`/api/v1/hunts/${encodeURIComponent(id)}`);
}

/** Cached agent activity (thinking, tool calls, findings) for a hunt. */
export async function getHuntEvents(huntId, limit = 200) {
  return get(`/api/v1/hunts/${encodeURIComponent(huntId)}/events?limit=${limit}`);
}

// --- Finding detail (28 Oct 2026, finding-detail lane) -----------------------
// One finding's full recorded detail — evidence, verification, stamps —
// from the backend's single read path. The panel list rows carry only
// {title, severity, verified, detail, verification, stamps}; everything
// else (evidence, reproduction, timestamps) comes from here. 404 is
// {ok:false, error:'unknown_finding'} — the caller says so honestly.
export async function getFindingDetail(huntId, title) {
  return get(`/api/v1/hunts/${encodeURIComponent(huntId)}/findings/${encodeURIComponent(title)}`);
}

// --- Dynamic details requests (27 Oct 2026, owner order) -------------------
// The agent asks the owner for details it needs (a login, an OTP, any
// field) instead of creating its own account. Responses carry the PUBLIC
// form only — values are never returned by the backend.
export async function getDetailRequests(huntId) {
  return get(`/api/v1/hunts/${encodeURIComponent(huntId)}/detail-requests`);
}

export async function submitDetailRequest(huntId, requestId, values) {
  return post(`/api/v1/hunts/${encodeURIComponent(huntId)}/detail-requests/${encodeURIComponent(requestId)}/submit`, { values });
}

export async function cancelDetailRequest(huntId, requestId) {
  return post(`/api/v1/hunts/${encodeURIComponent(huntId)}/detail-requests/${encodeURIComponent(requestId)}/cancel`, {});
}

export async function getHuntCost(huntId) {
  return get(`/api/v1/hunts/${encodeURIComponent(huntId)}/cost`);
}

// BUDGET CAP (27 Oct 2026, owner order): per-hunt spend cap. Set with a
// number (USD), clear with null. At the cap the hunt auto-pauses with a
// checkpoint; Resume continues from there — never from scratch.
export async function setHuntBudget(id, budgetUsd) {
  return post(`/api/v1/hunts/${encodeURIComponent(id)}/budget`, { budgetUsd });
}

export async function getNotifications() {
  return get('/api/v1/notifications');
}

export async function markNotificationRead(id) {
  return post(`/api/v1/notifications/${encodeURIComponent(id)}/read`, {});
}

export async function getTotalCosts() {
  return get('/api/v1/hunts/costs');
}

export async function startHunt(target, scope, mode, confirmedAuthorized, brainMode = 'ai', scanDepth = 'standard', scanScope = 'page', forceNew = false, fresh = false) {
  const res = await post('/api/v1/hunts', { target, scope, mode, brainMode, scanDepth, scanScope, confirmedAuthorized: !!confirmedAuthorized, ...(forceNew ? { forceNew: true } : {}), ...(fresh ? { fresh: true } : {}) });
  if (!res.ok) return res;
  const d = res.data || {};
  // Pass the dedupe/queue outcome through: when the target was already
  // hunted the backend returns the EXISTING hunt (reused) instead of a new
  // one, and the caller must open that hunt rather than append a fresh card.
  return {
    ok: true,
    data: {
      huntId: d.huntId || d.id,
      reused: !!d.reused,
      resumed: !!d.resumed,
      queued: !!d.queued,
      fresh: !!d.fresh,
      position: d.position,
      state: d.state,
      message: d.message,
      brainMode: d.brainMode || null,
      scanDepth: d.scanDepth || 'standard',
      scanScope: d.scanScope || 'page',
    },
  };
}

export async function pauseHunt(id) {
  return post(`/api/v1/hunts/${encodeURIComponent(id)}/pause`);
}

export async function resumeHunt(id) {
  return post(`/api/v1/hunts/${encodeURIComponent(id)}/resume`);
}

export async function stopHunt(id) {
  return post(`/api/v1/hunts/${encodeURIComponent(id)}/stop`);
}

// MODEL-SWITCHER (26 Oct 2026): the hunt's brain — Dark Matter V1
// (local 8B, default) or a Meta text model. Switching is seamless:
// the loop rebuilds its prompt from live state + history + memory
// every turn, so the new brain continues with everything the old
// one knew. A switch to Meta is refused while no key is configured.
export async function getHuntBrain(id) {
  return get(`/api/v1/hunts/${encodeURIComponent(id)}/brain`);
}

// BRAIN-MODE READ (5 Nov 2026, Re-run fix): the hunt's recorded lane —
// GET /:id/brain-mode -> { ok, brainMode: 'ai' | 'scanner', state }.
// Re-run / Start-from-scratch resolves the source hunt's real lane
// through this when the card itself does not carry brainMode (legacy
// restored cards), so a scanner hunt is never silently re-created as AI.
export async function getHuntBrainMode(id) {
  return get(`/api/v1/hunts/${encodeURIComponent(id)}/brain-mode`);
}

export async function setHuntBrain(id, model) {
  return post(`/api/v1/hunts/${encodeURIComponent(id)}/brain`, { model });
}

// --- Be a Brain (28 Oct 2026, owner order) -----------------------------------
// The parent becomes the hunt's brain: the AI loop pauses and the parent
// drives the next actions from the Brain Console, reading exactly what
// the brain would have seen (action index + live process state) and
// submitting actions one at a time. Handing back resumes the AI loop.
// All five calls follow the same request() envelope as the rest of api.js:
// { ok, status, data } on success, { ok:false, error } on failure.
export async function setBrainMode(id, mode) {
  return post(`/api/v1/hunts/${encodeURIComponent(id)}/brain-mode`, { mode });
}

export async function getHuntActions(id) {
  return get(`/api/v1/hunts/${encodeURIComponent(id)}/actions`);
}

export async function getHuntActionOutput(id, hash) {
  return get(`/api/v1/hunts/${encodeURIComponent(id)}/output/${encodeURIComponent(hash)}`);
}

export async function getHuntProcess(id) {
  return get(`/api/v1/hunts/${encodeURIComponent(id)}/process`);
}

export async function submitBrainAction(id, action) {
  // TIMEOUT (29 Oct 2026): 5 min — brain actions run probes that can take
  // minutes, but a hang beyond that means the backend is stuck. Without
  // this, the BrainConsole "Sending…" sticks forever (seen 13-19 min).
  return post(`/api/v1/hunts/${encodeURIComponent(id)}/brain-action`, { action }, { timeout: 300000 });
}

// BRAIN JSON (28 Oct 2026): the parent brain's structured reply —
// {reply: {task, goal, progress, recall?, action}} — validated
// client-side against brainReply.schema.json first, then dispatched
// through the SAME guarded executeBrainAction as the form composer.
// A 400 names the bad field (in the message); a 409 means the AI is
// the brain right now.
export async function submitBrainActionJson(id, reply) {
  // TIMEOUT (29 Oct 2026): 5 min — same "Sending…" hang fix as above.
  return post(`/api/v1/hunts/${encodeURIComponent(id)}/brain-action-json`, { reply }, { timeout: 300000 });
}

export function reportPdfUrl(id) {
  return apiUrl(`/api/v1/hunts/${encodeURIComponent(id)}/report?format=pdf`);
}

/**
 * Live Machine: fetch the latest frame of the hunt machine's GUI desktop.
 * The route requires the JWT, so this uses fetch + blob (an <img> src
 * cannot send the Authorization header). Returns { ok, blob } — a 404
 * means the desktop is not available yet (hunt image without the desktop
 * stack, or desktop not started); callers show a placeholder.
 */
export async function fetchHuntDesktopFrame(huntId) {
  try {
    const headers = {};
    const token = getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(apiUrl(`/api/v1/hunts/${encodeURIComponent(huntId)}/desktop.jpg`), {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    if (!res.ok) return { ok: false, status: res.status };
    const blob = await res.blob();
    return { ok: true, blob };
  } catch {
    return { ok: false, error: 'Backend unreachable.' };
  }
}

// --- Take Control of This Machine ----------------------------------------
// The owner drives the hunt container's Kali desktop himself (full mouse
// + keyboard via noVNC over the backend's control WebSocket), while the
// agent's GUI actions pause. The hunt itself is never paused. Take
// returns 409 already_controlled when someone else holds the lock, and
// 503 control_unavailable with the real reason when the interactive
// channel cannot start — callers must show that reason, never pretend
// control works. The ticket is a 60s JWT for the WS handshake.
export async function getMachineControl(huntId) {
  return get(`/api/v1/hunts/${encodeURIComponent(huntId)}/control`);
}

export async function takeMachineControl(huntId) {
  return post(`/api/v1/hunts/${encodeURIComponent(huntId)}/control/take`, {});
}

export async function releaseMachineControl(huntId) {
  return post(`/api/v1/hunts/${encodeURIComponent(huntId)}/control/release`, {});
}

export async function getControlTicket(huntId) {
  const res = await get(`/api/v1/hunts/${encodeURIComponent(huntId)}/control/ticket`);
  if (!res.ok) return res;
  return { ok: true, data: { ticket: res.data && res.data.ticket } };
}

export function controlWsUrl(huntId, ticket) {
  const base = resolveApiBase();
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = base ? new URL(base).host : window.location.host;
  return `${proto}//${host}/api/v1/hunts/${encodeURIComponent(huntId)}/control?ticket=${encodeURIComponent(ticket)}`;
}

export async function fetchReportMarkdown(id, brainMode) {
  // The report endpoint returns raw text/markdown — fetch it as text.
  // (The old code ran it through the JSON-only request(), which
  // parsed the markdown body to null and returned an empty report.)
  // AGENT REPORT (3 Nov 2026, owner order): scanner hunts get the
  // AI-written report route; requestText carries the Bearer token, which
  // window.open(url) alone cannot (auth_required fix).
  const path = brainMode === 'scanner'
    ? `/api/v1/hunts/${encodeURIComponent(id)}/agent-report`
    : `/api/v1/hunts/${encodeURIComponent(id)}/report?format=md`;
  const res = await requestText('GET', path);
  if (!res.ok) return res;
  return { ok: true, data: { markdown: typeof res.data === 'string' ? res.data : '' } };
}

// --- Plugins / providers -----------------------------------------------------
export async function listProviders() {
  return get('/api/v1/plugins/providers');
}

export async function saveProvider(id, payload) {
  return put(`/api/v1/plugins/providers/${encodeURIComponent(id)}`, payload);
}

// --- Admin portal ------------------------------------------------------------
export async function listAdminUsers() {
  return get('/api/v1/admin/users');
}

export async function approveAdminUser(userId) {
  return post(`/api/v1/admin/users/${userId}/approve`, {});
}

export async function rejectAdminUser(userId) {
  return post(`/api/v1/admin/users/${userId}/reject`, {});
}

export async function listAdminHunts() {
  return get('/api/v1/admin/hunts');
}

// Lane AI: agent-created accounts (admin portal only — the
// user-facing frontend never lists these). The list carries no
// passwords; one password is revealed only via the per-record call.
export async function listAgentAccounts() {
  return get('/api/v1/admin/agent-accounts');
}

export async function revealAgentAccount(handle) {
  return post(`/api/v1/admin/agent-accounts/${encodeURIComponent(handle)}/reveal`, {});
}

export async function createAdminUser({ username, password, control }) {
  return post('/api/v1/admin/users', { username, password, control });
}

export async function updateAdminUser(id, { control }) {
  return put(`/api/v1/admin/users/${encodeURIComponent(id)}`, { control });
}

export async function deleteAdminUser(id) {
  return del(`/api/v1/admin/users/${encodeURIComponent(id)}`);
}

export async function blockAdminUser(id, { durationHours, permanent }) {
  return post(`/api/v1/admin/users/${encodeURIComponent(id)}/block`, { durationHours, permanent });
}

export async function unblockAdminUser(id) {
  return post(`/api/v1/admin/users/${encodeURIComponent(id)}/unblock`, {});
}

export async function changeUserPassword(id, password) {
  return post(`/api/v1/admin/users/${encodeURIComponent(id)}/password`, { password });
}

// --- Downloadable models -----------------------------------------------------
export async function listModels() {
  return get('/api/v1/models');
}

export async function downloadModel(modelId) {
  return post('/api/v1/models/download', { modelId });
}

export async function getDownloadJob(jobId) {
  return get(`/api/v1/models/downloads/${encodeURIComponent(jobId)}`);
}

// --- Voice -------------------------------------------------------------------
export async function stt(audioBlob) {
  try {
    const form = new FormData();
    form.append('audio', audioBlob, 'recording.webm');
    const res = await fetch(apiUrl('/api/v1/voice/stt'), { method: 'POST', body: form });
    const data = await parseJsonSafe(res);
    if (!res.ok) {
      return { ok: false, error: (data && (data.error || data.message)) || `Voice service failed (${res.status})` };
    }
    return { ok: true, data: { text: (data && (data.text || data.transcript)) || '' } };
  } catch {
    return { ok: false, error: 'Voice service unreachable. Check Settings → backend connection.' };
  }
}

export async function tts(text, voice) {
  try {
    const res = await fetch(apiUrl('/api/v1/voice/tts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
    });
    if (!res.ok) {
      const data = await parseJsonSafe(res);
      return { ok: false, error: (data && (data.error || data.message)) || `Voice service failed (${res.status})` };
    }
    const blob = await res.blob();
    return { ok: true, data: { blob, url: URL.createObjectURL(blob) } };
  } catch {
    return { ok: false, error: 'Voice service unreachable. Check Settings → backend connection.' };
  }
}

// --- Hunt live stream ----------------------------------------------------------
// Real WS endpoint: WS /api/v1/hunts/:id/stream
// Events: { type: 'thinking'|'tool_call'|'finding'|'status'|'done', ...payload }
// Client usage lives in lib/huntStream.js (HuntStreamClient).
export function huntStreamWsUrl(huntId) {
  const token = getAuthToken();
  const query = token ? `?access_token=${encodeURIComponent(token)}` : '';
  return `${resolveApiBase().replace(/^http/, 'ws')}/api/v1/hunts/${encodeURIComponent(huntId)}/stream${query}`;
}
