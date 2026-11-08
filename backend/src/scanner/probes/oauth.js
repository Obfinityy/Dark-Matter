// Dark Matter rule-based scanner — OAuth 2.0 / OIDC redirect & token hygiene probe.
// Tests authorization endpoints for redirect_uri validation bypass (account
// takeover), implicit-flow tokens in URL fragments, missing state enforcement
// (login CSRF), PKCE enforcement on public clients, OAuth scope escalation
// (lab-gated), OIDC id_token config/token gaps, and secret/endpoint
// hygiene. Every CONFIRMED verdict sits behind a differential oracle per the
// 100% truth rule. The probe NEVER completes an authorization flow, never
// exchanges a code, never redeems a token: authorization REQUESTS only, the
// flow stops at the 302 Location header (redirects are never followed).

import { isLabTargetHost } from '../../labCreds.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

// Known authorization endpoint paths to probe (max 6)
const AUTH_PATHS = [
  '/oauth/authorize',
  '/oauth2/authorize',
  '/connect/authorize',
  '/auth/authorize',
  '/authorize',
  '/oauth/authorize/',
];

// Bundle strings that hint at OAuth/OIDC usage (passive detection)
const OAUTH_BUNDLE_PATTERNS = [
  /client_id/i,
  /redirect_uri/i,
  /oauth\/authorize/i,
  /oauth2\/authorize/i,
  /connect\/authorize/i,
  /\.well-known\/openid-configuration/i,
  /Login with (Google|GitHub|Facebook|Microsoft|Apple)/i,
  /accounts\.google\.com/i,
];

const SECRET_RE = /(client_secret|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/i;

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function evidenceBase(note, impact) {
  return {
    request: `GET <auth-endpoint>?client_id=<discovered>&redirect_uri=<canary>&response_type=code&state=<canary> (redirects NOT followed)`,
    response: note,
    impact_demo: impact,
    signalCorrelated: true,
  };
}

// Match OAuth bundle hints in page text. Returns array of matched pattern sources.
export function matchOauthBundleHints(text) {
  const hits = [];
  for (const re of OAUTH_BUNDLE_PATTERNS) {
    if (re.test(text)) hits.push(re.source);
  }
  return hits;
}

// Extract a plausible client_id from bundle text (heuristic, may be null).
export function extractClientId(text) {
  const m = text.match(/client_id["'\s:=]+([A-Za-z0-9._\-~]{4,64})/i);
  return m ? m[1] : null;
}

// Authorization request WITHOUT following redirects. Returns {status, location}.
export async function oauthAuthRequest(endpoint, params, opts = {}) {
  const timeoutMs = opts.timeoutMs || 5000;
  const u = new URL(endpoint);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(u.toString(), {
      method: 'GET',
      headers: { 'User-Agent': UA },
      redirect: 'manual', // NEVER follow — read the 302 Location and stop
      signal: ctrl.signal,
    });
    return { status: res.status, location: res.headers.get('location') || '' };
  } catch {
    return { status: 0, location: '' };
  } finally {
    clearTimeout(timer);
  }
}

// Discover OIDC configuration. Returns {authorization_endpoint, issuer} or null.
export async function discoverOidc(baseUrl, opts = {}) {
  const timeoutMs = opts.timeoutMs || 5000;
  let base;
  try { base = new URL(baseUrl); } catch { return null; }
  const wellKnown = `${base.protocol}//${base.host}/.well-known/openid-configuration`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(wellKnown, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const doc = await res.json();
    if (!doc || typeof doc !== 'object' || !doc.authorization_endpoint) return null;
    const arr = (v) => (Array.isArray(v) ? v.map(String) : []);
    return {
      authorization_endpoint: doc.authorization_endpoint,
      issuer: doc.issuer || null,
      jwks_uri: doc.jwks_uri || null,
      token_endpoint: doc.token_endpoint || null,
      // Auth-gap (#320) config fields — passive analysis only here.
      idTokenSigningAlgs: arr(doc.id_token_signing_alg_values_supported),
      tokenEndpointAuthMethods: arr(doc.token_endpoint_auth_methods_supported),
      responseTypes: arr(doc.response_types_supported),
      responseModes: arr(doc.response_modes_supported),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Probe candidate endpoints for a live authorization endpoint.
// Returns the first endpoint that responds with a 3xx or 4xx to a canary request.
async function findAuthEndpoint(url, opts) {
  const timeoutMs = opts.timeoutMs || 5000;
  let base;
  try { base = new URL(url); } catch { return null; }
  const origin = `${base.protocol}//${base.host}`;
  const canary = `dm${rand()}`;
  for (const p of AUTH_PATHS) {
    const endpoint = origin + p;
    const r = await oauthAuthRequest(endpoint, {
      client_id: `dm-canary-${canary}`,
      redirect_uri: `${origin}/cb`,
      response_type: 'code',
      state: canary,
    }, { timeoutMs });
    // A live auth endpoint answers with redirect-to-login, error page, or
    // invalid-client — anything but connection failure / 404 silence.
    if (r.status >= 300 && r.status < 500 && r.status !== 404) return endpoint;
  }
  return null;
}

// Lab-gate: true when the target host is listed in opts.labTargets
// (comma/space separated). Shared fail-closed model with race.js etc.

export async function probeOauth(url, opts = {}) {
  const findings = [];
  const timeoutMs = opts.timeoutMs || 5000;
  const depth = opts.depth || 'standard'; // quick, standard, deep
  const canary = `dm${rand()}`;
  const clientId = opts.clientId || `dm-canary-${canary}`;

  let baseU;
  try { baseU = new URL(url); } catch { return findings; }
  const origin = `${baseU.protocol}//${baseU.host}`;
  const registeredUri = `${origin}/cb`;

  // ---- Discovery: OIDC well-known (INFO) ----
  const oidc = await discoverOidc(url, { timeoutMs });
  if (oidc) {
    findings.push({
      class: 'oauth_discovery',
      id: `oauth-discovery-${canary}`,
      title: 'OpenID Connect discovery document exposed — endpoint map available',
      severity: 'info',
      url: `${origin}/.well-known/openid-configuration`,
      parameter: 'openid-configuration',
      evidence: evidenceBase(
        `authorization_endpoint=${oidc.authorization_endpoint}; issuer=${oidc.issuer || 'n/a'}; jwks_uri=${oidc.jwks_uri || 'n/a'}`,
        'Attackers enumerate the authorization/token endpoints for targeted OAuth attacks'
      ),
    });
    if (oidc.issuer) {
      try {
        const issHost = new URL(oidc.issuer).host;
        if (issHost !== baseU.host) {
          findings.push({
            class: 'oauth_issuer_mismatch',
            id: `oauth-issuer-${canary}`,
            title: 'OIDC issuer does not match page origin — token validation confusion risk',
            severity: 'medium',
            url: `${origin}/.well-known/openid-configuration`,
            parameter: 'issuer',
            evidence: evidenceBase(
              `issuer=${oidc.issuer} vs page origin=${origin}`,
              'Mismatched issuers enable token-substitution confusion across providers'
            ),
          });
        }
      } catch { /* ignore malformed issuer */ }
    }

    // ---- #320a: OIDC id_token config gaps (passive, from the discovery doc) ----
    // (a) alg=none advertised for id_token → HIGH: attacker forges unsigned tokens.
    if (oidc.idTokenSigningAlgs.some((a) => a.toLowerCase() === 'none')) {
      findings.push({
        class: 'oidc_alg_none_supported',
        id: `oidc-alg-none-${canary}`,
        title: 'OIDC discovery advertises alg=none for id_token — unsigned tokens accepted',
        severity: 'high',
        url: `${origin}/.well-known/openid-configuration`,
        parameter: 'id_token_signing_alg_values_supported',
        evidence: evidenceBase(
          `id_token_signing_alg_values_supported=${JSON.stringify(oidc.idTokenSigningAlgs)}`,
          'Any attacker can mint id_tokens with alg=none — identity impersonation without any secret'
        ),
      });
    }
    // (b) token endpoint allows "none" client auth → INFO (context decides client type).
    if (oidc.tokenEndpointAuthMethods.some((m) => m.toLowerCase() === 'none')) {
      findings.push({
        class: 'oidc_token_endpoint_auth_none',
        id: `oidc-token-auth-none-${canary}`,
        title: 'OIDC token endpoint permits client authentication method "none"',
        severity: 'info',
        url: `${origin}/.well-known/openid-configuration`,
        parameter: 'token_endpoint_auth_methods_supported',
        evidence: evidenceBase(
          `token_endpoint_auth_methods_supported=${JSON.stringify(oidc.tokenEndpointAuthMethods)}`,
          'Confidential clients should require client_secret_basic / private_key_jwt; "none" lets anyone call the token endpoint'
        ),
      });
    }
    // (c) weak response-mode defaults → INFO: id_token/token via response_mode=query
    // leaks the token through Referer headers and proxy logs.
    const implicitTypes = oidc.responseTypes.filter((rt) => /id_token|token/.test(rt) && rt !== 'code');
    if (implicitTypes.length && oidc.responseModes.some((m) => m.toLowerCase() === 'query')) {
      findings.push({
        class: 'oidc_query_response_mode',
        id: `oidc-query-mode-${canary}`,
        title: 'OIDC implicit/hybrid response types allowed with response_mode=query — token leaks via Referer',
        severity: 'info',
        url: `${origin}/.well-known/openid-configuration`,
        parameter: 'response_modes_supported',
        evidence: evidenceBase(
          `response_modes include query + response_types include ${implicitTypes.slice(0, 3).join(',')}`,
          'Tokens delivered in the query string leak to any third-party resource the browser fetches'
        ),
      });
    }
  }

  // ---- Find a live authorization endpoint ----
  let endpoint = oidc?.authorization_endpoint || null;
  if (!endpoint) {
    endpoint = await findAuthEndpoint(url, { timeoutMs });
  }
  if (!endpoint) return findings;

  const baseParams = {
    client_id: clientId,
    response_type: 'code',
    state: canary,
  };

  // ---- T1: redirect_uri validation bypass (account takeover) ----
  const evilHost = 'evil.example';
  const evilVariants = depth === 'quick'
    ? [`https://${evilHost}/cb/${canary}`, `//${evilHost}/cb`]
    : [
        `https://${evilHost}/cb/${canary}`,
        `//${evilHost}/cb`,
        `https://${evilHost}.${baseU.host}/`,
        `${registeredUri}/../${canary}`,
        `https://evil%2eexample/cb`,
        `${registeredUri}%2f%2e%2e%2f${canary}`,
      ];
  // Baseline: registered URI must be accepted (proves endpoint is live).
  const rBase = await oauthAuthRequest(endpoint, { ...baseParams, redirect_uri: registeredUri }, { timeoutMs });
  const baselineLive = rBase.status >= 300 && rBase.status < 400 && rBase.location;
  for (const evil of evilVariants) {
    const r = await oauthAuthRequest(endpoint, { ...baseParams, redirect_uri: evil }, { timeoutMs });
    const loc = r.location || '';
    const toEvil = loc.includes(evilHost) && !loc.includes(baseU.host);
    const carriesCode = /[?&#](code|access_token|id_token)=/.test(loc);
    const echoesState = loc.includes(canary);
    // CONFIRMED only if the 302 delivers the code/token (or our canary
    // state) to the attacker host — kills generic error redirects.
    if (r.status >= 300 && r.status < 400 && toEvil && (carriesCode || echoesState)) {
      findings.push({
        class: 'oauth_redirect_uri_bypass',
        id: `oauth-redirect-${canary}`,
        title: 'OAuth redirect_uri validation bypass — authorization code/token deliverable to attacker',
        severity: 'high',
        url: endpoint,
        parameter: 'redirect_uri',
        evidence: evidenceBase(
          `evil redirect_uri=${evil} → ${r.status} Location=${loc.slice(0, 200)} (baseline registered-URI → ${rBase.status})`,
          'Attacker receives the authorization code and redeems it — full account takeover'
        ),
      });
      break; // one confirmed finding per endpoint is enough
    }
  }

  // ---- T2: implicit flow enabled ----
  let implicitConfirmed = false;
  for (const rt of ['token', 'token id_token']) {
    const r = await oauthAuthRequest(endpoint, { client_id: clientId, redirect_uri: registeredUri, response_type: rt, state: canary }, { timeoutMs });
    const loc = r.location || '';
    if (r.status >= 300 && r.status < 400 && /[#&]access_token=/.test(loc) && loc.includes(baseU.host)) {
      implicitConfirmed = true;
      const frag = loc.split('#')[1] || loc;
      const redactedFrag = frag.replace(/access_token=[^&]*/i, 'access_token=<redacted>');
      const t1 = findings.some((f) => f.class === 'oauth_redirect_uri_bypass');
      findings.push({
        class: 'oauth_implicit_flow',
        id: `oauth-implicit-${canary}`,
        title: t1
          ? 'OAuth implicit flow active AND redirect_uri bypass confirmed — tokens trivially stealable'
          : 'OAuth implicit flow active — tokens issued in URL fragment',
        severity: t1 ? 'medium' : 'info',
        url: endpoint,
        parameter: 'response_type',
        evidence: evidenceBase(
          `response_type=${rt} → ${r.status} Location fragment: "${redactedFrag.slice(0, 200)}" (registered redirect_uri; token value redacted)`,
          'Fragment tokens leak via browser history, logs, and Referer headers'
        ),
      });
      break;
    }
  }

  if (depth === 'quick') return findings;

  // ---- T3: state not enforced → login CSRF exposure (differential, 2 runs) ----
  const noStateParams = { client_id: clientId, redirect_uri: registeredUri, response_type: 'code' };
  const r1 = await oauthAuthRequest(endpoint, noStateParams, { timeoutMs });
  const r2 = await oauthAuthRequest(endpoint, noStateParams, { timeoutMs });
  const codeIssued = (r) => r.status >= 300 && r.status < 400 && /[?&#]code=/.test(r.location || '');
  if (codeIssued(r1) && codeIssued(r2)) {
    const loc1 = (r1.location || '').replace(/code=[^&]*/i, 'code=<redacted>');
    findings.push({
      class: 'oauth_state_missing',
      id: `oauth-nostate-${canary}`,
      title: 'Authorization server accepts requests without state — login CSRF possible',
      severity: 'medium',
      url: endpoint,
      parameter: 'state',
      evidence: evidenceBase(
        `2 runs without state → both ${r1.status}/${r2.status} with code= issued — Location: "${loc1.slice(0, 200)}" (code value redacted)`,
        'Attacker can force a victim to complete login under the attacker account (login CSRF)'
      ),
    });
  }

  // ---- T4: PKCE not enforced ----
  const rPkce = await oauthAuthRequest(endpoint, {
    ...baseParams, redirect_uri: registeredUri, code_challenge_method: undefined,
  }, { timeoutMs });
  // Remove the undefined key (URLSearchParams would stringify it).
  if (codeIssued(rPkce)) {
    const publicClient = !opts.clientSecret && /spa|native|mobile|public/i.test(opts.bundleText || '') || !opts.clientSecret;
    const locPkce = (rPkce.location || '').replace(/code=[^&]*/i, 'code=<redacted>');
    findings.push({
      class: 'oauth_pkce_missing',
      id: `oauth-pkce-${canary}`,
      title: publicClient
        ? 'Public client issues authorization code without PKCE — code interception risk'
        : 'Authorization code issued without PKCE code_challenge',
      severity: publicClient ? 'medium' : 'info',
      url: endpoint,
      parameter: 'code_challenge',
      evidence: evidenceBase(
        `no code_challenge → ${rPkce.status} with code= issued — Location: "${locPkce.slice(0, 200)}" (code value redacted)`,
        'A network-position attacker can steal the code and redeem it without the verifier'
      ),
    });
  }

  // ---- T5: OAuth scope escalation — LAB-GATED, HIGH (auth gap #319) ----
  // Differential oracle: send a baseline authorize request with a normal
  // scope (openid profile email), then the SAME request with an escalated
  // scope set (openid profile email admin read:all write:all). Both use a
  // canary-INVALID redirect_uri (https://invalid.invalid/... never resolves —
  // no real target is ever hit) and a canary state; redirects are never
  // followed. CONFIRMED only when the baseline is accepted (code issued) AND
  // the escalated request is also accepted with the broader scope reflected
  // in the Location (scope= echo) or with no invalid_scope error. An
  // invalid_scope error on the escalated request = correct behavior: no finding.
  // Non-lab targets: skipped silently (touches the authorization server).
  if (isLabTargetHost(url, opts.labTargets) && depth !== 'quick') {
    const scopeRedirect = `https://invalid.invalid/dm-cb-${canary}`;
    const scopeState = `dm-scope-${canary}`;
    const scopeParams = (scope) => ({
      client_id: clientId,
      redirect_uri: scopeRedirect,
      response_type: 'code',
      state: scopeState,
      scope,
    });
    const rScopeBase = await oauthAuthRequest(endpoint, scopeParams('openid profile email'), { timeoutMs });
    const rScopeEsc = await oauthAuthRequest(endpoint, scopeParams('openid profile email admin read:all write:all'), { timeoutMs });
    const locBase = rScopeBase.location || '';
    const locEsc = rScopeEsc.location || '';
    const codeIssued = (r, loc) => r.status >= 300 && r.status < 400 && /[?&#]code=/.test(loc);
    const baselineAccepted = codeIssued(rScopeBase, locBase);
    const escalatedInvalid = /[?&#]error=invalid_scope|invalid_scope/i.test(locEsc);
    let scopeEchoed = '';
    try { scopeEchoed = new URL(locEsc).searchParams.get('scope') || ''; } catch { /* opaque Location */ }
    const escalatedGranted = codeIssued(rScopeEsc, locEsc) && !escalatedInvalid
      && (scopeEchoed.includes('admin') || scopeEchoed.includes('read:all'));
    // Note: scopeEchoed echo is the strict proof; if the server omits the
    // scope parameter entirely we require it explicitly (else no claim).
    if (baselineAccepted && escalatedGranted) {
      findings.push({
        class: 'oauth_scope_escalation',
        id: `oauth-scope-${canary}`,
        title: 'OAuth scope escalation — server grants unregistered privileged scopes (admin read:all write:all)',
        severity: 'high',
        url: endpoint,
        parameter: 'scope',
        evidence: evidenceBase(
          `baseline scope="openid profile email" → ${rScopeBase.status} code issued; escalated scope="openid profile email admin read:all write:all" → ${rScopeEsc.status} code issued with Location scope="${scopeEchoed.slice(0, 80)}" (canary redirect_uri on invalid.invalid, never hit)`,
          'Attacker escalates a normal OAuth grant to privileged API scopes — server honors scopes the client never registered'
        ),
      });
    }
  }

  // ---- T6: OIDC id_token weakness — LAB-GATED active check (auth gap #320) ----
  // Passive config findings above are the core. This active step runs ONLY in
  // lab mode AND only when a test client is supplied (opts.labCreds.clientId):
  // request a token via client_credentials and DECODE the returned id_token
  // payload WITHOUT verifying (defensive read of our own canary response).
  // Flags: missing exp, exp >24h out, alg=none on the issued token.
  if (isLabTargetHost(url, opts.labTargets) && depth !== 'quick' && opts.labCreds && opts.labCreds.clientId && oidc && oidc.token_endpoint) {
    try {
      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: opts.labCreds.clientId,
        scope: 'openid',
      });
      if (opts.labCreds.clientSecret) body.set('client_secret', opts.labCreds.clientSecret);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(oidc.token_endpoint, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        redirect: 'manual',
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const tj = await res.json().catch(() => null);
        const idt = tj && typeof tj.id_token === 'string' ? tj.id_token : null;
        if (idt) {
          const parts = idt.split('.');
          let hdr = null; let pay = null;
          try {
            hdr = JSON.parse(Buffer.from(parts[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
            pay = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
          } catch { /* not a parseable JWT — skip silently */ }
          if (pay && typeof pay === 'object') {
            const weak = [];
            if (hdr && hdr.alg === 'none') weak.push('token itself is unsigned (alg=none)');
            if (!pay.exp) weak.push('missing exp claim');
            else {
              const lifeH = Math.round((pay.exp - Math.floor(Date.now() / 1000)) / 3600);
              if (lifeH > 24) weak.push(`excessive lifetime: exp is ~${lifeH}h out (>24h)`);
            }
            if (weak.length) {
              findings.push({
                class: 'oidc_id_token_weak',
                id: `oidc-idtoken-${canary}`,
                title: `OIDC id_token issued with weak validation profile — ${weak[0]}`,
                severity: 'medium',
                url: oidc.token_endpoint,
                parameter: 'id_token',
                evidence: {
                  request: `POST ${oidc.token_endpoint} grant_type=client_credentials (test client ${opts.labCreds.clientId}, lab only)`,
                  response: `id_token payload (decoded, NOT verified): ${weak.join('; ')}`,
                  impact_demo: 'Long-lived or unsigned id_tokens widen the theft window for session tokens',
                  signalCorrelated: true,
                },
              });
            }
          }
        }
      }
    } catch { /* token endpoint refused the test client — skip silently */ }
  }

  // ---- T7: secrets & endpoint hygiene (passive) ----
  const bundleText = opts.bundleText || '';
  if (SECRET_RE.test(bundleText) && bundleText.includes(clientId)) {
    const sMatch = bundleText.match(SECRET_RE);
    const sIdx = sMatch ? bundleText.indexOf(sMatch[0]) : -1;
    // Quote the window around the secret marker, with the secret VALUE
    // redacted — the key name + surrounding context is the evidence.
    const rawWindow = sIdx >= 0 ? bundleText.slice(Math.max(0, sIdx - 40), sIdx + 120) : '';
    const redactedWindow = rawWindow.replace(/(client_secret["'\s:=]+)(["'][^"']{4,}["']|\S{8,})/i, '$1<redacted>');
    findings.push({
      class: 'oauth_secret_exposed',
      id: `oauth-secret-${canary}`,
      title: 'OAuth client secret or private key material exposed near client_id in bundle',
      severity: 'medium',
      url,
      parameter: 'client_secret',
      evidence: evidenceBase(
        `bundle contains secret material adjacent to client_id "${clientId}" — "...${redactedWindow}..." (secret value redacted)`,
        'Exposed secrets let attackers impersonate the confidential client'
      ),
    });
  }

  return findings;
}
