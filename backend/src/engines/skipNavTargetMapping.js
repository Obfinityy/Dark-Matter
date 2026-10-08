/**
 * skipNavTargetMapping.js — Skip-navigation target mapping.
 *
 * Idea 00918: follow skip-links to main content anchors.
 *
 * Defensive recon engine: resolves skip-navigation links ("Skip to main
 * content") to their target anchors/landmarks from operator-collected page
 * HTML of an authorized target, mapping the keyboard-navigation structure and
 * any fragment targets that visual crawls miss. Pure parsing — no network.
 */

/**
 * Extract skip links from page HTML.
 * @param {string} html
 * @returns {{href: string, text: string, classes: string}[]}
 */
export function extractSkipLinks(html = '') {
  const text = String(html);
  const links = [];
  const anchorRegex = /<a\b([^>]*?)href=["'](#[^"']+)["']([^>]*?)>([\s\S]{0,200}?)<\/a>/gi;
  let m;
  while ((m = anchorRegex.exec(text)) !== null) {
    const attrs = `${m[1]} ${m[3]}`;
    const label = m[4].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const classMatch = attrs.match(/\bclass=["']([^"']*)["']/i);
    const classes = classMatch ? classMatch[1] : '';
    const isSkip = /\bskip[-_ ]?(to[-_ ]?)?(main|content|nav|navigation|link)/i.test(label) ||
      /\bskip[-_ ]?link\b/i.test(classes);
    if (isSkip) links.push({ href: m[2], text: label, classes });
  }
  return links;
}

/**
 * Resolve a skip-link fragment to its target element in the page.
 * @param {string} html
 * @param {string} fragment - e.g. '#main-content'.
 * @returns {{found: boolean, tag: string|null, role: string|null, id: string|null, landmark: boolean}}
 */
export function resolveSkipTarget(html = '', fragment = '') {
  const text = String(html);
  const id = fragment.replace(/^#/, '');
  if (!id) return { found: false, tag: null, role: null, id: null, landmark: false };
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<(main|div|section|article|nav|aside|header|footer)\\b([^>]*?\\bid=["']${esc}["'][^>]*?)>`, 'i');
  const m = text.match(re);
  if (!m) {
    // Fallback: any element with the id.
    const anyRe = new RegExp(`<([a-zA-Z][a-zA-Z0-9]*)\\b([^>]*?\\bid=["']${esc}["'][^>]*?)>`, 'i');
    const any = text.match(anyRe);
    if (!any) return { found: false, tag: null, role: null, id, landmark: false };
    const role = (any[2].match(/\brole=["']([^"']+)["']/i) || [])[1] || null;
    return { found: true, tag: any[1].toLowerCase(), role, id, landmark: /^(main|navigation|banner|contentinfo|complementary|search)$/i.test(role || '') };
  }
  const role = (m[2].match(/\brole=["']([^"']+)["']/i) || [])[1] || null;
  const landmarkTags = ['main', 'nav', 'header', 'footer'];
  return {
    found: true,
    tag: m[1].toLowerCase(),
    role,
    id,
    landmark: landmarkTags.includes(m[1].toLowerCase()) ||
      /^(main|navigation|banner|contentinfo|complementary|search)$/i.test(role || ''),
  };
}

/**
 * Map all skip links to their resolved targets.
 * @param {string} html
 * @returns {{mappings: {skipLink: object, target: object, valid: boolean}[]}}
 */
export function mapSkipNavigation(html = '') {
  const mappings = extractSkipLinks(html).map(skipLink => {
    const target = resolveSkipTarget(html, skipLink.href);
    return { skipLink, target, valid: target.found };
  });
  return { mappings };
}
