/**
 * dbAdminRecon.js — Database / object-store admin UI fingerprinting engines.
 *
 * Implements idea-bank ideas 00471-00476: passive detection and version
 * fingerprinting of exposed database administration consoles (MinIO Console,
 * phpMyAdmin, Adminer, Mongo Express, Redis Commander, pgAdmin) from plain
 * HTTP responses. Every detector is a pure function over already-fetched
 * response data — no probing, no payloads, detection only.
 *
 * Input shape:  { url, status, headers, body }
 * Output shape: { detected, service, version, confidence, severity, evidence, cwe }
 */

const STR = (v) => (typeof v === 'string' ? v : '');

function getHeader(headers = {}, name) {
  const entries = Object.entries(headers);
  for (const [k, v] of entries) {
    if (k.toLowerCase() === name.toLowerCase()) return Array.isArray(v) ? v.join('; ') : String(v);
  }
  return '';
}

/**
 * Well-known paths worth fetching (defensively, GET only) when hunting for
 * these admin consoles. Listed for the caller's crawler — this module never
 * performs network requests itself.
 */
export const DB_ADMIN_PROBE_PATHS = {
  minio: ['/minio/', '/api/v1/session', '/login'],
  phpmyadmin: ['/phpmyadmin/', '/pma/', '/phpMyAdmin/', '/admin/phpmyadmin/'],
  adminer: ['/adminer.php', '/adminer/', '/adminer-4.8.4.php'],
  mongoExpress: ['/', '/db/', '/admin'],
  redisCommander: ['/', '/apiv2/server/info'],
  pgadmin: ['/pgadmin4/', '/pgadmin/', '/browser/', '/login'],
};

/**
 * Signature table for idea 00471 — MinIO Console detection.
 * The MinIO console login page is a React SPA ("MinIO Browser"/"MinIO Console")
 * whose API lives under /api/v1/ on the same origin.
 */
const MINIO_SIGNATURES = [
  { type: 'title', pattern: /<title>\s*MinIO (Browser|Console)\s*<\/title>/i, weight: 3 },
  { type: 'asset', pattern: /minio-console[\w.-]*\.(js|css)/i, weight: 3 },
  { type: 'api', pattern: /\/api\/v1\/(session|login)/i, weight: 2 },
  { type: 'text', pattern: /Object Browser for MinIO Server/i, weight: 2 },
  { type: 'asset', pattern: /minio-logo\.svg/i, weight: 1 },
];

/**
 * Detect a MinIO console from a login page or API response (idea 00471).
 * @param {{url, status, headers, body}} input
 */
export function detectMinIOConsole({ url = '', status = 0, headers = {}, body = '' }) {
  const text = STR(body);
  let score = 0;
  const hits = [];
  for (const sig of MINIO_SIGNATURES) {
    if (sig.pattern.test(text)) {
      score += sig.weight;
      hits.push(sig.type);
    }
  }
  if (score < 2) {
    return { detected: false, service: 'MinIO Console', version: null, confidence: 'none', severity: 'None', evidence: 'No MinIO console signatures matched.', cwe: null };
  }
  const apiHit = /application\/json/i.test(getHeader(headers, 'content-type')) && /minio|Console/i.test(text);
  const version = (text.match(/"version"\s*:\s*"([\d.]+)"/i) || [])[1] || null;
  return {
    detected: true,
    service: 'MinIO Console',
    version,
    confidence: score >= 5 || apiHit ? 'high' : 'medium',
    severity: 'Medium',
    severityReason: 'Exposed object-store admin console; may allow management access or user enumeration.',
    evidence: `MinIO console signatures matched (${hits.join(', ')}) on ${url} [HTTP ${status}].`,
    cwe: 'CWE-200',
  };
}

/**
 * Signature table for idea 00472 — phpMyAdmin version fingerprinting.
 */
const PHPMYADMIN_SIGNATURES = [
  { type: 'form', pattern: /name="pma_(username|password)"/i, weight: 3 },
  { type: 'form', pattern: /id="loginform"/i, weight: 2 },
  { type: 'asset', pattern: /themes\/pmahomme\/jquery\/jquery-ui/i, weight: 3 },
  { type: 'asset', pattern: /js\/vendor\/codemirror/i, weight: 2 },
  { type: 'text', pattern: /phpmyadmin\.net/i, weight: 1 },
  { type: 'cookie', pattern: /pma_lang/i, weight: 2 },
];

const PHPMYADMIN_VERSION_PATTERNS = [
  /(?:var\s+)?PMA_VERSION\s*=\s*['"]([\d.]+)['"]/i,
  /phpMyAdmin\s*([\d.]+)/i,
  /Version information:\s*([\d.]+)/i,
];

/**
 * Fingerprint phpMyAdmin from its login page assets and version strings (idea 00472).
 * @param {{url, status, headers, body}} input
 */
export function fingerprintPhpMyAdmin({ url = '', status = 0, headers = {}, body = '' }) {
  const text = STR(body);
  const cookie = getHeader(headers, 'set-cookie');
  let score = 0;
  const hits = [];
  for (const sig of PHPMYADMIN_SIGNATURES) {
    const haystack = sig.type === 'cookie' ? cookie : text;
    if (sig.pattern.test(haystack)) {
      score += sig.weight;
      hits.push(sig.type);
    }
  }
  if (score < 2) {
    return { detected: false, service: 'phpMyAdmin', version: null, confidence: 'none', severity: 'None', evidence: 'No phpMyAdmin signatures matched.', cwe: null };
  }
  let version = null;
  for (const rx of PHPMYADMIN_VERSION_PATTERNS) {
    const m = text.match(rx);
    if (m) { version = m[1]; break; }
  }
  return {
    detected: true,
    service: 'phpMyAdmin',
    version,
    confidence: score >= 6 ? 'high' : 'medium',
    severity: 'Medium',
    severityReason: 'Exposed database admin panel is a high-value target for credential attacks and version-specific flaws.',
    evidence: `phpMyAdmin signatures matched (${hits.join(', ')}) on ${url} [HTTP ${status}]${version ? `; version ${version} extracted` : ''}.`,
    cwe: 'CWE-200',
  };
}

/**
 * Signature table for idea 00473 — Adminer instance detection.
 * Adminer ships as a single PHP file; its login form is highly distinctive.
 */
const ADMINER_SIGNATURES = [
  { type: 'form', pattern: /name="auth\[driver\]"/i, weight: 3 },
  { type: 'form', pattern: /name="auth\[username\]"/i, weight: 3 },
  { type: 'form', pattern: /name="auth\[server\]"/i, weight: 2 },
  { type: 'text', pattern: /<title>\s*Adminer/i, weight: 2 },
  { type: 'asset', pattern: /adminer\.css/i, weight: 2 },
  { type: 'text', pattern: /vrana\.cz/i, weight: 1 },
];

/**
 * Detect Adminer database UIs by their single-file login signatures (idea 00473).
 * @param {{url, status, headers, body}} input
 */
export function detectAdminer({ url = '', status = 0, headers = {}, body = '' }) {
  const text = STR(body);
  let score = 0;
  const hits = [];
  for (const sig of ADMINER_SIGNATURES) {
    if (sig.pattern.test(text)) {
      score += sig.weight;
      hits.push(sig.type);
    }
  }
  if (score < 2) {
    return { detected: false, service: 'Adminer', version: null, confidence: 'none', severity: 'None', evidence: 'No Adminer signatures matched.', cwe: null };
  }
  const version = (text.match(/Adminer\s+([\d.]+)/i) || [])[1] || null;
  return {
    detected: true,
    service: 'Adminer',
    version,
    confidence: score >= 6 ? 'high' : 'medium',
    severity: 'Medium',
    severityReason: 'Exposed Adminer instance accepts connections to arbitrary database servers — a classic initial-access foothold.',
    evidence: `Adminer single-file login signatures matched (${hits.join(', ')}) on ${url} [HTTP ${status}]${version ? `; version ${version} extracted` : ''}.`,
    cwe: 'CWE-200',
  };
}

/**
 * Signature table for idea 00474 — Mongo Express detection.
 */
const MONGO_EXPRESS_SIGNATURES = [
  { type: 'title', pattern: /<title>[^<]*Mongo Express[^<]*<\/title>/i, weight: 3 },
  { type: 'route', pattern: /\/db\/[a-zA-Z0-9_-]+/i, weight: 2 },
  { type: 'asset', pattern: /\/javascripts\/(?:main|index)[\w.-]*\.js/i, weight: 2 },
  { type: 'text', pattern: /mongo-express/i, weight: 2 },
  { type: 'text', pattern: /Database:\s*<a[^>]*\/db\//i, weight: 1 },
];

/**
 * Detect mongo-express UIs by page title and routes (idea 00474).
 * @param {{url, status, headers, body}} input
 */
export function detectMongoExpress({ url = '', status = 0, headers = {}, body = '' }) {
  const text = STR(body);
  let score = 0;
  const hits = [];
  for (const sig of MONGO_EXPRESS_SIGNATURES) {
    if (sig.pattern.test(text)) {
      score += sig.weight;
      hits.push(sig.type);
    }
  }
  if (score < 2) {
    return { detected: false, service: 'Mongo Express', version: null, confidence: 'none', severity: 'None', evidence: 'No mongo-express signatures matched.', cwe: null };
  }
  const version = (text.match(/mongo[- ]express[^0-9]*v?([\d.]+)/i) || [])[1] || null;
  return {
    detected: true,
    service: 'Mongo Express',
    version,
    confidence: score >= 5 ? 'high' : 'medium',
    severity: 'Medium',
    severityReason: 'Exposed Mongo Express gives web UI access to MongoDB; often deployed without authentication.',
    evidence: `mongo-express signatures matched (${hits.join(', ')}) on ${url} [HTTP ${status}]${version ? `; version ${version} extracted` : ''}.`,
    cwe: 'CWE-200',
  };
}

/**
 * Signature table for idea 00475 — Redis Commander detection.
 */
const REDIS_COMMANDER_SIGNATURES = [
  { type: 'title', pattern: /<title>\s*Redis Commander\s*<\/title>/i, weight: 3 },
  { type: 'api', pattern: /\/apiv2\/(?:server|connections)\//i, weight: 3 },
  { type: 'text', pattern: /Redis Commander/i, weight: 2 },
  { type: 'asset', pattern: /redis-commander/i, weight: 2 },
];

/**
 * Detect Redis Commander web UIs (idea 00475).
 * @param {{url, status, headers, body}} input
 */
export function detectRedisCommander({ url = '', status = 0, headers = {}, body = '' }) {
  const text = STR(body);
  let score = 0;
  const hits = [];
  for (const sig of REDIS_COMMANDER_SIGNATURES) {
    if (sig.pattern.test(text)) {
      score += sig.weight;
      hits.push(sig.type);
    }
  }
  if (score < 2) {
    return { detected: false, service: 'Redis Commander', version: null, confidence: 'none', severity: 'None', evidence: 'No Redis Commander signatures matched.', cwe: null };
  }
  const version = (text.match(/Redis Commander[^0-9]*v?([\d.]+)/i) || [])[1] || null;
  return {
    detected: true,
    service: 'Redis Commander',
    version,
    confidence: score >= 5 ? 'high' : 'medium',
    severity: 'Medium',
    severityReason: 'Exposed Redis Commander allows executing Redis commands through a web UI; dangerous when reachable anonymously.',
    evidence: `Redis Commander signatures matched (${hits.join(', ')}) on ${url} [HTTP ${status}]${version ? `; version ${version} extracted` : ''}.`,
    cwe: 'CWE-200',
  };
}

/**
 * Signature table for idea 00476 — pgAdmin instance discovery.
 */
const PGADMIN_SIGNATURES = [
  { type: 'title', pattern: /<title>[^<]*pgAdmin\s*4/i, weight: 3 },
  { type: 'text', pattern: /pgAdmin\s*4/i, weight: 2 },
  { type: 'asset', pattern: /pgadmin4[\w.-]*\.(js|css)/i, weight: 3 },
  { type: 'route', pattern: /\/(?:browser|login|misc)\//i, weight: 1 },
  { type: 'api', pattern: /\/misc\/ping/i, weight: 2 },
];

/**
 * Discover pgAdmin deployments by their login flow (idea 00476).
 * @param {{url, status, headers, body}} input
 */
export function detectPgAdmin({ url = '', status = 0, headers = {}, body = '' }) {
  const text = STR(body);
  let score = 0;
  const hits = [];
  for (const sig of PGADMIN_SIGNATURES) {
    if (sig.pattern.test(text)) {
      score += sig.weight;
      hits.push(sig.type);
    }
  }
  if (score < 2) {
    return { detected: false, service: 'pgAdmin', version: null, confidence: 'none', severity: 'None', evidence: 'No pgAdmin signatures matched.', cwe: null };
  }
  const versionMatch = text.match(/pgAdmin\s*4\s+v([\d.]+)/i);
  const version = versionMatch ? versionMatch[1] : null;
  return {
    detected: true,
    service: 'pgAdmin',
    version,
    confidence: score >= 5 ? 'high' : 'medium',
    severity: 'Medium',
    severityReason: 'Exposed pgAdmin login flow grants database management access to anyone with valid credentials.',
    evidence: `pgAdmin signatures matched (${hits.join(', ')}) on ${url} [HTTP ${status}]${version ? `; version ${version} extracted` : ''}.`,
    cwe: 'CWE-200',
  };
}

/** All six database-admin detectors in evaluation order. */
export const DB_ADMIN_DETECTORS = [
  detectMinIOConsole,
  fingerprintPhpMyAdmin,
  detectAdminer,
  detectMongoExpress,
  detectRedisCommander,
  detectPgAdmin,
];

/**
 * Run every database-admin detector over a list of fetched responses and
 * return all positive findings.
 * @param {Array<{url, status, headers, body}>} responses
 */
export function scanDbAdminUIs(responses = []) {
  const findings = [];
  for (const response of responses || []) {
    for (const detector of DB_ADMIN_DETECTORS) {
      const result = detector(response || {});
      if (result.detected) findings.push(result);
    }
  }
  return findings;
}

export const DB_ADMIN_RECON = {
  DB_ADMIN_PROBE_PATHS,
  detectMinIOConsole,
  fingerprintPhpMyAdmin,
  detectAdminer,
  detectMongoExpress,
  detectRedisCommander,
  detectPgAdmin,
  scanDbAdminUIs,
  DB_ADMIN_DETECTORS,
};
export default DB_ADMIN_RECON;
