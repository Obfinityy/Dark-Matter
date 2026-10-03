/**
 * humansTxtMiner.js — humans.txt team-host leaks.
 *
 * `/humans.txt` credits the people and tooling behind a site. It frequently
 * names team members, their personal or team sites, internal tools and
 * social profiles — any of which can reveal subdomains, internal tooling
 * hosts, or staff-linked domains for an authorized hunt.
 *
 * All functions are pure: the caller fetches the file, this module parses it.
 */

/** Well-known locations of the humans.txt file. */
export const CANDIDATE_PATHS = [
  '/humans.txt',
  '/.well-known/humans.txt',
];

/**
 * Build candidate file URLs for a target.
 * @param {string} baseUrl target origin, e.g. "https://example.com"
 * @returns {string[]} candidate file URLs
 */
export function candidateUrls(baseUrl = '') {
  const origin = String(baseUrl).replace(/\/+$/, '');
  if (!origin) return [];
  return CANDIDATE_PATHS.map((p) => `${origin}${p}`);
}

/**
 * Extract the hostname from a URL string.
 * @param {string} raw
 * @returns {string|null}
 */
function hostnameOf(raw) {
  try {
    return new URL(String(raw)).hostname || null;
  } catch {
    return null;
  }
}

/**
 * Parse a humans.txt file: sections, URLs, emails and tool references.
 * @param {string} content raw file text
 * @param {{ sourceUrl?: string }} [opts]
 * @returns {{
 *   source: string|null,
 *   sections: string[],
 *   urls: Array<{ url: string, host: string|null, context: string|null }>,
 *   emails: Array<{ email: string, domain: string|null }>,
 *   hosts: string[],
 *   toolMentions: string[]
 * }}
 */
export function analyzeHumansTxt(content, opts = {}) {
  const source = opts.sourceUrl || null;
  const text = String(content || '');
  const sections = [];
  const urls = [];
  const emails = [];
  const hosts = new Set();
  const toolMentions = new Set();
  const lines = text.split(/\r?\n/);
  let currentSection = null;

  const KNOWN_TOOLS = [
    'wordpress', 'drupal', 'joomla', 'django', 'rails', 'laravel', 'express',
    'react', 'angular', 'vue', 'next.js', 'nuxt', 'gatsby', 'svelte',
    'nginx', 'apache', 'cloudflare', 'aws', 'azure', 'gcp', 'kubernetes',
    'docker', 'jenkins', 'gitlab', 'github', 'bitbucket', 'terraform',
  ];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    // Section headers: /* TEAM */, [TEAM], # TEAM
    const sec = line.match(/^(?:\/\*+|\[|#{1,3}\s*)\s*([A-Z][A-Z0-9 _&/-]{2,}?)\s*(?:\*+\/|\]|#*)$/);
    if (sec) {
      currentSection = sec[1].trim().toLowerCase().replace(/\s+/g, ' ');
      sections.push(currentSection);
      continue;
    }
    // Markdown links [name](url)
    for (const m of line.matchAll(/\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g)) {
      const host = hostnameOf(m[2]);
      if (host) hosts.add(host.toLowerCase());
      urls.push({ url: m[2], host: host ? host.toLowerCase() : null, context: currentSection });
    }
    // Bare URLs
    for (const m of line.matchAll(/(?<![(\[])(https?:\/\/[^\s"'<>,)\]]+)/g)) {
      const host = hostnameOf(m[1]);
      if (!host) continue;
      if (!urls.some((u) => u.url === m[1])) {
        hosts.add(host.toLowerCase());
        urls.push({ url: m[1], host: host.toLowerCase(), context: currentSection });
      }
    }
    // Emails
    for (const m of line.matchAll(/([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g)) {
      const domain = m[2].toLowerCase();
      hosts.add(domain);
      if (!emails.some((e) => e.email === m[0])) {
        emails.push({ email: m[0], domain });
      }
    }
    // Tool mentions
    for (const tool of KNOWN_TOOLS) {
      if (new RegExp(`\\b${tool.replace('.', '\\.')}\\b`, 'i').test(line)) {
        toolMentions.add(tool);
      }
    }
  }

  return { source, sections, urls, emails, hosts: [...hosts], toolMentions: [...toolMentions] };
}

/**
 * Summarize an analysis for reporting.
 * @param {ReturnType<typeof analyzeHumansTxt>} analysis
 * @returns {{ hosts: string[], emailDomains: string[], urlCount: number, tools: string[] }}
 */
export function summarizeAnalysis(analysis) {
  return {
    hosts: analysis.hosts || [],
    emailDomains: [...new Set((analysis.emails || []).map((e) => e.domain))],
    urlCount: (analysis.urls || []).length,
    tools: analysis.toolMentions || [],
  };
}
