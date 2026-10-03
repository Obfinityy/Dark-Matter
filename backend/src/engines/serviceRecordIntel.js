/**
 * serviceRecordIntel.js — HTTPS/SVCB, ECH, ALPN and CAA record intelligence.
 *
 * Implements Dark-Matter idea-bank items 00017–00020 as real, working
 * defensive asset-discovery capabilities for authorized targets:
 *
 *  - 00017: HTTPS/SVCB record harvesting — extract alpn, port, ipv4hint,
 *           ipv6hint and target aliases that map hidden service endpoints.
 *  - 00018: ECH config extraction — parse ECHConfig blobs from HTTPS
 *           records to identify backend service aliases used for
 *           encrypted-client-hello fronting.
 *  - 00019: ALPN service inference — map advertised ALPN protocol IDs to
 *           the services running behind each name, without port scanning.
 *  - 00020: CAA policy inference — read CAA records to infer which CAs the
 *           organization trusts, which account URIs issue certificates, and
 *           how the issuance pipeline is organized.
 *
 * All functions are pure parsers/analyzers: they operate on DNS record data
 * the operator already collected (e.g. from dig) and never perform network I/O.
 *
 * (Complements backend/src/engines/dnsRecordIntel.js, which covers idea
 * 00021's CAA issue/issuewild gap analysis.)
 */

// ---------------------------------------------------------------------------
// Shared: parse SVCB/HTTPS parameter lists (RFC 9460 §2.1)
// ---------------------------------------------------------------------------

/**
 * Split an SVCB/HTTPS rdata text into [priority, target, paramsText].
 * Example input: `1 pool.example.net. alpn="h2,h3" ipv4hint=192.0.2.1`
 *
 * @param {string} rdata
 * @returns {{priority:number, target:string, paramsText:string}|null}
 */
export function splitSvcbRdata(rdata) {
  if (typeof rdata !== 'string') return null;
  const m = rdata.trim().match(/^(\d+)\s+(\S+)\s*(.*)$/);
  if (!m) return null;
  return { priority: Number(m[1]), target: m[2], paramsText: (m[3] || '').trim() };
}

/**
 * Tokenize an SVCB parameter string, respecting double-quoted values that may
 * contain commas or spaces (e.g. alpn="h2,h3").
 *
 * @param {string} paramsText
 * @returns {string[]} raw parameter tokens like `alpn="h2,h3"`
 */
export function tokenizeSvcbParams(paramsText) {
  const tokens = [];
  let current = '';
  let inQuotes = false;
  for (const ch of paramsText || '') {
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if (/\s/.test(ch) && !inQuotes) {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

/**
 * Parse SVCB parameter tokens into a key → value map. Keys without `=`
 * (e.g. `no-default-alpn`) map to `true`. Quoted values are unquoted.
 *
 * @param {string[]} tokens
 * @returns {Record<string, string|boolean>}
 */
export function parseSvcbParams(tokens) {
  const params = {};
  for (const token of tokens || []) {
    const eq = token.indexOf('=');
    if (eq === -1) {
      params[token.toLowerCase()] = true;
      continue;
    }
    let value = token.slice(eq + 1);
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value.slice(1, -1);
    }
    params[token.slice(0, eq).toLowerCase()] = value;
  }
  return params;
}

const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6_RE = /^[0-9a-fA-F:]+$/;

/**
 * Split a comma-separated IP-hint value into validated address lists.
 *
 * @param {string} value e.g. "192.0.2.1,192.0.2.2"
 * @returns {{v4:string[], v6:string[]}}
 */
export function splitIpHints(value) {
  const v4 = [];
  const v6 = [];
  for (const raw of String(value || '').split(',')) {
    const ip = raw.trim();
    if (!ip) continue;
    if (IPV4_RE.test(ip)) v4.push(ip);
    else if (IPV6_RE.test(ip) && ip.includes(':')) v6.push(ip);
  }
  return { v4, v6 };
}

// ---------------------------------------------------------------------------
// 00017 — HTTPS/SVCB record harvesting
// ---------------------------------------------------------------------------

/**
 * Harvest intelligence from one HTTPS (or SVCB) record's rdata.
 *
 * @param {string} owner owner name the record was queried for
 * @param {string} rdata textual rdata, e.g.
 *        `1 . alpn="h2,h3" ipv4hint=192.0.2.1 ech=aGVsbG8=`
 * @returns {{owner:string, priority:number, target:string|null, aliasMode:boolean,
 *           alpn:string[], port:number|null, ipv4hint:string[], ipv6hint:string[],
 *           echPresent:boolean, mandatory:string[], otherParams:string[],
 *           endpoints:string[]}|null}
 */
export function harvestHttpsRecord(owner, rdata) {
  const split = splitSvcbRdata(rdata);
  if (!split) return null;
  const params = parseSvcbParams(tokenizeSvcbParams(split.paramsText));
  // AliasMode: priority 0, target is the alias target (RFC 9460 §2.4.1).
  const aliasMode = split.priority === 0;
  const target = aliasMode ? split.target : split.target === '.' ? null : split.target;
  const alpn = params.alpn && typeof params.alpn === 'string'
    ? params.alpn.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const port = params.port !== undefined && params.port !== true ? Number(params.port) : null;
  const ipv4hint = params.ipv4hint ? splitIpHints(params.ipv4hint).v4 : [];
  const ipv6hint = params.ipv6hint ? splitIpHints(params.ipv6hint).v6 : [];
  const mandatory = params.mandatory && typeof params.mandatory === 'string'
    ? params.mandatory.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const known = new Set(['alpn', 'port', 'ipv4hint', 'ipv6hint', 'ech', 'mandatory', 'no-default-alpn']);
  const otherParams = Object.keys(params).filter((k) => !known.has(k));
  // Candidate service endpoints: alias target + hinted IPs.
  const endpoints = [];
  if (target) endpoints.push(target);
  endpoints.push(...ipv4hint, ...ipv6hint);
  return {
    owner,
    priority: split.priority,
    target,
    aliasMode,
    alpn,
    port: Number.isInteger(port) ? port : null,
    ipv4hint,
    ipv6hint,
    echPresent: params.ech !== undefined,
    mandatory,
    otherParams,
    endpoints: [...new Set(endpoints)],
  };
}

/**
 * Harvest a whole set of HTTPS/SVCB answers for a zone into one report,
 * flagging alias chains and hidden endpoints.
 *
 * @param {{owner:string, type:string, rdata:string}[]} records
 * @returns {{records:object[], aliasChains:object[], hiddenEndpoints:string[],
 *           echHosts:string[], summary:object}}
 */
export function harvestHttpsRecords(records) {
  const parsed = [];
  for (const rec of records || []) {
    const type = String(rec.type || '').toUpperCase();
    if (type !== 'HTTPS' && type !== 'SVCB') continue;
    const h = harvestHttpsRecord(rec.owner, rec.rdata);
    if (h) parsed.push(h);
  }
  const aliasChains = parsed
    .filter((p) => p.aliasMode && p.target)
    .map((p) => ({ owner: p.owner, aliasTarget: p.target }));
  const endpointSet = new Set();
  for (const p of parsed) for (const e of p.endpoints) endpointSet.add(e);
  const echHosts = parsed.filter((p) => p.echPresent).map((p) => p.owner);
  return {
    records: parsed,
    aliasChains,
    hiddenEndpoints: [...endpointSet].sort(),
    echHosts,
    summary: {
      totalRecords: parsed.length,
      aliasModeCount: aliasChains.length,
      echCount: echHosts.length,
      hintedIpv4: parsed.reduce((n, p) => n + p.ipv4hint.length, 0),
      hintedIpv6: parsed.reduce((n, p) => n + p.ipv6hint.length, 0),
    },
  };
}

// ---------------------------------------------------------------------------
// 00018 — ECH config extraction (RFC 9460 §7 / draft-ietf-tls-esni)
// ---------------------------------------------------------------------------

/**
 * Decode one ECHConfig blob (base64, as published in the `ech=` SVCB param)
 * into its identifying fields. Best-effort TLS-struct parse:
 *
 *   struct { uint8 config_id; uint16 kem_id;
 *            opaque public_key<1..2^16-1>;
 *            opaque cipher_suites<4..2^16-4>;
 *            uint8 maximum_name_length;
 *            opaque public_name<1..255>;
 *            opaque extensions<0..2^16-1>; } ECHConfig;
 *
 * The public_name is the backend service alias used for ECH fronting.
 *
 * @param {string} echBase64 base64 ECHConfigList value from an `ech=` param
 * @returns {{configId:number|null, kemId:number|null, kemName:string,
 *           publicName:string|null, error:string|null}[]}
 *           one entry per ECHConfig in the list
 */
export function extractEchConfigs(echBase64) {
  if (typeof echBase64 !== 'string' || !echBase64.trim()) return [];
  let bytes;
  try {
    bytes = Buffer.from(echBase64.trim(), 'base64');
  } catch {
    return [{ configId: null, kemId: null, kemName: 'unknown', publicName: null, error: 'invalid base64' }];
  }
  // ECHConfigList is length-prefixed.
  if (bytes.length < 2) {
    return [{ configId: null, kemId: null, kemName: 'unknown', publicName: null, error: 'truncated ECHConfigList' }];
  }
  const listLen = bytes.readUInt16BE(0);
  let offset = 2;
  const end = Math.min(2 + listLen, bytes.length);
  const configs = [];
  const KEM_NAMES = { 16: 'DHKEM(X25519,HKDF-SHA256)', 17: 'DHKEM(P-256,HKDF-SHA256)', 18: 'DHKEM(P-521,HKDF-SHA256)' };
  while (offset < end) {
    const entry = {
      configId: null,
      kemId: null,
      kemName: 'unknown',
      publicName: null,
      error: null,
    };
    try {
      if (offset + 3 > bytes.length) throw new Error('truncated config header');
      entry.configId = bytes.readUInt8(offset);
      entry.kemId = bytes.readUInt16BE(offset + 1);
      entry.kemName = KEM_NAMES[entry.kemId] || `kem-${entry.kemId}`;
      offset += 3;
      const readOpaque = (lenBytes) => {
        if (offset + lenBytes > bytes.length) throw new Error('truncated length prefix');
        const len = lenBytes === 1 ? bytes.readUInt8(offset) : bytes.readUInt16BE(offset);
        offset += lenBytes;
        if (offset + len > bytes.length) throw new Error('truncated opaque field');
        const value = bytes.subarray(offset, offset + len);
        offset += len;
        return value;
      };
      readOpaque(2); // public_key — not needed for alias discovery
      readOpaque(2); // cipher_suites
      offset += 1; // maximum_name_length
      const publicName = readOpaque(1);
      entry.publicName = publicName.toString('utf8') || null;
      readOpaque(2); // extensions
    } catch (err) {
      entry.error = err.message;
      break;
    }
    configs.push(entry);
  }
  return configs;
}

/**
 * Build a synthetic ECHConfigList (base64) for tests and tooling demos.
 * Mirrors the struct layout parsed by {@link extractEchConfigs}.
 *
 * @param {{configId?:number, kemId?:number, publicName?:string}[]} configs
 * @returns {string} base64 ECHConfigList
 */
export function buildEchConfigList(configs) {
  const parts = [];
  for (const c of configs || []) {
    const configId = c.configId ?? 0;
    const kemId = c.kemId ?? 16;
    const publicKey = Buffer.alloc(32, 0xab); // placeholder key bytes
    const cipherSuites = Buffer.from([0x00, 0x04, 0x00, 0x01, 0x00, 0x01]); // 1 suite entry
    const publicName = Buffer.from(c.publicName || 'fronting.example.com', 'utf8');
    const body = Buffer.concat([
      Buffer.from([configId]),
      Buffer.from([(kemId >> 8) & 0xff, kemId & 0xff]),
      Buffer.from([(publicKey.length >> 8) & 0xff, publicKey.length & 0xff]),
      publicKey,
      Buffer.from([(cipherSuites.length >> 8) & 0xff, cipherSuites.length & 0xff]),
      cipherSuites,
      Buffer.from([64]), // maximum_name_length
      Buffer.from([publicName.length]),
      publicName,
      Buffer.from([0x00, 0x00]), // extensions
    ]);
    parts.push(body);
  }
  const inner = Buffer.concat(parts);
  const list = Buffer.alloc(2 + inner.length);
  list.writeUInt16BE(inner.length, 0);
  inner.copy(list, 2);
  return list.toString('base64');
}

/**
 * Collect ECH intelligence across harvested HTTPS records: for each record
 * carrying an `ech=` parameter, decode the configs and surface backend aliases.
 *
 * @param {{owner:string, type:string, rdata:string}[]} records
 * @returns {{hosts:object[], backendAliases:string[], summary:object}}
 */
export function extractEchFromRecords(records) {
  const hosts = [];
  const aliasSet = new Set();
  for (const rec of records || []) {
    const type = String(rec.type || '').toUpperCase();
    if (type !== 'HTTPS' && type !== 'SVCB') continue;
    const split = splitSvcbRdata(rec.rdata);
    const params = parseSvcbParams(tokenizeSvcbParams((split || {}).paramsText || ''));
    if (typeof params.ech !== 'string' || !params.ech) continue;
    const configs = extractEchConfigs(params.ech);
    for (const c of configs) {
      if (c.publicName) aliasSet.add(c.publicName);
    }
    hosts.push({ owner: rec.owner, configs });
  }
  return {
    hosts,
    backendAliases: [...aliasSet].sort(),
    summary: {
      echHosts: hosts.length,
      configsParsed: hosts.reduce((n, h) => n + h.configs.length, 0),
      parseErrors: hosts.reduce((n, h) => n + h.configs.filter((c) => c.error).length, 0),
      uniqueBackendAliases: aliasSet.size,
    },
  };
}

// ---------------------------------------------------------------------------
// 00019 — ALPN record service inference
// ---------------------------------------------------------------------------

const ALPN_SERVICE_MAP = {
  'http/1.1': { service: 'HTTP/1.1 web server', category: 'web' },
  h2: { service: 'HTTP/2 web server', category: 'web' },
  h2c: { service: 'HTTP/2 cleartext (h2c)', category: 'web' },
  h3: { service: 'HTTP/3 (QUIC) endpoint', category: 'web' },
  'h3-29': { service: 'HTTP/3 draft endpoint (QUIC)', category: 'web' },
  'acme-tls/1': { service: 'ACME TLS-ALPN certificate issuance endpoint', category: 'pki' },
  webrtc: { service: 'WebRTC endpoint', category: 'realtime' },
  'c-webrtc': { service: 'WebRTC endpoint', category: 'realtime' },
  'stun.turn': { service: 'STUN/TURN server', category: 'realtime' },
  'stun.nat-discovery': { service: 'STUN NAT discovery', category: 'realtime' },
  mqtt: { service: 'MQTT broker', category: 'iot' },
  coap: { service: 'CoAP endpoint', category: 'iot' },
  'xmpp-client': { service: 'XMPP client port', category: 'messaging' },
  'xmpp-server': { service: 'XMPP server port', category: 'messaging' },
  irc: { service: 'IRC server', category: 'messaging' },
  smtp: { service: 'SMTP (STARTTLS) mail submission', category: 'mail' },
  imap: { service: 'IMAP mail server', category: 'mail' },
  pop3: { service: 'POP3 mail server', category: 'mail' },
  postgres: { service: 'PostgreSQL (TLS)', category: 'database' },
  mysql: { service: 'MySQL (TLS)', category: 'database' },
  nats: { service: 'NATS messaging', category: 'messaging' },
  'grpc-exp': { service: 'gRPC experimental endpoint', category: 'api' },
};

/**
 * Infer the service behind a host from one advertised ALPN protocol ID.
 *
 * @param {string} alpnId protocol ID as advertised, e.g. "h2"
 * @returns {{alpn:string, service:string, category:string, known:boolean}}
 */
export function inferServiceFromAlpn(alpnId) {
  const id = String(alpnId || '').trim();
  const known = ALPN_SERVICE_MAP[id];
  if (known) return { alpn: id, service: known.service, category: known.category, known: true };
  return {
    alpn: id,
    service: 'unknown/custom protocol — investigate (possible proprietary service)',
    category: 'unknown',
    known: false,
  };
}

/**
 * Infer services for every host from harvested HTTPS/SVCB records' ALPN lists.
 *
 * @param {object[]} harvestedRecords output of {@link harvestHttpsRecords}
 * @returns {{hosts:object[], servicesByCategory:object, unknownAlpn:string[]}}
 */
export function inferServicesFromRecords(harvestedRecords) {
  const hosts = [];
  const byCategory = {};
  const unknownSet = new Set();
  for (const rec of harvestedRecords || []) {
    const services = (rec.alpn || []).map(inferServiceFromAlpn);
    for (const s of services) {
      byCategory[s.category] = (byCategory[s.category] || 0) + 1;
      if (!s.known) unknownSet.add(s.alpn);
    }
    hosts.push({
      owner: rec.owner,
      target: rec.target,
      port: rec.port,
      alpn: rec.alpn || [],
      inferredServices: services,
    });
  }
  return {
    hosts,
    servicesByCategory: byCategory,
    unknownAlpn: [...unknownSet].sort(),
  };
}

// ---------------------------------------------------------------------------
// 00020 — CAA record policy inference
// ---------------------------------------------------------------------------

/**
 * Parse one CAA rdata string: `<flags> <tag> "<value>"`.
 * Example: `0 issue "letsencrypt.org; accounturi=https://acme-v02.api.letsencrypt.org/acme/acct/12345"`
 *
 * @param {string} rdata
 * @returns {{flags:number, tag:string, value:string, ca:string,
 *           params:Record<string,string>}|null}
 */
export function parseCaaRecord(rdata) {
  if (typeof rdata !== 'string') return null;
  const m = rdata.trim().match(/^(\d+)\s+([A-Za-z0-9]+)\s+"?([^"]*)"?$/);
  if (!m) return null;
  const tag = m[2].toLowerCase();
  const rawValue = m[3].trim();
  // Value format: `ca-name[; param=value[; ...]]` (RFC 8659 §4.1.1).
  const segments = rawValue.split(';').map((s) => s.trim()).filter(Boolean);
  const ca = segments.length ? segments[0] : '';
  const params = {};
  for (const seg of segments.slice(1)) {
    const eq = seg.indexOf('=');
    if (eq > 0) params[seg.slice(0, eq).trim().toLowerCase()] = seg.slice(eq + 1).trim();
  }
  return { flags: Number(m[1]), tag, value: rawValue, ca, params };
}

/**
 * Infer the organization's certificate-issuance pipeline from a set of CAA
 * records: trusted CAs, account URIs (which expose ACME account references),
 * validation methods, and policy gaps (e.g. missing issuewild).
 *
 * @param {{owner:string, rdata:string}[]} records CAA records for the zone
 * @returns {{trustedCAs:string[], issuewildCAs:string[], issuemailCAs:string[],
 *           accountUris:string[], validationMethods:string[],
 *           criticalFlags:string[], policyGaps:string[], pipeline:object[],
 *           summary:object}}
 */
export function inferCaaPolicy(records) {
  const trustedCAs = new Set();
  const issuewildCAs = new Set();
  const issuemailCAs = new Set();
  const accountUris = new Set();
  const validationMethods = new Set();
  const criticalFlags = [];
  const pipeline = [];
  for (const rec of records || []) {
    const parsed = parseCaaRecord(rec.rdata);
    if (!parsed) continue;
    if (parsed.flags === 128) {
      criticalFlags.push(`${rec.owner}: ${parsed.tag} (issuer must understand tag or refuse issuance)`);
    }
    const entry = {
      owner: rec.owner,
      tag: parsed.tag,
      ca: parsed.ca,
      accountUri: parsed.params.accounturi || null,
      validationMethods: parsed.params.validationmethods
        ? parsed.params.validationmethods.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
    };
    if (entry.accountUri) accountUris.add(entry.accountUri);
    for (const vm of entry.validationMethods) validationMethods.add(vm);
    if (parsed.tag === 'issue') {
      if (parsed.ca && parsed.ca !== ';') trustedCAs.add(parsed.ca);
      pipeline.push(entry);
    } else if (parsed.tag === 'issuewild') {
      if (parsed.ca && parsed.ca !== ';') issuewildCAs.add(parsed.ca);
      pipeline.push(entry);
    } else if (parsed.tag === 'issuemail' || parsed.tag === 'issuemailwild') {
      if (parsed.ca && parsed.ca !== ';') issuemailCAs.add(parsed.ca);
      pipeline.push(entry);
    }
  }
  // Policy gaps: issuewild missing while issue allows a CA means wildcards
  // fall back to the `issue` set — a common misconfiguration to note.
  const policyGaps = [];
  if (trustedCAs.size > 0 && issuewildCAs.size === 0) {
    policyGaps.push(
      'No issuewild records: wildcard issuance falls back to the `issue` CA set — wildcards may be issued by any CA trusted in `issue`.',
    );
  }
  if (trustedCAs.size === 0) {
    policyGaps.push('No `issue` records: any public CA may issue certificates for this zone (no CAA restriction).');
  }
  return {
    trustedCAs: [...trustedCAs].sort(),
    issuewildCAs: [...issuewildCAs].sort(),
    issuemailCAs: [...issuemailCAs].sort(),
    accountUris: [...accountUris].sort(),
    validationMethods: [...validationMethods].sort(),
    criticalFlags,
    policyGaps,
    pipeline,
    summary: {
      recordCount: pipeline.length,
      trustedCaCount: trustedCAs.size,
      accountUriCount: accountUris.size,
      gapCount: policyGaps.length,
    },
  };
}

export const SERVICE_RECORD_INTEL = {
  // shared parsers
  splitSvcbRdata,
  tokenizeSvcbParams,
  parseSvcbParams,
  splitIpHints,
  // 00017
  harvestHttpsRecord,
  harvestHttpsRecords,
  // 00018
  extractEchConfigs,
  buildEchConfigList,
  extractEchFromRecords,
  // 00019
  inferServiceFromAlpn,
  inferServicesFromRecords,
  // 00020
  parseCaaRecord,
  inferCaaPolicy,
};

export default SERVICE_RECORD_INTEL;
