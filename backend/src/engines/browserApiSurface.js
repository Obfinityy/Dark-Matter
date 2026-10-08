/**
 * browserApiSurface.js — Client-side browser-API surface analyzer for
 * authorized bug-bounty reconnaissance.
 *
 * Analyzes captured client-side JavaScript (e.g. fetched from an in-scope
 * target's own pages during an authorized hunt) and maps browser API usage
 * that widens the attack surface: media/screen capture, clipboard,
 * notifications, geolocation, sensors, vibration, battery, network hints,
 * and Payment Request handlers.
 *
 * Idea mapping (Dark-Matter idea bank):
 *  - IDEA 821 → analyzeGetUserMediaConstraints
 *  - IDEA 822 → mapScreenShareEndpoints
 *  - IDEA 823 → mapClipboardApiUsage
 *  - IDEA 824 → extractNotificationEndpoints
 *  - IDEA 825 → mapGeolocationCalls
 *  - IDEA 826 → mineDeviceOrientationHandlers
 *  - IDEA 827 → detectVibrationApiUsage
 *  - IDEA 828 → mapBatteryDataFlow
 *  - IDEA 829 → mapNetworkInformationApi
 *  - IDEA 830 → minePaymentRequestEndpoints
 *  - all      → analyzeBrowserApiSurface (combined recon summary)
 *
 * All functions are pure, deterministic, and network-free: they take JS
 * source text (plus an optional page URL for context) and return structured
 * findings. Defensive framing only: analysis and detection logic, never
 * exploit payloads.
 */

/** Convert source into a 1-indexed line table. */
function toLines(source) {
  if (typeof source !== 'string') return [];
  return source.split(/\r?\n/);
}

/** Return a short snippet around a 0-indexed line. */
function snippet(lines, idx, radius = 1) {
  const from = Math.max(0, idx - radius);
  const to = Math.min(lines.length - 1, idx + radius);
  return lines
    .slice(from, to + 1)
    .join('\n')
    .slice(0, 600);
}

/** Extract quoted URL-looking strings from a text fragment. */
const QUOTED_URL_RE = /['"`](https?:\/\/[^'"`\s<>()\\]+)['"`]/g;
const QUOTED_PATH_RE = /['"`](\/[A-Za-z0-9_.\-~\/]+(?:\?[A-Za-z0-9_.\-~%=&]*)?)['"`]/g;

function extractUrls(text) {
  if (typeof text !== 'string') return [];
  const found = new Set();
  for (const re of [QUOTED_URL_RE, QUOTED_PATH_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) found.add(m[1]);
  }
  return [...found];
}

/**
 * Find network-sink URLs (fetch/XHR/WebSocket/beacon/axios) within ±radius
 * lines of a 0-indexed anchor line.
 */
const SINK_RE =
  /\b(fetch|XMLHttpRequest|new\s+WebSocket|navigator\.sendBeacon|axios\.(get|post|put|delete|patch)|\.open\s*\(|\.send\s*\(|WebSocket)\b/;

function nearbyNetworkUrls(lines, anchorIdx, radius = 12) {
  const urls = new Set();
  const from = Math.max(0, anchorIdx - radius);
  const to = Math.min(lines.length - 1, anchorIdx + radius);
  for (let i = from; i <= to; i += 1) {
    if (
      SINK_RE.test(lines[i]) ||
      (/\b(then|await|promise)\b/i.test(lines[i]) && /https?:\/\//.test(lines[i]))
    ) {
      for (const u of extractUrls(lines[i])) urls.add(u);
    }
  }
  return [...urls];
}

/** Wrap a raw finding with the engine's standard envelope. */
function finding({ idea, api, type, risk, line = null, evidence = '', urls = [], signals = [] }) {
  return { idea, api, type, risk, line, evidence, urls, signals };
}

// ---------------------------------------------------------------- IDEA 821
/**
 * Analyze getUserMedia constraint objects for device-fingerprinting code.
 * Flags exact deviceId pinning, unusual resolution combos, and enumerateDevices
 * label collection — patterns common in fingerprinting scripts.
 * IDEA 821 — Media-stream track analysis.
 *
 * @param {string} source client-side JS source text
 * @param {string} [pageUrl] page the script came from (context only)
 * @returns {object[]} findings
 */
export function analyzeGetUserMediaConstraints(source, pageUrl = '') {
  const lines = toLines(source);
  const findings = [];
  const gumRe = /getUserMedia\s*\(\s*({[\s\S]{0,1200}?)}\s*\)/g;
  const text = typeof source === 'string' ? source : '';

  // 1) getUserMedia calls with inline constraint objects
  let m;
  while ((m = gumRe.exec(text)) !== null) {
    const constraints = m[1];
    const idx = text.slice(0, m.index).split('\n').length; // 1-indexed line
    const signals = [];
    let risk = 'low';

    if (/deviceId\s*:\s*{\s*exact\s*:/.test(constraints)) {
      signals.push('exact deviceId constraint — fingerprints a specific capture device');
      risk = 'high';
    } else if (/deviceId/.test(constraints)) {
      signals.push('deviceId constraint present');
      if (risk === 'low') risk = 'medium';
    }
    if (
      /enumerateDevices/.test(text.slice(Math.max(0, m.index - 800), m.index + constraints.length))
    ) {
      signals.push('enumerateDevices used near getUserMedia — device enumeration surface');
      if (risk === 'low') risk = 'medium';
    }

    const width = constraints.match(/width\s*:\s*{([^}]*)}|width\s*:\s*(\d+)/);
    const height = constraints.match(/height\s*:\s*{([^}]*)}|height\s*:\s*(\d+)/);
    const wBody = width ? width[1] || width[2] || '' : '';
    const hBody = height ? height[1] || height[2] || '' : '';
    if (
      (/min\s*:/.test(wBody) && /max\s*:/.test(wBody)) ||
      (/min\s*:/.test(hBody) && /max\s*:/.test(hBody))
    ) {
      signals.push('min+max resolution range — narrowing profile for fingerprinting');
      if (risk !== 'high') risk = 'medium';
    }
    if (
      /aspectRatio\s*:\s*{\s*exact\s*:/.test(constraints) ||
      /frameRate\s*:\s*{\s*exact\s*:/.test(constraints)
    ) {
      signals.push('exact aspectRatio/frameRate — stable device fingerprint input');
      if (risk !== 'high') risk = 'medium';
    }
    const audioVideo = [];
    if (/\baudio\s*:\s*(true|{)/.test(constraints)) audioVideo.push('audio');
    if (/\bvideo\s*:\s*(true|{)/.test(constraints)) audioVideo.push('video');
    if (/\bvideo\s*:\s*false/.test(constraints) && /\baudio\s*:\s*false/.test(constraints)) {
      signals.push('getUserMedia requested with both tracks disabled — probe call');
      if (risk !== 'high') risk = 'medium';
    }

    findings.push(
      finding({
        idea: 821,
        api: 'getUserMedia',
        type: 'media-constraints',
        risk,
        line: idx,
        evidence: snippet(lines, idx - 1),
        urls: nearbyNetworkUrls(lines, idx - 1),
        signals: [
          ...signals,
          `tracks requested: ${audioVideo.join('+') || 'none'}`,
          ...(pageUrl ? [`page: ${pageUrl}`] : []),
        ],
      })
    );
  }

  // 2) enumerateDevices label harvesting without any media grant nearby
  const enumRe = /enumerateDevices\s*\(\s*\)/g;
  while ((m = enumRe.exec(text)) !== null) {
    const idx = text.slice(0, m.index).split('\n').length;
    const around = text.slice(Math.max(0, m.index - 400), m.index + 400);
    if (/\.label/.test(around)) {
      findings.push(
        finding({
          idea: 821,
          api: 'enumerateDevices',
          type: 'device-enumeration',
          risk: 'medium',
          line: idx,
          evidence: snippet(lines, idx - 1),
          urls: nearbyNetworkUrls(lines, idx - 1),
          signals: ['device label collection after enumeration — fingerprinting surface'],
        })
      );
    }
  }

  return findings;
}

// ---------------------------------------------------------------- IDEA 822
/**
 * Map screen-sharing session endpoints: detect getDisplayMedia calls and
 * surface the signaling/transport URLs the screen-share session flows through.
 * IDEA 822 — Screen-share endpoint mapping.
 */
export function mapScreenShareEndpoints(source, pageUrl = '') {
  const lines = toLines(source);
  const text = typeof source === 'string' ? source : '';
  const findings = [];
  const re = /(getDisplayMedia|captureStream|getDisplayMediaConstraints)\s*\(/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const idx = text.slice(0, m.index).split('\n').length;
    const around = text.slice(Math.max(0, m.index - 600), m.index + 600);
    const signals = [];
    if (/RTCPeerConnection/.test(around))
      signals.push('WebRTC peer connection near screen capture — inspect signaling URLs');
    if (/(signaling|signal|socket\.io|Socket)/i.test(around))
      signals.push('signaling channel detected near screen capture');
    if (/(screen|display)\s*(share|sharing|recording)/i.test(around))
      signals.push('screen-share terminology in code');
    findings.push(
      finding({
        idea: 822,
        api: m[1],
        type: 'screen-capture',
        risk: signals.length ? 'medium' : 'low',
        line: idx,
        evidence: snippet(lines, idx - 1),
        urls: nearbyNetworkUrls(lines, idx - 1),
        signals: [...signals, ...(pageUrl ? [`page: ${pageUrl}`] : [])],
      })
    );
  }
  return findings;
}

// ---------------------------------------------------------------- IDEA 823
/**
 * Map clipboard API usage; flag readText/execCommand patterns that can
 * indicate paste-jacking-style behavior (reading clipboard without clear
 * user intent, or overwriting clipboard content).
 * IDEA 823 — Clipboard-API usage mapping.
 */
export function mapClipboardApiUsage(source, pageUrl = '') {
  const lines = toLines(source);
  const text = typeof source === 'string' ? source : '';
  const findings = [];
  const re =
    /navigator\.clipboard\.(readText|writeText|read|write)\s*\(|document\.execCommand\s*\(\s*['"](copy|cut|paste)['"]\s*\)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const idx = text.slice(0, m.index).split('\n').length;
    const method = m[1] || m[2];
    const before = text.slice(Math.max(0, m.index - 500), m.index);
    const signals = [];
    let risk = 'low';
    if (method === 'readText' || method === 'read') {
      if (!/(click|keydown|keypress|paste|focus|pointerdown|submit)/i.test(before.slice(-500))) {
        signals.push('clipboard READ without nearby user-gesture handler — possible silent read');
        risk = 'high';
      } else {
        signals.push('clipboard read tied to a user gesture');
        risk = 'medium';
      }
    }
    if (method === 'writeText' || method === 'write') {
      const after = text.slice(m.index, m.index + 500);
      if (
        /(click|mouseenter|mouseover|scroll|focus)/i.test(before.slice(-300)) &&
        !/copy\s*(button|btn|icon)?/i.test(before.slice(-300))
      ) {
        signals.push('clipboard WRITE on non-copy gesture — possible paste-jacking overwrite');
        risk = 'high';
      } else {
        signals.push('clipboard write — verify overwritten content is disclosed to the user');
        if (risk === 'low') risk = 'medium';
      }
      if (/https?:\/\//.test(after)) signals.push('URL content staged near clipboard write');
    }
    if (method === 'paste') {
      signals.push('legacy paste execCommand — check for clipboard interception');
      risk = 'medium';
    }
    findings.push(
      finding({
        idea: 823,
        api: `clipboard.${method}`,
        type:
          method.startsWith('read') || method === 'paste' ? 'clipboard-read' : 'clipboard-write',
        risk,
        line: idx,
        evidence: snippet(lines, idx - 1),
        urls: nearbyNetworkUrls(lines, idx - 1),
        signals: [...signals, ...(pageUrl ? [`page: ${pageUrl}`] : [])],
      })
    );
  }
  return findings;
}

// ---------------------------------------------------------------- IDEA 824
/**
 * Extract push-subscription endpoints from notification code: VAPID public
 * keys (applicationServerKey) and push-service endpoint URLs, plus the
 * registration URLs subscriptions are sent to.
 * IDEA 824 — Notification-API endpoint extraction.
 */
export function extractNotificationEndpoints(source, pageUrl = '') {
  const lines = toLines(source);
  const text = typeof source === 'string' ? source : '';
  const findings = [];
  const notifRe =
    /(Notification\.requestPermission|pushManager\.subscribe|registration\.pushManager|new\s+Notification)\b/g;
  let m;
  while ((m = notifRe.exec(text)) !== null) {
    const idx = text.slice(0, m.index).split('\n').length;
    const window = text.slice(Math.max(0, m.index - 300), m.index + 1200);
    const signals = [];
    const urls = nearbyNetworkUrls(lines, idx - 1, 16);

    // VAPID public key material near the subscription
    const vapid =
      window.match(/applicationServerKey\s*:\s*['"`]([^'"`]{20,120})['"`]/) ||
      window.match(/urlBase64ToUint8Array\s*\(\s*['"`]([^'"`]{20,120})['"`]\s*\)/);
    if (vapid) {
      signals.push(
        `VAPID public key present (${vapid[1].slice(0, 16)}…) — identifies the push application server`
      );
    }
    // Push service endpoint URLs assigned to subscription.endpoint
    for (const u of extractUrls(window)) {
      if (!urls.includes(u)) urls.push(u);
      if (/push|fcm|wns|apns|webpush/i.test(u)) {
        signals.push(`push-service endpoint: ${u}`);
      }
    }
    if (/\.endpoint/.test(window))
      signals.push('subscription.endpoint consumed — track where it is sent');
    if (/userVisibleOnly/.test(window)) signals.push('userVisibleOnly flag configured');

    findings.push(
      finding({
        idea: 824,
        api: m[1].replace('new ', ''),
        type: 'push-subscription',
        risk: vapid || urls.length ? 'medium' : 'low',
        line: idx,
        evidence: snippet(lines, idx - 1),
        urls,
        signals: [...signals, ...(pageUrl ? [`page: ${pageUrl}`] : [])],
      })
    );
  }
  return findings;
}

// ---------------------------------------------------------------- IDEA 825
/**
 * Map geolocation API calls and the location-aware endpoints that consume
 * position data (network sinks near the position callback).
 * IDEA 825 — Geolocation-API call mapping.
 */
export function mapGeolocationCalls(source, pageUrl = '') {
  const lines = toLines(source);
  const text = typeof source === 'string' ? source : '';
  const findings = [];
  const re = /geolocation\.(getCurrentPosition|watchPosition|clearWatch)\s*\(/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const idx = text.slice(0, m.index).split('\n').length;
    const window = text.slice(m.index, m.index + 900);
    const signals = [];
    const coords = [];
    for (const prop of ['latitude', 'longitude', 'accuracy', 'altitude', 'speed', 'heading']) {
      if (new RegExp(`coords?\\.${prop}\\b|${prop}\\b\\s*[:=]`).test(window)) coords.push(prop);
    }
    if (coords.length) signals.push(`position fields consumed: ${coords.join(', ')}`);
    const urls = nearbyNetworkUrls(lines, idx - 1, 18);
    if (urls.length)
      signals.push('network sinks near position callback — position likely transmitted');
    if (/enableHighAccuracy\s*:\s*true/.test(window))
      signals.push('enableHighAccuracy:true — precise fix requested');
    if (/maximumAge|maxAge|timeout/.test(window))
      signals.push('position caching options configured');
    findings.push(
      finding({
        idea: 825,
        api: `geolocation.${m[1]}`,
        type: urls.length ? 'location-exfil' : 'location-access',
        risk: urls.length ? 'high' : coords.length ? 'medium' : 'low',
        line: idx,
        evidence: snippet(lines, idx - 1),
        urls,
        signals: [...signals, ...(pageUrl ? [`page: ${pageUrl}`] : [])],
      })
    );
  }
  return findings;
}

// ---------------------------------------------------------------- IDEA 826
/**
 * Mine DeviceOrientation / DeviceMotion handlers and map the device-specific
 * routes they talk to (network sinks inside sensor callbacks).
 * IDEA 826 — DeviceOrientation handler mining.
 */
export function mineDeviceOrientationHandlers(source, pageUrl = '') {
  const lines = toLines(source);
  const text = typeof source === 'string' ? source : '';
  const findings = [];
  const re =
    /addEventListener\s*\(\s*['"](deviceorientation|devicemotion|deviceorientationabsolute)['"]|\b(DeviceOrientationEvent|DeviceMotionEvent|ondeviceorientation|ondevicemotion)\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const idx = text.slice(0, m.index).split('\n').length;
    const window = text.slice(m.index, m.index + 1100);
    const signals = [];
    const axes = ['alpha', 'beta', 'gamma', 'x', 'y', 'z', 'acceleration', 'rotationRate'].filter(
      a => new RegExp(`\\b${a}\\b`).test(window)
    );
    if (axes.length) signals.push(`sensor axes read: ${axes.join(', ')}`);
    if (/requestPermission/.test(window))
      signals.push('sensor permission requested (iOS 13+ pattern)');
    const urls = nearbyNetworkUrls(lines, idx - 1, 16);
    if (urls.length)
      signals.push('network sinks near sensor handler — sensor data may leave the device');
    findings.push(
      finding({
        idea: 826,
        api: m[1] || m[2] || 'sensor',
        type: urls.length ? 'sensor-exfil' : 'sensor-handler',
        risk: urls.length ? 'high' : axes.length ? 'medium' : 'low',
        line: idx,
        evidence: snippet(lines, idx - 1),
        urls,
        signals: [...signals, ...(pageUrl ? [`page: ${pageUrl}`] : [])],
      })
    );
  }
  return findings;
}

// ---------------------------------------------------------------- IDEA 827
/**
 * Detect navigator.vibrate usage and flag patterns typical of mobile-web
 * feature detection or attention-grabbing flows worth reviewing.
 * IDEA 827 — Vibration-API usage detection.
 */
export function detectVibrationApiUsage(source, pageUrl = '') {
  const lines = toLines(source);
  const text = typeof source === 'string' ? source : '';
  const findings = [];
  const re = /navigator\.vibrate\s*\(\s*([^)]{0,300})\)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const idx = text.slice(0, m.index).split('\n').length;
    const arg = (m[1] || '').trim();
    const signals = [];
    let risk = 'low';
    const nums = arg.match(/\d+/g) || [];
    const total = nums.reduce((s, n) => s + Number(n), 0);
    signals.push(`vibration pattern arg: ${arg.slice(0, 80) || '(empty)'}`);
    if (/\[/.test(arg)) {
      signals.push(`pattern sequence of ${nums.length} steps, total ${total}ms`);
      if (total > 3000 || nums.length > 10) {
        signals.push('long/aggressive vibration pattern — review for dark-pattern usage');
        risk = 'medium';
      }
    }
    if (
      /(error|success|fail|alert|notify|warn)/i.test(
        text.slice(Math.max(0, m.index - 300), m.index)
      )
    ) {
      signals.push('vibration tied to status feedback — mobile-web feature indicator');
    }
    findings.push(
      finding({
        idea: 827,
        api: 'navigator.vibrate',
        type: 'vibration',
        risk,
        line: idx,
        evidence: snippet(lines, idx - 1),
        urls: nearbyNetworkUrls(lines, idx - 1),
        signals: [...signals, ...(pageUrl ? [`page: ${pageUrl}`] : [])],
      })
    );
  }
  return findings;
}

// ---------------------------------------------------------------- IDEA 828
/**
 * Map battery API reads that flow into network calls (data-exfil style flow).
 * Performs lightweight taint tracking: variables bound from
 * navigator.getBattery() are followed into fetch/XHR/beacon sinks.
 * IDEA 828 — Battery-API data-exfil mapping.
 */
export function mapBatteryDataFlow(source, pageUrl = '') {
  const lines = toLines(source);
  const text = typeof source === 'string' ? source : '';
  const findings = [];

  const batteryRe = /navigator\.getBattery\s*\(\s*\)/g;
  let m;
  let sawBattery = false;
  const tainted = new Set();

  while ((m = batteryRe.exec(text)) !== null) {
    sawBattery = true;
    const idx = text.slice(0, m.index).split('\n').length;
    const window = text.slice(m.index, m.index + 2500);

    // Capture the continuation variable: getBattery().then(battery => ...) or (b =>
    const cont =
      window.match(/\.then\s*\(\s*(?:async\s*)?\(?\s*([A-Za-z_$][\w$]*)\s*\)?\s*=>/) ||
      window.match(/\.then\s*\(\s*function\s*\(?\s*([A-Za-z_$][\w$]*)/);
    const batteryVar = cont ? cont[1] : 'battery';
    tainted.add(batteryVar);

    // Destructured / aliased battery properties
    const destructure = window.match(
      new RegExp(`(?:const|let|var)\\s*{\\s*([^}]{1,200})\\s*}\\s*=\\s*${batteryVar}\\b`)
    );
    if (destructure) {
      for (const name of destructure[1]
        .split(',')
        .map(s => s.trim().split(/[:\s=]/)[0])
        .filter(Boolean)) {
        tainted.add(name);
      }
    }
    for (const prop of ['level', 'charging', 'chargingTime', 'dischargingTime']) {
      if (new RegExp(`${batteryVar}\\.${prop}\\b`).test(window))
        tainted.add(`${batteryVar}.${prop}`);
    }

    // Propagate taint through derived aliases, e.g. const info = {...battery.level...}
    const aliasRe = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;]{1,300})/g;
    let aliasChanged = true;
    while (aliasChanged) {
      aliasChanged = false;
      aliasRe.lastIndex = 0;
      let aliasMatch;
      while ((aliasMatch = aliasRe.exec(window)) !== null) {
        if (tainted.has(aliasMatch[1])) continue;
        for (const t of tainted) {
          if (new RegExp(`\\b${t.split('.')[0]}\\b`).test(aliasMatch[2])) {
            tainted.add(aliasMatch[1]);
            aliasChanged = true;
            break;
          }
        }
      }
    }

    const signals = [];
    signals.push(`battery object bound as "${batteryVar}"`);
    if (destructure)
      signals.push(`destructured battery fields: ${destructure[1].trim().slice(0, 80)}`);

    // Taint sinks: does any tainted identifier reach a network call?
    const sinkHits = [];
    const sinkRe = /\b(fetch|navigator\.sendBeacon|axios\.(get|post|put))\s*\(\s*([^,)]{0,200})/g;
    let s;
    const sinkWindow = window;
    while ((s = sinkRe.exec(sinkWindow)) !== null) {
      const near = sinkWindow.slice(s.index, s.index + 500);
      for (const t of tainted) {
        const base = t.split('.')[0];
        if (new RegExp(`\\b${base}\\b`).test(near)) {
          sinkHits.push(`${s[1]} ← ${t}`);
          break;
        }
      }
    }
    // XHR send with tainted payload
    const xhrRe = /\.send\s*\(\s*([^)]{0,300})\)/g;
    while ((s = xhrRe.exec(sinkWindow)) !== null) {
      for (const t of tainted) {
        if (new RegExp(`\\b${t.split('.')[0]}\\b`).test(s[1])) {
          sinkHits.push(`xhr.send ← ${t}`);
          break;
        }
      }
    }

    const urls = nearbyNetworkUrls(lines, idx - 1, 20);
    if (sinkHits.length)
      signals.push(`battery data reaches network sinks: ${[...new Set(sinkHits)].join('; ')}`);

    findings.push(
      finding({
        idea: 828,
        api: 'navigator.getBattery',
        type: sinkHits.length ? 'battery-exfil-flow' : 'battery-read',
        risk: sinkHits.length ? 'high' : urls.length ? 'medium' : 'low',
        line: idx,
        evidence: snippet(lines, idx - 1),
        urls,
        signals: [...signals, ...(pageUrl ? [`page: ${pageUrl}`] : [])],
      })
    );
  }

  // Legacy battery properties on navigator (deprecated but still probed)
  if (!sawBattery) {
    const legacyRe = /navigator\.(battery|charging|chargingTime|dischargingTime|level)\b/g;
    while ((m = legacyRe.exec(text)) !== null) {
      const idx = text.slice(0, m.index).split('\n').length;
      findings.push(
        finding({
          idea: 828,
          api: `navigator.${m[1]}`,
          type: 'battery-read',
          risk: 'low',
          line: idx,
          evidence: snippet(lines, idx - 1),
          urls: nearbyNetworkUrls(lines, idx - 1),
          signals: ['legacy navigator battery property probe'],
        })
      );
    }
  }

  return findings;
}

// ---------------------------------------------------------------- IDEA 829
/**
 * Map Network Information API usage (navigator.connection) to
 * adaptive-content endpoints: URLs fetched under connection-type/effectiveType
 * conditionals.
 * IDEA 829 — Network-information API mapping.
 */
export function mapNetworkInformationApi(source, pageUrl = '') {
  const lines = toLines(source);
  const text = typeof source === 'string' ? source : '';
  const findings = [];
  const re = /navigator\.connection\b|navigator\.mozConnection\b|navigator\.webkitConnection\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const idx = text.slice(0, m.index).split('\n').length;
    const window = text.slice(Math.max(0, m.index - 300), m.index + 1100);
    const signals = [];
    const props = ['effectiveType', 'type', 'downlink', 'rtt', 'saveData'].filter(p =>
      new RegExp(`connection\\.${p}\\b|\\.${p}\\b`).test(window)
    );
    if (props.length) signals.push(`connection properties read: ${[...new Set(props)].join(', ')}`);
    if (/saveData/.test(window)) signals.push('saveData honored — adaptive content branch');
    if (/(4g|3g|2g|slow-2g)/i.test(window))
      signals.push('effectiveType branching — quality-tiered endpoints likely');
    if (/addEventListener\s*\(\s*['"]change['"]/.test(window))
      signals.push('listens for connection changes');
    const urls = nearbyNetworkUrls(lines, idx - 1, 18);
    if (urls.length) signals.push('adaptive fetch endpoints near network-hint logic');
    findings.push(
      finding({
        idea: 829,
        api: 'navigator.connection',
        type: urls.length ? 'adaptive-endpoint' : 'network-hint-read',
        risk: urls.length ? 'medium' : 'low',
        line: idx,
        evidence: snippet(lines, idx - 1),
        urls,
        signals: [...signals, ...(pageUrl ? [`page: ${pageUrl}`] : [])],
      })
    );
  }
  return findings;
}

// ---------------------------------------------------------------- IDEA 830
/**
 * Extract payment handler URLs from Payment Request API code: supportedMethods
 * entries (third-party payment URLs) and confirmation/webhook endpoints the
 * PaymentRequest response is sent to.
 * IDEA 830 — Payment-Request API endpoint mining.
 */
export function minePaymentRequestEndpoints(source, pageUrl = '') {
  const lines = toLines(source);
  const text = typeof source === 'string' ? source : '';
  const findings = [];
  const re = /new\s+PaymentRequest\s*\(/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const idx = text.slice(0, m.index).split('\n').length;
    // Method data may be declared inline or as a separately-defined variable,
    // so scan a wide window on both sides of the constructor call.
    const window = text.slice(Math.max(0, m.index - 1500), m.index + 1800);
    const signals = [];
    const urls = [];

    // supportedMethods entries — often third-party payment handler URLs
    const smRe = /supportedMethods\s*:\s*['"`]([^'"`]+)['"`]/g;
    let sm;
    while ((sm = smRe.exec(window)) !== null) {
      const method = sm[1];
      if (/^https?:\/\//i.test(method)) {
        if (!urls.includes(method)) urls.push(method);
        signals.push(`third-party payment handler: ${method}`);
      } else if (/basic-card|apple\.com|google\.com/i.test(method)) {
        signals.push(`standard payment method: ${method}`);
      } else {
        signals.push(`custom payment method identifier: ${method}`);
      }
    }

    // data payloads may carry merchant/processor URLs
    for (const u of extractUrls(window)) {
      if (!urls.includes(u)) {
        urls.push(u);
        signals.push(`URL inside payment method data: ${u}`);
      }
    }

    const after = text.slice(m.index, m.index + 1500);
    const responseSinks = nearbyNetworkUrls(lines, idx - 1, 22);
    for (const u of responseSinks) {
      if (!urls.includes(u)) urls.push(u);
    }
    if (/\.show\s*\(/.test(after))
      signals.push('PaymentRequest.show() invoked — checkout flow active');
    if (/canMakePayment/.test(window)) {
      signals.push('canMakePayment pre-check — payment capability probing');
    }
    if (responseSinks.length)
      signals.push('endpoints near PaymentRequest — likely payment confirmation/webhook targets');

    findings.push(
      finding({
        idea: 830,
        api: 'PaymentRequest',
        type: 'payment-handler',
        risk: urls.some(u => /^https?:\/\//i.test(u)) ? 'medium' : 'low',
        line: idx,
        evidence: snippet(lines, idx - 1),
        urls,
        signals: [...signals, ...(pageUrl ? [`page: ${pageUrl}`] : [])],
      })
    );
  }
  return findings;
}

// ------------------------------------------------------------- combined API
/**
 * Run the full browser-API surface recon over client-side JS and return a
 * combined, de-duplicated summary for the authorized hunt agent.
 *
 * @param {string} source client-side JS source text
 * @param {string} [pageUrl] page the script came from (context only)
 * @returns {{pageUrl: string, totalFindings: number, byIdea: object, findings: object[], topRisks: object[]}}
 */
export function analyzeBrowserApiSurface(source, pageUrl = '') {
  const runners = [
    analyzeGetUserMediaConstraints,
    mapScreenShareEndpoints,
    mapClipboardApiUsage,
    extractNotificationEndpoints,
    mapGeolocationCalls,
    mineDeviceOrientationHandlers,
    detectVibrationApiUsage,
    mapBatteryDataFlow,
    mapNetworkInformationApi,
    minePaymentRequestEndpoints,
  ];
  const findings = [];
  for (const run of runners) findings.push(...run(source, pageUrl));

  const byIdea = {};
  for (const f of findings) {
    byIdea[f.idea] = byIdea[f.idea] || [];
    byIdea[f.idea].push(f);
  }
  const rank = { high: 3, medium: 2, low: 1 };
  const topRisks = [...findings]
    .filter(f => f.risk !== 'low')
    .sort((a, b) => rank[b.risk] - rank[a.risk] || a.idea - b.idea)
    .slice(0, 10);

  return { pageUrl, totalFindings: findings.length, byIdea, findings, topRisks };
}

export const BROWSER_API_SURFACE = {
  analyzeGetUserMediaConstraints,
  mapScreenShareEndpoints,
  mapClipboardApiUsage,
  extractNotificationEndpoints,
  mapGeolocationCalls,
  mineDeviceOrientationHandlers,
  detectVibrationApiUsage,
  mapBatteryDataFlow,
  mapNetworkInformationApi,
  minePaymentRequestEndpoints,
  analyzeBrowserApiSurface,
};

export default BROWSER_API_SURFACE;
