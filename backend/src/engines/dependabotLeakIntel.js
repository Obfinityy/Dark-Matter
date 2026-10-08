/**
 * dependabotLeakIntel.js — GitHub Dependabot config host-leak parsing (idea 00218).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * `dependabot.yml` files sometimes reference private package registries
 * (npm, Docker, Maven, NuGet, Terraform, …) whose URLs disclose internal
 * hostnames — e.g. `https://npm.internal.example.com` — that never appear in
 * public DNS. This module parses dependabot configuration YAML (with a small
 * purpose-built parser — no YAML dependency required) and extracts registry
 * URLs and internal hosts.
 *
 * No network calls are made here — the caller supplies the file contents.
 * Findings describe hostnames only; no credentials are ever extracted.
 */

/**
 * Minimal indentation-aware YAML subset parser, sufficient for
 * dependabot.yml structure (maps, lists of maps, scalars).
 *
 * @param {string} text
 * @returns {any} Parsed structure (object/array/scalar), or null on failure.
 */
export function parseSimpleYaml(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map(l => l.replace(/\t/g, '  '))
    .filter(l => l.trim() !== '' && !l.trim().startsWith('#'));
  if (!lines.length) return null;
  const [node] = parseBlock(lines, 0, 0);
  return node;
}

function indentOf(line) {
  return line.match(/^ */)[0].length;
}

function parseScalar(value) {
  let v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
}

function parseBlock(lines, start, baseIndent) {
  const first = lines[start].trim();
  const isList = first.startsWith('- ');
  const node = isList ? [] : {};
  let i = start;

  while (i < lines.length) {
    const line = lines[i];
    const ind = indentOf(line);
    if (ind < baseIndent) break;
    const trimmed = line.trim();

    if (trimmed.startsWith('- ')) {
      const itemIndent = ind;
      const rest = trimmed.slice(2).trim();
      const kv = rest.match(/^([^:]+):\s*(.*)$/);
      if (!kv || !kv[1].trim()) {
        i++;
        continue;
      }
      const obj = {};
      const key = kv[1].trim();
      if (kv[2] === '') {
        const [child, next] = parseBlock(lines, i + 1, itemIndent + 2);
        obj[key] = child;
        i = next;
      } else {
        obj[key] = parseScalar(kv[2]);
        i++;
      }
      // Continuation lines of this list item (indented deeper than the '- ').
      while (i < lines.length && indentOf(lines[i]) > itemIndent) {
        const cline = lines[i].trim();
        const ckv = cline.match(/^([^:]+):\s*(.*)$/);
        if (!ckv) {
          i++;
          continue;
        }
        const ckey = ckv[1].trim();
        if (ckv[2] === '') {
          const [child, next] = parseBlock(lines, i + 1, indentOf(lines[i]) + 2);
          obj[ckey] = child;
          i = next;
        } else {
          obj[ckey] = parseScalar(ckv[2]);
          i++;
        }
      }
      node.push(obj);
    } else {
      const kv = trimmed.match(/^([^:]+):\s*(.*)$/);
      if (!kv) {
        i++;
        continue;
      }
      const key = kv[1].trim();
      if (kv[2] === '') {
        const [child, next] = parseBlock(lines, i + 1, ind + 2);
        node[key] = child;
        i = next;
      } else {
        node[key] = parseScalar(kv[2]);
        i++;
      }
    }
  }
  return [node, i];
}

/**
 * Extract registry URLs and internal hosts from dependabot.yml content.
 *
 * @param {string} yamlText - Raw dependabot.yml file contents.
 * @param {string} [targetDomain] - Optional scope domain, e.g. "example.com".
 * @returns {{
 *   registries: Array<{ type: string|null, url: string, host: string, inScope: boolean, secretReferenced: boolean }>,
 *   internalHosts: string[],
 *   updates: Array<{ packageEcosystem: string, directory: string }>
 * }}
 */
export function extractDependabotHosts(yamlText, targetDomain = '') {
  const scope = String(targetDomain || '')
    .trim()
    .toLowerCase();
  const doc = parseSimpleYaml(yamlText);
  const registries = [];
  const updates = [];

  const root = doc && typeof doc === 'object' ? doc : {};
  for (const u of root.updates || []) {
    if (u && typeof u === 'object') {
      updates.push({
        packageEcosystem: String(u['package-ecosystem'] || ''),
        directory: String(u.directory || ''),
      });
    }
  }

  const regs = root.registries || {};
  for (const [name, reg] of Object.entries(regs)) {
    if (!reg || typeof reg !== 'object') continue;
    const type = reg.type ? String(reg.type) : null;
    const url = String(reg.url || '').trim();
    const hasSecret = Object.keys(reg).some(k => /secret|token|password|key/i.test(k));
    if (url) {
      let host = '';
      try {
        host = new URL(url).hostname.toLowerCase();
      } catch {
        host = url;
      }
      registries.push({
        type,
        url,
        host,
        inScope: !!scope && (host === scope || host.endsWith(`.${scope}`)),
        secretReferenced: hasSecret,
        registryName: name,
      });
    }
  }

  // Fallback: scan raw text for any URL that never made it into the structure
  // (e.g. commented examples are skipped — comments are stripped by the parser).
  const urlRe = /https?:\/\/[^\s"'<>]+/gi;
  const seen = new Set(registries.map(r => r.url));
  let m;
  while ((m = urlRe.exec(String(yamlText || ''))) !== null) {
    const url = m[0].replace(/[.,;)\]]+$/, '');
    if (seen.has(url)) continue;
    seen.add(url);
    let host = '';
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      continue;
    }
    registries.push({
      type: null,
      url,
      host,
      inScope: !!scope && (host === scope || host.endsWith(`.${scope}`)),
      secretReferenced: false,
      registryName: null,
    });
  }

  const internalHosts = [
    ...new Set(
      registries
        .map(r => r.host)
        .filter(h => h && !/^(registry\.)?(npmjs|docker\.io|pypi|rubygems|nuget|maven)/.test(h))
    ),
  ].sort();
  return { registries, internalHosts, updates };
}
