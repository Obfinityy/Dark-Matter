// Dark Matter rule-based scanner — POST-form probes.
// Many real apps (DVWA included) take input via POST forms, not URL params.
// This battery submits each POST form with injected values and applies the
// same differential oracles as the URL-param probes.
import { randomBytes } from 'node:crypto';
import { detectDbFamily } from '../fingerprint.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

async function postForm(form, inputName, payload, opts = {}) {
  const params = new URLSearchParams();
  let n = 0;
  for (const inp of form.inputs || []) {
    // SAFETY: non-target inputs get UNIQUE filler values (never equal).
    // A state-changing POST form (e.g. password-change) triggers when its
    // inputs "match" — identical fillers would fire it.
    if (inp === inputName) {
      params.set(inp, payload);
    } else if (/^submit$/i.test(inp)) {
      params.set(inp, '1');
    } else {
      params.set(inp, `dmprobe${++n}_${randomBytes(2).toString('hex')}`);
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
      .filter((i) => !/^submit$/i.test(i))
      .slice(0, 8);
    for (const input of fields) {
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
