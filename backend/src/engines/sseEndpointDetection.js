/**
 * sseEndpointDetection.js — Server-Sent Events endpoint detection for autonomous bug bounty.
 *
 * Implements idea-bank item 00428: detect Server-Sent Events endpoints by
 * response content-type and stream behavior, and characterize the event
 * stream's structure.
 *
 * SSE endpoints announce themselves with `Content-Type: text/event-stream`,
 * usually alongside `Cache-Control: no-cache` and `X-Accel-Buffering: no`.
 * The stream itself is a sequence of `event:`, `data:`, `id:`, and `retry:`
 * fields; the event names in use (message plus custom names) inventory the
 * server's push channels for an authorized engagement.
 *
 * All functions are pure and side-effect free: they classify response
 * headers and parse stream samples the caller captured during an
 * authorized engagement. No streaming connections are opened here.
 */

/**
 * Detect whether a response is a Server-Sent Events stream from headers.
 * @param {*} headers Raw headers object/array of [k,v] pairs.
 * @returns {{isSse: boolean, confidence: string, evidence: string[]}}
 */
export function detectSseResponse(headers) {
  const evidence = [];
  const norm = {};
  const add = (k, v) => {
    const key = String(k).trim().toLowerCase();
    if (norm[key] === undefined) norm[key] = String(v);
  };
  if (Array.isArray(headers)) {
    for (const h of headers) {
      if (Array.isArray(h) && h.length >= 2) add(h[0], h[1]);
    }
  } else if (headers && typeof headers === 'object') {
    for (const [k, v] of Object.entries(headers)) add(k, Array.isArray(v) ? v[0] : v);
  }

  const contentType = (norm['content-type'] || '').toLowerCase();
  const isEventStream = contentType.includes('text/event-stream');
  if (isEventStream) {
    evidence.push(`Content-Type: ${norm['content-type']} — SSE media type`);
  }
  if (/no-cache/.test((norm['cache-control'] || '').toLowerCase())) {
    evidence.push('Cache-Control: no-cache — typical SSE anti-buffering directive');
  }
  if ((norm['x-accel-buffering'] || '').toLowerCase() === 'no') {
    evidence.push('X-Accel-Buffering: no — proxy buffering disabled for streaming');
  }

  if (isEventStream) {
    return { isSse: true, confidence: evidence.length >= 2 ? 'high' : 'medium', evidence };
  }
  return {
    isSse: false,
    confidence: 'low',
    evidence: evidence.length ? evidence : ['no text/event-stream content-type observed'],
  };
}

/**
 * Parse a captured SSE sample into discrete events.
 * Handles `event:`, `data:` (multi-line joined with \n), `id:`, `retry:`,
 * and `:comment` lines per the HTML SSE specification.
 * @param {string} sample Captured stream text (a prefix of the stream is enough).
 * @param {number} maxEvents Maximum events to parse (default 50).
 * @returns {Array<{event: string|null, data: string, id: string|null, retry: number|null, comments: string[]}>}
 */
export function parseEventStreamSample(sample, maxEvents = 50) {
  const events = [];
  if (!sample || typeof sample !== 'string') return events;
  let current = { event: null, data: [], id: null, retry: null, comments: [] };
  const flush = () => {
    if (current.data.length > 0 || current.event || current.id) {
      events.push({
        event: current.event,
        data: current.data.join('\n'),
        id: current.id,
        retry: current.retry,
        comments: current.comments,
      });
    }
    current = { event: null, data: [], id: null, retry: null, comments: [] };
  };
  for (const rawLine of sample.split(/\r?\n/)) {
    if (events.length >= maxEvents) break;
    const line = rawLine;
    if (line === '') {
      flush();
      continue;
    }
    if (line.startsWith(':')) {
      current.comments.push(line.slice(1).trim());
      continue;
    }
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') current.event = value;
    else if (field === 'data') current.data.push(value);
    else if (field === 'id') current.id = value;
    else if (field === 'retry' && /^\d+$/.test(value)) current.retry = parseInt(value, 10);
  }
  flush();
  return events.slice(0, maxEvents);
}

/**
 * Summarize a detected SSE endpoint: detection verdict plus stream profile.
 * @param {object} observation { headers?: *, sample?: string, url?: string }
 * @returns {{
 *   url: string|null, detection: object, eventCount: number, eventNames: string[],
 *   hasIds: boolean, hasRetry: boolean, commentCount: number, summary: string
 * }}
 */
export function summarizeSseEndpoint(observation = {}) {
  const detection = detectSseResponse(observation.headers);
  const events = parseEventStreamSample(observation.sample);
  const names = new Set();
  let hasIds = false;
  let hasRetry = false;
  let commentCount = 0;
  for (const e of events) {
    names.add(e.event || 'message');
    if (e.id) hasIds = true;
    if (e.retry !== null) hasRetry = true;
    commentCount += e.comments.length;
  }
  const eventNames = [...names].sort();
  const summary = detection.isSse
    ? `SSE endpoint (${detection.confidence} confidence): ${events.length} event(s) parsed, channels: ${eventNames.join(', ') || 'none observed'}`
    : 'not an SSE endpoint by response headers';
  return {
    url: typeof observation.url === 'string' ? observation.url : null,
    detection,
    eventCount: events.length,
    eventNames,
    hasIds,
    hasRetry,
    commentCount,
    summary,
  };
}
