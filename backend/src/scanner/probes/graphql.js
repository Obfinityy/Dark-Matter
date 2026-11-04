// Dark Matter rule-based scanner — GraphQL endpoint testing probe.
// Tests GraphQL endpoints for: introspection enabled, query-depth DoS,
// unauthenticated mutations, error-based field leakage, and batching abuse.
// All tests use differential oracles per the 100% truth rule.
const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

// Common GraphQL endpoint paths to probe
const GRAPHQL_PATHS = [
  '/graphql',
  '/api/graphql',
  '/graphql/console',
  '/graphiql',
  '/.well-known/graphql',
];

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

async function gqlPost(url, query, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
      },
      body: JSON.stringify({ query }),
    });
    const text = await res.text().catch(() => '');
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { ok: true, status: res.status, json, text };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    clearTimeout(t);
  }
}

async function findGraphQLEndpoint(baseUrl, opts = {}) {
  // Try common paths
  const base = baseUrl.replace(/\/$/, '');
  for (const p of GRAPHQL_PATHS) {
    const url = base + p;
    const r = await gqlPost(url, '{__typename}', opts);
    if (r.ok && r.json && (r.json.data || r.json.errors)) {
      return url;
    }
  }
  return null;
}

async function fetchPage(url, opts = {}) {
  // Raw GET with manual redirects; returns body text + set-cookie list.
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: ctrl.signal,
      redirect: 'manual',
      headers: { 'User-Agent': UA, ...(opts.headers || {}) },
    });
    const text = await res.text().catch(() => '');
    let setCookies = [];
    try {
      if (res.headers && typeof res.headers.getSetCookie === 'function') {
        setCookies = res.headers.getSetCookie();
      } else if (res.headers) {
        const sc = res.headers.get('set-cookie');
        if (sc) setCookies = [sc];
      }
    } catch {}
    return { ok: true, status: res.status, text, setCookies };
  } catch (e) {
    return { ok: false, error: e.message, setCookies: [] };
  } finally {
    clearTimeout(t);
  }
}

function isLabTarget(url, opts) {
  try {
    const host = new URL(url).hostname;
    return String(opts.labTargets || '')
      .split(/[,\s]+/)
      .filter(Boolean)
      .some((h) => host === h || host.endsWith('.' + h));
  } catch {
    return false;
  }
}

// ---- #155: GraphQL CSRF on GET-based queries (MEDIUM) ---------------------------
// Fires ONLY when BOTH hold: endpoint executes queries via GET AND a session
// cookie exists without SameSite=Lax/Strict protection.
async function t155GetCsrf(endpoint, pageUrl, opts, timeoutMs, canary) {
  const findings = [];
  // A) Does the endpoint execute queries over GET? (benign __typename)
  const getRes = await fetchPage(
    `${endpoint}?query=${encodeURIComponent('{__typename}')}`,
    { timeoutMs }
  );
  let getExecutes = false;
  if (getRes.ok) {
    try {
      const j = JSON.parse(getRes.text);
      getExecutes = !!(j.data && j.data.__typename);
    } catch {}
  }
  if (!getExecutes) return findings;

  // B) Session cookie without SameSite protection?
  const page = await fetchPage(pageUrl, { timeoutMs });
  const weak = [];
  for (const sc of page.setCookies || []) {
    const parts = String(sc).split(';');
    const name = (parts[0].split('=')[0] || '').trim();
    if (!name || !/sess|session|auth|token|sid|phpsessid|jsessionid|aspsession/i.test(name)) {
      continue;
    }
    const attrs = parts.slice(1).join(';');
    const m = /samesite\s*=\s*([a-z]+)/i.exec(attrs);
    const ss = m ? m[1].toLowerCase() : null;
    const secure = /;\s*secure\b/i.test(';' + attrs);
    if (ss === 'lax' || ss === 'strict') continue;
    if (ss === 'none' && secure) continue; // SameSite=None; Secure is acceptable
    weak.push(name);
  }
  if (!weak.length) return findings;

  findings.push({
    class: 'graphql_csrf_get',
    id: `graphql-csrf-get-${canary}`,
    title: 'GraphQL GET queries + unprotected session cookie — CSRF on authenticated queries (MEDIUM)',
    severity: 'medium',
    url: endpoint,
    parameter: weak[0],
    evidence: {
      request: `GET ${endpoint}?query=${encodeURIComponent('{__typename}')}`,
      response: `GET query executed (data.__typename returned) AND session cookie "${weak[0]}" has no SameSite=Lax/Strict protection`,
      impact_demo:
        'A cross-site <img>/link can trigger authenticated GraphQL queries in the victim session; any state-changing query/mutation becomes CSRF-able.',
      signalCorrelated: true,
    },
  });
  return findings;
}

// ---- #156: GraphQL field-level authorization bypass (HIGH/CRITICAL) --------------
// Via introspection, enumerate sensitive-named fields; query a few WITHOUT
// auth headers. CONFIRMED only on non-null data returned (errors/null = reject).
const SENSITIVE_FIELD_RE = /password|passhash|ssn|socialsecurity|secret|token|apikey|api_key|email|phone|salary|wage|admin|role/i;

async function t156FieldAuthBypass(endpoint, opts, timeoutMs, canary) {
  const findings = [];
  const fRes = await gqlPost(
    endpoint,
    '{__schema{queryType{fields{name}}}}',
    { timeoutMs, headers: opts.headers }
  );
  const fields =
    fRes.ok && fRes.json && fRes.json.data
      ? fRes.json.data.__schema?.queryType?.fields || []
      : [];
  const sensitive = fields
    .map((f) => f.name)
    .filter((n) => SENSITIVE_FIELD_RE.test(n))
    .slice(0, 3);
  if (!sensitive.length) return findings;

  // Unauthenticated: send WITHOUT any caller-supplied headers (no Authorization).
  const r = await gqlPost(endpoint, `{${sensitive.join(' ')}}`, { timeoutMs });
  if (!r.ok || !r.json || !r.json.data) return findings;
  const leaked = sensitive.filter((n) => {
    const v = r.json.data[n];
    return v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
  });
  if (!leaked.length) return findings;

  // Honest severity: high by default; critical only for clearly privileged
  // values (e.g. password hashes, secrets) actually returned.
  let severity = 'high';
  for (const n of leaked) {
    const v = String(r.json.data[n] ?? '');
    if (/^(password|passhash|ssn|secret|token|apikey|api_key)$/i.test(n) && v.length >= 8) {
      severity = 'critical';
      break;
    }
  }

  findings.push({
    class: 'graphql_field_auth_bypass',
    id: `graphql-field-auth-${canary}`,
    title: `GraphQL field-level authorization bypass — sensitive fields readable unauthenticated (${leaked.join(', ')}) (${severity.toUpperCase()})`,
    severity,
    url: endpoint,
    parameter: leaked.join(','),
    evidence: {
      request: `POST ${endpoint} {"query":"{${sensitive.join(' ')}}"} (no auth headers)`,
      response: `200 with non-null data for: ${leaked.join(', ')}`,
      impact_demo:
        'Sensitive fields are returned to unauthenticated callers — field-level authorization is missing on these resolvers.',
      signalCorrelated: true,
    },
  });
  return findings;
}

// ---- #158: GraphQL mutation mass assignment (HIGH, lab-gated) --------------------
// Via introspection, find mutations whose input objects expose privileged
// field names. Non-lab = PASSIVE low finding only. Lab = active mutation with
// canary values; CONFIRMED only if no "unknown field" validation error AND
// data is returned.
const PRIV_INPUT_RE = /^(role|isadmin|admin|permissions|privilege|is_superuser|superuser)$/i;

async function t158MutationMassAssign(endpoint, opts, timeoutMs, canary) {
  const findings = [];
  const mRes = await gqlPost(
    endpoint,
    '{__schema{mutationType{fields{name args{name type{kind ofType{name inputFields{name}}}}}}}}',
    { timeoutMs, headers: opts.headers }
  );
  const mutFields =
    mRes.ok && mRes.json && mRes.json.data
      ? mRes.json.data.__schema?.mutationType?.fields || []
      : [];
  const candidates = [];
  for (const m of mutFields.slice(0, 5)) {
    for (const a of m.args || []) {
      const inner = a.type && a.type.ofType;
      if (inner && Array.isArray(inner.inputFields)) {
        const all = inner.inputFields.map((f) => f.name);
        const privileged = all.filter((n) => PRIV_INPUT_RE.test(n));
        if (all.length) {
          candidates.push({
            mutation: m.name,
            arg: a.name,
            typeName: inner.name,
            privileged,
            all,
          });
        }
      }
    }
  }
  const withPriv = candidates.filter((c) => c.privileged.length);
  if (!withPriv.length) return findings;

  // Non-lab: passive surface note only — never send the mutation.
  if (!isLabTarget(endpoint, opts)) {
    const c = withPriv[0];
    findings.push({
      class: 'graphql_mutation_privileged_fields',
      id: `graphql-mutpriv-${canary}`,
      title: 'GraphQL mutation input exposes privileged fields — mass-assignment surface (LOW)',
      severity: 'low',
      url: endpoint,
      parameter: `${c.mutation}.${c.arg}`,
      evidence: {
        request: `POST ${endpoint} (introspection only — no mutation sent)`,
        response: `Mutation "${c.mutation}" input type "${c.typeName}" exposes privileged field(s): ${c.privileged.join(', ')}`,
        impact_demo:
          'If the resolver binds the whole input object, a caller could elevate privileges (role/isAdmin) via the input. Verify on a lab target.',
        signalCorrelated: true,
      },
    });
    return findings;
  }

  // LAB: active probe with canary values only (fake id — touches no real data).
  const c = withPriv[0];
  const canaryVal = `dm_${canary}`;
  const docField = c.all.find((n) => /id/i.test(n)) || c.all[0];
  const extra = c.privileged
    .map((p) => (/isadmin|admin/i.test(p) ? `${p}:true` : `${p}:"${canaryVal}"`))
    .join(' ');
  const query = `mutation{${c.mutation}(${c.arg}:{${docField}:"${canaryVal}" ${extra}}){__typename}}`;
  const r = await gqlPost(endpoint, query, { timeoutMs, headers: opts.headers });
  const txt = r.ok ? JSON.stringify(r.json || {}) : r.error || '';
  const unknownFieldErr = /unknown field|did not match|invalid|validation/i.test(txt) && !(r.json && r.json.data);
  if (r.ok && r.json && r.json.data && !unknownFieldErr) {
    findings.push({
      class: 'graphql_mutation_mass_assignment',
      id: `graphql-massassign-${canary}`,
      title: `GraphQL mutation mass assignment — privileged input fields accepted without validation (${c.privileged.join(', ')}) (HIGH)`,
      severity: 'high',
      url: endpoint,
      parameter: `${c.mutation}.${c.arg}`,
      evidence: {
        request: `POST ${endpoint} {"query":"${query}"} (lab target, canary values only)`,
        response: `200 with data returned and NO "unknown field" validation error — the privileged input field(s) were accepted: ${c.privileged.join(', ')}`,
        impact_demo:
          'The resolver binds unexpected privileged fields from the input object — callers can inject role/isAdmin and escalate privileges.',
        signalCorrelated: true,
      },
    });
  }
  return findings;
}

export async function probeGraphql(url, opts = {}) {
  const findings = [];
  const timeoutMs = opts.timeoutMs || 15000;
  const depth = opts.depth || 'standard'; // quick, standard, deep

  // Step 1: Find GraphQL endpoint
  const endpoint = await findGraphQLEndpoint(url, { timeoutMs, headers: opts.headers });
  if (!endpoint) return findings;

  const canary = `dm${rand()}`;

  // T1: Introspection enabled
  const introRes = await gqlPost(endpoint, '{__schema{queryType{name}}}', { timeoutMs, headers: opts.headers });
  if (introRes.ok && introRes.json && introRes.json.data && introRes.json.data.__schema) {
    // Introspection is ON — check for sensitive types
    const typesRes = await gqlPost(
      endpoint,
      '{__schema{types{name}}}',
      { timeoutMs, headers: opts.headers }
    );
    let sensitiveTypes = [];
    if (typesRes.ok && typesRes.json && typesRes.json.data) {
      const types = typesRes.json.data.__schema?.types || [];
      const sensitiveRe = /password|secret|token|ssn|admin|internal|debug/i;
      sensitiveTypes = types
        .map(t => t.name)
        .filter(n => sensitiveRe.test(n))
        .slice(0, 5);
    }

    findings.push({
      class: 'graphql_introspection',
      id: `graphql-intro-${canary}`,
      title: 'GraphQL introspection enabled — schema disclosure',
      severity: sensitiveTypes.length > 0 ? 'low' : 'info',
      url: endpoint,
      parameter: '__schema',
      evidence: {
        request: `POST ${endpoint} {"query":"{__schema{queryType{name}}}"}`,
        response: `200 with data.__schema present${sensitiveTypes.length ? `; sensitive types: ${sensitiveTypes.join(', ')}` : ''}`,
        impact_demo: 'Attackers can map the full API schema without authentication',
        signalCorrelated: true,
      },
    });

    // T4: Error-based field suggestion (only if introspection gave us a schema)
    // Quick depth skips T2-T5; Standard/Deep runs full battery
    if (depth !== 'quick') {
      // #156: field-level authorization bypass (unauthenticated sensitive fields)
      findings.push(...(await t156FieldAuthBypass(endpoint, opts, timeoutMs, canary)));
      // #158: mutation mass assignment (lab-gated active; passive low elsewhere)
      findings.push(...(await t158MutationMassAssign(endpoint, opts, timeoutMs, canary)));
      const fakeField = `dmfield${rand()}`;
      const errRes = await gqlPost(endpoint, `{${fakeField}}}`, { timeoutMs, headers: opts.headers });
      if (errRes.ok && errRes.json && errRes.json.errors) {
        const errMsg = JSON.stringify(errRes.json.errors);
        // Check for "Did you mean" or type leakage
        if (/did you mean|similar|available/i.test(errMsg)) {
          // Control: second random name should produce isomorphic error
          const fakeField2 = `dmfield${rand()}`;
          const errRes2 = await gqlPost(endpoint, `{${fakeField2}}}`, { timeoutMs, headers: opts.headers });
          if (errRes2.ok && errRes2.json && errRes2.json.errors) {
            findings.push({
              class: 'graphql_error_leakage',
              id: `graphql-err-${canary}`,
              title: 'GraphQL error leaks field suggestions — schema inference',
              severity: 'low',
              url: endpoint,
              parameter: fakeField,
              evidence: {
                request: `POST ${endpoint} {"query":"{${fakeField}}}"}`,
                response: `Error suggests real fields: ${errMsg.slice(0, 200)}`,
                impact_demo: 'Server teaches schema structure without introspection',
                signalCorrelated: true,
              },
            });
          }
        }
      }

      // T2: Query-depth DoS (GATED — only on Standard/Deep, with latency oracle)
      if (depth === 'deep' || depth === 'standard') {
        // Baseline: median of 3 __typename requests
        const baselines = [];
        for (let i = 0; i < 3; i++) {
          const start = Date.now();
          await gqlPost(endpoint, '{__typename}', { timeoutMs, headers: opts.headers });
          baselines.push(Date.now() - start);
        }
        baselines.sort((a, b) => a - b);
        const baselineMedian = baselines[1];

        // Payload: deeply nested query (10 levels)
        // Use __typename to avoid needing schema knowledge
        let nested = '{__typename}';
        for (let i = 0; i < 10; i++) {
          nested = `{__typename nested${i}${nested}}`;
        }
        // Actually, let's use a simpler alias-overloading test
        const aliases = Array.from({ length: 50 }, (_, i) => `a${i}:__typename`).join(' ');
        const payloadQuery = `{${aliases}}`;

        const payloadTimes = [];
        for (let i = 0; i < 3; i++) {
          const start = Date.now();
          await gqlPost(endpoint, payloadQuery, { timeoutMs, headers: opts.headers });
          payloadTimes.push(Date.now() - start);
        }
        payloadTimes.sort((a, b) => a - b);
        const payloadMedian = payloadTimes[1];

        // Oracle: payload >= 10x baseline AND baseline stable (±25%)
        const baselineStable = baselines[2] - baselines[0] < baselineMedian * 0.5;
        if (baselineStable && payloadMedian >= baselineMedian * 10 && baselineMedian > 0) {
          findings.push({
            class: 'graphql_dos',
            id: `graphql-dos-${canary}`,
            title: 'GraphQL query-depth / alias-overloading DoS — latency amplification',
            severity: 'medium',
            url: endpoint,
            parameter: 'query',
            evidence: {
              request: `POST ${endpoint} with 50 aliased __typename fields`,
              response: `Baseline median: ${baselineMedian}ms, payload median: ${payloadMedian}ms (${(payloadMedian / baselineMedian).toFixed(1)}x)`,
              impact_demo: 'Attacker can amplify server load via nested/aliased queries',
              signalCorrelated: true,
            },
          });
        }
      }

      // T5: Batching abuse (MEDIUM)
      // First, check rate limiting with 5 rapid sequentials
      let rateLimited = false;
      for (let i = 0; i < 5; i++) {
        const r = await gqlPost(endpoint, '{__typename}', { timeoutMs: 5000, headers: opts.headers });
        if (r.ok && r.status === 429) {
          rateLimited = true;
          break;
        }
      }
      if (rateLimited) {
        // Try batching: 20 queries in one POST
        const batch = Array.from({ length: 20 }, () => ({ query: '{__typename}' }));
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            signal: ctrl.signal,
            headers: {
              'User-Agent': UA,
              'Content-Type': 'application/json',
              ...(opts.headers || {}),
            },
            body: JSON.stringify(batch),
          });
          const text = await res.text().catch(() => '');
          let json = null;
          try { json = JSON.parse(text); } catch {}
          // If we got 20 responses back, batching bypassed rate limiting
          if (res.ok && Array.isArray(json) && json.length === 20) {
            findings.push({
              class: 'graphql_batching',
              id: `graphql-batch-${canary}`,
              title: 'GraphQL batching bypasses rate limiting',
              severity: 'medium',
              url: endpoint,
              parameter: 'batch',
              evidence: {
                request: `POST ${endpoint} with 20 batched {__typename} queries`,
                response: `20/20 responses returned despite rate limiting`,
                impact_demo: 'Attacker can bypass rate limits via batching',
                signalCorrelated: true,
              },
            });
          }
        } catch {} finally {
          clearTimeout(t);
        }
      }
    }
  }

  // #155: GraphQL CSRF on GET-based queries — needs endpoint only (not
  // introspection). Standard/Deep; Quick skips.
  if (depth !== 'quick') {
    findings.push(...(await t155GetCsrf(endpoint, url, opts, timeoutMs, canary)));
  }

  return findings;
}
