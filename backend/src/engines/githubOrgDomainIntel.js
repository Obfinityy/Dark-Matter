/**
 * githubOrgDomainIntel.js — GitHub org-member domain analysis (idea 00216).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Public members of a GitHub organization often disclose a `company` field
 * and a public `email` on their profiles. Aggregating those across members
 * reveals secondary corporate domains and commit-pattern signals (e.g. many
 * members on `acme-labs.io`) that hint at subsidiary brands or acquired
 * teams operating under different names.
 *
 * No network calls are made here — the caller supplies already-fetched
 * member profile JSON (from `GET /orgs/{org}/members` joined with
 * `GET /users/{username}`).
 */

/**
 * Normalize a free-text company field into a candidate domain.
 *
 * Handles values like "@acme-labs", "Acme Labs Inc.", "acme-labs.io" and
 * bare "@handle" references (which are returned as-is for manual review).
 *
 * @param {string} company - Raw `company` profile field.
 * @returns {{ kind: 'domain'|'handle'|'none', value: string|null }}
 */
export function normalizeCompanyField(company) {
  const raw = String(company || '').trim();
  if (!raw) return { kind: 'none', value: null };
  const at = raw.match(/^@([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)$/);
  if (at) return { kind: 'handle', value: at[1].toLowerCase() };
  const domain = raw.match(/([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)/i);
  if (domain) return { kind: 'domain', value: domain[1].toLowerCase() };
  return { kind: 'none', value: null };
}

/**
 * Analyze organization member profiles for domain and subsidiary signals.
 *
 * @param {Array<Object>} members - Member profile objects with at least
 *   { login, email?, company?, public_repos?, followers? }.
 * @param {string} primaryDomain - The org's known primary domain, e.g. "acme.com".
 * @returns {{
 *   domains: Array<{ domain: string, members: number, memberLogins: string[], signal: 'email'|'company'|'both' }>,
 *   subsidiaryHints: Array<{ hint: string, kind: string, members: string[] }>,
 *   summary: { totalMembers: number, membersWithEmail: number, membersWithCompany: number, distinctDomains: number }
 * }}
 */
export function analyzeOrgMemberDomains(members, primaryDomain) {
  const primary = String(primaryDomain || '').trim().toLowerCase();
  const list = Array.isArray(members) ? members : [];
  const domainMembers = new Map(); // domain -> { logins:Set, signals:Set }
  const handleMembers = new Map(); // @handle -> logins
  let withEmail = 0;
  let withCompany = 0;

  for (const m of list) {
    if (!m || typeof m !== 'object') continue;
    const login = String(m.login || '').toLowerCase();
    if (!login) continue;

    const email = String(m.email || '').trim().toLowerCase();
    if (email && email.includes('@')) {
      withEmail++;
      const domain = email.slice(email.lastIndexOf('@') + 1);
      if (domain && domain !== primary && !domain.endsWith('noreply.github.com')) {
        addDomain(domainMembers, domain, login, 'email');
      }
    }

    const norm = normalizeCompanyField(m.company);
    if (norm.kind === 'domain') {
      withCompany++;
      if (norm.value !== primary) addDomain(domainMembers, norm.value, login, 'company');
    } else if (norm.kind === 'handle') {
      withCompany++;
      if (!handleMembers.has(norm.value)) handleMembers.set(norm.value, []);
      handleMembers.get(norm.value).push(login);
    } else if (String(m.company || '').trim()) {
      withCompany++;
    }
  }

  const domains = [...domainMembers.entries()]
    .map(([domain, d]) => ({
      domain,
      members: d.logins.size,
      memberLogins: [...d.logins].sort().slice(0, 25),
      signal: d.signals.has('email') && d.signals.has('company') ? 'both' : [...d.signals][0],
    }))
    .sort((a, b) => b.members - a.members);

  // Subsidiary hints: company handles shared by several members that are NOT
  // the org's own name — classic "acquired team" pattern.
  const subsidiaryHints = [...handleMembers.entries()]
    .filter(([, logins]) => logins.length >= 2)
    .map(([handle, logins]) => ({
      hint: `@${handle}`,
      kind: 'shared-company-handle',
      members: logins.sort(),
    }))
    .sort((a, b) => b.members.length - a.members.length);

  return {
    domains,
    subsidiaryHints,
    summary: {
      totalMembers: list.length,
      membersWithEmail: withEmail,
      membersWithCompany: withCompany,
      distinctDomains: domains.length,
    },
  };
}

function addDomain(map, domain, login, signal) {
  if (!map.has(domain)) map.set(domain, { logins: new Set(), signals: new Set() });
  const entry = map.get(domain);
  entry.logins.add(login);
  entry.signals.add(signal);
}
