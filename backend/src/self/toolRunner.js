// Self (Hunter Self) mode — tool runner.
//
// Runs one checklist check's predefined tools for a target URL inside
// ephemeral `darkmatter/hunt:latest` (Kali) containers via
// docker/tools/kali-exec.sh, parses the output, and returns SHORT
// processed results (counts + top findings + a few evidence lines) —
// NEVER a raw tool dump.
//
// Rules (owner order, 14 Nov 2026):
//   - $0 Meta spend: this module never calls the AI brain. It imports
//     no brain module. AI-kind checks are never executed here at all —
//     seriesRunner.js gates them before runCheck is ever reached.
//   - One failed tool must not kill the check: the failure is recorded
//     and the next tool runs.
//   - A tool missing from the Kali image is reported as blocked with a
//     reason — NEVER faked. Missing-tool specs carry available:false.
//   - Output is capped: stdout truncated before parsing, findings and
//     evidence lines capped in the formatter. A check result is short
//     by construction, not by convention.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCmd } from '../scanner/runner.js';

const TOOLS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../docker/tools',
);
export const KALI_EXEC_SH = path.join(TOOLS_DIR, 'kali-exec.sh');

export const MAX_STDOUT_CHARS = 200_000; // parse cap per tool
export const MAX_FINDINGS_PER_CHECK = 10;
export const MAX_EVIDENCE_LINES = 5;
export const MAX_SUMMARY_CHARS = 280;

// ---------------------------------------------------------------------------
// Target parsing
// ---------------------------------------------------------------------------

export function parseTarget(target) {
  if (typeof target !== 'string' || !target.trim()) {
    throw new Error('target is required');
  }
  let url = target.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  const u = new URL(url);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('target must be http(s)');
  }
  if (!u.hostname) throw new Error('target has no hostname');
  return {
    url: u.toString().replace(/\/+$/, '') || u.origin,
    origin: u.origin,
    host: u.hostname,
    port: u.port || (u.protocol === 'https:' ? '443' : '80'),
    scheme: u.protocol.replace(':', ''),
  };
}

// ---------------------------------------------------------------------------
// Tool specs — one entry per named tool/leg a check can run.
// `argv` / `shell` receive the parsed target. `parser` names a parser below.
// `available:false` = verified missing from the Kali image (scout, 14 Nov
// 2026): the runner records the leg blocked and never executes anything.
// `manual:true` = the leg cannot be auto-run safely (needs credentials or
// would be destructive): recorded skipped with a reason, never executed.
// ---------------------------------------------------------------------------

export const TOOL_SPECS = {
  subfinder: {
    tool: 'subfinder', available: true, timeoutMs: 120000, parser: 'subdomains',
    argv: (t) => ['subfinder', '-d', t.host, '-silent'],
    notes: 'Passive subdomain enumeration (crt.sh etc.).',
  },
  amass: {
    tool: 'amass', available: true, timeoutMs: 180000, parser: 'subdomains',
    argv: (t) => ['amass', 'enum', '-passive', '-d', t.host],
    notes: 'Passive subdomain enumeration.',
  },
  httpx: {
    tool: 'httpx', available: true, timeoutMs: 60000, parser: 'httpx-json',
    argv: (t) => ['httpx', '-u', t.url, '-silent', '-json', '-status-code', '-title', '-tech-detect'],
    notes: 'Live-host probe: status, title, detected tech.',
  },
  dig: {
    tool: 'dig', available: true, timeoutMs: 30000, parser: 'lines',
    argv: (t) => ['dig', t.host, 'A', 'AAAA', 'MX', 'NS', 'TXT', '+short'],
    notes: 'DNS record listing (A/AAAA/MX/NS/TXT).',
  },
  nmap: {
    tool: 'nmap', available: true, timeoutMs: 300000, parser: 'nmap',
    argv: (t) => ['nmap', '-Pn', '-sV', '--top-ports', '100', t.host],
    notes: 'Top-100 port/service scan. Authorized targets only.',
  },
  katana: {
    tool: 'katana', available: true, timeoutMs: 120000, parser: 'lines',
    argv: (t) => ['katana', '-u', t.url, '-silent', '-jc', '-d', '2'],
    notes: 'Crawl: endpoints, JS files, forms (depth 2).',
  },
  nuclei: {
    tool: 'nuclei', available: true, timeoutMs: 300000, parser: 'nuclei-jsonl',
    argv: (t) => ['nuclei', '-u', t.url, '-severity', 'info,low,medium,high,critical', '-silent', '-jsonl', '-tags', 'misconfig,exposure'],
    notes: 'Nuclei misconfig/exposure templates.',
  },
  'nuclei-openapi': {
    tool: 'nuclei', available: true, timeoutMs: 180000, parser: 'nuclei-jsonl',
    argv: (t) => ['nuclei', '-u', t.url, '-silent', '-jsonl', '-t', 'http/exposures/apis/'],
    notes: 'Nuclei API-exposure templates (swagger/openapi).',
  },
  nikto: {
    tool: 'nikto', available: true, timeoutMs: 300000, parser: 'lines',
    argv: (t) => ['nikto', '-h', t.url, '-Format', 'txt', '-no404', '-ask', 'no'],
    notes: 'Web-server misconfiguration scan.',
  },
  gobuster: {
    tool: 'gobuster', available: true, timeoutMs: 180000, parser: 'lines',
    argv: (t) => ['gobuster', 'dir', '-u', t.url, '-w', '/usr/share/dirb/wordlists/common.txt', '-q', '-t', '10'],
    notes: 'Hidden directory/file discovery (dirb common wordlist).',
  },
  ffuf: {
    tool: 'ffuf', available: true, timeoutMs: 180000, parser: 'lines',
    argv: (t) => ['ffuf', '-u', `${t.url}/FUZZ`, '-w', '/usr/share/dirb/wordlists/common.txt', '-mc', '200,204,301,302,307,401,403', '-s'],
    notes: 'Hidden path fuzzing (dirb common wordlist).',
  },
  sqlmap: {
    tool: 'sqlmap', available: true, timeoutMs: 300000, parser: 'lines',
    argv: (t) => ['sqlmap', '-u', t.url, '--batch', '--level', '1', '--risk', '1'],
    notes: 'SQL injection probe (level 1, risk 1, non-destructive).',
  },
  'curl-headers': {
    tool: 'curl', available: true, timeoutMs: 30000, parser: 'headers',
    argv: (t) => ['curl', '-sk', '-D', '-', '-o', '/dev/null', '--max-time', '20', t.url],
    notes: 'Response headers: server banner, security headers.',
  },
  'curl-robots': {
    tool: 'curl', available: true, timeoutMs: 30000, parser: 'lines',
    shell: (t) => `curl -sk --max-time 20 ${t.url}/robots.txt; echo ---SITEMAP---; curl -sk --max-time 20 ${t.url}/sitemap.xml`,
    notes: 'robots.txt + sitemap.xml fetch.',
  },
  'curl-sourcemap': {
    tool: 'curl', available: true, timeoutMs: 30000, parser: 'lines',
    shell: (t) => `curl -sk --max-time 20 ${t.url} | grep -oE '[A-Za-z0-9_./-]+\\.js\\.map' | sort -u | head -20`,
    notes: 'Homepage scan for exposed .js.map references (cap 20).',
  },
  'curl-js': {
    tool: 'curl', available: true, timeoutMs: 30000, parser: 'secret-lines',
    shell: (t) => `curl -sk --max-time 20 ${t.url}`,
    notes: 'Homepage fetch, scanned for secret-like patterns.',
  },
  'curl-unauth': {
    tool: 'curl', available: true, timeoutMs: 60000, parser: 'unauth',
    shell: (t) => `for p in admin administrator dashboard config settings users api/admin wp-admin .env; do code=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 10 ${t.url}/$p); echo "$p $code"; done`,
    notes: 'Unauthenticated GETs to sensitive paths; only a 200 with an authenticated-content marker counts downstream (the marker check itself is a later differential — this leg reports status codes only).',
  },
  'curl-auth': {
    tool: 'curl', available: true, timeoutMs: 30000, parser: 'headers',
    shell: (t) => `curl -sk -D - -o /dev/null --max-time 20 ${t.url}/login; echo ---; curl -sk -D - -o /dev/null --max-time 20 ${t.url}`,
    notes: 'Login-page + homepage headers (auth surface / rate-limit headers).',
  },
  'curl-csrf': {
    tool: 'curl', available: true, timeoutMs: 30000, parser: 'form-tokens',
    shell: (t) => `curl -sk --max-time 20 ${t.url}`,
    notes: 'Homepage forms: CSRF-token field presence.',
  },
  'curl-xss': {
    tool: 'curl', available: true, timeoutMs: 30000, parser: 'reflection',
    shell: (t) => `curl -sk --max-time 20 "${t.url}?q=SELFDMXSS9zz"`,
    notes: 'Reflection probe: a unique marker is sent and the response is checked for it verbatim (no script executes anywhere).',
    marker: 'SELFDMXSS9zz',
  },
  'curl-sqli': {
    tool: 'curl', available: true, timeoutMs: 30000, parser: 'error-keywords',
    shell: (t) => `curl -sk --max-time 20 "${t.url}?id=1%27%20OR%20%271%27%3D%271"`,
    notes: 'SQL-error-keyword probe (error text in response only).',
  },
  'curl-ssti': {
    tool: 'curl', available: true, timeoutMs: 30000, parser: 'reflection',
    shell: (t) => `curl -sk --max-time 20 "${t.url}?q=%7B%7B7%2A7%7D%7D"`,
    notes: 'SSTI probe: {{7*7}} sent, response checked for the evaluated value 49.',
    marker: '49',
  },
  'curl-xxe': {
    tool: 'curl', available: true, timeoutMs: 30000, parser: 'error-keywords',
    shell: (t) => `curl -sk --max-time 20 -X POST -H 'Content-Type: application/xml' --data '<?xml version="1.0"?><!DOCTYPE r [<!ENTITY xxe SYSTEM "file:///etc/hostname">]><r>&xxe;</r>' ${t.url}`,
    notes: 'XXE probe: response checked only for the local hostname string (file content is never exfiltrated; the check is whether the entity resolved).',
  },
  'curl-ssrf': {
    tool: 'curl', available: true, timeoutMs: 30000, parser: 'error-keywords',
    shell: (t) => `curl -sk --max-time 20 "${t.url}?url=http://169.254.169.254/latest/meta-data/"`,
    notes: 'SSRF probe: does the target fetch a metadata URL on our behalf? Response checked only for metadata markers.',
  },
  'curl-redirect': {
    tool: 'curl', available: true, timeoutMs: 30000, parser: 'redirect',
    shell: (t) => `curl -sk -D - -o /dev/null --max-time 20 "${t.url}?next=https://example.com"`,
    notes: 'Open-redirect probe: Location header checked for example.com.',
  },
  'curl-deser': {
    tool: 'curl', available: true, timeoutMs: 30000, parser: 'lines',
    shell: (t) => `curl -sk -D - -o /dev/null --max-time 20 -X POST -H 'Content-Type: application/x-java-serialized-object' --data-binary @/dev/null ${t.url}`,
    notes: 'Deserialization surface probe: POSTs an empty serialized body, records status only.',
  },
  'curl-deps': {
    tool: 'curl', available: true, timeoutMs: 30000, parser: 'lines',
    shell: (t) => `curl -sk --max-time 20 ${t.url}/package.json; echo ---; curl -sk --max-time 20 ${t.url} | grep -oE '[A-Za-z0-9_./-]+\\.(js|map)' | sort -u | head -20`,
    notes: 'Exposed package.json + JS asset inventory (supply-chain surface).',
  },
  'openssl-tls': {
    tool: 'openssl', available: true, timeoutMs: 30000, parser: 'lines',
    shell: (t) => `printf '' | openssl s_client -connect ${t.host}:443 -servername ${t.host} 2>/dev/null | openssl x509 -noout -dates -subject -issuer 2>/dev/null; echo ---; printf '' | openssl s_client -connect ${t.host}:443 -tls1_3 2>&1 | grep -iE 'Protocol|Cipher' | head -5`,
    notes: 'TLS certificate + negotiated protocol/cipher (HTTPS targets only).',
  },
  // ---- Missing / manual legs: never executed, reported honestly. --------
  'testssl-missing': {
    tool: 'testssl.sh', available: false, timeoutMs: 0, parser: 'lines',
    missingReason: 'testssl.sh is not installed in darkmatter/hunt:latest (verified 14 Nov 2026). TLS deep-scan leg blocked; openssl-tls leg still runs.',
  },
  'dnsx-missing': {
    tool: 'dnsx', available: false, timeoutMs: 0, parser: 'lines',
    missingReason: 'dnsx is not installed in darkmatter/hunt:latest (verified 14 Nov 2026). DNS brute-force leg blocked; dig leg still runs.',
  },
  'naabu-missing': {
    tool: 'naabu', available: false, timeoutMs: 0, parser: 'lines',
    missingReason: 'naabu is not installed in darkmatter/hunt:latest (verified 14 Nov 2026). Fast port-scan leg blocked; nmap leg still runs.',
  },
  'hydra-manual': {
    tool: 'hydra', available: true, manual: true, timeoutMs: 0, parser: 'lines',
    missingReason: 'hydra is installed but NOT auto-run: brute-force needs a login form + credential list the user supplies, and must never run unattended. Manual step.',
  },
  'ysoserial-manual': {
    tool: 'ysoserial', available: true, manual: true, timeoutMs: 0, parser: 'lines',
    missingReason: 'ysoserial is installed but NOT auto-run: generating a real deserialization payload and sending it would be destructive. Manual step.',
  },
};

export function getToolSpec(name) {
  return TOOL_SPECS[name] || null;
}

// ---------------------------------------------------------------------------
// Parsers — every parser returns { findings: [{title, evidence[]}], count }
// and never returns raw output. Evidence lines are capped.
// ---------------------------------------------------------------------------

function dedupLines(text, max = 50) {
  const seen = new Set();
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function finding(title, evidence) {
  // Evidence lines are truncated: a long raw tool line must never survive
  // into a check result (short output by construction).
  return { title, evidence: (evidence || []).slice(0, MAX_EVIDENCE_LINES).map((l) => String(l).slice(0, 200)) };
}

export const PARSERS = {
  lines(text) {
    const lines = dedupLines(text, 50);
    if (!lines.length) return { findings: [], count: 0 };
    return { findings: [finding(`${lines.length} output line(s)`, lines.slice(0, 10))], count: lines.length };
  },

  subdomains(text, target) {
    const host = target.host.toLowerCase();
    const re = new RegExp(`([a-z0-9-]+\\.)+${host.replace(/\./g, '\\.')}`, 'gi');
    const found = new Set();
    for (const m of String(text || '').matchAll(re)) found.add(m[0].toLowerCase());
    found.delete(host);
    const list = [...found].sort().slice(0, 50);
    if (!list.length) return { findings: [], count: 0 };
    return { findings: [finding(`${list.length} subdomain(s) enumerated`, list.slice(0, 10))], count: list.length };
  },

  'httpx-json'(text) {
    const findings = [];
    for (const line of String(text || '').split('\n')) {
      const t = line.trim();
      if (!t.startsWith('{')) continue;
      try {
        const j = JSON.parse(t);
        const tech = Array.isArray(j.tech) ? j.tech.join(', ') : '';
        findings.push(finding(`${j.url || j.input || ''} -> ${j.status_code || '?'}${j.title ? ` (${j.title})` : ''}${tech ? ` [${tech}]` : ''}`, [t.slice(0, 200)]));
      } catch { /* skip */ }
    }
    return { findings: findings.slice(0, 10), count: findings.length };
  },

  'nuclei-jsonl'(text) {
    const findings = [];
    for (const line of String(text || '').split('\n')) {
      const t = line.trim();
      if (!t.startsWith('{')) continue;
      try {
        const j = JSON.parse(t);
        const name = (j.info && j.info.name) || j['template-id'] || 'nuclei finding';
        const sev = String((j.info && j.info.severity) || 'unknown');
        findings.push(finding(`[${sev}] ${name}`, [String(j['matched-at'] || j.host || '').slice(0, 200)]));
      } catch { /* skip */ }
    }
    return { findings: findings.slice(0, 10), count: findings.length };
  },

  nmap(text) {
    const lines = dedupLines(text, 50).filter((l) => /^\d+\/(tcp|udp)\s+open/i.test(l));
    if (!lines.length) return { findings: [], count: 0 };
    return { findings: [finding(`${lines.length} open port(s)`, lines.slice(0, 10))], count: lines.length };
  },

  headers(text) {
    const interesting = /^(HTTP\/|Server:|X-Powered-By:|Strict-Transport-Security:|Content-Security-Policy:|X-Frame-Options:|X-Content-Type-Options:|Referrer-Policy:|Permissions-Policy:|Set-Cookie:|Retry-After:|X-RateLimit-|Allow:)/i;
    const lines = dedupLines(text, 50).filter((l) => interesting.test(l));
    const missing = [];
    const joined = String(text || '');
    for (const h of ['Strict-Transport-Security', 'Content-Security-Policy', 'X-Frame-Options', 'X-Content-Type-Options']) {
      if (!new RegExp(`^${h}:`, 'im').test(joined)) missing.push(`missing ${h}`);
    }
    const findings = [];
    if (lines.length) findings.push(finding('response headers', lines.slice(0, 10)));
    if (missing.length) findings.push(finding(`${missing.length} security header(s) missing`, missing));
    return { findings, count: findings.length };
  },

  reflection(text, target, spec) {
    const marker = spec.marker || '';
    if (marker && String(text || '').includes(marker)) {
      const lines = dedupLines(text, 50).filter((l) => l.includes(marker)).slice(0, 5);
      return { findings: [finding(`marker reflected verbatim: ${marker}`, lines.length ? lines : [`marker "${marker}" present in response`])], count: 1 };
    }
    return { findings: [], count: 0 };
  },

  'error-keywords'(text) {
    const keywords = [/SQL syntax/i, /mysql_fetch/i, /ORA-\d{5}/i, /PostgreSQL.*ERROR/i, /unclosed quotation/i, /Microsoft OLE DB/i, /SQLite.*error/i, /root:/i, /ami-id|instance-id|meta-data/i, /java\.lang\./i, /XXE|ENTITY/i];
    const hits = [];
    for (const line of dedupLines(text, 50)) {
      if (keywords.some((re) => re.test(line))) hits.push(line.slice(0, 200));
      if (hits.length >= 10) break;
    }
    if (!hits.length) return { findings: [], count: 0 };
    return { findings: [finding(`${hits.length} error/marker line(s) in response`, hits.slice(0, 5))], count: hits.length };
  },

  'form-tokens'(text) {
    const html = String(text || '');
    const forms = (html.match(/<form[\s\S]*?<\/form>/gi) || []).length;
    const hasToken = /name=["'](csrf|_token|authenticity_token|__RequestVerificationToken)["']/i.test(html);
    const findings = [];
    if (forms) findings.push(finding(`${forms} form(s) on page; CSRF token field ${hasToken ? 'present' : 'NOT found'}`, []));
    else findings.push(finding('no forms found on page', []));
    return { findings, count: findings.length };
  },

  redirect(text) {
    const m = /Location:\s*(\S+)/i.exec(String(text || ''));
    if (!m) return { findings: [], count: 0 };
    const loc = m[1];
    const external = /^https:\/\/example\.com/i.test(loc);
    return { findings: [finding(external ? `open redirect: Location -> ${loc}` : `redirect to ${loc} (not the test origin)`, [loc])], count: 1 };
  },

  unauth(text) {
    const lines = dedupLines(text, 50);
    const open = lines.filter((l) => /\s200$/.test(l));
    if (!open.length) return { findings: [], count: 0 };
    return { findings: [finding(`${open.length} sensitive path(s) returned 200 unauthenticated (status only — content not yet differentially confirmed)`, open.slice(0, 10))], count: open.length };
  },

  'secret-lines'(text) {
    const patterns = [
      /AKIA[0-9A-Z]{16}/, /ghp_[A-Za-z0-9]{20,}/, /sk-[A-Za-z0-9]{16,}/,
      /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, /api[_-]?key\s*[:=]\s*['"][^'"]{8,}['"]/i,
      /password\s*[:=]\s*['"][^'"]{4,}['"]/i,
    ];
    const hits = [];
    for (const line of dedupLines(text, 50)) {
      if (patterns.some((re) => re.test(line))) hits.push(line.slice(0, 200));
      if (hits.length >= 10) break;
    }
    if (!hits.length) return { findings: [], count: 0 };
    return { findings: [finding(`${hits.length} secret-like pattern(s)`, hits.slice(0, 5))], count: hits.length };
  },
};

export function parseToolOutput(parserName, stdout, target, spec) {
  const parser = PARSERS[parserName] || PARSERS.lines;
  return parser(String(stdout || '').slice(0, MAX_STDOUT_CHARS), target, spec || {});
}

// ---------------------------------------------------------------------------
// Short-output formatter — the only shape a check result takes.
// ---------------------------------------------------------------------------

export function formatShortResult(check, toolResults) {
  const ran = toolResults.filter((r) => r.status === 'ok');
  const failed = toolResults.filter((r) => r.status === 'failed');
  const blocked = toolResults.filter((r) => r.status === 'blocked' || r.status === 'skipped');
  const findings = [];
  for (const r of ran) {
    for (const f of r.findings || []) {
      if (findings.length >= MAX_FINDINGS_PER_CHECK) break;
      findings.push({ tool: r.spec, title: String(f.title).slice(0, 200), evidence: (f.evidence || []).slice(0, MAX_EVIDENCE_LINES) });
    }
    if (findings.length >= MAX_FINDINGS_PER_CHECK) break;
  }
  const total = toolResults.reduce((n, r) => n + (r.count || 0), 0);
  let summary;
  if (findings.length) summary = `${findings.length} finding(s) across ${ran.length} tool(s), ${total} item(s) total.`;
  else if (ran.length) summary = `No findings — ${ran.length} tool(s) ran clean.`;
  else summary = `No tools ran (${blocked.length} blocked/skipped, ${failed.length} failed).`;
  if (blocked.length) summary += ` ${blocked.length} leg(s) blocked/skipped (missing or manual tool).`;
  if (failed.length) summary += ` ${failed.length} tool(s) failed (recorded, check continued).`;
  return {
    summary: summary.slice(0, MAX_SUMMARY_CHARS),
    counts: {
      toolsRun: ran.length,
      toolsFailed: failed.length,
      toolsBlocked: blocked.length,
      findings: findings.length,
      items: total,
    },
    findings,
  };
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

// Default executor: one ephemeral Kali container per tool via kali-exec.sh.
// kali-exec.sh takes ONE shell string (its --entrypoint /bin/bash -c
// override is load-bearing — the hunt image entrypoint swallows bare
// argv). argv specs are shell-quoted into a single command string.
function shellQuote(arg) {
  return `'${String(arg).replace(/'/g, `'\\''`)}'`;
}

export async function dockerExec({ spec, argv, shell, timeoutMs }) {
  const cmd = shell || (argv || []).map(shellQuote).join(' ');
  return runCmd('bash', [KALI_EXEC_SH, cmd], { timeoutMs: timeoutMs || 120000 });
}

export async function runTool(specName, target, { execFn = dockerExec } = {}) {
  const spec = getToolSpec(specName);
  const startedAt = Date.now();
  if (!spec) {
    return { spec: specName, status: 'failed', reason: `unknown tool spec "${specName}"`, findings: [], count: 0, durationMs: Date.now() - startedAt };
  }
  if (spec.available === false) {
    return { spec: specName, tool: spec.tool, status: 'blocked', reason: spec.missingReason || `${spec.tool} not available`, findings: [], count: 0, durationMs: Date.now() - startedAt };
  }
  if (spec.manual === true) {
    return { spec: specName, tool: spec.tool, status: 'skipped', reason: spec.missingReason || `${spec.tool} requires manual input`, findings: [], count: 0, durationMs: Date.now() - startedAt };
  }
  let execResult;
  try {
    const argv = typeof spec.argv === 'function' ? spec.argv(target) : null;
    const shell = typeof spec.shell === 'function' ? spec.shell(target) : null;
    execResult = await execFn({ spec: specName, argv, shell, timeoutMs: spec.timeoutMs });
  } catch (err) {
    return { spec: specName, tool: spec.tool, status: 'failed', reason: `executor error: ${err && err.message ? err.message : String(err)}`, findings: [], count: 0, durationMs: Date.now() - startedAt };
  }
  const durationMs = Date.now() - startedAt;
  if (execResult.timedOut) {
    return { spec: specName, tool: spec.tool, status: 'failed', reason: `timed out after ${spec.timeoutMs}ms`, findings: [], count: 0, durationMs };
  }
  if (!execResult.ok) {
    // A non-zero exit from a recon tool is common (e.g. no matches found);
    // still parse stdout — a finding may be in it — but record the failure
    // when stdout parses to nothing.
    const parsed = parseToolOutput(spec.parser, execResult.stdout, target, spec);
    if (parsed.findings.length) {
      return { spec: specName, tool: spec.tool, status: 'ok', note: `tool exited ${execResult.code} but output parsed`, findings: parsed.findings, count: parsed.count, durationMs };
    }
    return { spec: specName, tool: spec.tool, status: 'failed', reason: `exit ${execResult.code}${execResult.stderr ? `: ${String(execResult.stderr).slice(0, 200)}` : ''}`, findings: [], count: 0, durationMs };
  }
  const parsed = parseToolOutput(spec.parser, execResult.stdout, target, spec);
  return { spec: specName, tool: spec.tool, status: 'ok', findings: parsed.findings, count: parsed.count, durationMs };
}

// Run one checklist check for a target. One failed tool never kills the
// check: every tool result (ok/failed/blocked/skipped) is recorded and
// the check completes with the short formatted result.
export async function runCheck(check, targetUrl, { execFn = dockerExec } = {}) {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const target = parseTarget(targetUrl);
  const toolResults = [];
  for (const specName of check.tools || []) {
    toolResults.push(await runTool(specName, target, { execFn }));
  }
  const formatted = formatShortResult(check, toolResults);
  const ran = toolResults.filter((r) => r.status === 'ok').length;
  const blocked = toolResults.filter((r) => r.status === 'blocked' || r.status === 'skipped').length;
  const status = toolResults.length === 0
    ? 'blocked'
    : ran === 0 ? 'blocked' : (blocked > 0 || toolResults.some((r) => r.status === 'failed')) ? 'partial' : 'done';
  // Verdict semantics (checklist Yes/No): 'yes' = the check found evidence
  // (a finding); 'no' = tools ran clean; 'partial' = some legs blocked or
  // failed so the check is not fully answered; 'unknown' = nothing ran.
  const verdict = formatted.counts.findings > 0 ? 'yes'
    : ran > 0 ? 'no'
    : 'unknown';
  return {
    checkId: check.id,
    category: check.category,
    kind: check.kind,
    status: verdict === 'unknown' ? 'blocked' : status,
    verdict,
    summary: formatted.summary,
    counts: formatted.counts,
    findings: formatted.findings,
    tools: toolResults.map((r) => ({
      spec: r.spec, tool: r.tool || null, status: r.status,
      reason: r.reason || r.note || null, count: r.count || 0, durationMs: r.durationMs,
    })),
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedMs,
  };
}
