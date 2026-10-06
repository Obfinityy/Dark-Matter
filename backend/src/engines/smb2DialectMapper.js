/**
 * smb2DialectMapper.js — SMB2 dialect-negotiation mapping (idea 00529).
 *
 * Defensive fingerprinting for an authorized bug-bounty agent. A single
 * SMB2 NEGOTIATE exchange shows only the dialect the server chose for the
 * offered set — it does not show the server's full capability. Mapping the
 * supported dialect set requires offering different dialect lists across
 * probes (downgrade ladder: offer only 3.1.1, then 3.0.2, then 3.0, then
 * 2.1, then 2.0.2) and recording which dialect the server selects — or
 * whether it refuses. The resulting support matrix is a strong OS/stack
 * fingerprint: Windows 7 offers up to 2.1, Server 2012 up to 3.0.2,
 * modern Windows up to 3.1.1 with preauth integrity, Samba versions map
 * to their max-dialect config, and NAS firmware shows its own ceiling.
 * Servers still negotiating SMB 2.0.2/2.1 are a hardening finding.
 *
 * Pure analyzer: the caller supplies the observed offer→selected matrix
 * from controlled NEGOTIATE probes (decoded fields, not raw sockets).
 * This module never opens SMB sessions itself.
 *
 * Complements smbNegotiator.js (single-exchange analysis); this module
 * builds the per-host dialect support matrix across multiple probes.
 */

/** SMB2/SMB3 dialect codes in descending preference order. */
export const SMB2_DIALECT_LADDER = [
  { code: 0x0311, name: 'SMB 3.1.1' },
  { code: 0x0302, name: 'SMB 3.0.2' },
  { code: 0x0300, name: 'SMB 3.0' },
  { code: 0x0210, name: 'SMB 2.1' },
  { code: 0x0202, name: 'SMB 2.0.2' },
];

/** Max-dialect → implementation hints. */
export const DIALECT_CEILING_HINTS = [
  { max: 'SMB 3.1.1', hint: 'Windows 10/11, Server 2016+, or Samba 4.12+ (modern stack)' },
  { max: 'SMB 3.0.2', hint: 'Windows 8.1 / Server 2012 R2, or Samba 4.2–4.11' },
  { max: 'SMB 3.0', hint: 'Windows 8 / Server 2012, or Samba 4.0–4.1' },
  { max: 'SMB 2.1', hint: 'Windows 7 / Server 2008 R2 — end-of-life OS family, flag for upgrade' },
  { max: 'SMB 2.0.2', hint: 'Windows Vista / Server 2008 — end-of-life, flag immediately' },
];

/**
 * Build the dialect support matrix from a downgrade-ladder probe series.
 * Each probe: { offered: number[], selected: number|null } where
 * selected === null means the server refused the whole offered set.
 * @param {{probes: Array<{offered: number[], selected: number|null}>}} input
 * @returns {{supported: string[], unsupported: string[], refusedAll: boolean, matrix: Array<{dialect: string, offeredAlone: boolean, selected: boolean}>}}
 */
export function buildDialectMatrix(input = {}) {
  const probes = Array.isArray(input.probes) ? input.probes : [];
  const supported = new Set();
  const unsupported = new Set();
  const matrix = SMB2_DIALECT_LADDER.map((d) => {
    const solo = probes.find((p) => p.offered.length === 1 && p.offered[0] === d.code);
    const selected = solo ? solo.selected === d.code : false;
    if (solo) {
      (selected ? supported : unsupported).add(d.name);
    }
    return { dialect: d.name, code: d.code, offeredAlone: Boolean(solo), selected };
  });
  // Dialects offered only inside larger sets: infer support if server ever selected them.
  for (const p of probes) {
    if (p.selected != null) {
      const d = SMB2_DIALECT_LADDER.find((x) => x.code === p.selected);
      if (d) supported.add(d.name);
    }
  }
  const refusedAll = probes.length > 0 && probes.every((p) => p.selected == null);
  return {
    supported: [...supported],
    unsupported: [...unsupported],
    refusedAll,
    matrix,
  };
}

/**
 * Map a host's SMB dialect posture: ceiling, implementation guess, hardening notes.
 * @param {{probes: Array<{offered: number[], selected: number|null}>, capabilities?: number, signingRequired?: boolean}} input
 * @returns {{type: string, confidence: 'high'|'medium'|'low', maxDialect: string|null, implementationHint: string|null, legacyDialects: string[], hardeningNotes: string[], evidence: string}}
 */
export function mapSmb2Dialects(input = {}) {
  const { supported, refusedAll } = buildDialectMatrix(input);
  const hardeningNotes = [];

  if (refusedAll) {
    return {
      type: 'SMB2 Dialect Mapping',
      confidence: 'low',
      maxDialect: null,
      implementationHint: null,
      legacyDialects: [],
      hardeningNotes: ['Server refused all SMB2 dialect offers — may require SMB1 or block negotiation probes'],
      evidence: 'All NEGOTIATE probes refused; no dialect matrix could be built.',
    };
  }

  // Ceiling = highest supported dialect on the ladder.
  const maxDialect = SMB2_DIALECT_LADDER.map((d) => d.name).find((n) => supported.includes(n)) || null;
  const ceiling = DIALECT_CEILING_HINTS.find((h) => h.max === maxDialect);
  const legacyDialects = supported.filter((d) => d === 'SMB 2.0.2' || d === 'SMB 2.1');
  if (legacyDialects.length) {
    hardeningNotes.push(`Legacy dialects still negotiated (${legacyDialects.join(', ')}) — disable SMB 2.0/2.1 on the server`);
  }
  if (maxDialect === 'SMB 2.1' || maxDialect === 'SMB 2.0.2') {
    hardeningNotes.push('Dialect ceiling indicates an end-of-life Windows generation — prioritize upgrade in the report');
  }
  if (input.signingRequired === false) {
    hardeningNotes.push('SMB signing not required — relay attacks possible where credentials are in play');
  }

  return {
    type: 'SMB2 Dialect Mapping',
    confidence: supported.length > 0 ? 'high' : 'low',
    maxDialect,
    implementationHint: ceiling ? ceiling.hint : null,
    legacyDialects,
    hardeningNotes,
    evidence: supported.length === 0
      ? 'No supported dialects determined from the probe series.'
      : `Supported dialects: ${supported.join(', ')}; ceiling ${maxDialect} → ${ceiling ? ceiling.hint : 'unknown stack'}.`
        + (hardeningNotes.length ? ` Hardening: ${hardeningNotes.join('; ')}` : ''),
  };
}
