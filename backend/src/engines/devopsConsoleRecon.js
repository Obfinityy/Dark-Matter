/**
 * devopsConsoleRecon.js — DevOps console fingerprinting engine.
 *
 * Detects and fingerprints exposed DevOps management consoles from HTTP
 * responses, using title markers, version endpoints, and response shapes:
 *
 *   idea 00464 — Portainer instance detection
 *   idea 00465 — Jenkins script-console exposure check
 *   idea 00466 — GitLab runner registration endpoint probing
 *   idea 00467 — SonarQube instance fingerprinting
 *   idea 00468 — Nexus repository detection
 *   idea 00469 — Artifactory instance identification
 *   idea 00470 — Harbor registry detection
 *
 * Defensive recon only: endpoints are probed for existence and version
 * disclosure. No credentials are attempted, no brute-forcing, and no
 * exploit payloads are ever produced by this module.
 */

/** Shared signature table for the seven consoles. */
const CONSOLE_SIGNATURES = [
  {
    service: 'Portainer',
    ui: /<title>\s*Portainer\s*<\/title>|portainer\.io/i,
    headers: /x-portainer/i,
    versionEndpoints: ['/api/status', '/api/system/status'],
    versionPattern: /"Version"\s*:\s*"(\d+\.\d+\.\d+[^"]*)"/i,
  },
  {
    service: 'Jenkins',
    ui: /<title>.*Jenkins.*<\/title>|Jenkins\s*\[Jenkins\]/i,
    headers: /x-(jenkins|hudson)/i,
    versionEndpoints: ['/api/json', '/login'],
    versionPattern: null, // Jenkins discloses version via X-Jenkins response header
  },
  {
    service: 'GitLab Runner',
    ui: /gitlab/i,
    headers: /x-gitlab/i,
    versionEndpoints: ['/api/v4/version', '/-/health'],
    versionPattern: /"version"\s*:\s*"(\d+\.\d+[^"]*)"/i,
  },
  {
    service: 'SonarQube',
    ui: /<title>\s*SonarQube\s*<\/title>|sonarqube/i,
    headers: /x-sonar/i,
    versionEndpoints: ['/api/server/version', '/api/system/status'],
    versionPattern: null, // /api/server/version returns the version as plain text
  },
  {
    service: 'Nexus Repository',
    ui: /Nexus Repository Manager/i,
    headers: /nexus/i,
    versionEndpoints: ['/service/rest/v1/status', '/service/rest/v1/status/check'],
    versionPattern: /"version"\s*:\s*"(\d+\.\d+\.\d+[^"]*)"/i,
  },
  {
    service: 'JFrog Artifactory',
    ui: /artifactory|jfrog/i,
    headers: /x-artifactory/i,
    versionEndpoints: ['/artifactory/api/system/version', '/artifactory/api/system/ping'],
    versionPattern: /"version"\s*:\s*"(\d+\.\d+\.\d+[^"]*)"/i,
  },
  {
    service: 'Harbor',
    ui: /<title>\s*Harbor\s*<\/title>|harbor\s*-\s*an\s*open\s*source/i,
    headers: /harbor/i,
    versionEndpoints: ['/api/v2.0/systeminfo', '/api/v2.0/health'],
    versionPattern: /"harbor_version"\s*:\s*"v?([\d.]+)"/i,
  },
];

/**
 * Extract a version from a response using the console's version pattern,
 * including the plain-text /api/server/version form used by SonarQube.
 * @param {object} sig — console signature entry
 * @param {string} body
 * @returns {string|null}
 */
export function extractConsoleVersion(sig, body) {
  const text = String(body || '').trim();
  if (!text) return null;

  // SonarQube /api/server/version answers with the bare version string.
  if (sig.service === 'SonarQube' && /^\d+\.\d+\.\d+[\w.-]*$/.test(text)) {
    return text;
  }
  if (sig.versionPattern) {
    const m = sig.versionPattern.exec(text);
    if (m) return m[1];
  }
  return null;
}

/**
 * Fingerprint one HTTP response against the DevOps console signature table.
 * @param {{url, status, headers, body}} input — one HTTP response
 * @returns {object} structured finding
 */
export function detectDevopsConsole({ url = '', status = 0, headers = {}, body = '' }) {
  const text = String(body || '');
  const headerNames = Object.keys(headers || {}).join(' ');
  const headerValues = Object.values(headers || {}).join(' ');

  for (const sig of CONSOLE_SIGNATURES) {
    let confidence = 'low';
    const evidence = [];

    if (sig.ui.test(text)) {
      confidence = 'medium';
      evidence.push(`Page content matches the ${sig.service} UI fingerprint.`);
    }
    if (sig.headers.test(headerNames) || sig.headers.test(headerValues)) {
      confidence = confidence === 'medium' ? 'high' : 'medium';
      evidence.push(`Response headers reference ${sig.service}.`);
    }

    let matchedEndpoint = null;
    for (const ep of sig.versionEndpoints) {
      if (url.includes(ep)) {
        matchedEndpoint = ep;
        break;
      }
    }

    // A 200 on a known version endpoint is strong evidence even without UI markers.
    if (matchedEndpoint && status === 200) {
      if (confidence === 'low') confidence = 'medium';
      evidence.push(`Version/status endpoint ${matchedEndpoint} responded with HTTP 200.`);
    }

    if (confidence === 'low') continue;

    const version = extractConsoleVersion(sig, text);
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
    service: 'DevOps console',
    reason: 'No known DevOps console fingerprint matched.',
  };
}

/**
 * Check a Jenkins instance for an exposed (unauthenticated) script console.
 * A reachable /script or /scriptText endpoint returning the console UI is a
 * high-severity finding: it implies code execution capability for the owner
 * to lock down. This check only reads the response — it never submits code.
 * @param {{url, status, headers, body}} input — the /script response
 * @returns {object} structured finding
 */
export function checkJenkinsScriptConsole({ url = '', status = 0, headers = {}, body = '' }) {
  const text = String(body || '');
  const headerNames = Object.keys(headers || {}).join(' ');

  const isScriptEndpoint = /\/(script|scriptText)(\?|$)/.test(url);
  const hasConsoleUi = /Script Console/i.test(text) && /groovy/i.test(text.toLowerCase());
  const isJenkins = /x-(jenkins|hudson)/i.test(headerNames) || /jenkins/i.test(headerNames);

  if (isScriptEndpoint && status === 200 && (hasConsoleUi || isJenkins)) {
    return {
      detected: true,
      service: 'Jenkins',
      endpoint: 'script console',
      confidence: hasConsoleUi ? 'high' : 'medium',
      severity: 'High',
      cwe: 'CWE-552',
      evidence:
        'The Jenkins script console endpoint is reachable and renders the console UI without authentication indicators.',
    };
  }

  if (/jenkins/i.test(text) || isJenkins) {
    return {
      detected: true,
      service: 'Jenkins',
      confidence: 'medium',
      severity: 'Low',
      cwe: 'CWE-200',
      evidence:
        'Response identifies a Jenkins instance, but no exposed script console was confirmed.',
    };
  }

  return {
    detected: false,
    service: 'Jenkins',
    reason: 'No Jenkins script console or Jenkins fingerprint matched.',
  };
}

/**
 * Probe GitLab runner registration endpoint state from an HTTP response.
 * Distinguishes: version disclosure (/api/v4/version), registration endpoint
 * reachable, and properly-gated responses — without attempting registration.
 * @param {{url, status, headers, body}} input — one GitLab API response
 * @returns {object} structured finding
 */
export function checkGitLabRunner({ url = '', status = 0, headers = {}, body = '' }) {
  const text = String(body || '');
  const headerNames = Object.keys(headers || {}).join(' ');
  const evidence = [];
  let confidence = 'low';
  let version = null;

  const isGitLab = /gitlab/i.test(text) || /x-gitlab/i.test(headerNames);
  if (isGitLab) {
    confidence = 'medium';
    evidence.push('Response identifies a GitLab instance.');
  }

  // /api/v4/version discloses the exact GitLab version on some setups.
  if (url.includes('/api/v4/version') && status === 200) {
    version = extractConsoleVersion(
      CONSOLE_SIGNATURES.find(s => s.service === 'GitLab Runner'),
      text
    );
    if (version) {
      confidence = 'high';
      evidence.push(`GitLab version endpoint disclosed version ${version}.`);
    }
  }

  // Runner registration endpoint reached and responding.
  const isRegistrationEndpoint = /\/(api\/v\d+\/runners|admin\/runners)/i.test(url);
  if (isRegistrationEndpoint) {
    if (status === 401 || status === 403) {
      evidence.push(
        `Runner registration endpoint ${url} exists but requires authentication (HTTP ${status}).`
      );
    } else if (status === 200) {
      confidence = 'high';
      evidence.push(
        `Runner registration endpoint ${url} responded with HTTP 200 — review its access control.`
      );
    }
  }

  if (!isGitLab && confidence === 'low') {
    return {
      detected: false,
      service: 'GitLab Runner',
      reason: 'No GitLab runner endpoint fingerprint matched.',
    };
  }

  return {
    detected: true,
    service: 'GitLab Runner',
    endpoint: isRegistrationEndpoint ? url : null,
    version,
    confidence,
    severity: status === 200 && isRegistrationEndpoint ? 'Medium' : version ? 'Low' : 'Info',
    cwe: 'CWE-200',
    evidence: evidence.join(' '),
  };
}

export const DEVOPS_CONSOLE_RECON = {
  detectDevopsConsole,
  checkJenkinsScriptConsole,
  checkGitLabRunner,
  extractConsoleVersion,
  CONSOLE_SIGNATURES,
};
export default DEVOPS_CONSOLE_RECON;
