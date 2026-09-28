/**
 * Tool Registry — configurable metadata for every available security tool.
 * The AI agent selects tools from this registry rather than hardcoding sequences.
 * Tools can be added/removed without changing agent logic.
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
    rateLimit: { maxPerMinute: 5 },
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
