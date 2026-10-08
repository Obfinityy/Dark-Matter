/**
 * eliteRecon.js — Elite reconnaissance engine for autonomous bug bounty.
 *
 * Goes beyond basic subdomain enumeration:
 *  - Multi-source subdomain discovery (cert transparency, DNS brute-force)
 *  - Technology fingerprinting (headers, HTML meta, JS libraries)
 *  - Interesting endpoint discovery (robots.txt, sitemap, .git, backups)
 *  - Port/service hints from HTTP responses
 *
 * All passive-first: no aggressive scanning without explicit scope approval.
 */

const COMMON_SUBDOMAINS = [
  'www',
  'mail',
  'ftp',
  'admin',
  'blog',
  'dev',
  'staging',
  'test',
  'api',
  'app',
  'portal',
  'secure',
  'vpn',
  'shop',
  'support',
  'docs',
  'cdn',
  'static',
  'assets',
  'beta',
  'demo',
  'internal',
  'stage',
  'prod',
  'db',
  'git',
  'jenkins',
  'jira',
  'wiki',
  'monitor',
  'grafana',
  'kibana',
  'auth',
  'login',
  'sso',
  'oauth',
  'dashboard',
  'panel',
  'console',
];

const INTERESTING_PATHS = [
  '/robots.txt',
  '/sitemap.xml',
  '/.git/HEAD',
  '/.env',
  '/.well-known/security.txt',
  '/server-status',
  '/phpinfo.php',
  '/.DS_Store',
  '/backup.zip',
  '/db.sql',
  '/wp-admin',
  '/admin',
  '/.git/config',
  '/package.json',
  '/swagger.json',
  '/api/docs',
  '/graphql',
  '/.svn/entries',
];

const TECH_SIGNATURES = [
  { name: 'WordPress', headers: {}, body: [/wp-content/i, /wp-includes/i] },
  { name: 'Drupal', headers: {}, body: [/drupal/i] },
  { name: 'Joomla', headers: {}, body: [/joomla/i] },
  { name: 'React', headers: {}, body: [/_next\//i, /react/i] },
  { name: 'Angular', headers: {}, body: [/ng-version/i, /angular/i] },
  { name: 'Vue', headers: {}, body: [/vue/i] },
  { name: 'Django', headers: { 'x-powered-by': /django/i }, body: [/csrfmiddlewaretoken/i] },
  { name: 'Laravel', headers: { 'x-powered-by': /laravel/i }, body: [] },
  { name: 'Express', headers: { 'x-powered-by': /express/i }, body: [] },
  { name: 'Nginx', headers: { server: /nginx/i }, body: [] },
  { name: 'Apache', headers: { server: /apache/i }, body: [] },
  { name: 'Cloudflare', headers: { server: /cloudflare/i, 'cf-ray': /./ }, body: [] },
];

/**
 * Fingerprint technologies from HTTP response.
 * @param {{headers: object, body: string}} response
 * @returns {string[]} detected technology names
 */
export function fingerprintTech(response = {}) {
  if (!response || typeof response !== 'object') return [];
  const headers = {};
  for (const [k, v] of Object.entries(response.headers || {})) {
    headers[k.toLowerCase()] = String(v);
  }
  const body = String(response.body || '');
  const found = [];
  for (const sig of TECH_SIGNATURES) {
    let matched = false;
    for (const [hk, pattern] of Object.entries(sig.headers || {})) {
      if (headers[hk] && pattern.test(headers[hk])) {
        matched = true;
        break;
      }
    }
    if (!matched) {
      for (const pattern of sig.body || []) {
        if (pattern.test(body)) {
          matched = true;
          break;
        }
      }
    }
    if (matched) found.push(sig.name);
  }
  return [...new Set(found)];
}

/**
 * Generate subdomain candidates for brute-force discovery.
 * @param {string} domain base domain
 * @param {string[]} [extra] additional wordlist entries
 */
export function subdomainCandidates(domain, extra = []) {
  const words = [...new Set([...COMMON_SUBDOMAINS, ...extra])];
  return words.map(w => `${w}.${domain}`);
}

/**
 * Score how "interesting" a discovered endpoint is for bug bounty.
 * Higher = more likely to yield findings.
 */
export function scoreEndpoint(path, statusCode, contentLength) {
  let score = 0;
  const p = path.toLowerCase();
  if (p.includes('.git') || p.includes('.env')) score += 100;
  if (p.includes('backup') || p.includes('.sql') || p.includes('.zip')) score += 80;
  if (p.includes('admin') || p.includes('phpinfo')) score += 60;
  if (p.includes('api') || p.includes('graphql') || p.includes('swagger')) score += 50;
  if (p.includes('robots.txt') || p.includes('sitemap')) score += 30;
  if (statusCode === 200 && contentLength > 0) score += 10;
  if (statusCode === 403) score += 20; // forbidden = exists, try harder
  return score;
}

export const ELITE_RECON = {
  fingerprintTech,
  subdomainCandidates,
  scoreEndpoint,
  INTERESTING_PATHS,
};

export default ELITE_RECON;
