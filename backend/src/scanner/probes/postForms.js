// Dark Matter rule-based scanner — POST-form probes.
// Many real apps (DVWA included) take input via POST forms, not URL params.
// This battery submits each POST form with injected values and applies the
// same differential oracles as the URL-param probes.
import { randomBytes } from 'node:crypto';
import { detectDbFamily } from '../fingerprint.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

async function postForm(form, inputName, payload, opts = {}) {
  const params = new URLSearchParams();
  for (const inp of form.inputs || []) {
    params.set(inp, inp === inputName ? payload : '1');
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
    for (const input of (form.inputs || []).slice(0, 8)) {
      // --- error-based SQLi: benign vs quote ---
      try {
        const benign = await postForm(form, input, '1', opts);
        const malicious = await postForm(form, input, "1'", opts);
        const dbFamily = detectDbFamily(malicious);
        if (dbFamily && !detectDbFamily(benign)) {
          findings.push({
            class: 'sqli_error',
            id: `sqli-error-post-${input}`,
            title: `Error-based SQL injection in POST field '${input}'`,
            severity: 'critical',
            url: form.action,
            param: input,
            evidence: withEvidence(form, input, {
              response: `DB error signature (${dbFamily}) on input "1'"`,
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
          findings.push({
            class: 'xss_reflected',
            id: `xss-reflected-post-${input}`,
            title: `Reflected XSS in POST field '${input}'`,
            severity: 'high',
            url: form.action,
            param: input,
            evidence: withEvidence(form, input, {
              response: 'payload reflected unencoded in the response',
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
      try {
        const base = await postFormTimed(form, input, '1', opts);
        if (base.ok && base.ms < 3000) {
          const injected = await postFormTimed(form, input, '1;sleep 5', opts);
          if (
            injected.ok &&
            injected.ms >= 3500 &&
            injected.ms - base.ms >= 4000
          ) {
            findings.push({
              class: 'cmd_injection',
              id: `cmdi-time-post-${input}`,
              title: `Time-based OS command injection in POST field '${input}'`,
              severity: 'critical',
              url: form.action,
              param: input,
              evidence: withEvidence(form, input, {
                response: `response took ${injected.ms}ms vs ${base.ms}ms baseline`,
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
