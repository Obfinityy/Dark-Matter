/**
 * kaliToolRegistry.js — Kali Linux tool catalog for the hacking brain
 * (overnight mission ③).
 *
 * An elite human hunter doesn't guess flags — they know their toolbox.
 * This module is that knowledge, encoded: every entry is a REAL Kali tool
 * with safe default arguments, the stage it belongs to, when a human would
 * reach for it, and which flags are NEVER allowed in autonomous runs.
 *
 * Safety model:
 *  - Commands are built as argv arrays (no shell), and targets are
 *    validated — shell metacharacters are rejected outright.
 *  - `safeArgs` are non-destructive by design: no DoS timing, no exploit
 *    modules, no brute-force by default, `--batch` everywhere interactive.
 *  - `dangerousFlags` documents what autonomous runs must never add
 *    (e.g. sqlmap --os-shell, hydra password attacks without opt-in).
 *  - `suggestTools()` ranks tools for a hunt stage + tech hints, the way a
 *    human picks the next tool — so the hacker brain chooses like an expert.
 */

// Target must be a bare host, host:port, or http(s) URL — never shell text.
const TARGET_RE = /^(https?:\/\/)?[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?(\/[a-z0-9._~:/?#[\]@!$&'()*+,;=-]*)?$/i;

function assertSafeTarget(target) {
  const t = String(target || '').trim();
  if (!t || t.length > 2048 || !TARGET_RE.test(t) || /[;&|`$(){}<>\\]/.test(t)) {
    throw new Error(`Refusing to build a command for unsafe target: ${String(target).slice(0, 80)}`);
  }
  return t;
}

function hostOf(target) {
  return String(target).replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
}

export const KALI_TOOLS = [
  {
    name: 'nmap',
    category: 'recon',
    description: 'Port scanner and service fingerprinter — the first tool a human runs.',
    safeArgs: (target) => ['-sV', '--top-ports', '100', '-T4', '--open', '-oN', '-', hostOf(target)],
    dangerousFlags: ['-A --script vuln with intrusive scripts', '--script exploit', '-sU --top-ports 65535 (DoS-ish timing)'],
    whenToUse: 'Start of recon: find open ports and service versions before anything else.',
    requiresRoot: false,
    outputHint: 'Parse open ports + service/version lines.',
  },
  {
    name: 'subfinder',
    category: 'recon',
    description: 'Passive subdomain enumeration via public sources.',
    safeArgs: (target) => ['-d', hostOf(target), '-silent'],
    dangerousFlags: [],
    whenToUse: 'Target is a domain and you need its subdomains, passively.',
    requiresRoot: false,
    outputHint: 'One subdomain per line.',
  },
  {
    name: 'amass',
    category: 'recon',
    description: 'Deep subdomain enumeration (passive + active). Slower than subfinder, more thorough.',
    safeArgs: (target) => ['enum', '-passive', '-d', hostOf(target)],
    dangerousFlags: ['active bruteforcing without -passive on scope-limited targets'],
    whenToUse: 'Subfinder came up thin — go deeper on subdomains.',
    requiresRoot: false,
    outputHint: 'Subdomains with discovered-by source.',
  },
  {
    name: 'dnsx',
    category: 'recon',
    description: 'Fast DNS toolkit: resolve, bruteforce subdomains, grab records.',
    safeArgs: (target) => ['-d', hostOf(target), '-silent', '-json'],
    dangerousFlags: [],
    whenToUse: 'Validate which subdomains actually resolve; grab A/CNAME/TXT records.',
    requiresRoot: false,
    outputHint: 'JSON per resolved host.',
  },
  {
    name: 'httpx',
    category: 'recon',
    description: 'Probe hosts for live HTTP(S) services, titles, tech fingerprints.',
    safeArgs: (target) => ['-u', target, '-silent', '-json', '-td', '-timeout', '10', '-retries', '1'],
    dangerousFlags: [],
    whenToUse: 'After subdomain/port recon — find what actually serves HTTP and what tech it runs.',
    requiresRoot: false,
    outputHint: 'JSON with url, title, tech[], status-code.',
  },
  {
    name: 'whatweb',
    category: 'recon',
    description: 'Website fingerprinter: CMS, JS libs, headers, cookies.',
    safeArgs: (target) => ['--no-errors', '-a', '3', target],
    dangerousFlags: ['-a 4 (aggressive plugins can be intrusive)'],
    whenToUse: 'Need the tech stack of one web target fast (WordPress? Laravel? jQuery version?).',
    requiresRoot: false,
    outputHint: 'Plugin hits with versions.',
  },
  {
    name: 'theHarvester',
    category: 'recon',
    description: 'OSINT: emails, names, subdomains, IPs from public sources.',
    safeArgs: (target) => ['-d', hostOf(target), '-b', 'all', '-l', '100'],
    dangerousFlags: [],
    whenToUse: 'Early recon for phishing-adjacent intel: employee emails, extra hosts.',
    requiresRoot: false,
    outputHint: 'Emails, hosts, IPs grouped by source.',
  },
  {
    name: 'gobuster',
    category: 'discovery',
    description: 'Fast directory/DNS/vhost brute-forcer. Human default for content discovery.',
    safeArgs: (target) => ['dir', '-u', target, '-w', '/usr/share/wordlists/dirb/common.txt', '-t', '20', '-q', '--no-error'],
    dangerousFlags: ['huge wordlists (raft-large) without scope approval — noisy'],
    whenToUse: 'Web target mapped — discover hidden paths, admin panels, backups.',
    requiresRoot: false,
    outputHint: 'Status + size per found path.',
  },
  {
    name: 'ffuf',
    category: 'discovery',
    description: 'Fast web fuzzer: params, vhosts, directories with flexible filtering.',
    safeArgs: (target) => ['-u', `${target}/FUZZ`, '-w', '/usr/share/wordlists/dirb/common.txt', '-t', '20', '-mc', '200,301,302,403'],
    dangerousFlags: [],
    whenToUse: 'Gobuster found nothing or you need parameter/vhost fuzzing specifically.',
    requiresRoot: false,
    outputHint: 'Matched fuzz positions with status/size.',
  },
  {
    name: 'katana',
    category: 'discovery',
    description: 'Crawler that extracts endpoints, JS files, forms from live pages.',
    safeArgs: (target) => ['-u', target, '-silent', '-d', '3', '-jc', '-timeout', '10'],
    dangerousFlags: [],
    whenToUse: 'After httpx — crawl the app to map every endpoint and JS bundle.',
    requiresRoot: false,
    outputHint: 'Endpoints with method + source page.',
  },
  {
    name: 'nikto',
    category: 'vuln-scan',
    description: 'Web server scanner: outdated software, dangerous files, misconfigurations.',
    safeArgs: (target) => ['-h', target, '-Tuning', '1234567890abc', '-timeout', '10'],
    dangerousFlags: ['-Tuning x (adds XSS/SQLi payloads — noisy, needs approval)'],
    whenToUse: 'Web target fingerprinted — quick pass for low-hanging misconfigurations.',
    requiresRoot: false,
    outputHint: 'OSVDB-style findings with URIs.',
  },
  {
    name: 'nuclei',
    category: 'vuln-scan',
    description: 'Template-based vulnerability scanner (CVE, misconfig, exposures).',
    safeArgs: (target) => ['-u', target, '-silent', '-s', 'critical,high', '-rl', '150', '-timeout', '10', '-retries', '1', '-ni'],
    dangerousFlags: ['-s critical,high,medium,low,info without scope approval (noisy)', 'custom exploit templates'],
    whenToUse: 'The workhorse vuln scan — run after recon on every live web target.',
    requiresRoot: false,
    outputHint: 'JSON per template hit with severity.',
  },
  {
    name: 'sqlmap',
    category: 'injection',
    description: 'Automatic SQL injection detection and exploitation.',
    safeArgs: (target, o = {}) => ['-u', target, '--batch', '--level=1', '--risk=1', '--threads=2', '--timeout=10', ...(o.data ? ['--data', o.data] : [])],
    dangerousFlags: ['--os-shell', '--os-pwn', '--sql-shell', '--dump (data exfil — human approval only)', '--risk=3', '--level=5 without approval'],
    whenToUse: 'A parameter looks injectable — confirm SQLi safely, never dump data autonomously.',
    requiresRoot: false,
    outputHint: 'Parameter + DBMS + injectable techniques.',
  },
  {
    name: 'testssl.sh',
    category: 'crypto',
    description: 'Deep TLS/SSL configuration tester.',
    safeArgs: (target) => ['--fast', '--quiet', hostOf(target)],
    dangerousFlags: [],
    whenToUse: 'HTTPS target — check for weak ciphers, expired certs, Heartbleed-class issues.',
    requiresRoot: false,
    outputHint: 'Rated findings per TLS check.',
  },
  {
    name: 'sslscan',
    category: 'crypto',
    description: 'Fast SSL/TLS cipher and protocol scanner.',
    safeArgs: (target) => ['--no-failed', hostOf(target)],
    dangerousFlags: [],
    whenToUse: 'Quick cipher-suite sanity check when testssl.sh is overkill.',
    requiresRoot: false,
    outputHint: 'Accepted ciphers grouped by protocol.',
  },
  {
    name: 'wpscan',
    category: 'vuln-scan',
    description: 'WordPress vulnerability scanner.',
    safeArgs: (target) => ['--url', target, '--random-user-agent', '--throttle', '500'],
    dangerousFlags: ['--enumerate u without approval (user enum is noisy)', 'password attacks'],
    whenToUse: 'whatweb/httpx says WordPress — enumerate version, plugins, themes.',
    requiresRoot: false,
    outputHint: 'Vulnerable plugins/themes with CVEs.',
  },
  {
    name: 'enum4linux',
    category: 'smb',
    description: 'SMB/NetBIOS enumeration: shares, users, policies.',
    safeArgs: (target) => ['-a', hostOf(target)],
    dangerousFlags: [],
    whenToUse: 'nmap found SMB open (445) — enumerate shares and users.',
    requiresRoot: false,
    outputHint: 'Shares, users, password policy.',
  },
  {
    name: 'smbmap',
    category: 'smb',
    description: 'SMB share permission mapper.',
    safeArgs: (target) => ['-H', hostOf(target), '-u', 'guest', '-p', ''],
    dangerousFlags: ['recursive download (-R --download) without approval'],
    whenToUse: 'SMB shares found — check which are readable/writable as guest.',
    requiresRoot: false,
    outputHint: 'Share permissions matrix.',
  },
  {
    name: 'hydra',
    category: 'auth-test',
    description: 'Online password brute-forcer. DANGEROUS by nature — locked down.',
    safeArgs: () => { throw new Error('hydra has no safe autonomous defaults — human approval required for any auth testing'); },
    dangerousFlags: ['ALL uses without explicit human approval and scope sign-off'],
    whenToUse: 'NEVER autonomously. Only with the owner watching and explicit approval.',
    requiresRoot: false,
    outputHint: 'N/A — not for autonomous runs.',
    approvalRequired: true,
  },
  {
    name: 'john',
    category: 'auth-test',
    description: 'Password hash cracker (offline).',
    safeArgs: () => { throw new Error('john has no safe autonomous defaults — human approval required'); },
    dangerousFlags: ['ALL uses without explicit human approval'],
    whenToUse: 'NEVER autonomously. Offline hash cracking needs human approval.',
    requiresRoot: false,
    outputHint: 'N/A — not for autonomous runs.',
    approvalRequired: true,
  },
  {
    name: 'zap',
    category: 'vuln-scan',
    description: 'OWASP ZAP baseline web-app scan (passive + light active).',
    safeArgs: (target) => ['-quickurl', target, '-quickout', '-', '-silent'],
    dangerousFlags: ['full active scan (-quickurl is baseline only; deeper scans need approval)'],
    whenToUse: 'Web app needs a second opinion after nuclei — baseline scan, low noise.',
    requiresRoot: false,
    outputHint: 'Alerts with risk/confidence.',
  },
];

const BY_NAME = new Map(KALI_TOOLS.map((t) => [t.name.toLowerCase(), t]));

/** Full catalog, optionally filtered by category. */
export function listTools({ category = null } = {}) {
  return category
    ? KALI_TOOLS.filter((t) => t.category === category)
    : KALI_TOOLS.slice();
}

/** One tool by name, or null. */
export function getTool(name) {
  return BY_NAME.get(String(name || '').toLowerCase()) || null;
}

/**
 * Build a safe argv for a tool: { bin, args } — never a shell string.
 * Throws for unknown tools, unsafe targets, or approval-gated tools.
 */
export function buildCommand(name, target, opts = {}) {
  const tool = getTool(name);
  if (!tool) throw new Error(`Unknown Kali tool: ${name}`);
  if (tool.approvalRequired) {
    throw new Error(`Tool "${name}" requires explicit human approval — not for autonomous runs`);
  }
  const safeTarget = assertSafeTarget(target);
  const args = tool.safeArgs(safeTarget, opts);
  if (!Array.isArray(args) || args.some((a) => typeof a !== 'string')) {
    throw new Error(`Tool "${name}" produced an invalid argv`);
  }
  return { bin: tool.name, args, target: safeTarget };
}

/**
 * Suggest tools the way a human would: ranked by hunt stage, then by
 * tech hints (e.g. wordpress → wpscan, smb open → enum4linux).
 *
 * @param {Object} opts - { stage: 'recon'|'discovery'|'vuln-scan'|'injection'|'crypto'|'smb',
 *                          techHints: ['wordpress','smb', ...], target }
 * @returns {Array} [{ name, reason, command }]
 */
export function suggestTools({ stage = 'recon', techHints = [], target = null } = {}) {
  const hints = new Set((techHints || []).map((h) => String(h).toLowerCase()));
  const scored = [];

  for (const tool of KALI_TOOLS) {
    if (tool.approvalRequired) continue; // never suggest gated tools
    let score = 0;
    const reasons = [];
    if (tool.category === stage) {
      score += 10;
      reasons.push(`core ${stage} tool`);
    }
    // Tech-hint boosts — the human-expert part.
    if (hints.has('wordpress') && tool.name === 'wpscan') { score += 8; reasons.push('WordPress detected'); }
    if (hints.has('smb') && tool.category === 'smb') { score += 8; reasons.push('SMB ports open'); }
    if (hints.has('tls') && tool.category === 'crypto') { score += 8; reasons.push('HTTPS in use'); }
    if (hints.has('graphql') && tool.name === 'nuclei') { score += 2; reasons.push('nuclei has GraphQL templates'); }
    if (stage === 'recon' && ['nmap', 'subfinder', 'httpx'].includes(tool.name)) { score += 3; reasons.push('recon starter kit'); }
    if (stage === 'vuln-scan' && tool.name === 'nuclei') { score += 3; reasons.push('workhorse scanner'); }
    if (score > 0) scored.push({ tool, score, reasons });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map(({ tool, score, reasons }) => ({
    name: tool.name,
    category: tool.category,
    reason: reasons.join('; '),
    score,
    command: target ? buildCommand(tool.name, target) : null,
    whenToUse: tool.whenToUse,
  }));
}

export const KALI_TOOL_REGISTRY = {
  listTools,
  getTool,
  buildCommand,
  suggestTools,
  KALI_TOOLS,
};

export default KALI_TOOL_REGISTRY;
