/**
 * secretScanner.js — Find leaked secrets in JavaScript and responses.
 *
 * Scans JS files, HTML, and API responses for:
 *  - AWS keys, Google API keys, Stripe keys, GitHub tokens
 *  - Generic API keys, passwords, private keys
 *  - Firebase URLs, Slack webhooks
 *
 * High-value bug bounty findings — leaked secrets = instant valid reports.
 */

const SECRET_PATTERNS = [
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/, severity: 'Critical' },
  {
    name: 'AWS Secret Key',
    pattern: /aws_secret_access_key["']?\s*[:=]\s*["'][A-Za-z0-9/+=]{40}["']/i,
    severity: 'Critical',
  },
  { name: 'Google API Key', pattern: /AIza[0-9A-Za-z_-]{35}/, severity: 'High' },
  { name: 'Stripe Secret Key', pattern: /sk_live_[0-9a-zA-Z]{24,}/, severity: 'Critical' },
  { name: 'Stripe Publishable', pattern: /pk_live_[0-9a-zA-Z]{24,}/, severity: 'Medium' },
  { name: 'GitHub Token', pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/, severity: 'Critical' },
  {
    name: 'Slack Webhook',
    pattern: /hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/,
    severity: 'High',
  },
  { name: 'Firebase URL', pattern: /[a-z0-9-]+\.firebaseio\.com/, severity: 'Medium' },
  {
    name: 'Private Key',
    pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
    severity: 'Critical',
  },
  {
    name: 'Generic API Key',
    pattern: /["']?(api[_-]?key|apikey)["']?\s*[:=]\s*["'][A-Za-z0-9_-]{20,}["']/i,
    severity: 'High',
  },
  {
    name: 'Password in code',
    pattern: /["']?(password|passwd|pwd)["']?\s*[:=]\s*["'][^"']{8,}["']/i,
    severity: 'High',
  },
  {
    name: 'JWT Secret',
    pattern: /["']?(jwt[_-]?secret|secret[_-]?key)["']?\s*[:=]\s*["'][^"']{16,}["']/i,
    severity: 'High',
  },
];

/**
 * Scan text for secrets. Returns array of { name, severity, match }.
 * Matches are redacted to first 8 chars for safe logging.
 */
export function scanForSecrets(text = '') {
  const content = String(text);
  const hits = [];
  for (const { name, pattern, severity } of SECRET_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      hits.push({
        name,
        severity,
        type: 'Exposed Secret',
        confidence: 'high',
        cwe: 'CWE-798',
        evidence: `${name} pattern matched: ${match[0].slice(0, 12)}...[redacted]`,
        // Never store the full secret — just enough to verify.
        _redacted: true,
      });
    }
  }
  return hits;
}

/**
 * Extract JS file URLs from HTML for deeper scanning.
 */
export function extractJsUrls(html = '', baseUrl = '') {
  const urls = new Set();
  const regex = /<script[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    try {
      urls.add(new URL(m[1], baseUrl).href);
    } catch {
      /* skip invalid */
    }
  }
  return [...urls];
}

export const SECRET_SCANNER = { scanForSecrets, extractJsUrls };
export default SECRET_SCANNER;
