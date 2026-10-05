/**
 * honeypotBannerFlagger.js — Honeypot banner-anomaly flagger.
 *
 * Matches captured service banners against the known default banners of
 * popular honeypot tools (Cowrie, Kippo, Dionaea, …). A match means the
 * endpoint is almost certainly a decoy and must be excluded from the real
 * asset inventory and from further active testing.
 *
 * This module is a pure offline analyzer: it consumes captured banner
 * strings and returns a structured verdict. It performs no network I/O.
 */

const HONEYPOT_SIGNATURES = [
  {
    tool: 'Cowrie',
    service: 'ssh',
    pattern: /SSH-2\.0-OpenSSH_6\.0p1 Debian-4\+deb7u2/i,
    confidence: 'high',
    note: 'Cowrie ships this exact OpenSSH banner by default.',
  },
  {
    tool: 'Kippo',
    service: 'ssh',
    pattern: /SSH-2\.0-OpenSSH_5\.1p1 Debian-5/i,
    confidence: 'high',
    note: 'Kippo ships this exact OpenSSH banner by default.',
  },
  {
    tool: 'Cowrie',
    service: 'telnet',
    pattern: /cowrie login:/i,
    confidence: 'high',
    note: 'Cowrie telnet prompt string.',
  },
  {
    tool: 'Dionaea',
    service: 'ftp',
    pattern: /220-? *dionaea/i,
    confidence: 'high',
    note: 'Dionaea FTP banner identifier.',
  },
  {
    tool: 'Dionaea',
    service: 'http',
    pattern: /Server:\s*dionaea/i,
    confidence: 'high',
    note: 'Dionaea HTTP server header.',
  },
  {
    tool: 'Glastopf',
    service: 'http',
    pattern: /Server:\s*Apache\/2\.2\.8 \(Ubuntu\) DAV\/2/i,
    confidence: 'medium',
    note: 'Glastopf default Apache emulation banner (also seen on real legacy hosts — treat as medium).',
  },
  {
    tool: 'Artillery',
    service: 'ssh',
    pattern: /SSH-2\.0-OpenSSH_5\.9p1 Debian-5ubuntu1/i,
    confidence: 'medium',
    note: 'Artillery honeypot default banner; also a plausible real Ubuntu 12.04 banner — medium confidence.',
  },
  {
    tool: 'Generic',
    service: 'any',
    pattern: /honeypot|honeyd|kippo|cowrie/i,
    confidence: 'high',
    note: 'Banner literally names a honeypot tool.',
  },
];

/**
 * Flag a captured banner if it matches a known honeypot signature.
 * @param {{host?: string, port?: number, service?: string, banner: string}} input
 */
export function flagHoneypotBanner({ host = null, port = null, service = 'unknown', banner = '' } = {}) {
  const text = String(banner || '');
  if (!text.trim()) {
    return { flagged: false, confidence: 'none', reason: 'Empty banner — nothing to evaluate.', banner: '' };
  }

  for (const sig of HONEYPOT_SIGNATURES) {
    if (sig.pattern.test(text)) {
      const serviceMatch = sig.service === 'any' || sig.service === service || service === 'unknown';
      return {
        flagged: true,
        tool: sig.tool,
        service,
        confidence: serviceMatch ? sig.confidence : 'low',
        matchedSignature: String(sig.pattern),
        note: sig.note,
        banner: text.slice(0, 200),
        action: 'exclude-from-inventory',
        recommendation: `Decoy identified (${sig.tool}) — remove ${host || 'host'}${port ? `:${port}` : ''} from the real asset inventory and stop active testing against it.`,
      };
    }
  }

  // Heuristic: banners that advertise EOL/placeholder software on a port
  // where it makes no sense are decoy-shaped.
  const anomalies = [];
  if (/test|demo|example\.com/i.test(text)) anomalies.push('banner contains placeholder/test strings');
  if (text.length > 2000) anomalies.push('unusually long banner (banner-bloat is a decoy tell)');

  return {
    flagged: anomalies.length > 0,
    tool: anomalies.length ? 'unknown (anomaly)' : null,
    service,
    confidence: anomalies.length ? 'low' : 'none',
    anomalies,
    banner: text.slice(0, 200),
    action: anomalies.length ? 'review-manually' : 'none',
    recommendation: anomalies.length
      ? 'Banner looks anomalous but matches no known honeypot — review manually before spending scan budget.'
      : 'No honeypot signature matched — treat as a real asset.',
  };
}

export const HONEYPOT_BANNER_FLAGGER = { flagHoneypotBanner, HONEYPOT_SIGNATURES };
export default HONEYPOT_BANNER_FLAGGER;
