/**
 * phpFrameworkRecon.js — PHP framework exposure detectors.
 *
 * Detects publicly accessible PHP framework debug and introspection
 * endpoints that disclose internals and server configuration:
 *   - Laravel Telescope dashboard
 *   - Symfony web profiler
 *   - phpinfo() pages
 *
 * All checks are passive: they fingerprint an endpoint from its HTTP
 * response (status, headers, body) and report exposure without attempting
 * any authenticated or privileged action.
 */

export const TELESCOPE_PATHS = [
  '/telescope',
  '/telescope/requests',
  '/telescope/queries',
  '/telescope/jobs',
  '/telescope/mail',
];

export const TELESCOPE_SIGNATURES = [
  /Laravel Telescope/i,
  /telescope\.js/i,
  /"telescope"|window\.Telescope/i,
  /meta name="telescope"/i,
];

export const SYMFONY_PROFILER_PATHS = ['/_profiler', '/_profiler/search', '/_wdt'];

export const SYMFONY_SIGNATURES = [
  /Symfony Profiler/i,
  /Symfony Web Debug Toolbar/i,
  /sf-toolbar/i,
  /X-Debug-Token/i,
  /_wdt\/[a-f0-9]{13}/i,
];

export const PHPINFO_SIGNATURES = [
  /phpinfo\(\)/i,
  /<h1[^>]*>PHP Version/i,
  /PHP Credits/i,
  /Configuration<\/h1>\s*<h2[^>]*>PHP Core/i,
  /This program makes use of the Zend/i,
  /php\.net\/manual/i,
];

export const PHPINFO_VERSION_PATTERNS = [
  /PHP Version\s+([\d.]+[a-zA-Z0-9-]*)/i,
  /php-([\d.]+[a-zA-Z0-9-]*)\.tar/i,
];

/**
 * Analyse a candidate Telescope endpoint response.
 * @param {{url, status, headers, body}} input HTTP response of a suspected Telescope path
 * @returns {{detected, service, version, confidence, severity, evidence, cwe, endpoints}}
 */
export function detectLaravelTelescope({ url = '', status = 0, headers = {}, body = '' }) {
  const text = String(body || '');
  const matched = TELESCOPE_SIGNATURES.filter(re => re.test(text));
  const detected = status === 200 && matched.length > 0;
  if (!detected) {
    return {
      detected: false,
      service: 'Laravel Telescope',
      reason: 'No Telescope dashboard signature in response',
    };
  }
  return {
    detected: true,
    service: 'Laravel Telescope',
    version: null,
    confidence: matched.length >= 2 ? 'high' : 'medium',
    severity: 'High',
    cwe: 'CWE-200',
    evidence: `Exposed Telescope dashboard at ${url} (${matched.length} signature(s) matched).`,
    endpoints: TELESCOPE_PATHS,
  };
}

/**
 * Analyse a candidate Symfony profiler endpoint response.
 * @param {{url, status, headers, body}} input HTTP response of a suspected profiler path
 * @returns {{detected, service, version, confidence, severity, evidence, cwe, endpoints}}
 */
export function detectSymfonyProfiler({ url = '', status = 0, headers = {}, body = '' }) {
  const text = String(body || '');
  const headerText = JSON.stringify(headers || '');
  const matched = SYMFONY_SIGNATURES.filter(re => re.test(text) || re.test(headerText));
  const debugToken = /(?:X-Debug-Token:\s*|"?x-debug-token"?\s*"?\s*:\s*"?)([a-f0-9]{13})/i.exec(
    headerText
  );
  const detected = (status === 200 && matched.length > 0) || Boolean(debugToken);
  if (!detected) {
    return {
      detected: false,
      service: 'Symfony Profiler',
      reason: 'No Symfony profiler signature in response',
    };
  }
  const wdt = /_wdt\/([a-f0-9]{13})/i.exec(text);
  return {
    detected: true,
    service: 'Symfony Profiler',
    version: null,
    confidence: matched.length >= 2 || debugToken ? 'high' : 'medium',
    severity: 'High',
    cwe: 'CWE-200',
    evidence: `Exposed Symfony profiler at ${url}. Request introspection data may be retrievable.`,
    profileToken: (debugToken && debugToken[1]) || (wdt && wdt[1]) || null,
    endpoints: SYMFONY_PROFILER_PATHS,
  };
}

/**
 * Analyse a page suspected of being a phpinfo() dump.
 * @param {{url, status, headers, body}} input HTTP response of a suspected phpinfo page
 * @returns {{detected, service, version, confidence, severity, evidence, cwe, modules}}
 */
export function detectPhpInfo({ url = '', status = 0, headers = {}, body = '' }) {
  const text = String(body || '');
  const matched = PHPINFO_SIGNATURES.filter(re => re.test(text));
  if (!(status === 200 && matched.length >= 2)) {
    return { detected: false, service: 'phpinfo', reason: 'No phpinfo page signature in response' };
  }
  let version = null;
  for (const re of PHPINFO_VERSION_PATTERNS) {
    const m = re.exec(text);
    if (m) {
      version = m[1];
      break;
    }
  }
  const modules = [];
  for (const mod of ['curl', 'openssl', 'mysqli', 'mbstring', 'gd', 'redis', 'imagick']) {
    if (new RegExp(`<h2[^>]*>${mod}<\\/h2>|<td[^>]*>${mod}<\\/td>`, 'i').test(text))
      modules.push(mod);
  }
  return {
    detected: true,
    service: 'phpinfo',
    version,
    confidence: 'high',
    severity: 'Medium',
    cwe: 'CWE-200',
    evidence: `Exposed phpinfo() page at ${url}${version ? ` (PHP ${version})` : ''}. Discloses full server and extension configuration.`,
    modules: modules.length ? modules : null,
  };
}

/**
 * Run all PHP framework exposure detectors against a response.
 * @param {{url, status, headers, body}} input
 * @returns {Array} findings from each detector
 */
export function detectPhpFrameworkExposure(input) {
  const findings = [];
  for (const fn of [detectLaravelTelescope, detectSymfonyProfiler, detectPhpInfo]) {
    const r = fn(input);
    if (r.detected) findings.push(r);
  }
  return findings;
}

export const PHP_FRAMEWORK_RECON = {
  detectLaravelTelescope,
  detectSymfonyProfiler,
  detectPhpInfo,
  detectPhpFrameworkExposure,
  TELESCOPE_PATHS,
  TELESCOPE_SIGNATURES,
  SYMFONY_PROFILER_PATHS,
  SYMFONY_SIGNATURES,
  PHPINFO_SIGNATURES,
};
export default PHP_FRAMEWORK_RECON;
