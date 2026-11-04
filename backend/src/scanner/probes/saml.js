// Dark Matter rule-based scanner — SAML 2.0 ACS probe.
// Tests Assertion Consumer Service endpoints for unsigned-response acceptance
// (authentication bypass), conditions enforcement (expired / wrong-audience),
// RelayState open redirect, and metadata exposure. Every CONFIRMED verdict
// sits behind a differential oracle per the 100% truth rule. The probe NEVER
// forges a real IdP session, never touches a live IdP, never follows
// redirects: ACS POSTs only, per-run canary NameIDs, tamper-and-observe.
// v1 honest limits (documented in docs/scanner/saml.md): T2 XML Signature
// Wrapping needs real XML-DSig (C14N) — pending; T3 XXE-OOB needs a listener.

import zlib from 'node:zlib';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

// Known ACS / metadata paths
const ACS_PATHS = [
  '/saml/acs',
  '/sso/acs',
  '/saml2/acs',
  '/Shibboleth.sso/SAML2/POST',
  '/acs',
];
const METADATA_PATHS = [
  '/saml/metadata',
  '/metadata/saml',
  '/.well-known/saml-metadata',
];

// Bundle strings that hint at SAML usage (passive detection)
const SAML_BUNDLE_PATTERNS = [
  /SAMLResponse/i,
  /SAMLRequest/i,
  /\/saml\/acs/i,
  /\/sso\/acs/i,
  /Shibboleth\.sso/i,
  /RelayState/i,
  /urn:oasis:names:tc:SAML/i,
];

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function evidenceBase(note, impact) {
  return {
    request: `POST <acs-endpoint> SAMLResponse=<deflate+base64 canary assertion> [& RelayState=<canary>] (redirects NOT followed)`,
    response: note,
    impact_demo: impact,
    signalCorrelated: true,
  };
}

export function matchSamlBundleHints(text) {
  const hits = [];
  for (const re of SAML_BUNDLE_PATTERNS) {
    if (re.test(text)) hits.push(re.source);
  }
  return hits;
}

// Build a minimal unsigned SAMLResponse (deflate + base64). All identities are
// per-run canaries — never a real user.
export function buildSamlResponse({ nameId, audience, notOnOrAfter, issuer }) {
  const id = `_${rand()}${Date.now().toString(36)}`;
  const now = new Date();
  const noa = notOnOrAfter || new Date(now.getTime() + 5 * 60 * 1000).toISOString();
  const xml =
    `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ` +
    `xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="${id}" Version="2.0" ` +
    `IssueInstant="${now.toISOString()}">` +
    `<saml:Issuer>${issuer || 'https://dm-probe.invalid/idp'}</saml:Issuer>` +
    `<samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>` +
    `<saml:Assertion ID="${id}-a" Version="2.0" IssueInstant="${now.toISOString()}">` +
    `<saml:Issuer>${issuer || 'https://dm-probe.invalid/idp'}</saml:Issuer>` +
    `<saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified">${nameId}</saml:NameID>` +
    `<saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"/></saml:Subject>` +
    `<saml:Conditions NotBefore="${new Date(now.getTime() - 5 * 60 * 1000).toISOString()}" NotOnOrAfter="${noa}">` +
    `<saml:AudienceRestriction><saml:Audience>${audience}</saml:Audience></saml:AudienceRestriction>` +
    `</saml:Conditions>` +
    `<saml:AuthnStatement AuthnInstant="${now.toISOString()}"/>` +
    `</saml:Assertion></samlp:Response>`;
  return zlib.deflateRawSync(Buffer.from(xml, 'utf8')).toString('base64');
}

// POST a SAMLResponse to the ACS without following redirects.
// Returns {status, setCookie, location, body}.
export async function postSamlResponse(acsUrl, samlResponse, opts = {}) {
  const timeoutMs = opts.timeoutMs || 5000;
  const params = new URLSearchParams({ SAMLResponse: samlResponse });
  if (opts.relayState) params.set('RelayState', opts.relayState);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(acsUrl, {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      redirect: 'manual', // NEVER follow — read headers and stop
      signal: ctrl.signal,
    });
    const body = await res.text().catch(() => '');
    return {
      status: res.status,
      setCookie: res.headers.get('set-cookie') || '',
      location: res.headers.get('location') || '',
      body: body.slice(0, 4000),
    };
  } catch {
    return { status: 0, setCookie: '', location: '', body: '' };
  } finally {
    clearTimeout(timer);
  }
}

// Did the ACS grant a session for our canary? Session = session-like
// Set-Cookie OR the canary NameID rendered in the body/location.
function sessionGranted(r, canary) {
  const cookieHit = /set-cookie/i.test('set-cookie') && /(session|sess|auth|token|sid)/i.test(r.setCookie) && r.setCookie.length > 10;
  const canaryHit = (r.body + ' ' + r.location).includes(canary);
  return cookieHit || canaryHit;
}

// GET metadata discovery. Returns {acsUrl, entityId} or null.
export async function discoverSamlMetadata(baseUrl, opts = {}) {
  const timeoutMs = opts.timeoutMs || 5000;
  let base;
  try { base = new URL(baseUrl); } catch { return null; }
  const origin = `${base.protocol}//${base.host}`;
  for (const p of METADATA_PATHS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(origin + p, {
        headers: { 'User-Agent': UA, Accept: 'application/xml,text/xml' },
        signal: ctrl.signal,
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const m = xml.match(/AssertionConsumerService[^>]*Location="([^"]+)"/i);
      const e = xml.match(/entityID="([^"]+)"/i);
      if (m) return { acsUrl: m[1], entityId: e ? e[1] : null, metadataUrl: origin + p };
    } catch { /* try next */ } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

async function findAcsEndpoint(url, opts) {
  const timeoutMs = opts.timeoutMs || 5000;
  let base;
  try { base = new URL(url); } catch { return null; }
  const origin = `${base.protocol}//${base.host}`;
  const canary = `DarkMatterProbe-${rand()}`;
  for (const p of ACS_PATHS) {
    const acs = origin + p;
    const sr = buildSamlResponse({ nameId: canary, audience: origin });
    const r = await postSamlResponse(acs, sr, { timeoutMs });
    // A live ACS answers with redirect/session/error — not connection failure.
    // 404/405 silence = not an ACS.
    if (r.status !== 0 && r.status !== 404 && r.status !== 405) return acs;
  }
  return null;
}

export async function probeSaml(url, opts = {}) {
  const findings = [];
  const timeoutMs = opts.timeoutMs || 5000;
  const depth = opts.depth || 'standard';
  const canary = `DarkMatterProbe-${rand()}`;

  let baseU;
  try { baseU = new URL(url); } catch { return findings; }
  const origin = `${baseU.protocol}//${baseU.host}`;

  // ---- Discovery: SAML metadata (INFO) ----
  const meta = await discoverSamlMetadata(url, { timeoutMs });
  if (meta) {
    findings.push({
      class: 'saml_metadata_exposed',
      id: `saml-meta-${rand()}`,
      title: 'SAML SP metadata exposed — ACS endpoint enumerated',
      severity: 'info',
      url: meta.metadataUrl,
      parameter: 'AssertionConsumerService',
      evidence: evidenceBase(
        `metadata at ${meta.metadataUrl} → ACS=${meta.acsUrl}; entityID=${meta.entityId || 'n/a'}`,
        'Attackers enumerate the ACS for targeted assertion attacks'
      ),
    });
  }

  // ---- Find a live ACS endpoint ----
  const acsUrl = meta?.acsUrl || await findAcsEndpoint(url, { timeoutMs });
  if (!acsUrl) return findings;
  const audience = meta?.entityId || origin;

  // ---- T1: unsigned SAMLResponse accepted — CRITICAL (differential) ----
  const srUnsigned = buildSamlResponse({ nameId: canary, audience });
  const rUnsigned = await postSamlResponse(acsUrl, srUnsigned, { timeoutMs });
  // Control: same payload but garbled audience — if BOTH "succeed", the
  // endpoint is not really processing assertions (static success page).
  const srGarbled = buildSamlResponse({ nameId: canary, audience: `https://garbled.invalid/${rand()}` });
  const rGarbled = await postSamlResponse(acsUrl, srGarbled, { timeoutMs });
  const unsignedOk = sessionGranted(rUnsigned, canary);
  const garbledOk = sessionGranted(rGarbled, canary);
  const unsignedAccepted = unsignedOk && !garbledOk;
  if (unsignedAccepted) {
    findings.push({
      class: 'saml_unsigned_accepted',
      id: `saml-unsigned-${rand()}`,
      title: 'ACS accepts unsigned SAMLResponse — authentication bypass',
      severity: 'critical',
      url: acsUrl,
      parameter: 'SAMLResponse',
      evidence: evidenceBase(
        `unsigned assertion (NameID=${canary}) → session granted (${rUnsigned.status}, cookie=${rUnsigned.setCookie.slice(0, 80)}); garbled-audience control → no session`,
        'Anyone can mint a SAMLResponse for any user — full account takeover, no credentials needed'
      ),
    });
  } else if (unsignedOk && garbledOk) {
    findings.push({
      class: 'saml_not_processing',
      id: `saml-static-${rand()}`,
      title: 'ACS endpoint does not appear to process SAMLResponse (static success)',
      severity: 'info',
      url: acsUrl,
      parameter: 'SAMLResponse',
      evidence: evidenceBase(
        'both valid-audience and garbled-audience assertions returned identical session signals — endpoint is not validating',
        'No bypass proven; endpoint behavior noted for manual review'
      ),
    });
  }

  if (depth === 'quick') {
    // Quick still gets the RelayState check (cheap, high signal).
  } else {
    // ---- T4: conditions enforcement (only meaningful if unsigned accepted) ----
    if (unsignedAccepted) {
      // Expired assertion: NotOnOrAfter 10 min in the past, POST twice.
      const expired = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const srExp1 = buildSamlResponse({ nameId: canary, audience, notOnOrAfter: expired });
      const srExp2 = buildSamlResponse({ nameId: canary, audience, notOnOrAfter: expired });
      const rE1 = await postSamlResponse(acsUrl, srExp1, { timeoutMs });
      const rE2 = await postSamlResponse(acsUrl, srExp2, { timeoutMs });
      if (sessionGranted(rE1, canary) && sessionGranted(rE2, canary)) {
        findings.push({
          class: 'saml_expired_accepted',
          id: `saml-expired-${rand()}`,
          title: 'ACS accepts expired SAML assertion — replay exposure',
          severity: 'medium',
          url: acsUrl,
          parameter: 'NotOnOrAfter',
          evidence: evidenceBase(
            `2x expired assertion (NotOnOrAfter=${expired}) → both granted session for ${canary}`,
            'Stolen assertions never expire — replayable indefinitely'
          ),
        });
      }
      // Wrong audience.
      const srAud = buildSamlResponse({ nameId: canary, audience: 'https://evil.example/' });
      const rAud = await postSamlResponse(acsUrl, srAud, { timeoutMs });
      if (sessionGranted(rAud, canary)) {
        findings.push({
          class: 'saml_audience_ignored',
          id: `saml-aud-${rand()}`,
          title: 'ACS ignores SAML Audience restriction — cross-app assertion accepted',
          severity: 'medium',
          url: acsUrl,
          parameter: 'Audience',
          evidence: evidenceBase(
            'assertion for audience https://evil.example/ → session granted',
            'Assertions minted for other apps are accepted here'
          ),
        });
      }
    }
  }

  // ---- T5: RelayState open redirect ----
  const evilRelay = `https://evil.example/${rand()}`;
  const srRelay = buildSamlResponse({ nameId: canary, audience });
  const rRelay = await postSamlResponse(acsUrl, srRelay, { relayState: evilRelay, timeoutMs });
  const loc = rRelay.location || '';
  if (rRelay.status >= 300 && rRelay.status < 400 && loc.includes('evil.example') && !loc.includes(baseU.host)) {
    const carriesSession = /[?&#](token|session|code|id_token)=/i.test(loc);
    findings.push({
      class: 'saml_relaystate_redirect',
      id: `saml-relay-${rand()}`,
      title: carriesSession
        ? 'ACS reflects RelayState into redirect with session material — open redirect + token leak'
        : 'ACS reflects RelayState into redirect unvalidated — open redirect',
      severity: carriesSession ? 'medium' : 'low',
      url: acsUrl,
      parameter: 'RelayState',
      evidence: evidenceBase(
        `RelayState=${evilRelay} → ${rRelay.status} Location=${loc.slice(0, 200)}`,
        'Phishing-grade open redirect on the SSO callback'
      ),
    });
  }

  return findings;
}
