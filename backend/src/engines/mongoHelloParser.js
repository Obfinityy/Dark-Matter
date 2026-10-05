/**
 * mongoHelloParser.js — MongoDB hello/isMaster fingerprinting (idea 00368).
 *
 * Parses a captured `hello` (modern) or `isMaster` (legacy) command response
 * from an in-scope MongoDB server to fingerprint the deployment: wire-protocol
 * version → server version estimate, topology (standalone / replica set /
 * sharded), exposed host list, and session/auth capability hints.
 *
 * Offline analyzer: callers supply the captured response object (or its JSON
 * text). This module never connects to MongoDB and never runs commands.
 */

/** maxWireVersion → approximate server version (hello responses carry no explicit version). */
export const WIRE_VERSION_MAP = [
  { maxWire: 25, version: '8.0.x' },
  { maxWire: 21, version: '7.0.x' },
  { maxWire: 17, version: '6.0.x' },
  { maxWire: 13, version: '5.0.x' },
  { maxWire: 9, version: '4.4.x' },
  { maxWire: 8, version: '4.2.x' },
  { maxWire: 7, version: '4.0.x' },
  { maxWire: 6, version: '3.6.x' },
];

/**
 * Estimate the server version from wire protocol versions.
 * @param {number|null} maxWire
 * @param {number|null} minWire
 * @returns {string}
 */
export function estimateServerVersion(maxWire, minWire) {
  if (maxWire == null) return 'unknown';
  const hit = WIRE_VERSION_MAP.find((e) => maxWire >= e.maxWire);
  return hit ? hit.version : `older than 3.6 (wire ${maxWire})`;
}

/**
 * Classify deployment topology from hello fields.
 * @param {object} r Response object.
 * @returns {{topology: string, detail: string}}
 */
export function classifyTopology(r) {
  if (r.msg === 'isdbgrid') return { topology: 'sharded', detail: 'mongos router (sharded cluster entry point)' };
  if (r.setName) {
    return {
      topology: 'replica-set',
      detail: `replica set "${r.setName}"${r.secondary ? ' (this node is a SECONDARY)' : ''}${r.arbiterOnly ? ' (this node is an ARBITER)' : ''}`,
    };
  }
  return { topology: 'standalone', detail: 'standalone mongod (no replica set)' };
}

/**
 * Analyze a captured hello/isMaster response.
 * @param {object|string} input Response object or JSON text.
 * @returns {{fingerprint, topology, hosts, capabilities, findings, confidence}}
 */
export function analyzeMongoHello(input) {
  let r = input;
  if (typeof r === 'string') {
    try { r = JSON.parse(r); } catch { return { findings: ['Response was not valid JSON.'], confidence: 'low' }; }
  }
  r = r || {};
  const findings = [];

  const maxWire = r.maxWireVersion ?? null;
  const minWire = r.minWireVersion ?? null;
  const estimatedVersion = estimateServerVersion(maxWire, minWire);
  findings.push(`Wire protocol ${minWire ?? '?'}–${maxWire ?? '?'} → estimated server ${estimatedVersion}.`);

  const { topology, detail } = classifyTopology(r);
  findings.push(`Topology: ${topology} — ${detail}.`);

  const hosts = Array.isArray(r.hosts) ? r.hosts.map(String) : [];
  const passives = Array.isArray(r.passives) ? r.passives.map(String) : [];
  const arbiters = Array.isArray(r.arbiters) ? r.arbiters.map(String) : [];
  if (hosts.length > 0) {
    findings.push(`Replica set advertises ${hosts.length} member host(s): ${hosts.join(', ')} — internal hostnames/IPs are disclosed to anyone who can reach the port.`);
  }
  if (r.me) findings.push(`Server identifies itself as "${r.me}".`);

  const maxBson = r.maxBsonObjectSize ?? null;
  const maxMsg = r.maxMessageSizeBytes ?? null;
  const logicalTimeout = r.logicalSessionTimeoutMinutes ?? null;
  if (logicalTimeout != null) findings.push(`Logical sessions enabled (timeout ${logicalTimeout} min) — retryable writes/transactions supported.`);

  const mechs = Array.isArray(r.saslSupportedMechs) ? r.saslSupportedMechs.map(String) : [];
  if (mechs.length > 0) findings.push(`SASL mechanisms offered: ${mechs.join(', ')}.`);
  if (r.helloOk === true) findings.push('Server speaks the modern "hello" command (5.1+ style handshake).');

  if (topology === 'standalone') {
    findings.push('NOTE: a standalone mongod has no failover; also confirm access control is enabled server-side (hello alone cannot prove auth state).');
  }
  if (r.secondary === true) {
    findings.push('This node is a SECONDARY — reads here may serve stale data; the primary should be identified for a full picture.');
  }
  if (r.setVersion != null) findings.push(`Replica set config version: ${r.setVersion}.`);
  if (r.electionId) findings.push('Election ID present — a primary election has occurred on this set.');

  return {
    fingerprint: { estimatedVersion, maxWireVersion: maxWire, minWireVersion: minWire, helloOk: r.helloOk ?? null },
    topology: { topology, detail, setName: r.setName ?? null, me: r.me ?? null },
    hosts: { members: hosts, passives, arbiters },
    capabilities: { maxBsonObjectSize: maxBson, maxMessageSizeBytes: maxMsg, logicalSessionTimeoutMinutes: logicalTimeout, saslSupportedMechs: mechs },
    findings,
    confidence: maxWire != null ? 'high' : 'medium',
  };
}

export const MONGO_HELLO_PARSER = { analyzeMongoHello, estimateServerVersion, classifyTopology, WIRE_VERSION_MAP };
export default MONGO_HELLO_PARSER;
