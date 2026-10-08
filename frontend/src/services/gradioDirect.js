/**
 * gradioDirect.js — frontend-direct Kaggle brain client.
 *
 * Owner's architecture: a Kaggle link connects STRAIGHT from the browser
 * (Vercel frontend) to Gradio. No localhost, no backend — the frontend sends
 * the request to Gradio and takes the output from there. Memory stays on the
 * user's device.
 *
 * Per-slot links persist in the browser (localStorage) — no backend storage.
 */

const LS_KEY = 'dm_kaggle_slots_v1'; // { vision: {url, name, connectedAt}, ... }
const VALID_SLOTS = ['vision', 'grounding', 'hacker'];

function readAll() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

function writeAll(obj) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(obj));
  } catch {
    /* storage unavailable — keep in-memory only */
  }
}

export function normalizeGradioUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

/** Saved Kaggle link for a slot, or null. */
export function getKaggleSlot(slot) {
  if (!VALID_SLOTS.includes(slot)) return null;
  const entry = readAll()[slot];
  return entry && entry.url ? entry : null;
}

/** All saved Kaggle slots: { vision: {...}|null, ... } */
export function getAllKaggleSlots() {
  const all = readAll();
  const out = {};
  for (const s of VALID_SLOTS) out[s] = all[s] && all[s].url ? all[s] : null;
  return out;
}

/** Save (connect) a Kaggle link for a slot. */
export function connectKaggleSlot(slot, url, name) {
  if (!VALID_SLOTS.includes(slot)) throw new Error(`Unknown brain slot "${slot}"`);
  const clean = normalizeGradioUrl(url);
  if (!/^https?:\/\/.+/i.test(clean)) throw new Error('That does not look like a valid http(s) URL.');
  const all = readAll();
  all[slot] = { url: clean, name: String(name || '').trim() || null, connectedAt: new Date().toISOString() };
  writeAll(all);
  return all[slot];
}

/** Remove (disconnect) a slot's Kaggle link. */
export function disconnectKaggleSlot(slot) {
  const all = readAll();
  delete all[slot];
  writeAll(all);
}

/**
 * Test a Gradio link STRAIGHT from the browser — no backend involved.
 * Hits the Gradio info endpoint; resolves with a short status string.
 */
export async function testGradioLink(url, { timeoutMs = 25000 } = {}) {
  const clean = normalizeGradioUrl(url);
  if (!/^https?:\/\/.+/i.test(clean)) throw new Error('That does not look like a valid http(s) URL.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Gradio exposes /gradio_api/info on share links; fall back to the root page.
    let res = await fetch(`${clean}/gradio_api/info`, { signal: controller.signal });
    if (!res.ok) {
      res = await fetch(clean, { signal: controller.signal, mode: 'cors' });
    }
    if (!res.ok) throw new Error(`Gradio replied HTTP ${res.status}`);
    return 'reachable';
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('Timed out — is the Kaggle notebook still running?');
    throw new Error(err.message || 'Could not reach that link from your browser.');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Chat with a Kaggle brain STRAIGHT from the browser.
 * Tries the Gradio 6.x predict API first, falls back to the legacy chat API.
 */
export async function chatWithGradio(url, prompt, { timeoutMs = 120000 } = {}) {
  const clean = normalizeGradioUrl(url);
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      try {
        return await callPredict(clean, prompt, timeoutMs);
      } catch (e) {
        lastErr = e;
        // fall through to legacy
      }
      const res = await fetch(`${clean}/gradio_api/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({ data: [prompt, []] }),
      });
      if (!res.ok) throw new Error(`Gradio HTTP ${res.status}`);
      const data = await res.json();
      const reply = data?.data?.[0];
      if (typeof reply !== 'string' || !reply.trim()) throw new Error('Empty reply from the Kaggle brain.');
      return reply;
    } catch (err) {
      lastErr = err;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error(`Kaggle brain failed after 3 attempts: ${lastErr?.message || lastErr}`);
}

async function callPredict(baseUrl, prompt, timeoutMs) {
  const callRes = await fetch(`${baseUrl}/gradio_api/call/predict`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(Math.min(timeoutMs, 60000)),
    body: JSON.stringify({ data: [{ text: prompt, files: [] }, null] }),
  });
  if (!callRes.ok) throw new Error(`predict HTTP ${callRes.status}`);
  const { event_id } = await callRes.json();
  if (!event_id) throw new Error('No event_id from Gradio predict');

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const pollRes = await fetch(`${baseUrl}/gradio_api/call/predict/${event_id}`, {
      signal: AbortSignal.timeout(30000),
    });
    const text = await pollRes.text();
    if (text.includes('event: complete')) {
      const m = text.match(/data: (.*)/);
      if (m) {
        const data = JSON.parse(m[1]);
        const reply = Array.isArray(data) ? data[0] : data;
        if (typeof reply === 'string' && reply.trim()) return reply;
        throw new Error('Empty reply from Gradio predict');
      }
    }
    if (text.includes('event: error')) throw new Error(`Gradio error: ${text.slice(0, 200)}`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('Timed out waiting for the Kaggle brain.');
}
