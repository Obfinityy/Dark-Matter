// Dark Matter rule-based scanner — path traversal / LFI probe.
// Oracle: known file-content markers (root:x:0:0 / [extensions]) in the response.
const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

async function get(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA } });
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
        body = await get(withParam(url, param, payload), opts.timeoutMs);
      } catch {
        continue;
      }
      if (body.includes(marker)) {
        findings.push({
          class: 'lfi',
          id: `traversal-${param}-${os}`,
          title: `Path traversal / local file inclusion in parameter '${param}' (${os})`,
          severity: 'high',
          url,
          param,
          evidence: {
            request: `GET ${withParam(url, param, payload)}`,
            response: `file-content marker present: "${marker}"`,
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
