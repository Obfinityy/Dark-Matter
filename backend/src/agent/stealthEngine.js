/**
 * Stealth & Evasion Engine — hunt without getting blocked.
 *
 * Elite hunters are INVISIBLE:
 *   - They detect WAFs and adapt (not hammer through)
 *   - They randomize requests (not robotic patterns)
 *   - They respect rate limits (slow down before getting banned)
 *   - They rotate identities (user agents, timing)
 *
 * This engine:
 * 1. Detects WAF/protection (wafw00f + header analysis)
 * 2. Provides stealth HTTP defaults (random UA, jitter, delays)
 * 3. Tracks rate limit signals (429, Retry-After) and backs off
 * 4. Suggests WAF bypass techniques when blocked
 */

export const USER_AGENTS = Object.freeze([
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
]);

export const WAF_SIGNATURES = Object.freeze([
  { name: 'Cloudflare', headers: ['cf-ray', 'cf-cache-status'], body: /cloudflare/i },
  { name: 'AWS WAF', headers: ['x-amzn-requestid'], body: /aws waf/i },
  { name: 'Akamai', headers: ['x-akamai'], body: /akamai/i },
  { name: 'Imperva/Incapsula', headers: ['x-iinfo'], body: /incapsula|imperva/i },
  { name: 'F5 BIG-IP', headers: ['x-waf-event'], body: /big-ip|f5/i },
  { name: 'ModSecurity', body: /mod_security|modsecurity/i },
  { name: 'Sucuri', headers: ['x-sucuri'], body: /sucuri/i },
  { name: 'Wordfence', body: /wordfence/i },
]);

export const WAF_BYPASS_TECHNIQUES = Object.freeze([
  {
    name: 'Case variation',
    description: 'Mix case in payload: <ScRiPt> instead of <script>',
    applies: ['xss'],
  },
  {
    name: 'Encoding',
    description: 'URL/HTML/Unicode encode payload characters',
    applies: ['xss', 'sqli'],
  },
  {
    name: 'Comment injection',
    description: 'SQL: /**/ instead of spaces; XSS: <!-- --> breaks',
    applies: ['sqli', 'xss'],
  },
  {
    name: 'HTTP method swap',
    description: 'Try PUT/PATCH instead of POST — WAF rules may only cover POST',
    applies: ['sqli', 'xss', 'idor'],
  },
  {
    name: 'Content-Type confusion',
    description: 'Send JSON as text/plain or vice versa',
    applies: ['sqli', 'xss'],
  },
  {
    name: 'Parameter pollution',
    description: 'Split payload across duplicate params: ?q=<&q=script>',
    applies: ['xss', 'sqli'],
  },
  {
    name: 'Header injection point',
    description: 'Move payload to headers (User-Agent, Referer) — less inspected',
    applies: ['xss', 'sqli'],
  },
]);

/**
 * Detect WAF from response headers and body.
 */
export function detectWaf(headers = {}, body = '') {
  const headerNames = Object.keys(headers).map(h => h.toLowerCase());
  const bodyStr = String(body).slice(0, 5000);

  for (const sig of WAF_SIGNATURES) {
    if (sig.headers?.some(h => headerNames.includes(h.toLowerCase()))) {
      return { detected: true, waf: sig.name, method: 'header' };
    }
    if (sig.body && sig.body.test(bodyStr)) {
      return { detected: true, waf: sig.name, method: 'body' };
    }
  }
  return { detected: false, waf: null };
}

/**
 * Get a random user agent (rotate identity).
 */
export function randomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Random delay with jitter (avoid robotic timing).
 * @param {number} baseMs - base delay
 * @param {number} jitterPct - ±percentage jitter (0-1)
 */
export function stealthDelay(baseMs = 1000, jitterPct = 0.3) {
  const jitter = baseMs * jitterPct * (Math.random() * 2 - 1);
  return Math.max(100, Math.round(baseMs + jitter));
}

/**
 * Rate limit tracker — backs off when the server says slow down.
 */
export class RateLimitTracker {
  constructor() {
    this.consecutive429s = 0;
    this.backoffUntil = 0;
    this.requestTimes = [];
  }

  record(status, retryAfter = null) {
    const now = Date.now();
    this.requestTimes.push(now);
    // Keep last minute
    this.requestTimes = this.requestTimes.filter(t => now - t < 60000);

    if (status === 429) {
      this.consecutive429s++;
      // Exponential backoff: 5s, 10s, 20s, 40s... + Retry-After if given
      const backoff = Math.min(300000, 5000 * Math.pow(2, this.consecutive429s - 1));
      const retryMs = retryAfter ? Number(retryAfter) * 1000 : 0;
      this.backoffUntil = now + Math.max(backoff, retryMs);
      return { limited: true, waitMs: Math.max(backoff, retryMs) };
    }

    if (status < 400) {
      this.consecutive429s = Math.max(0, this.consecutive429s - 1);
    }
    return { limited: false, waitMs: 0 };
  }

  shouldWait() {
    return Date.now() < this.backoffUntil;
  }

  waitRemaining() {
    return Math.max(0, this.backoffUntil - Date.now());
  }

  requestsPerMinute() {
    const now = Date.now();
    return this.requestTimes.filter(t => now - t < 60000).length;
  }
}

/**
 * Get stealth headers for a request.
 */
export function stealthHeaders(extra = {}) {
  return {
    'User-Agent': randomUserAgent(),
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate',
    DNT: '1',
    Connection: 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    ...extra,
  };
}

/**
 * Suggest bypass techniques for a blocked payload type.
 */
export function suggestBypasses(vulnType) {
  return WAF_BYPASS_TECHNIQUES.filter(t => t.applies.includes(vulnType.toLowerCase()));
}
