// Dark Matter rule-based scanner — sensitive-file exposure probe.
// Oracle: HTTP 200 + content marker per path.
const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

const FILE_CHECKS = [
  { path: '/.git/HEAD', marker: 'ref:', title: 'Exposed .git/HEAD', severity: 'high' },
  { path: '/.env', marker: '=', title: 'Exposed .env file', severity: 'critical' },
  { path: '/phpinfo.php', marker: 'phpinfo()', title: 'Exposed phpinfo()', severity: 'medium' },
  { path: '/server-status', marker: 'Apache Status', title: 'Exposed Apache server-status', severity: 'medium' },
  { path: '/.DS_Store', marker: null, title: 'Exposed .DS_Store', severity: 'low' },
];

async function get(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA, ...(opts.headers || {}) } });
    const text = await res.text().catch(() => '');
    return { status: res.status, text: text.slice(0, 5000) };
  } finally {
    clearTimeout(t);
  }
}

export async function probeSensitiveFiles(baseUrl, opts = {}) {
  const findings = [];
  const base = String(baseUrl).replace(/\/$/, '');
  for (const c of FILE_CHECKS) {
    let res;
    try {
      res = await get(base + c.path, opts);
    } catch {
      continue;
    }
    if (res.status === 200 && (!c.marker || res.text.includes(c.marker))) {
      findings.push({
        class: 'sensitive_file',
        id: `sensitive-file-${c.path.replace(/[^a-z0-9]/gi, '')}`,
        title: c.title,
        severity: c.severity,
        url: base + c.path,
        evidence: {
          request: `GET ${base + c.path}`,
          response: `HTTP 200${c.marker ? ` containing marker "${c.marker}"` : ''}`,
          impact_demo: `${c.path} is publicly reachable`,
          signalCorrelated: true,
        },
      });
    }
  }
  return findings;
}
