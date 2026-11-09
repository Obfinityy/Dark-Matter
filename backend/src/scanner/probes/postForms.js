// Dark Matter rule-based scanner — POST-form probes.
// Many real apps (DVWA included) take input via POST forms, not URL params.
// This battery submits each POST form with injected values and applies the
// same differential oracles as the URL-param probes.
import { randomBytes } from 'node:crypto';
// Strict DB-error matcher (9 Nov 2026, Zerodha FP fix): the POST
// form battery is the variant that actually fired the false
// positive — a Cloudflare cookie containing "psql" read as a
// "postgres" error on wp-comments-post.php. Confirmation needs a
// genuine DB error phrase (detectDbError), never a bare engine word.
import { detectDbError, dbErrorWindow, engineForTech } from '../fingerprint.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

async function postForm(form, inputName, payload, opts = {}) {
  const params = new URLSearchParams();
  let n = 0;
  // Inputs are { name, type, value } objects (D1, #474 repair) —
  // every set/test here reads .name; inputName is a name string.
  for (const inp of form.inputs || []) {
    const name = inp.name;
    if (!name) continue;
    // SAFETY: non-target inputs get UNIQUE filler values (never equal).
    // A state-changing POST form (e.g. password-change) triggers when its
    // inputs "match" — identical fillers would fire it.
    if (name === inputName) {
      params.set(name, payload);
    } else if (/^submit$/i.test(name)) {
      params.set(name, '1');
    } else {
      params.set(name, `dmprobe${++n}_${randomBytes(2).toString('hex')}`);
    }
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(form.action, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(opts.headers || {}),
      },
      body: params.toString(),
    });
    return await res.text().catch(() => '');
  } finally {
    clearTimeout(t);
  }
}

async function postFormTimed(form, inputName, payload, opts = {}) {
  const start = Date.now();
  const ok = await postForm(form, inputName, payload, { ...opts, timeoutMs: 25000 })
    .then(() => true)
    .catch(() => false);
  return { ms: Date.now() - start, ok };
}

// The error window is quoted from the shared strict matcher in
// fingerprint.js (dbErrorWindow) — one source of truth for what
// counts as a DB error phrase, so the POST battery cannot drift
// back to bare-word matching.

function withEvidence(form, input, extra) {
  return {
    request: `POST ${form.action} (${input}=<payload>)`,
    ...extra,
  };
}

export async function probePostForms(forms, opts = {}) {
  const findings = [];
  const postForms = (forms || []).filter(
    (f) => String(f.method || 'get').toLowerCase() === 'post'
  );
  for (const form of postForms.slice(0, 10)) {
    // Skip submit buttons — injecting them is pointless and doubles runtime.
    const fields = (form.inputs || [])
      .filter((i) => i.name && !/^submit$/i.test(i.name))
      .slice(0, 8);
    for (const field of fields) {
      const input = field.name;
      // --- error-based SQLi: benign vs quote ---
      try {
        const benign = await postForm(form, input, '1', opts);
        const malicious = await postForm(form, input, "1'", opts);
        const dbFamily = detectDbError(malicious);
        // Stack gate (same rule as sqliError.js): an engine-specific
        // error contradicting the fingerprinted stack never confirms.
        const stackEngine = engineForTech(opts.tech);
        const stackMismatch =
          dbFamily && dbFamily !== 'generic' && stackEngine && dbFamily !== stackEngine;
        if (dbFamily && !stackMismatch && !detectDbError(benign)) {
          findings.push({
            class: 'sqli_error',
            id: `sqli-error-post-${input}`,
            title: `Error-based SQL injection in POST field '${input}'`,
            severity: 'critical',
            url: form.action,
            param: input,
            evidence: withEvidence(form, input, {
              response: `DB error signature (${dbFamily}) on input "1'" — "...${dbErrorWindow(malicious, dbFamily)}..."`,
              impact_demo: 'error present on malicious input; absent on benign input',
              errorCorrelated: true,
            }),
            dbFamily,
          });
          continue; // one finding per field is enough
        }
      } catch {
        // ignore per-field failures
      }
      // --- reflected XSS: unique canary ---
      try {
        const rand = randomBytes(4).toString('hex');
        const payload = `'"<>dmxss${rand}`;
        const body = await postForm(form, input, payload, opts);
        if (body.includes(payload)) {
          const idx = body.indexOf(payload);
          const window = body.slice(Math.max(0, idx - 60), idx + 120);
          findings.push({
            class: 'xss_reflected',
            id: `xss-reflected-post-${input}`,
            title: `Reflected XSS in POST field '${input}'`,
            severity: 'high',
            url: form.action,
            param: input,
            evidence: withEvidence(form, input, {
              response: `payload reflected unencoded in the response — "...${window}..."`,
              impact_demo: 'raw canary reflected verbatim in HTML context',
              canaryReflected: true,
            }),
          });
          continue;
        }
      } catch {
        // ignore
      }
      // --- command injection: time differential ---
      // Pure differential oracle: the injected sleep must ADD ~5s on top of
      // whatever the page normally takes. Two baselines absorb jitter; a
      // slow-but-stable baseline (e.g. DVWA's `ping -c 4`) must not suppress
      // a real finding.
      try {
        const base1 = await postFormTimed(form, input, '1', opts);
        const base2 = await postFormTimed(form, input, '2', opts);
        if (base1.ok && base2.ok && Math.abs(base1.ms - base2.ms) <= 2000) {
          const baseMs = Math.max(base1.ms, base2.ms);
          const injected = await postFormTimed(form, input, '1;sleep 5', opts);
          if (injected.ok && injected.ms - baseMs >= 4000) {
            findings.push({
              class: 'cmd_injection',
              id: `cmdi-time-post-${input}`,
              title: `Time-based OS command injection in POST field '${input}'`,
              severity: 'critical',
              url: form.action,
              param: input,
              evidence: withEvidence(form, input, {
                response: `response took ${injected.ms}ms vs ${baseMs}ms baseline`,
                impact_demo: 'injected sleep(5) tracks the response delay',
                delayTracks: true,
                signalCorrelated: true,
              }),
            });
          }
        }
      } catch {
        // ignore
      }
    }
  }
  return findings;
}
