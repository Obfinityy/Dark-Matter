// Dark Matter hunt-intel — exploit-chain engine (technique #1).
//
// Research basis: JLF-Exploit-Chain-Suggester (GPL — technique extracted, not
// copied), axguard attack-graphs, and the capability-primitive pattern from
// agentic-VAPT practice. The core insight: HIGH bounties are manufactured by
// CHAINING medium findings into critical impact. This module is pure logic —
// it runs on findings the engine already collected, no new infra needed.
//
// Model:
//   - Every confirmed finding emits CAPABILITY primitives
//     (read, write, exec, ssrf, sqli, cred, idor, xss, auth_bypass, ...).
//   - CHAIN_EQUATIONS encode how primitive combinations escalate:
//       read + write        = RCE        (e.g. SQLi LOAD_FILE -> INTO OUTFILE)
//       ssrf + cloud_meta   = infra_compromise
//       xss_in_admin + session = session_hijack -> admin_rce
//   - findChains() BFS-searches the capability graph for escalations.
//   - planToGoal() reverse-plans from a high-impact goal to missing primitives,
//     telling the hunt what to look for next.

/** Finding class -> capability primitives it grants the attacker. */
export const CAPABILITY_MAP = {
  sqli: ['db_read', 'db_write'],
  sqli_blind: ['db_read'],
  sqli_error: ['db_read'],
  xss_stored: ['js_exec', 'session_theft'],
  xss_reflected: ['js_exec'],
  xss_dom: ['js_exec'],
  ssrf: ['ssrf', 'internal_recon'],
  ssrf_cloud_meta: ['ssrf', 'cloud_meta', 'cred_leak'],
  lfi: ['file_read'],
  rfi: ['file_read', 'code_exec'],
  rce: ['code_exec'],
  cmd_injection: ['code_exec'],
  idor: ['data_read', 'data_write'],
  bola: ['data_read', 'data_write'],
  auth_bypass: ['auth_bypass'],
  jwt_weak: ['auth_bypass', 'priv_esc'],
  priv_esc: ['priv_esc'],
  csrf: ['state_change'],
  open_redirect: ['phishing'],
  info_disclosure: ['info_leak'],
  cred_leak: ['cred_leak'],
  cred_stuffing: ['auth_bypass'],
  file_upload: ['file_write'],
  xxe: ['file_read', 'ssrf'],
  ssti: ['code_exec'],
  deserialization: ['code_exec'],
  nosql_injection: ['db_read', 'auth_bypass'],
  ldap_injection: ['auth_bypass', 'info_leak'],
  xpath_injection: ['info_leak'],
  header_injection: ['response_control'],
  cors_misconfig: ['data_read'],
  csrf_token_missing: ['state_change'],
  rate_limit_missing: ['bruteforce'],
  default_creds: ['auth_bypass', 'cred_leak'],
  exposed_admin: ['admin_access'],
  exposed_git: ['source_leak', 'cred_leak'],
  exposed_env: ['cred_leak', 'info_leak'],
  directory_listing: ['info_leak'],
  backup_file: ['source_leak', 'cred_leak'],
  verbose_errors: ['info_leak'],
  http_methods: ['method_abuse'],
  clickjacking: ['ui_redress'],
};

/**
 * Chain equations: [required capabilities] -> { impact, title, how }.
 * ~30 encoded escalation patterns from real bounty practice.
 */
export const CHAIN_EQUATIONS = [
  { needs: ['db_read', 'db_write'], impact: 'critical', title: 'SQLi read+write → RCE', how: 'LOAD_FILE to map the filesystem, then INTO OUTFILE / xp_cmdshell to write a webshell.' },
  { needs: ['ssrf', 'cloud_meta'], impact: 'critical', title: 'SSRF → cloud metadata → infra compromise', how: 'SSRF to 169.254.169.254 (or cloud equivalent) steals IAM credentials; pivot to the cloud account.' },
  { needs: ['js_exec', 'admin_access'], impact: 'critical', title: 'XSS in admin panel → admin session hijack', how: 'Stored XSS fires in the admin session; exfiltrate the session or drive admin actions via the victim browser.' },
  { needs: ['file_read', 'cred_leak'], impact: 'high', title: 'LFI + leaked creds → authenticated access', how: 'Read config/secret files via LFI, reuse the credentials for authenticated attack surface.' },
  { needs: ['auth_bypass', 'data_write'], impact: 'critical', title: 'Auth bypass + write primitive → full account takeover', how: 'Bypass authentication, then rewrite victim data (email/password) to seize accounts.' },
  { needs: ['idor', 'priv_esc'], impact: 'critical', title: 'IDOR + privilege escalation → admin data breach', how: 'Enumerate other users objects, then escalate the role to read admin-only data.' },
  { needs: ['file_write', 'code_exec'], impact: 'critical', title: 'Unrestricted upload → RCE', how: 'Upload a web-accessible script (extension/MIME bypass) and request it.' },
  { needs: ['xss_stored', 'csrf'], impact: 'high', title: 'Stored XSS + CSRF → forced admin actions', how: 'XSS payload issues state-changing requests in the victim session.' },
  { needs: ['ssrf', 'internal_recon'], impact: 'high', title: 'SSRF → internal network pivot', how: 'Port-scan the internal network through SSRF; attack admin interfaces unreachable externally.' },
  { needs: ['source_leak', 'cred_leak'], impact: 'high', title: 'Source/secret leak → credential reuse', how: 'Git/env/backup exposure yields API keys; test them against prod and third-party services.' },
  { needs: ['db_read', 'cred_leak'], impact: 'high', title: 'SQLi read → credential dump → lateral movement', how: 'Dump user tables, crack or replay hashes, reuse across services.' },
  { needs: ['auth_bypass', 'admin_access'], impact: 'critical', title: 'Auth bypass on admin surface → full compromise', how: 'Direct object/route access to admin functions without authentication.' },
  { needs: ['xxe', 'file_read'], impact: 'high', title: 'XXE → local file read', how: 'External entity to file:///etc/passwd or cloud metadata; exfiltrate via out-of-band channel.' },
  { needs: ['ssti', 'code_exec'], impact: 'critical', title: 'SSTI → RCE', how: 'Template injection to reach the object graph and execute system commands.' },
  { needs: ['deserialization', 'code_exec'], impact: 'critical', title: 'Insecure deserialization → RCE', how: 'Craft a gadget chain for the target framework; confirm with a sleep/DNS callback.' },
  { needs: ['open_redirect', 'phishing'], impact: 'medium', title: 'Open redirect → credential phishing', how: 'Trusted-domain redirect starts a phishing flow; chain with OAuth if present.' },
  { needs: ['cors_misconfig', 'data_read'], impact: 'high', title: 'CORS misconfig + authenticated data → cross-origin theft', how: 'Arbitrary-origin CORS with credentials lets any site read the victim API responses.' },
  { needs: ['jwt_weak', 'priv_esc'], impact: 'critical', title: 'JWT weakness → privilege escalation', how: 'alg:none / key-confusion / weak secret to forge admin tokens.' },
  { needs: ['nosql_injection', 'auth_bypass'], impact: 'high', title: 'NoSQL injection → authentication bypass', how: 'Operator injection ($ne/$gt) to bypass login checks.' },
  { needs: ['rate_limit_missing', 'bruteforce'], impact: 'medium', title: 'No rate limit → credential brute force', how: 'Enumerate users then password-spray the login or token endpoint.' },
  { needs: ['verbose_errors', 'sqli'], impact: 'high', title: 'Verbose errors accelerate SQLi', how: 'Database errors leak schema; convert blind SQLi to error/union-based.' },
  { needs: ['exposed_git', 'source_leak'], impact: 'high', title: '.git exposure → full source + secrets', how: 'Reconstruct the repository; hunt hardcoded keys and logic flaws offline.' },
  { needs: ['backup_file', 'source_leak'], impact: 'medium', title: 'Backup files → source disclosure', how: '.bak/.old/.swp variants of live files disclose code and config.' },
  { needs: ['header_injection', 'response_control'], impact: 'medium', title: 'Header injection → cache poisoning / XSS', how: 'Inject headers to poison caches or break out into response splitting.' },
  { needs: ['csrf_token_missing', 'state_change'], impact: 'medium', title: 'Missing CSRF token → forced state change', how: 'Cross-site request performs privileged actions in the victim session.' },
  { needs: ['clickjacking', 'state_change'], impact: 'medium', title: 'Clickjacking → privileged action', how: 'Frame the sensitive UI; trick the victim into clicking.' },
  { needs: ['http_methods', 'method_abuse'], impact: 'medium', title: 'Dangerous methods → access control bypass', how: 'PUT/DELETE/PATCH or method override to bypass verb-based ACLs.' },
  { needs: ['info_leak', 'phishing'], impact: 'low', title: 'Info disclosure aids targeted phishing', how: 'Internal names, emails, and stack details sharpen social-engineering.' },
  { needs: ['ldap_injection', 'auth_bypass'], impact: 'high', title: 'LDAP injection → authentication bypass', how: 'Wildcard/boolean injection against the directory bind.' },
  { needs: ['xpath_injection', 'info_leak'], impact: 'medium', title: 'XPath injection → data extraction', how: 'Boolean-based extraction of XML-stored data.' },
];

const IMPACT_RANK = { critical: 4, high: 3, medium: 2, low: 1 };

function findingClass(f) {
  return String(f.class || f.type || f.name || '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

function capabilitiesOf(finding) {
  const cls = findingClass(finding);
  // Direct map hit, else fuzzy: e.g. "sql_injection" ~ sqli.
  if (CAPABILITY_MAP[cls]) return CAPABILITY_MAP[cls];
  for (const [key, caps] of Object.entries(CAPABILITY_MAP)) {
    if (cls.includes(key) || key.includes(cls)) return caps;
  }
  return [];
}

/**
 * BFS over the capability graph: given findings, return viable exploit chains
 * ordered by impact (highest first). Each chain names the findings that feed it.
 */
export function findChains(findings) {
  const have = new Set();
  const byCap = new Map(); // capability -> findings granting it
  for (const f of findings || []) {
    for (const cap of capabilitiesOf(f)) {
      have.add(cap);
      if (!byCap.has(cap)) byCap.set(cap, []);
      byCap.get(cap).push(f);
    }
  }
  const chains = [];
  for (const eq of CHAIN_EQUATIONS) {
    if (eq.needs.every((c) => have.has(c))) {
      const used = new Map();
      for (const c of eq.needs) {
        for (const f of byCap.get(c) || []) used.set(findingId(f), f);
      }
      chains.push({
        title: eq.title,
        impact: eq.impact,
        how: eq.how,
        needs: eq.needs,
        findings: [...used.values()].map((f) => ({
          id: findingId(f),
          title: f.title || f.name || findingClass(f),
          class: findingClass(f),
        })),
      });
    }
  }
  chains.sort((a, b) => IMPACT_RANK[b.impact] - IMPACT_RANK[a.impact]);
  return chains;
}

/**
 * Goal-driven reverse planning: from a high-impact goal, report which
 * capabilities are already held and which primitives the hunt should pursue.
 */
export function planToGoal(findings, goal = 'rce') {
  const have = new Set();
  for (const f of findings || []) for (const c of capabilitiesOf(f)) have.add(c);
  const g = String(goal).toLowerCase();
  const relevant = CHAIN_EQUATIONS.filter(
    (eq) => eq.title.toLowerCase().includes(g) || eq.impact === 'critical'
  );
  return relevant.slice(0, 5).map((eq) => ({
    title: eq.title,
    impact: eq.impact,
    have: eq.needs.filter((c) => have.has(c)),
    missing: eq.needs.filter((c) => !have.has(c)),
    how: eq.how,
  }));
}

function findingId(f) {
  return String(f.id || f.findingId || `${findingClass(f)}@${f.url || f.target || 'unknown'}`);
}

// ---- Beam search chain exploration (secmcp technique, MIT) ------------------
// Instead of matching static chain equations, beam-search the capability
// graph: from held capabilities, expand possible next primitives, keep the
// top-k most promising paths, repeat. Finds chains the static list misses.

const PRIMITIVE_TRANSITIONS = {
  // from capability -> [{to, technique, likelihood}]
  info_leak: [
    { to: 'data_read', technique: 'error-based extraction', likelihood: 0.7 },
    { to: 'source_leak', technique: 'source-map / .git exposure', likelihood: 0.5 },
  ],
  data_read: [
    { to: 'auth_bypass', technique: 'IDOR on session objects', likelihood: 0.6 },
    { to: 'data_write', technique: 'mass assignment', likelihood: 0.5 },
  ],
  data_write: [
    { to: 'priv_esc', technique: 'role field tampering', likelihood: 0.6 },
    { to: 'js_exec', technique: 'stored XSS via profile fields', likelihood: 0.5 },
  ],
  file_read: [
    { to: 'code_exec', technique: 'log poisoning / LFI-to-RCE', likelihood: 0.4 },
    { to: 'cred_leak', technique: 'config file disclosure', likelihood: 0.7 },
  ],
  cred_leak: [
    { to: 'auth_bypass', technique: 'credential reuse', likelihood: 0.8 },
    { to: 'priv_esc', technique: 'privileged credential use', likelihood: 0.6 },
  ],
  ssrf: [
    { to: 'cloud_meta', technique: 'cloud metadata access', likelihood: 0.7 },
    { to: 'code_exec', technique: 'internal admin SSRF-to-RCE', likelihood: 0.3 },
  ],
  cloud_meta: [
    { to: 'priv_esc', technique: 'IAM credential theft', likelihood: 0.8 },
    { to: 'code_exec', technique: 'metadata-driven RCE', likelihood: 0.4 },
  ],
  auth_bypass: [
    { to: 'priv_esc', technique: 'forced browsing to admin', likelihood: 0.7 },
    { to: 'data_read', technique: 'horizontal access', likelihood: 0.8 },
  ],
  priv_esc: [
    { to: 'code_exec', technique: 'admin functionality abuse', likelihood: 0.5 },
    { to: 'db_write', technique: 'privileged write', likelihood: 0.6 },
  ],
  js_exec: [
    { to: 'session_theft', technique: 'cookie/token theft', likelihood: 0.8 },
    { to: 'auth_bypass', technique: 'session hijack', likelihood: 0.7 },
  ],
  session_theft: [
    { to: 'priv_esc', technique: 'hijack admin session', likelihood: 0.6 },
  ],
  file_write: [
    { to: 'code_exec', technique: 'webshell upload', likelihood: 0.7 },
  ],
};

const GOAL_CAPS = new Set(['code_exec', 'db_write', 'priv_esc', 'session_theft', 'cloud_meta']);

/**
 * Beam-search attack chains from held capabilities.
 * @param {string[]} heldCaps — capabilities already demonstrated
 * @param {{beamWidth?: number, maxDepth?: number}} opts
 * @returns {Array<{path: string[], techniques: string[], score: number, goal: boolean}>}
 */
export function beamSearchChains(heldCaps, opts = {}) {
  const beamWidth = opts.beamWidth || 4;
  const maxDepth = opts.maxDepth || 4;
  let beam = (heldCaps || []).map((c) => ({ path: [c], techniques: [], score: 1.0 }));
  const results = [];

  for (let depth = 0; depth < maxDepth; depth++) {
    const candidates = [];
    for (const node of beam) {
      const last = node.path[node.path.length - 1];
      const transitions = PRIMITIVE_TRANSITIONS[last] || [];
      for (const t of transitions) {
        if (node.path.includes(t.to)) continue; // no cycles
        const newPath = [...node.path, t.to];
        const newScore = node.score * t.likelihood;
        candidates.push({
          path: newPath,
          techniques: [...node.techniques, t.technique],
          score: newScore,
          goal: GOAL_CAPS.has(t.to),
        });
      }
    }
    if (!candidates.length) break;
    // Keep top-k by score; goals bubble up
    candidates.sort((a, b) => (b.goal - a.goal) || (b.score - a.score));
    const next = candidates.slice(0, beamWidth);
    for (const n of next) if (n.goal) results.push(n);
    beam = next;
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 10);
}

// ---- SSRF chain equations (SSRFmap technique, MIT) --------------------------
// SSRF-to-cloud-credential is the classic critical chain. Per-provider
// metadata modules; confirmation ladder: canary ping -> read-only metadata.

export const SSRF_CHAINS = [
  {
    title: 'SSRF param → AWS IMDS → credential harvest',
    needs: ['ssrf'],
    gives: ['cloud_meta', 'cred_leak'],
    impact: 'critical',
    how: 'Inject cloud metadata URL (169.254.169.254/latest/meta-data/iam/security-credentials/) into SSRF sink; harvest IAM creds.',
    confirm: ['canary_ping', 'metadata_read', 'credential_use'],
  },
  {
    title: 'SSRF param → GCE metadata → service account token',
    needs: ['ssrf'],
    gives: ['cloud_meta', 'cred_leak'],
    impact: 'critical',
    how: 'Inject metadata.google.internal with Metadata-Flavor: Google header; harvest service account token.',
    confirm: ['canary_ping', 'metadata_read', 'credential_use'],
  },
  {
    title: 'SSRF param → internal admin → RCE',
    needs: ['ssrf'],
    gives: ['code_exec'],
    impact: 'critical',
    how: 'Pivot SSRF to internal admin panels (169.254.x.x, 10.0.0.0/8, localhost); exploit internal RCE.',
    confirm: ['canary_ping', 'internal_reach', 'rce_proof'],
  },
  {
    title: 'SSRF param → S3 bucket → policy rewrite',
    needs: ['ssrf', 'cloud_meta'],
    gives: ['data_read', 'data_write'],
    impact: 'high',
    how: 'Use harvested creds to assess S3 permission matrix; WriteACP → policy rewrite → data exposure.',
    confirm: ['permission_matrix', 'policy_rewrite_test'],
  },
];

/** SSRF confirmation ladder: each rung must pass before the next. */
export const SSRF_CONFIRM_LADDER = [
  'canary_ping',      // collaborator URL proves outbound requests
  'metadata_read',    // read-only cloud metadata (no creds yet)
  'credential_use',   // creds work (read-only action)
  'impact_proof',     // demonstrates security impact
];

// ---- Producer→consumer inference (RESTler technique, MIT) -------------------
// Auto-infer dependencies: POST /users returns {id} → GET /users/{id}.
// Unlocks stateful multi-step chains no single-request scanner can find.

/**
 * Infer producer→consumer edges from observed API traffic.
 * @param {Array<{method, path, responseBody}>} observations
 * @returns {Array<{from, to, param, via}>}
 */
export function inferProducerConsumer(observations) {
  const edges = [];
  const producers = []; // {path, ids: [{field, value}]}
  const consumers = []; // {path, placeholders: [field]}

  for (const obs of observations || []) {
    const path = String(obs.path || '');
    // Producer: POST/PUT that returns an object with an id
    if (/^(POST|PUT)$/i.test(obs.method || '')) {
      try {
        const body = typeof obs.responseBody === 'string' ? JSON.parse(obs.responseBody) : obs.responseBody;
        const ids = extractIds(body);
        if (ids.length) producers.push({ path, ids });
      } catch { /* not JSON */ }
    }
    // Consumer: path with {placeholder} or :param
    const placeholders = [...path.matchAll(/[{:]([a-zA-Z_][a-zA-Z0-9_]*)/g)].map((m) => m[1]);
    if (placeholders.length) consumers.push({ path, placeholders, method: obs.method });
  }

  for (const prod of producers) {
    for (const cons of consumers) {
      for (const pid of prod.ids) {
        if (cons.placeholders.some((p) => p.toLowerCase().includes(pid.field.toLowerCase()) || pid.field.toLowerCase().includes(p.toLowerCase()))) {
          edges.push({ from: prod.path, to: cons.path, param: pid.field, via: `${prod.path} → ${cons.path}` });
        }
      }
    }
  }
  return edges;
}

function extractIds(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 3) return [];
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    if (/^(id|uuid|guid|_id)$/i.test(k) && (typeof v === 'string' || typeof v === 'number')) {
      out.push({ field: k, value: v });
    } else if (typeof v === 'object') {
      out.push(...extractIds(v, depth + 1));
    }
  }
  return out;
}
