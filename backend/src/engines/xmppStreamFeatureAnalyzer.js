/**
 * xmppStreamFeatureAnalyzer.js — XMPP stream-feature analyzer (idea 00517).
 *
 * Analyzes XMPP `<stream:features>` payloads to fingerprint server software
 * (Prosody, ejabberd, Openfire, Tigase, Metronome, MongooseIM) and flag
 * insecure configurations such as missing STARTTLS or advertised
 * plaintext SASL mechanisms. Pure XML-over-TLS analyzer; defensive,
 * authorized bug-bounty use.
 */

const SERVER_SIGNATURES = [
  {
    name: 'Prosody',
    features: [/^urn:ietf:params:xml:ns:xmpp-bind$/],
    idHints: [/^prosody/i],
    confidence: 0.9,
  },
  {
    name: 'ejabberd',
    features: [/^urn:xmpp:ping$/, /^http:\/\/jabber\.org\/protocol\/disco#info$/],
    idHints: [/^ejabberd/i],
    confidence: 0.85,
  },
  {
    name: 'Openfire',
    features: [/^http:\/\/jabber\.org\/protocol\/disco#info$/],
    idHints: [/^openfire/i],
    confidence: 0.7,
  },
  {
    name: 'Tigase',
    features: [/^urn:xmpp:jingle:apps:rtp:1$/],
    idHints: [/^tigase/i],
    confidence: 0.85,
  },
  {
    name: 'Metronome',
    features: [/^urn:ietf:params:xml:ns:xmpp-bind$/],
    idHints: [/^metronome/i],
    confidence: 0.8,
  },
  {
    name: 'MongooseIM',
    features: [/^urn:xmpp:mam:2$/],
    idHints: [/^mongoose/i],
    confidence: 0.8,
  },
];

const WEAK_SASL = new Set(['PLAIN', 'LOGIN', 'DIGEST-MD5']);

/**
 * Parse a stream:features block for mechanisms and feature namespaces.
 * @param {string} xml raw stream:features XML
 * @returns {{mechanisms: string[], features: string[], starttls: boolean, bind: boolean, from: string|null}}
 */
export function parseStreamFeatures(xml = '') {
  const text = String(xml);
  const mechanisms = [...text.matchAll(/<mechanism>([^<]+)<\/mechanism>/gi)].map(m =>
    m[1].toUpperCase()
  );
  const features = [...text.matchAll(/xmlns=['"]([^'"]+)['"]/gi)]
    .map(m => m[1])
    .filter(ns => !/stream$|client$|jabber:client/.test(ns));
  const starttls = /starttls/i.test(text);
  const bind = /xmpp-bind/.test(text);
  const from = (text.match(/<stream:features[^>]*from=['"]([^'"]+)['"]/i) || [])[1] || null;
  return {
    mechanisms,
    features: [...new Set(features)],
    starttls,
    bind,
    from,
  };
}

/**
 * Fingerprint XMPP server software from stream features.
 * @param {{mechanisms: string[], features: string[], from: string|null}} parsed
 * @param {string} [serverId=''] server identity string when known
 * @returns {{best: string|null, confidence: number, candidates: string[]}}
 */
export function fingerprintXmppServer(parsed = {}, serverId = '') {
  const features = parsed.features || [];
  const candidates = [];

  for (const sig of SERVER_SIGNATURES) {
    const featHits = sig.features.filter(re => features.some(f => re.test(f))).length;
    const idHit = sig.idHints.some(re => re.test(serverId));
    if (featHits === 0 && !idHit) continue;
    candidates.push({
      name: sig.name,
      confidence: idHit
        ? Math.min(0.95, sig.confidence + 0.1)
        : sig.confidence * (0.6 + 0.4 * (featHits / sig.features.length)),
    });
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  return {
    best: candidates.length > 0 ? candidates[0].name : null,
    confidence: candidates.length > 0 ? Number(candidates[0].confidence.toFixed(2)) : 0,
    candidates: candidates.map(c => c.name),
  };
}

/**
 * Score XMPP stream-feature security posture.
 * @param {{mechanisms: string[], starttls: boolean, bind: boolean}} parsed
 * @param {boolean} [tlsActive=false] whether the observed connection already uses TLS
 * @returns {{score: number, issues: string[], secure: boolean}}
 */
export function scoreXmppPosture(parsed = {}, tlsActive = false) {
  const issues = [];
  let score = 100;

  if (!parsed.starttls && !tlsActive) {
    issues.push(
      'STARTTLS not offered and connection is plaintext; credentials traverse unencrypted.'
    );
    score -= 60;
  }
  const weak = (parsed.mechanisms || []).filter(m => WEAK_SASL.has(m));
  if (weak.length > 0 && !tlsActive) {
    issues.push(`Weak SASL mechanisms on plaintext: ${weak.join(', ')}.`);
    score -= 30;
  }
  if (!parsed.bind) {
    issues.push(
      'Resource binding feature not advertised (unusual for a client-to-server endpoint).'
    );
    score -= 10;
  }

  return { score: Math.max(0, score), issues, secure: score >= 80 };
}

export const XMPP_STREAM_FEATURE_ANALYZER = {
  parseStreamFeatures,
  fingerprintXmppServer,
  scoreXmppPosture,
};

export default XMPP_STREAM_FEATURE_ANALYZER;
