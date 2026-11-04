// Dark Matter rule-based scanner — sensitive-file exposure probe.
// Oracle: DIRECT HTTP 200 (no redirects) + content marker per path + anti-SPA gates.
//
// Hard lesson (4 Nov 2026, owner-corrected): SPA fallback pages fooled the old
// oracle — thebhavesh.online served the homepage for /.env (308 -> www ->
// 200 text/html index page containing '=' characters in its JS bundle) and we
// fired a verified "Exposed .env file" [critical]. Confirmation now requires:
//   1. A DIRECT 200 — redirects are NEVER followed (a 3xx is not exposure).
//   2. The body is NOT the origin's catch-all: a random nonexistent path must
//      not return the same 200 body (catches 200-for-everything SPAs).
//   3. Per-file structural gates (non-HTML content-type + KEY=VALUE lines
//      for .env-style files; size bound for .git/HEAD; non-HTML for .DS_Store).
const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

const FILE_CHECKS = [
  {
    path: '/.git/HEAD', marker: 'ref:', title: 'Exposed .git/HEAD', severity: 'high',
    gate: (res) => !isHtml(res.contentType) && res.text.length < 1000,
  },
  {
    path: '/.env', marker: '=', title: 'Exposed .env file', severity: 'critical',
    gate: (res) => !isHtml(res.contentType) && keyValueLines(res.text).length >= 2,
  },
  {
    path: '/phpinfo.php', marker: 'phpinfo()', title: 'Exposed phpinfo()', severity: 'medium',
    // phpinfo() is legitimately text/html — the catch-all baseline is its guard.
    gate: () => true,
  },
  {
    path: '/server-status', marker: 'Apache Status', title: 'Exposed Apache server-status', severity: 'medium',
    gate: () => true,
  },
  {
    path: '/.DS_Store', marker: null, title: 'Exposed .DS_Store', severity: 'low',
    gate: (res) => !isHtml(res.contentType) && !res.text.trimStart().startsWith('<'),
  },
];

// Lines like DB_PASSWORD=secret — anchored at line start so inline
// JS fragments (window.cfg={a=1}) never match.
function keyValueLines(text) {
  return String(text).match(/^[ \t]*[A-Za-z_][A-Za-z0-9_]*[ \t]*=[ \t]*\S/gm) || [];
}

function isHtml(contentType) {
  return String(contentType || '').toLowerCase().includes('text/html');
}

async function get(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'manual', // never follow: a 3xx to the homepage is NOT exposure
      headers: { 'User-Agent': UA, ...(opts.headers || {}) },
    });
    const text = await res.text().catch(() => '');
    return {
      status: res.status,
      contentType: res.headers.get('content-type') || '',
      text: text.slice(0, 5000),
    };
  } finally {
    clearTimeout(t);
  }
}

// Catch-all baseline: fetch one random nonexistent path. If the origin answers
// 200 with the same body as a candidate, that "finding" is the SPA catch-all.
async function catchAllBaseline(base, opts) {
  const nonce = `dm-spa-check-${Math.random().toString(36).slice(2, 12)}`;
  try {
    return await get(`${base}/${nonce}`, opts);
  } catch {
    return null;
  }
}

function sameAsBaseline(res, baseline) {
  if (!baseline || baseline.status !== 200 || res.status !== 200) return false;
  const a = res.text;
  const b = baseline.text;
  if (Math.abs(a.length - b.length) > Math.max(200, b.length * 0.15)) return false;
  return a.slice(0, 200) === b.slice(0, 200);
}

export async function probeSensitiveFiles(baseUrl, opts = {}) {
  const findings = [];
  const base = String(baseUrl).replace(/\/$/, '');
  const baseline = await catchAllBaseline(base, opts);
  for (const c of FILE_CHECKS) {
    let res;
    try {
      res = await get(base + c.path, opts);
    } catch {
      continue;
    }
    if (res.status !== 200) continue; // gate 1: direct 200 only
    if (c.marker && !res.text.includes(c.marker)) continue; // cheap pre-filter
    if (sameAsBaseline(res, baseline)) continue; // gate 2: not the SPA catch-all
    if (!c.gate(res)) continue; // gate 3: structural gate per file type
    const kv = c.path === '/.env' ? keyValueLines(res.text) : [];
    findings.push({
      class: 'sensitive_file',
      id: `sensitive-file-${c.path.replace(/[^a-z0-9]/gi, '')}`,
      title: c.title,
      severity: c.severity,
      url: base + c.path,
      evidence: {
        request: `GET ${base + c.path}`,
        response:
          `HTTP 200 (direct, no redirect) content-type="${res.contentType || 'none'}"` +
          (c.marker ? ` containing marker "${c.marker}"` : '') +
          (kv.length ? `; ${kv.length} KEY=VALUE lines` : ''),
        impact_demo: `${c.path} is publicly reachable`,
        signalCorrelated: true,
      },
    });
  }
  return findings;
}
