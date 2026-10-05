/**
 * ldapRootDseHarvester.js — LDAP rootDSE harvester and vendor fingerprinter.
 *
 * Analyzes a captured LDAP rootDSE search response (the anonymous base-scope
 * query for "" with attribute *) returned by the directory harness and
 * extracts naming contexts, supported controls, SASL mechanisms, features,
 * and the vendor implementation. This module never opens an LDAP connection
 * itself: it only parses data that was already collected during an
 * authorized bug-bounty hunt.
 */

/**
 * Well-known LDAP control OIDs mapped to friendly names.
 */
const CONTROL_OIDS = {
  '1.2.840.113556.1.4.319': 'AD paged results (LDAP_PAGED_RESULT)',
  '1.2.840.113556.1.4.473': 'AD server-side sort',
  '1.2.840.113556.1.4.417': 'AD show deleted objects',
  '1.2.840.113556.1.4.474': 'AD matched-DN / extended DN',
  '1.2.840.113556.1.4.801': 'AD SD flags',
  '1.2.840.113556.1.4.1339': 'AD dynamic objects',
  '1.2.840.113556.1.4.529': 'AD extended DN',
  '1.3.6.1.4.1.4203.1.10.1': 'subentries (RFC 3672)',
  '1.3.6.1.4.1.4203.1.11.1': 'password policy state (OpenLDAP ppolicy)',
  '1.3.6.1.4.1.4203.1.11.3': 'password policy control',
  '1.2.826.0.1.3344810.2.3': 'virtual list view (VLV)',
  '1.3.6.1.1.8': 'cancel operation (RFC 3909)',
  '1.3.6.1.4.1.1466.29539.12': 'assertion control (RFC 4528)',
  '1.3.6.1.4.1.42.2.27.9.5.2': 'virtual list view (Sun/Oracle DS)',
  '1.3.6.1.4.1.42.2.27.9.5.8': 'persistent search (Sun/Oracle DS)',
  '2.16.840.1.113894.1.8.2': 'persistent search (Netscape)',
  '2.16.840.1.113730.3.4.9': 'VLV request (Netscape)',
  '2.16.840.1.113730.3.4.10': 'VLV response (Netscape)',
  '1.2.840.113556.1.4.805': 'AD tree delete',
  '1.2.840.113556.1.4.841': 'AD dirsync',
  '2.16.840.1.113730.3.4.18': 'manage DSA IT (RFC 3296)',
  '1.3.6.1.1.13.1': 'pre-read control (RFC 4527)',
  '1.3.6.1.1.13.2': 'post-read control (RFC 4527)',
};

const VENDOR_MARKERS = [
  { match: /forestfunctionality|domainfunctionality|domaincontrollerfunctionality/i, vendor: 'Microsoft Active Directory', confidence: 'high' },
  { match: /ntsecurityguid/i, vendor: 'Microsoft Active Directory', confidence: 'high' },
  { match: /^389|red hat directory|389 directory server/i, vendor: '389 Directory Server', confidence: 'high' },
  { match: /openldap/i, vendor: 'OpenLDAP', confidence: 'high' },
  { match: /netiq|novell|edir/i, vendor: 'NetIQ eDirectory', confidence: 'high' },
  { match: /sun|oracle unified directory|opendj/i, vendor: 'Oracle/Sun Directory Server', confidence: 'medium' },
  { match: /apache ?ds|apacheds/i, vendor: 'ApacheDS', confidence: 'high' },
];

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Detect the directory vendor from rootDSE attributes.
 * @param {Object} attributes RootDSE attribute map (lowercased names → values).
 */
function detectVendor(attributes, rawAttributes) {
  const attrNames = Object.keys(attributes);
  const vendorValues = asArray(rawAttributes.vendorName).join(' ');
  for (const marker of VENDOR_MARKERS) {
    if (marker.match.test(vendorValues)) {
      return { vendor: marker.vendor, confidence: marker.confidence, evidence: `vendorName: ${vendorValues}` };
    }
    if (attrNames.some((name) => marker.match.test(name))) {
      return { vendor: marker.vendor, confidence: marker.confidence, evidence: `vendor-specific attribute present: ${attrNames.find((n) => marker.match.test(n))}` };
    }
  }
  const dn = asArray(rawAttributes.supportedDN || attributes.supporteddn).join(' ');
  if (/cn=schema|cn=configuration/i.test(dn)) {
    return { vendor: 'Microsoft Active Directory', confidence: 'medium', evidence: 'AD-style configuration/schema naming contexts' };
  }
  return { vendor: 'Unknown', confidence: 'low', evidence: 'No vendor marker matched' };
}

/**
 * Harvest a parsed LDAP rootDSE response.
 *
 * @param {{ attributes: Record<string, string|string[]>, dn?: string }} input
 *   attributes — rootDSE attribute map as parsed from an LDIF/search entry
 *   (attribute names may be any case; values single or multi-valued).
 * @returns structured vendor, capability and finding data.
 */
export function harvestRootDse({ attributes = {}, dn = '' } = {}) {
  const normalized = {};
  for (const [name, value] of Object.entries(attributes)) {
    normalized[name.toLowerCase()] = asArray(value);
  }

  const get = (name) => normalized[name.toLowerCase()] || [];

  const namingContexts = get('namingcontexts');
  const controls = get('supportedcontrol').map((oid) => ({
    oid,
    name: CONTROL_OIDS[oid] || 'Unknown control',
  }));
  const saslMechanisms = get('supportedsaslmechanisms');
  const features = get('supportedfeatures');
  const ldapVersions = get('supportedldapversion');
  const vendor = detectVendor(normalized, attributes);

  const findings = [];

  if (namingContexts.length > 0) {
    findings.push({
      type: 'Naming contexts exposed',
      severity: 'Info',
      confidence: 'high',
      cwe: 'CWE-200',
      evidence: `rootDSE lists ${namingContexts.length} naming context(s): ${namingContexts.slice(0, 5).join(', ')}${namingContexts.length > 5 ? '…' : ''}`,
      recommendation: 'Naming contexts aid enumeration; restrict anonymous rootDSE reads where the directory policy allows.',
    });
  }

  if (controls.length > 0) {
    const adOnly = controls.filter((c) => c.name.startsWith('AD '));
    findings.push({
      type: 'Supported controls enumerated',
      severity: 'Info',
      confidence: 'high',
      evidence: `${controls.length} control OID(s) advertised${adOnly.length ? `, including ${adOnly.length} Active Directory-specific control(s)` : ''}.`,
      recommendation: 'Control lists reveal server capabilities; pair with anonymous-bind policy review.',
    });
  }

  if (saslMechanisms.length > 0 && !saslMechanisms.some((m) => /gssapi|external/i.test(m))) {
    findings.push({
      type: 'Weak SASL mechanisms advertised',
      severity: 'Low',
      confidence: 'medium',
      cwe: 'CWE-287',
      evidence: `Server advertises: ${saslMechanisms.join(', ')}.`,
      recommendation: 'Prefer GSSAPI/EXTERNAL with TLS; disable plaintext credential mechanisms.',
    });
  }

  if (!ldapVersions.includes('3') && ldapVersions.length > 0) {
    findings.push({
      type: 'LDAPv2 advertised',
      severity: 'Low',
      confidence: 'medium',
      cwe: 'CWE-327',
      evidence: `supportedLDAPVersion: ${ldapVersions.join(', ')}.`,
      recommendation: 'LDAPv2 lacks modern security controls; enforce LDAPv3.',
    });
  }

  return {
    dn: dn || '<rootDSE>',
    vendor: vendor.vendor,
    vendorConfidence: vendor.confidence,
    vendorEvidence: vendor.evidence,
    namingContexts,
    supportedControls: controls,
    supportedSaslMechanisms: saslMechanisms,
    supportedFeatures: features,
    supportedLdapVersions: ldapVersions,
    vendorName: asArray(attributes.vendorName || attributes.vendorname),
    findings,
  };
}

export const LDAP_ROOTDSE_HARVESTER = { harvestRootDse, CONTROL_OIDS };
export default LDAP_ROOTDSE_HARVESTER;
