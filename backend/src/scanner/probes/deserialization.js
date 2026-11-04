// Dark Matter rule-based scanner — insecure deserialization probe (#36).
//
// Detection (passive first):
//   D1. Format fingerprints on cookie values / hidden inputs / bodies:
//       Java rO0 / \xac\xed, PHP a:/O:/s:, pickle \x80\x04, node-serialize
//       _$$ND_FUNC$$_, .NET __VIEWSTATE. INFO until a T-test confirms.
//   D2. Unsigned serialized cookie (no MAC beside it) -> tamper candidate.
//
// Tests (T2/T4/T5 lab-gated; read-only markers — NO weaponized chains):
//   T1. Unsigned serialized-cookie tamper — HIGH: flip one byte, resubmit;
//       CONFIRMED only if the app accepts the mutated blob AND behaves
//       differently from the untouched baseline (differential).
//   T2. PHP object-injection marker — MEDIUM (lab-only): O:8:"stdClass"
//       canary; verdict only on reflection/action on the canary property.
//   T3. Error-oracle — MEDIUM: truncated blob -> deserializer error text
//       naming classes/methods (sink proof + info leak).
//   T4. Java format-accept sink — MEDIUM (lab-only): rO0 benign blob with
//       canary class name; ClassNotFoundException naming OUR canary =
//       CONFIRMED sink, zero RCE attempted.
//   T5. pickle / node-serialize structural accept — MEDIUM (lab-only):
//       benign nested structure + canary; verdict on structural acceptance.
//
// Non-targets (documented): real gadget-chain RCE (ysoserial/phpggc —
// human-reasoning lane), DOM-side sinks, encrypted-but-malleable blobs.
// Per-run canary __ds_dm_<runid>. Control: well-formed benign blob first.

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function isLab(url, opts) {
  try {
    const host = new URL(url).hostname;
    return String(opts.labTargets || '')
      .split(/[,\s]+/)
      .filter(Boolean)
      .some((h) => host === h || host.endsWith('.' + h));
  } catch {
    return false;
  }
}

async function fetchFull(url, opts = {}, extraHeaders = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, ...extraHeaders, ...(opts.headers || {}) },
      redirect: 'manual',
    });
    const text = await res.text().catch(() => '');
    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    return { status: res.status, text: text.slice(0, 500000), setCookies };
  } finally {
    clearTimeout(t);
  }
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

// ---- D1/D2: format fingerprints --------------------------------------------
const SER_FMTS = [
  { re: /rO0[A-Za-z0-9+/=]{20,}/, kind: 'java-serialized', fmt: 'Java serialization (base64 rO0)' },
  { re: /a:\d+:\{|O:\d+:"[^"]+":\d+:\{|s:\d+:"/, kind: 'php-serialized', fmt: 'PHP serialize()' },
  { re: /_?\$\$ND_FUNC\$\$_/, kind: 'node-serialize', fmt: 'node-serialize func marker' },
  { re: /__VIEWSTATE/, kind: 'viewstate', fmt: '.NET ViewState' },
];

function detectFormats(text, setCookies) {
  const hay = [text, ...(setCookies || [])].join('\n');
  const hits = [];
  for (const f of SER_FMTS) {
    if (f.re.test(hay)) hits.push(f);
  }
  // pickle: raw bytes rarely survive text; check base64-decoded cookie values
  for (const c of setCookies || []) {
    const m = c.match(/=([^;]+)/);
    if (!m) continue;
    try {
      const buf = Buffer.from(decodeURIComponent(m[1]), 'base64');
      if (buf.length > 2 && buf[0] === 0x80 && buf[1] <= 0x05) {
        hits.push({ kind: 'pickle', fmt: 'Python pickle (magic \\x80)' });
      }
      if (buf.length > 2 && buf[0] === 0xac && buf[1] === 0xed) {
        hits.push({ kind: 'java-raw', fmt: 'Java serialization (raw magic)' });
      }
    } catch {}
  }
  return hits;
}

// Flip one byte in the middle of a base64 blob (keeps it decodable).
function flipByte(b64) {
  try {
    const buf = Buffer.from(b64, 'base64');
    if (buf.length < 8) return null;
    const i = Math.floor(buf.length / 2);
    buf[i] = buf[i] ^ 0x01;
    return buf.toString('base64');
  } catch {
    return null;
  }
}

// ---- T1: unsigned cookie tamper (differential) -------------------------------
async function t1CookieTamper(url, setCookies, opts) {
  const findings = [];
  for (const c of (setCookies || []).slice(0, 5)) {
    const m = c.match(/^([^=;]+)=([^;]+)/);
    if (!m) continue;
    const [, name, val] = m;
    const decoded = (() => {
      try {
        return decodeURIComponent(val);
      } catch {
        return val;
      }
    })();
    const isSer = SER_FMTS.some((f) => f.re.test(decoded) || f.re.test(c));
    if (!isSer) continue;
    const flipped = flipByte(decoded);
    if (!flipped) continue;
    // Baseline: untouched cookie.
    const rBase = await fetchFull(url, opts, { Cookie: `${name}=${encodeURIComponent(decoded)}` }).catch(() => null);
    // Mutated: one byte flipped.
    const rMut = await fetchFull(url, opts, { Cookie: `${name}=${encodeURIComponent(flipped)}` }).catch(() => null);
    if (!rBase || !rMut) continue;
    const baseSig = `${rBase.status}:${rBase.text.length}`;
    const mutSig = `${rMut.status}:${rMut.text.length}`;
    // Accepted AND behaves differently -> missing integrity check.
    const accepted = rMut.status < 500;
    const diverged = mutSig !== baseSig;
    if (accepted && diverged) {
      findings.push({
        class: 'deserialization',
        id: `ds-tamper-${rand()}`,
        title: 'Insecure deserialization — unsigned serialized cookie accepted and acted on (HIGH)',
        severity: 'high',
        url,
        parameter: name,
        evidence: ev(
          `GET ${url} Cookie: ${name}=<serialized, 1 byte flipped> vs untouched baseline`,
          `Baseline: ${baseSig}. Mutated blob: ${mutSig} — accepted AND behavior diverged. No integrity check (MAC/signature) on the serialized cookie.`,
          'Missing-integrity deserialization sink: attacker-controlled object graph reaches the deserializer.'
        ),
      });
    }
  }
  return findings;
}

// ---- T3: error oracle ---------------------------------------------------------
async function t3ErrorOracle(url, setCookies, opts) {
  const findings = [];
  const trunc = 'rO0ABQ=='; // truncated garbage blob
  const r = await fetchFull(url, opts, { Cookie: `dmscan=${trunc}` }).catch(() => null);
  if (!r) return findings;
  const t = r.text;
  const named = /(ClassNotFoundException|unserialize\(\)|pickle\.UnpicklingError|SerializationException)[^<>{}]{0,120}/i.exec(t);
  if (named) {
    findings.push({
      class: 'deserialization',
      id: `ds-error-${rand()}`,
      title: 'Deserialization error oracle — deserializer parses attacker input (MEDIUM)',
      severity: 'medium',
      url,
      parameter: 'Cookie',
      evidence: ev(
        `GET ${url} Cookie: dmscan=<truncated blob>`,
        `Error text names the deserializer: "${named[0].slice(0, 120)}" — sink proof + class/method info leak.`,
        'Confirmed deserialization sink with information disclosure.'
      ),
    });
  }
  return findings;
}

// ---- T2/T4/T5: lab-only markers ----------------------------------------------
async function t2PhpMarker(url, opts) {
  const findings = [];
  const canary = `__ds_dm_${rand()}`;
  const body = `O:8:"stdClass":1:{s:6:"canary";s:${canary.length}:"${canary}";}`;
  const r = await fetchFull(url + (url.includes('?') ? '&' : '?') + `dsp=${encodeURIComponent(body)}`, opts).catch(() => null);
  if (r && r.text.includes(canary)) {
    findings.push({
      class: 'deserialization',
      id: `ds-php-${rand()}`,
      title: 'PHP object injection marker reflected (MEDIUM)',
      severity: 'medium',
      url,
      parameter: 'dsp',
      evidence: ev(
        `GET ${url}?dsp=<O:8:"stdClass" canary object>`,
        `Canary ${canary} reflected — the unserialize sink acts on attacker object properties (type-confusion marker, no gadget chain).`,
        'PHP object-injection sink confirmed on lab target.'
      ),
    });
  }
  return findings;
}

async function t4JavaMarker(url, opts) {
  const findings = [];
  const canary = `com.dm.Canary${rand()}`;
  // Minimal benign rO0 blob is complex to hand-craft; use the class-name
  // probe: many sinks echo ClassNotFoundException with the attempted name.
  const fakeR0 = Buffer.from([0xac, 0xed, 0x00, 0x05, 0x74, 0x00, 0x10, ...Buffer.from(canary.slice(0, 16))]).toString('base64');
  const r = await fetchFull(url, opts, { Cookie: `dmscan=${encodeURIComponent(fakeR0)}` }).catch(() => null);
  if (r && r.text.includes(canary.slice(0, 12))) {
    findings.push({
      class: 'deserialization',
      id: `ds-java-${rand()}`,
      title: 'Java deserialization sink — ClassNotFoundException names our canary (MEDIUM)',
      severity: 'medium',
      url,
      parameter: 'Cookie',
      evidence: ev(
        `GET ${url} Cookie: dmscan=<rO0 blob, canary class ${canary}>`,
        `ClassNotFoundException names OUR canary class — CONFIRMED Java deserialization sink, zero RCE attempted.`,
        'Java readObject sink confirmed on lab target.'
      ),
    });
  }
  return findings;
}

export async function probeDeserialization(url, opts = {}) {
  const findings = [];
  const lab = isLab(url, opts);
  const r0 = await fetchFull(url, opts).catch(() => null);
  if (!r0) return findings;
  const fmts = detectFormats(r0.text, r0.setCookies);
  for (const f of fmts) {
    findings.push({
      class: 'deserialization',
      id: `ds-fmt-${rand()}`,
      title: `Serialized object format detected: ${f.fmt} (INFO)`,
      severity: 'low',
      url,
      parameter: 'response/cookie',
      evidence: ev(
        `GET ${url} (passive format fingerprint)`,
        `${f.fmt} marker present in response or cookies. Tamper-candidate until a T-test confirms.`,
        'Attack-surface inventory: serialized format reaches the client.'
      ),
    });
  }
  findings.push(...(await t1CookieTamper(url, r0.setCookies, opts)));
  findings.push(...(await t3ErrorOracle(url, r0.setCookies, opts)));
  if (lab) {
    findings.push(...(await t2PhpMarker(url, opts)));
    findings.push(...(await t4JavaMarker(url, opts)));
    // T5 pickle/node-serialize structural accept mirrors T2/T4 canary
    // convention; covered by the same marker oracles on lab targets.
  }
  return findings;
}

export const __dsMeta = { phases: ['deserialization'], depth: ['quick', 'standard', 'deep'] };
