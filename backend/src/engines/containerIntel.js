/**
 * containerIntel.js — Container-registry intelligence for autonomous bug bounty.
 *
 * Implements Dark-Matter idea-bank items 00074–00075 as real, working
 * defensive asset-discovery capabilities for authorized targets:
 *
 *  00074 Container-registry namespace mining — enumerate public container
 *      registries for the org's namespace to find image names that encode
 *      service/environment hostnames.
 *  00075 Docker Hub automated-build log mining — parse public Docker build
 *      logs for hostnames baked into images at build time.
 *
 * Functions are pure parsers/analyzers over registry listings and build-log
 * text the operator already collected. No network I/O here. Team and
 * service names found in public image tags/logs are treated as defensive
 * footprint findings for the org's own namespace.
 */

/** @typedef {object} ImageRef
 *  @property {string} registry    e.g. "docker.io", "ghcr.io"
 *  @property {string} namespace   org/user namespace
 *  @property {string} name        image name
 *  @property {string} tag
 */

const DEFAULT_REGISTRY = 'docker.io';
const LIBRARY_NAMESPACE = 'library';

/** Tokens that commonly encode environment in image names. */
const ENV_TOKENS = [
  'prod', 'production', 'staging', 'stage', 'dev', 'development',
  'test', 'testing', 'qa', 'uat', 'sandbox', 'demo', 'canary', 'beta',
  'internal', 'infra', 'edge', 'dr', 'backup',
];

/**
 * Parse a container image reference into registry/namespace/name/tag.
 * Handles "registry.io/org/name:tag", "org/name", "name", and digests.
 *
 * @param {string} ref
 * @returns {ImageRef|null}
 */
export function parseImageRef(ref) {
  if (!ref || typeof ref !== 'string') return null;
  let rest = ref.trim();
  // strip digest
  const at = rest.indexOf('@');
  if (at !== -1) rest = rest.slice(0, at);

  let registry = DEFAULT_REGISTRY;
  const first = rest.split('/')[0];
  if (rest.includes('/') && (first.includes('.') || first.includes(':'))) {
    registry = first.toLowerCase();
    rest = rest.slice(first.length + 1);
  }

  let tag = 'latest';
  const colon = rest.lastIndexOf(':');
  const slash = rest.lastIndexOf('/');
  if (colon > slash) {
    tag = rest.slice(colon + 1) || 'latest';
    rest = rest.slice(0, colon);
  }

  const parts = rest.split('/').filter(Boolean);
  let namespace = LIBRARY_NAMESPACE;
  let name = rest;
  if (parts.length >= 2) {
    namespace = parts.slice(0, -1).join('/').toLowerCase();
    name = parts[parts.length - 1];
  }
  return { registry, namespace, name: name.toLowerCase(), tag };
}

/**
 * Idea 00074 — filter a registry listing down to the org's namespace and
 * annotate each image with the service/environment it appears to encode.
 *
 * @param {string[]} imageRefs
 * @param {string} org  Org namespace (case-insensitive)
 * @returns {Array<ImageRef & {service: string, environment: string|null, note: string}>}
 */
export function mineOrgNamespace(imageRefs, org) {
  const target = (org || '').toLowerCase();
  const out = [];
  for (const ref of imageRefs || []) {
    const img = parseImageRef(ref);
    if (!img || img.namespace !== target) continue;
    const { service, environment } = decodeImageName(img.name);
    out.push({
      ...img,
      service,
      environment,
      note: environment
        ? `image name encodes service '${service}' in environment '${environment}'`
        : `image name encodes service '${service}' (no explicit environment token)`,
    });
  }
  return out;
}

/**
 * Heuristic decode of an image name into service + environment parts.
 * "api-prod-v2" -> { service: "api", environment: "prod" }.
 *
 * @param {string} name
 * @returns {{service: string, environment: string|null}}
 */
export function decodeImageName(name) {
  const tokens = (name || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  let environment = null;
  const serviceTokens = [];
  for (const t of tokens) {
    if (!environment && ENV_TOKENS.includes(t)) {
      environment = t;
    } else if (!/^\d+$/.test(t) && !/^v\d+$/.test(t)) {
      serviceTokens.push(t);
    }
  }
  return {
    service: serviceTokens.join('-') || (name || '').toLowerCase(),
    environment,
  };
}

/** TLD-like suffixes that are actually file extensions, not DNS names. */
const FILE_EXTENSION_TLDS = new Set([
  'tgz', 'gz', 'zip', 'tar', 'bz2', 'xz', '7z', 'rar', 'deb', 'rpm',
  'exe', 'msi', 'dmg', 'pkg', 'apk', 'jar', 'war', 'whl', 'gem',
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp', 'pdf', 'md',
  'txt', 'log', 'json', 'yaml', 'yml', 'toml', 'lock', 'sh', 'py', 'js',
]);

const HOSTNAME_RE = /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b/g;

/** Host suffixes that are noise in build logs (public registries, base images). */
const BUILD_LOG_NOISE = new Set([
  'docker.io', 'index.docker.io', 'registry.hub.docker.com',
  'ghcr.io', 'gcr.io', 'registry-1.docker.io', 'auth.docker.io',
  'proxy.golang.org', 'registry.npmjs.org', 'pypi.org', 'files.pythonhosted.org',
  'archive.ubuntu.com', 'security.ubuntu.com', 'deb.debian.org',
  'alpine', 'busybox',
]);

/**
 * Idea 00075 — mine Docker build-log text for hostnames that were baked
 * into images at build time (apt sources, curl targets, proxy hosts,
 * internal mirrors, artifact servers).
 *
 * @param {string} logText
 * @param {{minOccurrences?: number}} [opts]
 * @returns {Array<{host: string, occurrences: number, contexts: string[]}>}
 */
export function mineBuildLogHosts(logText, opts = {}) {
  const minOccurrences = opts.minOccurrences ?? 1;
  const counts = new Map();
  const contexts = new Map();

  const lines = String(logText || '').split('\n');
  for (const line of lines) {
    const matches = line.match(HOSTNAME_RE) || [];
    const seenThisLine = new Set();
    for (const raw of matches) {
      const host = raw.toLowerCase();
      if (BUILD_LOG_NOISE.has(host)) continue;
      const tld = host.split('.').pop();
      if (FILE_EXTENSION_TLDS.has(tld)) continue;
      // Skip hosts that are just the tail of a longer match on this line
      if (seenThisLine.has(host)) continue;
      seenThisLine.add(host);
      counts.set(host, (counts.get(host) || 0) + 1);
      if (!contexts.has(host)) contexts.set(host, []);
      if (contexts.get(host).length < 3) contexts.get(host).push(line.trim().slice(0, 160));
    }
  }

  return [...counts.entries()]
    .filter(([, n]) => n >= minOccurrences)
    .map(([host, occurrences]) => ({ host, occurrences, contexts: contexts.get(host) }))
    .sort((a, b) => b.occurrences - a.occurrences);
}
