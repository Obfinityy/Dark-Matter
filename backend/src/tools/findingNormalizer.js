// Local imports for the recon parsers below — no cycles: none of these
// modules import findingNormalizer.
import { parseNmapXml } from '../recon/portChain.js';
import { parseWafw00f } from '../recon/wafAdaptive.js';
import { extractEndpointsFromKatana } from '../recon/jsEndpointLoop.js';

/**
 * Finding normalizer — every detection tool's output becomes normalized
 * findings: { type, severity, url, evidence, confidence, source, title }.
 *
 * This is the single funnel into the findings lifecycle
 * (findingLifecycleService): parsers produce candidate findings, the
 * lifecycle service still demands stored evidence before confirming.
 *
 * Severity policy:
 *   - use the tool's own severity when present (nuclei), mapped to our scale
 *   - parsers only DOWNGRADE on weak evidence, never upgrade without proof
 *   - confidence: 0.0–1.0, the fraction of confirmation the output itself gives
 */

const SEVERITY_ORDER = ['info', 'low', 'medium', 'high', 'critical'];
export function clampSeverity(sev, fallback = 'medium') {
  const s = String(sev || '').toLowerCase();
  return SEVERITY_ORDER.includes(s) ? s : fallback;
}

/** nuclei -jsonl → findings. Each template match is a candidate finding. */
export function normalizeNuclei(raw, { minSeverity = 'info' } = {}) {
  const findings = [];
  const minIdx = SEVERITY_ORDER.indexOf(clampSeverity(minSeverity, 'info'));
  for (const line of String(raw || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    let obj;
    try { obj = JSON.parse(t); } catch { continue; }
    const info = obj.info || {};
    const severity = clampSeverity(info.severity, 'info');
    if (SEVERITY_ORDER.indexOf(severity) < minIdx) continue;
    findings.push({
      type: info.name || obj['template-id'] || 'nuclei-match',
      title: info.name || `Nuclei match: ${obj['template-id'] || 'unknown template'}`,
      severity,
      url: obj['matched-at'] || obj.host || null,
      evidence: {
        templateId: obj['template-id'] || null,
        templateUrl: obj['template-url'] || null,
        matcherName: obj['matcher-name'] || null,
        extractedResults: obj['extracted-results'] || null,
        request: obj.request || null,
        responseSnippet: String(obj.response || '').slice(0, 2000) || null,
        tags: info.tags || [],
        reference: info.reference || []
      },
      confidence: severity === 'critical' ? 0.9 : severity === 'high' ? 0.8 : severity === 'medium' ? 0.65 : 0.5,
      source: 'nuclei'
    });
  }
  return findings;
}

/**
 * sqlmap --batch output → findings.
 * A finding is only "confirmed" when sqlmap prints an injectable parameter
 * (GET/POST parameter 'X' is ... injectable); anything else is a candidate.
 */
export function normalizeSqlmap(raw) {
  const text = String(raw || '');
  const findings = [];
  const injectableRe = /Parameter:\s*([^\s(]+)\s*\(([^)]+)\)[\s\S]{0,400}?Type:\s*([^\n]+)\n\s*Title:\s*([^\n]+)/gi;
  let m;
  const seen = new Set();
  while ((m = injectableRe.exec(text)) !== null) {
    const key = `${m[1]}|${m[3]}|${m[4]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push({
      type: 'sql-injection',
      title: `SQL injection in parameter '${m[1]}' (${m[2]})`,
      severity: /time-based|stacked|union/i.test(m[3]) ? 'high' : 'medium',
      url: extractSqlmapUrl(text),
      evidence: {
        parameter: m[1],
        place: m[2],
        technique: m[3].trim(),
        title: m[4].trim(),
        rawExcerpt: text.slice(Math.max(0, m.index - 200), m.index + 600)
      },
      confidence: 0.85,
      source: 'sqlmap'
    });
  }
  // sqlmap explicitly saying "not injectable" → negative evidence (no finding)
  if (!findings.length && /all tested parameters do not appear to be injectable/i.test(text)) {
    return { findings: [], negative: true, note: 'sqlmap reports target not injectable at risk/level tested' };
  }
  return { findings, negative: false };
}

function extractSqlmapUrl(text) {
  const m = text.match(/URL:\s*(https?:\/\/[^\s]+)/i) || text.match(/testing (?:URL|connection).*?(https?:\/\/[^\s'"]+)/i);
  return m ? m[1] : null;
}

/**
 * dalfox --format json → findings.
 * dalfox JSON has "logs" with "type": "G" (reflected GET), "P" (POST),
 * and "vuln" entries; stored/DOM surface via "poc" + "type" markers.
 */
export function normalizeDalfox(raw) {
  let data;
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return [];
  }
  const logs = Array.isArray(data?.logs) ? data.logs : Array.isArray(data) ? data : [];
  const findings = [];
  for (const log of logs) {
    if (!log || typeof log !== 'object') continue;
    const kind = String(log.type || '').toUpperCase();
    const message = String(log.message || '');
    // dalfox marks hits with [V]; be liberal in DETECTION, the lifecycle
    // service still demands stored evidence before confirming a finding.
    // ("not vulnerable" log lines contain the word "vulnerable" — exclude them.)
    const isVuln = kind.includes('VULN') || log.vulnerable === true || /\[V\]/.test(message)
      || (/vulnerable/i.test(message) && !/not[\s_-]*vulnerable/i.test(message));
    if (!isVuln) continue;
    const isStored = /stored|post|database|persist/i.test(message) || kind.includes('P');
    const isDom = /dom|document\.|innerHTML|sink/i.test(message);
    const type = isStored ? 'stored-xss' : isDom ? 'dom-xss' : 'reflected-xss';
    findings.push({
      type,
      title: `${isStored ? 'Stored' : isDom ? 'DOM-based' : 'Reflected'} XSS at ${log.url || log.param || 'unknown target'}`,
      severity: isStored ? 'high' : 'medium',
      url: log.url || null,
      evidence: {
        param: log.param || log.parameter || null,
        payload: log.payload || log.poc || null,
        poc: log.poc || null,
        message: message.slice(0, 1000)
      },
      confidence: isStored ? 0.85 : 0.75,
      source: 'dalfox'
    });
  }
  // dalfox "not vulnerable" summary shape
  if (!findings.length && /not vulnerable|no xss/i.test(JSON.stringify(data).slice(0, 2000))) {
    return { findings: [], negative: true };
  }
  return findings;
}

/** corscanner JSON → findings. Wildcard + credentials = high. */
export function normalizeCorscanner(raw) {
  let data;
  try { data = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return []; }
  const rows = Array.isArray(data) ? data : (data?.results ? data.results : [data]);
  const findings = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const origin = row.origin || row.tested_origin || '*';
    const acao = row.access_control_allow_origin || row['Access-Control-Allow-Origin'] || '';
    const acac = /true/i.test(String(row.access_control_allow_credentials || row['Access-Control-Allow-Credentials'] || ''));
    const wildcard = acao.trim() === '*';
    const reflects = acao && origin !== '*' && String(acao).includes(String(origin).replace(/^https?:\/\//, '')) || acao === origin;
    if (wildcard && acac) {
      findings.push(corsFinding(row, 'high', 'CORS wildcard with credentials — any origin can read responses with cookies', 0.9, { wildcard: true, credentials: true }));
    } else if (reflects && acac) {
      findings.push(corsFinding(row, 'high', 'CORS reflects arbitrary Origin with credentials enabled', 0.85, { reflectedOrigin: true, credentials: true }));
    } else if (wildcard || reflects) {
      findings.push(corsFinding(row, 'medium', 'Overly permissive CORS origin policy (no credentials)', 0.6, { wildcard, reflectedOrigin: reflects }));
    }
  }
  return findings;
}

function corsFinding(row, severity, title, confidence, flags) {
  return {
    type: 'cors-misconfiguration',
    title,
    severity,
    url: row.url || row.target || null,
    evidence: {
      testedOrigin: row.origin || row.tested_origin || null,
      allowOrigin: row.access_control_allow_origin || row['Access-Control-Allow-Origin'] || null,
      allowCredentials: row.access_control_allow_credentials || row['Access-Control-Allow-Credentials'] || null,
      ...flags
    },
    confidence,
    source: 'corscanner'
  };
}

/**
 * sslscan text output → findings with severity mapping:
 *   SSLv2/SSLv3 → high · TLS 1.0/1.1 → medium · weak cipher/3DES/RC4 → medium ·
 *   expired/self-signed cert → low · heartbleed/CCS/POODLE markers → high/critical
 */
export function normalizeSslscan(raw) {
  const text = String(raw || '');
  const findings = [];
  const host = text.match(/Testing SSL server\s+(\S+)/i)?.[1] || null;

  const push = (type, title, severity, confidence, evidence) =>
    findings.push({ type, severity, url: host ? `https://${host}` : null, title, evidence, confidence, source: 'sslscan' });

  if (/SSLv2\s+.*enabled/i.test(text)) push('weak-tls', 'SSLv2 enabled', 'high', 0.9, { protocol: 'SSLv2' });
  if (/SSLv3\s+.*enabled/i.test(text) || /POODLE/i.test(text)) push('weak-tls', 'SSLv3 enabled (POODLE)', 'high', 0.9, { protocol: 'SSLv3' });
  if (/TLSv1\.0\s+.*enabled/i.test(text)) push('weak-tls', 'TLS 1.0 enabled (deprecated)', 'medium', 0.85, { protocol: 'TLSv1.0' });
  if (/TLSv1\.1\s+.*enabled/i.test(text)) push('weak-tls', 'TLS 1.1 enabled (deprecated)', 'medium', 0.85, { protocol: 'TLSv1.1' });
  if (/\b(RC4|3DES|DES-CBC3?|NULL|EXPORT|anon)\b/i.test(text) && /enabled/i.test(text)) {
    const cipher = text.match(/\b(RC4|3DES|DES-CBC3?|NULL|EXPORT)\b/i)?.[1];
    push('weak-cipher', `Weak cipher suite accepted: ${cipher}`, 'medium', 0.8, { cipher });
  }
  if (/heartbleed.*vulnerable/i.test(text)) push('heartbleed', 'Heartbleed (CVE-2014-0160) — VULNERABLE', 'critical', 0.95, { cve: 'CVE-2014-0160' });
  if (/certificate.*expired/i.test(text)) push('tls-certificate', 'TLS certificate expired', 'low', 0.9, {});
  if (/self.signed/i.test(text)) push('tls-certificate', 'Self-signed TLS certificate', 'low', 0.8, {});
  return findings;
}

/**
 * subzy JSON → takeover findings. Only entries subzy marks vulnerable become
 * findings (fingerprint matched AND HTTP verification). Everything else is
 * recorded as checked, not vulnerable.
 */
export function normalizeSubzy(raw) {
  let data;
  try { data = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return { findings: [], checked: 0 }; }
  const rows = Array.isArray(data) ? data : [data];
  const findings = [];
  let checked = 0;
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    checked++;
    // "Not Vulnerable" contains the word "vulnerable" — exclude it explicitly.
    const status = String(row.status || '');
    const vulnerable = row.vulnerable === true
      || (/vulnerable/i.test(status) && !/not[\s_-]*vulnerable/i.test(status));
    if (!vulnerable) continue;
    findings.push({
      type: 'subdomain-takeover',
      title: `Subdomain takeover possible: ${row.subdomain || row.host || 'unknown'}`,
      severity: 'high',
      url: row.subdomain ? `https://${row.subdomain}` : null,
      evidence: {
        subdomain: row.subdomain || row.host || null,
        service: row.service || null,
        cname: row.cname || null,
        fingerprint: row.fingerprint || null,
        verified: row.verified === true
      },
      confidence: row.verified === true ? 0.9 : 0.7,
      source: 'subzy'
    });
  }
  return { findings, checked };
}

/**
 * httpx -json lines → live-host findings (info): every responding host with
 * status/title/tech is recon evidence the planner can act on.
 */
export function normalizeHttpx(raw) {
  const findings = [];
  for (const line of String(raw || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    let obj;
    try { obj = JSON.parse(t); } catch { continue; }
    if (obj.failed === true) continue; // httpx marks dead hosts failed:true — not live hosts
    const url = obj.url || obj.input || null;
    if (!url) continue;
    const tech = Array.isArray(obj.tech) ? obj.tech : [];
    findings.push({
      type: 'live-host',
      title: `Live host: ${url} [${obj.status_code ?? '?'}]${obj.title ? ` — ${obj.title}` : ''}`,
      severity: 'info',
      url,
      evidence: {
        statusCode: obj.status_code ?? null,
        title: obj.title || null,
        webserver: obj.webserver || null,
        tech,
        contentLength: obj.content_length ?? null,
        finalUrl: obj.final_url || null,
        cdn: obj.cdn_name || null
      },
      confidence: 0.95,
      source: 'httpx'
    });
  }
  return findings;
}

/**
 * subfinder text lines → subdomain findings (info).
 * Deduped, scope-checked when opts.baseHost is given.
 */
export function normalizeSubfinder(raw, { baseHost = null } = {}) {
  const findings = [];
  const seen = new Set();
  for (const line of String(raw || '').split('\n')) {
    const host = line.trim().toLowerCase().replace(/\.$/, '');
    if (!host || seen.has(host)) continue;
    if (!/^[a-z0-9]([a-z0-9.-]{0,253}[a-z0-9])?$/.test(host)) continue;
    if (baseHost && !(host === baseHost || host.endsWith(`.${baseHost}`))) continue;
    seen.add(host);
    findings.push({
      type: 'subdomain',
      title: `Subdomain discovered: ${host}`,
      severity: 'info',
      url: `https://${host}`,
      evidence: { subdomain: host },
      confidence: 1.0,
      source: 'subfinder'
    });
  }
  return findings;
}

// Sensitive services: an open port on these is worth more than an info.
const SENSITIVE_PORTS = {
  21: 'ftp', 23: 'telnet', 1433: 'mssql', 1521: 'oracle', 3306: 'mysql',
  3389: 'rdp', 5432: 'postgres', 5900: 'vnc', 6379: 'redis', 27017: 'mongodb',
  11211: 'memcached', 9200: 'elasticsearch', 445: 'smb', 139: 'netbios'
};

/**
 * nmap -oX XML → per-open-port findings. Sensitive services (DBs, RDP,
 * telnet, SMB) grade to medium; everything else is info. Never invented:
 * only ports nmap marks open.
 */
export function normalizeNmap(raw) {
  const { services } = parseNmapXml(raw);
  return services.filter((s) => s.state === 'open').map((s) => {
    const sensitive = SENSITIVE_PORTS[s.port];
    return {
      type: 'open-port',
      title: sensitive
        ? `Sensitive service exposed: ${sensitive} on port ${s.port}/${s.protocol || 'tcp'}`
        : `Open port: ${s.port}/${s.protocol || 'tcp'}${s.service ? ` (${s.service})` : ''}`,
      severity: sensitive ? 'medium' : 'info',
      url: s.host ? `${s.service === 'http' || s.port === 80 ? 'http' : 'tcp'}://${s.host}:${s.port}` : null,
      evidence: {
        port: s.port,
        protocol: s.protocol || 'tcp',
        service: s.service || null,
        product: s.product || null,
        version: s.version || null,
        host: s.host || null
      },
      confidence: 0.9,
      source: 'nmap'
    };
  });
}

/**
 * wafw00f JSON → waf-detected finding (info). No WAF → no finding
 * (absence is a planner signal, not a vulnerability).
 */
export function normalizeWafw00f(raw) {
  const parsed = parseWafw00f(raw);
  if (!parsed.detected) return [];
  return [{
    type: 'waf-detected',
    title: `WAF detected: ${parsed.waf}`,
    severity: 'info',
    url: null,
    evidence: { waf: parsed.waf, method: parsed.method },
    confidence: 0.9,
    source: 'wafw00f'
  }];
}

/**
 * katana JSONL → discovered-endpoint findings (info): every crawled URL is
 * recon evidence; URLs with query strings are flagged for the param loop.
 */
export function normalizeKatana(raw, { baseHost = null } = {}) {
  const { endpoints } = extractEndpointsFromKatana(raw, { baseHost });
  return endpoints.map((e) => ({
    type: 'discovered-endpoint',
    title: `Discovered endpoint: ${e.url}`,
    severity: 'info',
    url: e.url,
    evidence: { method: e.method, source: 'katana', hasParams: e.url.includes('?') },
    confidence: 0.95,
    source: 'katana'
  }));
}

const STATIC_ASSET_RE = /\.(png|jpe?g|gif|svg|ico|css|map|woff2?|ttf|eot|mp4|webm|zip|tar\.gz)$/i;

/**
 * gau / waybackurls lines → archived-url findings (info). Static assets are
 * dropped (they never carry parameters); parameterized URLs are flagged so
 * the param loop can pick them up automatically.
 */
export function normalizeGau(raw, { baseHost = null } = {}) {
  const findings = [];
  const seen = new Set();
  for (const line of String(raw || '').split('\n')) {
    const t = line.trim();
    if (!t || seen.has(t) || STATIC_ASSET_RE.test(t.split('?')[0])) continue;
    let host = null;
    try { host = new URL(t).hostname; } catch { continue; }
    if (baseHost && !(host === baseHost || host.endsWith(`.${baseHost}`))) continue;
    seen.add(t);
    findings.push({
      type: 'archived-url',
      title: `Archived URL: ${t.length > 120 ? t.slice(0, 120) + '…' : t}`,
      severity: 'info',
      url: t,
      evidence: { archived: true, hasParams: t.includes('?') },
      confidence: 0.8,
      source: 'gau'
    });
  }
  return findings;
}

export function normalizeToolFindings(tool, raw, opts = {}) {
  switch (tool) {
    case 'nuclei': return normalizeNuclei(raw, opts);
    case 'sqlmap': {
      const r = normalizeSqlmap(raw);
      return Array.isArray(r) ? r : r.findings;
    }
    case 'dalfox': {
      const r = normalizeDalfox(raw);
      return Array.isArray(r) ? r : r.findings;
    }
    case 'corscanner': case 'cors': return normalizeCorscanner(raw);
    case 'sslscan': return normalizeSslscan(raw);
    case 'subzy': {
      const r = normalizeSubzy(raw);
      return r.findings;
    }
    case 'httpx': return normalizeHttpx(raw);
    case 'subfinder': return normalizeSubfinder(raw, opts);
    case 'nmap': return normalizeNmap(raw);
    case 'wafw00f': return normalizeWafw00f(raw);
    case 'katana': return normalizeKatana(raw, opts);
    case 'gau': case 'waybackurls': return normalizeGau(raw, opts);
    default: return [];
  }
}
