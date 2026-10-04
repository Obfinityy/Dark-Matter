/**
 * vscodePublisherIntel.js — VS Code marketplace publisher pivoting (idea 00239).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Parses VS Code extension package.json / vsix manifest data (publisher,
 * repository, homepage, bugs, funding) for org hosts so an org's
 * marketplace publisher page can be pivoted into its web properties.
 */

/**
 * Build the VS Code Marketplace item URL for an extension.
 * @param {string} publisher
 * @param {string} name
 */
export function marketplaceItemUrl(publisher, name) {
  return `https://marketplace.visualstudio.com/items?itemName=${encodeURIComponent(String(publisher || ''))}.${encodeURIComponent(String(name || ''))}`;
}

/**
 * Build the publisher's "more extensions" page URL (publisher pivot).
 * @param {string} publisher
 */
export function publisherPageUrl(publisher) {
  return `https://marketplace.visualstudio.com/publishers/${encodeURIComponent(String(publisher || ''))}`;
}

/**
 * Build the Open VSX registry API URL for an extension (alternative registry).
 * @param {string} publisher
 * @param {string} name
 */
export function openVsxApiUrl(publisher, name) {
  return `https://open-vsx.org/api/${encodeURIComponent(String(publisher || ''))}/${encodeURIComponent(String(name || ''))}`;
}

function hostFromUrl(url) {
  try {
    const u = new URL(String(url || '').trim());
    if (!/^https?:$/.test(u.protocol)) return null;
    return u.hostname.toLowerCase();
  } catch { return null; }
}

/**
 * Parse an extension package.json into org host findings.
 * @param {Object} packageJson - Parsed package.json.
 * @returns {{ name, publisher, hosts: Array<{host, kind, provenance}> }}
 */
export function parseExtensionPackageJson(packageJson) {
  const pkg = packageJson || {};
  const hosts = [];
  const seen = new Set();
  const add = (value, kind, provenance) => {
    const host = hostFromUrl(value);
    if (host && !seen.has(host)) { seen.add(host); hosts.push({ host, kind, provenance }); }
  };

  const repo = typeof pkg.repository === 'string' ? pkg.repository : (pkg.repository && pkg.repository.url);
  if (repo) {
    const host = hostFromUrl(repo);
    if (host) {
      const kind = host.includes('github.com') ? 'github-repo-host' : host.includes('gitlab.com') ? 'gitlab-repo-host' : 'repo-host';
      add(repo, kind, 'package.repository');
    } else {
      // git@github.com:org/repo.git style
      const scp = /^[\w.-]+@([a-z0-9.-]+\.[a-z]{2,}):/i.exec(String(repo));
      if (scp && !seen.has(scp[1].toLowerCase())) { seen.add(scp[1].toLowerCase()); hosts.push({ host: scp[1].toLowerCase(), kind: 'repo-host', provenance: 'package.repository(scp)' }); }
    }
  }

  add(pkg.homepage, 'extension-homepage', 'package.homepage');
  add(typeof pkg.bugs === 'string' ? pkg.bugs : (pkg.bugs && pkg.bugs.url), 'issue-tracker', 'package.bugs');

  const funding = Array.isArray(pkg.funding) ? pkg.funding : (pkg.funding ? [pkg.funding] : []);
  for (const f of funding) {
    const url = typeof f === 'string' ? f : f && f.url;
    add(url, 'funding-link', 'package.funding');
  }

  if (pkg.author) {
    const author = typeof pkg.author === 'string' ? pkg.author : pkg.author.name;
    const dm = /@([a-z0-9.-]+\.[a-z]{2,})\s*>?/.exec(String(author || ''));
    if (dm && !seen.has(dm[1].toLowerCase())) {
      seen.add(dm[1].toLowerCase());
      hosts.push({ host: dm[1].toLowerCase(), kind: 'author-domain', provenance: 'package.author' });
    }
  }

  return { name: pkg.name || null, publisher: pkg.publisher || null, hosts };
}

const VSIX_PROP_RE = /<(\w+)\s+[^>]*>([^<]+)<\/\1>/g;

/**
 * Parse VSIX manifest (extension.vsixmanifest XML text) into host findings.
 * @param {string} vsixXml - Raw vsixmanifest XML.
 * @returns {{ identity: Object, hosts: Array<{host, kind, provenance}> }}
 */
export function parseVsixManifest(vsixXml) {
  const text = String(vsixXml || '');
  const props = {};
  let m;
  VSIX_PROP_RE.lastIndex = 0;
  while ((m = VSIX_PROP_RE.exec(text))) props[m[1].toLowerCase()] = m[2].trim();

  const identity = {};
  const idM = /<Identity[^>]*>/i.exec(text);
  if (idM) {
    for (const attr of ['Publisher', 'Id', 'Version']) {
      const a = new RegExp(attr + '\\s*=\\s*"([^"]+)"', 'i').exec(idM[0]);
      if (a) identity[attr.toLowerCase()] = a[1];
    }
  }

  const hosts = [];
  const seen = new Set();
  const add = (value, kind, provenance) => {
    const host = hostFromUrl(value);
    if (host && !seen.has(host)) { seen.add(host); hosts.push({ host, kind, provenance }); }
  };
  add(props.moreinfourl, 'more-info-host', 'vsix.MoreInfoUrl');
  add(props.license, 'license-host', 'vsix.License');
  add(props.gettingstartedguide, 'getting-started-host', 'vsix.GettingStartedGuide');
  add(props.releasenotes, 'release-notes-host', 'vsix.ReleaseNotes');

  return { identity, properties: props, hosts };
}

/**
 * Combined extension analysis: package.json + vsix manifest.
 * @param {Object} packageJson
 * @param {string} [vsixXml='']
 */
export function analyzeVscodeExtension(packageJson, vsixXml = '') {
  const pkg = parseExtensionPackageJson(packageJson);
  const vsix = parseVsixManifest(vsixXml);
  const merged = [...pkg.hosts];
  const seen = new Set(pkg.hosts.map(h => h.host));
  for (const h of vsix.hosts) {
    if (!seen.has(h.host)) { seen.add(h.host); merged.push(h); }
  }
  return { name: pkg.name, publisher: pkg.publisher || vsix.identity.publisher || null, hosts: merged };
}
