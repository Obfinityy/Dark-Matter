/**
 * rpIntel.js — RP record contact mining (idea 00088).
 *
 * Defensive admin-contact OSINT for an authorized bug-bounty agent.
 * RP records (RFC 1183) publish a responsible person's mailbox name and
 * a "more info" hostname per DNS name: `<mbox-dname> <more-info-dname>`.
 * The mailbox names are admin identities — valid pivots for OSINT
 * (role accounts vs named individuals, naming conventions) during an
 * authorized assessment. No contact is made; this is passive discovery.
 *
 * Passive DNS lookups only. Use against operator-authorized targets only.
 */

/**
 * Convert an RP mbox-dname to a conventional email address.
 * Dots in the mbox name represent the local part with `@` replaced by `.`
 * per RFC 1183 §2.2 (e.g. "hostmaster.example.com" → "hostmaster@example.com").
 *
 * @param {string} mboxDname owner-name-style domain, e.g. "admin.example.com"
 * @returns {string|null} email address or null when not parseable
 */
export function mboxToEmail(mboxDname) {
  const clean = String(mboxDname || '')
    .trim()
    .replace(/\.$/, '');
  if (!clean || clean === '.') return null;
  const labels = clean.split('.');
  if (labels.length < 3) return null;
  const local = labels[0];
  const domain = labels.slice(1).join('.');
  if (!/^[A-Za-z0-9._%+-]+$/.test(local) || !/^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(domain))
    return null;
  return `${local}@${domain}`;
}

/**
 * Parse an RP rdata string (RFC 1183 §2.2): `<mbox-dname> <txt-dname>`.
 * The special mbox name "." means "no responsible person listed".
 *
 * @param {string} rdata e.g. "admin.example.com. more-info.example.com."
 * @returns {{mbox:string, moreInfo:string, email:string|null, listed:boolean}|null}
 */
export function parseRpRecord(rdata) {
  const parts = String(rdata || '')
    .trim()
    .split(/\s+/);
  if (parts.length < 2) return null;
  const mbox = parts[0].replace(/\.$/, '').toLowerCase();
  const moreInfo = parts[1].replace(/\.$/, '').toLowerCase();
  const listed = mbox !== '.';
  return { mbox, moreInfo, email: listed ? mboxToEmail(mbox) : null, listed };
}

/**
 * Classify a discovered admin mailbox as a role account or a named person,
 * for OSINT prioritization.
 *
 * @param {string} email
 * @returns {'role-account'|'named-person'|'unknown'}
 */
export function classifyContact(email) {
  const local = String(email || '')
    .split('@')[0]
    .toLowerCase();
  if (!local) return 'unknown';
  const roleNames = [
    'hostmaster',
    'admin',
    'administrator',
    'webmaster',
    'postmaster',
    'noc',
    'security',
    'abuse',
    'info',
    'support',
    'ops',
    'sysadmin',
    'dns',
    'network',
  ];
  if (roleNames.includes(local)) return 'role-account';
  if (/^[a-z]+\.[a-z]+$/.test(local) || /^[a-z]{2,}[0-9]{0,4}$/.test(local)) return 'named-person';
  return 'unknown';
}

/**
 * Idea 00088 — extract responsible-person contacts from RP records and
 * produce OSINT pivot notes.
 *
 * @param {string} domain the domain the RP records were found under
 * @param {string[]} records raw RP rdata strings
 * @returns {{domain:string, present:boolean, contacts:Array<{email:string|null, moreInfo:string, kind:string}>, findings:Array<{severity:string,type:string,detail:string}>}}
 */
export function mineRpContacts(domain, records) {
  const d = String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
  const findings = [];
  const parsed = (records || [])
    .map(parseRpRecord)
    .filter(Boolean)
    .filter(p => p.listed);
  const seen = new Set();
  const contacts = [];
  for (const p of parsed) {
    const key = `${p.email || p.mbox}|${p.moreInfo}`;
    if (seen.has(key)) continue;
    seen.add(key);
    contacts.push({
      email: p.email,
      mbox: p.mbox,
      moreInfo: p.moreInfo,
      kind: classifyContact(p.email),
    });
  }
  if (contacts.length === 0) return { domain: d, present: false, contacts, findings };
  findings.push({
    severity: 'info',
    type: 'rp-contacts-mined',
    detail: `${contacts.length} responsible-person contact(s) mined from RP records under ${d}: ${contacts.map(c => c.email || c.mbox).join(', ')} — use for passive OSINT pivoting only (naming conventions, role vs named accounts); never contact them outside the assessment's rules of engagement.`,
  });
  const named = contacts.filter(c => c.kind === 'named-person');
  if (named.length > 0) {
    findings.push({
      severity: 'low',
      type: 'rp-named-person-exposed',
      detail: `RP records name individual people (${named.map(c => c.email).join(', ')}) rather than role accounts — named contacts are higher-value OSINT pivots and a mild information exposure; recommend switching to role accounts.`,
    });
  }
  const moreInfos = [...new Set(contacts.map(c => c.moreInfo).filter(m => m && m !== '.'))];
  if (moreInfos.length > 0) {
    findings.push({
      severity: 'info',
      type: 'rp-more-info-hosts',
      detail: `RP "more info" hostnames: ${moreInfos.join(', ')} — these often point at internal documentation or ticketing hosts worth including in the asset inventory.`,
    });
  }
  return { domain: d, present: true, contacts, findings };
}
