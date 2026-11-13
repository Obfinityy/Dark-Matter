// Dark Matter rule-based scanner — path traversal / LFI probe.
// Oracle: known file-content markers (root:x:0:0 / [extensions]) in the response.
//
// Coverage rows #231 (directory / path traversal) and #232 (LFI) ride the
// relative ../ legs; row #230 [High] (Absolute Path Traversal) rides the
// absolute legs below: the bare absolute path is sent as the parameter
// value and confirms ONLY on the file-content marker.
//
// Ordering: relative legs are tried first, absolute legs after, and the
// first confirming leg wins per parameter (one finding per param — the
// pre-lane behaviour). The absolute leg therefore fires exactly in the
// #230 shape: a server that blocks ../ but opens a bare absolute path
// directly. A server that falls to ../ is already proven vulnerable by
// the relative leg, so the absolute leg is not re-tried there.
import { mutateUrl, probePointName, probePointParameter, noteAttemptedPoints } from '../probePoints.js';
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


const TRAVERSAL_CASES = [
  { payload: '../../../../../../../../etc/passwd', marker: 'root:x:0:0', os: 'unix', kind: 'relative' },
  { payload: '..\\..\\..\\..\\..\\..\\windows\\win.ini', marker: '[extensions]', os: 'windows', kind: 'relative' },
  { payload: '/etc/passwd', marker: 'root:x:0:0', os: 'unix', kind: 'absolute' },
  { payload: 'C:\\windows\\win.ini', marker: '[extensions]', os: 'windows', kind: 'absolute' },
];

export async function probeTraversal(url, params, opts = {}) {
  const findings = [];
  noteAttemptedPoints(opts, params.slice(0, 10));
  for (const param of params.slice(0, 10)) {
    for (const { payload, marker, os, kind } of TRAVERSAL_CASES) {
      let body;
      try {
        body = await get(mutateUrl(url, param, payload), opts);
      } catch {
        continue;
      }
      if (body.includes(marker)) {
        const idx = body.indexOf(marker);
        const window = body.slice(Math.max(0, idx - 60), idx + 120);
        const absolute = kind === 'absolute';
        findings.push({
          class: 'lfi',
          id: `traversal-${probePointName(param)}-${os}${absolute ? '-absolute' : ''}`,
          title: `${absolute ? 'Absolute path traversal' : 'Path traversal'} / local file inclusion in parameter '${probePointParameter(param)}' (${os})`,
          severity: 'high',
          url,
          param: probePointParameter(param),
          evidence: {
            request: `GET ${mutateUrl(url, param, payload)}`,
            response: `file-content marker present — "...${window}..."`,
            impact_demo: os === 'unix'
              ? `read /etc/passwd via ${absolute ? 'absolute path' : 'traversal'}`
              : `read win.ini via ${absolute ? 'absolute path' : 'traversal'}`,
            signalCorrelated: true,
          },
        });
        break;
      }
    }
  }
  return findings;
}
