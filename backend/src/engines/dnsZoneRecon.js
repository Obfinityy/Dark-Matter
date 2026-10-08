/**
 * dnsZoneRecon.js — DNS zone-transfer and zone-intel reconnaissance engine.
 *
 * Implements Dark-Matter idea-bank items 00011–00016 as real, working
 * defensive asset-discovery capabilities. All of these run against targets
 * the operator is authorized to assess:
 *
 *  - 00011: NSEC3PARAM salt-harvesting — parse NSEC3PARAM parameters and
 *           build targeted offline-cracking work estimates (RFC 5155).
 *  - 00012: AXFR over plain TCP — attempt zone transfers on every
 *           authoritative nameserver, including non-standard ports.
 *  - 00013: AXFR over DNS-over-TLS (port 853) — some admins secure DoT
 *           differently from port 53.
 *  - 00014: AXFR-style probing over discovered DNS-over-HTTPS endpoints —
 *           misconfigured HTTPS DNS gateways can leak zone data.
 *  - 00015: ANY-query meta-record mining — collect HINFO / TXT / legacy
 *           records that reveal hostnames and internal naming.
 *  - 00016: NOTIFY / serial-increment timing — detect zone-update patterns
 *           so enumeration can be timed right after new hosts appear.
 *
 * The AXFR probes are misconfiguration *detectors*: they only report whether
 * a server accepted a transfer request. They never dump or exfiltrate zone
 * contents beyond the first response header used for the accept/refuse verdict.
 */

import net from 'node:net';
import tls from 'node:tls';
import dns from 'node:dns';

// ---------------------------------------------------------------------------
// 00011 — NSEC3PARAM salt harvesting / targeted cracking-work estimation
// ---------------------------------------------------------------------------

/**
 * Parse an NSEC3PARAM rdata string as it appears in a zone file or in the
 * textual form of a DNS response.
 * Format: `<algorithm> <flags> <iterations> <salt>` where salt is hex or `-`
 * for an empty salt (RFC 5155 §4).
 *
 * @param {string} rdata e.g. "1 0 10 332539EE7F28395" or "1 0 150 -"
 * @returns {{algorithm:number, flags:number, iterations:number, saltHex:string,
 *           hasSalt:boolean}|null} null when the rdata is malformed
 */
export function parseNsec3Param(rdata) {
  if (typeof rdata !== 'string') return null;
  const parts = rdata.trim().split(/\s+/);
  if (parts.length < 4) return null;
  const algorithm = Number(parts[0]);
  const flags = Number(parts[1]);
  const iterations = Number(parts[2]);
  const saltToken = parts[3];
  if (!Number.isInteger(algorithm) || !Number.isInteger(flags) || !Number.isInteger(iterations)) {
    return null;
  }
  if (iterations < 0 || iterations > 2500) return null;
  const hasSalt = saltToken !== '-';
  if (hasSalt && !/^[0-9a-fA-F]+$/.test(saltToken)) return null;
  return {
    algorithm,
    flags,
    iterations,
    saltHex: hasSalt ? saltToken.toUpperCase() : '',
    hasSalt,
  };
}

/**
 * Assess how feasible offline NSEC3 hash cracking is for a zone, given its
 * NSEC3PARAM parameters, and build a targeted work plan for the operator.
 *
 * This does NOT perform cracking — it quantifies the work factor so the
 * operator can decide whether a dictionary attack is worth attempting with
 * their own hardware, and it assembles the salted-hash parameters needed to
 * configure tools such as hashcat (mode 8300) correctly.
 *
 * @param {{algorithm:number, flags:number, iterations:number, saltHex:string}} params
 *        as returned by {@link parseNsec3Param}
 * @param {{hashesPerSecond?: number}} [opts] operator hardware assumption
 *        (default: 1e9 SHA-1 hashes/s, a mid-range single GPU)
 * @returns {{algorithm:number, iterations:number, saltHex:string,
 *           hashesPerGuess:number, feasibility:'high'|'medium'|'low',
 *           guessesPerSecond:number, timePerMillionGuessesSec:number,
 *           recommendation:string, hashcatMode:number|null}}
 */
export function buildNsec3WorkEstimate(params, opts = {}) {
  if (!params || !Number.isInteger(params.iterations)) {
    throw new Error('buildNsec3WorkEstimate requires parsed NSEC3PARAM params');
  }
  const hashesPerSecond = opts.hashesPerSecond || 1e9;
  // RFC 5155: the iterated hash runs (iterations + 1) SHA-1 passes per guess.
  const hashesPerGuess = params.iterations + 1;
  const guessesPerSecond = hashesPerSecond / hashesPerGuess;
  const timePerMillionGuessesSec = 1e6 / guessesPerSecond;
  // Feasibility bands: RFC 5155 recommends iterations <= 150 for small zones.
  // <=10 is trivially brute-forceable; <=150 is dictionary-feasible on GPUs;
  // above that the work factor starts to deter at scale.
  const feasibility =
    params.iterations <= 10 ? 'high' : params.iterations <= 150 ? 'medium' : 'low';
  const recommendation =
    feasibility === 'high'
      ? 'Iterations are very low — a full dictionary/brute-force pass over hashed names is practical on commodity GPUs.'
      : feasibility === 'medium'
        ? 'Iterations are within RFC-recommended bounds — targeted dictionary attacks with the zone salt are practical; full brute force may be slow.'
        : 'Iteration count is high — restrict to small, high-value dictionaries and salt-aware targeted wordlists.';
  return {
    algorithm: params.algorithm,
    iterations: params.iterations,
    saltHex: params.saltHex,
    hashesPerGuess,
    feasibility,
    guessesPerSecond: Math.round(guessesPerSecond),
    timePerMillionGuessesSec: Math.round(timePerMillionGuessesSec * 100) / 100,
    recommendation,
    // hashcat NSEC3 mode, only when the zone uses SHA-1 (algorithm 1).
    hashcatMode: params.algorithm === 1 ? 8300 : null,
  };
}

/**
 * Collect NSEC3PARAM records across one or more zones into a single
 * salt-harvest report for large-scale offline-cracking triage.
 *
 * @param {{zone:string, rdata:string}[]} zoneParams
 * @param {{hashesPerSecond?: number}} [opts]
 * @returns {{zones:object[], summary:{high:number, medium:number, low:number},
 *           mostAttractive:string|null}}
 */
export function harvestNsec3Salts(zoneParams, opts = {}) {
  const zones = [];
  for (const { zone, rdata } of zoneParams || []) {
    const parsed = parseNsec3Param(rdata);
    if (!parsed) continue;
    zones.push({ zone, ...parsed, estimate: buildNsec3WorkEstimate(parsed, opts) });
  }
  const summary = { high: 0, medium: 0, low: 0 };
  for (const z of zones) summary[z.estimate.feasibility] += 1;
  const ranked = [...zones].sort(
    (a, b) => a.estimate.timePerMillionGuessesSec - b.estimate.timePerMillionGuessesSec
  );
  return { zones, summary, mostAttractive: ranked.length ? ranked[0].zone : null };
}

// ---------------------------------------------------------------------------
// DNS wire helpers shared by the AXFR probes (ideas 00012–00014)
// ---------------------------------------------------------------------------

const TYPE_AXFR = 252;
const TYPE_ANY = 255;
const TYPE_SOA = 6;
const CLASS_IN = 1;

const RCODE_NAMES = {
  0: 'NOERROR',
  1: 'FORMERR',
  2: 'SERVFAIL',
  3: 'NXDOMAIN',
  4: 'NOTIMP',
  5: 'REFUSED',
};

/**
 * Encode a domain name into DNS wire (label-length) format.
 * @param {string} name
 * @returns {Buffer}
 */
export function encodeDnsName(name) {
  const labels = name.replace(/\.$/, '').split('.');
  const parts = [];
  for (const label of labels) {
    const bytes = Buffer.from(label, 'utf8');
    if (bytes.length === 0 || bytes.length > 63) {
      throw new Error(`invalid DNS label in "${name}"`);
    }
    parts.push(Buffer.from([bytes.length]), bytes);
  }
  parts.push(Buffer.from([0x00]));
  return Buffer.concat(parts);
}

/**
 * Build a minimal DNS query message (header + single question).
 *
 * @param {string} name owner name
 * @param {number} qtype query type (252 = AXFR, 255 = ANY, 6 = SOA)
 * @returns {Buffer} wire-format DNS message
 */
export function buildDnsQuery(name, qtype) {
  const header = Buffer.alloc(12);
  header.writeUInt16BE(Math.floor(Math.random() * 0xffff), 0); // ID
  header.writeUInt16BE(0x0100, 2); // flags: standard query, recursion desired
  header.writeUInt16BE(1, 4); // QDCOUNT
  const question = Buffer.concat([encodeDnsName(name), Buffer.alloc(4)]);
  question.writeUInt16BE(qtype, question.length - 4);
  question.writeUInt16BE(CLASS_IN, question.length - 2);
  return Buffer.concat([header, question]);
}

/**
 * Parse just the header of a DNS response — enough for accept/refuse verdicts.
 *
 * @param {Buffer} msg wire-format DNS response
 * @returns {{id:number, rcode:number, rcodeName:string, qdcount:number,
 *           ancount:number, nscount:number, arcount:number}|null}
 */
export function parseDnsHeader(msg) {
  if (!Buffer.isBuffer(msg) || msg.length < 12) return null;
  const flags = msg.readUInt16BE(2);
  const rcode = flags & 0x000f;
  return {
    id: msg.readUInt16BE(0),
    rcode,
    rcodeName: RCODE_NAMES[rcode] || `RCODE${rcode}`,
    qdcount: msg.readUInt16BE(4),
    ancount: msg.readUInt16BE(6),
    nscount: msg.readUInt16BE(8),
    arcount: msg.readUInt16BE(10),
  };
}

/**
 * Length-prefix a DNS message for TCP / TLS / DoT transport (RFC 7766).
 * @param {Buffer} msg
 * @returns {Buffer}
 */
export function frameForTcp(msg) {
  const frame = Buffer.alloc(2 + msg.length);
  frame.writeUInt16BE(msg.length, 0);
  msg.copy(frame, 2);
  return frame;
}

/**
 * Read one length-prefixed DNS message from a socket.
 *
 * @param {import('node:net').Socket} socket
 * @param {number} timeoutMs
 * @returns {Promise<Buffer>} the raw DNS message (without length prefix)
 */
function readFramedMessage(socket, timeoutMs) {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('timeout waiting for DNS response'));
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      socket.removeListener('data', onData);
      socket.removeListener('error', onError);
    };
    const onData = chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length >= 2) {
        const length = buffer.readUInt16BE(0);
        if (buffer.length >= 2 + length) {
          cleanup();
          resolve(buffer.subarray(2, 2 + length));
        }
      }
    };
    const onError = err => {
      cleanup();
      reject(err);
    };
    socket.on('data', onData);
    socket.once('error', onError);
  });
}

/**
 * Verdict helper: decide whether the first AXFR response indicates the server
 * accepted the zone transfer. Only the response header is inspected — zone
 * contents are never retained.
 *
 * @param {Buffer|null} msg first wire response, or null on transport failure
 * @param {Error|null} transportError
 * @returns {{accepted:boolean, reason:string, header:object|null}}
 */
export function axfrVerdict(msg, transportError) {
  if (transportError) {
    return { accepted: false, reason: `transport failed: ${transportError.message}`, header: null };
  }
  const header = parseDnsHeader(msg);
  if (!header) {
    return { accepted: false, reason: 'unparseable DNS response', header: null };
  }
  if (header.rcode === 0 && header.ancount > 0) {
    return {
      accepted: true,
      reason: `transfer accepted (NOERROR, ${header.ancount} answer record(s) in first message — zone contents not retained)`,
      header,
    };
  }
  if (header.rcode === 0 && header.ancount === 0) {
    return {
      accepted: false,
      reason: 'NOERROR but no answer records in first message (likely empty/denied zone)',
      header,
    };
  }
  return { accepted: false, reason: `refused (${header.rcodeName})`, header };
}

// ---------------------------------------------------------------------------
// 00012 — AXFR over plain TCP, every authoritative NS, incl. non-standard ports
// ---------------------------------------------------------------------------

/**
 * Resolve the authoritative nameserver hostnames for a zone (best effort).
 *
 * @param {string} zone
 * @returns {Promise<string[]>} NS hostnames (empty on failure)
 */
export async function resolveNameservers(zone) {
  try {
    return await dns.promises.resolveNs(zone);
  } catch {
    return [];
  }
}

/**
 * Attempt a zone transfer over plain TCP against one nameserver.
 * Inspects only the first response header to render the accept/refuse verdict.
 *
 * @param {string} zone zone apex to request (e.g. "example.com")
 * @param {{host:string, port?:number}} server
 * @param {{timeoutMs?:number}} [opts]
 * @returns {Promise<{idea:string, zone:string, host:string, port:number,
 *           transport:'tcp', accepted:boolean, reason:string}>}
 */
export async function attemptAxfrTcp(zone, server, opts = {}) {
  const { host, port = 53 } = server || {};
  const timeoutMs = opts.timeoutMs || 8000;
  const query = buildDnsQuery(zone, TYPE_AXFR);
  let msg = null;
  let transportError = null;
  const socket = new net.Socket();
  socket.setTimeout(timeoutMs);
  try {
    await new Promise((resolve, reject) => {
      socket.once('error', reject);
      socket.once('timeout', () => reject(new Error('connection timeout')));
      socket.connect(port, host, () => {
        socket.write(frameForTcp(query));
        resolve();
      });
    });
    msg = await readFramedMessage(socket, timeoutMs);
  } catch (err) {
    transportError = err;
  } finally {
    socket.destroy();
  }
  const verdict = axfrVerdict(msg, transportError);
  return {
    idea: '00012',
    zone,
    host,
    port,
    transport: 'tcp',
    accepted: verdict.accepted,
    reason: verdict.reason,
  };
}

/**
 * Probe AXFR over TCP across a full nameserver set, including common
 * non-standard DNS ports where misconfigured secondaries sometimes listen.
 *
 * @param {string} zone
 * @param {string[]} nsHosts authoritative NS hostnames
 * @param {{ports?:number[], timeoutMs?:number, concurrency?:number}} [opts]
 * @returns {Promise<{zone:string, results:object[], accepted:object[]}>}
 */
export async function probeAxfrTcpAll(zone, nsHosts, opts = {}) {
  const ports = opts.ports || [53, 5353, 5355, 8853];
  const timeoutMs = opts.timeoutMs || 8000;
  const concurrency = opts.concurrency || 4;
  const targets = [];
  for (const host of nsHosts || []) {
    for (const port of ports) targets.push({ host, port });
  }
  const results = [];
  for (let i = 0; i < targets.length; i += concurrency) {
    const batch = await Promise.all(
      targets.slice(i, i + concurrency).map(t => attemptAxfrTcp(zone, t, { timeoutMs }))
    );
    results.push(...batch);
  }
  return { zone, results, accepted: results.filter(r => r.accepted) };
}

// ---------------------------------------------------------------------------
// 00013 — AXFR over DNS-over-TLS (port 853)
// ---------------------------------------------------------------------------

/**
 * Attempt a zone transfer over DNS-over-TLS (RFC 7858/7766 framing).
 * Admins sometimes harden port 53 while leaving 853 with default ACLs.
 *
 * @param {string} zone
 * @param {{host:string, port?:number}} server
 * @param {{timeoutMs?:number, rejectUnauthorized?:boolean}} [opts]
 * @returns {Promise<{idea:string, zone:string, host:string, port:number,
 *           transport:'dot', accepted:boolean, reason:string}>}
 */
export async function attemptAxfrDot(zone, server, opts = {}) {
  const { host, port = 853 } = server || {};
  const timeoutMs = opts.timeoutMs || 8000;
  const query = buildDnsQuery(zone, TYPE_AXFR);
  let msg = null;
  let transportError = null;
  const socket = tls.connect({
    host,
    port,
    servername: host,
    rejectUnauthorized: opts.rejectUnauthorized ?? false,
    ALPNProtocols: ['dot'],
    timeout: timeoutMs,
  });
  try {
    await new Promise((resolve, reject) => {
      socket.once('error', reject);
      socket.once('timeout', () => reject(new Error('TLS handshake timeout')));
      socket.once('secureConnect', () => {
        socket.write(frameForTcp(query));
        resolve();
      });
    });
    msg = await readFramedMessage(socket, timeoutMs);
  } catch (err) {
    transportError = err;
  } finally {
    socket.destroy();
  }
  const verdict = axfrVerdict(msg, transportError);
  return {
    idea: '00013',
    zone,
    host,
    port,
    transport: 'dot',
    accepted: verdict.accepted,
    reason: verdict.reason,
  };
}

/**
 * Probe AXFR over DoT across a nameserver set.
 *
 * @param {string} zone
 * @param {string[]} nsHosts
 * @param {{port?:number, timeoutMs?:number, concurrency?:number,
 *          rejectUnauthorized?:boolean}} [opts]
 * @returns {Promise<{zone:string, results:object[], accepted:object[]}>}
 */
export async function probeAxfrDotAll(zone, nsHosts, opts = {}) {
  const port = opts.port || 853;
  const timeoutMs = opts.timeoutMs || 8000;
  const concurrency = opts.concurrency || 4;
  const results = [];
  const hosts = nsHosts || [];
  for (let i = 0; i < hosts.length; i += concurrency) {
    const batch = await Promise.all(
      hosts
        .slice(i, i + concurrency)
        .map(host =>
          attemptAxfrDot(
            zone,
            { host, port },
            { timeoutMs, rejectUnauthorized: opts.rejectUnauthorized }
          )
        )
    );
    results.push(...batch);
  }
  return { zone, results, accepted: results.filter(r => r.accepted) };
}

// ---------------------------------------------------------------------------
// 00014 — AXFR-style probing over discovered DNS-over-HTTPS endpoints
// ---------------------------------------------------------------------------

/**
 * Encode a DNS message for DoH GET requests (RFC 8484).
 * @param {Buffer} msg
 * @returns {string} base64url
 */
export function encodeDohParam(msg) {
  return Buffer.from(msg)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Send one query through a DoH endpoint and parse the wire response.
 *
 * @param {string} endpoint DoH base URL (e.g. "https://dns.example/dns-query")
 * @param {Buffer} query wire-format DNS query
 * @param {{timeoutMs?:number}} [opts]
 * @returns {Promise<{ok:boolean, header:object|null, byteLength:number,
 *           error:string|null}>}
 */
export async function queryDohEndpoint(endpoint, query, opts = {}) {
  const timeoutMs = opts.timeoutMs || 10000;
  const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}dns=${encodeDohParam(query)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/dns-message' },
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, header: null, byteLength: 0, error: `HTTP ${res.status}` };
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    return { ok: true, header: parseDnsHeader(bytes), byteLength: bytes.length, error: null };
  } catch (err) {
    return { ok: false, header: null, byteLength: 0, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Probe discovered DoH endpoints for AXFR-style / zone-dump behavior.
 * A healthy DoH gateway refuses AXFR (NOTIMP/REFUSED); a misconfigured one may
 * answer or leak unusually large zone-like responses.
 *
 * @param {string} zone zone apex under test
 * @param {string[]} endpoints DoH endpoint URLs
 * @param {{timeoutMs?:number}} [opts]
 * @returns {Promise<{zone:string, results:object[], suspicious:object[]}>}
 */
export async function probeDohZoneDump(zone, endpoints, opts = {}) {
  const timeoutMs = opts.timeoutMs || 10000;
  const results = [];
  for (const endpoint of endpoints || []) {
    const axfrQuery = buildDnsQuery(zone, TYPE_AXFR);
    const soaQuery = buildDnsQuery(zone, TYPE_SOA);
    const axfr = await queryDohEndpoint(endpoint, axfrQuery, { timeoutMs });
    const soa = await queryDohEndpoint(endpoint, soaQuery, { timeoutMs });
    const axfrAccepted = !!(
      axfr.ok &&
      axfr.header &&
      axfr.header.rcode === 0 &&
      axfr.header.ancount > 0
    );
    // Heuristic: a sane gateway returns a handful of records; hundreds of
    // answers to a single query suggests zone-dump behavior.
    const bulkDump = !!(soa.ok && soa.header && soa.header.ancount > 50);
    const notes = [];
    if (axfrAccepted) notes.push('endpoint answered an AXFR query with records');
    if (bulkDump)
      notes.push(`SOA query returned ${soa.header.ancount} answers — possible zone-dump behavior`);
    if (axfr.ok && axfr.header && axfr.header.rcode !== 0) {
      notes.push(`AXFR refused as expected (${axfr.header.rcodeName})`);
    }
    if (!axfr.ok) notes.push(`AXFR probe transport failed: ${axfr.error}`);
    results.push({
      idea: '00014',
      zone,
      endpoint,
      transport: 'doh',
      axfrAccepted,
      bulkDump,
      soaAnswers: soa.header ? soa.header.ancount : 0,
      suspicious: axfrAccepted || bulkDump,
      notes,
    });
  }
  return { zone, results, suspicious: results.filter(r => r.suspicious) };
}

// ---------------------------------------------------------------------------
// 00015 — ANY-query meta-record mining
// ---------------------------------------------------------------------------

const HOSTNAME_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/gi;
const LEGACY_REVEALING_TYPES = new Set(['HINFO', 'RP', 'AFSDB', 'X25', 'ISDN', 'RT', 'PX', 'KX']);

/**
 * Mine an ANY-query response (already parsed into record objects) for
 * meta-records that reveal hostnames and internal naming.
 *
 * @param {{name:string, type:string, ttl?:number, rdata:string}[]} records
 *        records as parsed from an ANY response, e.g.
 *        [{ name:'host.example.com', type:'HINFO', rdata:'"x86_64" "Linux"' }]
 * @returns {{hinfo:object[], hostnames:string[], txtFindings:object[],
 *           legacyRecords:object[], summary:object}}
 */
export function mineAnyResponse(records) {
  const hinfo = [];
  const hostnameSet = new Set();
  const txtFindings = [];
  const legacyRecords = [];
  const byType = {};
  for (const rec of records || []) {
    const type = String(rec.type || '').toUpperCase();
    byType[type] = (byType[type] || 0) + 1;
    const rdata = String(rec.rdata || '');
    // HINFO: "CPU" "OS" — directly reveals platform details.
    if (type === 'HINFO') {
      const m = rdata.match(/"([^"]*)"\s+"([^"]*)"/);
      hinfo.push({
        name: rec.name,
        cpu: m ? m[1] : rdata,
        os: m ? m[2] : '',
        raw: rdata,
      });
    }
    // TXT: often contains hostnames, SPF includes, internal references.
    if (type === 'TXT') {
      const names = [...new Set((rdata.match(HOSTNAME_RE) || []).map(h => h.toLowerCase()))];
      for (const n of names) hostnameSet.add(n);
      if (names.length > 0 || /internal|intranet|corp|staging|dev|test/i.test(rdata)) {
        txtFindings.push({ name: rec.name, rdata, hostnames: names });
      }
    }
    // MX / SRV / NS / CNAME / PTR targets are hostnames by definition.
    if (['MX', 'SRV', 'NS', 'CNAME', 'PTR', 'DNAME'].includes(type)) {
      const names = (rdata.match(HOSTNAME_RE) || []).map(h => h.toLowerCase());
      for (const n of names) hostnameSet.add(n);
    }
    // Legacy types frequently leak internal structure.
    if (LEGACY_REVEALING_TYPES.has(type)) {
      legacyRecords.push({ name: rec.name, type, rdata });
      const names = (rdata.match(HOSTNAME_RE) || []).map(h => h.toLowerCase());
      for (const n of names) hostnameSet.add(n);
    }
  }
  const hostnames = [...hostnameSet].sort();
  return {
    hinfo,
    hostnames,
    txtFindings,
    legacyRecords,
    summary: {
      totalRecords: (records || []).length,
      typesSeen: byType,
      uniqueHostnames: hostnames.length,
      hinfoCount: hinfo.length,
      legacyCount: legacyRecords.length,
    },
  };
}

// ---------------------------------------------------------------------------
// 00016 — DNS NOTIFY / zone-serial timing analysis
// ---------------------------------------------------------------------------

/**
 * Analyze a series of NOTIFY observations and SOA serial samples to time
 * enumeration right after zone updates, when new hosts appear.
 *
 * @param {{at:number, serial:number, event:'notify'|'serial-bump'|'sample'}[]} samples
 *        chronological observations; `at` is epoch milliseconds
 * @param {{burstWindowMs?:number}} [opts] window that counts as one burst
 * @returns {{increments:number, avgIntervalMs:number|null,
 *           medianIntervalMs:number|null, bursts:object[],
 *           suggestedWindowMs:number, guidance:string}}
 */
export function analyzeNotifyPattern(samples, opts = {}) {
  const burstWindowMs = opts.burstWindowMs || 60000;
  const sorted = [...(samples || [])].sort((a, b) => a.at - b.at);
  const increments = [];
  let lastSerial = null;
  let lastSerialAt = null;
  for (const s of sorted) {
    if (lastSerial !== null && s.serial > lastSerial) {
      increments.push({
        at: s.at,
        from: lastSerial,
        to: s.serial,
        delta: s.serial - lastSerial,
        intervalSinceLastMs: lastSerialAt !== null ? s.at - lastSerialAt : null,
      });
      lastSerialAt = s.at;
    }
    if (lastSerial === null || s.serial > lastSerial) lastSerial = s.serial;
  }
  const intervals = increments.map(i => i.intervalSinceLastMs).filter(v => v !== null);
  const avgIntervalMs = intervals.length
    ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)
    : null;
  const medianIntervalMs = intervals.length
    ? [...intervals].sort((a, b) => a - b)[Math.floor(intervals.length / 2)]
    : null;
  // Burst detection: clusters of increments inside burstWindowMs.
  const bursts = [];
  let cluster = [];
  for (const inc of increments) {
    if (cluster.length === 0 || inc.at - cluster[cluster.length - 1].at <= burstWindowMs) {
      cluster.push(inc);
    } else {
      if (cluster.length > 1) {
        bursts.push({
          count: cluster.length,
          from: cluster[0].at,
          to: cluster[cluster.length - 1].at,
        });
      }
      cluster = [inc];
    }
  }
  if (cluster.length > 1) {
    bursts.push({ count: cluster.length, from: cluster[0].at, to: cluster[cluster.length - 1].at });
  }
  // Suggested enumeration window: shortly after the typical update cadence.
  const suggestedWindowMs = medianIntervalMs !== null ? Math.min(medianIntervalMs, 300000) : 60000;
  const guidance =
    increments.length === 0
      ? 'No serial increments observed — the zone looks static; schedule a single full enumeration.'
      : `Zone updated ${increments.length} time(s). Re-run enumeration within ~${Math.round(
          suggestedWindowMs / 1000
        )}s after the next serial increment to catch newly added hosts early.`;
  return {
    increments: increments.length,
    avgIntervalMs,
    medianIntervalMs,
    bursts,
    suggestedWindowMs,
    guidance,
  };
}

export const DNS_ZONE_RECON = {
  // 00011
  parseNsec3Param,
  buildNsec3WorkEstimate,
  harvestNsec3Salts,
  // wire helpers
  encodeDnsName,
  buildDnsQuery,
  parseDnsHeader,
  frameForTcp,
  axfrVerdict,
  encodeDohParam,
  queryDohEndpoint,
  // 00012
  resolveNameservers,
  attemptAxfrTcp,
  probeAxfrTcpAll,
  // 00013
  attemptAxfrDot,
  probeAxfrDotAll,
  // 00014
  probeDohZoneDump,
  // 00015
  mineAnyResponse,
  // 00016
  analyzeNotifyPattern,
};

export default DNS_ZONE_RECON;
