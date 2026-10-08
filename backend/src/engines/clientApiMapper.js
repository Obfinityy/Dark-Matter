/**
 * clientApiMapper.js — Client-side web API feature mapping engine.
 *
 * Statically maps modern browser API usage found in a target's own
 * client-side JavaScript/HTML to the product features and backend
 * endpoints that serve them. This gives an authorized hunter a map of
 * which web APIs a feature relies on, which media/real-time endpoints
 * to inventory, and which on-device ML model URLs to include in scope
 * verification — all from passive static analysis of served code, with
 * no execution and no network calls.
 *
 * Covers:
 *  - BarcodeDetector format mapping (idea 841)
 *  - ShapeDetector face/text API usage mapping (idea 842)
 *  - WebXR session-mode mapping (idea 843)
 *  - Gamepad API feature mapping (idea 844)
 *  - WebMIDI port enumeration (idea 845)
 *  - AudioWorklet processor mapping (idea 846)
 *  - WebCodecs encoder mapping (idea 847)
 *  - WebTransport stream mapping (idea 848)
 *  - WebNN model-URL extraction (idea 849)
 *  - TensorFlow.js model harvesting (idea 850)
 *
 * Every function is a pure function of the provided source text.
 */

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Collect unique matches of a global regex.
 * @param {string} text
 * @param {RegExp} re global regex (must have /g)
 * @param {number} [group=1] capture group index to collect
 * @returns {string[]}
 */
function collectAll(text, re, group = 1) {
  const out = new Set();
  const src = String(text || '');
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(src)) !== null) out.add(m[group]);
  return [...out];
}

/**
 * Normalise a matched literal (strip quotes/backticks, collapse whitespace).
 * @param {string} s
 * @returns {string}
 */
function clean(s) {
  return String(s || '')
    .replace(/[`'"\s]/g, '')
    .trim();
}

// ---------------------------------------------------------------------------
// Idea 841 — Barcode-detection format mapping
// ---------------------------------------------------------------------------

/** Barcode formats recognized by BarcodeDetector.getSupportedFormats(). */
const BARCODE_FORMATS = [
  'aztec',
  'code_128',
  'code_39',
  'code_93',
  'codabar',
  'data_matrix',
  'datamatrix',
  'ean_13',
  'ean_8',
  'itf',
  'pdf417',
  'qr_code',
  'upc_a',
  'upc_e',
];

const BARCODE_USAGE_RE = /new\s+BarcodeDetector\s*\(\s*(?:\{[^}]*\})?/gi;
const BARCODE_FORMAT_RE = new RegExp(`["'](${BARCODE_FORMATS.join('|')})["']`, 'gi');

/**
 * Map BarcodeDetector usage to the formats a feature scans.
 * @param {string} jsSource client-side JavaScript source
 * @returns {{used: boolean, formats: string[], formatCount: number}}
 */
export function mapBarcodeFormats(jsSource = '') {
  const src = String(jsSource || '');
  const used = BARCODE_USAGE_RE.test(src) || /BarcodeDetector\s*\./.test(src);
  const formats = collectAll(src, BARCODE_FORMAT_RE).map(f => f.toLowerCase());
  return { used, formats, formatCount: formats.length };
}

// ---------------------------------------------------------------------------
// Idea 842 — Shape-detection API mapping
// ---------------------------------------------------------------------------

/** Media-processing endpoints commonly serving face/text detection results. */
const SHAPE_API_ENDPOINT_HINTS = [
  'detect',
  'face',
  'ocr',
  'text-detect',
  'shape',
  'vision',
  'analyze',
  'liveness',
  'biometric',
  'document-scan',
];

const SHAPE_DETECTOR_RE = /new\s+(FaceDetector|TextDetector|BarcodeDetector)\s*\(/gi;
const FETCH_URL_RE = /fetch\s*\(\s*['"`]([^'"`]{2,200})/gi;

/**
 * Map FaceDetector/TextDetector usage to media-processing endpoints.
 * @param {string} jsSource client-side JavaScript source
 * @returns {{detectors: string[], endpoints: string[]}}
 */
export function mapShapeDetection(jsSource = '') {
  const src = String(jsSource || '');
  const detectors = collectAll(src, SHAPE_DETECTOR_RE);
  const urls = collectAll(src, FETCH_URL_RE);
  const endpoints = urls.filter(u =>
    SHAPE_API_ENDPOINT_HINTS.some(hint => u.toLowerCase().includes(hint))
  );
  return { detectors, endpoints };
}

// ---------------------------------------------------------------------------
// Idea 843 — WebXR session-mode mapping
// ---------------------------------------------------------------------------

/** WebXR session modes mapped to the immersive-content routes they imply. */
const XR_SESSION_MODES = ['immersive-vr', 'immersive-ar', 'inline'];

const XR_REQUEST_RE = /requestSession\s*\(\s*['"`]([^'"`]+)['"`]/gi;
const XR_ROUTE_HINT_RE = /(xr|ar|vr|immersive|metaverse|scene|glb|gltf|model3d)/i;

/**
 * Map requested WebXR session modes to immersive-content routes.
 * @param {string} jsSource client-side JavaScript source
 * @returns {{modes: string[], routes: string[]}}
 */
export function mapWebXRSessionModes(jsSource = '') {
  const src = String(jsSource || '');
  const requested = collectAll(src, XR_REQUEST_RE).map(m => m.toLowerCase());
  const modes = requested.filter(m => XR_SESSION_MODES.includes(m));
  const routes = collectAll(src, FETCH_URL_RE).filter(u => XR_ROUTE_HINT_RE.test(u));
  return { modes, routes };
}

// ---------------------------------------------------------------------------
// Idea 844 — Gamepad-API feature mapping
// ---------------------------------------------------------------------------

const GAMEPAD_RE =
  /navigator\.getGamepads\s*\(|gamepadconnected|gamepaddisconnected|getGamepads\(\)/gi;
const GAMEPAD_GAMING_HINTS = [
  'game',
  'play',
  'controller',
  'joystick',
  'arcade',
  'gameroom',
  'streaming',
  'cloud-gaming',
  'multiplayer',
  'leaderboard',
];

/**
 * Map Gamepad API usage to gaming features in the product.
 * @param {string} jsSource client-side JavaScript source
 * @returns {{used: boolean, signals: string[], gamingFeatures: string[]}}
 */
export function mapGamepadFeatures(jsSource = '') {
  const src = String(jsSource || '');
  const signals = collectAll(src, GAMEPAD_RE, 0);
  const used = signals.length > 0;
  const urls = collectAll(src, FETCH_URL_RE);
  const gamingFeatures = urls.filter(u =>
    GAMEPAD_GAMING_HINTS.some(hint => u.toLowerCase().includes(hint))
  );
  return { used, signals: signals.map(clean), gamingFeatures };
}

// ---------------------------------------------------------------------------
// Idea 845 — WebMIDI port enumeration
// ---------------------------------------------------------------------------

const MIDI_REQUEST_RE = /navigator\.requestMIDIAccess\s*\(/gi;
const MIDI_PORT_RE =
  /midi[\s_]*(?:port|device|input|output)[s]?\s*(?:id|name|label)?\s*[:=]\s*['"`]([^'"`]+)['"`]/gi;
const MIDI_METHOD_RE = /\.(inputs|outputs)\s*\.\s*(?:get|values)\s*\(/gi;

/**
 * Enumerate MIDI ports referenced by music features in client code.
 * @param {string} jsSource client-side JavaScript source
 * @returns {{midiAccessRequested: boolean, ports: string[], portSources: string[]}}
 */
export function enumerateWebMidiPorts(jsSource = '') {
  const src = String(jsSource || '');
  const midiAccessRequested = MIDI_REQUEST_RE.test(src);
  const ports = collectAll(src, MIDI_PORT_RE);
  const portSources = collectAll(src, MIDI_METHOD_RE).map(p => p.toLowerCase());
  return { midiAccessRequested, ports, portSources };
}

// ---------------------------------------------------------------------------
// Idea 846 — AudioWorklet processor mapping
// ---------------------------------------------------------------------------

const WORKLET_ADD_MODULE_RE = /audioWorklet\s*\.\s*addModule\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gi;
const WORKLET_NODE_RE = /new\s+AudioWorkletNode\s*\(\s*(?:[^,]+,\s*)?['"`]([^'"`]+)['"`]/gi;

/**
 * Map AudioWorklet processors to the audio-processing endpoints they load.
 * @param {string} jsSource client-side JavaScript source
 * @returns {{processors: string[], moduleUrls: string[]}}
 */
export function mapAudioWorkletProcessors(jsSource = '') {
  const src = String(jsSource || '');
  const moduleUrls = collectAll(src, WORKLET_ADD_MODULE_RE);
  const processors = collectAll(src, WORKLET_NODE_RE);
  return { processors, moduleUrls };
}

// ---------------------------------------------------------------------------
// Idea 847 — WebCodecs encoder mapping
// ---------------------------------------------------------------------------

const CODEC_RE = /new\s+(VideoEncoder|AudioEncoder)\s*\(\s*\{/gi;
const CODEC_CONFIG_RE = /(?:codec|mimeType)\s*[:=]\s*['"`]([^'"`]+)['"`]/gi;

/**
 * Map WebCodecs encoder configs to media-pipeline endpoints.
 * @param {string} jsSource client-side JavaScript source
 * @returns {{encoders: string[], codecs: string[]}}
 */
export function mapWebCodecsEncoders(jsSource = '') {
  const src = String(jsSource || '');
  const encoders = collectAll(src, CODEC_RE);
  const codecs = collectAll(src, CODEC_CONFIG_RE);
  return { encoders, codecs };
}

// ---------------------------------------------------------------------------
// Idea 848 — WebTransport stream mapping
// ---------------------------------------------------------------------------

const WEBTRANSPORT_RE = /new\s+WebTransport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gi;
const WEBTRANSPORT_STREAM_RE =
  /\.(createBidirectionalStream|createUnidirectionalStream|datagrams)(?=\s*[\(.])/gi;

/**
 * Map WebTransport usage to the real-time endpoints it connects to.
 * @param {string} jsSource client-side JavaScript source
 * @returns {{endpoints: string[], streamTypes: string[]}}
 */
export function mapWebTransportStreams(jsSource = '') {
  const src = String(jsSource || '');
  const endpoints = collectAll(src, WEBTRANSPORT_RE);
  const streamTypes = collectAll(src, WEBTRANSPORT_STREAM_RE, 1);
  return { endpoints, streamTypes };
}

// ---------------------------------------------------------------------------
// Idea 849 — WebNN model-URL extraction
// ---------------------------------------------------------------------------

const WEBNN_RE = /navigator\.ml\s*\.|MLGraphBuilder|MLContext|computeGraph/gi;
const WEBNN_MODEL_URL_RE = /(?:model(?:Url)?|weights(?:Url)?)\s*[:=]\s*['"`]([^'"`]{3,400})/gi;
const WEBNN_FETCH_RE =
  /fetch\s*\(\s*['"`]([^'"`]*(?:\.bin|\.onnx|\.tflite|\.webnn|model[^'"`]*\.json)[^'"`]*)['"`]/gi;

/**
 * Extract on-device ML model URLs referenced by WebNN code.
 * @param {string} jsSource client-side JavaScript source
 * @returns {{webNNUsed: boolean, modelUrls: string[]}}
 */
export function extractWebNNModelUrls(jsSource = '') {
  const src = String(jsSource || '');
  const webNNUsed = WEBNN_RE.test(src);
  const viaConfig = collectAll(src, WEBNN_MODEL_URL_RE);
  const viaFetch = collectAll(src, WEBNN_FETCH_RE);
  const modelUrls = [...new Set([...viaConfig, ...viaFetch])];
  return { webNNUsed, modelUrls };
}

// ---------------------------------------------------------------------------
// Idea 850 — TensorFlow.js model harvesting
// ---------------------------------------------------------------------------

const TF_LOAD_MODEL_RE = /tf\s*\.\s*loadGraphModel\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gi;
const TF_LAYERS_MODEL_RE = /tf\s*\.\s*loadLayersModel\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gi;
const TF_MODEL_JSON_RE = /['"`]([^'"`]*model\.json[^'"`]*)['"`]/gi;

/**
 * Harvest TensorFlow.js model.json URLs for model-host mapping.
 * @param {string} jsSource client-side JavaScript source
 * @returns {{modelUrls: string[], hosts: string[], loadCalls: number}}
 */
export function harvestTensorFlowModelUrls(jsSource = '') {
  const src = String(jsSource || '');
  const graph = collectAll(src, TF_LOAD_MODEL_RE);
  const layers = collectAll(src, TF_LAYERS_MODEL_RE);
  const jsonRefs = collectAll(src, TF_MODEL_JSON_RE);
  const modelUrls = [...new Set([...graph, ...layers, ...jsonRefs])];
  const hosts = [
    ...new Set(
      modelUrls
        .map(u => {
          const m = u.match(/^https?:\/\/([^/:?#]+)/i);
          return m ? m[1].toLowerCase() : null;
        })
        .filter(Boolean)
    ),
  ];
  return { modelUrls, hosts, loadCalls: graph.length + layers.length };
}

/**
 * Run the full client-side API mapping pass over a bundle of sources.
 * @param {{js?: string, html?: string, manifest?: object}} input
 * @returns {object} results keyed by idea number
 */
export function mapClientApiFootprint({ js = '', html = '', manifest = null } = {}) {
  const combined = `${js || ''}\n${html || ''}`;
  return {
    841: mapBarcodeFormats(combined),
    842: mapShapeDetection(combined),
    843: mapWebXRSessionModes(combined),
    844: mapGamepadFeatures(combined),
    845: enumerateWebMidiPorts(combined),
    846: mapAudioWorkletProcessors(combined),
    847: mapWebCodecsEncoders(combined),
    848: mapWebTransportStreams(combined),
    849: extractWebNNModelUrls(combined),
    850: harvestTensorFlowModelUrls(combined),
    manifestProvided: manifest !== null && manifest !== undefined,
  };
}

export const CLIENT_API_MAPPER = {
  mapBarcodeFormats,
  mapShapeDetection,
  mapWebXRSessionModes,
  mapGamepadFeatures,
  enumerateWebMidiPorts,
  mapAudioWorkletProcessors,
  mapWebCodecsEncoders,
  mapWebTransportStreams,
  extractWebNNModelUrls,
  harvestTensorFlowModelUrls,
  mapClientApiFootprint,
};
export default CLIENT_API_MAPPER;
