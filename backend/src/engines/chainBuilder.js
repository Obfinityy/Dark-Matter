/**
 * chainBuilder.js — Vulnerability chaining engine.
 *
 * Elite hunters don't report single lows — they CHAIN them:
 *  - XSS + CSRF = account takeover
 *  - Open redirect + OAuth = token theft
 *  - IDOR + info leak = data breach
 *  - SSRF + cloud metadata = server compromise
 *
 * Takes individual findings and suggests high-impact chains.
 */

const CHAIN_RULES = [
  {
    name: 'Account Takeover via XSS + Session Handling',
    needs: ['Cross-Site Scripting', 'Session'],
    impact:
      'Full account takeover: XSS steals session tokens when session cookies lack HttpOnly/SameSite.',
    severity: 'Critical',
  },
  {
    name: 'OAuth Token Theft',
    needs: ['Open Redirect', 'OAuth'],
    impact: 'Attacker redirects OAuth flow to malicious site, stealing authorization codes/tokens.',
    severity: 'Critical',
  },
  {
    name: 'Data Breach via IDOR Chain',
    needs: ['IDOR', 'Sensitive'],
    impact: 'Sequential IDOR across multiple endpoints enables mass data harvesting.',
    severity: 'High',
  },
  {
    name: 'Server Compromise via SSRF',
    needs: ['SSRF', 'Cloud'],
    impact: 'SSRF to cloud metadata service yields credentials → server/cloud compromise.',
    severity: 'Critical',
  },
  {
    name: 'Privilege Escalation Chain',
    needs: ['IDOR', 'Admin'],
    impact: 'IDOR on admin endpoints allows privilege escalation to administrator.',
    severity: 'High',
  },
  // ── Expanded chain library (impact escalation patterns) ──────────────
  {
    name: 'Stored XSS Worm via Profile + Feed',
    needs: ['Stored XSS', 'IDOR'],
    impact:
      'Stored XSS in a profile field renders in other users feeds; combined with IDOR the payload spreads across accounts like a worm.',
    severity: 'Critical',
  },
  {
    name: 'CSRF + XSS = Silent Account Takeover',
    needs: ['CSRF', 'Cross-Site Scripting'],
    impact:
      'CSRF changes the victim email/password; XSS then maintains persistence. Full silent takeover.',
    severity: 'Critical',
  },
  {
    name: 'Password Reset Poisoning Chain',
    needs: ['Host Header', 'Password Reset'],
    impact:
      'Poisoned Host header makes the reset link point to attacker domain → reset token theft → account takeover.',
    severity: 'Critical',
  },
  {
    name: 'Subdomain Takeover + Cookie Scope = Session Hijack',
    needs: ['Subdomain Takeover', 'Cookie'],
    impact:
      'Takeover of a subdomain covered by a parent-domain cookie scope lets attacker read session cookies.',
    severity: 'High',
  },
  {
    name: 'CORS Misconfig + XSS = Cross-Origin Data Theft',
    needs: ['CORS', 'Cross-Site Scripting'],
    impact:
      'Overly permissive CORS plus XSS lets attacker exfiltrate authenticated API responses cross-origin.',
    severity: 'High',
  },
  {
    name: 'SQLi + File Read = Source & Secret Extraction',
    needs: ['SQL Injection', 'File'],
    impact:
      'SQL injection with file-read primitives (LOAD_FILE) extracts source code and secrets from the server.',
    severity: 'Critical',
  },
  {
    name: 'XXE + SSRF = Internal Network Pivot',
    needs: ['XXE', 'SSRF'],
    impact:
      'XXE reads internal files; SSRF pivots to internal services. Combined: full internal network access.',
    severity: 'Critical',
  },
  {
    name: 'Race Condition + Coupon = Unlimited Credit',
    needs: ['Race Condition', 'Coupon'],
    impact:
      'Parallel redemption of a single-use coupon before the counter updates yields unlimited credit.',
    severity: 'High',
  },
  {
    name: 'IDOR + Mass Assignment = Privilege Escalation',
    needs: ['IDOR', 'Mass Assignment'],
    impact:
      'IDOR to another user object plus mass-assignment of the role field escalates to admin.',
    severity: 'Critical',
  },
  {
    name: 'JWT None-Alg + IDOR = Any-Account Access',
    needs: ['JWT', 'IDOR'],
    impact:
      'Forged JWT (alg=none) combined with IDOR on user endpoints gives access to any account.',
    severity: 'Critical',
  },
  {
    name: 'Open Redirect + OAuth = Authorization Code Theft',
    needs: ['Open Redirect', 'Authorization'],
    impact:
      'Redirect manipulation in the OAuth callback leaks authorization codes to the attacker.',
    severity: 'High',
  },
  {
    name: 'Clickjacking + Sensitive Action = Forced State Change',
    needs: ['Clickjacking', 'CSRF'],
    impact:
      'Clickjacking frames a sensitive action (email change, transfer) that CSRF protection missed.',
    severity: 'Medium',
  },
  {
    name: 'Information Disclosure + Brute Force = Credential Stuffing',
    needs: ['Information Disclosure', 'Brute'],
    impact: 'Username enumeration via disclosure enables targeted credential-stuffing attacks.',
    severity: 'High',
  },
  {
    name: 'GraphQL Introspection + IDOR = Schema-Wide Data Leak',
    needs: ['GraphQL', 'IDOR'],
    impact:
      'Exposed introspection reveals the full schema; BOLA on object types leaks data across the API.',
    severity: 'High',
  },
  {
    name: 'WebSocket Hijack + CSRF = Real-Time Impersonation',
    needs: ['WebSocket', 'CSRF'],
    impact:
      'CSWSH (no origin check) lets attacker open an authenticated socket as the victim and act in real time.',
    severity: 'High',
  },
  {
    name: 'SSRF + Redis = Remote Code Execution',
    needs: ['SSRF', 'Redis'],
    impact:
      'SSRF to internal Redis with gopher/DICT protocol abuse can write cron jobs or modules → RCE.',
    severity: 'Critical',
  },
  {
    name: 'Template Injection + SSTI = Server-Side RCE',
    needs: ['Template Injection', 'RCE'],
    impact:
      'Server-side template injection escalates from reflected output to full server command execution.',
    severity: 'Critical',
  },
  {
    name: 'File Upload + Path Traversal = Web Shell',
    needs: ['File Upload', 'Path Traversal'],
    impact:
      'Unrestricted upload combined with traversal writes a web shell outside the upload directory.',
    severity: 'Critical',
  },
  {
    name: 'LDAP Injection + Auth Bypass = Directory Takeover',
    needs: ['LDAP Injection', 'Authentication'],
    impact: 'LDAP filter injection bypasses login; wildcard filters dump directory entries.',
    severity: 'High',
  },
  {
    name: 'HTTP Request Smuggling + Cache Poison = Mass XSS',
    needs: ['Request Smuggling', 'Cache'],
    impact: 'Smuggled requests poison the CDN cache, serving attacker content to all visitors.',
    severity: 'Critical',
  },
  {
    name: 'MFA Bypass + Credential Leak = Full Compromise',
    needs: ['MFA', 'Information Disclosure'],
    impact:
      'MFA bypass (e.g., response manipulation) plus leaked credentials gives full account access.',
    severity: 'Critical',
  },
  {
    name: 'API Rate Limit Absence + IDOR = Mass Enumeration',
    needs: ['Rate Limit', 'IDOR'],
    impact: 'No rate limiting on an IDOR endpoint allows automated harvesting of all user records.',
    severity: 'High',
  },
  {
    name: 'S3 Bucket + API Key Leak = Supply-Chain Risk',
    needs: ['S3', 'API Key'],
    impact: 'Public bucket containing leaked keys lets attacker impersonate backend services.',
    severity: 'High',
  },
  {
    name: 'Prototype Pollution + XSS = Client-Side RCE-ish',
    needs: ['Prototype Pollution', 'Cross-Site Scripting'],
    impact:
      'Polluted prototypes alter client logic; chained with XSS the attacker controls app behavior.',
    severity: 'High',
  },
  {
    name: 'DOM Clobbering + XSS = Trusted-Types Bypass',
    needs: ['DOM Clobbering', 'Cross-Site Scripting'],
    impact: 'Clobbered DOM globals bypass sanitizers, turning a filtered sink into working XSS.',
    severity: 'Medium',
  },
  {
    name: 'OAuth Scope Confusion + IDOR = Cross-Tenant Access',
    needs: ['OAuth', 'IDOR'],
    impact:
      'Over-broad OAuth scopes plus object-level flaws let one tenant read another tenant data.',
    severity: 'Critical',
  },
  {
    name: 'Session Fixation + XSS = Persistent Hijack',
    needs: ['Session Fixation', 'Cross-Site Scripting'],
    impact: 'Fixed session ID plus XSS keeps the attacker session alive across password changes.',
    severity: 'High',
  },
  {
    name: 'Email Verification Bypass + IDOR = Any-Email Takeover',
    needs: ['Email', 'IDOR'],
    impact:
      'Skipped email verification plus IDOR on the email-change endpoint takes over any account.',
    severity: 'Critical',
  },
  {
    name: 'Payment Tampering + Race = Free Purchases',
    needs: ['Payment', 'Race Condition'],
    impact:
      'Client-side price tampering confirmed server-side by a race between charge and fulfillment.',
    severity: 'Critical',
  },
  {
    name: 'Webhook SSRF + Secret Leak = Pipeline Compromise',
    needs: ['Webhook', 'SSRF'],
    impact:
      'Attacker-controlled webhook URL triggers SSRF; leaked signing secret lets attacker forge events.',
    severity: 'High',
  },
  {
    name: 'SAML Signature Bypass + IDOR = SSO Impersonation',
    needs: ['SAML', 'IDOR'],
    impact:
      'Signature-wrapping bypass forges assertions; IDOR then accesses victim data as the forged user.',
    severity: 'Critical',
  },
  {
    name: 'CSV Injection + Admin Export = Admin Session Theft',
    needs: ['CSV Injection', 'Admin'],
    impact:
      'Formula injection in exported CSV executes when an admin opens it, stealing the admin session.',
    severity: 'High',
  },
  {
    name: 'Host Header + Password Reset = Org-Wide Takeover',
    needs: ['Host Header', 'IDOR'],
    impact:
      'Poisoned reset links sent to enumerated users via IDOR-user-listing take over many accounts.',
    severity: 'Critical',
  },
  {
    name: 'Cache Deception + Auth Token = Token Leak',
    needs: ['Cache', 'Token'],
    impact:
      'Web-cache deception stores an authenticated response publicly, leaking the victim token.',
    severity: 'High',
  },
  {
    name: 'PostMessage XSS + OAuth = Token Exfiltration',
    needs: ['PostMessage', 'OAuth'],
    impact: 'Insecure postMessage handler leaks OAuth tokens to any origin listening on the page.',
    severity: 'High',
  },
  {
    name: 'Deserialization + File Write = RCE',
    needs: ['Deserialization', 'File'],
    impact: 'Insecure deserialization gadgets combined with a file-write sink drop a web shell.',
    severity: 'Critical',
  },
  {
    name: 'Blind SQLi + Out-of-Band = Full DB Dump',
    needs: ['SQL Injection', 'DNS'],
    impact: 'Blind SQLi exfiltrates via DNS/OOB channel when the response shows nothing.',
    severity: 'High',
  },
  {
    name: '2FA Brute Force + No Lockout = MFA Bypass',
    needs: ['Brute', 'MFA'],
    impact: 'Missing rate limits on the OTP endpoint allow brute-forcing the 6-digit code.',
    severity: 'Critical',
  },
  {
    name: 'Referral Abuse + IDOR = Fake Account Army',
    needs: ['Referral', 'IDOR'],
    impact: 'Self-referral plus IDOR on referral records fabricates unlimited referral bonuses.',
    severity: 'Medium',
  },
  {
    name: 'GraphQL Batching + Brute Force = Credential Spray',
    needs: ['GraphQL', 'Brute'],
    impact:
      'Batched GraphQL mutations bypass per-request limits for high-speed credential spraying.',
    severity: 'High',
  },
  {
    name: 'CORS Wildcard + API Key = Key Theft at Scale',
    needs: ['CORS', 'API Key'],
    impact: 'Wildcard CORS on an endpoint returning keys lets any site harvest them from visitors.',
    severity: 'High',
  },
];

/**
 * Alias map: finding-type synonyms that should match the same chain need.
 * E.g. a finding typed "Reflected XSS" satisfies a need for "Cross-Site Scripting".
 */
const NEED_ALIASES = {
  'cross-site scripting': ['xss', 'cross-site scripting', 'cross site scripting'],
  'stored xss': ['stored xss', 'stored-xss', 'persistent xss'],
  'sql injection': ['sql injection', 'sqli', 'sql-injection'],
  idor: ['idor', 'insecure direct object reference', 'bola'],
  csrf: ['csrf', 'cross-site request forgery', 'xsrf'],
  ssrf: ['ssrf', 'server-side request forgery'],
  'open redirect': ['open redirect', 'open-redirect', 'unvalidated redirect'],
  session: ['session', 'cookie', 'httponly', 'samesite'],
  oauth: ['oauth', 'oidc', 'openid'],
  jwt: ['jwt', 'json web token', 'jws'],
  saml: ['saml'],
  mfa: ['mfa', '2fa', 'two-factor', 'multi-factor'],
  brute: ['brute', 'brute-force', 'bruteforce', 'enumeration', 'username enumeration'],
  'race condition': ['race condition', 'race-condition', 'concurrency', 'toctou'],
  graphql: ['graphql', 'gql'],
  cors: ['cors', 'cross-origin'],
  xxe: ['xxe', 'xml external entity'],
  ssti: ['ssti', 'template injection', 'server-side template'],
  rce: ['rce', 'remote code execution', 'command injection', 'command execution'],
  'file upload': ['file upload', 'unrestricted upload'],
  'path traversal': ['path traversal', 'directory traversal', 'lfi', 'local file inclusion'],
  deserialization: ['deserialization', 'insecure deserialization'],
  'mass assignment': ['mass assignment', 'mass-assignment', 'auto-binding'],
  clickjacking: ['clickjacking', 'ui redressing', 'frame'],
  'host header': ['host header', 'host-header', 'host injection'],
  'password reset': ['password reset', 'forgot password', 'reset token'],
  'information disclosure': [
    'information disclosure',
    'info disclosure',
    'sensitive',
    'sensitive data',
    'data exposure',
  ],
  'api key': ['api key', 'apikey', 'secret', 'token leak'],
  s3: ['s3', 'bucket', 'aws', 'cloud storage'],
  cloud: ['cloud', 'metadata', 'instance metadata', '169.254'],
  redis: ['redis'],
  dns: ['dns', 'oob', 'out-of-band', 'exfiltration'],
  cache: ['cache', 'cdn', 'cache poisoning', 'cache deception'],
  websocket: ['websocket', 'ws', 'cswsh'],
  webhook: ['webhook'],
  referral: ['referral', 'refer-a-friend'],
  coupon: ['coupon', 'promo', 'discount code', 'voucher'],
  payment: ['payment', 'price', 'pricing', 'checkout', 'billing'],
  email: ['email', 'mail'],
  admin: ['admin', 'administrator', 'privilege', 'role'],
  token: ['token', 'auth token', 'bearer'],
  authorization: ['authorization', 'authz', 'access control'],
  authentication: ['authentication', 'authn', 'login'],
  file: ['file', 'file read', 'file write', 'lfi', 'rfi'],
  'request smuggling': ['request smuggling', 'smuggling', 'desync', 'cl.te', 'te.cl'],
  'prototype pollution': ['prototype pollution', 'proto pollution'],
  'dom clobbering': ['dom clobbering', 'clobbering'],
  postmessage: ['postmessage', 'post-message'],
  'csv injection': ['csv injection', 'formula injection'],
  'ldap injection': ['ldap injection', 'ldap'],
};

function needMatches(need, finding) {
  const aliases = NEED_ALIASES[need.toLowerCase()] || [need.toLowerCase()];
  const haystack = [
    String(finding.type || ''),
    String(finding.title || ''),
    String(finding.url || ''),
    String(finding.category || ''),
    typeof finding.evidence === 'string'
      ? finding.evidence
      : JSON.stringify(finding.evidence || ''),
  ]
    .join(' ')
    .toLowerCase();
  return aliases.some(a => haystack.includes(a));
}

/**
 * Given findings, suggest chains. Returns [{ name, impact, severity, findings[] }].
 */
export function findChains(findings = []) {
  const chains = [];

  for (const rule of CHAIN_RULES) {
    const matched = [];
    let allFound = true;
    for (const need of rule.needs) {
      const hit = findings.find(f => needMatches(need, f));
      if (hit) matched.push(hit);
      else {
        allFound = false;
        break;
      }
    }
    if (allFound && matched.length === rule.needs.length) {
      chains.push({
        name: rule.name,
        impact: rule.impact,
        severity: rule.severity,
        type: 'Vulnerability Chain',
        confidence: 'medium',
        cwe: 'CWE-693', // Protection Mechanism Failure (chain)
        findings: matched.map(f => f.type),
        evidence: `Chain of ${matched.length} findings: ${matched.map(f => f.type).join(' + ')}`,
      });
    }
  }
  return chains;
}

export const CHAIN_BUILDER = { findChains, CHAIN_RULES };
export default CHAIN_BUILDER;
