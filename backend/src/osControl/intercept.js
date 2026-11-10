// Split out of osControl.js by the P3 professionalization lane (split-only, no behaviour change).
// Dispatch branches of executeOsAction, moved verbatim except that
// dispatcher locals are read through the c context object.

import {
  startInterceptProxy,
  listIntercept,
  readInterceptEntry,
  buildReplayRequest,
  buildReplayCurl,
  replaySignature,
} from '../proxyIntercept.js';
import { scopeViolation } from '../humanLoop.js';
import { OBS_BUDGET, desktopDownObservation, readDesktopState } from './common.js';

export async function handleProxyStart(huntId, action, c) {
  // Start the intercept proxy + dashboard inside the hunter's own
  // container and route its Chromium through it. Idempotent — a
  // re-run only reports state. Touches only the hunter's own
  // machine; no traffic leaves.
  if (typeof c.execRaw !== 'function') return { ok: false, observation: 'proxy_start is unavailable — no container exec.' };
  const ex = (h, c, t, o) => c.execRaw(h, c, t, o);
  const res = await startInterceptProxy(huntId, { exec: ex });
  return { ok: res.ok !== false, observation: res.observation || '(no observation)' };
}

export async function handleInterceptList(huntId, action, c) {
  // Read the hunter's own capture file. Read-only, like recall.
  if (typeof c.execRaw !== 'function') return { ok: false, observation: 'intercept_list is unavailable — no container exec.' };
  const ex = (h, c, t, o) => c.execRaw(h, c, t, o);
  const res = await listIntercept(huntId, { exec: ex });
  return { ok: res.ok !== false, observation: res.observation || '(no observation)' };
}

export async function handleInterceptRead(huntId, action, c) {
  // One captured flow in full. Read-only.
  if (typeof c.execRaw !== 'function') return { ok: false, observation: 'intercept_read is unavailable — no container exec.' };
  const ex = (h, c, t, o) => c.execRaw(h, c, t, o);
  const res = await readInterceptEntry(huntId, action.index, { exec: ex });
  return { ok: res.ok !== false, observation: res.observation || '(no observation)' };
}

export async function handleInterceptReplay(huntId, action, c) {
  // Burp-Repeater work: resend one captured request with the
  // brain's modifications. This DOES send traffic, so it is treated
  // exactly like a shell probe: scope-checked on the FINAL url
  // (a captured third-party request may not be replayed out of
  // programme) and executed through the same shell exec.
  if (typeof c.execRaw !== 'function') return { ok: false, observation: 'intercept_replay is unavailable — no container exec.' };
  if (typeof c.exec !== 'function') return { ok: false, observation: 'intercept_replay is unavailable — no shell exec.' };
  const ex = (h, c, t, o) => c.execRaw(h, c, t, o);
  const read = await readInterceptEntry(huntId, action.index, { exec: ex });
  if (!read.ok || !read.entry) {
    return { ok: false, observation: read.observation || 'That capture could not be read — run intercept_list and pick a real index.' };
  }
  const built = buildReplayRequest(read.entry.flow, { url: action.url, headers: action.headers, body: action.body });
  if (!built.ok) return { ok: false, observation: built.error };
  const badUrl = scopeViolation(built.url, c.target, c.parsedScope || null);
  if (badUrl) {
    return { ok: false, observation: `BLOCKED — OUT OF SCOPE: ${badUrl} is not part of this programme. A replay may only be sent to ${c.target} and its listed assets. Nothing was sent.` };
  }
  try {
    const result = await c.exec(huntId, c.target, buildReplayCurl(built));
    const combined = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
    const statusLine = /^HTTP\/\S+ \d{3}[^\n]*/m.exec(combined);
    const head = `Replayed capture #${read.entry.index} as ${built.method} ${built.url} — ${statusLine ? statusLine[0] : 'no HTTP response received'}.`;
    let observation = combined ? `${head}\n${combined.slice(0, OBS_BUDGET)}` : `${head} (the replay produced no output)`;
    if (combined.length > OBS_BUDGET) observation += `\n[response truncated on screen — ${combined.length} chars total]`;
    if (result.code && result.code !== 0) observation += `\n[curl exit code ${result.code}]`;
    return { ok: true, observation };
  } catch (err) {
    return { ok: false, observation: `Replay failed to run: ${err.message || err}` };
  }
}
