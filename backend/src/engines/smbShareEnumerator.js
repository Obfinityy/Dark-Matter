/**
 * smbShareEnumerator.js — SMB share listing analyzer (idea 00361).
 *
 * Analyzes a share listing captured from an in-scope SMB host (for example a
 * null-session `srvsvc` share enumeration where the engagement rules permit
 * it) and classifies every exposed share by sensitivity: administrative
 * shares, printer shares, and user shares whose names or comments suggest
 * writable, backup, or otherwise sensitive content.
 *
 * Offline analyzer: callers supply captured listing text (smbclient-style
 * output) or an already-structured share array. This module never opens SMB
 * sessions and never authenticates anywhere.
 */

/** Administrative / special shares that are always sensitive when listed. */
export const ADMIN_SHARES = new Set([
  'IPC$',
  'ADMIN$',
  'PRINT$',
  'FAX$',
  'SYSVOL',
  'NETLOGON',
]);

/** Drive-letter administrative shares such as C$, D$. */
export const ADMIN_SHARE_PATTERN = /^[A-Z]\$$/;

/** Name keywords that suggest a share may hold sensitive or writable data. */
export const SENSITIVE_NAME_HINTS = [
  { regex: /backup/i, label: 'backup data' },
  { regex: /share|public/i, label: 'general shared data' },
  { regex: /\b(drop|upload|incoming|tmp|temp)\b/i, label: 'drop/writable area' },
  { regex: /finance|account|hr|payroll|salary/i, label: 'financial/HR data' },
  { regex: /secret|private|confiden/i, label: 'restricted data' },
  { regex: /scan/i, label: 'scanner output' },
  { regex: /software|install|deploy/i, label: 'software distribution' },
  { regex: /www|web|site/i, label: 'web content' },
  { regex: /db|database|sql/i, label: 'database files' },
];

/**
 * Parse smbclient-style `Sharename Type Comment` table text into share objects.
 * Tolerates the header/separator lines smbclient prints.
 * @param {string} text Raw listing text.
 * @returns {Array<{name: string, type: string, comment: string}>}
 */
export function parseSmbclientListing(text) {
  const shares = [];
  if (typeof text !== 'string' || !text.trim()) return shares;
  const lines = text.split(/\r?\n/);
  let inTable = false;
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (/^\s*Sharename\s+Type\s+Comment/i.test(line)) { inTable = true; continue; }
    if (!inTable) continue;
    if (/^\s*-{3,}/.test(line)) continue; // separator row
    if (!line.trim()) continue;
    // Columns are whitespace-separated; the name is the first token,
    // the type the second, and the remainder is the comment.
    const m = /^\s*(\S+)\s+(\S+)(?:\s+(.*))?$/.exec(line);
    if (!m) continue;
    if (m[1] === 'Sharename') continue;
    shares.push({ name: m[1], type: m[2], comment: (m[3] || '').trim() });
  }
  return shares;
}

/**
 * Classify one share by sensitivity.
 * @param {{name: string, type: string, comment: string}} share
 * @returns {{share: string, sensitivity: 'high'|'medium'|'low', reasons: string[], confidence: 'high'|'medium'}}
 */
export function classifyShare(share) {
  const name = String(share.name || '');
  const reasons = [];
  let sensitivity = 'low';
  let confidence = 'medium';

  if (ADMIN_SHARES.has(name.toUpperCase()) || ADMIN_SHARE_PATTERN.test(name.toUpperCase())) {
    sensitivity = 'high';
    confidence = 'high';
    reasons.push(`Administrative share "${name}" is enumerable — IPC$/ADMIN$/C$ style shares aid lateral movement.`);
  } else if (/IPC/i.test(String(share.type || ''))) {
    sensitivity = 'high';
    confidence = 'high';
    reasons.push('IPC share exposed; used for named-pipe enumeration.');
  } else if (/print/i.test(String(share.type || '')) || /print/i.test(name)) {
    sensitivity = 'low';
    confidence = 'high';
    reasons.push('Printer share; low direct value but confirms SMB stack.');
  } else {
    for (const hint of SENSITIVE_NAME_HINTS) {
      if (hint.regex.test(name) || hint.regex.test(String(share.comment || ''))) {
        sensitivity = 'medium';
        confidence = 'medium';
        reasons.push(`Name/comment suggests ${hint.label} — worth an authorized access check.`);
      }
    }
    if (reasons.length === 0) {
      reasons.push('Ordinary user share; no sensitivity markers in name or comment.');
    }
  }
  return { share: name, sensitivity, reasons, confidence };
}

/**
 * Analyze a full captured listing. Accepts raw smbclient-style text or a
 * structured array of {name, type, comment}.
 * @param {string|Array<{name: string, type?: string, comment?: string}>} input
 * @returns {{total: number, shares: Array, highSensitivity: Array, summary: string, confidence: string}}
 */
export function enumerateSmbShares(input) {
  const parsed = Array.isArray(input)
    ? input.map((s) => ({ name: String(s.name || ''), type: String(s.type || ''), comment: String(s.comment || '') }))
    : parseSmbclientListing(input);
  const shares = parsed.map(classifyShare);
  const highSensitivity = shares.filter((s) => s.sensitivity === 'high');
  const medium = shares.filter((s) => s.sensitivity === 'medium');
  const summary = `${parsed.length} share(s) enumerated: ${highSensitivity.length} high-sensitivity, ${medium.length} medium-sensitivity.`;
  return {
    total: parsed.length,
    shares,
    highSensitivity: highSensitivity.map((s) => s.share),
    summary,
    confidence: parsed.length > 0 ? 'high' : 'low',
  };
}

export const SMB_SHARE_ENUMERATOR = {
  enumerateSmbShares,
  parseSmbclientListing,
  classifyShare,
  ADMIN_SHARES: [...ADMIN_SHARES],
};
export default SMB_SHARE_ENUMERATOR;
