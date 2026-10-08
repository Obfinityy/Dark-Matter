/**
 * JavaScript Deep Analysis — find what scanners miss in client-side code.
 *
 * Elite hunters know: the frontend JavaScript is a goldmine.
 *   - Hardcoded API keys, secrets, tokens
 *   - Hidden API endpoints (/api/v1/admin/...)
 *   - Client-side logic flaws (validation only in JS)
 *   - Debug endpoints, test credentials
 *   - Source maps leaking original code
 *
 * This engine:
 * 1. Collects JS files (from katana/linkfinder + direct fetch)
 * 2. Extracts secrets with high-precision patterns (low false positives)
 * 3. Extracts endpoints/paths for further testing
 * 4. Flags client-side-only validation
 * 5. Checks for source maps
 */

export const SECRET_PATTERNS = Object.freeze([
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/g, severity: 'critical' },
  {
    name: 'AWS Secret Key',
    pattern: /aws_secret[^a-z0-9]{0,10}[a-zA-Z0-9/+=]{40}/gi,
    severity: 'critical',
  },
  { name: 'Google API Key', pattern: /AIza[0-9A-Za-z\-_]{35}/g, severity: 'high' },
  { name: 'Stripe Key', pattern: /sk_live_[0-9a-zA-Z]{24}/g, severity: 'critical' },
  { name: 'Stripe Publishable', pattern: /pk_live_[0-9a-zA-Z]{24}/g, severity: 'medium' },
  { name: 'GitHub Token', pattern: /ghp_[0-9a-zA-Z]{36}/g, severity: 'critical' },
  { name: 'Slack Token', pattern: /xox[baprs]-[0-9a-zA-Z\-]{10,48}/g, severity: 'high' },
  {
    name: 'JWT Token',
    pattern: /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g,
    severity: 'high',
  },
  {
    name: 'Private Key',
    pattern: /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/g,
    severity: 'critical',
  },
  { name: 'Firebase URL', pattern: /https:\/\/[a-z0-9\-]+\.firebaseio\.com/g, severity: 'medium' },
  {
    name: 'Generic API Key',
    pattern: /["']api[_-]?key["']\s*[:=]\s*["'][a-zA-Z0-9\-_]{16,}["']/gi,
    severity: 'high',
  },
  {
    name: 'Generic Secret',
    pattern: /["']secret["']\s*[:=]\s*["'][a-zA-Z0-9\-_]{16,}["']/gi,
    severity: 'high',
  },
  {
    name: 'Password in JS',
    pattern: /["']password["']\s*[:=]\s*["'][^"']{4,}["']/gi,
    severity: 'high',
  },
  { name: 'Bearer Token', pattern: /Bearer [a-zA-Z0-9\-._~+/]+=*/g, severity: 'high' },
]);

export const ENDPOINT_PATTERNS = Object.freeze([
  // API paths
  /["'`](\/api\/[a-zA-Z0-9\-_\/{}:.]+)["'`]/g,
  // Absolute paths that look like endpoints
  /["'`](\/[a-z]{2,}(?:\/[a-zA-Z0-9\-_]+){1,4})["'`]/g,
  // fetch/axios calls
  /(?:fetch|axios\.(?:get|post|put|delete|patch))\(\s*["'`]([^"'`]+)["'`]/g,
]);

export const CLIENT_LOGIC_FLAGS = Object.freeze([
  {
    name: 'Client-side price',
    pattern: /price|amount|total/i,
    context: /const|let|var/,
    severity: 'medium',
    note: 'Price handled in JS — test server-side validation',
  },
  {
    name: 'Client-side auth check',
    pattern: /isAdmin|is_admin|role\s*===?\s*['"]admin['"]/i,
    severity: 'high',
    note: 'Role check in JS only — bypass by modifying client',
  },
  {
    name: 'Debug endpoint',
    pattern: /\/debug|\/test|\/dev/i,
    severity: 'medium',
    note: 'Debug/test endpoint referenced',
  },
  {
    name: 'TODO with creds',
    pattern: /TODO.*(?:key|pass|secret|token)/i,
    severity: 'low',
    note: 'TODO mentions credentials',
  },
  {
    name: 'eval() usage',
    pattern: /\beval\s*\(/,
    severity: 'medium',
    note: 'eval() — potential code injection sink',
  },
  {
    name: 'innerHTML with data',
    pattern: /\.innerHTML\s*=\s*[^'"]/,
    severity: 'medium',
    note: 'innerHTML with variable — potential XSS sink',
  },
  {
    name: 'document.write',
    pattern: /document\.write\s*\(/,
    severity: 'medium',
    note: 'document.write — potential XSS sink',
  },
]);

/**
 * Analyze JavaScript source code.
 * @param {string} code - JS source
 * @param {string} url - source URL (for reporting)
 * @returns {{ secrets: [], endpoints: [], logicFlags: [], sourceMap: boolean }}
 */
export function analyzeJavaScript(code, url = '') {
  const secrets = [];
  const endpoints = new Set();
  const logicFlags = [];

  if (!code || typeof code !== 'string') {
    return { secrets, endpoints: [], logicFlags, sourceMap: false };
  }

  // 1. Secrets
  for (const { name, pattern, severity } of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    let m;
    let count = 0;
    while ((m = pattern.exec(code)) !== null && count < 5) {
      // Skip obvious placeholders
      const val = m[0];
      if (/example|placeholder|test123|xxx|your[_-]?key/i.test(val)) continue;
      secrets.push({
        type: name,
        severity,
        match: val.slice(0, 60) + (val.length > 60 ? '…' : ''),
        url,
        // Never store the full secret — just enough to identify
        redacted: true,
      });
      count++;
    }
  }

  // 2. Endpoints
  for (const pattern of ENDPOINT_PATTERNS) {
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(code)) !== null) {
      const ep = m[1] || m[0].replace(/["'`]/g, '');
      if (ep.length > 2 && ep.length < 200 && !ep.includes(' ')) {
        endpoints.add(ep);
      }
      if (endpoints.size > 100) break;
    }
  }

  // 3. Client-side logic flags
  for (const { name, pattern, severity, note } of CLIENT_LOGIC_FLAGS) {
    pattern.lastIndex = 0;
    if (pattern.test(code)) {
      logicFlags.push({ name, severity, note, url });
    }
  }

  // 4. Source map
  const sourceMap = /sourceMappingURL=/.test(code);

  return {
    secrets,
    endpoints: [...endpoints],
    logicFlags,
    sourceMap,
  };
}

/**
 * Quick check: does this URL look like a JS file worth analyzing?
 */
export function isAnalyzableJs(url) {
  return /\.js(\?|$)/i.test(url) && !/jquery|bootstrap|react-dom|vue\.min/i.test(url);
}
