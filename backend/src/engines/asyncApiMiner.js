/**
 * asyncApiMiner.js — AsyncAPI broker host extractor.
 *
 * Parses AsyncAPI specification documents (YAML or JSON) and extracts:
 *  - servers: names, URLs, protocols (message-broker hosts)
 *  - channels: channel names (topics/exchanges/queues) and their operations
 *  - message payloads advertised per channel
 *
 * Parsing is dependency-free: JSON is parsed natively; YAML is handled by a
 * small indentation-aware block parser tuned for the AsyncAPI `servers`,
 * `channels`, and `components` sections. Pure text analysis — the caller
 * supplies the fetched specification.
 *
 * Defensive use: authorized asset discovery — learning which message
 * brokers (Kafka, AMQP, MQTT, NATS, …) a target advertises so their
 * exposure can be reviewed.
 */

/**
 * Try to parse the document as JSON; return null when it is not JSON.
 *
 * @param {string} text
 * @returns {any|null}
 */
export function tryParseJson(text) {
  const t = String(text || '').trim();
  if (!t.startsWith('{')) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

/**
 * Minimal indentation-aware YAML block parser for AsyncAPI sections.
 * Returns a nested object of scalar key/value pairs for the leading
 * `servers`, `channels`, `info` sections (nested maps only, no lists).
 *
 * @param {string} text - Raw YAML text.
 * @returns {object}
 */
export function parseYamlBlocks(text) {
  const root = {};
  const stack = [{ indent: -1, obj: root }];
  for (const rawLine of String(text || '').split('\n')) {
    const line = rawLine.replace(/\t/g, '  ');
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const indent = line.length - line.trimStart().length;
    const content = line.trim();
    const kv = content.match(/^([\w.\-\/{}+=*<>$#@!()|&?~:]+?)\s*:\s*(.*?)\s*$/);
    if (!kv) continue;
    const key = kv[1];
    let value = kv[2];
    if (value === '' || value === '|' || value === '>') value = null;
    else if (/^['"]/.test(value)) value = value.replace(/^['"]|['"]$/g, '');
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].obj;
    if (value === null) {
      parent[key] = {};
      stack.push({ indent, obj: parent[key] });
    } else {
      parent[key] = value;
    }
  }
  return root;
}

/**
 * Extract broker server definitions.
 *
 * @param {any} doc - Parsed spec (JSON object or YAML-block object).
 * @returns {{ name: string, url: string, protocol: string, protocolVersion: string|null }[]}
 */
export function extractServers(doc) {
  const servers = doc && typeof doc === 'object' ? doc.servers : null;
  if (!servers || typeof servers !== 'object') return [];
  return Object.entries(servers).map(([name, s]) => ({
    name,
    url: typeof s.url === 'string' ? s.url : '',
    protocol: typeof s.protocol === 'string' ? s.protocol.toLowerCase() : 'unknown',
    protocolVersion: typeof s.protocolVersion === 'string' ? s.protocolVersion : null,
  }));
}

/**
 * Extract channel names with their operations.
 *
 * @param {any} doc - Parsed spec (JSON object or YAML-block object).
 * @returns {{ name: string, operations: string[] }[]}
 */
export function extractChannels(doc) {
  const channels = doc && typeof doc === 'object' ? doc.channels : null;
  if (!channels || typeof channels !== 'object') return [];
  return Object.entries(channels).map(([name, c]) => {
    const ops = [];
    if (c && typeof c === 'object') {
      if (c.publish) ops.push('publish');
      if (c.subscribe) ops.push('subscribe');
    }
    return { name, operations: ops };
  });
}

/**
 * Extract hostnames from broker server URLs.
 *
 * @param {{ url: string }[]} servers
 * @returns {string[]} Unique broker hosts.
 */
export function extractBrokerHosts(servers) {
  const out = [];
  const seen = new Set();
  for (const s of servers) {
    const url = String(s.url || '').trim();
    if (!url) continue;
    // Broker URLs often lack a scheme; try as-is then with a placeholder scheme.
    const candidates = [
      url,
      /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? null : `placeholder://${url}`,
    ].filter(Boolean);
    for (const cand of candidates) {
      try {
        const u = new URL(cand);
        if (u.hostname && !seen.has(u.hostname)) {
          seen.add(u.hostname);
          out.push(u.hostname);
          break;
        }
        // No usable hostname from this candidate — try the next one.
      } catch {
        // try next candidate
      }
    }
  }
  return out;
}

/**
 * Full analysis of a fetched AsyncAPI specification.
 *
 * @param {{ url?: string, specText: string }} input
 * @returns {{ type: string, confidence: string, version: string|null, title: string|null, servers: object[], brokerHosts: string[], channels: object[], evidence: string }}
 */
export function analyzeAsyncApi({ url = '', specText = '' } = {}) {
  const text = String(specText || '');
  const json = tryParseJson(text);
  const doc = json ?? parseYamlBlocks(text);
  const version =
    typeof doc.asyncapi === 'string'
      ? doc.asyncapi
      : typeof doc.openapi === 'string'
        ? `openapi:${doc.openapi}`
        : null;
  const title = doc.info && typeof doc.info.title === 'string' ? doc.info.title : null;
  const servers = extractServers(doc);
  const channels = extractChannels(doc);
  const brokerHosts = extractBrokerHosts(servers);

  return {
    type: 'AsyncAPI Broker Host Extraction',
    confidence: servers.length || channels.length ? 'high' : 'low',
    version,
    title,
    servers,
    brokerHosts,
    channels,
    evidence:
      servers.length > 0
        ? `AsyncAPI spec${url ? ` at ${url}` : ''}${title ? ` '${title}'` : ''} declares ${servers.length} broker server(s) (${brokerHosts.join(', ') || 'no hosts parsed'}) and ${channels.length} channel(s).`
        : `No AsyncAPI servers/channels parsed${url ? ` at ${url}` : ''}.`,
  };
}

export const ASYNCAPI_MINER = {
  tryParseJson,
  parseYamlBlocks,
  extractServers,
  extractChannels,
  extractBrokerHosts,
  analyzeAsyncApi,
};
export default ASYNCAPI_MINER;
