/**
 * gradioClient.js — minimal Gradio inference client for the agent poller.
 *
 * The poller runs headless on the agent machine (no browser). It calls the
 * user's Kaggle Gradio links DIRECTLY for brain inference — the same
 * single-Textbox `gr.Interface` predict format the frontend uses
 * (see frontend/src/services/gradioDirect.js).
 *
 * Brain hierarchy (standing order): the HACKING brain is the SOLE
 * decision-maker. Vision/grounding are only consulted when the loop needs
 * them; they never decide.
 */

const BRAIN_TIMEOUT_MS = 120_000;

/** Normalize a Gradio share URL (strip trailing slashes). */
export function normalizeUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

/**
 * Call a single-Textbox Gradio Interface: POST {data:[prompt]} to
 * /gradio_api/call/predict, then poll /gradio_api/call/predict/{eventId}.
 * Resolves with the output text.
 */
export async function gradioPredict(gradioUrl, prompt, { timeoutMs = BRAIN_TIMEOUT_MS } = {}) {
  const base = normalizeUrl(gradioUrl);
  if (!/^https?:\/\//i.test(base)) throw new Error('Invalid Gradio URL');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // 1) enqueue the prediction
    const postRes = await fetch(`${base}/gradio_api/call/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [prompt] }),
      signal: ctrl.signal,
    });
    if (!postRes.ok) throw new Error(`Gradio predict failed: HTTP ${postRes.status}`);
    const postJson = await postRes.json();
    const eventId = postJson?.event_id;
    if (!eventId) throw new Error('Gradio did not return an event_id');

    // 2) poll for completion
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const getRes = await fetch(`${base}/gradio_api/call/predict/${eventId}`, {
        signal: ctrl.signal,
      });
      if (!getRes.ok) throw new Error(`Gradio poll failed: HTTP ${getRes.status}`);
      const text = await getRes.text();
      // SSE stream: look for the final data event
      const events = text.split('\n\n').filter(Boolean);
      for (const evt of events) {
        const dataLine = evt.split('\n').find((l) => l.startsWith('data:'));
        if (!dataLine) continue;
        let payload;
        try {
          payload = JSON.parse(dataLine.slice(5).trim());
        } catch {
          continue;
        }
        if (Array.isArray(payload) && payload.length > 0) {
          const out = payload[0];
          return typeof out === 'string' ? out : JSON.stringify(out);
        }
        if (payload && payload.msg === 'process_completed' && payload.output) {
          const out = payload.output?.data?.[0];
          return typeof out === 'string' ? out : JSON.stringify(out ?? '');
        }
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    throw new Error('Gradio prediction timed out');
  } finally {
    clearTimeout(timer);
  }
}

/** Extract the first balanced {...} JSON object from model prose. */
export function extractJson(text) {
  const s = String(text || '');
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i += 1) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') {
      inStr = true;
    } else if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(s.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
