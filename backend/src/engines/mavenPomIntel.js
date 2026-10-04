/**
 * mavenPomIntel.js — Maven Central POM URL mining (idea 00227).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Parses Maven POM XML (`pom.xml` / effective POM) for organization-owned
 * hosts: `project.url`, `scm.connection` / `scm.developerConnection` /
 * `scm.url`, `distributionManagement` repository URLs, and
 * `organization.url`. Parsing is regex-based (no new npm dependencies) and
 * tolerant of namespaces and partial documents. Useful only against targets
 * the operator is authorized to assess.
 */

/**
 * Normalize a URL/host/scm-connection string to a hostname; null when
 * unusable or when it is Maven Central / well-known public infrastructure.
 * @param {string} value
 * @returns {string|null}
 */
export function toHost(value) {
  if (!value) return null;
  let s = String(value).trim().replace(/^['"]|['"]$/g, '');
  if (/^(mailto|tel):/i.test(s)) return null;
  // scm:git:git://host/org/repo.git / scm:git:ssh://git@host/...
  const scm = s.match(/^scm:[a-z0-9]+:((?:git\+)?[a-z][a-z0-9+.-]*:\/\/[^\s]+)$/i);
  if (scm) s = scm[1];
  s = s.replace(/^git@/i, 'https://');
  const scp = s.match(/^([A-Za-z0-9][A-Za-z0-9.-]*):[\w.~/-]+$/);
  if (scp && !/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return scp[1].toLowerCase();
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    const h = u.hostname.toLowerCase();
    if (!h || h === 'localhost') return null;
    if (/\.?maven\.org$/.test(h) || /\.sonatype\.com$/.test(h) || /\.apache\.org$/.test(h)) return null;
    if (/\.github\.com$/.test(h) || /\.gitlab\.com$/.test(h)) return null;
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(h)) return null;
    return h;
  } catch {
    return null;
  }
}

/**
 * Extract the inner text of simple XML elements by tag name.
 * Namespace-agnostic: matches `<prefix:tag>` and `<tag>`.
 * @param {string} xml
 * @param {string} tag
 * @returns {string[]}
 */
export function xmlTagValues(xml, tag) {
  const out = [];
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`, 'gi');
  let m;
  while ((m = re.exec(String(xml || ''))) !== null) {
    const v = m[1].replace(/<[^>]+>/g, '').trim();
    if (v) out.push(v);
  }
  return out;
}

/**
 * Idea 00227 — mine org hosts from a Maven POM document.
 *
 * Reads `project/url`, `organization/url`, `scm/connection`,
 * `scm/developerConnection`, `scm/url`, and every `repository/url` /
 * `pluginRepository/url` under `distributionManagement` and `repositories`
 * (internal artifact mirrors are common findings).
 *
 * @param {string} pomXml - Raw POM XML text.
 * @returns {{ artifact: {groupId: string|null, artifactId: string|null}, hosts: Array<{host: string, provenance: string, detail?: string}> }}
 */
export function parseMavenPomHosts(pomXml) {
  const hits = [];
  const seen = new Set();
  const add = (host, provenance, detail) => {
    if (!host || seen.has(`${host}|${provenance}`)) return;
    seen.add(`${host}|${provenance}`);
    hits.push({ host, provenance, ...(detail ? { detail } : {}) });
  };

  const xml = String(pomXml || '');
  const groupId = xmlTagValues(xml, 'groupId')[0] || null;
  const artifactId = xmlTagValues(xml, 'artifactId')[0] || null;

  const projectUrls = xmlTagValues(xml, 'url').slice(0, 1); // first bare <url> is project.url
  for (const u of projectUrls) {
    const host = toHost(u);
    if (host) add(host, 'project.url', u);
  }
  // organization/url — pull from the organization block only
  const orgBlock = xml.match(/<(?:[\w-]+:)?organization\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?organization>/i);
  if (orgBlock) {
    for (const u of xmlTagValues(orgBlock[1], 'url')) {
      const host = toHost(u);
      if (host) add(host, 'organization.url', u);
    }
  }
  // scm block
  const scmBlock = xml.match(/<(?:[\w-]+:)?scm\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?scm>/i);
  if (scmBlock) {
    for (const tag of ['connection', 'developerConnection', 'url']) {
      for (const v of xmlTagValues(scmBlock[1], tag)) {
        const host = toHost(v);
        if (host) add(host, `scm.${tag}`, v);
      }
    }
  }
  // distributionManagement + repositories + pluginRepositories urls
  for (const v of xmlTagValues(xml, 'url')) {
    // skip the project.url already handled (first occurrence) — dedupe via seen-set instead
    const host = toHost(v);
    if (host) add(host, 'repository.url', v);
  }

  return { artifact: { groupId, artifactId }, hosts: hits };
}

/**
 * Build Maven Central fetch targets for a GAV coordinate.
 * @param {string} groupId
 * @param {string} artifactId
 * @param {string} [version='release']
 */
export function mavenPomTargets(groupId, artifactId, version = 'release') {
  const g = String(groupId).replace(/\./g, '/');
  const base = `https://repo1.maven.org/maven2/${g}/${artifactId}`;
  if (version === 'release') return [`${base}/maven-metadata.xml`];
  return [`${base}/${version}/${artifactId}-${version}.pom`];
}
