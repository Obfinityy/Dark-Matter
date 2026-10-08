/**
 * monitoringPlatformRecon.js — Monitoring & automation-platform fingerprinting engine.
 *
 * Detects and fingerprints exposed monitoring, log-management, BI, notebook and
 * workflow-automation UIs from HTTP responses — page structures, login flows,
 * version-disclosure endpoints and REST API shapes:
 *
 *   idea 00481 — Nagios/Icinga UI fingerprinting (page structures)
 *   idea 00482 — Splunk web detection (login flow)
 *   idea 00483 — Kibana spaces enumeration (team/project name exposure)
 *   idea 00484 — Jupyter notebook server detection (token-auth pages)
 *   idea 00485 — RStudio server detection (login signatures)
 *   idea 00486 — Airflow UI fingerprinting (REST API version endpoints)
 *
 * Defensive recon only: functions analyse HTTP response data that is handed to
 * them (or API payloads captured during an authorized hunt). They never make
 * network requests, never submit credentials and never produce exploit code.
 */

/** Shared signature table for the six platforms. */
const PLATFORM_SIGNATURES = [
  {
    service: 'Nagios',
    ui: /<title>\s*Nagios\s*(Core|XI)?\s*<\/title>|nagios\s*(core|xi)?\s*-\s*|\/nagios\/cgi-bin\//i,
    headers: null,
    versionEndpoints: ['/nagios/cgi-bin/statusjson.cgi'],
    versionPattern: /Nagios\s*(?:Core\s*)?(\d+\.\d+\.\d+[\w.-]*)/i,
    loginFlow: null,
  },
  {
    service: 'Icinga',
    ui: /<title>\s*Icinga\s*Web\s*2?\s*<\/title>|icingaweb2|Icinga\s*Web/i,
    headers: /x-icinga/i,
    versionEndpoints: ['/icingaweb2/authentication/login', '/icingaweb2/monitoring'],
    versionPattern: /Icinga\s*Web\s*2\s*v?(\d+\.\d+\.\d+[\w.-]*)/i,
    loginFlow: /\/icingaweb2\/authentication\/login/i,
  },
  {
    service: 'Splunk',
    ui: /<title>\s*Splunk\s*<\/title>|splunkweb|splunkd/i,
    headers: /splunkweb_csrf_token/i,
    versionEndpoints: ['/en-US/account/login', '/services/server/info'],
    versionPattern: /"version"\s*:\s*"(\d+\.\d+\.\d+[^"]*)"/i,
    loginFlow: /\/en-US\/account\/login/i,
  },
  {
    service: 'Kibana',
    ui: /"kbn-version"|kbn-name|\/bundles\/kibana|\bElastic\b/i,
    headers: /kbn-version|kbn-name/i,
    versionEndpoints: ['/app/home', '/api/spaces/space', '/api/status'],
    versionPattern:
      /"version"\s*:\s*{\s*"number"\s*:\s*"(\d+\.\d+\.\d+[^"]*)"|"kbn-version"\s*:\s*"(\d+\.\d+\.\d+[^"]*)"/i,
    loginFlow: /\/login|\/spaces\/enter/i,
  },
  {
    service: 'Jupyter',
    ui: /Jupyter\s*(Notebook|Hub|Lab)|jupyter\.org/i,
    headers: /x-jupyterhub-version|jupyter/i,
    versionEndpoints: ['/tree', '/login', '/hub/login'],
    versionPattern:
      /"version"\s*:\s*"(\d+\.\d+\.\d+[^"]*)"|x-jupyterhub-version:\s*(\d+\.\d+\.\d+)/i,
    loginFlow: /\/(login|hub\/login)/i,
  },
  {
    service: 'RStudio',
    ui: /<title>\s*RStudio\s*<\/title>|RStudio\s*Server|rstudio/i,
    headers: /user-id/i,
    versionEndpoints: ['/auth-sign-in'],
    versionPattern: null,
    loginFlow: /\/auth-sign-in/i,
  },
  {
    service: 'Apache Airflow',
    ui: /<title>\s*Airflow\s*<\/title>|\/static\/airflow\/|Airflow/i,
    headers: null,
    versionEndpoints: ['/api/v1/version', '/health', '/api/v1/pools'],
    versionPattern: /"version"\s*:\s*"(\d+\.\d+\.\d+[^"]*)"/i,
    loginFlow: /\/login\/?$|auth\/backend/i,
  },
];

/**
 * Extract a version disclosed by the platform (body text or headers).
 * @param {object} sig — platform signature entry
 * @param {string} body
 * @param {object} headers
 * @returns {string|null}
 */
export function extractPlatformVersion(sig, body, headers = {}) {
  const text = String(body || '');
  const headerText = `${Object.keys(headers || {}).join(' ')} ${Object.values(headers || {}).join(' ')}`;
  const pattern = sig.versionPattern;
  if (!pattern) return null;
  const m = pattern.exec(text) || pattern.exec(headerText);
  if (!m) return null;
  return m[1] || m[2] || null;
}

/**
 * Analyse the authentication posture of a login page from its response.
 * Detects token-auth forms, password forms, unauthenticated redirects and
 * session-cookie issuance — read-only analysis of response data.
 * @param {{url, status, headers, body}} input — one HTTP response
 * @returns {object} login-flow analysis
 */
export function analyzeLoginFlow({ url = '', status = 0, headers = {}, body = '' }) {
  const text = String(body || '');
  const setCookie = String(headers['set-cookie'] || headers['Set-Cookie'] || '');
  const location = String(headers.location || headers.Location || '');
  const lowered = url.toLowerCase();

  const hasPasswordField = /type\s*=\s*["']password["']/i.test(text);
  const hasTokenField =
    /name\s*=\s*["'](?:token|auth[_-]?token|api[_-]?token)["']/i.test(text) ||
    /token\s+or\s+password|paste\s+your\s+token/i.test(text);
  const hasUsernameField = /name\s*=\s*["'](?:username|user|login|email)["']/i.test(text);
  const redirectToLogin =
    status >= 300 && status < 400 && /login|auth-sign-in|account\/login/i.test(location);
  const issuesSessionCookie = /session|splunkweb_csrf|user-id|icingaweb2|_xsrf/i.test(setCookie);

  const flow = [];
  if (hasTokenField) flow.push('token-auth');
  if (hasPasswordField) flow.push('password');
  if (hasUsernameField && hasPasswordField) flow.push('username+password');
  if (redirectToLogin) flow.push('redirect-to-login');
  if (issuesSessionCookie) flow.push('session-cookie-issued');

  let exposure = 'info';
  if (hasTokenField) exposure = 'low'; // token pages are standard but confirm the server is reachable
  if (status === 200 && (hasPasswordField || hasUsernameField)) exposure = 'info';

  return {
    url,
    flow: flow.length ? flow : ['unknown'],
    hasPasswordField,
    hasTokenField,
    redirectToLogin,
    issuesSessionCookie,
    exposure,
    evidence: flow.length
      ? `Login surface detected on ${url}: ${flow.join(', ')}.`
      : `No recognisable login markers on ${url}.`,
  };
}

/**
 * Fingerprint one HTTP response against the monitoring-platform signature table.
 * @param {{url, status, headers, body}} input — one HTTP response
 * @returns {object} structured finding
 */
export function detectMonitoringPlatform({ url = '', status = 0, headers = {}, body = '' }) {
  const text = String(body || '');
  const headerNames = Object.keys(headers || {}).join(' ');
  const headerValues = Object.values(headers || {}).join(' ');

  for (const sig of PLATFORM_SIGNATURES) {
    let confidence = 'low';
    const evidence = [];

    if (sig.ui && sig.ui.test(text)) {
      confidence = 'medium';
      evidence.push(`Page content matches the ${sig.service} UI fingerprint.`);
    }
    if (sig.headers && (sig.headers.test(headerNames) || sig.headers.test(headerValues))) {
      confidence = confidence === 'medium' ? 'high' : 'medium';
      evidence.push(`Response headers reference ${sig.service}.`);
    }

    let matchedEndpoint = null;
    for (const ep of sig.versionEndpoints) {
      if (url.toLowerCase().includes(ep.toLowerCase())) {
        matchedEndpoint = ep;
        break;
      }
    }
    if (matchedEndpoint && status === 200) {
      if (confidence === 'low') confidence = 'medium';
      evidence.push(`Known ${sig.service} endpoint ${matchedEndpoint} responded with HTTP 200.`);
    }

    // Known login-flow URL reached without authentication markers.
    if (sig.loginFlow && sig.loginFlow.test(url)) {
      if (confidence === 'low') confidence = 'medium';
      evidence.push(`Reached the ${sig.service} login flow at ${url}.`);
    }

    if (confidence === 'low') continue;

    const version = extractPlatformVersion(sig, text, headers);
    if (version) {
      confidence = 'high';
      evidence.push(`Disclosed version: ${version}.`);
    }

    return {
      detected: true,
      service: sig.service,
      endpoint: matchedEndpoint,
      version,
      confidence,
      severity: version ? 'Medium' : 'Low',
      cwe: 'CWE-200',
      evidence: evidence.join(' '),
    };
  }

  return {
    detected: false,
    service: 'monitoring platform',
    reason: 'No known monitoring-platform fingerprint matched.',
  };
}

/**
 * Check an Airflow instance for REST API version disclosure.
 * /api/v1/version returning the exact Airflow version is an information
 * disclosure finding — the check only reads the response, never calls
 * mutating API operations.
 * @param {{url, status, body}} input — the /api/v1/version response
 * @returns {object} structured finding
 */
export function checkAirflowVersionExposure({ url = '', status = 0, body = '' }) {
  const sig = PLATFORM_SIGNATURES.find(s => s.service === 'Apache Airflow');
  const text = String(body || '');
  const version = extractPlatformVersion(sig, text);

  const isVersionEndpoint = /\/api\/v1\/version\/?(\?|$)/i.test(url);
  if (isVersionEndpoint && status === 200 && version) {
    return {
      detected: true,
      service: 'Apache Airflow',
      endpoint: '/api/v1/version',
      version,
      confidence: 'high',
      severity: 'Medium',
      cwe: 'CWE-200',
      evidence: `The Airflow REST API version endpoint disclosed version ${version} without authentication indicators.`,
    };
  }

  if (isVersionEndpoint) {
    return {
      detected: false,
      service: 'Apache Airflow',
      reason: `Version endpoint ${url} did not disclose a version (HTTP ${status}).`,
    };
  }

  const platform = detectMonitoringPlatform({ url, status, body });
  return platform.detected
    ? { ...platform, endpoint: null }
    : { detected: false, service: 'Apache Airflow', reason: 'No Airflow fingerprint matched.' };
}

/**
 * Parse a Kibana spaces API payload into a structured inventory.
 * Spaces reveal team and project names; the inventory helps the owner audit
 * which internal names are exposed — the function only parses data that was
 * already returned by an authorized request.
 * @param {string|object} payload — JSON of the /api/spaces/space response
 * @returns {object} space inventory
 */
export function parseKibanaSpaces(payload) {
  let data = payload;
  if (typeof payload === 'string') {
    try {
      data = JSON.parse(payload);
    } catch {
      return { detected: false, spaces: [], reason: 'Payload is not valid JSON.' };
    }
  }
  const list = Array.isArray(data) ? data : data && Array.isArray(data.spaces) ? data.spaces : [];
  if (!list.length) {
    return { detected: false, spaces: [], reason: 'No spaces found in payload.' };
  }

  const spaces = list.map(s => ({
    id: String(s.id || ''),
    name: String(s.name || ''),
    description: String(s.description || ''),
    color: String(s.color || ''),
    disabledFeatures: Array.isArray(s.disabledFeatures) ? s.disabledFeatures.map(String) : [],
  }));

  const revealing = spaces.filter(
    s => s.name && !['default', 'default space'].includes(s.name.toLowerCase())
  );

  return {
    detected: true,
    service: 'Kibana',
    spaces,
    spaceCount: spaces.length,
    revealingNames: revealing.map(s => s.name),
    severity: revealing.length ? 'Low' : 'Info',
    cwe: 'CWE-200',
    evidence: revealing.length
      ? `${revealing.length} non-default space name(s) disclosed: ${revealing.map(s => s.name).join(', ')}.`
      : `${spaces.length} space(s) found; only the default space is exposed.`,
  };
}

/**
 * Check a Jupyter server response for token-auth vs password-auth pages and
 * version disclosure — read-only analysis of the response data.
 * @param {{url, status, headers, body}} input — one Jupyter response
 * @returns {object} structured finding
 */
export function checkJupyterServer({ url = '', status = 0, headers = {}, body = '' }) {
  const text = String(body || '');
  const hubVersion = String(
    headers['x-jupyterhub-version'] || headers['X-JupyterHub-Version'] || ''
  );
  const flow = analyzeLoginFlow({ url, status, headers, body });

  const isJupyter =
    /jupyter/i.test(text) || /jupyter/i.test(Object.keys(headers || {}).join(' ')) || hubVersion;

  if (!isJupyter) {
    return { detected: false, service: 'Jupyter', reason: 'No Jupyter fingerprint matched.' };
  }

  const evidence = ['Response identifies a Jupyter server.'];
  if (flow.hasTokenField) evidence.push('The auth page uses token authentication.');
  if (hubVersion) evidence.push(`JupyterHub version disclosed via header: ${hubVersion}.`);
  if (/\/hub\//i.test(url)) evidence.push('URL belongs to a JupyterHub deployment (multi-user).');

  const sig = PLATFORM_SIGNATURES.find(s => s.service === 'Jupyter');
  const version = extractPlatformVersion(sig, text, headers) || hubVersion || null;

  return {
    detected: true,
    service: 'Jupyter',
    version,
    authFlow: flow.flow,
    confidence: hubVersion || version ? 'high' : 'medium',
    severity: version ? 'Medium' : 'Low',
    cwe: 'CWE-200',
    evidence: evidence.join(' '),
  };
}

export const MONITORING_PLATFORM_RECON = {
  detectMonitoringPlatform,
  extractPlatformVersion,
  analyzeLoginFlow,
  checkAirflowVersionExposure,
  parseKibanaSpaces,
  checkJupyterServer,
  PLATFORM_SIGNATURES,
};
export default MONITORING_PLATFORM_RECON;
