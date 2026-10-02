/**
 * vulnDetector.js — Smart vulnerability detection patterns.
 *
 * Detects common bug bounty vulnerability classes from HTTP responses:
 *  - SQL Injection (error-based signatures)
 *  - Cross-Site Scripting (reflected input)
 *  - Server-Side Request Forgery (parameter analysis)
 *  - Insecure Direct Object Reference (ID patterns)
 *  - Open redirect, XXE hints, SSTI markers
 *
 * Each detector returns { found, confidence, evidence, type }.
 * Confidence: high | medium | low. Only high+medium reach the FP filter.
 */

const SQL_ERROR_PATTERNS = [
  /SQL syntax.*MySQL/i,
  /Warning.*mysql_/i,
  /valid MySQL result/i,
  /MySqlClient\./i,
  /PostgreSQL.*ERROR/i,
  /Warning.*pg_/i,
  /valid PostgreSQL result/i,
  /Npgsql\./i,
  /Driver.*SQL[\-\_]SERVER/i,
  /OLE DB.*SQL Server/i,
  /SQLServer JDBC Driver/i,
  /SqlException/i,
  /ORA-\d{5}/i,
  /Oracle error/i,
  /Oracle.*Driver/i,
  /SQLite\/JDBCDriver/i,
  /SQLite\.Exception/i,
  /System\.Data\.SQLite/i,
];

const XSS_REFLECT_PATTERNS = [
  /<script>alert\(/i,
  /javascript:/i,
  /onerror\s*=/i,
  /onload\s*=/i,
];

const SSRF_PARAM_NAMES = [
  'url', 'uri', 'link', 'src', 'source', 'target', 'redirect', 'redirect_uri',
  'return', 'return_url', 'callback', 'webhook', 'fetch', 'proxy', 'file',
  'path', 'dest', 'destination', 'continue', 'next',
];

const IDOR_PARAM_NAMES = [
  'id', 'user_id', 'userid', 'account_id', 'order_id', 'invoice_id',
  'file_id', 'doc_id', 'patient_id', 'customer_id',
];

const OPEN_REDIRECT_PATTERNS = [
  /window\.location\s*=/i,
  /location\.href\s*=/i,
  /meta[^>]*http-equiv=["']refresh["']/i,
];

const SSTI_MARKERS = ['{{7*7}}', '${7*7}', '<%= 7*7 %>'];

/**
 * Check response body for SQL error signatures.
 */
export function detectSQLi(body, { payloadReflected = false } = {}) {
  const text = String(body || '');
  for (const pattern of SQL_ERROR_PATTERNS) {
    if (pattern.test(text)) {
      return {
        found: true,
        type: 'SQL Injection',
        confidence: payloadReflected ? 'high' : 'medium',
        evidence: text.match(pattern)?.[0]?.slice(0, 120) || 'SQL error signature',
        cwe: 'CWE-89',
      };
    }
  }
  return { found: false };
}

/**
 * Check if our canary input is reflected unescaped (XSS hint).
 */
export function detectXSS(body, canary) {
  if (!canary) return { found: false };
  const text = String(body || '');
  if (text.includes(canary)) {
    // Check if it's inside an executable context
    for (const pattern of XSS_REFLECT_PATTERNS) {
      if (pattern.test(text)) {
        return {
          found: true, type: 'Cross-Site Scripting (XSS)',
          confidence: 'high',
          evidence: `Canary reflected in executable context`,
          cwe: 'CWE-79',
        };
      }
    }
    return {
      found: true, type: 'Cross-Site Scripting (XSS)',
      confidence: 'medium',
      evidence: `Canary "${canary.slice(0, 40)}" reflected in response`,
      cwe: 'CWE-79',
    };
  }
  return { found: false };
}

/**
 * Flag parameters that look like SSRF sinks.
 */
export function detectSSRFParams(url) {
  try {
    const u = new URL(url);
    const hits = [];
    for (const [key, value] of u.searchParams) {
      const k = key.toLowerCase();
      if (SSRF_PARAM_NAMES.some((n) => k === n || k.endsWith('_' + n))) {
        hits.push({ param: key, value: value.slice(0, 80) });
      }
    }
    if (hits.length > 0) {
      return {
        found: true, type: 'SSRF candidate',
        confidence: 'medium',
        evidence: `URL parameters accepting URLs: ${hits.map((h) => h.param).join(', ')}`,
        cwe: 'CWE-918',
        params: hits,
      };
    }
  } catch { /* invalid URL */ }
  return { found: false };
}

/**
 * Flag numeric/sequential ID parameters (IDOR hint).
 */
export function detectIDORParams(url) {
  try {
    const u = new URL(url);
    const hits = [];
    for (const [key, value] of u.searchParams) {
      const k = key.toLowerCase();
      if (IDOR_PARAM_NAMES.includes(k) && /^\d+$/.test(value)) {
        hits.push({ param: key, value });
      }
    }
    if (hits.length > 0) {
      return {
        found: true, type: 'IDOR candidate',
        confidence: 'low',
        evidence: `Sequential ID parameters: ${hits.map((h) => `${h.param}=${h.value}`).join(', ')}`,
        cwe: 'CWE-639',
        params: hits,
      };
    }
  } catch { /* invalid URL */ }
  return { found: false };
}

/**
 * Run all detectors against a response. Returns array of findings.
 */
export function scanResponse({ url, body, headers }, { canary = null } = {}) {
  const findings = [];
  const checks = [
    detectSQLi(body),
    detectXSS(body, canary),
    detectSSRFParams(url),
    detectIDORParams(url),
  ];
  for (const c of checks) {
    if (c.found) findings.push({ ...c, url });
  }
  return findings;
}

export const VULN_DETECTOR = {
  detectSQLi, detectXSS, detectSSRFParams, detectIDORParams, scanResponse,
};

export default VULN_DETECTOR;
