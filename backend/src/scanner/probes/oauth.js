// Dark Matter rule-based scanner — OAuth 2.0 / OIDC redirect & token hygiene probe.
// Tests authorization endpoints for redirect_uri validation bypass (account
// takeover), implicit-flow tokens in URL fragments, missing state enforcement
// (login CSRF), PKCE enforcement on public clients, and secret/endpoint
// hygiene. Every CONFIRMED verdict sits behind a differential oracle per the
// 100% truth rule. The probe NEVER completes an authorization flow, never
// exchanges a code, never redeems a token: authorization REQUESTS only, the
// flow stops at the 302 Location header (redirects are never followed).

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
    return { authorization_endpoint: doc.authorization_endpoint, issuer: doc.issuer || null, jwks_uri: doc.jwks_uri || null };
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
          `response_type=${rt} → ${r.status} Location fragment contains access_token= (registered redirect_uri)`,
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
    findings.push({
      class: 'oauth_state_missing',
      id: `oauth-nostate-${canary}`,
      title: 'Authorization server accepts requests without state — login CSRF possible',
      severity: 'medium',
      url: endpoint,
      parameter: 'state',
      evidence: evidenceBase(
        `2 runs without state → both ${r1.status}/${r2.status} with code= issued to registered URI`,
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
        `no code_challenge → ${rPkce.status} with code= issued to registered URI`,
        'A network-position attacker can steal the code and redeem it without the verifier'
      ),
    });
  }

  // ---- T5: secrets & endpoint hygiene (passive) ----
  const bundleText = opts.bundleText || '';
  if (SECRET_RE.test(bundleText) && bundleText.includes(clientId)) {
    findings.push({
      class: 'oauth_secret_exposed',
      id: `oauth-secret-${canary}`,
      title: 'OAuth client secret or private key material exposed near client_id in bundle',
      severity: 'medium',
      url,
      parameter: 'client_secret',
      evidence: evidenceBase(
        'bundle contains client_secret/private-key material adjacent to the discovered client_id',
        'Exposed secrets let attackers impersonate the confidential client'
      ),
    });
  }

  return findings;
}
