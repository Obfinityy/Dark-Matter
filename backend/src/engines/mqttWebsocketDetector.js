/**
 * mqttWebsocketDetector.js — MQTT-over-WebSocket endpoint detection (idea 00495).
 *
 * Detects MQTT served over WebSockets from the HTTP upgrade handshake:
 *  - 101 Switching Protocols with `Sec-WebSocket-Protocol: mqtt` in response.
 *  - Common broker paths: `/mqtt`, `/ws`, `/mqtts`, `/stream`.
 *  - Broker-identifying headers / body on the pre-upgrade HTTP response.
 *
 * This is complementary to mqttProber.js (raw TCP CONNACK analysis) — this
 * module handles the HTTP/WebSocket framing layer only.
 *
 * Offline analyzer: callers supply captured HTTP responses. No network code.
 */

export const COMMON_MQTT_WS_PATHS = ['/mqtt', '/ws', '/mqtts', '/stream', '/ws/mqtt'];

const BROKER_PATH_HINTS = [
  { broker: 'EMQX', markers: [/emqx/i], defaultPath: '/mqtt' },
  { broker: 'HiveMQ', markers: [/hivemq/i], defaultPath: '/mqtt' },
  { broker: 'VerneMQ', markers: [/vernemq/i], defaultPath: '/mqtt' },
  { broker: 'Eclipse Mosquitto', markers: [/mosquitto/i], defaultPath: '/mqtt' },
  { broker: 'NanoMQ', markers: [/nanomq/i], defaultPath: '/mqtt' },
];

/**
 * Analyze a captured HTTP response for an MQTT-over-WebSocket endpoint.
 *
 * @param {{headers?: object, body?: string, status?: number, path?: string}} response
 * @returns {object} detection verdict
 */
export function analyzeMqttWebsocket(response = {}) {
  const headers = {};
  for (const [k, v] of Object.entries(response.headers || {})) {
    headers[k.toLowerCase()] = String(v);
  }
  const body = String(response.body || '');
  const path = String(response.path || '');
  const signals = [];

  const protocols = String(headers['sec-websocket-protocol'] || '');
  if (response.status === 101 && /mqtt/i.test(protocols)) {
    signals.push({
      signal: 'ws_upgrade_mqtt',
      detail: `101 with Sec-WebSocket-Protocol: ${protocols.slice(0, 60)}`,
    });
  }
  if (COMMON_MQTT_WS_PATHS.includes(path)) {
    signals.push({ signal: 'known_mqtt_ws_path', detail: path });
  }
  const matchedBroker = BROKER_PATH_HINTS.find(b =>
    b.markers.some(re => re.test(body) || re.test(headers.server || ''))
  );
  if (matchedBroker) {
    signals.push({ signal: 'broker_marker', detail: matchedBroker.broker });
  }
  if (/mqtt/i.test(headers['x-powered-by'] || '')) {
    signals.push({ signal: 'powered_by_mqtt', detail: headers['x-powered-by'].slice(0, 60) });
  }

  const detected = signals.length > 0;
  let confidence = 'none';
  if (signals.some(s => s.signal === 'ws_upgrade_mqtt')) confidence = 'high';
  else if (signals.length > 0) confidence = 'medium';

  return {
    detected,
    confidence,
    service: 'mqtt-over-websocket',
    broker: matchedBroker ? matchedBroker.broker : null,
    signals,
    recommendations: detected
      ? [
          'Confirm whether anonymous MQTT-over-WebSocket access is intended; subscribe ACLs should deny `#` for guests.',
          'Enforce WSS (TLS) — plain WS leaks credentials in transit.',
          'Verify the broker is a supported, patched release.',
        ]
      : [],
  };
}

export const MQTT_WEBSOCKET = {
  idea: '00495',
  commonPaths: COMMON_MQTT_WS_PATHS,
  analyze: analyzeMqttWebsocket,
};

export default MQTT_WEBSOCKET;
