/**
 * wasmAnalyzer.js — WebAssembly binary structure analyzer.
 *
 * Parses raw WASM binaries (dependency-free, hand-rolled LEB128 section
 * walker) and extracts:
 *  - imports (idea 701): every imported function/table/memory/global with
 *    its module + field name, so host-function dependencies can be mapped
 *    (e.g. `env.memory`, `wasi_snapshot_preview1.fd_write`, `go.importObject`)
 *  - linear-memory initializers (idea 702): the data section's payload
 *    segments, scanned for URL-like strings and other printable literals
 *    that reveal embedded endpoints, asset paths and configuration
 *
 * All analysis is passive: the caller supplies the downloaded module bytes
 * (or a Base64 blob) and this module never executes the code.
 *
 * Defensive use: authorized asset discovery — understanding what host
 * capabilities and embedded resources a target's WASM module relies on.
 */

const WASM_MAGIC = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
const SECTION_IMPORT = 2;
const SECTION_DATA = 11;
const SECTION_CUSTOM = 0;

/** URL-ish literal finder used across scanners. */
const URL_RE = /(https?:\/\/[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]{3,}|wss?:\/\/[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]{3,}|\/[A-Za-z0-9\-_./]{3,}\.(?:js|wasm|json|png|svg|woff2?|html|css))/g;

/**
 * Normalize the caller-supplied input into a Uint8Array.
 *
 * @param {Uint8Array|Buffer|string} input - bytes, Buffer, or Base64 text
 * @returns {Uint8Array}
 */
export function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (typeof input === 'string') {
    const t = input.trim();
    // Allow either raw Base64 or a data: URI wrapper.
    const b64 = t.includes(',') && t.startsWith('data:') ? t.slice(t.indexOf(',') + 1) : t;
    return Uint8Array.from(Buffer.from(b64, 'base64'));
  }
  return Uint8Array.from(input || []);
}

/**
 * Read an unsigned LEB128 integer starting at offset.
 *
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @returns {{value:number,next:number}}
 */
export function readUleb128(bytes, offset) {
  let value = 0;
  let shift = 0;
  let i = offset;
  while (i < bytes.length) {
    const b = bytes[i++];
    value |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) break;
    shift += 7;
    if (shift > 35) throw new Error('LEB128 overflow');
  }
  return { value, next: i };
}

/**
 * Read a WASM name vector (length-prefixed UTF-8) at offset.
 *
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @returns {{value:string,next:number}}
 */
export function readName(bytes, offset) {
  const len = readUleb128(bytes, offset);
  const end = len.next + len.value;
  if (end > bytes.length) throw new Error('name overruns section');
  const value = Buffer.from(bytes.subarray(len.next, end)).toString('utf8');
  return { value, next: end };
}

/**
 * Check whether the bytes start with the WASM magic + version 1.
 *
 * @param {Uint8Array|Buffer|string} input
 * @returns {boolean}
 */
export function isWasm(input) {
  const bytes = toBytes(input);
  return (
    bytes.length >= 8 && WASM_MAGIC.every((b, i) => bytes[i] === b)
  );
}

/**
 * Walk the section table and return id/offset/length records.
 *
 * @param {Uint8Array} bytes
 * @returns {Array<{id:number,offset:number,length:number}>}
 */
export function listSections(bytes) {
  const sections = [];
  let i = 8;
  while (i < bytes.length) {
    const id = bytes[i++];
    const len = readUleb128(bytes, i);
    sections.push({ id, offset: len.next, length: len.value });
    i = len.next + len.value;
  }
  return sections;
}

/**
 * Skip a WASM limits vector (flags + initial + optional maximum).
 *
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @returns {number} offset just past the limits
 */
function skipLimits(bytes, offset) {
  let i = offset;
  const flags = readUleb128(bytes, i);
  i = flags.next;
  i = readUleb128(bytes, i).next; // initial
  if (flags.value & 0x01) i = readUleb128(bytes, i).next; // maximum
  return i;
}

/**
 * Skip an import/export type descriptor according to the external kind:
 * function -> type index; table -> elemtype + limits; memory -> limits;
 * global -> valtype + mutability.
 *
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @param {number} kind
 * @returns {{next:number,type:number}} offset past the descriptor + leading value
 */
function skipDescriptor(bytes, offset, kind) {
  let i = offset;
  let type = 0;
  if (kind === 0) {
    const t = readUleb128(bytes, i);
    type = t.value;
    i = t.next;
  } else if (kind === 1) {
    type = bytes[i++]; // elemtype
    i = skipLimits(bytes, i);
  } else if (kind === 2) {
    i = skipLimits(bytes, i);
  } else if (kind === 3) {
    type = bytes[i++]; // valtype
    i++; // mutability
  } else {
    const t = readUleb128(bytes, i);
    type = t.value;
    i = t.next;
  }
  return { next: i, type };
}

/** Kind names for WASM external kinds (function/table/memory/global). */
const KIND_NAMES = ['function', 'table', 'memory', 'global'];

/**
 * Analyze the import section: map host-function dependencies.
 * Each entry carries the importing module name, the field name, and the
 * external kind (function/table/memory/global) plus any type payload.
 *
 * Idea 701 — WASM import-object analysis.
 *
 * @param {Uint8Array|Buffer|string} input - WASM bytes or Base64
 * @returns {{ok:boolean,error?:string,imports:Array<{module:string,name:string,kind:string,kindId:number,type:number}>,moduleDependencies:Array<string>,summary:object}}
 */
export function analyzeWasmImports(input) {
  const bytes = toBytes(input);
  const result = { ok: false, imports: [], moduleDependencies: [], summary: {} };
  if (!isWasm(bytes)) {
    result.error = 'not a WebAssembly module (bad magic/version)';
    return result;
  }
  try {
    for (const s of listSections(bytes)) {
      if (s.id !== SECTION_IMPORT) continue;
      let i = s.offset;
      const count = readUleb128(bytes, i);
      i = count.next;
      for (let n = 0; n < count.value; n++) {
        const mod = readName(bytes, i);
        i = mod.next;
        const field = readName(bytes, i);
        i = field.next;
        const kind = bytes[i++];
        const desc = skipDescriptor(bytes, i, kind);
        i = desc.next;
        result.imports.push({
          module: mod.value,
          name: field.value,
          kind: KIND_NAMES[kind] || `kind${kind}`,
          kindId: kind,
          type: desc.type,
        });
      }
    }
  } catch (e) {
    result.error = `import section parse failed: ${e.message}`;
    return result;
  }
  result.ok = true;
  result.moduleDependencies = [...new Set(result.imports.map((x) => x.module))];
  const byKind = {};
  for (const imp of result.imports) byKind[imp.kind] = (byKind[imp.kind] || 0) + 1;
  result.summary = {
    total: result.imports.length,
    hostModules: result.moduleDependencies.length,
    byKind,
    functionImports: result.imports
      .filter((x) => x.kind === 'function')
      .map((x) => `${x.module}.${x.name}`),
  };
  return result;
}

/**
 * Scan the data section (linear-memory initializers) for embedded strings:
 * URLs, paths and other printable runs. Data segments are active (with an
 * init expression) or passive (bulk-memory) — payload bytes are scanned
 * either way.
 *
 * Idea 702 — WASM memory-segment scanning.
 *
 * @param {Uint8Array|Buffer|string} input - WASM bytes or Base64
 * @param {object} [options]
 * @param {number} [options.minLength=6] - minimum printable-run length
 * @returns {{ok:boolean,error?:string,segments:Array<{index:number,size:number,urls:string[],strings:string[]}>}}
 */
export function scanWasmMemorySegments(input, options = {}) {
  const bytes = toBytes(input);
  const minLength = options.minLength ?? 6;
  const result = { ok: false, segments: [] };
  if (!isWasm(bytes)) {
    result.error = 'not a WebAssembly module (bad magic/version)';
    return result;
  }
  try {
    for (const s of listSections(bytes)) {
      if (s.id !== SECTION_DATA) continue;
      let i = s.offset;
      const count = readUleb128(bytes, i);
      i = count.next;
      for (let n = 0; n < count.value; n++) {
        const segStart = i;
        const flags = readUleb128(bytes, i);
        i = flags.next;
        // Skip the init expression for active segments (ends with 0x0b opcode).
        if ((flags.value & 0x01) === 0) {
          while (i < bytes.length && bytes[i] !== 0x0b) i++;
          i++; // consume the `end` opcode
        } else {
          i = readUleb128(bytes, i).next; // passive memory index
        }
        const size = readUleb128(bytes, i);
        i = size.next;
        const payload = bytes.subarray(i, i + size.value);
        i += size.value;
        const urls = extractUrls(payload);
        const strings = extractPrintableRuns(payload, minLength).filter(
          (t) => !urls.includes(t)
        );
        result.segments.push({
          index: n,
          offsetInSection: segStart - s.offset,
          size: size.value,
          urls,
          strings: strings.slice(0, 200),
        });
      }
    }
  } catch (e) {
    result.error = `data section parse failed: ${e.message}`;
    return result;
  }
  result.ok = true;
  return result;
}

/**
 * Also scan the custom "name" section for named functions/globals, which
 * often leak internal route or feature names.
 *
 * @param {Uint8Array|Buffer|string} input
 * @returns {{ok:boolean,error?:string,names:string[]}}
 */
export function extractWasmCustomNames(input) {
  const bytes = toBytes(input);
  const result = { ok: false, names: [] };
  if (!isWasm(bytes)) {
    result.error = 'not a WebAssembly module (bad magic/version)';
    return result;
  }
  const seen = new Set();
  for (const s of listSections(bytes)) {
    if (s.id !== SECTION_CUSTOM) continue;
    const body = bytes.subarray(s.offset, s.offset + s.length);
    let i = 0;
    try {
      const id = readName(body, i);
      i = id.next;
      if (id.value !== 'name') continue;
      while (i < body.length) {
        const subId = body[i++];
        const subLen = readUleb128(body, i);
        i = subLen.next;
        const end = i + subLen.value;
        if (subId === 0 || subId === 2 || subId === 7) {
          // module names, function names, global names
          let j = i;
          const cnt = readUleb128(body, j);
          j = cnt.next;
          for (let k = 0; k < cnt.value && j < end; k++) {
            const idx = readUleb128(body, j);
            j = idx.next;
            const nm = readName(body, j);
            j = nm.next;
            if (nm.value && !seen.has(nm.value)) {
              seen.add(nm.value);
              result.names.push(nm.value);
            }
          }
        }
        i = end;
      }
    } catch {
      // tolerate malformed custom sections; keep what was found
    }
  }
  result.ok = true;
  return result;
}

/**
 * Extract unique URL-like literals from raw bytes.
 *
 * @param {Uint8Array} payload
 * @returns {string[]}
 */
function extractUrls(payload) {
  const text = Buffer.from(payload).toString('latin1');
  const found = new Set();
  for (const m of text.matchAll(URL_RE)) found.add(m[0]);
  return [...found];
}

/**
 * Extract printable ASCII runs of at least minLength characters.
 *
 * @param {Uint8Array} payload
 * @param {number} minLength
 * @returns {string[]}
 */
function extractPrintableRuns(payload, minLength) {
  const text = Buffer.from(payload).toString('latin1');
  const runs = text.match(/[ -~]{6,}/g) || [];
  const seen = new Set();
  const out = [];
  for (const r of runs) {
    const t = r.trim();
    if (t.length >= minLength && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

/**
 * One-call summary: imports + memory-string scan + custom names.
 *
 * @param {Uint8Array|Buffer|string} input
 * @returns {object}
 */
export function analyzeWasmModule(input) {
  const imports = analyzeWasmImports(input);
  const memory = scanWasmMemorySegments(input);
  const names = extractWasmCustomNames(input);
  const embeddedUrls = [
    ...new Set(memory.segments.flatMap((s) => s.urls)),
  ];
  return {
    ok: imports.ok && memory.ok,
    isWasm: isWasm(input),
    imports,
    memorySegments: memory.segments,
    customNames: names.names,
    embeddedUrls,
  };
}
