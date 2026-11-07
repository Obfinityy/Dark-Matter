// Dark Matter rule-based scanner — HTTP verb / method-tampering probe
// (coverage rows #167 HTTP Verb Tampering + #35 API Verb Tampering).
//
// For each GET probe target the scanner already has, replay the same
// request with PUT, DELETE, PATCH and HEAD — EMPTY bodies, always.
// NON-DESTRUCTIVE by design: no payload that creates, modifies or
// deletes data is ever sent; the replayed URL carries exactly the
// same (unique, unequal) filler query values the GET battery uses,
// so a state-changing gate that requires matching values can never
// fire on it.
//
// VERIFICATION (100% truth rule): a finding counts ONLY on a
// differential — the non-GET method returns 2xx AND the response
// shows the request was actually processed:
//   (a) METHOD CONFUSION — the method response body is substantively
//       the same as the GET baseline (similarity >= 0.9): the server
//       treated the verb like GET; or
//   (b) STATE-INDICATING SUCCESS — the method response carries a
//       JSON success marker the GET baseline does NOT.
// A 405/501/404/3xx is NOT a finding. Exact status codes plus a
// body hash/length comparison land in the evidence.
//
// SAFETY: PUT/DELETE/PATCH are state-changing verbs. They run ONLY
// when opts.allowWrite === true — the same lab gate runScan sets
// solely for lab targets (labTargets), exactly like the file-upload
// probe. Everywhere else the probe sends HEAD only and records no
// findings, so no write verb ever leaves toward a non-lab host.
//
// HEAD RULE (decided, documented, tested): HEAD 200 on a GET page
// is NEVER a finding. HEAD is defined to return GET's headers
// without a body — a server answering HEAD 200 is behaving
// correctly. HEAD runs as the in-probe control (safe anywhere) and
// its status is recorded in the evidence.
//
// Redirects: the GET baseline follows redirects (the scanner's
// normal GET) and the write verbs are then issued against the FINAL
// URL — the endpoint that actually serves content. A method request
// itself never follows a redirect: a 302 to a login page must not
// read as a 200 acceptance.
import { createHash } from 'node:crypto';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

// State-changing verbs, probed only behind the lab gate.
const WRITE_METHODS = ['PUT', 'DELETE', 'PATCH'];
// One method-variant set per distinct endpoint URL — a URL with five
// params is one endpoint, not five. Bounds the request count.
const MAX_URLS = 10;
const SIMILARITY_THRESHOLD = 0.9;

// A JSON success field — tight enough that an error page cannot
// match it (it needs a success/result/status key with a truthy or
// past-tense value), loose enough for {"success":true} /
// {"status":"updated"} shapes.
const SUCCESS_MARKER_RE =
  /"(success|result|status)"\s*:\s*(true|"ok"|"success"|"updated"|"deleted"|"created"|"done")/i;

function sha12(text) {
  return createHash('sha256').update(String(text || '')).digest('hex').slice(0, 12);
}

function normLen(t) {
  return String(t || '').replace(/\s+/g, ' ').trim().length;
}

// Length-ratio similarity — the same measure rpo.js uses (threshold
// 0.9 there). Two pages of the same shape score high; an error page
// of a different size scores low.
function similarity(a, b) {
  const la = normLen(a);
  const lb = normLen(b);
  if (!la || !lb) return 0;
  return Math.min(la, lb) / Math.max(la, lb);
}

async function request(url, method, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      method,
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, ...(opts.headers || {}) },
      // Baseline GET follows redirects (default fetch behaviour);
      // every other request is manual — a redirect is never an
      // acceptance.
      redirect: method === 'GET' ? 'follow' : 'manual',
    });
    const text = method === 'HEAD' ? '' : await res.text().catch(() => '');
    return {
      status: res.status,
      text: text.slice(0, 500000),
      // Final URL after redirects (mocked fetch has no .url — the
      // requested URL is the fallback).
      url: res.url || url,
      ct: (res.headers && res.headers.get('content-type')) || '',
    };
  } catch {
    return { status: 0, text: '', url, ct: '' };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Replay each GET probe target with PUT/DELETE/PATCH/HEAD.
 * @param {string[]} urls — distinct endpoint URLs that carry probe
 *   points (the orchestrator selects them; a URL with no probe point
 *   is not a GET probe target and is never passed in).
 * @param {object} opts — { timeoutMs, headers, allowWrite }.
 *   allowWrite === true (lab gate) is required for the write verbs;
 *   without it the probe sends HEAD only and returns [].
 * @returns {object[]} findings (class 'verb_tampering', medium).
 */
export async function probeVerbTampering(urls, opts = {}) {
  const targets = [...new Set((Array.isArray(urls) ? urls : []).filter(Boolean))].slice(0, MAX_URLS);
  const findings = [];
  const allowWrite = opts && opts.allowWrite === true;
  for (const targetUrl of targets) {
    // HEAD control — safe anywhere, runs on every target.
    const head = await request(targetUrl, 'HEAD', opts);
    // LAB GATE: no write verb ever leaves toward a non-lab host.
    if (!allowWrite) continue;
    // GET baseline — the endpoint must be a live GET endpoint, and
    // the write verbs go to the URL that actually serves content.
    const base = await request(targetUrl, 'GET', opts);
    if (base.status < 200 || base.status >= 300) continue;
    const finalUrl = base.url || targetUrl;
    const baseHash = sha12(base.text);
    const baseLen = base.text.length;
    const baseSuccess = SUCCESS_MARKER_RE.test(base.text);
    for (const method of WRITE_METHODS) {
      const r = await request(finalUrl, method, opts);
      // 405/501/404/3xx/transport failure — the verb is refused,
      // not accepted. Never a finding.
      if (r.status < 200 || r.status >= 300) continue;
      const sim = similarity(base.text, r.text);
      const methodSuccess = SUCCESS_MARKER_RE.test(r.text);
      const confused = sim >= SIMILARITY_THRESHOLD;
      const stateSuccess = methodSuccess && !baseSuccess;
      if (!confused && !stateSuccess) continue;
      findings.push({
        class: 'verb_tampering',
        id: `verb-tampering-${method.toLowerCase()}-${sha12(finalUrl)}`,
        title: confused
          ? `HTTP verb tampering — ${method} accepted on a GET endpoint (method confusion)`
          : `HTTP verb tampering — ${method} accepted on a GET endpoint (state-indicating success)`,
        severity: 'medium',
        url: finalUrl,
        parameter: method,
        evidence: {
          request: `${method} ${finalUrl} (empty body); baseline GET ${finalUrl}`,
          response:
            `GET ${base.status} (${baseLen} bytes, sha256 ${baseHash}) vs ` +
            `${method} ${r.status} (${r.text.length} bytes, sha256 ${sha12(r.text)}), ` +
            `body similarity ${sim.toFixed(2)}` +
            (confused ? ' — server treated the verb like GET' : '') +
            (stateSuccess ? ' — response carries a success marker the GET baseline does not' : '') +
            `. HEAD ${head.status} (control: safe method, never a finding).`,
          impact_demo:
            'Method-confusion / verb-tampering primitive — an endpoint that only documents GET also processes state-changing verbs; chain with auth-gated actions for privilege/state impact.',
          signalCorrelated: true,
        },
      });
    }
  }
  return findings;
}

export const __verbTamperingMeta = { phases: ['verb-tampering'], depth: ['quick', 'standard', 'deep'] };
