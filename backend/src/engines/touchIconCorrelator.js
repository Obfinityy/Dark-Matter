/**
 * touchIconCorrelator.js — Apple-touch-icon service correlation.
 *
 * Correlates discovered apple-touch-icon image metadata (dimensions, file
 * hash, size, rel values) with known application icon profiles to provide an
 * additional passive identification signal during authorized reconnaissance.
 * A touch icon matching a well-known admin panel, CMS or framework icon is a
 * strong indicator of the underlying technology stack.
 *
 * All analysis is offline: callers supply already-fetched icon metadata.
 */

/** Known icon profiles: hash/dimension signatures mapped to products. */
export const KNOWN_ICON_PROFILES = [
  { product: 'WordPress', match: { rel: /apple-touch-icon/, size: /180x180/, hashPrefix: null }, confidence: 'medium', note: 'WordPress ships a default 180x180 apple-touch-icon.' },
  { product: 'Joomla', match: { rel: /apple-touch-icon/, size: /152x152|144x144/, hashPrefix: null }, confidence: 'low', note: 'Legacy CMS touch icon dimensions.' },
  { product: 'Django Admin', match: { rel: /icon|shortcut/, filename: /favicon|icon/i, size: /32x32/ }, confidence: 'low', note: 'Django admin default favicon is 32x32.' },
  { product: 'Laravel', match: { rel: /icon/, filename: /laravel/i }, confidence: 'medium', note: 'Laravel starter kit favicon naming.' },
  { product: 'Next.js', match: { rel: /icon/, filename: /favicon\.ico|icon/i, size: /16x16|32x32/ }, confidence: 'low', note: 'Next.js default favicon footprint.' },
  { product: 'Shopify', match: { rel: /icon/, filename: /shopify/i }, confidence: 'high', note: 'Shopify-branded touch icon filename.' },
  { product: 'Ghost', match: { rel: /icon/, filename: /ghost/i }, confidence: 'high', note: 'Ghost-branded icon filename.' },
  { product: 'Discourse', match: { rel: /apple-touch-icon/, size: /180x180/, filename: /apple-touch-icon/ }, confidence: 'medium', note: 'Discourse default apple-touch-icon path.' },
  { product: 'phpMyAdmin', match: { rel: /icon/, filename: /pma|phpmyadmin/i }, confidence: 'high', note: 'phpMyAdmin icon naming.' },
  { product: 'cPanel', match: { rel: /icon/, filename: /cpanel/i }, confidence: 'high', note: 'cPanel-branded icon filename.' },
];

/**
 * Correlate icon metadata against known profiles.
 *
 * @param {Array<Object>} icons - Icon descriptors, each:
 *   { rel, href, sizes, type, byteLength, hash, filename }
 * @returns {Object} correlation result.
 */
export function correlateTouchIcons(icons = []) {
  if (!Array.isArray(icons)) icons = [];
  const candidates = [];
  const signals = [];

  for (const icon of icons) {
    const rel = String(icon.rel || '');
    const href = String(icon.href || '');
    const size = String(icon.sizes || '');
    const filename = String(icon.filename || href.split('/').pop() || '');
    const isTouch = /apple-touch-icon|mask-icon/i.test(rel);
    if (isTouch) signals.push(`apple-touch-icon present (${size || 'unsized'}) at ${href}`);

    for (const profile of KNOWN_ICON_PROFILES) {
      const m = profile.match;
      const relOk = !m.rel || m.rel.test(rel);
      const sizeOk = !m.size || m.size.test(size);
      const fileOk = !m.filename || m.filename.test(filename);
      const hashOk = !m.hashPrefix || (icon.hash && String(icon.hash).startsWith(m.hashPrefix));
      if (relOk && sizeOk && fileOk && hashOk) {
        candidates.push({
          product: profile.product,
          confidence: profile.confidence,
          note: profile.note,
          evidence: `rel="${rel}" sizes="${size}" file="${filename}"`,
        });
      }
    }
  }

  const unique = [];
  const seen = new Set();
  for (const c of candidates) {
    const key = c.product;
    if (!seen.has(key)) { seen.add(key); unique.push(c); }
  }

  // Score: icon count + known matches + touch-icon presence.
  const score = Math.min(100,
    icons.length * 8 +
    (signals.length > 0 ? 20 : 0) +
    unique.length * 25);

  return {
    iconsFound: icons.length,
    appleTouchIcons: signals.length,
    signals,
    candidates: unique,
    identificationScore: score,
    summary: unique.length
      ? `Icon footprint correlates with: ${unique.map(c => `${c.product} (${c.confidence})`).join(', ')}.`
      : 'No known application icon profile matched.',
    type: 'Icon Correlation',
    confidence: unique.some(c => c.confidence === 'high') ? 'high' : unique.length ? 'medium' : 'low',
  };
}

/** Quick predicate: does the icon set include a branded touch icon? */
export function hasBrandedTouchIcon(icons = []) {
  const r = correlateTouchIcons(icons);
  return r.candidates.some(c => c.confidence === 'high') || r.appleTouchIcons > 0;
}

export const TOUCH_ICON_CORRELATOR = {
  KNOWN_ICON_PROFILES,
  correlateTouchIcons,
  hasBrandedTouchIcon,
};
export default TOUCH_ICON_CORRELATOR;
