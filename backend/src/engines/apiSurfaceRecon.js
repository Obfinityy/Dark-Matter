/**
 * apiSurfaceRecon.js — API surface discovery + protocol translation-layer reconnaissance.
 *
 * Defensive analyzer functions for an authorized bug-bounty agent. Each function
 * inspects OBSERVED behavior of an authorized target (response headers, status
 * codes, bodies, DNS records, certificate data, service banners, documentation)
 * and derives a security verdict — they perform no attacks, send no exploit
 * payloads, and never touch live infrastructure beyond reading already-gathered
 * observations.
 *
 * Covers idea-bank ideas 1271-1280:
 *  1271 diffAllowHeaders — compare OPTIONS Allow headers across access states
 *  1272 discoverApiFromSrv — find API services advertised in DNS SRV records
 *  1273 harvestApiSans — classify API-relevant hostnames in certificate SANs
 *  1274 correlateShodanApiPorts — cross-reference service banners with web APIs
 *  1275 discoverAnalyticsEndpoints — find self-hosted analytics/tracking endpoints
 *  1276 testCorrelationIdReflection — analyze X-Correlation-ID reflection behavior
 *  1277 diffHttp2VsHttp11 — compare API behavior across HTTP/2 and HTTP/1.1
 *  1278 probeHttp3QuicSupport — assess QUIC/HTTP-3 enablement from observed signals
 *  1279 huntSoapRestShims — detect legacy SOAP-to-REST translation shims
 *  1280 discoverGraphqlRestFallbacks — map GraphQL operations to REST equivalents
 */

/** Ideas implemented by this module (auditable coverage). */
export const WAVE1271_COVERAGE = [1271, 1272, 1273, 1274, 1275, 1276, 1277, 1278, 1279, 1280];

/**
 * Map an idea number to the function that implements it.
 * @returns {Record<number, string>} idea number -> exported function name
 */
export function ideaFunctions() {
  return {
    1271: 'diffAllowHeaders',
    1272: 'discoverApiFromSrv',
    1273: 'harvestApiSans',
    1274: 'correlateShodanApiPorts',
    1275: 'discoverAnalyticsEndpoints',
    1276: 'testCorrelationIdReflection',
    1277: 'diffHttp2VsHttp11',
    1278: 'probeHttp3QuicSupport',
    1279: 'huntSoapRestShims',
    1280: 'discoverGraphqlRestFallbacks',
  };
}

// ---------------------------------------------------------------- 1271 ----

/**
 * Compare OPTIONS Allow headers collected across different access states
 * (e.g. anonymous vs authenticated, resource owner vs non-owner).
 * Allowed methods that change with state indicate buggy method-level
 * authorization rather than deliberate design.
 *
 * @param {object} obs
 * @param {Array<{ label: string, allowHeader: string, path?: string }>} [obs.states]
 *   — one OPTIONS observation per state; allowHeader is the raw Allow value.
 * @returns {{ states: Array<{ label: string, methods: string[] }>, diffs: Array<{ method: string, presentIn: string[], missingFrom: string[], finding: string }>, findings: string[] }}
 */
export function diffAllowHeaders({ states = [] } = {}) {
  const findings = [];
  const parsed = (Array.isArray(states) ? states : []).map((s) => {
    const methods = String(s.allowHeader || '')
      .split(',')
      .map((m) => m.trim().toUpperCase())
      .filter(Boolean);
    return { label: String(s.label || 'unnamed'), path: s.path ? String(s.path) : null, methods: [...new Set(methods)] };
  });

  if (parsed.length < 2) {
    findings.push('Need OPTIONS observations from at least two access states to diff Allow headers.');
    return { states: parsed, diffs: [], findings };
  }

  const allMethods = [...new Set(parsed.flatMap((s) => s.methods))];
  const diffs = [];

  for (const method of allMethods.sort()) {
    const presentIn = parsed.filter((s) => s.methods.includes(method)).map((s) => s.label);
    const missingFrom = parsed.filter((s) => !s.methods.includes(method)).map((s) => s.label);
    if (presentIn.length > 0 && missingFrom.length > 0) {
      let finding;
      if (method === 'OPTIONS' || method === 'HEAD' || method === 'GET') {
        finding = `Method ${method} is advertised in [${presentIn.join(', ')}] but not [${missingFrom.join(', ')}] — usually cosmetic, but verify the 405 behavior matches.`;
      } else if (['DELETE', 'PUT', 'PATCH'].includes(method)) {
        finding = `State-changing method ${method} is advertised only in [${presentIn.join(', ')}] — confirm the backend enforces the same authorization as the Allow header implies; mismatched OPTIONS vs actual enforcement is a classic authz gap.`;
      } else {
        finding = `Method ${method} differs across states: present in [${presentIn.join(', ')}], absent in [${missingFrom.join(', ')}].`;
      }
      diffs.push({ method, presentIn, missingFrom, finding });
    }
  }

  if (diffs.length === 0) {
    findings.push('Allow headers are identical across all observed states — no state-dependent method exposure detected.');
  } else {
    findings.push(`Detected ${diffs.length} method-level difference${diffs.length === 1 ? '' : 's'} across ${parsed.length} states: ${diffs.map((d) => d.method).join(', ')}.`);
  }

  return { states: parsed, diffs, findings };
}

// ---------------------------------------------------------------- 1272 ----

const API_SERVICE_HINTS = [
  /_https?\b/i, /_api\b/i, /_rest\b/i, /_graphql\b/i, /_grpc\b/i,
  /_http\b/i, /_web\b/i, /_json\b/i, /_rpc\b/i, /_soap\b/i, /_ws\b/i, /_wss\b/i,
];

const NON_STANDARD_API_PORTS = [8080, 8000, 8443, 9000, 3000, 5000, 8001, 8081, 8888, 9090];

/**
 * Discover API services advertised in DNS SRV records observed for the target
 * domain. SRV records explicitly name service hosts and ports, which often
 * includes internal or staging API endpoints.
 *
 * @param {object} obs
 * @param {Array<{ service: string, proto?: string, port: number, target: string, priority?: number, weight?: number }>} [obs.records]
 *   — DNS SRV records already resolved for the target domain.
 * @returns {{ apiServices: Array<{ service: string, proto: string, port: number, target: string, standardPort: boolean }>, findings: string[] }}
 */
export function discoverApiFromSrv({ records = [] } = {}) {
  const findings = [];
  const list = Array.isArray(records) ? records : [];

  const apiServices = list
    .filter((r) => r && typeof r.service === 'string' && API_SERVICE_HINTS.some((p) => p.test(r.service)))
    .map((r) => {
      const port = Number(r.port);
      return {
        service: String(r.service),
        proto: String(r.proto || 'tcp'),
        port,
        target: String(r.target || ''),
        standardPort: port === 80 || port === 443,
      };
    });

  if (apiServices.length === 0) {
    findings.push(
      list.length === 0
        ? 'No SRV records supplied — API discovery via DNS SRV is not possible from these observations.'
        : `Examined ${list.length} SRV record${list.length === 1 ? '' : 's'}; none advertise API-like services (_https, _api, _rest, _graphql, _grpc, ...).`
    );
  } else {
    const nonStandard = apiServices.filter((s) => !s.standardPort);
    findings.push(`Found ${apiServices.length} API-service SRV advertisement${apiServices.length === 1 ? '' : 's'}: ${apiServices.map((s) => `${s.service} -> ${s.target}:${s.port}`).join('; ')}.`);
    if (nonStandard.length > 0) {
      findings.push(`Non-standard ports advertised (${nonStandard.map((s) => s.port).join(', ')}) — these hosts bypass the standard 80/443 edge stack and may run pre-hardened code.`);
    }
    const dotted = apiServices.filter((s) => /\b(internal|staging|dev|test|beta|qa|corp)\b/i.test(s.target));
    if (dotted.length > 0) {
      findings.push(`SRV targets with environment hints: ${dotted.map((s) => s.target).join(', ')} — verify these are in scope before probing further.`);
    }
  }

  return { apiServices, findings };
}

// ---------------------------------------------------------------- 1273 ----

const SAN_CATEGORIES = [
  { name: 'api', pattern: /^api[.-]/i },
  { name: 'internal', pattern: /\b(internal|intranet|corp|lan)\b/i },
  { name: 'staging', pattern: /\b(staging|stage|preprod|uat)\b/i },
  { name: 'dev', pattern: /\b(dev(elopment)?|test(ing)?|qa|sandbox|beta|demo)\b/i },
  { name: 'admin', pattern: /\b(admin|ops|mgmt|manage|console|dashboard)\b/i },
];

/**
 * Harvest API-relevant hostnames from certificate Subject Alternative Names.
 * SAN lists routinely disclose api, internal, staging and admin hostnames that
 * share the same certificate as the public site.
 *
 * @param {object} obs
 * @param {string[]} [obs.sans] — SAN DNS names observed on the target certificate.
 * @returns {{ byCategory: Record<string, string[]>, interesting: string[], totalSans: number, findings: string[] }}
 */
export function harvestApiSans({ sans = [] } = {}) {
  const findings = [];
  const names = (Array.isArray(sans) ? sans : []).map(String).filter(Boolean);
  const unique = [...new Set(names)];

  const byCategory = { api: [], internal: [], staging: [], dev: [], admin: [], other: [] };
  for (const name of unique) {
    const cat = SAN_CATEGORIES.find((c) => c.pattern.test(name));
    (cat ? byCategory[cat.name] : byCategory.other).push(name);
  }

  const interesting = Object.entries(byCategory)
    .filter(([k]) => k !== 'other')
    .flatMap(([, v]) => v);

  if (unique.length === 0) {
    findings.push('No SAN entries supplied — nothing to harvest.');
  } else {
    findings.push(`Certificate carries ${unique.length} SAN entr${unique.length === 1 ? 'y' : 'ies'}.`);
    if (interesting.length > 0) {
      findings.push(
        `Interesting hostnames disclosed: ${Object.entries(byCategory)
          .filter(([k, v]) => k !== 'other' && v.length > 0)
          .map(([k, v]) => `${k}: ${v.join(', ')}`)
          .join(' | ')}. These are in-scope candidates for further (authorized) recon.`
      );
    } else {
      findings.push('No api/internal/staging/dev/admin hostnames found in the SAN list.');
    }
    const wildcards = unique.filter((n) => n.startsWith('*.'));
    if (wildcards.length > 0) {
      findings.push(`Wildcard SANs present (${wildcards.join(', ')}) — any single-label subdomain under these parents is certificate-valid.`);
    }
  }

  return { byCategory, interesting, totalSans: unique.length, findings };
}

// ---------------------------------------------------------------- 1274 ----

const NON_HTTP_PORT_HINTS = [
  { ports: [3306, 5432, 6379, 27017, 9200, 11211, 1433, 1521, 5984], kind: 'database' },
  { ports: [22, 3389, 5900, 23], kind: 'remote-access' },
  { ports: [25, 587, 465, 110, 143, 993, 995], kind: 'mail' },
  { ports: [53, 161, 123], kind: 'infrastructure' },
  { ports: [5672, 9092, 2181, 4369], kind: 'messaging' },
];

const GRPC_HINTS = [/grpc/i, /h2c/i, /http\/2/i];

/**
 * Cross-reference service-banner observations (e.g. from Shodan-style data)
 * against the hosts that serve the target's web APIs. Exposed non-HTTP
 * listeners on API hosts are a high-value recon signal.
 *
 * @param {object} obs
 * @param {Array<{ host: string, port: number, transport?: string, service?: string, banner?: string }>} [obs.banners]
 *   — port/banner observations for hosts associated with the target.
 * @param {string[]} [obs.webApiHosts] — hosts known to serve the target's HTTP APIs.
 * @returns {{ correlated: Array<{ host: string, port: number, kind: string, service: string, finding: string }>, findings: string[] }}
 */
export function correlateShodanApiPorts({ banners = [], webApiHosts = [] } = {}) {
  const findings = [];
  const list = Array.isArray(banners) ? banners : [];
  const apiHosts = new Set((Array.isArray(webApiHosts) ? webApiHosts : []).map((h) => String(h).toLowerCase()));

  const correlated = [];
  for (const b of list) {
    if (!b || typeof b.host !== 'string') continue;
    const host = b.host.toLowerCase();
    const port = Number(b.port);
    if (!Number.isFinite(port)) continue;
    const service = String(b.service || '').toLowerCase();
    const banner = String(b.banner || '');

    const isHttp = [80, 443, 8080, 8443].includes(port) && /http/i.test(service || 'http');
    if (isHttp) continue;

    let kind = null;
    let finding = null;
    const hint = NON_HTTP_PORT_HINTS.find((h) => h.ports.includes(port));
    if (hint) {
      kind = hint.kind;
      finding = `Non-HTTP listener (${hint.kind}) on port ${port} at ${b.host} — ${hint.kind === 'database' ? 'a database port reachable from the network is a critical exposure signal' : 'verify scope and confirm the service is intended to be public'}.`;
    } else if (GRPC_HINTS.some((p) => p.test(`${service} ${banner}`))) {
      kind = 'grpc';
      finding = `gRPC/HTTP-2 service on port ${port} at ${b.host} — gRPC endpoints often lack the gateway's WAF/validation; enumerate services via reflection probes (authorized).`;
    } else if (port > 1024 && !/http/i.test(service)) {
      kind = 'custom-tcp';
      finding = `Unclassified TCP listener on port ${port} at ${b.host} (banner: ${banner.slice(0, 80) || 'none'}) — custom protocol; fingerprint before deciding next steps.`;
    }

    if (kind) {
      const onApiHost = apiHosts.size === 0 || apiHosts.has(host);
      if (onApiHost) {
        correlated.push({ host: b.host, port, kind, service: String(b.service || 'unknown'), finding });
      }
    }
  }

  if (list.length === 0) {
    findings.push('No banner observations supplied — port correlation is not possible.');
  } else if (correlated.length === 0) {
    findings.push(`Examined ${list.length} banner${list.length === 1 ? '' : 's'}; no non-HTTP API listeners correlated.`);
  } else {
    findings.push(`Correlated ${correlated.length} non-HTTP listener${correlated.length === 1 ? '' : 's'} with API hosts: ${correlated.map((c) => `${c.host}:${c.port} (${c.kind})`).join(', ')}.`);
    if (correlated.some((c) => c.kind === 'database')) {
      findings.push('Database-class ports are exposed on API-adjacent hosts — treat as high priority for (authorized) confirmation.');
    }
  }

  return { correlated, findings };
}

// ---------------------------------------------------------------- 1275 ----

const ANALYTICS_PATH_HINTS = [
  { pattern: /\/t(r|rack|racking)\b/i, label: 'tracking' },
  { pattern: /\/collect\b/i, label: 'collection' },
  { pattern: /\/analytics?\b/i, label: 'analytics' },
  { pattern: /\/events?\b/i, label: 'events' },
  { pattern: /\/beacon\b/i, label: 'beacon' },
  { pattern: /\/pixel(\.gif)?\b/i, label: 'pixel' },
  { pattern: /\/telemetry\b/i, label: 'telemetry' },
  { pattern: /\/ingest\b/i, label: 'ingest' },
];

const SELF_HOSTED_HINTS = [/plausible/i, /matomo/i, /umami/i, /posthog/i, /fathom/i, /segment/i, /mixpanel/i];

/**
 * Discover self-hosted analytics/tracking endpoints from observed client-side
 * references (script URLs, fetch calls, beacon paths). Analytics ingestion
 * APIs frequently accept unsanitized event payloads with weak validation.
 *
 * @param {object} obs
 * @param {Array<{ ref: string, source?: string }>} [obs.candidates]
 *   — URL/path references observed in the target's client-side code or traffic.
 * @returns {{ endpoints: Array<{ path: string, label: string, selfHosted: boolean, source: string|null }>, findings: string[] }}
 */
export function discoverAnalyticsEndpoints({ candidates = [] } = {}) {
  const findings = [];
  const list = Array.isArray(candidates) ? candidates : [];

  const endpoints = [];
  const seen = new Set();
  for (const c of list) {
    const ref = String((c && c.ref) || '');
    if (!ref || seen.has(ref.toLowerCase())) continue;
    const hint = ANALYTICS_PATH_HINTS.find((h) => h.pattern.test(ref));
    if (!hint) continue;
    seen.add(ref.toLowerCase());
    endpoints.push({
      path: ref,
      label: hint.label,
      selfHosted: SELF_HOSTED_HINTS.some((p) => p.test(ref)),
      source: c && c.source ? String(c.source) : null,
    });
  }

  if (endpoints.length === 0) {
    findings.push(
      list.length === 0
        ? 'No client-side references supplied — analytics endpoint discovery is not possible from these observations.'
        : `Examined ${list.length} reference${list.length === 1 ? '' : 's'}; no analytics/tracking endpoint patterns matched.`
    );
  } else {
    findings.push(`Discovered ${endpoints.length} analytics endpoint${endpoints.length === 1 ? '' : 's'}: ${endpoints.map((e) => `${e.path} (${e.label})`).join(', ')}.`);
    const selfHosted = endpoints.filter((e) => e.selfHosted);
    if (selfHosted.length > 0) {
      findings.push(`Self-hosted analytics detected (${selfHosted.map((e) => e.path).join(', ')}) — self-hosted collectors are in-scope ingestion APIs; validate event-schema handling for unsanitized input.`);
    } else {
      findings.push('Endpoints appear third-party hosted — the interesting surface is the event schema the site sends, not the collector itself.');
    }
    findings.push('Analytics ingestion endpoints accept client-controlled event data by design — review server-side validation of event names, properties, and nested objects.');
  }

  return { endpoints, findings };
}

// ---------------------------------------------------------------- 1276 ----

const LOG_INJECTION_CHARS = /[\r\n\x00]/;

/**
 * Analyze X-Correlation-ID (request correlation ID) handling from probe
 * observations. Reflected correlation IDs aid log-injection analysis and
 * request tracing; non-validated reflection is a log-integrity risk.
 *
 * @param {object} obs
 * @param {Array<{ sentValue: string, reflectedValue?: string|null, reflectedInHeader?: boolean, reflectedInBody?: boolean }>} [obs.probes]
 *   — per-probe observations of what was sent and what came back.
 * @returns {{ reflected: boolean, reflectedCount: number, totalProbes: number, logInjectionSurface: boolean, findings: string[] }}
 */
export function testCorrelationIdReflection({ probes = [] } = {}) {
  const findings = [];
  const list = Array.isArray(probes) ? probes : [];

  const reflectedProbes = list.filter(
    (p) => p && typeof p.sentValue === 'string' && p.sentValue !== '' &&
      (p.reflectedInHeader === true || p.reflectedInBody === true ||
        (typeof p.reflectedValue === 'string' && p.reflectedValue.includes(p.sentValue)))
  );

  const reflected = reflectedProbes.length > 0;
  const logInjectionSurface = reflectedProbes.some((p) => LOG_INJECTION_CHARS.test(String(p.sentValue)));

  if (list.length === 0) {
    findings.push('No correlation-ID probes supplied — reflection behavior is unknown.');
  } else if (!reflected) {
    findings.push(`Correlation IDs were not reflected in ${list.length} probe${list.length === 1 ? '' : 's'} — the service generates or drops them server-side (good hygiene).`);
  } else {
    findings.push(`Correlation ID reflected in ${reflectedProbes.length}/${list.length} probe${list.length === 1 ? '' : 's'}${reflectedProbes.some((p) => p.reflectedInHeader) ? ' (response header)' : ''}${reflectedProbes.some((p) => p.reflectedInBody) ? ' (response body)' : ''}.`);
    findings.push('Reflected correlation IDs aid request tracing across services — useful for (authorized) log-correlation analysis.');
    if (logInjectionSurface) {
      findings.push('A probe value containing CR/LF/control characters was reflected — confirm the service sanitizes correlation IDs before writing logs; unsanitized reflection is a log-injection surface.');
    } else {
      findings.push('No control characters were reflected in the supplied probes — log-injection surface not demonstrated by these observations.');
    }
    findings.push('Recommendation: prefer server-generated opaque correlation IDs and validate/encode any client-supplied value before logging.');
  }

  return {
    reflected,
    reflectedCount: reflectedProbes.length,
    totalProbes: list.length,
    logInjectionSurface,
    findings,
  };
}

// ---------------------------------------------------------------- 1277 ----

/**
 * Compare observed API behavior across HTTP/2 and HTTP/1.1 for the same
 * request. Protocol-version differentials affect request-smuggling and
 * header-handling risk: features that exist in one version only (pseudo-
 * headers, HPACK, prioritization) change how the edge processes input.
 *
 * @param {object} obs
 * @param {{ status?: number, headers?: Record<string, string>, bodyLength?: number, supportsTrailers?: boolean, notes?: string }} [obs.http2]
 * @param {{ status?: number, headers?: Record<string, string>, bodyLength?: number, supportsTrailers?: boolean, notes?: string }} [obs.http11]
 * @returns {{ differences: Array<{ area: string, http2: string, http11: string, significance: string }>, findings: string[] }}
 */
export function diffHttp2VsHttp11({ http2 = {}, http11 = {} } = {}) {
  const findings = [];
  const differences = [];
  const h2 = http2 || {};
  const h1 = http11 || {};

  const norm = (h) => Object.fromEntries(
    Object.entries(h && typeof h === 'object' ? h : {}).map(([k, v]) => [String(k).toLowerCase(), String(v)])
  );
  const h2h = norm(h2.headers);
  const h1h = norm(h1.headers);

  if (h2.status !== undefined && h1.status !== undefined && h2.status !== h1.status) {
    differences.push({
      area: 'status-code',
      http2: String(h2.status),
      http11: String(h1.status),
      significance: 'HIGH — different status codes per protocol version means divergent request handling; smuggling-relevant.',
    });
  }

  const h2Keys = new Set(Object.keys(h2h));
  const h1Keys = new Set(Object.keys(h1h));
  const headerOnlyIn = (a, b, label) => [...a].filter((k) => !b.has(k)).map((k) => `${k} (${label})`);
  const headerDiffs = [
    ...headerOnlyIn(h2Keys, h1Keys, 'http2-only'),
    ...headerOnlyIn(h1Keys, h2Keys, 'http1.1-only'),
  ];
  for (const d of headerDiffs) {
    differences.push({
      area: 'response-header',
      http2: d.includes('http2-only') ? 'present' : 'absent',
      http11: d.includes('http1.1-only') ? 'present' : 'absent',
      significance: `MEDIUM — header ${d.split(' ')[0]} differs by version; version-conditional headers can leak routing or caching tiers.`,
    });
  }

  for (const k of [...h2Keys].filter((k) => h1Keys.has(k))) {
    if (h2h[k] !== h1h[k] && !['date', 'age', 'x-response-time'].includes(k)) {
      differences.push({
        area: 'response-header',
        http2: `${k}: ${h2h[k]}`,
        http11: `${k}: ${h1h[k]}`,
        significance: 'LOW — same header with different values across versions; check for version-dependent logic.',
      });
    }
  }

  if (h2.bodyLength !== undefined && h1.bodyLength !== undefined && h2.bodyLength !== h1.bodyLength) {
    differences.push({
      area: 'body-length',
      http2: String(h2.bodyLength),
      http11: String(h1.bodyLength),
      significance: 'HIGH — different body lengths for the same request suggest content transformation per version; smuggling-relevant.',
    });
  }

  if (h2.supportsTrailers !== undefined && h1.supportsTrailers !== undefined && h2.supportsTrailers !== h1.supportsTrailers) {
    differences.push({
      area: 'trailers',
      http2: String(h2.supportsTrailers),
      http11: String(h1.supportsTrailers),
      significance: 'MEDIUM — trailer support differs by version; TE/trailer desync is a known smuggling vector family.',
    });
  }

  if (differences.length === 0) {
    findings.push('No behavioral differences observed between HTTP/2 and HTTP/1.1 for the supplied observations.');
  } else {
    findings.push(`Found ${differences.length} protocol-version differential${differences.length === 1 ? '' : 's'}.`);
    if (differences.some((d) => d.significance.startsWith('HIGH'))) {
      findings.push('HIGH-significance differentials present — prioritize (authorized) request-smuggling and desync testing on the differing paths.');
    }
  }

  return { differences, findings };
}

// ---------------------------------------------------------------- 1278 ----

const ALT_SVC_H3 = /\bh3\b/i;

/**
 * Assess QUIC/HTTP-3 enablement from observed signals (Alt-Svc headers,
 * UDP/443 reachability notes). QUIC stacks are newer and historically show
 * immature edge-case handling, so an enabled QUIC listener deserves
 * protocol-parity testing against the TCP stack.
 *
 * @param {object} obs
 * @param {string} [obs.altSvcHeader] — observed Alt-Svc response header value.
 * @param {boolean} [obs.udp443Reachable] — whether UDP/443 answered during (authorized) probing.
 * @param {string} [obs.quicVersion] — observed QUIC version string, if any.
 * @returns {{ quicEnabled: boolean, signals: string[], findings: string[] }}
 */
export function probeHttp3QuicSupport({ altSvcHeader = '', udp443Reachable, quicVersion = '' } = {}) {
  const findings = [];
  const signals = [];
  const altSvc = String(altSvcHeader || '');

  if (ALT_SVC_H3.test(altSvc)) signals.push(`Alt-Svc advertises h3: ${altSvc.slice(0, 120)}`);
  if (udp443Reachable === true) signals.push('UDP/443 answered during probing');
  if (String(quicVersion || '').trim()) signals.push(`QUIC version observed: ${String(quicVersion).trim()}`);

  const quicEnabled = signals.length > 0;

  if (!quicEnabled) {
    findings.push('No QUIC/HTTP-3 enablement signals in the supplied observations.');
    if (udp443Reachable === false) findings.push('UDP/443 did not answer — QUIC listener appears absent.');
  } else {
    findings.push(`QUIC/HTTP-3 appears enabled (${signals.length} signal${signals.length === 1 ? '' : 's'}): ${signals.join('; ')}.`);
    findings.push('QUIC stacks have historically immature edge-case handling — run protocol-parity checks: same requests over TCP vs QUIC, compare status codes, header normalization, and error handling.');
    findings.push('Confirm the WAF/rate-limiting stack inspects QUIC traffic with the same rules as TCP; protocol-specific bypasses cluster around newer stacks.');
  }

  return { quicEnabled, signals, findings };
}

// ---------------------------------------------------------------- 1279 ----

const SOAP_ENVELOPE_HINTS = [
  /<\s*soap(-env)?\s*:\s*envelope/i,
  /schemas\.xmlsoap\.org\/soap\/envelope/i,
  /application\/soap\+xml/i,
  /text\/xml\s*;\s*charset/i,
];

const SHIM_PATH_HINTS = [
  /soap[-_]?rest/i,
  /rest[-_]?soap/i,
  /\/soap(\/|$)/i,
  /wsdl/i,
  /legacy[-_]?api/i,
  /bridge/i,
];

/**
 * Detect legacy SOAP-to-REST translation shims from observed endpoints.
 * Shim layers translate between protocols and frequently apply weaker
 * validation than the native REST surface — an important authz/validation
 * boundary to map.
 *
 * @param {object} obs
 * @param {Array<{ path: string, contentType?: string, bodySnippet?: string, notes?: string }>} [obs.endpoints]
 *   — endpoints observed during (authorized) recon.
 * @returns {{ shims: Array<{ path: string, indicators: string[], finding: string }>, findings: string[] }}
 */
export function huntSoapRestShims({ endpoints = [] } = {}) {
  const findings = [];
  const list = Array.isArray(endpoints) ? endpoints : [];

  const shims = [];
  for (const e of list) {
    if (!e || typeof e.path !== 'string') continue;
    const indicators = [];
    const haystack = `${e.path} ${e.contentType || ''} ${e.bodySnippet || ''}`;

    if (SHIM_PATH_HINTS.some((p) => p.test(e.path))) indicators.push('shim-like path');
    if (SOAP_ENVELOPE_HINTS.some((p) => p.test(haystack))) indicators.push('SOAP envelope / soap+xml content marker');

    if (indicators.length > 0) {
      shims.push({
        path: e.path,
        indicators,
        finding: `Possible SOAP-to-REST shim at ${e.path} (${indicators.join(', ')}) — translation layers often validate less strictly than native REST handlers; compare input validation and authz against the equivalent native endpoint.`,
      });
    }
  }

  if (list.length === 0) {
    findings.push('No endpoints supplied — shim hunting is not possible from these observations.');
  } else if (shims.length === 0) {
    findings.push(`Examined ${list.length} endpoint${list.length === 1 ? '' : 's'}; no SOAP-to-REST shim indicators found.`);
  } else {
    findings.push(`Detected ${shims.length} possible SOAP-to-REST shim${shims.length === 1 ? '' : 's'}: ${shims.map((s) => s.path).join(', ')}.`);
    findings.push('For each shim: diff its validation against the native REST equivalent — field allowlists, type coercion, and authz checks frequently diverge at the translation boundary.');
  }

  return { shims, findings };
}

// ---------------------------------------------------------------- 1280 ----

/**
 * Normalize a GraphQL operation name to candidate REST path fragments.
 * @param {string} name
 * @returns {string[]}
 */
function restNameVariants(name) {
  const base = String(name || '').replace(/^(get|fetch|list|create|update|delete|remove|mutation|query)/i, '');
  const core = base || String(name || '');
  const kebab = core.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  const snake = core.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  return [...new Set([kebab, snake, core.toLowerCase()])].filter(Boolean);
}

/**
 * Map GraphQL operations to their REST equivalents (fallbacks/duplicates).
 * When the same business operation exists in both GraphQL and REST, the two
 * implementations can enforce different authorization or validation — the
 * fallback surface must be tested independently.
 *
 * @param {object} obs
 * @param {string[]} [obs.graphqlOps] — operation names observed in the GraphQL schema/docs.
 * @param {Array<{ path: string, method?: string }>} [obs.restEndpoints] — REST endpoints observed during recon.
 * @returns {{ mappings: Array<{ operation: string, restEndpoint: string, method: string, confidence: 'high'|'medium', note: string }>, unmappedOperations: string[], findings: string[] }}
 */
export function discoverGraphqlRestFallbacks({ graphqlOps = [], restEndpoints = [] } = {}) {
  const findings = [];
  const ops = (Array.isArray(graphqlOps) ? graphqlOps : []).map(String).filter(Boolean);
  const rest = (Array.isArray(restEndpoints) ? restEndpoints : []).filter((r) => r && typeof r.path === 'string');

  const mappings = [];
  const unmappedOperations = [];

  for (const op of ops) {
    const variants = restNameVariants(op);
    const matches = [];
    for (const r of rest) {
      const pathLower = r.path.toLowerCase();
      for (const v of variants) {
        if (v.length >= 3 && (pathLower.includes(`/${v}`) || pathLower.includes(`/${v}s`) || pathLower.endsWith(`/${v}`))) {
          matches.push({ r, variant: v });
          break;
        }
      }
    }
    if (matches.length === 0) {
      unmappedOperations.push(op);
    } else {
      for (const { r, variant } of matches) {
        mappings.push({
          operation: op,
          restEndpoint: r.path,
          method: String(r.method || 'GET').toUpperCase(),
          confidence: variant.length >= 6 ? 'high' : 'medium',
          note: `GraphQL operation '${op}' has a REST equivalent at ${r.path} — duplicated business logic; verify authz and validation parity between the two.`,
        });
      }
    }
  }

  if (ops.length === 0) {
    findings.push('No GraphQL operations supplied — fallback mapping is not possible.');
  } else if (mappings.length === 0) {
    findings.push(`Examined ${ops.length} GraphQL operation${ops.length === 1 ? '' : 's'} against ${rest.length} REST endpoint${rest.length === 1 ? '' : 's'}; no REST fallbacks identified.`);
  } else {
    findings.push(`Mapped ${mappings.length} GraphQL->REST fallback${mappings.length === 1 ? '' : 's'}: ${mappings.map((m) => `${m.operation} => ${m.method} ${m.restEndpoint}`).join('; ')}.`);
    findings.push('Each fallback duplicates business logic with potentially different authz — test both paths with the same (authorized) low-privilege identity and compare enforcement.');
  }
  if (unmappedOperations.length > 0) {
    findings.push(`${unmappedOperations.length} operation${unmappedOperations.length === 1 ? '' : 's'} with no REST match: ${unmappedOperations.join(', ')}.`);
  }

  return { mappings, unmappedOperations, findings };
}
