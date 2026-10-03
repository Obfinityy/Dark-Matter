/**
 * Tool Registry — configurable metadata for every available security tool.
 * The AI agent selects tools from this registry rather than hardcoding sequences.
 * Tools can be added/removed without changing agent logic.
 *
 * OS SUPPORT:
 * - Kali Linux: all tools natively available — the primary/recommended OS.
 * - Windows / macOS: most binary tools (nmap, nuclei, etc.) are NOT installed.
 *   The agent falls back to `python` (custom scripts), Docker-pulled tool
 *   images, and pure-Python recon. TODO (future): auto-detect OS at startup
 *   and mark unavailable tools so the brain plans around them.
 */

const TOOL_DEFINITIONS = [
  // --- Passive Recon ---
  {
    name: 'crtsh',
    category: 'passive_recon',
    description: 'Certificate Transparency log lookup for subdomain discovery via crt.sh',
    inputType: 'hostname',
    outputFormat: 'json',
    riskLevel: 'none',
    requiresAuthorization: false,
    requiresKali: false,
    timeout: 30_000,
    parser: 'crtsh'
  },
  {
    name: 'subfinder',
    category: 'subdomain_enumeration',
    description: 'Fast passive subdomain enumeration using multiple sources',
    inputType: 'hostname',
    outputFormat: 'text',
    riskLevel: 'none',
    requiresAuthorization: false,
    requiresKali: true,
    timeout: 120_000,
    command: 'subfinder',
    defaultArgs: ['-silent'],
    parser: 'lines'
  },
  {
    name: 'amass-passive',
    category: 'subdomain_enumeration',
    description: 'OWASP Amass passive enumeration for comprehensive subdomain discovery',
    inputType: 'hostname',
    outputFormat: 'text',
    riskLevel: 'none',
    requiresAuthorization: false,
    requiresKali: true,
    timeout: 300_000,
    command: 'amass',
    defaultArgs: ['enum', '-passive'],
    parser: 'lines'
  },
  {
    name: 'assetfinder',
    category: 'subdomain_enumeration',
    description: 'Find related domains and subdomains using passive sources',
    inputType: 'hostname',
    outputFormat: 'text',
    riskLevel: 'none',
    requiresAuthorization: false,
    requiresKali: true,
    timeout: 60_000,
    command: 'assetfinder',
    defaultArgs: ['--subs-only'],
    parser: 'lines'
  },

  // --- DNS ---
  {
    name: 'dnsx',
    category: 'dns_enumeration',
    description: 'Fast DNS resolution and probing',
    inputType: 'subdomain_list',
    outputFormat: 'json',
    riskLevel: 'low',
    requiresAuthorization: true,
    requiresKali: true,
    timeout: 120_000,
    command: 'dnsx',
    defaultArgs: ['-silent', '-json', '-a', '-aaaa', '-cname', '-mx', '-ns'],
    parser: 'jsonlines'
  },

  // --- HTTP Probing ---
  {
    name: 'httpx',
    category: 'http_discovery',
    description: 'Fast HTTP probing for live hosts, status codes, titles, technologies',
    inputType: 'subdomain_list',
    outputFormat: 'json',
    riskLevel: 'low',
    requiresAuthorization: true,
    requiresKali: true,
    timeout: 180_000,
    command: 'httpx',
    defaultArgs: ['-silent', '-json', '-status-code', '-title', '-tech-detect', '-follow-redirects'],
    parser: 'jsonlines'
  },

  // --- Technology Detection ---
  {
    name: 'whatweb',
    category: 'technology_detection',
    description: 'Web technology fingerprinting',
    inputType: 'url',
    outputFormat: 'json',
    riskLevel: 'low',
    requiresAuthorization: true,
    requiresKali: true,
    timeout: 60_000,
    command: 'whatweb',
    defaultArgs: ['--aggression=1', '--log-json=-'],
    parser: 'json'
  },

  // --- Content Discovery ---
  {
    name: 'ffuf',
    category: 'content_discovery',
    description: 'Fast web fuzzer for directory and file discovery',
    inputType: 'url',
    outputFormat: 'json',
    riskLevel: 'medium',
    requiresAuthorization: true,
    requiresKali: true,
    timeout: 300_000,
    command: 'ffuf',
    defaultArgs: ['-mc', '200,301,302,307,401,403', '-json', '-s'],
    parser: 'json'
  },
  {
    name: 'gobuster',
    category: 'content_discovery',
    description: 'Directory/file brute-forcing',
    inputType: 'url',
    outputFormat: 'text',
    riskLevel: 'medium',
    requiresAuthorization: true,
    requiresKali: true,
    timeout: 300_000,
    command: 'gobuster',
    defaultArgs: ['dir', '--no-error', '-q'],
    parser: 'lines'
  },

  // --- Port Scanning ---
  {
    name: 'naabu',
    category: 'active_recon',
    description: 'Fast port scanner for discovering open ports',
    inputType: 'hostname',
    outputFormat: 'text',
    riskLevel: 'medium',
    requiresAuthorization: true,
    requiresKali: true,
    timeout: 180_000,
    command: 'naabu',
    defaultArgs: ['-silent', '-json'],
    parser: 'jsonlines'
  },
  {
    name: 'nmap',
    category: 'active_recon',
    description: 'Network mapper for host discovery and service detection',
    inputType: 'hostname',
    outputFormat: 'xml',
    riskLevel: 'medium',
    requiresAuthorization: true,
    requiresKali: true,
    timeout: 600_000,
    command: 'nmap',
    defaultArgs: ['-sV', '-sC', '-oX', '-'],
    parser: 'nmap_xml'
  },

  // --- Web Crawling ---
  {
    name: 'katana',
    category: 'endpoint_discovery',
    description: 'Next-gen crawling framework for endpoint and URL discovery',
    inputType: 'url',
    outputFormat: 'text',
    riskLevel: 'low',
    requiresAuthorization: true,
    requiresKali: true,
    timeout: 180_000,
    command: 'katana',
    defaultArgs: ['-silent', '-json', '-depth', '3'],
    parser: 'jsonlines'
  },

  // --- JavaScript Analysis ---
  {
    name: 'linkfinder',
    category: 'javascript_analysis',
    description: 'Extract endpoints from JavaScript files',
    inputType: 'url',
    outputFormat: 'text',
    riskLevel: 'none',
    requiresAuthorization: true,
    requiresKali: true,
    timeout: 60_000,
    command: 'linkfinder',
    defaultArgs: ['-o', 'cli'],
    parser: 'lines'
  },

  // --- Vulnerability Scanning ---
  {
    name: 'nuclei',
    category: 'vulnerability_detection',
    description: 'Template-based vulnerability scanner',
    inputType: 'url_list',
    outputFormat: 'json',
    riskLevel: 'medium',
    requiresAuthorization: true,
    requiresKali: true,
    timeout: 600_000,
    command: 'nuclei',
    defaultArgs: ['-silent', '-json', '-severity', 'info,low,medium,high,critical'],
    parser: 'jsonlines'
  },
  {
    name: 'nikto',
    category: 'vulnerability_detection',
    description: 'Web server scanner for dangerous files and configuration issues',
    inputType: 'url',
    outputFormat: 'text',
    riskLevel: 'medium',
    requiresAuthorization: true,
    requiresKali: true,
    timeout: 300_000,
    command: 'nikto',
    defaultArgs: ['-Format', 'json', '-output', '-'],
    parser: 'json'
  },

  // --- Parameter Discovery ---
  {
    name: 'arjun',
    category: 'parameter_discovery',
    description: 'HTTP parameter discovery suite',
    inputType: 'url',
    outputFormat: 'json',
    riskLevel: 'medium',
    requiresAuthorization: true,
    requiresKali: true,
    timeout: 120_000,
    command: 'arjun',
    defaultArgs: ['--json'],
    parser: 'json'
  },
  {
    name: 'paramspider',
    category: 'parameter_discovery',
    description: 'Mine parameters from web archives',
    inputType: 'hostname',
    outputFormat: 'text',
    riskLevel: 'none',
    requiresAuthorization: false,
    requiresKali: true,
    timeout: 120_000,
    command: 'paramspider',
    defaultArgs: [],
    parser: 'lines'
  },

  // --- URL Discovery ---
  {
    name: 'gau',
    category: 'endpoint_discovery',
    description: 'Fetch known URLs from AlienVault, Wayback Machine, Common Crawl',
    inputType: 'hostname',
    outputFormat: 'text',
    riskLevel: 'none',
    requiresAuthorization: false,
    requiresKali: true,
    timeout: 120_000,
    command: 'gau',
    defaultArgs: [],
    parser: 'lines'
  },
  {
    name: 'waybackurls',
    category: 'endpoint_discovery',
    description: 'Fetch URLs from Wayback Machine for a target domain',
    inputType: 'hostname',
    outputFormat: 'text',
    riskLevel: 'none',
    requiresAuthorization: false,
    requiresKali: true,
    timeout: 120_000,
    command: 'waybackurls',
    defaultArgs: [],
    parser: 'lines'
  },

  // --- WAF Detection ---
  {
    name: 'wafw00f',
    category: 'technology_detection',
    description: 'Web Application Firewall detection',
    inputType: 'url',
    outputFormat: 'json',
    riskLevel: 'low',
    requiresAuthorization: true,
    requiresKali: true,
    timeout: 60_000,
    command: 'wafw00f',
    defaultArgs: ['-o', '-', '-f', 'json'],
    parser: 'json'
  },

  // --- Subdomain Takeover ---
  {
    name: 'subzy',
    category: 'vulnerability_detection',
    description: 'Subdomain takeover detection',
    inputType: 'subdomain_list',
    outputFormat: 'json',
    riskLevel: 'low',
    requiresAuthorization: true,
    requiresKali: true,
    timeout: 120_000,
    command: 'subzy',
    defaultArgs: ['run', '--hide_fails'],
    parser: 'json'
  },

  // --- Certificate Analysis ---
  {
    name: 'sslscan',
    category: 'certificate_analysis',
    description: 'SSL/TLS configuration analysis',
    inputType: 'hostname',
    outputFormat: 'text',
    riskLevel: 'low',
    requiresAuthorization: true,
    requiresKali: true,
    timeout: 60_000,
    command: 'sslscan',
    defaultArgs: [],
    parser: 'generic'
  },

  // --- CORS ---
  {
    name: 'corscanner',
    category: 'vulnerability_detection',
    description: 'CORS misconfiguration scanner',
    inputType: 'url',
    outputFormat: 'json',
    riskLevel: 'low',
    requiresAuthorization: true,
    requiresKali: true,
    timeout: 60_000,
    command: 'cors',
    defaultArgs: [],
    parser: 'json'
  },

  // --- XSS ---
  {
    name: 'dalfox',
    category: 'vulnerability_detection',
    description: 'Powerful XSS scanning and parameter analysis',
    inputType: 'url',
    outputFormat: 'json',
    riskLevel: 'medium',
    requiresAuthorization: true,
    requiresKali: true,
    timeout: 300_000,
    command: 'dalfox',
    defaultArgs: ['url', '--silence', '--format', 'json'],
    parser: 'json'
  },

  // --- SQL Injection ---
  {
    name: 'sqlmap',
    category: 'vulnerability_detection',
    description: 'Automatic SQL injection detection and exploitation',
    inputType: 'url',
    outputFormat: 'text',
    riskLevel: 'high',
    requiresAuthorization: true,
    requiresKali: true,
    timeout: 600_000,
    command: 'sqlmap',
    defaultArgs: ['--batch', '--level=1', '--risk=1', '--random-agent'],
    parser: 'generic'
  },
  // --- Custom Scripting (the agent's own hands) ---
  // The agent writes Python to do what no pre-built tool can: custom payload
  // generation, response analysis, chaining observations into new hypotheses.
  // Runs on the USER's own machine (their backend, their terminal) — this is
  // local-first by design, not a sandbox. Scope policy still applies: the
  // script's network targets must be inside the authorized hunt scope.
  {
    name: 'python',
    category: 'custom_scripting',
    description: 'Run a custom Python 3 script on the user machine. Use for: custom payload crafting, response parsing, data correlation, proof-of-concept validation, anything no pre-built tool covers. Input is Python code; stdout/stderr are returned. Network access in the script must stay inside the authorized target scope.',
    inputType: 'code',
    outputFormat: 'text',
    riskLevel: 'medium',
    requiresAuthorization: true,
    requiresKali: false,
    timeout: 120_000,
    parser: 'generic'
  },
  // --- Built-in HTTP probes (no binaries, no Kali) ---
  // Real detection tools implemented in src/tools/builtin/httpProbes.js. They
  // run real HTTP against the authorized target and return normalized finding
  // candidates. The deterministic strategy brain uses them when no LLM is
  // reachable; LLM brains can also select them on hosts without Kali tooling.
  {
    name: 'web_probe',
    category: 'http_discovery',
    description: 'Fetch the target homepage: status, headers, tech hints, forms, links, query params, endpoints. Passive-ish recon that maps the attack surface.',
    inputType: 'url',
    outputFormat: 'json',
    riskLevel: 'low',
    requiresAuthorization: true,
    requiresKali: false,
    timeout: 30_000,
    parser: 'json'
  },
  {
    name: 'xss_probe',
    category: 'vulnerability_detection',
    description: 'Reflected XSS detection: injects unique script markers into discovered query params/forms and verifies unescaped reflection. Real HTTP, safe markers.',
    inputType: 'url',
    outputFormat: 'json',
    riskLevel: 'medium',
    requiresAuthorization: true,
    requiresKali: false,
    timeout: 60_000,
    parser: 'json'
  },
  {
    name: 'sqli_probe',
    category: 'vulnerability_detection',
    description: 'SQL injection detection: login auth-bypass (\' OR \'1\'=\'1), error-based quote probe, and boolean-blind probes on discovered id params. Real HTTP.',
    inputType: 'url',
    outputFormat: 'json',
    riskLevel: 'medium',
    requiresAuthorization: true,
    requiresKali: false,
    timeout: 60_000,
    parser: 'json'
  },
  {
    name: 'stored_xss_probe',
    category: 'vulnerability_detection',
    description: 'Stored XSS detection: persists a unique script marker via comment/guestbook endpoints and verifies it renders unescaped for later visitors. Real HTTP.',
    inputType: 'url',
    outputFormat: 'json',
    riskLevel: 'medium',
    requiresAuthorization: true,
    requiresKali: false,
    timeout: 60_000,
    parser: 'json'
  },
  {
    name: 'idor_probe',
    category: 'vulnerability_detection',
    description: 'IDOR detection: requests /resource/:id style endpoints for multiple ids without auth and diffs sensitive-field disclosure. Real HTTP.',
    inputType: 'url',
    outputFormat: 'json',
    riskLevel: 'medium',
    requiresAuthorization: true,
    requiresKali: false,
    timeout: 60_000,
    parser: 'json'
  },
  // --- Advanced vulnerability-class probes (src/tools/builtin/advProbes.js) ---
  // Same honesty contract as the probes above: real HTTP against the
  // authorized target, findings only on observed exploitable behavior.
  {
    name: 'jwt_attack_probe',
    category: 'vulnerability_detection',
    description: 'JWT attack detection: none-alg acceptance, weak HMAC secret brute-force (privilege-escalated re-sign), kid path-traversal error proof, jku header injection with callback proof. Needs a token (auto-acquired from the login endpoint or caller-supplied). Real HTTP.',
    inputType: 'url',
    outputFormat: 'json',
    riskLevel: 'medium',
    requiresAuthorization: true,
    requiresKali: false,
    timeout: 120_000,
    parser: 'json'
  },
  {
    name: 'ssti_probe',
    category: 'vulnerability_detection',
    description: 'SSTI detection: math-evaluation payloads (Jinja2/Twig {{ }}, FreeMarker ${ }/#{}, ERB <%= %>, Thymeleaf, Smarty) into discovered params/forms; finding only when the computed value returns without the raw payload. Real HTTP.',
    inputType: 'url',
    outputFormat: 'json',
    riskLevel: 'medium',
    requiresAuthorization: true,
    requiresKali: false,
    timeout: 60_000,
    parser: 'json'
  },
  {
    name: 'xxe_probe',
    category: 'vulnerability_detection',
    description: 'XXE detection: posts XML with external entities to XML endpoints; finding only on observed callback fetch (server resolved the entity), file:/// content disclosure, or explicit file-read errors. Real HTTP.',
    inputType: 'url',
    outputFormat: 'json',
    riskLevel: 'medium',
    requiresAuthorization: true,
    requiresKali: false,
    timeout: 90_000,
    parser: 'json'
  },
  {
    name: 'graphql_probe',
    category: 'vulnerability_detection',
    description: 'GraphQL probing: endpoint detection, introspection query, field-suggestion schema leak, query batching, GET-based queries. Findings grounded in actual GraphQL response shapes. Real HTTP.',
    inputType: 'url',
    outputFormat: 'json',
    riskLevel: 'medium',
    requiresAuthorization: true,
    requiresKali: false,
    timeout: 60_000,
    parser: 'json'
  },
  {
    name: 'websocket_probe',
    category: 'vulnerability_detection',
    description: 'WebSocket security: raw-socket upgrade handshakes testing missing Origin validation (CSWSH), forged cross-site Origin acceptance, and unauthenticated upgrades (when authToken supplied). Finding only on an actual 101. Real sockets.',
    inputType: 'url',
    outputFormat: 'json',
    riskLevel: 'medium',
    requiresAuthorization: true,
    requiresKali: false,
    timeout: 60_000,
    parser: 'json'
  },
  {
    name: 'race_condition_probe',
    category: 'vulnerability_detection',
    description: 'Race condition detection: fires N parallel state-changing requests (coupon/transfer endpoints) and checks the outcome against a caller-supplied expectation (maxSuccess/maxTotalDelta + optional stateCheck). Finding only when the limit is observably exceeded. Real HTTP.',
    inputType: 'url',
    outputFormat: 'json',
    riskLevel: 'high',
    requiresAuthorization: true,
    requiresKali: false,
    timeout: 120_000,
    parser: 'json'
  },
  {
    name: 'secrets_in_js_probe',
    category: 'vulnerability_detection',
    description: 'Secrets-in-JS: fetches same-origin JS bundles, scans for high-confidence secret patterns (AWS/Stripe/GitHub/Slack/Google keys, private key blocks, high-entropy key=value). Evidence is redacted. Real HTTP.',
    inputType: 'url',
    outputFormat: 'json',
    riskLevel: 'low',
    requiresAuthorization: true,
    requiresKali: false,
    timeout: 60_000,
    parser: 'json'
  }
];

/** Frozen lookup maps built at module load time. */
const byName = new Map(TOOL_DEFINITIONS.map(t => [t.name, Object.freeze({ ...t })]));
const byCategory = new Map();
for (const tool of TOOL_DEFINITIONS) {
  if (!byCategory.has(tool.category)) byCategory.set(tool.category, []);
  byCategory.get(tool.category).push(tool.name);
}

export const ToolRegistry = {
  /** List all registered tools (name + metadata). */
  list() {
    return [...byName.values()];
  },

  /** Get metadata for a single tool. */
  get(toolName) {
    return byName.get(toolName) || null;
  },

  /** List tool names in a category. */
  listByCategory(category) {
    return byCategory.get(category) || [];
  },

  /** List all categories. */
  categories() {
    return [...byCategory.keys()];
  },

  /** Check if a tool requires a Kali worker. */
  requiresKali(toolName) {
    return byName.get(toolName)?.requiresKali === true;
  },

  /** Check if a tool requires explicit target authorization. */
  requiresAuth(toolName) {
    return byName.get(toolName)?.requiresAuthorization === true;
  },

  /** Get risk level. */
  riskLevel(toolName) {
    return byName.get(toolName)?.riskLevel || 'unknown';
  }
};
