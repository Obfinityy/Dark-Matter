/**
 * teamsManifestMiner.js — Microsoft Teams app manifest host extraction.
 *
 * Covers idea-bank item 00244:
 *  - 00244 Teams app manifest host extraction: parse Teams app manifests
 *    for tab and bot endpoint hosts.
 *
 * Pure functions only: callers fetch Teams app manifests (public app
 * packages, partner listings) themselves and pass the raw manifest JSON in.
 * No live HTTP here. Functions walk manifest sections (tabs, bots, compose
 * extensions, webApplicationInfo, validDomains, configuration URLs) and
 * extract endpoint hostnames with their manifest-section role.
 */

import { normalizeHostname, hostFromUrl } from './gitIntel.js';

/** Microsoft platform domains that are never target infrastructure. */
export const TEAMS_PLATFORM_DOMAINS = [
  'teams.microsoft.com',
  'microsoft.com',
  'microsoftonline.com',
  'msauth.net',
  'msauthimages.net',
  'office.com',
  'office.net',
  'sharepoint.com',
  'powerapps.com',
  'login.microsoftonline.com',
];

/**
 * Classify a manifest host by the manifest section it came from.
 * @param {string} section manifest section/field name (lowercase)
 * @returns {'tab'|'bot'|'connector'|'messageExtension'|'website'|'domainAllowlist'|'other'}
 */
export function classifyTeamsManifestHost(section = '') {
  const s = String(section || '').toLowerCase();
  if (/statictabs|configurabletabs|contenturl|tab/.test(s)) return 'tab';
  if (/bots|botendpoint|bot/.test(s)) return 'bot';
  if (/connectors?/.test(s)) return 'connector';
  if (/composeextensions?|messageextension|messagingextension/.test(s)) return 'messageExtension';
  if (/validdomains?/.test(s)) return 'domainAllowlist';
  if (/websiteurl|supporturl|privacyurl|termsofuseurl/.test(s)) return 'website';
  return 'other';
}

/**
 * Parse a Teams app manifest object into extracted hosts.
 *
 * @param {object} manifest raw Teams app manifest JSON (zip JSON package content)
 * @returns {{host: string, section: string, kind: string}[]}
 */
export function parseTeamsManifest(manifest = {}) {
  const byHost = new Map();

  const note = (host, section) => {
    const h = normalizeHostname(host);
    if (!h) return;
    if (TEAMS_PLATFORM_DOMAINS.some(p => h === p || h.endsWith(`.${p}`))) return;
    const kind = classifyTeamsManifestHost(section);
    const prev = byHost.get(h);
    // Prefer specific endpoint sections over the domain allowlist.
    if (!prev || (prev.kind === 'domainAllowlist' && kind !== 'domainAllowlist')) {
      byHost.set(h, { host: h, section, kind });
    }
  };

  const walkUrls = (value, section) => {
    if (!value) return;
    if (typeof value === 'string') {
      if (/^https?:\/\//i.test(value.trim())) note(hostFromUrl(value), section);
      return;
    }
    if (Array.isArray(value)) {
      for (const v of value) walkUrls(v, section);
      return;
    }
    if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        const sub = `${section}.${k}`;
        if (/url$/i.test(k) || /endpoint$/i.test(k) || k.toLowerCase() === 'website') {
          walkUrls(v, sub);
        } else {
          walkUrls(v, section);
        }
      }
    }
  };

  const m = manifest || {};
  walkUrls(m.staticTabs, 'staticTabs');
  walkUrls(m.configurableTabs, 'configurableTabs');
  walkUrls(m.bots, 'bots');
  walkUrls(m.connectors, 'connectors');
  walkUrls(m.composeExtensions, 'composeExtensions');
  walkUrls(m.webApplicationInfo, 'webApplicationInfo');
  walkUrls(m.validDomains, 'validDomains');
  walkUrls(m.websiteUrl, 'websiteUrl');
  walkUrls(m.supportUrl, 'supportUrl');
  walkUrls(m.privacyUrl, 'privacyUrl');
  walkUrls(m.termsOfUseUrl, 'termsOfUseUrl');

  return [...byHost.values()].sort((a, b) => a.host.localeCompare(b.host));
}

/**
 * Mine a Teams manifest for hosts related to the target domain.
 *
 * @param {object} manifest raw Teams app manifest JSON
 * @param {string} rootDomain
 * @returns {{host: string, section: string, kind: string}[]}
 */
export function mineTeamsManifestHosts(manifest = {}, rootDomain) {
  const root = normalizeHostname(rootDomain);
  if (!root) return [];
  return parseTeamsManifest(manifest).filter(
    f => f.host === root || f.host.endsWith(`.${root}`) || f.host.includes(root)
  );
}
