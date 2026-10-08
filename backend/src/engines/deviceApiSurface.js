/**
 * deviceApiSurface.js — Client-side device/auth API surface mapper for
 * autonomous bug bounty reconnaissance.
 *
 * Analyzes client-side JavaScript source text (bundle, inline script, or
 * service worker) and maps calls to powerful browser device and auth APIs
 * to the auth endpoints and product features they feed. This tells the hunt
 * agent where the interesting authentication, hardware-integration, and
 * data-exfiltration surface lives before it spends hunt budget.
 *
 * All functions are pure, deterministic, and need no network access:
 *   sourceText — the JS source to inspect (non-strings are treated as empty)
 *   url        — optional page URL for context in results
 *
 * Coverage (one-liner idea → exported function):
 *   Idea 831 — Credential-Management API mapping        → mapCredentialStoreCalls
 *   Idea 832 — WebAuthn relying-party mapping           → mapWebAuthnRelyingParty
 *   Idea 833 — WebOTP API endpoint discovery            → discoverWebOtpEndpoints
 *   Idea 834 — Contact-picker data-flow mapping         → mapContactPickerFlows
 *   Idea 835 — File-System-Access API mapping           → mapFileSystemAccessFeatures
 *   Idea 836 — WebUSB device-filter mining              → mineWebUsbFilters
 *   Idea 837 — WebBluetooth service-UUID mapping        → mapWebBluetoothServices
 *   Idea 838 — WebHID device-collection mining          → mineWebHidCollections
 *   Idea 839 — WebSerial port-configuration mining      → mineWebSerialConfigs
 *   Idea 840 — WebNFC record-type mapping               → mapWebNfcRecords
 *   plus mapDeviceApiSurface() — runs every mapper and returns the full surface.
 */

const URL_LITERAL_RE = /['"`](\/(?!\/)[^'"`\s]*|https?:\/\/[^'"`\s<>{}|\\^]+)['"`]/g;

const FETCH_CALL_RE = /fetch\s*\(\s*['"`]/g;

/** Extract URL-like string literals from a slice of source. */
function extractUrls(chunk) {
  const urls = [];
  let m;
  URL_LITERAL_RE.lastIndex = 0;
  while ((m = URL_LITERAL_RE.exec(chunk)) !== null) {
    const u = m[1];
    if (u.length > 1 && !urls.includes(u)) urls.push(u);
  }
  return urls;
}

/** Return a context window around a source index (clamped). */
function windowAround(source, index, before = 700, after = 1500) {
  const start = Math.max(0, index - before);
  const end = Math.min(source.length, index + after);
  return source.slice(start, end);
}

/** Find all start indices of a regex in the source. */
function findIndices(source, regex) {
  const indices = [];
  let m;
  regex.lastIndex = 0;
  while ((m = regex.exec(source)) !== null) {
    indices.push(m.index);
    if (m[0].length === 0) regex.lastIndex += 1;
  }
  return indices;
}

function asString(source) {
  return typeof source === 'string' ? source : '';
}

function dedupe(list) {
  return [...new Set(list)];
}

/**
 * Extract the argument list of a call whose '(' sits at openParenIndex,
 * using balanced-paren scanning (string literals are skipped).
 */
function callArgs(source, openParenIndex) {
  let depth = 0;
  let quote = null;
  for (let i = openParenIndex; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return source.slice(openParenIndex + 1, i);
    }
  }
  return '';
}

/** Find call sites of a dotted method: returns [{index, args}]. */
function findCallSites(source, methodPattern) {
  const sites = [];
  for (const index of findIndices(source, methodPattern)) {
    const openParen = source.indexOf('(', index);
    if (openParen === -1) continue;
    sites.push({ index, args: callArgs(source, openParen) });
  }
  return sites;
}

function toHex4(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return null;
  return '0x' + Math.trunc(v).toString(16).toUpperCase().padStart(4, '0');
}

const AUTH_KEYWORDS = [
  'login',
  'signin',
  'sign-in',
  'sign_up',
  'signup',
  'register',
  'auth',
  'token',
  'session',
  'password',
  'credential',
  'otp',
  'verify',
  'sso',
  'oauth',
];

/* ------------------------------------------------------------------ */
/* Idea 831 — Credential-Management API mapping                        */
/*                                                                     */
/* Maps navigator.credentials.store/get calls (password + federated)   */
/* to the auth endpoints they feed, so the hunt agent knows which      */
/* backend routes handle raw credentials.                              */
/* ------------------------------------------------------------------ */

/**
 * Map Credential Management API usage to auth endpoints.
 * @param {string} sourceText client-side JS source
 * @param {string} [url] page URL for context
 * @returns {{url: string|null, stores: object[], retrievals: object[], authEndpoints: string[]}}
 */
export function mapCredentialStoreCalls(sourceText, url = null) {
  const source = asString(sourceText);
  const stores = [];
  const retrievals = [];
  const authEndpoints = [];

  for (const { index, args } of findCallSites(source, /\bcredentials\.store\s*\(/g)) {
    const ctx = windowAround(source, index);
    const type = /\bpassword\s*:/i.test(args)
      ? 'password'
      : /\bfederated\s*:/i.test(args)
        ? 'federated'
        : 'unknown';
    const urls = extractUrls(ctx);
    stores.push({ kind: 'store', credentialType: type, endpoints: urls });
    authEndpoints.push(...urls.filter(u => AUTH_KEYWORDS.some(k => u.toLowerCase().includes(k))));
  }

  for (const { index, args } of findCallSites(source, /\bcredentials\.get\s*\(/g)) {
    if (/\bpublicKey\s*:/.test(args.slice(0, 240))) continue; // WebAuthn — idea 832 owns it
    const ctx = windowAround(source, index);
    const type = /\bpassword\s*:\s*true/.test(args)
      ? 'password'
      : /\bfederated\s*:/.test(args)
        ? 'federated'
        : /\botp\s*:/.test(args)
          ? 'otp'
          : 'unknown';
    const urls = extractUrls(ctx);
    retrievals.push({ kind: 'get', credentialType: type, endpoints: urls });
    authEndpoints.push(...urls.filter(u => AUTH_KEYWORDS.some(k => u.toLowerCase().includes(k))));
  }

  return {
    url: typeof url === 'string' ? url : null,
    stores,
    retrievals,
    authEndpoints: dedupe(authEndpoints),
  };
}

/* ------------------------------------------------------------------ */
/* Idea 832 — WebAuthn relying-party mapping                           */
/*                                                                     */
/* Parses navigator.credentials.create/get call sites that carry a     */
/* publicKey option: extracts rp.id / rp.name, the attestation          */
/* conveyance preference, authenticator attachment, and the endpoints   */
/* the ceremony posts to (registration + assertion finish URLs).       */
/* ------------------------------------------------------------------ */

/**
 * Map WebAuthn relying parties and attestation endpoints.
 * @param {string} sourceText client-side JS source
 * @param {string} [url] page URL for context
 * @returns {{url: string|null, relyingParties: object[], operations: object[], endpoints: string[]}}
 */
export function mapWebAuthnRelyingParty(sourceText, url = null) {
  const source = asString(sourceText);
  const relyingParties = [];
  const operations = [];
  const endpoints = [];

  for (const kind of ['create', 'get']) {
    for (const site of findCallSites(source, new RegExp(`\\bcredentials\\.${kind}\\s*\\(`, 'g'))) {
      const { index, args } = site;
      if (!/\bpublicKey\s*:/.test(args.slice(0, 240))) continue; // not WebAuthn
      const ctx = windowAround(source, index);
      // Field extraction prefers the call's own args; falls back to the
      // surrounding window because real code often builds the publicKey
      // options object in a variable first.
      const pick = re => (args.match(re) || ctx.match(re) || [])[1] || null;
      const rpId = pick(/\brp\s*:\s*\{[^}]*?\bid\s*:\s*['"`]([^'"`]+)['"`]/);
      const rpName = pick(/\brp\s*:\s*\{[^}]*?\bname\s*:\s*['"`]([^'"`]+)['"`]/);
      const rpIdOnly = rpId === null ? pick(/\brpId\s*:\s*['"`]([^'"`]+)['"`]/) : null;
      const attestation = pick(/\battestation\s*:\s*['"`](direct|indirect|none|enterprise)['"`]/);
      const attachment = pick(
        /\bauthenticatorAttachment\s*:\s*['"`](platform|cross-platform)['"`]/
      );
      const userVerification = pick(
        /\buserVerification\s*:\s*['"`](required|preferred|discouraged)['"`]/
      );
      const urls = extractUrls(ctx);

      if (rpId || rpName || rpIdOnly) {
        relyingParties.push({
          rpId: rpId || rpIdOnly,
          rpName,
          attestation,
          authenticatorAttachment: attachment,
          userVerification,
        });
      }
      operations.push({ ceremony: kind, rpId: rpId || rpIdOnly, attestation, endpoints: urls });
      endpoints.push(...urls);
    }
  }

  const seen = new Set();
  const uniqueRps = relyingParties.filter(r => {
    const key = `${r.rpId}|${r.rpName}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    url: typeof url === 'string' ? url : null,
    relyingParties: uniqueRps,
    operations,
    endpoints: dedupe(endpoints),
  };
}

/* ------------------------------------------------------------------ */
/* Idea 833 — WebOTP API endpoint discovery                            */
/*                                                                     */
/* Finds SMS-retriever (WebOTP) usage — navigator.credentials.get      */
/* with an otp/transport option or OTPCredential — and surfaces the     */
/* nearby receive/verify endpoints for the SMS one-time-code flow.      */
/* ------------------------------------------------------------------ */

/**
 * Discover SMS-retriever (WebOTP) endpoints.
 * @param {string} sourceText client-side JS source
 * @param {string} [url] page URL for context
 * @returns {{url: string|null, webOtpUsed: boolean, transports: string[], endpoints: string[]}}
 */
export function discoverWebOtpEndpoints(sourceText, url = null) {
  const source = asString(sourceText);
  const endpoints = [];
  const transports = [];

  const sites = [
    ...findIndices(source, /\botp\s*:\s*\{/g),
    ...findIndices(source, /\bOTPCredential\b/g),
    ...findIndices(source, /transport\s*:\s*\[\s*['"`]sms['"`]/g),
  ];

  for (const index of sites) {
    const ctx = windowAround(source, index);
    const urls = extractUrls(ctx);
    endpoints.push(...urls);
    for (const m of ctx.matchAll(/\btransport\s*:\s*\[([^\]]*)\]/g)) {
      for (const t of m[1].matchAll(/['"`]([^'"`]+)['"`]/g)) transports.push(t[1]);
    }
  }

  return {
    url: typeof url === 'string' ? url : null,
    webOtpUsed: sites.length > 0,
    transports: dedupe(transports),
    endpoints: dedupe(endpoints),
  };
}

/* ------------------------------------------------------------------ */
/* Idea 834 — Contact-picker data-flow mapping                         */
/*                                                                     */
/* Maps navigator.contacts.select() usage (requested properties) to    */
/* the sharing endpoints that receive the picked contacts — fetch      */
/* POSTs, navigator.share, and mailto:/tel: handoffs.                  */
/* ------------------------------------------------------------------ */

/**
 * Map contact-picker usage to sharing endpoints.
 * @param {string} sourceText client-side JS source
 * @param {string} [url] page URL for context
 * @returns {{url: string|null, used: boolean, requestedProps: string[], shareEndpoints: string[], shareApiUsed: boolean}}
 */
export function mapContactPickerFlows(sourceText, url = null) {
  const source = asString(sourceText);
  const requestedProps = [];
  const shareEndpoints = [];
  const sites = findCallSites(source, /\bcontacts\.select\s*\(/g);
  const mgrSites = findIndices(source, /\bContactsManager\b/g);

  for (const { index, args } of sites) {
    const ctx = windowAround(source, index);
    // Props are often passed inline, or via a variable holding the array.
    let propsChunk = '';
    const inline = args.match(/^\s*\[([^\]]*)\]/);
    if (inline) {
      propsChunk = inline[1];
    } else {
      const ident = (args.match(/^\s*([A-Za-z_$][\w$]*)/) || [])[1];
      if (ident) {
        const before = source.slice(Math.max(0, index - 900), index);
        const assign = before.match(new RegExp(`\\b${ident}\\s*=\\s*\\[([^\\]]*)\\]`));
        if (assign) propsChunk = assign[1];
      }
    }
    for (const p of propsChunk.matchAll(/['"`]([^'"`]+)['"`]/g)) requestedProps.push(p[1]);
    shareEndpoints.push(...extractUrls(ctx));
  }

  for (const index of mgrSites) {
    shareEndpoints.push(...extractUrls(windowAround(source, index)));
  }

  return {
    url: typeof url === 'string' ? url : null,
    used: sites.length > 0 || mgrSites.length > 0,
    requestedProps: dedupe(requestedProps),
    shareEndpoints: dedupe(shareEndpoints),
    shareApiUsed: /\bnavigator\.share\s*\(/.test(source),
  };
}

/* ------------------------------------------------------------------ */
/* Idea 835 — File-System-Access API mapping                           */
/*                                                                     */
/* Maps File System Access API entry points (open/save/directory       */
/* pickers) to the local-file features they back — reads, writes,      */
/* directory access, declared file-type filters, and upload/export     */
/* endpoints nearby.                                                   */
/* ------------------------------------------------------------------ */

const FSA_ENTRY_POINTS = [
  { call: 'showOpenFilePicker', feature: 'file-read' },
  { call: 'showSaveFilePicker', feature: 'file-write' },
  { call: 'showDirectoryPicker', feature: 'directory-access' },
  { call: 'chooseFileSystemEntries', feature: 'file-chooser-legacy' },
];

/**
 * Map File System Access API calls to local-file features.
 * @param {string} sourceText client-side JS source
 * @param {string} [url] page URL for context
 * @returns {{url: string|null, features: object[], fileTypes: string[], endpoints: string[]}}
 */
export function mapFileSystemAccessFeatures(sourceText, url = null) {
  const source = asString(sourceText);
  const features = [];
  const fileTypes = [];
  const endpoints = [];

  for (const { call, feature } of FSA_ENTRY_POINTS) {
    const re = new RegExp(`\\b${call}\\s*\\(`, 'g');
    for (const index of findIndices(source, re)) {
      const ctx = windowAround(source, index);
      const urls = extractUrls(ctx);
      const accept = [];
      for (const m of ctx.matchAll(/accept\s*:\s*\{([\s\S]{0,400}?)\}/g)) {
        for (const t of m[1].matchAll(/['"`]([^'"`]+)['"`]\s*:/g)) accept.push(t[1]);
        for (const t of m[1].matchAll(/\[\s*([^\]]*)\]/g)) {
          for (const e of t[1].matchAll(/['"`]([^'"`]+)['"`]/g)) accept.push(e[1]);
        }
      }
      features.push({ api: call, feature, declaredTypes: dedupe(accept), endpoints: urls });
      fileTypes.push(...accept);
      endpoints.push(...urls);
    }
  }

  return {
    url: typeof url === 'string' ? url : null,
    features,
    fileTypes: dedupe(fileTypes),
    endpoints: dedupe(endpoints),
  };
}

/* ------------------------------------------------------------------ */
/* Idea 836 — WebUSB device-filter mining                              */
/*                                                                     */
/* Mines navigator.usb.requestDevice() filter lists for supported       */
/* hardware identifiers: vendorId / productId / class / subclass /     */
/* protocol codes (USB-IF class codes included).                       */
/* ------------------------------------------------------------------ */

/** Known USB-IF device class codes → human label. */
export const USB_CLASS_CODES = {
  0x00: 'Defined at interface level',
  0x01: 'Audio',
  0x02: 'Communications / CDC',
  0x03: 'Human Interface Device (HID)',
  0x05: 'Physical',
  0x06: 'Image / still imaging',
  0x07: 'Printer',
  0x08: 'Mass storage',
  0x09: 'Hub',
  0x0a: 'CDC-Data',
  0x0b: 'Smart Card',
  0x0d: 'Content Security',
  0x0e: 'Video',
  0x0f: 'Personal Healthcare',
  0x10: 'Audio/Video',
  0x11: 'Billboard',
  0x12: 'USB Type-C Bridge',
  0xdc: 'Diagnostic',
  0xe0: 'Wireless Controller',
  0xef: 'Miscellaneous',
  0xfe: 'Application Specific',
  0xff: 'Vendor Specific',
};

/** Parse `{ ... }` filter objects from a filters-array chunk. */
function parseFilterObjects(chunk) {
  const filters = [];
  for (const m of chunk.matchAll(/\{([^{}]*)\}/g)) {
    const body = m[1];
    const f = {};
    for (const key of [
      'vendorId',
      'productId',
      'classCode',
      'subclassCode',
      'protocolCode',
      'serialNumber',
      'usbVendorId',
      'usbProductId',
      'usagePage',
      'usage',
    ]) {
      const km = body.match(
        new RegExp(`\\b${key}\\s*:\\s*(0x[0-9a-fA-F]+|\\d+|['"\`][^'"\`]+['"\`])`)
      );
      if (km) {
        const raw = km[1].trim();
        f[key] = /^['"`]/.test(raw)
          ? raw.slice(1, -1)
          : /^0x/i.test(raw)
            ? parseInt(raw, 16)
            : Number(raw);
      }
    }
    if (Object.keys(f).length > 0) filters.push(f);
  }
  return filters;
}

/**
 * Mine WebUSB device filters for supported hardware identifiers.
 * @param {string} sourceText client-side JS source
 * @param {string} [url] page URL for context
 * @returns {{url: string|null, used: boolean, filters: object[], endpoints: string[]}}
 */
export function mineWebUsbFilters(sourceText, url = null) {
  const source = asString(sourceText);
  const filters = [];
  const endpoints = [];
  const sites = [
    ...findCallSites(source, /\busb\.requestDevice\s*\(/g),
    ...findCallSites(source, /\busb\.getDevices\s*\(/g),
  ];

  for (const { index, args } of sites) {
    const ctx = windowAround(source, index);
    endpoints.push(...extractUrls(ctx));
    for (const f of parseFilterObjects(args)) {
      filters.push({
        vendorId: f.vendorId !== undefined ? toHex4(f.vendorId) : null,
        productId: f.productId !== undefined ? toHex4(f.productId) : null,
        classCode: f.classCode !== undefined ? toHex4(f.classCode) : null,
        classLabel:
          f.classCode !== undefined
            ? USB_CLASS_CODES[Number(f.classCode)] || 'Unknown class'
            : null,
        subclassCode: f.subclassCode !== undefined ? toHex4(f.subclassCode) : null,
        protocolCode: f.protocolCode !== undefined ? toHex4(f.protocolCode) : null,
        serialNumber: f.serialNumber !== undefined ? String(f.serialNumber) : null,
      });
    }
  }

  return {
    url: typeof url === 'string' ? url : null,
    used: sites.length > 0,
    filters,
    endpoints: dedupe(endpoints),
  };
}

/* ------------------------------------------------------------------ */
/* Idea 837 — WebBluetooth service-UUID mapping                        */
/*                                                                     */
/* Maps navigator.bluetooth.requestDevice() service filters to device  */
/* integrations: well-known GATT service UUIDs (16-bit and named       */
/* aliases) resolve to a human device-integration label.               */
/* ------------------------------------------------------------------ */

const BLE_SERVICE_LABELS = {
  1800: 'Generic Access — device identity integration',
  1801: 'Generic Attribute — service discovery integration',
  '180a': 'Device Information — hardware metadata integration',
  '180d': 'Heart Rate — fitness tracker integration',
  '180f': 'Battery Service — power-state integration',
  1812: 'Human Interface Device — HID-over-GATT integration',
  1815: 'Automation IO — home-automation integration',
  1816: 'Cycling Speed and Cadence — bike sensor integration',
  1818: 'Cycling Power — power-meter integration',
  '181a': 'Environmental Sensing — sensor integration',
  '181b': 'Body Composition — health-scale integration',
  '181c': 'User Data — profile integration',
  '181d': 'Weight Scale — scale integration',
  1820: 'Internet Protocol Support — IP-over-BLE integration',
  1821: 'Indoor Positioning — beacon integration',
  1822: 'Pulse Oximeter — medical sensor integration',
  1826: 'Fitness Machine — gym-equipment integration',
  1827: 'Mesh Provisioning — mesh-network integration',
  1828: 'Mesh Proxy — mesh-network integration',
};

const BLE_ALIAS_TO_SHORT = {
  alert_notification: '1811',
  automation_io: '1815',
  battery_service: '180f',
  blood_pressure: '1810',
  body_composition: '181b',
  bond_management: '181e',
  continuous_glucose_monitoring: '181f',
  current_time: '1805',
  cycling_power: '1818',
  cycling_speed_and_cadence: '1816',
  device_information: '180a',
  environmental_sensing: '181a',
  fitness_machine: '1826',
  generic_access: '1800',
  generic_attribute: '1801',
  glucose: '1808',
  health_thermometer: '1809',
  heart_rate: '180d',
  human_interface_device: '1812',
  immediate_alert: '1802',
  indoor_positioning: '1821',
  internet_protocol_support: '1820',
  link_loss: '1803',
  location_and_navigation: '1819',
  mesh_provisioning: '1827',
  mesh_proxy: '1828',
  next_dst_change: '1807',
  phone_alert_status: '180e',
  pulse_oximeter: '1822',
  reference_time_update: '1806',
  running_speed_and_cadence: '1814',
  scan_parameters: '1813',
  tx_power: '1804',
  user_data: '181c',
  weight_scale: '181d',
};

/** Normalize a service UUID/alias to a 4-hex short UUID or null. */
function normalizeBleService(raw) {
  const s = String(raw).trim().toLowerCase();
  if (BLE_ALIAS_TO_SHORT[s]) return BLE_ALIAS_TO_SHORT[s];
  let nosep = s.replace(/-/g, '');
  if (/^0x[0-9a-f]{4}$/.test(nosep)) nosep = nosep.slice(2);
  if (/^[0-9a-f]{4}$/.test(nosep)) return nosep;
  const m = nosep.match(/^([0-9a-f]{4})00001000800000805f9b34fb$/);
  if (m) return m[1];
  return null;
}

/**
 * Map WebBluetooth service UUIDs to device integrations.
 * @param {string} sourceText client-side JS source
 * @param {string} [url] page URL for context
 * @returns {{url: string|null, used: boolean, services: object[], endpoints: string[]}}
 */
export function mapWebBluetoothServices(sourceText, url = null) {
  const source = asString(sourceText);
  const services = [];
  const endpoints = [];
  const sites = [
    ...findCallSites(source, /\bbluetooth\.requestDevice\s*\(/g),
    ...findCallSites(source, /\bbluetooth\.getAvailability\s*\(/g),
  ];

  for (const { index, args } of sites) {
    const ctx = windowAround(source, index);
    endpoints.push(...extractUrls(ctx));
    const seen = new Set();
    for (const m of args.matchAll(/[Ss]ervices\s*:\s*\[([^\]]*)\]/g)) {
      for (const t of m[1].matchAll(/['"`]([^'"`]+)['"`]|(0x[0-9a-fA-F]+|\d+)/g)) {
        const raw = (t[1] !== undefined ? t[1] : t[2]).trim();
        const short = normalizeBleService(raw);
        if (!short || seen.has(short)) continue;
        seen.add(short);
        services.push({
          service: `0x${short.toUpperCase()}`,
          integration:
            BLE_SERVICE_LABELS[short] || 'Custom GATT service — proprietary device integration',
          raw,
        });
      }
    }
  }

  return {
    url: typeof url === 'string' ? url : null,
    used: sites.length > 0,
    services,
    endpoints: dedupe(endpoints),
  };
}

/* ------------------------------------------------------------------ */
/* Idea 838 — WebHID device-collection mining                          */
/*                                                                     */
/* Mines navigator.hid.requestDevice() collections for supported       */
/* devices: vendorId / productId plus HID usage page + usage, with     */
/* friendly labels for the common keyboard/mouse/gamepad collections.  */
/* ------------------------------------------------------------------ */

const HID_USAGE_LABELS = {
  '1:6': 'Keyboard collection',
  '1:2': 'Mouse collection',
  '1:4': 'Joystick collection',
  '1:5': 'Gamepad collection',
  '1:8': 'Multi-axis controller collection',
  '1:80': 'System control collection',
  '1:1': 'Pointer collection',
  '12:1': 'Consumer control collection',
  '65305:1': 'Vendor-defined collection (FF00:01)',
};

/**
 * Mine WebHID collections for supported devices.
 * @param {string} sourceText client-side JS source
 * @param {string} [url] page URL for context
 * @returns {{url: string|null, used: boolean, collections: object[], endpoints: string[]}}
 */
export function mineWebHidCollections(sourceText, url = null) {
  const source = asString(sourceText);
  const collections = [];
  const endpoints = [];
  const sites = [
    ...findCallSites(source, /\bhid\.requestDevice\s*\(/g),
    ...findCallSites(source, /\bhid\.getDevices\s*\(/g),
  ];

  for (const { index, args } of sites) {
    const ctx = windowAround(source, index);
    endpoints.push(...extractUrls(ctx));
    for (const f of parseFilterObjects(args)) {
      const usagePage = f.usagePage !== undefined ? Number(f.usagePage) : null;
      const usage = f.usage !== undefined ? Number(f.usage) : null;
      const key = usagePage !== null && usage !== null ? `${usagePage}:${usage}` : null;
      collections.push({
        vendorId: f.vendorId !== undefined ? toHex4(f.vendorId) : null,
        productId: f.productId !== undefined ? toHex4(f.productId) : null,
        usagePage: usagePage !== null ? toHex4(usagePage) : null,
        usage: usage !== null ? toHex4(usage) : null,
        collectionLabel:
          (key && HID_USAGE_LABELS[key]) ||
          (key ? 'HID collection' : 'Device filter without usage'),
      });
    }
  }

  return {
    url: typeof url === 'string' ? url : null,
    used: sites.length > 0,
    collections,
    endpoints: dedupe(endpoints),
  };
}

/* ------------------------------------------------------------------ */
/* Idea 839 — WebSerial port-configuration mining                      */
/*                                                                     */
/* Extracts navigator.serial.requestPort() hardware filters             */
/* (usbVendorId/usbProductId) and port.open() serial configurations     */
/* (baud rate, data/stop bits, parity, flow control) for hardware       */
/* integration analysis.                                                */
/* ------------------------------------------------------------------ */

/**
 * Mine WebSerial port filters and port configurations.
 * @param {string} sourceText client-side JS source
 * @param {string} [url] page URL for context
 * @returns {{url: string|null, used: boolean, portFilters: object[], portConfigs: object[], endpoints: string[]}}
 */
export function mineWebSerialConfigs(sourceText, url = null) {
  const source = asString(sourceText);
  const portFilters = [];
  const portConfigs = [];
  const endpoints = [];
  const sites = [
    ...findCallSites(source, /\bserial\.requestPort\s*\(/g),
    ...findCallSites(source, /\bserial\.getPorts\s*\(/g),
  ];

  for (const { index, args } of sites) {
    const ctx = windowAround(source, index);
    endpoints.push(...extractUrls(ctx));
    for (const f of parseFilterObjects(args)) {
      if (f.usbVendorId === undefined && f.usbProductId === undefined) continue;
      portFilters.push({
        usbVendorId: f.usbVendorId !== undefined ? toHex4(f.usbVendorId) : null,
        usbProductId: f.usbProductId !== undefined ? toHex4(f.usbProductId) : null,
      });
    }
  }

  for (const { args } of findCallSites(source, /\.open\s*\(\s*\{/g)) {
    if (!/\bbaudRate\s*:/.test(args)) continue;
    const num = key => {
      const m = args.match(new RegExp(`\\b${key}\\s*:\\s*(\\d+)`));
      return m ? Number(m[1]) : null;
    };
    const str = key => {
      const m = args.match(new RegExp(`\\b${key}\\s*:\\s*['"\`]([^'"\`]+)['"\`]`));
      return m ? m[1] : null;
    };
    portConfigs.push({
      baudRate: num('baudRate'),
      dataBits: num('dataBits'),
      stopBits: num('stopBits'),
      parity: str('parity'),
      flowControl: str('flowControl'),
      bufferSize: num('bufferSize'),
    });
  }

  return {
    url: typeof url === 'string' ? url : null,
    used: sites.length > 0 || portConfigs.length > 0,
    portFilters,
    portConfigs,
    endpoints: dedupe(endpoints),
  };
}

/* ------------------------------------------------------------------ */
/* Idea 840 — WebNFC record-type mapping                               */
/*                                                                     */
/* Maps WebNFC (NDEFReader) record handlers — scan/write call sites     */
/* and recordType values — to the physical-interaction features they    */
/* implement (URL handoff, text display, custom data exchange, ...).    */
/* ------------------------------------------------------------------ */

const NFC_RECORD_FEATURES = {
  text: 'Text content display on tag tap',
  url: 'URL sharing / link handoff on tag tap',
  'absolute-url': 'Absolute URL handoff on tag tap',
  mime: 'Custom data exchange (MIME payload) on tag tap',
  'smart-poster': 'Smart poster interaction on tag tap',
  external: 'External (app-specific) record on tag tap',
  empty: 'Empty record — tag wipe/format flow',
  unknown: 'Unknown record type on tag tap',
};

/**
 * Map WebNFC record handlers to physical-interaction features.
 * @param {string} sourceText client-side JS source
 * @param {string} [url] page URL for context
 * @returns {{url: string|null, used: boolean, recordTypes: object[], endpoints: string[]}}
 */
export function mapWebNfcRecords(sourceText, url = null) {
  const source = asString(sourceText);
  const recordTypes = [];
  const endpoints = [];
  const sites = [
    ...findIndices(source, /\bNDEFReader\b/g),
    ...findIndices(source, /\bnfc\.scan\s*\(/g),
  ];
  const seen = new Set();

  for (const index of sites) {
    const ctx = windowAround(source, index);
    endpoints.push(...extractUrls(ctx));
    for (const m of ctx.matchAll(/recordType\s*:\s*['"`]([^'"`]+)['"`]/g)) {
      const rt = m[1].toLowerCase();
      if (seen.has(rt)) continue;
      seen.add(rt);
      recordTypes.push({
        recordType: rt,
        feature: NFC_RECORD_FEATURES[rt] || 'Unrecognized record type on tag tap',
      });
    }
  }

  return {
    url: typeof url === 'string' ? url : null,
    used: sites.length > 0,
    recordTypes,
    endpoints: dedupe(endpoints),
  };
}

/* ------------------------------------------------------------------ */
/* Full surface summary                                                 */
/* ------------------------------------------------------------------ */

/**
 * Run every device/auth API mapper over one source and return the full
 * mapped surface.
 * @param {string} sourceText client-side JS source
 * @param {string} [url] page URL for context
 * @returns {object} per-API mapping results
 */
export function mapDeviceApiSurface(sourceText, url = null) {
  return {
    url: typeof url === 'string' ? url : null,
    credentialManagement: mapCredentialStoreCalls(sourceText, url), // idea 831
    webAuthn: mapWebAuthnRelyingParty(sourceText, url), // idea 832
    webOtp: discoverWebOtpEndpoints(sourceText, url), // idea 833
    contactPicker: mapContactPickerFlows(sourceText, url), // idea 834
    fileSystemAccess: mapFileSystemAccessFeatures(sourceText, url), // idea 835
    webUsb: mineWebUsbFilters(sourceText, url), // idea 836
    webBluetooth: mapWebBluetoothServices(sourceText, url), // idea 837
    webHid: mineWebHidCollections(sourceText, url), // idea 838
    webSerial: mineWebSerialConfigs(sourceText, url), // idea 839
    webNfc: mapWebNfcRecords(sourceText, url), // idea 840
  };
}

export const DEVICE_API_SURFACE = {
  mapCredentialStoreCalls,
  mapWebAuthnRelyingParty,
  discoverWebOtpEndpoints,
  mapContactPickerFlows,
  mapFileSystemAccessFeatures,
  mineWebUsbFilters,
  mapWebBluetoothServices,
  mineWebHidCollections,
  mineWebSerialConfigs,
  mapWebNfcRecords,
  mapDeviceApiSurface,
  USB_CLASS_CODES,
};

export default DEVICE_API_SURFACE;
