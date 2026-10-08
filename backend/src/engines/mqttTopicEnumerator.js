/**
 * mqttTopicEnumerator.js — MQTT topic-enumeration result analyzer.
 *
 * Evaluates the outcome of authorized wildcard subscriptions (# and $SYS/#):
 * classifies enumerated topics, extracts broker version/statistics from the
 * $SYS tree, and flags sensitive topics (credentials, commands, OTA updates)
 * that warrant defensive follow-up on in-scope assets.
 *
 * Offline analyzer: callers supply the list of topic strings received during
 * the subscription window. No subscribe/network code included.
 */

/** $SYS tree keys that expose broker version and stats. */
export const SYS_KEYS = [
  { key: '$SYS/broker/version', type: 'version', note: 'Broker software version string' },
  { key: '$SYS/broker/uptime', type: 'stat', note: 'Broker uptime' },
  { key: '$SYS/broker/clients/connected', type: 'stat', note: 'Connected client count' },
  { key: '$SYS/broker/clients/maximum', type: 'stat', note: 'Peak connected clients' },
  { key: '$SYS/broker/subscriptions/count', type: 'stat', note: 'Active subscription count' },
  { key: '$SYS/broker/messages/received', type: 'stat', note: 'Total messages received' },
  { key: '$SYS/broker/messages/sent', type: 'stat', note: 'Total messages sent' },
  { key: '$SYS/broker/load/messages/received/1min', type: 'stat', note: 'Message load average' },
  { key: '$SYS/broker/bytes/received', type: 'stat', note: 'Bytes received' },
];

/** Topic patterns considered sensitive in authorized assessments. */
export const SENSITIVE_TOPIC_PATTERNS = [
  {
    pattern: /password|passwd|credential|secret|token|apikey|api_key/i,
    class: 'credentials',
    severity: 'High',
  },
  {
    pattern: /cmd|command|exec|shell|reboot|reset|firmware|ota|update/i,
    class: 'control',
    severity: 'Medium',
  },
  { pattern: /location|gps|lat|lon|position/i, class: 'location', severity: 'Medium' },
  { pattern: /payment|billing|card|ssn/i, class: 'pii', severity: 'High' },
];

/** Broker version regexes seen in $SYS/broker/version payloads. */
export const VERSION_PATTERNS = [
  { regex: /mosquitto version ([\d.]+)/i, broker: 'Eclipse Mosquitto' },
  { regex: /EMQX[^\d]*([\d.]+)/i, broker: 'EMQX' },
  { regex: /HiveMQ[^\d]*([\d.]+)/i, broker: 'HiveMQ' },
  { regex: /VerneMQ[^\d]*([\d.]+)/i, broker: 'VerneMQ' },
];

/**
 * Analyze topics collected from wildcard subscriptions.
 *
 * @param {Array<Object|string>} topics - Each either a topic string or
 *   { topic, payload?, retained? }.
 * @returns {Object} enumeration analysis.
 */
export function analyzeEnumeratedTopics(topics = []) {
  if (!Array.isArray(topics)) topics = [];
  const normalized = topics
    .map(t => (typeof t === 'string' ? { topic: t } : t))
    .filter(t => t && typeof t.topic === 'string');

  const sysTopics = [];
  const appTopics = [];
  const sensitive = [];
  const versionHits = [];
  const retained = normalized.filter(t => t.retained).length;

  for (const t of normalized) {
    const topic = t.topic;
    if (topic.startsWith('$SYS/')) {
      sysTopics.push(topic);
      for (const vk of SYS_KEYS) {
        if (topic === vk.key && t.payload !== undefined) {
          for (const vp of VERSION_PATTERNS) {
            const m = String(t.payload).match(vp.regex);
            if (m)
              versionHits.push({
                broker: vp.broker,
                version: m[1],
                evidence: `${topic} = "${t.payload}"`,
              });
          }
        }
      }
    } else {
      appTopics.push(topic);
    }
    for (const sp of SENSITIVE_TOPIC_PATTERNS) {
      if (sp.pattern.test(topic)) {
        sensitive.push({ topic, class: sp.class, severity: sp.severity });
        break;
      }
    }
  }

  // Top-level namespace distribution for app topics.
  const namespaces = {};
  for (const t of appTopics) {
    const head = t.split('/')[0] || '(root)';
    namespaces[head] = (namespaces[head] || 0) + 1;
  }

  const exposure =
    sysTopics.length > 0
      ? 'high'
      : sensitive.length > 0
        ? 'medium'
        : appTopics.length > 0
          ? 'low'
          : 'none';

  return {
    totalTopics: normalized.length,
    sysTopics: sysTopics.length,
    appTopics: appTopics.length,
    retainedMessages: retained,
    wildcardAccepted: normalized.length > 0,
    brokerVersions: versionHits,
    namespaces,
    sensitiveTopics: sensitive,
    exposure,
    summary: normalized.length
      ? `Wildcard subscription returned ${normalized.length} topics (${sysTopics.length} $SYS, ${appTopics.length} app); ${sensitive.length} sensitive topics; exposure=${exposure}.`
      : 'Wildcard subscription returned no topics (restricted or empty).',
    type: 'MQTT Topic Enumeration',
    confidence: normalized.length ? 'high' : 'low',
  };
}

export const MQTT_TOPIC_ENUMERATOR = {
  SYS_KEYS,
  SENSITIVE_TOPIC_PATTERNS,
  VERSION_PATTERNS,
  analyzeEnumeratedTopics,
};
export default MQTT_TOPIC_ENUMERATOR;
