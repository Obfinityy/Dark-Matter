/**
 * Tech-fingerprint-driven planning — whatweb / httpx -tech-detect output picks
 * the tool order instead of a fixed sequence. An elite hunter who sees
 * WordPress does NOT run the same checklist as one who sees a Node API.
 *
 * planFromTech(technologies) → [{tool, priority, reason}] ordered by priority.
 * Technologies are matched case-insensitively against the mapping table;
 * unknown techs fall back to the generic web sequence.
 */

/** Canonical tech → ordered tool plan. Priority 1 = run first. */
export const TECH_TOOL_MAP = Object.freeze([
  {
    match: /wordpress/i,
    tech: 'WordPress',
    plan: [
      {
        tool: 'nuclei',
        priority: 1,
        reason: 'WordPress template set: wp core/plugin/theme CVEs, wp-config exposure',
        args: ['-tags', 'wordpress,wp-plugin,wp-theme,exposure'],
      },
      {
        tool: 'nikto',
        priority: 2,
        reason: 'WordPress misconfigurations: xmlrpc.php, wp-cron, directory listing',
      },
      {
        tool: 'katana',
        priority: 3,
        reason: 'Enumerate wp-json/wp-admin endpoints for IDOR and exposure',
      },
      {
        tool: 'dalfox',
        priority: 4,
        reason: 'Theme/plugin reflected XSS on search and comment parameters',
      },
    ],
  },
  {
    match: /drupal/i,
    tech: 'Drupal',
    plan: [
      {
        tool: 'nuclei',
        priority: 1,
        reason: 'Drupal CVE templates (Drupalgeddon class)',
        args: ['-tags', 'drupal'],
      },
      { tool: 'nikto', priority: 2, reason: 'CHANGELOG.txt, install.php, /user/password exposure' },
      { tool: 'dalfox', priority: 3, reason: 'Views module reflected XSS' },
    ],
  },
  {
    match: /joomla/i,
    tech: 'Joomla',
    plan: [
      { tool: 'nuclei', priority: 1, reason: 'Joomla CVE templates', args: ['-tags', 'joomla'] },
      { tool: 'nikto', priority: 2, reason: 'configuration.php exposure, com_media LFI probes' },
    ],
  },
  {
    match: /php/i,
    tech: 'PHP',
    plan: [
      {
        tool: 'arjun',
        priority: 1,
        reason: 'PHP apps are parameter-heavy: discover hidden params first',
      },
      {
        tool: 'sqlmap',
        priority: 2,
        reason: 'PHP + params = SQLi focus (risk 1, batch, explicit scope)',
        args: ['--batch', '--risk=1', '--level=1'],
      },
      { tool: 'dalfox', priority: 3, reason: 'Reflected XSS on discovered PHP parameters' },
      { tool: 'nuclei', priority: 4, reason: 'phpinfo, .git, backup-file exposure templates' },
    ],
  },
  {
    match: /laravel/i,
    tech: 'Laravel',
    plan: [
      {
        tool: 'nuclei',
        priority: 1,
        reason: 'Laravel .env exposure, debug-mode, APP_KEY leak templates',
      },
      { tool: 'arjun', priority: 2, reason: 'Hidden route parameters' },
      { tool: 'katana', priority: 3, reason: '/api/* route enumeration for BOLA/IDOR' },
    ],
  },
  {
    match: /django|python/i,
    tech: 'Django/Python',
    plan: [
      { tool: 'nuclei', priority: 1, reason: 'Django debug exposure, .env, backup templates' },
      { tool: 'arjun', priority: 2, reason: 'Parameter discovery for SSTI-prone views' },
      { tool: 'dalfox', priority: 3, reason: 'Template-context reflected XSS' },
    ],
  },
  {
    match: /node\.?js|express/i,
    tech: 'Node.js/Express',
    plan: [
      { tool: 'katana', priority: 1, reason: 'JS-heavy apps: crawl for /api routes first' },
      {
        tool: 'arjun',
        priority: 2,
        reason: 'Query-param discovery (prototype-pollution candidates)',
      },
      { tool: 'nuclei', priority: 3, reason: 'Express misconfiguration and exposure templates' },
      { tool: 'dalfox', priority: 4, reason: 'DOM XSS via JS-analysis candidates' },
    ],
  },
  {
    match: /react|angular|vue\.?js|next\.?js|nuxt/i,
    tech: 'SPA framework',
    plan: [
      { tool: 'katana', priority: 1, reason: 'SPA: JS bundle + route crawling for hidden APIs' },
      { tool: 'linkfinder', priority: 2, reason: 'Extract endpoints from JS bundles' },
      { tool: 'nuclei', priority: 3, reason: 'API exposure templates against discovered routes' },
    ],
  },
  {
    match: /graphql/i,
    tech: 'GraphQL',
    plan: [
      {
        tool: 'nuclei',
        priority: 1,
        reason: 'GraphQL introspection, batching, depth-limit templates',
      },
      { tool: 'arjun', priority: 2, reason: 'Operation parameter discovery' },
    ],
  },
  {
    match: /apache|nginx|iis/i,
    tech: 'Web server',
    plan: [
      { tool: 'nikto', priority: 1, reason: 'Server misconfiguration and dangerous files' },
      { tool: 'nuclei', priority: 2, reason: 'Version-correlated CVE templates' },
    ],
  },
  {
    match: /jenkins|gitlab|jira|confluence/i,
    tech: 'DevOps app',
    plan: [
      {
        tool: 'nuclei',
        priority: 1,
        reason: 'DevOps app default-creds and RCE templates',
        args: ['-tags', 'default-login,rce'],
      },
      { tool: 'nikto', priority: 2, reason: 'Management-interface exposure' },
    ],
  },
  {
    match: /cloudflare|akamai|incapsula|sucuri/i,
    tech: 'CDN/WAF fronted',
    plan: [
      {
        tool: 'wafw00f',
        priority: 1,
        reason: 'Confirm WAF identity → enforce stealth profile (G34)',
      },
      {
        tool: 'subfinder',
        priority: 2,
        reason: 'CDN-fronted: hunt origin via subdomain enumeration',
      },
      {
        tool: 'nuclei',
        priority: 3,
        reason: 'Low-noise templates only under stealth',
        args: ['-rate-limit', '10'],
      },
    ],
  },
]);

/** Generic fallback when no tech matched. */
export const GENERIC_PLAN = Object.freeze([
  { tool: 'katana', priority: 1, reason: 'Unknown stack: crawl for endpoints first' },
  { tool: 'nuclei', priority: 2, reason: 'Broad template sweep (medium+ severity)' },
  { tool: 'nikto', priority: 3, reason: 'Misconfiguration sweep' },
  { tool: 'arjun', priority: 4, reason: 'Parameter discovery on key pages' },
  { tool: 'dalfox', priority: 5, reason: 'XSS on discovered parameters' },
]);

/**
 * Normalize tech strings from whatweb ({plugins}) and httpx ({tech: []}).
 * Accepts: array of strings, whatweb JSON {plugins:{...}}, httpx record(s).
 */
export function normalizeTech(input) {
  const techs = new Set();
  const add = v => {
    if (typeof v !== 'string') return;
    const clean = v.trim();
    if (clean && clean.length < 80) techs.add(clean);
  };
  if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item === 'string') add(item);
      else if (item && typeof item === 'object') {
        if (Array.isArray(item.tech)) item.tech.forEach(add);
        if (item.plugins && typeof item.plugins === 'object')
          Object.keys(item.plugins).forEach(add);
      }
    }
  } else if (input && typeof input === 'object') {
    if (Array.isArray(input.tech)) input.tech.forEach(add);
    if (Array.isArray(input.technologies)) input.technologies.forEach(add);
    if (input.plugins && typeof input.plugins === 'object') {
      for (const [name, details] of Object.entries(input.plugins)) {
        add(name);
        if (Array.isArray(details?.version)) details.version.forEach(add);
        else if (details?.version) add(`${name} ${details.version}`);
      }
    }
  }
  return [...techs];
}

/**
 * Build the ordered tool plan from detected technologies.
 * @returns {{ plan: Array<{tool,priority,reason,args?}>, matchedTech: string[], fallback: boolean }}
 */
export function planFromTech(technologies) {
  const techs = normalizeTech(technologies);
  const plan = [];
  const matchedTech = [];
  const seenTools = new Set();

  for (const entry of TECH_TOOL_MAP) {
    if (techs.some(t => entry.match.test(t))) {
      matchedTech.push(entry.tech);
      for (const step of entry.plan) {
        if (seenTools.has(step.tool)) continue;
        seenTools.add(step.tool);
        plan.push({ ...step, tech: entry.tech });
      }
    }
  }

  if (!plan.length) {
    return { plan: GENERIC_PLAN.map(s => ({ ...s })), matchedTech: [], fallback: true };
  }
  plan.sort((a, b) => a.priority - b.priority);
  return { plan, matchedTech, fallback: false };
}

/** Parse whatweb --log-json output into tech list. */
export function parseWhatweb(raw) {
  if (!raw) return [];
  try {
    const text = String(raw).trim();
    const objs = [];
    // whatweb --log-json=- emits one JSON object per target; be tolerant of
    // concatenated objects and pretty-printed output.
    const matches = text.match(/\{[\s\S]*\}/g) || [];
    for (const m of matches) {
      try {
        objs.push(JSON.parse(m));
      } catch {
        /* skip */
      }
    }
    if (!objs.length) {
      try {
        objs.push(JSON.parse(text));
      } catch {
        /* skip */
      }
    }
    const techs = [];
    for (const obj of objs) {
      const plugins = obj?.plugins;
      if (plugins && typeof plugins === 'object') {
        for (const [name, details] of Object.entries(plugins)) {
          techs.push(name);
          const versions = Array.isArray(details?.version)
            ? details.version
            : details?.version
              ? [details.version]
              : [];
          for (const v of versions) techs.push(`${name} ${v}`);
        }
      }
    }
    return normalizeTech(techs);
  } catch {
    return [];
  }
}
