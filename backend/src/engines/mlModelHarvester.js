/**
 * mlModelHarvester.js — In-browser ML model and chat-widget backend discovery.
 *
 * Passively maps client-side ML and chat-widget surface from JavaScript
 * sources already obtained during an authorized engagement (idea-bank
 * ideas 851-853):
 *
 *  - Idea 851: ONNX Runtime model URLs — finds `.onnx` model files and
 *    `InferenceSession.create(...)` calls that load them in the browser.
 *  - Idea 852: WASM ML-inference mapping — maps `.wasm` inference modules
 *    (ort-wasm, tfjs-backend-wasm, onnxruntime-web, mediapipe) to the AI
 *    feature endpoints that consume them.
 *  - Idea 853: Chat-widget backend discovery — extracts chat-widget
 *    backend hosts/URLs and the API-key/app-id *reference names* widgets
 *    expect (values are redacted; only the parameter names are reported
 *    so the hunter knows which tenant identifiers an in-scope widget uses).
 *
 * Pure parsing only: no network access, no model execution, no credential
 * exfiltration. Results help an authorized hunter confirm which model and
 * chat endpoints belong to the in-scope organisation before testing them.
 */

const ONNX_URL_RE = /["'`]((?:https?:)?\/\/[^\s"'`<>]+\.onnx(?:\?[^\s"'`<>]*)?)["'`]/gi;
const ONNX_BARE_RE = /["'`]((?:[a-zA-Z0-9_./-]+\/)?[a-zA-Z0-9_.-]+\.onnx(?:\?[^\s"'`<>]*)?)["'`]/gi;
const ONNX_SESSION_CREATE_RE = /InferenceSession\s*\.\s*create\s*\(\s*["'`]([^"'`]+)["'`]/g;
const ONNX_RUN_RE = /(?:session|ort\.InferenceSession)\s*\.\s*run\s*\(\s*\{/g;

const WASM_URL_RE = /["'`]((?:https?:)?\/\/[^\s"'`<>]+\.wasm(?:\?[^\s"'`<>]*)?)["'`]/gi;
const WASM_MODULE_RE =
  /(ort-wasm|ort-wasm-simd|tfjs-backend-wasm|onnxruntime-web|mediapipe|tflite|ncnn|mnn)\.?[\w-]*\.?(?:wasm|js)?/gi;
const WASM_INSTANTIATE_RE =
  /WebAssembly\s*\.\s*(?:instantiate(?:Streaming)?|compile(?:Streaming)?)\s*\(\s*(?:fetch\s*\(\s*["'`]([^"'`]+)["'`])?/g;
const TFJS_WASM_BACKEND_RE = /setBackend\s*\(\s*["'`](wasm|webgpu|webgl)["'`]\s*\)/gi;
const EXECUTION_PROVIDER_RE = /executionProviders?\s*:\s*\[?\s*["'`]([a-z0-9_-]+)["'`]/gi;

const CHAT_WIDGET_MARKERS = [
  { vendor: 'intercom', re: /intercom(?:\.com|cdn\.com|settings)?|Intercom\s*\(\s*['"]boot['"]/i },
  { vendor: 'drift', re: /js\.driftt\.com|drift\.com|driftt/i },
  { vendor: 'crisp', re: /client\.crisp\.chat|crisp\.chat|\$crisp/i },
  { vendor: 'zendesk-chat', re: /zopim|zendesk.*chat|static\.zdassets/i },
  { vendor: 'hubspot', re: /js\.hs-scripts\.com|hubspot\.com.*chat/i },
  { vendor: 'freshchat', re: /wchat\.freshchat\.com|freshchat/i },
  { vendor: 'livechat', re: /cdn\.livechatinc\.com|livechat/i },
  { vendor: 'tawk', re: /embed\.tawk\.to|tawk\.to/i },
  { vendor: 'salesforce-chat', re: /embeddedservice|salesforce.*chat/i },
  { vendor: 'tidio', re: /code\.tidio\.co|tidio/i },
];
const CHAT_BACKEND_URL_RE =
  /["'`]((?:https?:)?\/\/[^\s"'`<>]*(?:chat|message|conversation|widget|socket|realtime|pusher|ably)[^\s"'`<>]*(?:\/[^\s"'`<>]*)?)["'`]/gi;
const API_KEY_REF_RE =
  /\b(appId|app_id|apiKey|api_key|widgetId|widget_id|siteId|site_id|propertyId|license|chatKey|clientKey)\b\s*[:=]\s*["'`]?([A-Za-z0-9_.-]{3,80})["'`]?/gi;
const PLACEHOLDER_VALUES = new Set(['your_api_key', 'your-app-id', 'xxx', 'null', 'undefined', '']);

function unique(list) {
  return [...new Set(list.filter(Boolean))];
}

/**
 * Find ONNX model URLs and session-creation calls in client-side JS.
 * Idea 851.
 * @param {string} jsSource JavaScript source text
 * @returns {{modelUrls: string[], sessionCreations: string[], runsDetected: boolean}}
 */
export function findOnnxModelUrls(jsSource = '') {
  const src = String(jsSource || '');
  const modelUrls = new Set();
  let m;
  ONNX_URL_RE.lastIndex = 0;
  while ((m = ONNX_URL_RE.exec(src)) !== null) modelUrls.add(m[1]);
  ONNX_BARE_RE.lastIndex = 0;
  while ((m = ONNX_BARE_RE.exec(src)) !== null) {
    if (m[1].startsWith('http') || m[1].includes('/')) modelUrls.add(m[1]);
  }
  const sessionCreations = [];
  ONNX_SESSION_CREATE_RE.lastIndex = 0;
  while ((m = ONNX_SESSION_CREATE_RE.exec(src)) !== null) {
    if (!sessionCreations.includes(m[1])) sessionCreations.push(m[1]);
    modelUrls.add(m[1]);
  }
  ONNX_RUN_RE.lastIndex = 0;
  const runsDetected = ONNX_RUN_RE.test(src) || /InferenceSession/i.test(src);
  return { modelUrls: [...modelUrls], sessionCreations, runsDetected };
}

/**
 * Map WASM ML-inference modules to the backends/features that use them.
 * Idea 852.
 * @param {string} jsSource JavaScript source text
 * @returns {{wasmModules: string[], wasmUrls: string[], backends: string[], executionProviders: string[]}}
 */
export function mapWasmInferenceModules(jsSource = '') {
  const src = String(jsSource || '');
  const wasmModules = new Set();
  const wasmUrls = new Set();
  let m;
  WASM_MODULE_RE.lastIndex = 0;
  while ((m = WASM_MODULE_RE.exec(src)) !== null) wasmModules.add(m[1].toLowerCase());
  WASM_URL_RE.lastIndex = 0;
  while ((m = WASM_URL_RE.exec(src)) !== null) {
    wasmUrls.add(m[1]);
    const name = m[1]
      .split('/')
      .pop()
      .replace(/\.wasm.*$/, '')
      .toLowerCase();
    if (/ort|onnx/.test(name)) wasmModules.add('onnxruntime-web');
    else if (/tfjs|tensorflow/.test(name)) wasmModules.add('tfjs-backend-wasm');
  }
  WASM_INSTANTIATE_RE.lastIndex = 0;
  while ((m = WASM_INSTANTIATE_RE.exec(src)) !== null) {
    if (m[1]) wasmUrls.add(m[1]);
  }
  const backends = new Set();
  TFJS_WASM_BACKEND_RE.lastIndex = 0;
  while ((m = TFJS_WASM_BACKEND_RE.exec(src)) !== null) backends.add(m[1].toLowerCase());
  if (wasmModules.size && !backends.size) backends.add('wasm');
  const executionProviders = new Set();
  EXECUTION_PROVIDER_RE.lastIndex = 0;
  while ((m = EXECUTION_PROVIDER_RE.exec(src)) !== null) executionProviders.add(m[1].toLowerCase());
  return {
    wasmModules: [...wasmModules],
    wasmUrls: [...wasmUrls],
    backends: [...backends],
    executionProviders: [...executionProviders],
  };
}

/**
 * Extract chat-widget backend hosts/URLs and API-key reference names.
 * Idea 853. Key *values* are redacted to a short prefix so the report
 * confirms which tenant identifiers the widget expects without
 * exfiltrating secrets.
 * @param {string} jsSource JavaScript source text (page or widget bundle)
 * @returns {{vendors: string[], backendUrls: string[], keyReferences: {name: string, valuePrefix: string}[]}}
 */
export function discoverChatWidgetBackend(jsSource = '') {
  const src = String(jsSource || '');
  const vendors = unique(CHAT_WIDGET_MARKERS.filter(v => v.re.test(src)).map(v => v.vendor));
  const backendUrls = new Set();
  let m;
  CHAT_BACKEND_URL_RE.lastIndex = 0;
  while ((m = CHAT_BACKEND_URL_RE.exec(src)) !== null) {
    const url = m[1];
    if (/\.(png|jpg|jpeg|svg|css|woff2?)(\?|$)/i.test(url)) continue;
    backendUrls.add(url);
  }
  const keyReferences = [];
  const seen = new Set();
  API_KEY_REF_RE.lastIndex = 0;
  while ((m = API_KEY_REF_RE.exec(src)) !== null) {
    const name = m[1];
    const value = m[2] || '';
    if (seen.has(name) || PLACEHOLDER_VALUES.has(value.toLowerCase())) continue;
    seen.add(name);
    keyReferences.push({
      name,
      valuePrefix: value ? `${value.slice(0, 6)}…(redacted)` : '(empty)',
    });
  }
  return { vendors, backendUrls: [...backendUrls], keyReferences };
}

/**
 * Full ML + chat-widget surface mapping pass over one or more JS sources.
 * @param {string[]} jsSources
 * @returns {{onnx: object[], wasm: object[], chat: object[], summary: object}}
 */
export function harvestMlAndChatSurface(jsSources = []) {
  const sources = (jsSources || []).map(s => String(s || ''));
  const onnx = sources.map(findOnnxModelUrls);
  const wasm = sources.map(mapWasmInferenceModules);
  const chat = sources.map(discoverChatWidgetBackend);
  return {
    onnx,
    wasm,
    chat,
    summary: {
      onnxModelCount: onnx.reduce((n, r) => n + r.modelUrls.length, 0),
      wasmModuleCount: wasm.reduce((n, r) => n + r.wasmModules.length, 0),
      chatVendorCount: chat.reduce((n, r) => n + r.vendors.length, 0),
    },
  };
}

export const ML_MODEL_HARVESTER = {
  findOnnxModelUrls,
  mapWasmInferenceModules,
  discoverChatWidgetBackend,
  harvestMlAndChatSurface,
};
export default ML_MODEL_HARVESTER;
