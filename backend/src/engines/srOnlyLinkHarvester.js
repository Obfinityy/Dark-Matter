/**
 * srOnlyLinkHarvester.js — Screen-reader-only link harvesting.
 *
 * Idea 00917: harvest sr-only links hidden from visual crawls.
 *
 * Defensive recon engine: extracts links inside screen-reader-only containers
 * (Bootstrap `.sr-only` / `.visually-hidden`, Tailwind `sr-only`, `aria-hidden`
 * inversions, off-screen positioned elements) from operator-collected page HTML
 * of an authorized target. These links are invisible to visual crawls but part
 * of the site's real surface. Pure parsing — no network calls.
 */

const SR_ONLY_CLASS_REGEX = /\b(sr-only|visually-hidden|screen-reader-only|a11y-only|hidden-accessible)\b/i;
const OFFSCREEN_STYLE_REGEX = /(position\s*:\s*absolute[^;}]*?(left|top)\s*:\s*-?\d{3,}|clip\s*:\s*rect\s*\(\s*0|width\s*:\s*1px[^;}]*height\s*:\s*1px)/i;

/**
 * Check whether an element's class/style marks it screen-reader-only.
 * @param {string} attrs - Raw attribute string of the opening tag.
 * @returns {boolean}
 */
export function isSrOnly(attrs = '') {
  const classMatch = attrs.match(/\bclass=["']([^"']*)["']/i);
  if (classMatch && SR_ONLY_CLASS_REGEX.test(classMatch[1])) return true;
  const styleMatch = attrs.match(/\bstyle=["']([^"']*)["']/i);
  if (styleMatch && OFFSCREEN_STYLE_REGEX.test(styleMatch[1])) return true;
  return false;
}

/**
 * Harvest links hidden inside screen-reader-only containers.
 * @param {string} html - Page HTML.
 * @param {string} [baseUrl]
 * @returns {{links: {href: string, text: string, context: string}[]}}
 */
export function harvestSrOnlyLinks(html = '', baseUrl = '') {
  const text = String(html);
  const links = [];
  // Containers with sr-only classes; capture inner anchors.
  const containerRegex = /<(div|span|nav|ul|li|section|aside|p)\b([^>]*?)>([\s\S]{0,4000}?)<\/\1>/gi;
  let m;
  while ((m = containerRegex.exec(text)) !== null) {
    if (!isSrOnly(m[2])) continue;
    const inner = m[3];
    const anchorRegex = /<a\b([^>]*?)href=["']([^"']+)["']([^>]*?)>([\s\S]{0,300}?)<\/a>/gi;
    let a;
    while ((a = anchorRegex.exec(inner)) !== null) {
      const raw = a[2].replace(/&amp;/g, '&');
      if (/^(javascript|mailto|tel|#)/i.test(raw)) continue;
      let href = raw;
      if (baseUrl && raw.startsWith('/')) {
        try { href = new URL(raw, baseUrl).href; } catch { /* keep raw */ }
      }
      links.push({
        href,
        text: a[4].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 120),
        context: `sr-only <${m[1]}>`,
      });
    }
  }
  // Anchors that are themselves sr-only.
  const selfRegex = /<a\b([^>]*?)href=["']([^"']+)["']([^>]*?)>([\s\S]{0,300}?)<\/a>/gi;
  while ((m = selfRegex.exec(text)) !== null) {
    const attrs = `${m[1]} ${m[3]}`;
    if (!isSrOnly(attrs)) continue;
    const raw = m[2].replace(/&amp;/g, '&');
    if (/^(javascript|mailto|tel|#)/i.test(raw)) continue;
    if (links.some(l => l.href === raw || l.href.endsWith(raw))) continue;
    let href = raw;
    if (baseUrl && raw.startsWith('/')) {
      try { href = new URL(raw, baseUrl).href; } catch { /* keep raw */ }
    }
    links.push({
      href,
      text: m[4].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 120),
      context: 'sr-only <a>',
    });
  }
  return { links };
}
