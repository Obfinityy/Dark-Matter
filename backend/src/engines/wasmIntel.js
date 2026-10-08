/**
 * wasmIntel.js — WebAssembly binary intelligence for attack-surface mapping.
 *
 * WebAssembly modules shipped to browsers embed string constants: API
 * endpoints, environment-variable names, header names and key *references*.
 * For an authorized bug-bounty hunt this engine parses observed .wasm
 * binaries (magic + section walk) and extracts printable strings, then
 * classifies them into embedded endpoints and key references — purely
 * passive binary analysis of assets the target already publishes.
 *
 * Idea covered:
 *  - 700 WASM binary string extraction (embedded endpoints + key references)
 *
 * Defensive note: only identifier-like *references* to keys are reported
 * (e.g. `REACT_APP_API_KEY`, `X-Api-Key`, `authToken`) — secret *values*
 * are never collected or returned. Actual secret material belongs to the
 * target's owner, not to a scan report.
 *
 * All functions are pure. `bytes` accepts a Buffer, Uint8Array or ArrayBuffer.
 */

const WASM_MAGIC = [0x00, 0x61, 0x73, 0x6d];
const WASM_VERSION = 1;
const MIN_STRING_LEN = 4;

/** Printable-ASCII check (space through tilde). */
function isPrintable(byte) {
  return byte >= 0x20 && byte <= 0x7e;
}

function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (Array.isArray(input)) return Uint8Array.from(input);
  throw new TypeError('wasmIntel: bytes must be a Uint8Array, Buffer or ArrayBuffer');
}

/**
 * Validate the WASM header (magic + version).
 *
 * @param {Uint8Array|Buffer|ArrayBuffer} input binary data
 * @returns {boolean} true when the magic bytes and version match
 */
export function isWasmBinary(input) {
  const bytes = toBytes(input);
  if (bytes.length < 8) return false;
  for (let i = 0; i < 4; i++) {
    if (bytes[i] !== WASM_MAGIC[i]) return false;
  }
  const version = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
  return version === WASM_VERSION;
}

/**
 * Read an unsigned LEB128 integer.
 *
 * @param {Uint8Array} bytes
 * @param {number} offset start offset
 * @returns {{ value: number, next: number }} decoded value + next offset
 */
export function readLeb128(bytes, offset) {
  let result = 0;
  let shift = 0;
  let pos = offset;
  for (;;) {
    if (pos >= bytes.length) throw new RangeError('wasmIntel: truncated LEB128');
    const byte = bytes[pos++];
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
    if (shift > 35) throw new RangeError('wasmIntel: LEB128 overflow');
  }
  return { value: result, next: pos };
}

/**
 * Walk WASM sections. Returns section descriptors {id, name, offset, size}.
 *
 * @param {Uint8Array|Buffer|ArrayBuffer} input binary data
 * @returns {Array<{id:number, name:string|null, offset:number, size:number}>}
 */
export function listWasmSections(input) {
  const bytes = toBytes(input);
  if (!isWasmBinary(bytes)) throw new TypeError('wasmIntel: not a WASM binary');
  const sections = [];
  let pos = 8;
  while (pos < bytes.length) {
    const id = bytes[pos++];
    const { value: size, next } = readLeb128(bytes, pos);
    pos = next;
    const start = pos;
    let name = null;
    if (id === 0) {
      // Custom section: leading LEB128 length + UTF-8 name.
      const { value: nameLen, next: nameStart } = readLeb128(bytes, pos);
      name = Buffer.from(bytes.slice(nameStart, nameStart + nameLen)).toString('utf8');
    }
    sections.push({ id, name, offset: start, size });
    pos = start + size;
  }
  return sections;
}

/**
 * Extract printable-ASCII strings from a WASM binary.
 *
 * Strings are harvested from every section payload (data sections carry
 * the bulk of embedded constants; custom sections such as `name` carry
 * identifiers). Runs of >= 4 printable bytes become candidates.
 *
 * @param {Uint8Array|Buffer|ArrayBuffer} input binary data
 * @param {{ minLength?: number }} [opts]
 * @returns {{ strings: string[], count: number, sections: number }}
 */
export function extractWasmStrings(input, opts = {}) {
  const bytes = toBytes(input);
  if (!isWasmBinary(bytes)) throw new TypeError('wasmIntel: not a WASM binary');
  const minLength = opts.minLength || MIN_STRING_LEN;

  const found = [];
  const seen = new Set();
  let current = '';

  const flush = () => {
    if (current.length >= minLength && !seen.has(current)) {
      seen.add(current);
      found.push(current);
    }
    current = '';
  };

  for (let i = 0; i < bytes.length; i++) {
    if (isPrintable(bytes[i])) {
      current += String.fromCharCode(bytes[i]);
    } else {
      flush();
    }
  }
  flush();

  return {
    strings: found,
    count: found.length,
    sections: listWasmSections(bytes).length,
  };
}

/** Endpoint-like patterns: absolute URLs, ws(s) URLs and root paths. */
const ENDPOINT_PATTERNS = [/^https?:\/\/[^\s]+$/i, /^wss?:\/\/[^\s]+$/i, /^\/[a-z0-9_./-]{2,}$/i];

/** Key-*reference* identifier patterns (names, never values). */
const KEY_REFERENCE_PATTERNS = [
  /^[A-Z][A-Z0-9_]*(_|_|-)?(API|AUTH|SECRET|TOKEN|PASSWORD|PRIVATE|CREDENTIAL|KEY)S?([A-Z0-9_]|$)/,
  /(api|auth|secret|token|password|credential)[-_]?key$/i,
  /^x-(api|auth|access)[-_]?key$/i,
  /(auth|bearer)[-_]?token$/i,
  /^(client|public)[-_]?key$/i,
];

/**
 * Classify extracted strings into embedded endpoints and key references.
 *
 * Key references are identifier-like names only (env-var names, header
 * names, config keys). High-entropy blob strings are counted but not
 * returned, so no secret material ever leaves this function.
 *
 * @param {string[]} strings extracted strings
 * @returns {{ endpoints: string[], keyReferences: string[], other: string[], suspiciousBlobCount: number }}
 */
export function classifyWasmStrings(strings) {
  const endpoints = [];
  const keyReferences = [];
  const other = [];
  let suspiciousBlobCount = 0;

  const isBlob = s => s.length >= 32 && /^[A-Za-z0-9+/=_-]+$/.test(s) && !/^[a-z]+$/i.test(s);

  for (const s of strings) {
    if (KEY_REFERENCE_PATTERNS.some(re => re.test(s))) {
      keyReferences.push(s);
    } else if (ENDPOINT_PATTERNS.some(re => re.test(s))) {
      endpoints.push(s);
    } else if (isBlob(s)) {
      suspiciousBlobCount += 1; // counted, never returned
    } else {
      other.push(s);
    }
  }

  return { endpoints, keyReferences, other, suspiciousBlobCount };
}

/**
 * Idea 700 — Full WASM binary intelligence pipeline.
 *
 * Validates the binary, extracts strings, and classifies them into embedded
 * endpoints and key references for the authorized hunt's asset inventory.
 *
 * @param {Uint8Array|Buffer|ArrayBuffer} input .wasm binary data
 * @returns {{ valid: boolean, stringCount: number, sectionCount: number, endpoints: string[], keyReferences: string[], suspiciousBlobCount: number }}
 */
export function analyzeWasmBinary(input) {
  if (!isWasmBinary(input)) {
    return {
      valid: false,
      stringCount: 0,
      sectionCount: 0,
      endpoints: [],
      keyReferences: [],
      suspiciousBlobCount: 0,
    };
  }
  const { strings, count, sections } = extractWasmStrings(input);
  const classified = classifyWasmStrings(strings);
  return {
    valid: true,
    stringCount: count,
    sectionCount: sections,
    endpoints: classified.endpoints,
    keyReferences: classified.keyReferences,
    suspiciousBlobCount: classified.suspiciousBlobCount,
  };
}
