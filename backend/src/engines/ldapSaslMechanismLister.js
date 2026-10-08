/**
 * ldapSaslMechanismLister.js — LDAP SASL mechanism / rootDSE fingerprinting.
 *
 * Querying the LDAP rootDSE (empty base object) reveals supportedSASLMechanisms,
 * vendorName, vendorVersion, supportedLDAPVersion, and namingContexts.
 * An authorized agent uses these to fingerprint the directory server
 * implementation (Active Directory vs OpenLDAP vs 389-ds vs FreeIPA).
 *
 * Defensive framing: analysis of directory-service banners obtained from
 * authorized rootDSE reads. Read-only; no binds, no modification attempts.
 */

const SASL_MECHANISMS = {
  PLAIN: { name: 'PLAIN', note: 'Cleartext credentials on the wire unless TLS wraps the session.' },
  LOGIN: { name: 'LOGIN', note: 'Cleartext credentials on the wire unless TLS wraps the session.' },
  GSSAPI: { name: 'GSSAPI', note: 'Kerberos-backed — the expected mechanism for AD.' },
  'GSS-SPNEGO': { name: 'GSS-SPNEGO', note: 'Negotiated Kerberos/NTLM wrapper.' },
  DIGEST_MD5: { name: 'DIGEST-MD5', note: 'Deprecated; collision-prone hashing.' },
  CRAM_MD5: { name: 'CRAM-MD5', note: 'Deprecated challenge-response; offline-attackable.' },
  'SCRAM-SHA-1': { name: 'SCRAM-SHA-1', note: 'Modern salted challenge-response.' },
  'SCRAM-SHA-256': { name: 'SCRAM-SHA-256', note: 'Modern salted challenge-response.' },
  EXTERNAL: { name: 'EXTERNAL', note: 'TLS client-certificate based.' },
  ANONYMOUS: { name: 'ANONYMOUS', note: 'Anonymous bind permitted by the server.' },
};

const WEAK_MECHANISMS = new Set(['PLAIN', 'LOGIN', 'DIGEST-MD5', 'CRAM-MD5']);

/**
 * Fingerprint a directory server from an observed rootDSE record.
 *
 * @param {Object} input
 * @param {string} [input.server] - Host observed.
 * @param {string[]} [input.supportedSASLMechanisms] - supportedSASLMechanisms values.
 * @param {string} [input.vendorName] - vendorName attribute.
 * @param {string} [input.vendorVersion] - vendorVersion attribute.
 * @param {string[]} [input.namingContexts] - namingContexts values.
 * @param {number[]} [input.supportedLDAPVersion] - supportedLDAPVersion values.
 * @param {string} [input.rootDomainNamingContext] - rootDomainNamingContext (AD-specific).
 * @returns {Object} Fingerprint finding.
 */
export function fingerprintDirectoryServer({
  server = '',
  supportedSASLMechanisms = [],
  vendorName = '',
  vendorVersion = '',
  namingContexts = [],
  supportedLDAPVersion = [],
  rootDomainNamingContext = '',
} = {}) {
  const mechanisms = supportedSASLMechanisms
    .map(m => String(m).toUpperCase())
    .filter(m => m.length > 0);

  let implementation = 'Unknown directory server';
  let confidence = 'low';
  const evidenceBits = [];

  if (/active directory|microsoft/i.test(vendorName) || rootDomainNamingContext) {
    implementation = 'Microsoft Active Directory';
    confidence = 'high';
    evidenceBits.push('AD-specific rootDomainNamingContext present');
  } else if (/openldap/i.test(vendorName)) {
    implementation = 'OpenLDAP';
    confidence = 'high';
    evidenceBits.push(`vendorName="${vendorName}"`);
  } else if (/389|red hat|redhat/i.test(vendorName)) {
    implementation = '389 Directory Server / Red Hat DS';
    confidence = 'high';
    evidenceBits.push(`vendorName="${vendorName}"`);
  } else if (
    mechanisms.includes('GSSAPI') &&
    namingContexts.some(nc => /dc=/i.test(nc)) &&
    !mechanisms.includes('ANONYMOUS')
  ) {
    implementation = 'Likely Active Directory (GSSAPI + domain-style naming contexts)';
    confidence = 'medium';
    evidenceBits.push('GSSAPI offered, no anonymous bind, dc= naming contexts');
  }
  if (vendorVersion) evidenceBits.push(`vendorVersion="${vendorVersion}"`);

  const weakMechanisms = mechanisms.filter(m => WEAK_MECHANISMS.has(m));
  const findings = [];
  if (weakMechanisms.length) {
    findings.push({
      type: 'LDAP SASL Mechanism Listing',
      severity: 'Medium',
      confidence: 'high',
      cwe: 'CWE-319',
      evidence: `Directory server at ${server || 'target'} offers weak SASL mechanism(s): ${weakMechanisms.join(', ')} — cleartext or deprecated credential protection.`,
      mechanisms: weakMechanisms,
    });
  }
  if (mechanisms.includes('ANONYMOUS')) {
    findings.push({
      type: 'LDAP SASL Mechanism Listing',
      severity: 'Low',
      confidence: 'high',
      cwe: 'CWE-862',
      evidence: `Directory server at ${server || 'target'} permits SASL ANONYMOUS binds — information exposure risk via unauthenticated rootDSE/DSE reads.`,
    });
  }

  return {
    type: 'LDAP SASL Mechanism Listing',
    fingerprinted: confidence !== 'low',
    confidence,
    evidence: `${implementation} at ${server || 'target'} — ${mechanisms.length} SASL mechanism(s) observed (${mechanisms.join(', ') || 'none disclosed'}).${evidenceBits.length ? ' ' + evidenceBits.join('; ') + '.' : ''}`,
    implementation,
    vendorName: vendorName || undefined,
    vendorVersion: vendorVersion || undefined,
    mechanisms: mechanisms.map(m => ({
      name: m,
      note: (SASL_MECHANISMS[m] || {}).note || 'Unrecognized mechanism.',
    })),
    namingContexts,
    supportedLDAPVersion,
    findings,
  };
}

export const LDAP_SASL_MECHANISM_LISTER = {
  fingerprintDirectoryServer,
  SASL_MECHANISMS,
};
export default LDAP_SASL_MECHANISM_LISTER;
