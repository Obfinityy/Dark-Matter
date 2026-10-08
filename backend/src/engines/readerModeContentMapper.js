/**
 * readerModeContentMapper.js — Reader-mode content mapping.
 *
 * Idea 00887: map how a target's pages respond to reader-mode extraction
 * (Readability-style heuristics) and derive the article URL patterns those
 * pages follow — so content routes can be enumerated systematically.
 *
 * The module scores HTML for article signals (semantic tags, article-ish URL
 * shapes, headline/metadata density), extracts the canonical/OG URL, and
 * generalizes observed article URLs into route patterns. All local, no network.
 */

/** Signals that a page carries extractable article content. */
export const ARTICLE_SIGNALS = [
  { re: /<article\b/i, label: 'article-tag', weight: 3 },
  { re: /\bitemprop\s*=\s*["']articleBody["']/i, label: 'schema-article-body', weight: 3 },
  { re: /<meta[^>]+property\s*=\s*["']article:/i, label: 'og-article-meta', weight: 3 },
  { re: /\bclass\s*=\s*["'][^"']*\b(post-content|entry-content|article-body|story-body)\b/i, label: 'article-class', weight: 2 },
  { re: /<time\b[^>]*datetime/i, label: 'datetime', weight: 1 },
  { re: /\brel\s*=\s*["']author["']/i, label: 'author-rel', weight: 1 },
  { re: /<h1\b/i, label: 'h1-headline', weight: 1 },
  { re: /\breading-time\b/i, label: 'reading-time', weight: 2 },
];

/** URL shapes typical of article/content routes. */
export const ARTICLE_URL_SHAPES = [
  { re: /\/\d{4}\/\d{2}\/\d{2}\/[^/]+\/?$/i, label: 'dated-slug' },
  { re: /\/(blog|news|posts?|articles?|stories?|insights?)\/[^/]+\/?$/i, label: 'section-slug' },
  { re: /\/[^/]+-\d{4,}\/?$/i, label: 'slug-with-id' },
  { re: /[?&](p|post|article|id)=\d+/i, label: 'query-id' },
];

/**
 * Score HTML for reader-mode extractability.
 * @param {string} html
 * @returns {{score: number, signals: string[], extractable: boolean}}
 */
export function scoreReaderExtractability(html = '') {
  const src = String(html);
  let score = 0;
  const signals = [];
  for (const s of ARTICLE_SIGNALS) {
    if (s.re.test(src)) {
      score += s.weight;
      signals.push(s.label);
    }
  }
  // Text density heuristic: long paragraph runs suggest real content.
  const paragraphs = src.match(/<p\b[^>]*>([\s\S]*?)<\/p>/gi) || [];
  const textChars = paragraphs
    .slice(0, 20)
    .reduce((n, p) => n + p.replace(/<[^>]+>/g, '').length, 0);
  if (textChars > 2000) {
    score += 2;
    signals.push('dense-paragraphs');
  }
  return { score, signals, extractable: score >= 5 };
}

/**
 * Extract the canonical / OG URL of a page from its HTML.
 * @param {string} html
 * @returns {string|null}
 */
export function extractCanonicalUrl(html = '') {
  const src = String(html);
  const canon = /<link\b[^<>]*rel\s*=\s*["']canonical["'][^<>]*>/i.exec(src);
  if (canon) {
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(canon[0]);
    if (href) return href[1];
  }
  const og = /<meta\b[^<>]*property\s*=\s*["']og:url["'][^<>]*>/i.exec(src);
  if (og) {
    const content = /content\s*=\s*["']([^"']+)["']/i.exec(og[0]);
    if (content) return content[1];
  }
  return null;
}

/**
 * Generalize an article URL into a route pattern.
 * @param {string} url
 * @returns {string|null}
 */
export function toArticlePattern(url = '') {
  try {
    const u = new URL(String(url));
    const path = u.pathname
      .replace(/\/\d{4}\/\d{2}\/\d{2}\//, '/{YYYY}/{MM}/{DD}/')
      .split('/')
      .map(seg =>
        /^\d+$/.test(seg) ? '{id}' :
        /^[0-9a-f]{24,}$/i.test(seg) ? '{oid}' :
        seg
      )
      .join('/');
    const query = [...u.searchParams.keys()]
      .map(k => (/^(p|post|article|id)$/i.test(k) ? `${k}={id}` : `${k}={v}`))
      .join('&');
    return `${u.origin}${path}${query ? '?' + query : ''}`;
  } catch {
    return null;
  }
}

/**
 * Match a URL against known article URL shapes.
 * @param {string} url
 * @returns {string[]}
 */
export function matchArticleShapes(url = '') {
  const s = String(url);
  return ARTICLE_URL_SHAPES.filter(sh => sh.re.test(s)).map(sh => sh.label);
}

/**
 * Map reader-mode extractability across pages to article URL patterns.
 * @param {{url: string, html: string}[]} pages
 * @returns {{pages: object[], patterns: object[], stats: object}}
 */
export function mapReaderModeContent(pages = []) {
  const analyzed = [];
  for (const page of pages) {
    const { score, signals, extractable } = scoreReaderExtractability(page.html || '');
    const canonical = extractCanonicalUrl(page.html || '') || page.url;
    analyzed.push({
      url: page.url,
      canonical,
      score,
      signals,
      extractable,
      shapes: matchArticleShapes(canonical),
      pattern: toArticlePattern(canonical),
    });
  }
  const patternMap = new Map();
  for (const a of analyzed) {
    if (!a.pattern) continue;
    if (!patternMap.has(a.pattern)) patternMap.set(a.pattern, []);
    patternMap.get(a.pattern).push(a);
  }
  const patterns = [...patternMap.entries()].map(([pattern, items]) => ({
    pattern,
    hits: items.length,
    extractableHits: items.filter(i => i.extractable).length,
    samples: items.slice(0, 3).map(i => i.canonical),
  }));
  patterns.sort((a, b) => b.hits - a.hits);
  const extractable = analyzed.filter(a => a.extractable);
  return {
    pages: analyzed,
    patterns,
    stats: {
      pages: analyzed.length,
      extractable: extractable.length,
      distinctPatterns: patterns.length,
      articleShaped: analyzed.filter(a => a.shapes.length > 0).length,
    },
  };
}

/**
 * Build a report finding from a reader-mode content map.
 * @param {ReturnType<typeof mapReaderModeContent>} result
 */
export function readerModeFinding(result) {
  return {
    title: `Reader-mode content mapping — ${result.stats.extractable} extractable page(s), ${result.stats.distinctPatterns} URL pattern(s)`,
    severity: 'Info',
    confidence: result.stats.pages > 0 ? 'high' : 'medium',
    patterns: result.patterns.slice(0, 20),
    stats: result.stats,
    evidence:
      `${result.stats.pages} page(s) scored for reader-mode extractability; ` +
      `${result.stats.distinctPatterns} distinct article URL pattern(s) derived.`,
  };
}

export const READER_MODE_CONTENT_MAPPER = {
  scoreReaderExtractability,
  extractCanonicalUrl,
  toArticlePattern,
  matchArticleShapes,
  mapReaderModeContent,
  readerModeFinding,
};
export default READER_MODE_CONTENT_MAPPER;
