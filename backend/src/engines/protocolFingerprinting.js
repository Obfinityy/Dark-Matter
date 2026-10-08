/**
 * protocolFingerprinting.js — Protocol-level stack fingerprinting for authorized bug bounty hunts.
 *
 * Turns already-observed protocol behavior into stack-identity evidence:
 *  - ICMP timestamp replies  -> OS family + timezone hints            (idea 661)
 *  - ICMP address-mask replies -> legacy router identification        (idea 662)
 *  - TCP SYN-ACK option loss -> SYN-cookie detection + kernel/load    (idea 663)
 *  - TCP Fast Open options   -> modern-stack support mapping         (idea 664)
 *  - QUIC version negotiation -> stack identification per endpoint    (idea 665)
 *  - Alt-Svc vs QUIC reachability -> HTTP/3 deployment correlation    (idea 666)
 *  - Banner + behavior + TLS + visual -> one confidence score         (idea 667)
 *
 * All functions are pure: they analyze observation objects the hunter has
 * already collected (packet replies, response headers, TLS metadata). They
 * never send traffic themselves and contain no exploit payloads.
 */

const DAY_MS = 86400000;

/** Known QUIC version identifiers. */
const QUIC_VERSIONS = new Map([
  [0x00000001, { name: 'QUIC v1 (RFC 9000)', family: 'ietf', modern: true }],
  [0x6b3343cf, { name: 'QUIC v2 (RFC 9369)', family: 'ietf', modern: true }],
  [0xff00001b, { name: 'QUIC draft-27', family: 'ietf-draft', modern: false }],
  [0xff00001c, { name: 'QUIC draft-28', family: 'ietf-draft', modern: false }],
  [0xff00001d, { name: 'QUIC draft-29', family: 'ietf-draft', modern: false }],
  [0xff00001e, { name: 'QUIC draft-30', family: 'ietf-draft', modern: false }],
  [0xff00001f, { name: 'QUIC draft-31', family: 'ietf-draft', modern: false }],
  [0xff000020, { name: 'QUIC draft-32', family: 'ietf-draft', modern: false }],
  [0xff000021, { name: 'QUIC draft-33', family: 'ietf-draft', modern: false }],
  [0xff000022, { name: 'QUIC draft-34', family: 'ietf-draft', modern: false }],
  [0x51303334, { name: 'gQUIC Q034 (Google)', family: 'google', modern: false }],
  [0x51303436, { name: 'gQUIC Q046 (Google)', family: 'google', modern: false }],
  [0x51303530, { name: 'gQUIC Q050 (Google)', family: 'google', modern: false }],
]);

/** Linux SYN-cookie MSS table: cookies encode the MSS in 3 bits, so the
 *  advertised MSS can only be one of these values. */
const SYN_COOKIE_MSS_TABLE = [536, 1300, 1440, 1460];

/** TCP option kinds relevant to fingerprinting. */
const TCP_OPT = {
  MSS: 2,
  WINDOW_SCALE: 3,
  SACK_PERMITTED: 4,
  TIMESTAMPS: 8,
  FAST_OPEN: 34,
};

/**
 * Idea 661 — Analyze an ICMP timestamp reply (type 14) for OS and timezone hints.
 *
 * Timestamp fields carry milliseconds since midnight UTC. Stacks differ in
 * whether they answer at all and how they fill the fields:
 *  - Linux/BSD kernels typically ignore timestamp requests entirely.
 *  - Windows fills receive + transmit with nearly equal values.
 *  - Embedded/legacy stacks sometimes fill transmit only, or return local
 *    time instead of UTC (which leaks a timezone offset).
 *
 * @param {{originateMs?: number, receiveMs?: number, transmitMs?: number, rttMs?: number}} reply
 *   originateMs: value we sent; receiveMs/transmitMs: values returned (null when no reply).
 * @returns {{responded: boolean, clockSkewMs: number|null, osHint: string, timezoneHint: string|null, notes: string[]}}
 */
export function analyzeIcmpTimestampReply(reply = {}) {
  const { originateMs, receiveMs, transmitMs, rttMs = 0 } = reply;
  const notes = [];
  if (receiveMs == null || transmitMs == null) {
    return {
      responded: false,
      clockSkewMs: null,
      osHint: 'linux-bsd-family',
      timezoneHint: null,
      notes: [
        'No ICMP timestamp reply — Linux/BSD-family kernels commonly ignore type-13 requests.',
      ],
    };
  }

  // Clock skew: how far the target clock is from ours, in ms.
  const clockSkewMs = Math.round(transmitMs - originateMs - rttMs / 2);

  let osHint = 'unknown';
  if (transmitMs === 0 && receiveMs === 0) {
    osHint = 'non-conformant-stub';
    notes.push('Reply carries zero timestamps — non-conformant or stub implementation.');
  } else if (transmitMs > 0 && receiveMs === 0) {
    osHint = 'embedded-legacy';
    notes.push(
      'Transmit-only reply is typical of embedded/legacy stacks (printers, old appliances).'
    );
  } else if (Math.abs(transmitMs - receiveMs) < 1000) {
    osHint = 'windows-like';
    notes.push('Receive and transmit timestamps nearly equal — behavior seen in Windows stacks.');
  } else {
    osHint = 'unix-like';
    notes.push('Receive/transmit diverge — behavior seen in some Unix-derived stacks.');
  }

  // Timezone hint: a skew that lands on a near-whole-hour offset suggests the
  // target returns local time instead of UTC (non-conformant legacy behavior).
  let timezoneHint = null;
  const hours = Math.round(clockSkewMs / 3600000);
  const residual = Math.abs(clockSkewMs - hours * 3600000);
  if (hours !== 0 && residual < 120000) {
    const sign = hours > 0 ? '+' : '-';
    const hh = String(Math.abs(hours)).padStart(2, '0');
    timezoneHint = `${sign}${hh}:00`;
    notes.push(
      `Clock is ~${Math.abs(hours)}h off UTC on a whole-hour boundary — legacy stack may return local time (hint: UTC${sign}${Math.abs(hours)}).`
    );
  }

  return { responded: true, clockSkewMs, osHint, timezoneHint, notes };
}

/**
 * Idea 662 — Interpret an ICMP address-mask reply (type 18) for legacy router identification.
 *
 * Address-mask requests (RFC 950) are long deprecated; a host that answers is
 * almost certainly a legacy router or appliance (Cisco IOS, old BSD).
 *
 * @param {{mask?: string|null}} reply  mask as dotted-quad, e.g. "255.255.255.0".
 * @returns {{responded: boolean, mask: string|null, prefixLength: number|null, legacy: boolean, addressClass: string|null, hint: string}}
 */
export function analyzeAddressMaskReply(reply = {}) {
  const mask = reply.mask ?? null;
  if (!mask) {
    return {
      responded: false,
      mask: null,
      prefixLength: null,
      legacy: false,
      addressClass: null,
      hint: 'No address-mask reply — expected of modern stacks (RFC 950 behavior removed).',
    };
  }
  const octets = String(mask)
    .split('.')
    .map(o => Number(o));
  const valid = octets.length === 4 && octets.every(o => Number.isInteger(o) && o >= 0 && o <= 255);
  let prefixLength = null;
  if (valid) {
    const bits = octets.map(o => o.toString(2).padStart(8, '0')).join('');
    const contiguous = /^1*0*$/.test(bits);
    prefixLength = contiguous ? bits.match(/^1*/)[0].length : null;
  }
  let addressClass = null;
  if (prefixLength === 8) addressClass = 'A (legacy classful)';
  else if (prefixLength === 16) addressClass = 'B (legacy classful)';
  else if (prefixLength === 24) addressClass = 'C (legacy classful)';
  else if (prefixLength != null) addressClass = `CIDR /${prefixLength}`;

  return {
    responded: true,
    mask,
    prefixLength,
    legacy: true,
    addressClass,
    hint: `Host answered ICMP address-mask — legacy router/appliance behavior (Cisco IOS, old BSD). Mask ${mask}${addressClass ? ` → ${addressClass}` : ''}.`,
  };
}

/**
 * Idea 663 — Detect TCP SYN cookies from a SYN-ACK to infer kernel family and load.
 *
 * When SYN cookies are active the server keeps no per-connection state, so it
 * cannot echo back negotiated TCP options: a SYN-ACK that drops Window Scale,
 * SACK-permitted and Timestamps we offered is the classic tell. Linux encodes
 * the MSS in the cookie's 3-bit MSS field, so the returned MSS can only be one
 * of a small table of values — a second independent tell.
 *
 * @param {{synOptions?: Array<{kind:number}>, synAckOptions?: Array<{kind:number}>, synAckMss?: number}} obs
 * @returns {{synCookies: boolean, confidence: 'high'|'medium'|'low', kernelHint: string, loadHint: string, evidence: object, notes: string[]}}
 */
export function detectSynCookies(obs = {}) {
  const synKinds = new Set((obs.synOptions || []).map(o => o.kind));
  const ackKinds = new Set((obs.synAckOptions || []).map(o => o.kind));
  const statefulKinds = [TCP_OPT.WINDOW_SCALE, TCP_OPT.SACK_PERMITTED, TCP_OPT.TIMESTAMPS];
  const requested = statefulKinds.filter(k => synKinds.has(k));
  const echoed = requested.filter(k => ackKinds.has(k));
  const missing = requested.filter(k => !ackKinds.has(k));
  const notes = [];

  const mssMatchesTable = obs.synAckMss != null && SYN_COOKIE_MSS_TABLE.includes(obs.synAckMss);
  if (mssMatchesTable) {
    notes.push(
      `SYN-ACK MSS ${obs.synAckMss} matches the Linux SYN-cookie MSS table — Linux-like kernel.`
    );
  }

  let synCookies = false;
  let confidence = 'low';
  if (requested.length > 0 && missing.length === requested.length) {
    synCookies = true;
    confidence = mssMatchesTable ? 'high' : 'medium';
    notes.push(
      `Offered options [${requested.join(', ')}] all dropped in SYN-ACK — server kept no state (SYN cookies active).`
    );
  } else if (missing.length > 0) {
    notes.push(
      `Partial option echo [missing: ${missing.join(', ')}] — inconclusive; middlebox may be normalizing.`
    );
  } else {
    notes.push('Negotiated options echoed normally — no SYN-cookie evidence.');
  }

  return {
    synCookies,
    confidence,
    kernelHint: mssMatchesTable ? 'linux-like' : 'unknown',
    loadHint: synCookies
      ? 'high (SYN backlog under pressure — flood mitigation active)'
      : 'normal (stateful handshake)',
    evidence: { requested, echoed, missing, synAckMss: obs.synAckMss ?? null, mssMatchesTable },
    notes,
  };
}

/**
 * Idea 664 — Map TCP Fast Open support from SYN-ACK options (kind 34).
 *
 * TFO support marks a modern stack (Linux 3.6+, recent FreeBSD, Windows 10+).
 * A server that answers our TFO request with a cookie issues one for future
 * 0-RTT data; absence of the option means no TFO support.
 *
 * @param {{synAckOptions?: Array<{kind:number, data?: string}>, requested?: boolean}} obs
 *   data: option payload as hex string.
 * @returns {{supported: boolean, hasCookie: boolean, cookieHex: string|null, cookieLength: number, stackHint: string, notes: string[]}}
 */
export function mapTcpFastOpen(obs = {}) {
  const tfo = (obs.synAckOptions || []).find(o => o.kind === TCP_OPT.FAST_OPEN) || null;
  const notes = [];
  const supported = tfo !== null;
  const cookieHex = tfo && tfo.data ? String(tfo.data).replace(/^0x/i, '') : null;
  const cookieLength = cookieHex ? cookieHex.length / 2 : 0;
  const hasCookie = cookieLength >= 4 && cookieLength <= 16;

  if (supported && hasCookie) {
    notes.push(
      `Server issued a ${cookieLength}-byte TFO cookie — 0-RTT resumption available on this endpoint.`
    );
  } else if (supported) {
    notes.push(
      'TFO option present without a cookie — support confirmed, cookie not issued for this handshake.'
    );
  } else if (obs.requested) {
    notes.push('TFO requested but option absent in SYN-ACK — no TFO support on this endpoint.');
  }

  return {
    supported,
    hasCookie,
    cookieHex,
    cookieLength,
    stackHint: supported
      ? 'modern stack (Linux 3.6+ / recent FreeBSD / Windows 10+)'
      : 'no TFO support (older or hardened stack)',
    notes,
  };
}

/**
 * Check whether a 32-bit QUIC version value is a GREASE/reserved version (RFC 9287).
 * @param {number} v
 * @returns {boolean}
 */
export function isGreasedQuicVersion(v) {
  return (v & 0x0f0f0f0f) === 0x0a0a0a0a;
}

/**
 * Idea 665 — Map QUIC version-negotiation data to stack identification per endpoint.
 *
 * @param {{endpoint?: string, versions?: number[]}} obs
 *   versions: supported-version list parsed from a Version Negotiation packet.
 * @returns {{endpoint: string|null, versions: Array<{version:number, hex:string, name:string, family:string, modern:boolean}>, stackHint: string, modern: boolean}}
 */
export function mapQuicVersionNegotiation(obs = {}) {
  const versions = (obs.versions || []).map(v => {
    const known = QUIC_VERSIONS.get(v >>> 0);
    const hex = `0x${(v >>> 0).toString(16).padStart(8, '0')}`;
    if (known) return { version: v >>> 0, hex, ...known };
    if (isGreasedQuicVersion(v >>> 0)) {
      return {
        version: v >>> 0,
        hex,
        name: 'Reserved (GREASE, RFC 9287)',
        family: 'grease',
        modern: true,
      };
    }
    return { version: v >>> 0, hex, name: 'Unknown version', family: 'unknown', modern: false };
  });

  const families = new Set(versions.map(v => v.family));
  let stackHint = 'no QUIC versions observed';
  if (families.has('google')) stackHint = 'Google gQUIC legacy (Q0xx) — 2016-era stack';
  else if (families.has('ietf-draft'))
    stackHint = '2020-era draft stack (quiche/Chromium draft-27..34)';
  else if (families.has('ietf')) stackHint = 'modern RFC 9000 stack';
  if (families.has('grease')) stackHint += ' + GREASE-capable (Chromium-family)';

  return {
    endpoint: obs.endpoint ?? null,
    versions,
    stackHint,
    modern: versions.some(v => v.modern),
  };
}

/**
 * Idea 666 — Correlate Alt-Svc advertisements with actual QUIC reachability.
 *
 * Parses Alt-Svc response headers and joins them against real QUIC handshake
 * probes: an advertised h3 endpoint that never answers QUIC is a stale
 * advertisement or filtered UDP; a reachable QUIC port with no advertisement
 * is an undocumented endpoint worth mapping.
 *
 * @param {{headers?: object, quicProbes?: Array<{port:number, reachable:boolean, negotiatedVersion?: number}>}} obs
 * @returns {{advertised: Array<{protocol:string, authority:string, port:number, maxAge:number|null}>, correlations: Array<{protocol:string, port:number, advertised:boolean, reachable:boolean|null, status:string}>}}
 */
export function correlateAltSvc(obs = {}) {
  const raw = String((obs.headers || {})['alt-svc'] || (obs.headers || {})['Alt-Svc'] || '');
  const advertised = [];
  const entryRe = /([A-Za-z0-9._-]+)="([^"]+)"([^,]*)/g;
  let m;
  while ((m = entryRe.exec(raw)) !== null) {
    const protocol = m[1];
    const authority = m[2];
    const maMatch = /ma=(\d+)/.exec(m[3]);
    const portMatch = /:(\d+)$/.exec(authority);
    advertised.push({
      protocol,
      authority,
      port: portMatch ? Number(portMatch[1]) : 443,
      maxAge: maMatch ? Number(maMatch[1]) : null,
    });
  }

  const probes = new Map((obs.quicProbes || []).map(p => [p.port, p]));
  const correlations = [];
  const seen = new Set();

  for (const adv of advertised) {
    const probe = probes.get(adv.port);
    seen.add(adv.port);
    let status;
    if (!probe) status = 'advertised-not-probed';
    else if (probe.reachable) status = 'confirmed';
    else status = 'advertised-unreachable';
    correlations.push({
      protocol: adv.protocol,
      port: adv.port,
      advertised: true,
      reachable: probe ? probe.reachable : null,
      negotiatedVersion: probe && probe.negotiatedVersion != null ? probe.negotiatedVersion : null,
      status,
      note:
        status === 'advertised-unreachable'
          ? 'Advertises HTTP/3 but QUIC handshake failed — stale advertisement or filtered UDP.'
          : status === 'confirmed'
            ? 'Alt-Svc advertisement matches a live QUIC endpoint.'
            : 'Advertised but not yet probed — schedule a QUIC handshake.',
    });
  }
  for (const [port, probe] of probes) {
    if (seen.has(port) || !probe.reachable) continue;
    correlations.push({
      protocol: probe.negotiatedVersion != null ? 'h3?' : 'quic',
      port,
      advertised: false,
      reachable: true,
      negotiatedVersion: probe.negotiatedVersion ?? null,
      status: 'undocumented-quic',
      note: 'QUIC answers on a port with no Alt-Svc advertisement — undocumented endpoint.',
    });
  }

  return { advertised, correlations };
}

/**
 * Idea 667 — Combine banner, behavior, TLS and visual signals into one
 * service-identity confidence score.
 *
 * Each signal votes for a candidate service identity with a confidence value;
 * the winning candidate's weighted support becomes the 0–100 score. Disagreeing
 * signals lower the score, which is exactly what a hunter needs before
 * trusting a banner.
 *
 * @param {{banner?: {candidate:string, version?:string, confidence:number}, behavior?: {candidate:string, confidence:number}, tls?: {candidate:string, confidence:number}, visual?: {candidate:string, confidence:number}}} signals
 * @returns {{service:string|null, version:string|null, score:number, confidence:'high'|'medium'|'low', agreement:string, breakdown:Array<{signal:string, candidate:string, weight:number, confidence:number, agrees:boolean}>, notes:string[]}}
 */
export function scoreServiceIdentity(signals = {}) {
  const weights = { banner: 0.3, behavior: 0.3, tls: 0.25, visual: 0.15 };
  const votes = [];
  for (const [signal, weight] of Object.entries(weights)) {
    const s = signals[signal];
    if (s && s.candidate)
      votes.push({
        signal,
        weight,
        candidate: String(s.candidate),
        confidence: Number(s.confidence) || 0,
      });
  }
  const notes = [];
  if (votes.length === 0) {
    return {
      service: null,
      version: null,
      score: 0,
      confidence: 'low',
      agreement: '0/0',
      breakdown: [],
      notes: ['No identity signals provided.'],
    };
  }

  const support = new Map();
  for (const v of votes) {
    const cur = support.get(v.candidate) || 0;
    support.set(v.candidate, cur + v.weight * v.confidence);
  }
  const winner = [...support.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const totalWeight = votes.reduce((sum, v) => sum + v.weight, 0);
  const agreeing = votes.filter(v => v.candidate === winner).length;
  const score = Math.round((100 * support.get(winner)) / totalWeight);
  const confidence = score >= 75 ? 'high' : score >= 45 ? 'medium' : 'low';
  if (agreeing < votes.length) {
    notes.push(
      `${votes.length - agreeing} signal(s) disagree with "${winner}" — treat the banner with suspicion.`
    );
  } else {
    notes.push(`All ${votes.length} signal(s) agree on "${winner}".`);
  }

  const breakdown = votes.map(v => ({
    signal: v.signal,
    candidate: v.candidate,
    weight: v.weight,
    confidence: v.confidence,
    agrees: v.candidate === winner,
  }));

  return {
    service: winner,
    version:
      signals.banner && signals.banner.candidate === winner
        ? (signals.banner.version ?? null)
        : null,
    score,
    confidence,
    agreement: `${agreeing}/${votes.length}`,
    breakdown,
    notes,
  };
}

export const PROTOCOL_FINGERPRINTING = {
  analyzeIcmpTimestampReply,
  analyzeAddressMaskReply,
  detectSynCookies,
  mapTcpFastOpen,
  isGreasedQuicVersion,
  mapQuicVersionNegotiation,
  correlateAltSvc,
  scoreServiceIdentity,
  QUIC_VERSIONS,
  SYN_COOKIE_MSS_TABLE,
};

export default PROTOCOL_FINGERPRINTING;
