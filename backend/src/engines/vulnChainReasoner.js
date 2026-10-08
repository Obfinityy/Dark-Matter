/**
 * vulnChainReasoner.js — Vulnerability chaining REASONING engine.
 *
 * Where chainService.js suggests 2-finding pairs and chainBuilder.js keeps a
 * curated keyword rule list, this module REASONS over findings like an elite
 * hunter does:
 *
 *  - Normalizes messy finding titles/categories to canonical vulnerability
 *    classes (alias-tolerant: "Stored XSS", "xss", "cross-site scripting" all
 *    become `xss`).
 *  - Runs a capability-graph search: each rule consumes vulnerability
 *    classes (or capabilities earned from earlier hops) and produces new
 *    capabilities or terminal impact outcomes (account-takeover, rce, …).
 *    This finds MULTI-HOP chains (3–4 links) that pair-matching can never see,
 *    e.g. info-disclosure → auth-bypass → IDOR → mass data exfiltration.
 *  - Scores every chain (severity escalation × confidence × hop realism) and
 *    ranks them, emitting an ordered attack narrative with explicit
 *    assumptions (user interaction needed? authenticated session?).
 *  - Chains stay scoped to one asset/target — cross-target "chains" are
 *    noise, not findings.
 *
 * Pure functions, no I/O. Feed it confirmed findings; get ranked chains.
 */

const SEVERITY_RANK = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };
const RANK_SEVERITY = ['info', 'low', 'medium', 'high', 'critical'];

// ── Canonical vulnerability classes + alias table ──────────────────────────
// Each canonical class lists every spelling a detector, the brain, or a human
// might use. Matching is substring-based on the normalized haystack.
const CLASS_ALIASES = {
  xss: [
    'xss',
    'cross-site scripting',
    'cross site scripting',
    'stored xss',
    'reflected xss',
    'dom xss',
    'dom-based xss',
  ],
  csrf: ['csrf', 'cross-site request forgery', 'xsrf'],
  idor: ['idor', 'insecure direct object reference', 'bola', 'broken object level authorization'],
  sqli: ['sqli', 'sql injection', 'sql-injection', 'blind sqli'],
  ssrf: ['ssrf', 'server-side request forgery', 'server side request forgery'],
  'open-redirect': ['open redirect', 'open-redirect', 'unvalidated redirect', 'open redirection'],
  xxe: ['xxe', 'xml external entity'],
  lfi: ['lfi', 'local file inclusion', 'path traversal', 'directory traversal', 'file inclusion'],
  rce: [
    'rce',
    'remote code execution',
    'os command injection',
    'command injection',
    'code execution',
  ],
  ssti: ['ssti', 'server-side template injection', 'template injection'],
  'auth-bypass': ['auth bypass', 'authentication bypass', 'broken authentication', 'login bypass'],
  'info-disclosure': [
    'info disclosure',
    'information disclosure',
    'sensitive data exposure',
    'data exposure',
    'verbose error',
    'stack trace',
    'debug info',
  ],
  'session-weakness': [
    'session fixation',
    'weak session',
    'insecure session',
    'session management',
    'missing httponly',
    'httponly',
  ],
  'jwt-weakness': ['jwt', 'jwt none', 'alg=none', 'weak jwt', 'none algorithm'],
  'cors-misconfig': ['cors misconfiguration', 'cors', 'wildcard cors', 'permissive cors'],
  clickjacking: ['clickjacking', 'ui redressing', 'missing x-frame-options', 'frame-options'],
  'rate-limit': [
    'rate limit',
    'rate-limit',
    'missing rate limiting',
    'no rate limit',
    'brute force',
  ],
  'subdomain-takeover': ['subdomain takeover', 'dangling dns', 'dangling cname'],
  'oauth-weakness': ['oauth misconfiguration', 'oauth flow', 'oauth'],
  'mfa-bypass': ['mfa bypass', '2fa bypass', 'multi-factor bypass', 'mfa'],
  'mass-assignment': ['mass assignment', 'mass-assignment', 'auto-binding', 'parameter binding'],
  'host-header': ['host header', 'host header injection', 'host header poisoning'],
  'password-reset': ['password reset', 'reset poisoning', 'reset token'],
  'api-key-leak': [
    'api key',
    'api-key',
    'secret leak',
    'exposed secret',
    'hardcoded secret',
    'hardcoded credential',
    'leaked credential',
  ],
  'graphql-introspection': ['graphql introspection', 'graphql'],
  'websocket-hijack': ['websocket hijacking', 'cswsh', 'cross-site websocket', 'websocket'],
  'cache-poison': ['cache poisoning', 'web cache poisoning'],
  'request-smuggling': ['request smuggling', 'http request smuggling', 'desync'],
  'file-upload': ['file upload', 'unrestricted upload', 'unrestricted file upload'],
  'prototype-pollution': ['prototype pollution'],
  'dom-clobbering': ['dom clobbering'],
  'email-verify-bypass': ['email verification bypass', 'email verification', 'email verify'],
  'payment-tamper': ['payment tampering', 'price tampering', 'price manipulation'],
  'race-condition': ['race condition', 'toctou', 'race-condition'],
  'broken-access-control': [
    'broken access control',
    'missing function level access control',
    'vertical privilege',
    'privilege escalation',
    'forced browsing',
  ],
  's3-exposure': ['s3', 's3 bucket', 'open bucket', 'public bucket'],
  'redis-exposure': ['redis', 'internal redis'],
  'cloud-metadata': ['cloud metadata', 'metadata service', 'instance metadata'],
};

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Map a finding to its canonical vulnerability class.
 * Uses title + category + evidence keywords; returns null when nothing matches.
 */
export function classifyFinding(finding = {}) {
  const haystack = [
    finding.title,
    finding.category,
    finding.type,
    finding.name,
    finding.vulnType,
    Array.isArray(finding.tags) ? finding.tags.join(' ') : '',
    finding.evidence ? String(finding.evidence).slice(0, 500) : '',
  ]
    .map(normalizeText)
    .join(' | ');
  if (!haystack.trim()) return null;

  let best = null;
  let bestScore = 0;
  for (const [canonical, aliases] of Object.entries(CLASS_ALIASES)) {
    for (const alias of aliases) {
      const a = normalizeText(alias);
      if (!a) continue;
      // Longer, more specific aliases win ties (e.g. "stored xss" > "xss").
      if (haystack.includes(a) && a.length > bestScore) {
        best = canonical;
        bestScore = a.length;
      }
    }
  }
  return best;
}

function assetOf(finding) {
  return (
    finding.target ||
    finding.endpoint ||
    finding.host ||
    (finding.metadata && finding.metadata.asset) ||
    'target'
  );
}

function findingConfidence(finding) {
  if (typeof finding.confidence === 'number') {
    return Math.min(1, Math.max(0, finding.confidence));
  }
  // Fallback: confirmed findings with evidence are trusted more.
  const base = { confirmed: 0.85, validated: 0.9, verified: 0.9 }[
    String(finding.status || '').toLowerCase()
  ];
  if (base) return base;
  return finding.evidence ? 0.6 : 0.45;
}

// ── Chain graph: capability transitions ────────────────────────────────────
// Each rule consumes vulnerability classes (or capabilities produced by an
// earlier hop) and yields a new capability or a terminal impact outcome.
// `needs` lists assumptions the hunter must satisfy for the hop to work.
const CHAIN_GRAPH = [
  {
    id: 'xss-session-theft',
    name: 'XSS → session token theft',
    requires: ['xss', 'session-weakness'],
    provides: 'stolen-session',
    impact:
      'Attacker script runs in the victim browser and reads the session cookie (missing HttpOnly / weak flags).',
    severity: 'high',
    needsUserInteraction: true,
    steps: [
      'Deliver the XSS payload to a victim (phishing link, comment, profile field).',
      'When the victim views it, the injected script reads document.cookie — the session token is exposed because session flags are weak.',
      'Exfiltrate the token to the attacker-controlled collector.',
    ],
  },
  {
    id: 'stolen-session-ato',
    name: 'Stolen session → full account takeover',
    requires: ['stolen-session'],
    provides: 'account-takeover',
    impact: 'Session replay gives the attacker the victim account with no password needed.',
    severity: 'critical',
    needsUserInteraction: false,
    steps: [
      'Replay the stolen session token against authenticated endpoints.',
      'Verify access to account settings / private data — takeover confirmed.',
    ],
  },
  {
    id: 'xss-csrf-silent-ato',
    name: 'XSS + missing CSRF protection → silent account takeover',
    requires: ['xss', 'csrf'],
    provides: 'account-takeover',
    impact:
      'CSRF changes the victim email/password while XSS keeps a persistent backdoor — silent, full takeover.',
    severity: 'critical',
    needsUserInteraction: true,
    steps: [
      'Use XSS to run actions in the victim session.',
      'Forge a cross-site request to the email/password-change endpoint (no CSRF token enforced).',
      'Victim is locked out; attacker owns the account. XSS payload maintains persistence.',
    ],
  },
  {
    id: 'openredirect-oauth-theft',
    name: 'Open redirect + OAuth weakness → authorization code theft',
    requires: ['open-redirect', 'oauth-weakness'],
    provides: 'account-takeover',
    impact:
      'OAuth authorization code leaks to the attacker domain → token exchange → account takeover.',
    severity: 'critical',
    needsUserInteraction: true,
    steps: [
      'Craft the OAuth authorize URL with redirect_uri pointing at the open-redirect sink.',
      'Victim authorizes; the code is delivered to the attacker-controlled host.',
      'Exchange the code for an access token and take over the linked account.',
    ],
  },
  {
    id: 'hostheader-reset-poison',
    name: 'Host-header injection + password reset → reset token theft',
    requires: ['host-header', 'password-reset'],
    provides: 'account-takeover',
    impact:
      'Poisoned Host header makes the reset email link point at the attacker → token theft → takeover.',
    severity: 'critical',
    needsUserInteraction: true,
    steps: [
      'Request a password reset for the victim account with a poisoned Host header.',
      'The reset email embeds the attacker domain in the link.',
      'Victim clicks; the reset token lands on the attacker server. Use it to set a new password.',
    ],
  },
  {
    id: 'emailverify-idor-ato',
    name: 'Email-verification bypass + IDOR → any-account takeover',
    requires: ['email-verify-bypass', 'idor'],
    provides: 'account-takeover',
    impact:
      'Change the account email to an attacker address via IDOR, skip verification, reset the password.',
    severity: 'critical',
    needsUserInteraction: false,
    steps: [
      'Call the email-change endpoint with another user object id (IDOR).',
      'Verification is skipped or trivially bypassed — the account email is now attacker-controlled.',
      'Trigger password reset to the new address and take over the account.',
    ],
  },
  {
    id: 'jwt-idor-any-account',
    name: 'Weak JWT + IDOR → any-account access',
    requires: ['jwt-weakness', 'idor'],
    provides: 'account-takeover',
    impact: 'Forge tokens (alg=none / weak secret) and walk user ids through IDOR endpoints.',
    severity: 'critical',
    needsUserInteraction: false,
    steps: [
      'Forge a JWT for an arbitrary user id (none algorithm or cracked secret).',
      'Present it to IDOR-vulnerable endpoints to read/modify any account.',
    ],
  },
  {
    id: 'mfa-bypass-creds',
    name: 'MFA bypass + leaked credentials → full compromise',
    requires: ['mfa-bypass', 'api-key-leak'],
    provides: 'account-takeover',
    impact:
      'Leaked credentials plus an MFA bypass (response manipulation / missing step) = full login.',
    severity: 'critical',
    needsUserInteraction: false,
    steps: [
      'Log in with the leaked credentials.',
      'Bypass the second factor (tamper the verify response / skip the step).',
      'Authenticated as the victim.',
    ],
  },
  {
    id: 'info-userenum',
    name: 'Information disclosure → username / object enumeration',
    requires: ['info-disclosure'],
    provides: 'enumerated-targets',
    impact:
      'Verbose errors or data exposure reveal valid usernames, ids, or internal paths to aim the next hop at.',
    severity: 'medium',
    needsUserInteraction: false,
    steps: [
      'Harvest the disclosed identifiers (usernames, ids, internal paths).',
      'Feed them as targets into the next attack hop.',
    ],
  },
  {
    id: 'enum-authbypass',
    name: 'Enumerated targets + auth bypass → authenticated foothold',
    requires: ['enumerated-targets', 'auth-bypass'],
    provides: 'authenticated-foothold',
    impact: 'Bypass login for an enumerated account — the attacker is now inside.',
    severity: 'high',
    needsUserInteraction: false,
    steps: [
      'Replay the auth-bypass primitive against an enumerated account.',
      'Confirm an authenticated session — foothold established.',
    ],
  },
  {
    id: 'foothold-idor-exfil',
    name: 'Authenticated foothold + IDOR → mass data exfiltration',
    requires: ['authenticated-foothold', 'idor'],
    provides: 'data-exfiltration',
    impact: 'Walk object ids across every IDOR endpoint and harvest the full dataset.',
    severity: 'critical',
    needsUserInteraction: false,
    steps: [
      'Enumerate IDOR-vulnerable endpoints from the authenticated session.',
      'Iterate object ids (sequential / harvested) and download each record.',
      'Aggregate into a complete dataset — mass exfiltration.',
    ],
  },
  {
    id: 'idor-direct-exfil',
    name: 'IDOR + information disclosure → targeted data breach',
    requires: ['idor', 'info-disclosure'],
    provides: 'data-exfiltration',
    impact:
      'IDOR gives the handle, disclosure gives the map — targeted extraction of other users records.',
    severity: 'high',
    needsUserInteraction: false,
    steps: [
      'Use the disclosed structure to learn valid object id ranges.',
      'Request other users objects through the IDOR endpoint.',
    ],
  },
  {
    id: 'idor-ratelimit-mass',
    name: 'IDOR + missing rate limiting → automated mass harvesting',
    requires: ['idor', 'rate-limit'],
    provides: 'data-exfiltration',
    impact:
      'No throttling on an IDOR endpoint turns a manual flaw into an automated harvest of all records.',
    severity: 'critical',
    needsUserInteraction: false,
    steps: [
      'Script requests across the id space — nothing slows the loop down.',
      'Drain the endpoint until the dataset is complete.',
    ],
  },
  {
    id: 'sqli-authbypass',
    name: 'SQLi → authentication bypass',
    requires: ['sqli'],
    provides: 'authenticated-foothold',
    impact:
      "Classic `' OR '1'='1` style bypass (or UNION-based) logs the attacker in as an arbitrary user.",
    severity: 'high',
    needsUserInteraction: false,
    steps: [
      'Inject into the login query to bypass the password check.',
      'Confirm the authenticated session.',
    ],
  },
  {
    id: 'sqli-fileread',
    name: 'SQLi → file read → source and secret extraction',
    requires: ['sqli', 'lfi'],
    provides: 'data-exfiltration',
    impact:
      'LOAD_FILE / INTO OUTFILE style primitives pull source code, configs, and secrets off the server.',
    severity: 'critical',
    needsUserInteraction: false,
    steps: [
      'Confirm stacked/file-read primitives through the injection point.',
      'Read application source, .env, and key files.',
      'Pivot with the extracted secrets (DB creds, API keys).',
    ],
  },
  {
    id: 'ssti-rce',
    name: 'SSTI → server-side remote code execution',
    requires: ['ssti'],
    provides: 'rce',
    impact: 'Template injection escapes the sandbox to full OS command execution.',
    severity: 'critical',
    needsUserInteraction: false,
    steps: [
      'Confirm template evaluation with a math/payload probe.',
      'Escalate to OS command execution via template engine primitives.',
    ],
  },
  {
    id: 'lfi-rce-upload',
    name: 'File upload + path traversal → web shell (RCE)',
    requires: ['file-upload', 'lfi'],
    provides: 'rce',
    impact:
      'Traversal writes the uploaded payload outside the upload dir — a web shell on the server.',
    severity: 'critical',
    needsUserInteraction: false,
    steps: [
      'Upload a benign file with a traversal filename (../../shell.php).',
      'Locate it outside the upload directory and request it — code execution.',
    ],
  },
  {
    id: 'ssrf-metadata',
    name: 'SSRF → cloud metadata → credential theft',
    requires: ['ssrf', 'cloud-metadata'],
    provides: 'cloud-credentials',
    impact: 'The metadata service hands over IAM credentials — cloud account compromise follows.',
    severity: 'critical',
    needsUserInteraction: false,
    steps: [
      'Point the SSRF at the cloud metadata endpoint (169.254.169.254 / metadata.google.internal).',
      'Extract temporary IAM credentials from the response.',
    ],
  },
  {
    id: 'ssrf-redis-rce',
    name: 'SSRF → internal Redis → remote code execution',
    requires: ['ssrf', 'redis-exposure'],
    provides: 'rce',
    impact: 'Gopher/DICT protocol smuggling writes cron jobs or modules into Redis → RCE.',
    severity: 'critical',
    needsUserInteraction: false,
    steps: [
      'Smuggle Redis protocol commands through the SSRF (gopher:// or dict://).',
      'Write a malicious module path or cron entry; trigger execution.',
    ],
  },
  {
    id: 'ssrf-internal-pivot',
    name: 'SSRF + information disclosure → internal network pivot',
    requires: ['ssrf', 'info-disclosure'],
    provides: 'internal-pivot',
    impact:
      'SSRF reaches internal services; disclosed banners/paths map the network for the next hop.',
    severity: 'high',
    needsUserInteraction: false,
    steps: [
      'Probe RFC1918 ranges through the SSRF and fingerprint internal services.',
      'Use disclosed version info to pick the next exploit.',
    ],
  },
  {
    id: 'xxe-ssrf-pivot',
    name: 'XXE + SSRF → internal file read and service pivot',
    requires: ['xxe', 'ssrf'],
    provides: 'internal-pivot',
    impact: 'XXE reads internal files; SSRF reaches internal services — full internal access.',
    severity: 'critical',
    needsUserInteraction: false,
    steps: [
      'Use XXE external entities to read internal files (/etc/passwd, configs).',
      'Pivot SSRF into the internal services discovered.',
    ],
  },
  {
    id: 'cors-xss-exfil',
    name: 'Permissive CORS + XSS → cross-origin data theft',
    requires: ['cors-misconfig', 'xss'],
    provides: 'data-exfiltration',
    impact:
      'Wildcard CORS with credentials plus XSS lets the attacker read authenticated API responses cross-origin.',
    severity: 'high',
    needsUserInteraction: true,
    steps: [
      'Victim visits the XSS payload page.',
      'Script issues credentialed fetch() calls to the API — permissive CORS allows reading the responses.',
      'Exfiltrate the data.',
    ],
  },
  {
    id: 'clickjack-csrf',
    name: 'Clickjacking + CSRF → forced sensitive action',
    requires: ['clickjacking', 'csrf'],
    provides: 'account-takeover',
    impact: 'Framed UI tricks the victim into firing an unprotected state-changing request.',
    severity: 'medium',
    needsUserInteraction: true,
    steps: [
      'Frame the sensitive action page invisibly under attacker UI.',
      'Victim click fires the CSRF request — email change, transfer, etc.',
    ],
  },
  {
    id: 'subdomain-cookie-hijack',
    name: 'Subdomain takeover + session weakness → session hijack',
    requires: ['subdomain-takeover', 'session-weakness'],
    provides: 'account-takeover',
    impact:
      'Taken-over subdomain sits inside the parent cookie scope — session cookies flow to the attacker.',
    severity: 'high',
    needsUserInteraction: true,
    steps: [
      'Claim the dangling subdomain.',
      'Lure the victim to the subdomain; parent-scoped session cookies are sent to attacker infrastructure.',
      'Replay sessions for account takeover.',
    ],
  },
  {
    id: 'idor-massassign-escalation',
    name: 'IDOR + mass assignment → privilege escalation',
    requires: ['idor', 'mass-assignment'],
    provides: 'privilege-escalation',
    impact: 'Update another user object and bind the role field — attacker becomes admin.',
    severity: 'critical',
    needsUserInteraction: false,
    steps: [
      'Send an update for another user object through the IDOR endpoint.',
      'Include role=admin (or equivalent) in the bound parameters.',
      'Confirm elevated privileges.',
    ],
  },
  {
    id: 'privilege-idor-exfil',
    name: 'Privilege escalation + IDOR → full data exfiltration',
    requires: ['privilege-escalation', 'idor'],
    provides: 'data-exfiltration',
    impact: 'Admin context removes per-object guards — every record becomes readable.',
    severity: 'critical',
    needsUserInteraction: false,
    steps: [
      'Use the escalated session to enumerate all object ids.',
      'Harvest every record through the IDOR endpoints.',
    ],
  },
  {
    id: 'brokenaccess-idor-admin',
    name: 'Broken access control + IDOR → admin function abuse',
    requires: ['broken-access-control', 'idor'],
    provides: 'privilege-escalation',
    impact:
      'Missing function-level checks let a low-priv user call admin endpoints on arbitrary objects.',
    severity: 'high',
    needsUserInteraction: false,
    steps: [
      'Replay admin API calls from a low-privilege session.',
      'Target arbitrary object ids to act on other users data.',
    ],
  },
  {
    id: 'smuggle-cache-xss',
    name: 'Request smuggling + cache poisoning → mass XSS',
    requires: ['request-smuggling', 'cache-poison'],
    provides: 'account-takeover',
    impact: 'Smuggled responses poison the CDN cache — every visitor gets the attacker payload.',
    severity: 'critical',
    needsUserInteraction: false,
    steps: [
      'Desync the front-end/back-end connection to inject a malicious response.',
      'Get it cached under a popular URL; every visitor executes the payload.',
    ],
  },
  {
    id: 'graphql-idor-leak',
    name: 'GraphQL introspection + IDOR → schema-wide data leak',
    requires: ['graphql-introspection', 'idor'],
    provides: 'data-exfiltration',
    impact: 'Full schema from introspection plus object-level flaws — query any type for any user.',
    severity: 'high',
    needsUserInteraction: false,
    steps: [
      'Dump the schema via introspection; map object types and id fields.',
      'Issue BOLA queries across types to harvest data.',
    ],
  },
  {
    id: 'websocket-csrf-impersonation',
    name: 'WebSocket hijack + CSRF → real-time impersonation',
    requires: ['websocket-hijack', 'csrf'],
    provides: 'account-takeover',
    impact:
      'Cross-site WebSocket hijacking opens an authenticated socket as the victim — act in real time.',
    severity: 'high',
    needsUserInteraction: true,
    steps: [
      'Victim visits the attacker page; script opens a WebSocket to the target (no origin check).',
      'The socket carries the victim session — send privileged messages live.',
    ],
  },
  {
    id: 's3-key-supplychain',
    name: 'Exposed S3 bucket + leaked API key → supply-chain / service impersonation',
    requires: ['s3-exposure', 'api-key-leak'],
    provides: 'data-exfiltration',
    impact:
      'Public bucket contents plus leaked keys let the attacker impersonate backend services.',
    severity: 'high',
    needsUserInteraction: false,
    steps: [
      'List and download the exposed bucket.',
      'Use the leaked keys to call internal/service APIs as the backend.',
    ],
  },
  {
    id: 'proto-xss-clientrce',
    name: 'Prototype pollution + XSS → client-side takeover',
    requires: ['prototype-pollution', 'xss'],
    provides: 'account-takeover',
    impact:
      'Polluted prototypes subvert client logic; XSS delivers the payload — full client compromise.',
    severity: 'high',
    needsUserInteraction: true,
    steps: [
      'Pollute Object.prototype to alter security checks or config.',
      'Deliver XSS that abuses the polluted behavior to run privileged actions.',
    ],
  },
  {
    id: 'race-payment-free',
    name: 'Payment tampering + race condition → free purchases',
    requires: ['payment-tamper', 'race-condition'],
    provides: 'data-exfiltration',
    impact: 'Client-side price tampering confirmed by a charge/fulfillment race — goods for free.',
    severity: 'critical',
    needsUserInteraction: false,
    steps: [
      'Tamper the price client-side and fire parallel checkout requests.',
      'Win the race between charge capture and fulfillment.',
    ],
  },
];

const OUTCOME_LABELS = {
  'account-takeover': 'Account takeover',
  'data-exfiltration': 'Data exfiltration',
  rce: 'Remote code execution',
  'privilege-escalation': 'Privilege escalation',
  'internal-pivot': 'Internal network pivot',
};

function isOutcome(token) {
  return Object.prototype.hasOwnProperty.call(OUTCOME_LABELS, token);
}

function severityOf(finding) {
  return String(finding.severity || 'low').toLowerCase();
}

/**
 * Reason over a set of findings and return ranked multi-hop attack chains.
 *
 * @param {Array} findings - finding objects ({id,title,category,severity,status,target,confidence,evidence})
 * @param {Object} [opts] - { maxHops: 4, minConfidence: 0, maxChains: 25 }
 * @returns {Array} chains, highest score first. Each chain:
 *   { id, name, outcome, severity, confidence, score, hops, steps[],
 *     findings[], assumptions[], impact, remediation }
 */
export function reasonChains(findings = [], opts = {}) {
  const maxHops = opts.maxHops || 4;
  const maxChains = opts.maxChains || 25;
  const minConfidence = opts.minConfidence || 0;

  // Index findings by canonical class, grouped per asset.
  const byAsset = new Map();
  for (const f of findings || []) {
    const cls = classifyFinding(f);
    if (!cls) continue;
    const asset = assetOf(f);
    if (!byAsset.has(asset)) byAsset.set(asset, new Map());
    const classMap = byAsset.get(asset);
    if (!classMap.has(cls)) classMap.set(cls, []);
    classMap.get(cls).push(f);
  }

  const chains = [];
  const seenSignatures = new Set();

  for (const [asset, classMap] of byAsset) {
    const available = new Set(classMap.keys());
    // BFS over rule applications. State: { facts:Set, applied:[ruleIds], depth }
    const queue = [{ facts: new Set(available), applied: [], depth: 0 }];

    while (queue.length) {
      const state = queue.shift();
      for (const rule of CHAIN_GRAPH) {
        if (state.applied.includes(rule.id)) continue;
        if (state.depth >= maxHops) continue;
        const satisfied = rule.requires.every(r => state.facts.has(r));
        if (!satisfied) continue;

        const applied = [...state.applied, rule.id];
        const signature = `${asset}::${applied.slice().sort().join('+')}`;
        if (seenSignatures.has(signature)) continue;
        seenSignatures.add(signature);

        const nextFacts = new Set(state.facts);
        nextFacts.add(rule.provides);

        if (isOutcome(rule.provides)) {
          const chain = buildChain(asset, classMap, applied, opts);
          if (chain && chain.confidence >= minConfidence) chains.push(chain);
        } else {
          queue.push({ facts: nextFacts, applied, depth: state.depth + 1 });
        }
      }
    }
  }

  chains.sort((a, b) => b.score - a.score || b.confidence - a.confidence);
  return chains.slice(0, maxChains);
}

function buildChain(asset, classMap, appliedRuleIds, opts) {
  const rules = appliedRuleIds.map(id => CHAIN_GRAPH.find(r => r.id === id));
  const terminal = rules[rules.length - 1];

  // Collect the concrete findings backing every consumed vulnerability class.
  const usedFindings = [];
  const usedFindingIds = new Set();
  const consumedClasses = new Set();
  for (const rule of rules) {
    for (const req of rule.requires) {
      if (isOutcome(req)) continue;
      if (CLASS_ALIASES[req]) {
        // A base vulnerability class — must come from a real finding.
        consumedClasses.add(req);
      }
    }
  }
  for (const cls of consumedClasses) {
    const candidates = classMap.get(cls) || [];
    // Prefer the highest-confidence finding per class.
    const best = candidates.slice().sort((a, b) => findingConfidence(b) - findingConfidence(a))[0];
    if (!best) return null; // Should not happen, but never invent a link.
    if (!usedFindingIds.has(best.id)) {
      usedFindingIds.add(best.id);
      usedFindings.push(best);
    }
  }
  if (!usedFindings.length) return null;

  // Confidence: geometric mean of link confidences, discounted per hop —
  // longer chains are real but less certain, like a human would judge.
  const linkConf = usedFindings.map(findingConfidence);
  const geoMean = Math.pow(
    linkConf.reduce((acc, c) => acc * c, 1),
    1 / linkConf.length
  );
  const hopDiscount = Math.pow(0.92, rules.length - 1);
  const confidence = Math.round(geoMean * hopDiscount * 100) / 100;

  // Severity escalation: the chain is at least the terminal severity, and
  // escalates one step when it combines ≥2 distinct base classes.
  const terminalRank = SEVERITY_RANK[terminal.severity] ?? 2;
  const escalationBonus = consumedClasses.size >= 2 ? 1 : 0;
  const severity =
    RANK_SEVERITY[
      Math.min(
        4,
        terminalRank +
          (terminalRank < 4 ? 0 : 0) +
          (escalationBonus && terminalRank < 3 ? escalationBonus : 0)
      )
    ];

  const steps = [];
  rules.forEach((rule, i) => {
    steps.push(`Hop ${i + 1} — ${rule.name}:`);
    rule.steps.forEach(s => steps.push(`  • ${s}`));
  });

  const assumptions = [];
  if (rules.some(r => r.needsUserInteraction)) {
    assumptions.push(
      'Requires victim interaction (victim must click/visit a crafted link or page).'
    );
  }
  if (usedFindings.some(f => String(f.status || '').toLowerCase() !== 'confirmed')) {
    assumptions.push(
      'One or more links are not yet confirmed — validate each finding before relying on the chain.'
    );
  }

  const chainSeverityRank = SEVERITY_RANK[severity] ?? 2;
  const maxInputRank = Math.max(...usedFindings.map(f => SEVERITY_RANK[severityOf(f)] ?? 0));
  const escalation = Math.max(0, chainSeverityRank - maxInputRank);
  const score =
    Math.round((chainSeverityRank * 10 + escalation * 6 + confidence * 8 - rules.length) * 100) /
    100;

  const hopNames = rules.map(r => r.name).join(' → ');
  return {
    id: `chain-${terminal.id}`,
    name: terminal.name,
    outcome: terminal.provides,
    outcomeLabel: OUTCOME_LABELS[terminal.provides] || terminal.provides,
    severity,
    confidence,
    score,
    hops: rules.length,
    hopNames,
    asset,
    steps,
    findings: usedFindings.map(f => ({
      id: f.id,
      title: f.title || f.category,
      category: f.category,
      severity: severityOf(f),
      class: classifyFinding(f),
    })),
    assumptions,
    impact: terminal.impact,
    remediation:
      'Break any single link to kill this chain — but remediate every linked finding: ' +
      usedFindings.map(f => `"${f.title || f.category}"`).join(', ') +
      '.',
  };
}

/**
 * One-paragraph human-readable explanation of a chain, for reports and chat.
 */
export function explainChain(chain) {
  if (!chain) return '';
  const hopList = chain.findings.map(f => `"${f.title}" (${f.severity})`).join(' + ');
  const assume = chain.assumptions.length ? ` Assumptions: ${chain.assumptions.join(' ')}` : '';
  return (
    `${chain.name} on ${chain.asset}: chaining ${hopList} yields ` +
    `${chain.outcomeLabel} — rated ${String(chain.severity).toUpperCase()} ` +
    `(confidence ${(chain.confidence * 100).toFixed(0)}%). ${chain.impact}${assume}`
  );
}

export const VULN_CHAIN_REASONER = {
  reasonChains,
  explainChain,
  classifyFinding,
  CHAIN_GRAPH,
  CLASS_ALIASES,
  OUTCOME_LABELS,
};

export default VULN_CHAIN_REASONER;
