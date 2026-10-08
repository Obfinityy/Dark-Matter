/**
 * asyncApiChannelMapper.js — AsyncAPI channel-to-architecture mapper.
 *
 * AsyncAPI documents describe message-driven architectures: channels (topics,
 * queues, subjects), the publish/subscribe operations bound to them, message
 * names, and protocol bindings (kafka, mqtt, amqp, nats, ws, ...). Mapping the
 * channels reconstructs the event backbone of an application — which services
 * emit what, and over which broker.
 *
 * Pure structure analysis: the caller supplies the fetched AsyncAPI document
 * (JSON string or already-parsed object). Supports AsyncAPI 2.x and 3.0
 * layouts. Defensive use: authorized discovery of message-driven attack
 * surface during bug-bounty review.
 */

const DIRECTIONS = ['publish', 'subscribe'];

/**
 * Extract channels from an AsyncAPI 2.x document.
 *
 * @param {object} doc
 * @returns {Array<{ channel: string, direction: string, operationId: string|null, message: string|null, bindings: object }>}
 */
export function mapChannelsV2(doc = {}) {
  const out = [];
  const channels = doc.channels && typeof doc.channels === 'object' ? doc.channels : {};
  for (const [channel, definition] of Object.entries(channels)) {
    if (!definition || typeof definition !== 'object') continue;
    for (const direction of DIRECTIONS) {
      const operation = definition[direction];
      if (!operation || typeof operation !== 'object') continue;
      out.push({
        channel,
        direction,
        operationId: operation.operationId ?? null,
        message: messageName(operation.message),
        bindings: definition.bindings ?? {},
      });
    }
  }
  return out;
}

/**
 * Extract channels and operations from an AsyncAPI 3.0 document.
 *
 * @param {object} doc
 * @returns {Array<{ channel: string, direction: string, operationId: string|null, message: string|null, bindings: object }>}
 */
export function mapChannelsV3(doc = {}) {
  const out = [];
  const channels = doc.channels && typeof doc.channels === 'object' ? doc.channels : {};
  const operations = doc.operations && typeof doc.operations === 'object' ? doc.operations : {};
  for (const [opId, operation] of Object.entries(operations)) {
    if (!operation || typeof operation !== 'object') continue;
    const channelRef =
      operation.channel && typeof operation.channel === 'object' ? operation.channel : null;
    const channelId = channelRef ? (channelRef['$ref']?.split('/').pop() ?? null) : null;
    const address =
      channelId && channels[channelId] ? (channels[channelId].address ?? channelId) : channelId;
    const messages = Array.isArray(operation.messages)
      ? operation.messages
          .map(m => (m && typeof m === 'object' ? (m.name ?? null) : m))
          .filter(Boolean)
      : [];
    out.push({
      channel: address ?? '(unknown)',
      direction:
        operation.action === 'send'
          ? 'publish'
          : operation.action === 'receive'
            ? 'subscribe'
            : (operation.action ?? '(unknown)'),
      operationId: opId,
      message: messages[0] ?? null,
      bindings: channelId && channels[channelId] ? (channels[channelId].bindings ?? {}) : {},
    });
  }
  return out;
}

/**
 * Resolve a message reference to a display name.
 *
 * @param {any} message
 * @returns {string|null}
 */
export function messageName(message) {
  if (!message) return null;
  if (typeof message === 'string') return message;
  if (typeof message === 'object') {
    if (message.name) return String(message.name);
    if (typeof message.$ref === 'string') return message.$ref.split('/').pop();
    if (message.oneOf && Array.isArray(message.oneOf)) {
      return message.oneOf.map(messageName).filter(Boolean).join(' | ') || null;
    }
  }
  return null;
}

/**
 * Detect the AsyncAPI version family of a document.
 *
 * @param {object} doc
 * @returns {'2.x'|'3.x'|'unknown'}
 */
export function detectVersion(doc = {}) {
  const version = String(doc.asyncapi ?? '');
  if (version.startsWith('3.')) return '3.x';
  if (version.startsWith('2.')) return '2.x';
  if (doc.channels && doc.operations) return '3.x';
  if (doc.channels) return '2.x';
  return 'unknown';
}

/**
 * Summarize the protocol/broker mix declared across channels.
 *
 * @param {Array<{bindings: object}>} mapped
 * @returns {string[]}
 */
export function protocolMix(mapped = []) {
  const protocols = new Set();
  for (const entry of mapped) {
    for (const key of Object.keys(entry.bindings || {})) protocols.add(key);
  }
  return [...protocols].sort();
}

/**
 * Full analysis of a fetched AsyncAPI document.
 *
 * @param {{ url?: string, document: string|object }} input
 * @returns {{ type: string, confidence: string, version: string, channels: object[], protocols: string[], channelCount: number, evidence: string }}
 */
export function analyzeAsyncApi({ url = '', document = null } = {}) {
  let doc = document;
  if (typeof document === 'string') {
    try {
      doc = JSON.parse(document);
    } catch {
      return {
        type: 'AsyncAPI Channel Mapping',
        confidence: 'low',
        version: 'unknown',
        channels: [],
        protocols: [],
        channelCount: 0,
        evidence: `Document${url ? ` at ${url}` : ''} is not valid JSON; channels could not be mapped.`,
      };
    }
  }
  if (!doc || typeof doc !== 'object') {
    return {
      type: 'AsyncAPI Channel Mapping',
      confidence: 'low',
      version: 'unknown',
      channels: [],
      protocols: [],
      channelCount: 0,
      evidence: 'No AsyncAPI document supplied.',
    };
  }

  const version = detectVersion(doc);
  const channels = version === '3.x' ? mapChannelsV3(doc) : mapChannelsV2(doc);
  const protocols = protocolMix(channels);
  const uniqueChannels = new Set(channels.map(c => c.channel)).size;

  return {
    type: 'AsyncAPI Channel Mapping',
    confidence: channels.length ? 'high' : 'low',
    version,
    channels,
    protocols,
    channelCount: uniqueChannels,
    evidence: channels.length
      ? `AsyncAPI ${version} document${url ? ` at ${url}` : ''} maps ${uniqueChannels} channel(s) with ${channels.length} operation binding(s)` +
        (protocols.length ? ` over protocol(s): ${protocols.join(', ')}.` : '.')
      : `No channels found in AsyncAPI document${url ? ` at ${url}` : ''}.`,
  };
}

export const ASYNCAPI_CHANNEL_MAPPER = {
  mapChannelsV2,
  mapChannelsV3,
  messageName,
  detectVersion,
  protocolMix,
  analyzeAsyncApi,
};
export default ASYNCAPI_CHANNEL_MAPPER;
