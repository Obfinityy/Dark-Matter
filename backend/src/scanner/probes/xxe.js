// Dark Matter rule-based scanner — XXE probe (v1).
// Sends an entity-expansion probe as application/xml; the oracle is the
// entity resolving in the response. A blind/OOB collaborator variant is a
// documented next step — v1 stays with the deterministic expansion check.
const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

export async function probeXxe(url, opts = {}) {
  const payload = `<?xml version="1.0"?><!DOCTYPE r [<!ENTITY dmxxe "DMXXE123">]><r>&dmxxe;</r>`;
  let text = '';
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'User-Agent': UA, 'Content-Type': 'application/xml' },
        body: payload,
      });
      text = await res.text().catch(() => '');
    } finally {
      clearTimeout(t);
    }
  } catch {
    return [];
  }
  if (!text.includes('DMXXE123')) return [];
  return [
    {
      class: 'xxe',
      id: 'xxe-entity-expansion',
      title: 'XML external entity (XXE) — entity expansion',
      severity: 'high',
      url,
      evidence: {
        request: 'POST application/xml with <!ENTITY dmxxe "DMXXE123">',
        response: 'entity expanded to DMXXE123 in the response',
        impact_demo: 'the XML parser resolves attacker-defined entities',
        signalCorrelated: true,
      },
    },
  ];
}
