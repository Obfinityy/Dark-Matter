/**
 * javaFrameworkRecon.js — Java server console exposure detectors.
 *
 * Detects publicly exposed Java application-server management surfaces:
 *   - Apache Tomcat manager / host-manager paths (fingerprinting via error pages)
 *   - JMX consoles (JBoss JMX Console, Jolokia agent, hawtio)
 *
 * Detection is strictly passive: the module matches known management
 * paths and response signatures. It never attempts authentication or
 * issues any MBean operation.
 */

export const TOMCAT_MANAGER_PATHS = [
  '/manager',
  '/manager/html',
  '/manager/status',
  '/manager/text/list',
  '/host-manager',
  '/host-manager/html',
];

export const TOMCAT_ERROR_SIGNATURES = [
  /Apache Tomcat/i,
  /Tomcat\/([\d.]+)/,
  /FAIL - Application already exists/i,
  /The manager application is not available/i,
  /Invalid direct reference to form login page/i,
];

export const TOMCAT_VERSION_PATTERNS = [
  /Apache Tomcat\/([\d.]+)/i,
  /Tomcat\s*([\d.]+)\s*-\s*Error report/i,
];

export const JMX_CONSOLE_PATHS = [
  '/jmx-console',
  '/jmx-console/HtmlAdaptor',
  '/jolokia',
  '/jolokia/version',
  '/hawtio',
  '/actuator/jolokia',
];

export const JMX_SIGNATURES = [
  { name: 'JBoss JMX Console', re: /JBoss JMX Console|jmx-console\/HtmlAdaptor/i },
  { name: 'Jolokia', re: /jolokia|"agent":"[\d.]+"/i },
  { name: 'hawtio', re: /hawtio/i },
  { name: 'Spring Actuator JMX', re: /"status":"UP".*"jolokia"|jolokia/i },
];

/**
 * Probe-analyser for Tomcat manager paths: fingerprints the Tomcat
 * version from a manager or manager error-page response.
 * @param {{url, status, headers, body}} input
 * @returns {{detected, service, version, confidence, severity, evidence, cwe, endpoints}}
 */
export function probeTomcatManager({ url = '', status = 0, headers = {}, body = '' }) {
  const text = String(body || '');
  const matched = TOMCAT_ERROR_SIGNATURES.filter(re => re.test(text));
  const serverHeader = String(headers['server'] || headers['Server'] || '');
  const headerHint = /tomcat/i.test(serverHeader);
  const detected =
    matched.length > 0 && (status === 401 || status === 403 || status === 404 || status === 200);
  if (!detected) {
    return {
      detected: false,
      service: 'Apache Tomcat Manager',
      reason: 'No Tomcat manager fingerprint in response',
    };
  }
  let version = null;
  for (const re of TOMCAT_VERSION_PATTERNS) {
    const m = re.exec(text) || re.exec(serverHeader);
    if (m) {
      version = m[1];
      break;
    }
  }
  return {
    detected: true,
    service: 'Apache Tomcat Manager',
    version,
    confidence: version || headerHint ? 'high' : 'medium',
    severity: status === 401 ? 'Medium' : 'High',
    cwe: 'CWE-200',
    evidence: `Tomcat manager surface fingerprinted at ${url} (HTTP ${status})${version ? `, Tomcat ${version}` : ''}.`,
    authRequired: status === 401,
    endpoints: TOMCAT_MANAGER_PATHS,
  };
}

/**
 * Check a response for an exposed JMX console surface.
 * @param {{url, status, headers, body}} input
 * @returns {{detected, service, version, confidence, severity, evidence, cwe, endpoints}}
 */
export function checkJmxConsole({ url = '', status = 0, headers = {}, body = '' }) {
  const text = String(body || '');
  const hit = JMX_SIGNATURES.find(sig => sig.re.test(text));
  if (!(status === 200 && hit)) {
    return {
      detected: false,
      service: 'JMX Console',
      reason: 'No JMX console signature in response',
    };
  }
  let version = null;
  if (hit.name === 'Jolokia') {
    const m = /"agent":"([\d.]+)"/i.exec(text);
    if (m) version = m[1];
  }
  return {
    detected: true,
    service: `JMX Console (${hit.name})`,
    version,
    confidence: 'high',
    severity: 'High',
    cwe: 'CWE-200',
    evidence: `Exposed ${hit.name} endpoint at ${url}. MBean introspection may be readable.`,
    endpoints: JMX_CONSOLE_PATHS,
  };
}

/**
 * Run all Java server console detectors against a response.
 * @param {{url, status, headers, body}} input
 * @returns {Array} findings from each detector
 */
export function detectJavaServerExposure(input) {
  const findings = [];
  for (const fn of [probeTomcatManager, checkJmxConsole]) {
    const r = fn(input);
    if (r.detected) findings.push(r);
  }
  return findings;
}

export const JAVA_FRAMEWORK_RECON = {
  probeTomcatManager,
  checkJmxConsole,
  detectJavaServerExposure,
  TOMCAT_MANAGER_PATHS,
  TOMCAT_ERROR_SIGNATURES,
  JMX_CONSOLE_PATHS,
  JMX_SIGNATURES,
};
export default JAVA_FRAMEWORK_RECON;
