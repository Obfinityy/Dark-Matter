/**
 * mysqlHandshakeParser.js — MySQL initial handshake parser (idea 00370).
 *
 * Parses a captured MySQL Protocol::HandshakeV10 packet (the first packet a
 * server sends) to fingerprint the server: protocol version, version string
 * (MySQL vs MariaDB vs Percona), connection ID, character set, status flags,
 * the full 32-bit capability bitmap decoded into named flags, and the
 * authentication plugin name.
 *
 * Offline analyzer: callers supply captured handshake bytes (Buffer /
 * Uint8Array / number[] / hex string). This module never connects to MySQL
 * and never sends credentials.
 */

/** MySQL capability flags (client → server and server → client bitmap). */
export const MYSQL_CAPABILITIES = [
  [0x00000001, 'CLIENT_LONG_PASSWORD', 'New (4.1+) password format'],
  [0x00000002, 'CLIENT_FOUND_ROWS', 'Return found rows instead of affected rows'],
  [0x00000004, 'CLIENT_LONG_FLAG', 'Get all column flags'],
  [0x00000008, 'CLIENT_CONNECT_WITH_DB', 'Can connect with a default database'],
  [0x00000010, 'CLIENT_NO_SCHEMA', 'Disallow database.table.column syntax'],
  [0x00000020, 'CLIENT_COMPRESS', 'Compression protocol supported'],
  [0x00000040, 'CLIENT_ODBC', 'ODBC client'],
  [0x00000080, 'CLIENT_LOCAL_FILES', 'LOCAL INFILE support'],
  [0x00000100, 'CLIENT_IGNORE_SPACE', 'Allow spaces after function names'],
  [0x00000200, 'CLIENT_PROTOCOL_41', '4.1+ protocol features'],
  [0x00000400, 'CLIENT_INTERACTIVE', 'Interactive client (longer timeouts)'],
  [0x00000800, 'CLIENT_SSL', 'TLS/SSL supported'],
  [0x00001000, 'CLIENT_IGNORE_SIGPIPE', 'Do not raise SIGPIPE'],
  [0x00002000, 'CLIENT_TRANSACTIONS', 'Knows about transactions'],
  [0x00004000, 'CLIENT_RESERVED', 'Old 4.1 protocol flag'],
  [0x00008000, 'CLIENT_SECURE_CONNECTION', '4.1 authentication supported'],
  [0x00010000, 'CLIENT_MULTI_STATEMENTS', 'Multiple statements per query'],
  [0x00020000, 'CLIENT_MULTI_RESULTS', 'Multiple result sets'],
  [0x00040000, 'CLIENT_PS_MULTI_RESULTS', 'Multiple results from prepared statements'],
  [0x00080000, 'CLIENT_PLUGIN_AUTH', 'Auth plugin negotiation supported'],
  [0x00100000, 'CLIENT_CONNECT_ATTRS', 'Connection attributes supported'],
  [0x00200000, 'CLIENT_PLUGIN_AUTH_LENENC_CLIENT_DATA', 'Length-encoded auth data'],
  [0x00400000, 'CLIENT_CAN_HANDLE_EXPIRED_PASSWORDS', 'Can handle expired passwords'],
  [0x00800000, 'CLIENT_SESSION_TRACK', 'Session state tracking'],
  [0x01000000, 'CLIENT_DEPRECATE_EOF', 'EOF packet deprecated'],
  [0x02000000, 'CLIENT_OPTIONAL_RESULTSET_METADATA', 'Optional metadata'],
  [0x04000000, 'CLIENT_ZSTD_COMPRESSION_ALGORITHM', 'zstd compression supported'],
  [0x08000000, 'CLIENT_QUERY_ATTRIBUTES', 'Query attributes supported'],
  [0x10000000, 'MULTI_FACTOR_AUTHENTICATION', 'Multi-factor auth supported'],
  [0x20000000, 'CLIENT_CAPABILITY_EXTENSION', 'Extended capabilities present'],
  [0x40000000, 'CLIENT_SSL_VERIFY_SERVER_CERT', 'Verifies server certificate'],
  [0x80000000, 'CLIENT_REMEMBER_OPTIONS', 'Remembers options between reconnects'],
];

/** MySQL status flags (2 bytes after the charset byte). */
export const MYSQL_STATUS_FLAGS = [
  [0x0001, 'SERVER_STATUS_IN_TRANS', 'A transaction is active'],
  [0x0002, 'SERVER_STATUS_AUTOCOMMIT', 'Autocommit is enabled'],
  [0x0008, 'SERVER_MORE_RESULTS_EXISTS', 'More results exist'],
  [0x0010, 'SERVER_QUERY_NO_GOOD_INDEX_USED', 'No good index was used'],
  [0x0020, 'SERVER_QUERY_NO_INDEX_USED', 'No index was used'],
  [0x0040, 'SERVER_STATUS_CURSOR_EXISTS', 'Cursor exists'],
  [0x0080, 'SERVER_STATUS_LAST_ROW_SENT', 'Last row sent'],
  [0x0100, 'SERVER_STATUS_DB_DROPPED', 'Database dropped'],
  [0x0200, 'SERVER_STATUS_NO_BACKSLASH_ESCAPES', 'NO_BACKSLASH_ESCAPES mode'],
  [0x0400, 'SERVER_STATUS_METADATA_FOLLOWED', 'Metadata follows results'],
];

/** Normalize input to Uint8Array. */
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

function readCString(bytes, offset) {
  let end = offset;
  while (end < bytes.length && bytes[end] !== 0) end++;
  return { text: String.fromCharCode(...bytes.slice(offset, end)), next: end + 1 };
}

function readU16LE(b, o) { return b[o] | (b[o + 1] << 8); }
function readU32LE(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

/**
 * Decode a capability bitmap into named flags.
 * @param {number} bitmap 32-bit capability value.
 * @returns {Array<{flag: string, description: string}>}
 */
export function decodeCapabilities(bitmap) {
  return MYSQL_CAPABILITIES
    .filter(([bit]) => (bitmap & bit) !== 0)
    .map(([, flag, description]) => ({ flag, description }));
}

/**
 * Identify the server vendor from the version string.
 * @param {string} versionString e.g. "8.0.36", "5.5.5-10.11.7-MariaDB".
 */
export function identifyVendor(versionString) {
  const v = String(versionString || '');
  if (/mariadb/i.test(v)) return { vendor: 'MariaDB', version: v };
  if (/percona/i.test(v)) return { vendor: 'Percona Server', version: v };
  const m = /^(\d+\.\d+\.\d+)/.exec(v);
  return { vendor: 'MySQL (Oracle)', version: m ? m[1] : v, raw: v };
}

/**
 * Parse a MySQL HandshakeV10 packet.
 * @param {Buffer|Uint8Array|number[]|string} input Captured handshake bytes (payload only, no packet header).
 * @returns {{protocolVersion, serverVersion, vendor, connectionId, charset, statusFlags, capabilities, authPlugin, findings, confidence}}
 */
export function parseMysqlHandshake(input) {
  const bytes = toBytes(input);
  const findings = [];
  if (bytes.length < 10) {
    return { findings: ['Captured bytes too short for a MySQL handshake.'], confidence: 'low' };
  }
  const protocolVersion = bytes[0];
  if (protocolVersion !== 10) {
    return { protocolVersion, findings: [`Unexpected protocol version ${protocolVersion} (expected 10).`], confidence: 'low' };
  }

  const v = readCString(bytes, 1);
  const serverVersion = v.text;
  let offset = v.next;
  const connectionId = readU32LE(bytes, offset); offset += 4;
  offset += 8; // auth-plugin-data-part-1
  offset += 1; // filler
  const capLower = readU16LE(bytes, offset); offset += 2;
  const charset = bytes[offset]; offset += 1;
  const statusBits = readU16LE(bytes, offset); offset += 2;
  const statusFlags = MYSQL_STATUS_FLAGS.filter(([bit]) => (statusBits & bit) !== 0).map(([, flag, description]) => ({ flag, description }));
  const capUpper = readU16LE(bytes, offset); offset += 2;
  const capabilities = (((capUpper << 16) | capLower) >>> 0);
  const authPluginDataLen = bytes[offset]; offset += 1;
  offset += 10; // reserved
  const part2Len = Math.max(13, authPluginDataLen - 8);
  offset += Math.min(part2Len, bytes.length - offset);
  let authPlugin = null;
  if (offset < bytes.length) {
    if (bytes[offset] === 0) offset += 1; // trailing NUL of auth data
    if (offset < bytes.length) {
      const p = readCString(bytes, offset);
      authPlugin = p.text || null;
    }
  }

  const vendor = identifyVendor(serverVersion);
  const caps = decodeCapabilities(capabilities);
  const capNames = new Set(caps.map((c) => c.flag));

  findings.push(`MySQL protocol 10 handshake: ${vendor.vendor} ${vendor.version} (connection id ${connectionId}).`);
  if (/mariadb/i.test(serverVersion)) findings.push('Version string identifies MariaDB (note the 5.5.5 compatibility prefix some MariaDB builds send).');
  findings.push(`Server offers ${caps.length} capability flag(s).`);
  if (!capNames.has('CLIENT_SSL')) findings.push('HIGH: server does not advertise CLIENT_SSL — connections may fall back to plaintext.');
  else findings.push('Server advertises CLIENT_SSL — encrypted sessions are negotiable.');
  if (authPlugin) {
    findings.push(`Authentication plugin: ${authPlugin}.`);
    if (authPlugin === 'mysql_native_password') findings.push('MEDIUM: mysql_native_password uses SHA1-based auth — weaker than caching_sha2_password.');
    else if (authPlugin === 'caching_sha2_password') findings.push('caching_sha2_password — modern default auth plugin.');
  }
  const majorMinor = /^(\d+)\.(\d+)/.exec(vendor.version);
  if (majorMinor && (parseInt(majorMinor[1], 10) < 5 || (majorMinor[1] === '5' && parseInt(majorMinor[2], 10) < 7))) {
    findings.push(`HIGH: ${vendor.version} is end-of-life and receives no security fixes.`);
  }
  if (!capNames.has('CLIENT_PLUGIN_AUTH')) findings.push('No auth-plugin negotiation advertised — legacy 4.1-era auth handshake.');

  return {
    protocolVersion,
    serverVersion,
    vendor: vendor.vendor,
    connectionId,
    charset,
    statusFlags,
    capabilityBitmap: `0x${capabilities.toString(16).padStart(8, '0')}`,
    capabilities: caps,
    authPlugin,
    findings,
    confidence: 'high',
  };
}

export const MYSQL_HANDSHAKE_PARSER = { toBytes, decodeCapabilities, identifyVendor, parseMysqlHandshake, MYSQL_CAPABILITIES, MYSQL_STATUS_FLAGS };
export default MYSQL_HANDSHAKE_PARSER;
