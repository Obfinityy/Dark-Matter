/**
 * postgresStartupParser.js — PostgreSQL startup-response analyzer (idea 00369).
 *
 * Parses a captured PostgreSQL server response to a startup packet —
 * typically an Authentication message ('R'), an ErrorResponse ('E'), or
 * ParameterStatus messages ('S') — to fingerprint the required auth
 * mechanism and server version without completing authentication.
 *
 * Offline analyzer: callers supply captured response bytes (Buffer /
 * Uint8Array / hex string) or an already-decoded object. This module never
 * opens PostgreSQL connections and never sends credentials.
 */

/** Authentication message type codes (Authentication* server messages). */
export const PG_AUTH_TYPES = {
  0: { mechanism: 'Trust', requiresPassword: false, description: 'No authentication required — any client is accepted as the claimed user.' },
  2: { mechanism: 'KerberosV5', requiresPassword: false, description: 'Kerberos v5 ticket required.' },
  3: { mechanism: 'CleartextPassword', requiresPassword: true, description: 'Password sent in cleartext — must only appear inside TLS.' },
  5: { mechanism: 'MD5Password', requiresPassword: true, description: 'MD5 challenge-response (legacy; weak against offline cracking).' },
  7: { mechanism: 'GSS', requiresPassword: false, description: 'GSSAPI authentication.' },
  8: { mechanism: 'GSSContinue', requiresPassword: false, description: 'GSSAPI continuation.' },
  9: { mechanism: 'SSPI', requiresPassword: false, description: 'SSPI authentication (Windows).' },
  10: { mechanism: 'SASL', requiresPassword: true, description: 'SASL negotiation follows (usually SCRAM-SHA-256).' },
  11: { mechanism: 'SASLContinue', requiresPassword: true, description: 'SASL continuation.' },
  12: { mechanism: 'SASLFinal', requiresPassword: true, description: 'SASL final message.' },
};

/** ErrorResponse field codes. */
export const PG_ERROR_FIELDS = {
  S: 'severity', V: 'severityVerbose', C: 'code', M: 'message', D: 'detail',
  H: 'hint', P: 'position', p: 'internalPosition', q: 'internalQuery',
  W: 'where', s: 'schema', t: 'table', c: 'column', d: 'datatype',
  n: 'constraint', F: 'file', L: 'line', R: 'routine',
};

/**
 * Normalize input bytes.
 * @param {Buffer|Uint8Array|number[]|string} input Bytes or hex string.
 * @returns {Uint8Array}
 */
export function toBytes(input) {
  if (typeof input === 'string') {
    const clean = input.replace(/[^0-9a-fA-F]/g, '');
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    return out;
  }
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(input)) return new Uint8Array(input);
  return Uint8Array.from(input || []);
}

/** Read a null-terminated string from bytes at offset. */
function readCString(bytes, offset) {
  let end = offset;
  while (end < bytes.length && bytes[end] !== 0) end++;
  const text = String.fromCharCode(...bytes.slice(offset, end));
  return { text, next: end + 1 };
}

function readInt32(bytes, offset) {
  return (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
}

/**
 * Parse one PostgreSQL server message (type byte + int32 length + payload).
 * @param {Uint8Array} bytes
 * @returns {{type: string, payload: Uint8Array}|null}
 */
export function parsePgMessage(bytes) {
  if (!bytes || bytes.length < 5) return null;
  const type = String.fromCharCode(bytes[0]);
  const length = readInt32(bytes, 1);
  if (length < 4 || bytes.length < 1 + length) return null;
  return { type, payload: bytes.slice(5, 1 + length) };
}

/**
 * Parse an Authentication ('R') payload.
 * @param {Uint8Array} payload
 */
export function parsePgAuth(payload) {
  if (payload.length < 4) return { authType: null, mechanism: 'unknown', requiresPassword: null };
  const authType = readInt32(payload, 0);
  const known = PG_AUTH_TYPES[authType];
  if (known) return { authType, mechanism: known.mechanism, requiresPassword: known.requiresPassword, description: known.description };
  return { authType, mechanism: `Unknown (${authType})`, requiresPassword: null, description: 'Unrecognized auth type code.' };
}

/**
 * Parse an ErrorResponse ('E') payload into named fields.
 * @param {Uint8Array} payload
 */
export function parsePgError(payload) {
  const fields = {};
  let offset = 0;
  while (offset < payload.length && payload[offset] !== 0) {
    const code = String.fromCharCode(payload[offset]);
    const { text, next } = readCString(payload, offset + 1);
    fields[PG_ERROR_FIELDS[code] || code] = text;
    offset = next;
  }
  return fields;
}

/**
 * Parse a ParameterStatus ('S') payload into {name, value}.
 * @param {Uint8Array} payload
 */
export function parsePgParameterStatus(payload) {
  const a = readCString(payload, 0);
  const b = readCString(payload, a.next);
  return { name: a.text, value: b.text };
}

/**
 * Analyze a captured startup response: auth posture + version fingerprint.
 * Accepts raw bytes, or {authType, parameters, error} when pre-decoded.
 * @param {Buffer|Uint8Array|number[]|string|object} input
 * @returns {{messageType, auth, serverVersion, parameters, error, findings, confidence}}
 */
export function analyzePgStartup(input) {
  const findings = [];
  let auth = { authType: null, mechanism: 'unknown', requiresPassword: null };
  let parameters = {};
  let error = null;
  let messageType = 'unknown';

  if (input && typeof input === 'object' && !(input instanceof Uint8Array) && typeof Buffer !== 'undefined' && !Buffer.isBuffer(input) && !Array.isArray(input)) {
    // Pre-decoded form.
    if (input.authType != null) { auth = parsePgAuth(new Uint8Array([(input.authType >>> 24) & 255, (input.authType >>> 16) & 255, (input.authType >>> 8) & 255, input.authType & 255])); messageType = 'Authentication'; }
    parameters = input.parameters || {};
    error = input.error || null;
    if (error) messageType = 'ErrorResponse';
  } else {
    const bytes = toBytes(input);
    const msg = parsePgMessage(bytes);
    if (!msg) {
      return { messageType, auth, serverVersion: null, parameters, error, findings: ['Could not parse a PostgreSQL server message from the captured bytes.'], confidence: 'low' };
    }
    messageType = { R: 'Authentication', E: 'ErrorResponse', S: 'ParameterStatus', K: 'BackendKeyData', N: 'NoticeResponse' }[msg.type] || `Unknown (${msg.type})`;
    if (msg.type === 'R') auth = parsePgAuth(msg.payload);
    else if (msg.type === 'E') error = parsePgError(msg.payload);
    else if (msg.type === 'S') { const p = parsePgParameterStatus(msg.payload); parameters[p.name] = p.value; }
  }

  if (messageType === 'Authentication') {
    findings.push(`Server requests "${auth.mechanism}" authentication.`);
    if (auth.authType === 0) findings.push('CRITICAL: Trust authentication — the server accepts the connection with NO password for this user/database/host combination.');
    else if (auth.authType === 3) findings.push('HIGH: cleartext password auth — credentials travel unencrypted unless the session is inside TLS.');
    else if (auth.authType === 5) findings.push('MEDIUM: MD5 challenge-response — legacy and weak; prefer SCRAM-SHA-256.');
    else if (auth.authType === 10) findings.push('SASL negotiation (typically SCRAM-SHA-256) — modern, strong auth.');
    else findings.push(auth.description || 'Unrecognized auth mechanism.');
    if (auth.requiresPassword === true) findings.push('A password (or equivalent credential) is required to proceed.');
  }
  if (error) {
    findings.push(`Server refused startup: [${error.code || '?'}] ${error.message || ''}`.trim());
    if (/password|authentication/i.test(error.message || '')) findings.push('Refusal is auth-related — the listener is live and parsing startup packets.');
  }
  const serverVersion = parameters.server_version || null;
  if (serverVersion) findings.push(`Server version reported via ParameterStatus: ${serverVersion}.`);
  if (parameters.server_encoding) findings.push(`Server encoding: ${parameters.server_encoding}.`);

  return {
    messageType,
    auth,
    serverVersion,
    parameters,
    error,
    findings,
    confidence: messageType === 'Authentication' || error ? 'high' : 'medium',
  };
}

export const PG_STARTUP_PARSER = { toBytes, parsePgMessage, parsePgAuth, parsePgError, parsePgParameterStatus, analyzePgStartup, PG_AUTH_TYPES };
export default PG_STARTUP_PARSER;
