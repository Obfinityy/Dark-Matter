/**
 * hardeningDetector.js — post-incident hardening signal detector.
 *
 * Learned from the real VFS Global bug-bounty hunt (9 Oct 2026): the
 * customer-feedback upload form carried a blocked-filename-fragment list,
 * magic-byte signature checks, MIME allowlists and devtools blocking.
 * That combination proves the dev team ALREADY fought the upload-attack
 * battle — the obvious bypasses are covered and the vector should be
 * DEPRIORITIZED instead of wasting requests on it.
 *
 * This engine scans client-side code (HTML/JS) for those hardening
 * signals and scores the vector so the agent spends its budget elsewhere.
 */

// filename fragments that only appear in codebases that have been burned before
const BLOCKED_FRAGMENT_HINTS = [
  '.asp', '.aspx', '.ashx', '.php', '.jsp', '.jspx', '.exe', '.dll',
  '.config', '.svg', '.js', '.html', '.htm', '.sh', '.war', '.jar',
  '.cer', '.asa', '.cshtml',
];

// magic-byte / signature check hints
const SIGNATURE_HINTS = [
  '0x25', '0x50', '0x44', '0x46', // %PDF
  '0xFF', '0xD8', // JPEG SOI
  '0x89', '0x50', '0x4E', '0x47', // PNG
  'file signature', 'filesignature', 'magic byte', 'magicbyte',
  'matchesFileSignature', 'validateFileSignature', 'readFileHeader',
  'FileReader', 'readAsArrayBuffer',
];

const SIGNAL_DEFS = [
  {
    type: 'extension_allowlist',
    weight: 12,
    patterns: [/allowed\w*extensions?\s*[:=]/i, /accept\s*=\s*["'][^"']*\.(jpg|png|pdf)/i, /whitelist.*ext/i],
    label: 'Extension allowlist present',
  },
  {
    type: 'mime_allowlist',
    weight: 12,
    patterns: [/allowed\w*mime/i, /image\/jpeg.*image\/png/i, /mime.*allow/i],
    label: 'MIME-type allowlist present',
  },
  {
    type: 'blocked_fragments',
    weight: 20,
    patterns: [/blocked\w*(name|fragment|extension)/i],
    label: 'Blocked filename-fragment list (post-incident hardening)',
    extraCheck: (src) => BLOCKED_FRAGMENT_HINTS.filter((h) => src.toLowerCase().includes(h)).length,
    extraWeight: 10, // bonus when the list actually contains dangerous fragments
    extraThreshold: 5,
  },
  {
    type: 'signature_check',
    weight: 20,
    patterns: [/matchesFileSignature/i, /validateFileSignature/i, /readFileHeader/i, /magic[\s_-]?byte/i, /file[\s_-]?signature/i],
    label: 'File-signature (magic-byte) validation',
    extraCheck: (src) => SIGNATURE_HINTS.filter((h) => src.includes(h)).length,
    extraWeight: 8,
    extraThreshold: 3,
  },
  {
    type: 'multi_ext_rejection',
    weight: 8,
    patterns: [/multiple.*extension/i, /hasMultipleExtensions/i, /\.\s*\.\s*not allowed/i],
    label: 'Multiple-extension rejection (shell.php.jpg blocked)',
  },
  {
    type: 'size_limit',
    weight: 6,
    patterns: [/max\w*(file)?size/i, /file.*exceed/i, /5\s*\*\s*1024\s*\*\s*1024/i],
    label: 'File-size limit enforced',
  },
  {
    type: 'server_side_flag',
    weight: 10,
    patterns: [/validatedOnServer/i, /server.*validat/i, /serverSide/i],
    label: 'Server-side validation referenced',
  },
  {
    type: 'devtools_blocking',
    weight: 8,
    patterns: [/keyCode\s*==\s*123/i, /ctrlKey\s*&&\s*\w*shiftKey/i, /F12/i, /devtools/i],
    label: 'DevTools keyboard shortcuts blocked (anti-tamper)',
  },
];

/**
 * Detect devtools-blocking specifically.
 * @param {object} opts - {html?, js?}
 * @returns {{blocked:boolean, evidence:string[]}}
 */
export function detectDevtoolsBlocking({ html = '', js = '' } = {}) {
  const src = `${html}\n${js}`;
  const evidence = [];
  if (/keyCode\s*==\s*123/i.test(src)) evidence.push('F12 (keyCode 123) handler found');
  if (/ctrlKey/i.test(src) && /shiftKey/i.test(src)) evidence.push('Ctrl+Shift key combo handler found');
  if (/\bF12\b/.test(src)) evidence.push('Literal "F12" reference found');
  if (/devtools/i.test(src)) evidence.push('Literal "devtools" reference found');
  return { blocked: evidence.length > 0, evidence };
}

/**
 * Analyze upload-validation hardening in client-side code.
 * @param {object} opts - {html?, js?}
 * @returns {{signals:Array, hardeningScore:number, verdict:string, recommendation:string}}
 */
export function analyzeUploadValidation({ html = '', js = '' } = {}) {
  const src = `${html}\n${js}`;
  const signals = [];

  for (const def of SIGNAL_DEFS) {
    const matched = def.patterns.some((p) => p.test(src));
    if (!matched) continue;
    let confidence = 'medium';
    let weight = def.weight;
    if (def.extraCheck) {
      const hits = def.extraCheck(src);
      if (hits >= (def.extraThreshold || 1)) {
        confidence = 'high';
        weight += def.extraWeight || 0;
      }
    }
    // direct literal evidence boosts confidence
    const literal = def.type === 'blocked_fragments'
      ? src.toLowerCase().includes('blocked')
      : true;
    if (literal && confidence === 'medium') confidence = 'high';
    signals.push({
      type: def.type,
      evidence: def.label,
      confidence,
      weight,
    });
  }

  const hardeningScore = scoreFromSignals(signals);

  let verdict;
  let recommendation;
  if (hardeningScore >= 70) {
    verdict = 'heavily-hardened';
    recommendation =
      'Deprioritize — obvious bypasses already blocked; only test server-side with coordination.';
  } else if (hardeningScore >= 40) {
    verdict = 'moderately-hardened';
    recommendation =
      'Probe carefully — some controls exist; focus on gaps between client and server validation.';
  } else if (hardeningScore >= 15) {
    verdict = 'basic';
    recommendation =
      'Worth testing — only basic validation present; try standard bypass techniques.';
  } else {
    verdict = 'none';
    recommendation =
      'No upload validation detected client-side — high-priority test target (verify server-side too).';
  }

  return { signals, hardeningScore, verdict, recommendation };
}

/**
 * Pure scoring: sum signal weights, clamp 0-100.
 * @param {Array<{weight:number}>} signals
 * @returns {number}
 */
export function scoreFromSignals(signals) {
  const total = (signals || []).reduce((sum, s) => sum + (Number(s.weight) || 0), 0);
  return Math.max(0, Math.min(100, total));
}

export const HARDENING_DETECTOR = {
  analyzeUploadValidation,
  detectDevtoolsBlocking,
  scoreFromSignals,
};
export default HARDENING_DETECTOR;
