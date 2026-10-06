/**
 * neo4jFingerprint.js — Neo4j browser / database exposure fingerprinting (idea 00491).
 *
 * Detects Neo4j deployments from passive evidence:
 *  - Neo4j Browser HTTP service (default :7474): title, headers, auth realm.
 *  - Bolt handshake evidence (default :7687): server-agreed Bolt version.
 *  - Neo4j cluster / management JSON clues when present.
 *
 * Offline analyzer: callers supply captured HTTP responses or recorded
 * handshake bytes. No network code is included; probing itself is the
 * scanner's job. Defensive use only — findings feed exposure reports for
 * authorized targets.
 */

export const NEO4J_DEFAULT_PORTS = {
  httpBrowser: 7474,
  bolt: 7687,
  httpsBrowser: 7473,
};

const NEO4J_BODY_MARKERS = [
  /neo4j\s+browser/i,
  /window\.NEO4J/i,
  /"neo4j"/i,
];

const NEO4J_HEADER_MARKERS = [
  /neo4j/i,
];

/**
 * Analyze an HTTP response for Neo4j Browser / HTTP API evidence.
 *
 * @param {{headers?: object, body?: string, status?: number, url?: string}} response
 * @returns {object} detection verdict
 */
export function analyzeNeo4jHttp(response = {}) {
  const headers = {};
  for (const [k, v] of Object.entries(response.headers || {})) {
    headers[k.toLowerCase()] = String(v);
  }
  const body = String(response.body || '');
  const matched = [];

  if (/<title>\s*neo4j\s+browser\s*<\/title>/i.test(body)) matched.push({ signal: 'html_title', detail: '<title>Neo4j Browser</title>' });
  for (const re of NEO4J_BODY_MARKERS) {
    if (re.test(body) && !matched.some((m) => m.signal === 'html_title')) matched.push({ signal: 'body_marker', detail: String(re) });
  }
  for (const [hk, hv] of Object.entries(headers)) {
    if (NEO4J_HEADER_MARKERS.some((re) => re.test(hk) || re.test(hv))) matched.push({ signal: 'header_marker', detail: `${hk}: ${hv.slice(0, 80)}` });
  }
  const wwwAuth = headers['www-authenticate'] || '';
  const authHint = /realm="?neo4j"?/i.test(wwwAuth) ? 'Neo4j auth realm advertised' : null;
  if (authHint) matched.push({ signal: 'auth_realm', detail: wwwAuth.slice(0, 120) });

  const detected = matched.length > 0;
  let confidence = 'none';
  if (matched.some((m) => m.signal === 'html_title' || m.signal === 'auth_realm')) confidence = 'high';
  else if (matched.length > 0) confidence = 'medium';

  return {
    detected,
    confidence,
    service: 'neo4j-browser',
    signals: matched,
    exposedToInternet: Boolean(response.exposedToInternet),
    recommendations: detected
      ? [
          'Verify the Neo4j Browser UI is intended to be reachable on this target.',
          'Confirm default credentials (neo4j/neo4j) were changed; the first-run password change must be enforced.',
          'Prefer TLS (HTTPS :7473 / Bolt+S) and restrict browser access to the management network.',
        ]
      : [],
  };
}

/**
 * Interpret a recorded Bolt handshake result.
 *
 * The Bolt handshake: client sends 0x6060B017 plus four proposed versions;
 * the server replies with the single agreed version (4 bytes, big-endian).
 * Bolt packs the version as major in bits 23..16 and minor in bits 15..8
 * (e.g. Bolt 5.4 = 0x00050400).
 *
 * @param {{serverVersionHex?: string, proposedVersions?: number[]}} handshake
 * @returns {object} handshake interpretation
 */
export function interpretBoltHandshake(handshake = {}) {
  const hex = String(handshake.serverVersionHex || '').replace(/^0x/i, '');
  const agreed = hex.length === 8 ? parseInt(hex, 16) : null;
  const major = agreed !== null && !Number.isNaN(agreed) ? ((agreed >>> 16) & 0xff) : null;
  const minor = agreed !== null && !Number.isNaN(agreed) ? ((agreed >>> 8) & 0xff) : null;
  return {
    valid: agreed !== null,
    agreedVersion: agreed !== null ? `${major}.${minor}` : null,
    raw: handshake.serverVersionHex || null,
    note: agreed === null
      ? 'No usable server handshake bytes supplied.'
      : 'A Bolt server answered the handshake — consistent with a Neo4j (or Bolt-compatible) database on this port.',
  };
}

/**
 * Extract a version string from Neo4j HTTP payloads when advertised.
 *
 * @param {string} body raw body text
 * @returns {string|null} version like "5.12.0" or null
 */
export function extractNeo4jVersion(body = '') {
  const m = String(body).match(/neo4j[\s\/_-]?version["'\s:]+(\d+\.\d+\.\d+)/i)
    || String(body).match(/"version"\s*:\s*"(\d+\.\d+\.\d+)"/);
  return m ? m[1] : null;
}

export const NEO4J_FINGERPRINT = {
  idea: '00491',
  ports: NEO4J_DEFAULT_PORTS,
  analyzeHttp: analyzeNeo4jHttp,
  interpretBoltHandshake,
  extractVersion: extractNeo4jVersion,
};

export default NEO4J_FINGERPRINT;
