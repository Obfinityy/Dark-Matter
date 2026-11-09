// Dark Matter rule-based scanner — padding oracle signal detector (#53).
//
// Defensive purpose: detect CBC padding-validity oracles on authorized
// targets so the owner can fix them. HONEST SCOPE (binding): this is a
// BOUNDED oracle-SIGNAL probe only — D1 ciphertext inventory + <=8
// differential mutations per sink to confirm an oracle SIGNAL (two distinct
// response families). Full plaintext byte-recovery (Vaudenay, hundreds of
// queries) is explicitly OUT of v1 (DoS-adjacent). A finding reads
// "padding oracle LIKELY — lab-scale confirmation required", never a
// claimed decrypted plaintext.
//   D1. Surface: cookie/hidden-field/param values that base64/hex-decode
//       to a multiple of 16 bytes (AES block size).
//   D2. Oracle-signal probe (<=8): bit-flip last byte of last block,
//       bit-flip first byte of last block, truncate final block, original
//       control. Families: status/body/redirect/timing-class.
//   D3. Proof: two distinct families vs control + repeat reproduces.
//   DoS guard: abort if median latency degrades >3x vs control.
//
// Grading: MEDIUM = confirmed signal on auth/session sink; LOW = weak
// signal; INFO = uniform responses. Class key: paddingOracle.

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

async function reqWithCookie(url, cookieName, cookieVal, opts = {}) {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, Cookie: `${cookieName}=${cookieVal}` },
      redirect: 'manual',
    });
    const text = await res.text().catch(() => '');
    return {
      status: res.status, text: text.slice(0, 2000),
      location: res.headers.get('location') || '',
      ms: Date.now() - t0,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function tryDecode(v) {
  // Returns {bytes, enc} if ciphertext-shaped, else null.
  const s = String(v).trim();
  try {
    if (/^[A-Za-z0-9+/=_-]{24,}$/.test(s)) {
      const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
      const buf = Buffer.from(b64, 'base64');
      if (buf.length >= 16 && buf.length % 16 === 0) return { bytes: buf, enc: 'base64' };
    }
  } catch {}
  try {
    if (/^[0-9a-fA-F]{32,}$/.test(s) && s.length % 2 === 0) {
      const buf = Buffer.from(s, 'hex');
      if (buf.length >= 16 && buf.length % 16 === 0) return { bytes: buf, enc: 'hex' };
    }
  } catch {}
  return null;
}

function encode(buf, enc) {
  return enc === 'hex' ? buf.toString('hex') : buf.toString('base64');
}

function family(r) {
  if (!r) return 'ERR';
  const errSig = (r.text.match(/(padding|decrypt|decrypt|invalid|cipher|bad data|ticket)[^<>{}]{0,60}/i) || [''])[0].slice(0, 60);
  return `${r.status}|${r.location.slice(0, 60)}|${errSig}|${r.text.length > 0 ? r.text.slice(0, 80) : ''}`;
}

// ---- D1: ciphertext-shaped cookie inventory ------------------------------------------------
async function d1Cookies(url, opts) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  let setCookies = [];
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA }, redirect: 'manual' });
    setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    await res.text().catch(() => '');
  } catch {
  } finally {
    clearTimeout(t);
  }
  const out = [];
  for (const c of setCookies) {
    const m = c.match(/^([^=;]+)=([^;]*)/);
    if (!m) continue;
    const dec = tryDecode(decodeURIComponent(m[2] || ''));
    if (dec) out.push({ name: m[1].trim(), value: m[2], ...dec });
  }
  return out;
}

// ---- D2/D3: bounded oracle-signal probe ----------------------------------------------------------
async function d2Signal(url, sink, opts) {
  const { name, value, bytes, enc } = sink;
  const probes = [];
  // Control first (DoS-guard baseline).
  const rCtrl = await reqWithCookie(url, name, value, opts);
  if (!rCtrl) return null;
  const fCtrl = family(rCtrl);
  // (1) flip one bit in LAST byte of last block.
  const b1 = Buffer.from(bytes);
  b1[b1.length - 1] ^= 0x01;
  // (2) flip one bit in FIRST byte of last block.
  const b2 = Buffer.from(bytes);
  b2[b2.length - 16] ^= 0x01;
  // (3) truncate final block.
  const b3 = bytes.subarray(0, bytes.length - 16);
  const mutations = [
    { label: 'flip-last-byte', val: encode(b1, enc) },
    { label: 'flip-first-byte-last-block', val: encode(b2, enc) },
    { label: 'truncate-last-block', val: encode(b3, enc) },
  ];
  const families = new Map(); // family -> {label, sample}
  for (const mt of mutations) {
    const r = await reqWithCookie(url, name, mt.val, opts);
    if (!r) continue;
    // DoS guard.
    if (r.ms > rCtrl.ms * 3 && rCtrl.ms > 200) return { guard: true };
    const f = family(r);
    if (!families.has(f)) families.set(f, { label: mt.label, sample: r });
    probes.push({ mt, r });
    if (probes.length >= 6) break; // hard cap headroom for the repeat
  }
  // Distinct families vs control?
  const distinct = [...families.entries()].filter(([f]) => f !== fCtrl);
  if (distinct.length === 0) return { signal: false };
  // Reproducibility: repeat the first distinct mutation (uses 2 of the cap).
  const rep = distinct[0][1];
  const mtRep = mutations.find((x) => x.label === rep.label);
  const rRep = mtRep ? await reqWithCookie(url, name, mtRep.val, opts) : null;
  const reproduced = rRep && family(rRep) === distinct[0][0];
  return {
    signal: true, reproduced: !!reproduced,
    ctrlFamily: fCtrl, distinctFamily: distinct[0][0],
    ctrlSample: rCtrl, distinctSample: rep.sample,
    label: rep.label,
  };
}

const AUTH_SINK_RES = /remember|auth|session|ticket|token/i;

export async function probePaddingOracle(url, opts = {}) {
  const findings = [];
  // Coverage diagnostic: a cookie-sink probe — it attempts no
  // params by design; the surface is ciphertext-shaped cookies.
  if (opts && opts.diagnostics) {
    opts.diagnostics.pointsAttempted = [];
    opts.diagnostics.coverageNote = 'cookie-sink probe — no params attempted by design';
  }
  const sinks = await d1Cookies(url, opts);
  for (const sink of sinks.slice(0, 3)) {
    const res = await d2Signal(url, sink, opts);
    if (!res || res.guard || !res.signal) continue; // INFO exit
    const isAuth = AUTH_SINK_RES.test(sink.name);
    const strong = res.reproduced;
    const severity = isAuth && strong ? 'medium' : 'low';
    findings.push({
      class: 'paddingOracle',
      id: `pad-${rand()}`,
      title: `Padding oracle LIKELY — distinct decrypt-error families on ${sink.name} (${severity.toUpperCase()})`,
      severity,
      url,
      parameter: sink.name,
      evidence: ev(
        `Cookie ${sink.name}=<ciphertext> vs ${res.label} mutation (<=8 probes, repeat ${res.reproduced ? 'reproduced' : 'not reproduced'})`,
        `Control family: "${res.ctrlFamily.slice(0, 120)}" vs mutated family: "${res.distinctFamily.slice(0, 120)}" — padding-validity signal. Lab-scale confirmation required; no plaintext claimed (v1 honest scope).`,
        'Defensive finding: CBC padding oracle primitive; rotate to encrypt-then-MAC.'
      ),
    });
    if (findings.length >= 2) break;
  }
  return findings;
}

export const __padMeta = { phases: ['padding-oracle'], depth: ['standard', 'deep'] };
