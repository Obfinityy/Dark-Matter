/**
 * codespacesLeakIntel.js — GitHub Codespaces port-forward URL analysis (idea 00219).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * `devcontainer.json` files describe forwarded ports, port attributes, and
 * lifecycle commands for GitHub Codespaces / VS Code Remote containers.
 * Forwarded-port entries, `onAutoForward` policies, and commands that curl
 * internal endpoints reveal staging hosts, internal service names, and port
 * conventions used by a target's development infrastructure.
 *
 * No network calls are made here — the caller supplies the file contents.
 * Findings describe hostnames and ports only; no secrets are extracted.
 */

/**
 * Parse devcontainer.json content safely (tolerates comments and trailing
 * commas, which VS Code's JSONC flavor allows).
 *
 * @param {string} text - Raw devcontainer.json text.
 * @returns {{ config: Object|null, error: string|null }}
 */
export function parseDevcontainer(text) {
  const raw = String(text || '');
  try {
    // Strip // and /* */ comments (naive but adequate for config files).
    const noComments = raw
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|\s)\/\/.*$/gm, '$1');
    const noTrailingCommas = noComments.replace(/,(\s*[}\]])/g, '$1');
    const config = JSON.parse(noTrailingCommas);
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      return { config: null, error: 'top-level value is not an object' };
    }
    return { config, error: null };
  } catch (e) {
    return { config: null, error: `JSON parse failed: ${e.message}` };
  }
}

/**
 * Extract forwarded ports, port attributes, and host/URL references from a
 * parsed devcontainer configuration.
 *
 * @param {Object} config - Parsed devcontainer.json object.
 * @param {string} [targetDomain] - Optional scope domain, e.g. "example.com".
 * @returns {{
 *   ports: Array<{ port: number|string, label: string|null, onAutoForward: string|null, visibility: string|null }>,
 *   hosts: Array<{ host: string, inScope: boolean, context: string }>,
 *   commands: string[],
 *   signals: string[]
 * }}
 */
export function analyzeDevcontainer(config, targetDomain = '') {
  const scope = String(targetDomain || '').trim().toLowerCase();
  const cfg = config && typeof config === 'object' ? config : {};
  const ports = [];
  const hostMap = new Map();
  const commands = [];
  const signals = [];

  const addHost = (host, context) => {
    const h = String(host || '').toLowerCase().trim();
    if (!h || h === 'localhost' || h === '127.0.0.1' || h === '::1') return;
    if (!hostMap.has(h)) hostMap.set(h, { host: h, inScope: !!scope && (h === scope || h.endsWith(`.${scope}`)), context });
  };

  // forwardPorts: [3000, "db:5432"] or { "app": 8080 } style entries.
  const fp = cfg.forwardPorts;
  const entries = Array.isArray(fp) ? fp : (fp && typeof fp === 'object' ? Object.entries(fp).map(([k, v]) => ({ __label: k, __port: v })) : []);
  for (const e of entries) {
    let port = e;
    let label = null;
    if (e && typeof e === 'object' && '__port' in e) { port = e.__port; label = e.__label; }
    ports.push({
      port,
      label,
      onAutoForward: cfg.onAutoForward ?? null,
      visibility: cfg.portsAttributes?.[String(port)]?.visibility
        ?? cfg.portsAttributes?.[String(label)]?.visibility ?? null,
    });
  }
  if (ports.length > 0) signals.push(`${ports.length} forwarded port(s) declared — port conventions hint at the service topology`);

  // portsAttributes keys are themselves port numbers worth reporting.
  for (const key of Object.keys(cfg.portsAttributes || {})) {
    if (!ports.some(p => String(p.port) === key)) {
      ports.push({ port: key, label: cfg.portsAttributes[key]?.label ?? null, onAutoForward: null, visibility: cfg.portsAttributes[key]?.visibility ?? null });
    }
  }

  // Lifecycle commands often curl/wget internal staging endpoints.
  for (const field of ['postCreateCommand', 'postStartCommand', 'postAttachCommand', 'initializeCommand', 'onCreateCommand', 'updateContentCommand']) {
    const val = cfg[field];
    const cmdList = Array.isArray(val) ? val : (typeof val === 'string' ? [val] : []);
    for (const c of cmdList) {
      if (typeof c !== 'string') continue;
      commands.push(c);
      const urlRe = /https?:\/\/[^\s"'<>\\]+/gi;
      let m;
      while ((m = urlRe.exec(c)) !== null) {
        try { addHost(new URL(m[0].replace(/[.,;)\]]+$/, '')).hostname, field); } catch { /* skip */ }
      }
      // Bare internal hostnames in commands (e.g. --host db.internal).
      const hostRe = /\b([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)\b/gi;
      while ((m = hostRe.exec(c)) !== null) {
        if (m[1].includes('.')) addHost(m[1], field);
      }
    }
  }
  if (commands.length > 0) signals.push(`${commands.length} lifecycle command(s) may reference internal endpoints`);

  // Remote environment / features can name internal registries.
  const scanObj = (obj, context) => {
    if (!obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) {
        try { addHost(new URL(v.trim()).hostname, context); } catch { /* skip */ }
      } else if (typeof v === 'string' && /image/i.test(k) && v.includes('/')) {
        const maybeHost = v.split('/')[0];
        if (maybeHost.includes('.')) addHost(maybeHost, `${context}.${k}`);
      } else if (v && typeof v === 'object') {
        scanObj(v, context);
      }
    }
  };
  scanObj(cfg.features, 'features');
  scanObj(cfg.remoteEnv, 'remoteEnv');

  return {
    ports,
    hosts: [...hostMap.values()],
    commands,
    signals,
  };
}
