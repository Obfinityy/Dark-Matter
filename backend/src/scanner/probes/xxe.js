// Dark Matter rule-based scanner — XXE probe (v2).
// Sends an entity-expansion probe as application/xml; the oracle is the
// entity resolving in the response. The blind/OOB variant (6 Nov 2026)
// sends an external parameter entity at a collaborator canary URL — a
// callback hit CONFIRMS blind XXE in-scan (class xxe_oob, high); no hit
// means no finding (100% truth rule). The OOB variant is lab-gated
// (opts.labTargets) exactly like the SAML-XXE OOB variant in saml.js.
const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

// LAB GATE: the OOB variant runs only when the authorized host is listed
// in opts.labTargets (same split pattern as saml.js / index.js).
function isLabHost(url, opts) {
  let host = '';
  try { host = new URL(url).host; } catch { return false; }
  return String(opts.labTargets || '')
    .split(/[,\s]+/)
    .some((t) => t && (host.includes(t) || t.includes(host)));
}

export async function probeXxe(url, opts = {}) {
  const findings = [];
  const timeoutMs = opts.timeoutMs || 15000;

  // POST application/xml, returning {status, text}. A transport failure
  // yields status 0 and empty text — the caller decides what that means.
  async function postXml(body) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'User-Agent': UA, 'Content-Type': 'application/xml', ...(opts.headers || {}) },
        body,
      });
      const text = await res.text().catch(() => '');
      return { status: res.status, text };
    } catch {
      return { status: 0, text: '' };
    } finally {
      clearTimeout(t);
    }
  }

  // (a) Internal entity expansion (v1, unchanged): a benign DOCTYPE
  // defines <!ENTITY dmxxe "DMXXE123"> and references it in the body.
  // If the response reflects the EXPANDED value, the parser processes
  // entities → XXE-capable parser.
  const internalPayload = `<?xml version="1.0"?><!DOCTYPE r [<!ENTITY dmxxe "DMXXE123">]><r>&dmxxe;</r>`;
  const first = await postXml(internalPayload);
  if (first.text.includes('DMXXE123')) {
    const idx = first.text.indexOf('DMXXE123');
    const window = first.text.slice(Math.max(0, idx - 60), idx + 80);
    findings.push({
      class: 'xxe',
      id: 'xxe-entity-expansion',
      title: 'XML external entity (XXE) — entity expansion',
      severity: 'high',
      url,
      evidence: {
        request: 'POST application/xml with <!ENTITY dmxxe "DMXXE123">',
        response: `entity expanded in the response — "...${window}..."`,
        impact_demo: 'the XML parser resolves attacker-defined entities',
        signalCorrelated: true,
      },
    });
  }

  // (b) OOB external-entity variant: only when an OOB callback base is
  // available (opts.oobCallback) AND the host is lab-gated. Never targets
  // real files — the entity target is a canary URL only. When a waiter is
  // wired (opts.oobWaitFor — runScan starts the in-process collaborator
  // for lab-gated scans), a callback hit for our token CONFIRMS blind XXE
  // in-scan: the hit record carries oobHit:true so the differential
  // verifier judges it under the SSRF/OOB protocol (differential.js
  // endsWith('oob') guard). No hit → no finding (100% truth rule:
  // unconfirmed stays silent). Without a waiter (an external oobCallback
  // string only) the old honest INFO record stands — dispatched,
  // confirmation out-of-band. Same shape as saml.js saml_xxe_oob.
  // The first POST must have reached the target: a transport failure
  // there means the endpoint is down, and waiting up to 8s for a hit
  // that cannot come would only stall the scan (saml.js has the same
  // precondition implicitly — it only runs after an ACS was found).
  if (first.status !== 0 && opts.oobCallback && isLabHost(url, opts)) {
    const token = `xxe-oob-${rand()}`;
    const oobUrl = `${String(opts.oobCallback).replace(/\/+$/, '')}/${token}`;
    const oobPayload = `<?xml version="1.0"?><!DOCTYPE r [<!ENTITY % dmxxe SYSTEM "${oobUrl}"> %dmxxe;]><r>oob-probe</r>`;
    const rOob = await postXml(oobPayload);
    if (typeof opts.oobWaitFor === 'function') {
      const hit = await opts.oobWaitFor(token, opts.oobWaitTimeoutMs || 8000);
      if (hit) {
        findings.push({
          class: 'xxe_oob',
          id: `xxe-oob-${rand()}`,
          title: 'XML external entity (XXE) blind out-of-band — parser fetched the collaborator URL',
          severity: 'high',
          url,
          evidence: {
            request: `POST application/xml with <!ENTITY % dmxxe SYSTEM "${oobUrl}">`,
            response: `external parameter entity → ${oobUrl} sent (status ${rOob.status}); ` +
              `collaborator received ${hit.method} ${hit.path} at ${hit.at} — the parser resolved the external entity`,
            impact_demo: 'Blind XXE: the XML parser fetches attacker-controlled URLs — gateway to SSRF / file disclosure via external entities',
            signalCorrelated: true,
            oobHit: true,
          },
        });
      }
    } else {
      findings.push({
        class: 'xxe_oob_sent',
        id: `xxe-oob-${rand()}`,
        title: 'XXE OOB probe dispatched (external parameter entity) — confirm via collaborator',
        severity: 'info',
        url,
        evidence: {
          request: `POST application/xml with <!ENTITY % dmxxe SYSTEM "${oobUrl}">`,
          response: `external parameter entity → ${oobUrl} sent (status ${rOob.status}; canary URL only, no file targets); ` +
            `confirm out-of-band via the collaborator`,
          impact_demo: 'An OOB hit proves external-entity resolution (blind XXE)',
          signalCorrelated: true,
        },
      });
    }
  }

  return findings;
}
