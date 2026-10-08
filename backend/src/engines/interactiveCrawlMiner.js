/**
 * interactiveCrawlMiner.js — Interactive UI crawl-surface analysis (ideas 721–730).
 *
 * Modern single-page applications hide a large share of their crawl surface
 * behind interactive UI widgets: modals, dropdowns, accordions, carousels,
 * lazy-loaded media, virtualized lists, canvas-rendered widgets, shadow DOM,
 * and custom-element routers. A crawler that only reads the initial DOM will
 * miss these links entirely.
 *
 * This engine provides PURE content-analysis helpers used by the Hunt agent's
 * browser-control layer. Every function analyzes GIVEN data (HTML strings,
 * DOM-model objects, OCR text) and either:
 *   - harvests links/URLs that already appear in the given content, or
 *   - returns a deterministic crawl plan: an array of
 *     { action, target, reason } steps the browser agent should execute.
 *
 * Defensive framing: these are inventory/auditing utilities for an authorized
 * bug-bounty agent. No network fetching, no exploit payloads.
 */

/**
 * Shared link extractor for small HTML fragments.
 * @param {string} html HTML fragment
 * @returns {string[]} deduplicated URLs from href/src/action/data-* attributes
 */
export function extractFragmentUrls(html = '') {
  const found = new Set();
  const patterns = [
    /\bhref\s*=\s*["']([^"'#\s][^"']*)["']/gi,
    /\bsrc\s*=\s*["']([^"'#\s][^"']*)["']/gi,
    /\baction\s*=\s*["']([^"'#\s][^"']*)["']/gi,
    /\bdata-(?:url|href|link|src|endpoint|api)\s*=\s*["']([^"'#\s][^"']*)["']/gi,
    /\bposter\s*=\s*["']([^"'#\s][^"']*)["']/gi,
  ];
  for (const re of patterns) {
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(html)) !== null) {
      const url = m[1].trim();
      if (url && !/^javascript:/i.test(url) && !/^data:/i.test(url)) found.add(url);
    }
  }
  return [...found];
}

/* ------------------------------------------------------------------ */
/* 721 — Modal-dialog link harvesting                                  */
/* ------------------------------------------------------------------ */

/**
 * Find modal/dialog containers in HTML and harvest links hidden inside them.
 * Matches native <dialog>, ARIA role="dialog"/"alertdialog", and common
 * modal class conventions.
 * @param {string} html Page HTML
 * @returns {{ container: string, urls: string[] }[]} one entry per modal found
 */
export function harvestModalLinks(html = '') {
  const text = String(html);
  const results = [];
  const seen = new Set();

  // Native <dialog> elements
  const dialogRe = /<dialog\b([^>]*)>([\s\S]*?)<\/dialog>/gi;
  let m;
  while ((m = dialogRe.exec(text)) !== null) {
    const id = /id\s*=\s*["']([^"']+)["']/i.exec(m[1] || '');
    results.push({ container: id ? `#${id[1]}` : '<dialog>', urls: extractFragmentUrls(m[2]) });
  }

  // role="dialog" / role="alertdialog" containers
  const roleRe =
    /<([a-z][a-z0-9]*)\b([^>]*\brole\s*=\s*["'](?:dialog|alertdialog)["'][^>]*)>([\s\S]*?)<\/\1>/gi;
  while ((m = roleRe.exec(text)) !== null) {
    const key = `role:${m.index}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const id = /id\s*=\s*["']([^"']+)["']/i.exec(m[2] || '');
    results.push({
      container: id ? `#${id[1]}` : `${m[1]}[role=dialog]`,
      urls: extractFragmentUrls(m[3]),
    });
  }

  // Class-convention modals: .modal, .dialog, .popup, .overlay-panel
  const classRe =
    /<([a-z][a-z0-9]*)\b([^>]*\bclass\s*=\s*["'][^"']*\b(modal|dialog|popup|lightbox)\b[^"']*["'][^>]*)>([\s\S]*?)<\/\1>/gi;
  while ((m = classRe.exec(text)) !== null) {
    const key = `class:${m.index}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const id = /id\s*=\s*["']([^"']+)["']/i.exec(m[2] || '');
    results.push({
      container: id ? `#${id[1]}` : `${m[1]}.${m[3]}`,
      urls: extractFragmentUrls(m[4]),
    });
  }

  return results;
}

/* ------------------------------------------------------------------ */
/* 722 — Dropdown-menu deep crawling                                   */
/* ------------------------------------------------------------------ */

/**
 * Build a crawl plan that expands every collapsed dropdown menu so the
 * browser agent can harvest nested navigation links.
 * @param {{ id?: string, selector: string, expanded?: boolean, depth?: number, itemCount?: number }[]} dropdowns
 *   DOM-model descriptors of dropdown widgets found on the page.
 * @returns {{ action: string, target: string, reason: string }[]} expansion plan
 */
export function planDropdownExpansion(dropdowns = []) {
  const plan = [];
  for (const dd of dropdowns) {
    if (!dd || !dd.selector) continue;
    if (dd.expanded === true) {
      plan.push({
        action: 'read_items',
        target: dd.selector,
        reason: `Dropdown already expanded — harvest its ${dd.itemCount ?? 'unknown number of'} nested links directly`,
      });
      continue;
    }
    plan.push({
      action: 'click',
      target: dd.selector,
      reason: `Expand dropdown${dd.depth > 1 ? ` at depth ${dd.depth}` : ''} to expose nested navigation links`,
    });
    plan.push({
      action: 'harvest_links',
      target: `${dd.selector} .menu, ${dd.selector} [role="menu"]`,
      reason: 'Collect links revealed by the expanded dropdown',
    });
  }
  return plan;
}

/* ------------------------------------------------------------------ */
/* 723 — Accordion content expansion                                   */
/* ------------------------------------------------------------------ */

/**
 * Parse accordion widgets from HTML and return an expansion plan, ordered
 * so sections most likely to contain endpoints are expanded first.
 * @param {string} html Page HTML
 * @returns {{ action: string, target: string, reason: string }[]} expansion plan
 */
export function planAccordionExpansion(html = '') {
  const text = String(html);
  const sections = [];
  const idRe = /id\s*=\s*["']([^"']+)["']/i;

  // Native <details> accordions
  const detailsRe = /<details\b([^>]*)>([\s\S]*?)<\/details>/gi;
  let m;
  while ((m = detailsRe.exec(text)) !== null) {
    const id = idRe.exec(m[1] || '');
    const heading = /<summary\b[^>]*>([\s\S]*?)<\/summary>/i.exec(m[2]);
    sections.push({
      target: id ? `#${id[1]}` : 'details',
      title: heading
        ? heading[1]
            .replace(/<[^>]+>/g, '')
            .trim()
            .slice(0, 80)
        : '',
      body: m[2],
    });
  }

  // Class-convention accordions: .accordion-item / .accordion-panel
  const itemRe =
    /<([a-z][a-z0-9]*)\b([^>]*\bclass\s*=\s*["'][^"']*\baccordion[-_ ]?item\b[^"']*["'][^>]*)>([\s\S]*?)<\/\1>/gi;
  while ((m = itemRe.exec(text)) !== null) {
    const id = idRe.exec(m[2] || '');
    sections.push({
      target: id ? `#${id[1]}` : `${m[1]}.accordion-item`,
      title: '',
      body: m[3],
    });
  }

  // Sections likely to hold endpoints/API references go first.
  const score = s =>
    /api|endpoint|download|export|webhook|integration|docs/i.test(s.body) ? 0 : 1;
  sections.sort((a, b) => score(a) - score(b));

  return sections.map(s => ({
    action: 'expand',
    target: s.target,
    reason: s.title
      ? `Expand accordion section "${s.title}" to reveal hidden links and endpoints`
      : 'Expand accordion section to reveal hidden links and endpoints',
  }));
}

/* ------------------------------------------------------------------ */
/* 724 — Carousel slide URL mining                                      */
/* ------------------------------------------------------------------ */

/**
 * Extract URLs from every carousel slide, not just the visible first one.
 * Handles class-convention carousels/sliders (.carousel, .slider, .swiper).
 * @param {string} html Page HTML
 * @returns {{ slide: number, container: string, urls: string[] }[]} per-slide URLs
 */
export function mineCarouselUrls(html = '') {
  const text = String(html);
  const results = [];

  // 1. Index every carousel/slider container opening tag.
  const containers = [];
  const containerOpenRe =
    /<([a-z][a-z0-9]*)\b[^>]*\bclass\s*=\s*["'][^"']*\b(carousel|slider|swiper|slideshow)(?![-\w])[^"']*["'][^>]*>/gi;
  let cm;
  while ((cm = containerOpenRe.exec(text)) !== null) {
    const id = /id\s*=\s*["']([^"']+)["']/i.exec(cm[0]);
    containers.push({
      index: cm.index,
      container: id ? `#${id[1]}` : `${cm[1]}.${cm[2]}`,
      slides: [],
    });
  }

  // 2. Find every slide element and attribute it to the nearest preceding container.
  const slideRe =
    /<([a-z][a-z0-9]*)\b([^>]*\bclass\s*=\s*["'][^"']*\b(slide|carousel-item|swiper-slide|slide-item)\b[^"']*["'][^>]*)>([\s\S]*?)<\/\1>/gi;
  let sm;
  while ((sm = slideRe.exec(text)) !== null) {
    let owner = null;
    for (const c of containers) {
      if (c.index < sm.index) owner = c;
      else break;
    }
    if (!owner) {
      owner = { index: sm.index, container: '(orphan slide)', slides: [] };
      containers.push(owner);
    }
    owner.slides.push(sm[4]);
  }

  for (const c of containers) {
    c.slides.forEach((inner, i) => {
      results.push({ slide: i + 1, container: c.container, urls: extractFragmentUrls(inner) });
    });
    if (c.slides.length === 0) {
      results.push({ slide: 1, container: c.container, urls: extractFragmentUrls('') });
    }
  }
  return results;
}

/* ------------------------------------------------------------------ */
/* 725 — Lazy-image srcset harvesting                                   */
/* ------------------------------------------------------------------ */

/**
 * Harvest every candidate URL from srcset attributes (lazy-loaded <img>
 * and <source> elements) for CDN host mapping and hidden asset discovery.
 * Handles data-srcset lazy-loading conventions too.
 * @param {string} html Page HTML
 * @returns {{ url: string, descriptor: string, host: string, element: string }[]}
 */
export function harvestSrcsets(html = '') {
  const text = String(html);
  const out = [];
  const seen = new Set();

  const srcsetRe = /<(img|source)\b([^>]*\b(?:data-)?srcset\s*=\s*["']([^"']+)["'][^>]*)>/gi;
  let m;
  while ((m = srcsetRe.exec(text)) !== null) {
    const element = m[1];
    const attrs = m[2];
    const srcset = m[3];
    const id = /id\s*=\s*["']([^"']+)["']/i.exec(attrs);
    const lazy = /\bloading\s*=\s*["']lazy["']/i.test(attrs) || /\bdata-srcset\b/i.test(attrs);

    // srcset entries: "url descriptor, url descriptor, ..."
    for (const entry of srcset.split(',')) {
      const parts = entry.trim().split(/\s+/);
      const url = parts[0];
      const descriptor = parts[1] || '';
      if (!url || /^data:/i.test(url) || seen.has(url)) continue;
      seen.add(url);
      let host = '';
      try {
        host = new URL(url, 'https://placeholder.local').host;
        if (host === 'placeholder.local') host = '(relative)';
      } catch {
        host = '(invalid)';
      }
      out.push({
        url,
        descriptor,
        host,
        element: `${element}${id ? `#${id[1]}` : ''}${lazy ? ' (lazy)' : ''}`,
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 726 — Intersection-observer trigger automation                       */
/* ------------------------------------------------------------------ */

/**
 * Build a plan that programmatically triggers lazy content guarded by
 * IntersectionObserver (infinite scroll, lazy sections, deferred widgets).
 * @param {{ selector: string, kind?: 'image'|'section'|'widget'|'list', observed?: boolean }[]} targets
 *   Lazy elements reported by the DOM model.
 * @returns {{ action: string, target: string, reason: string }[]} trigger plan
 */
export function planIntersectionTriggers(targets = []) {
  const plan = [];
  for (const t of targets) {
    if (!t || !t.selector) continue;
    const kind = t.kind || 'element';
    plan.push({
      action: 'scroll_into_view',
      target: t.selector,
      reason: `Trigger IntersectionObserver for lazy ${kind} so its content loads`,
    });
    if (kind === 'list' || kind === 'section') {
      plan.push({
        action: 'wait_for_network_idle',
        target: t.selector,
        reason: `Allow deferred ${kind} content to finish loading after scroll`,
      });
    }
    plan.push({
      action: 'harvest_links',
      target: t.selector,
      reason: `Collect links from newly loaded ${kind} content`,
    });
  }
  return plan;
}

/* ------------------------------------------------------------------ */
/* 727 — Virtualized-list full extraction                               */
/* ------------------------------------------------------------------ */

/**
 * Compute a scroll plan that drives a virtualized list (react-window,
 * virtual-scroller, etc.) through its full range so every row's links
 * can be extracted.
 * @param {{ selector: string, total: number, rendered?: number, rowHeight?: number, viewportHeight?: number }} listMeta
 *   Virtual-list metadata from the DOM model.
 * @returns {{ action: string, target: string, reason: string, passes?: number }[]} scroll plan
 */
export function planVirtualListScroll(listMeta = {}) {
  const { selector, total = 0, rendered = 0, rowHeight = 0, viewportHeight = 0 } = listMeta;
  if (!selector || total <= 0) return [];

  const plan = [];
  const knownHeight = rowHeight > 0 && viewportHeight > 0;
  const totalHeight = knownHeight ? total * rowHeight : 0;
  // Oversample: each pass covers a viewport; add margin for row recycling.
  const passes =
    knownHeight && viewportHeight > 0
      ? Math.min(Math.ceil(totalHeight / viewportHeight) + 2, total + 2)
      : Math.min(Math.ceil(total / Math.max(rendered, 1)) + 2, total + 2);

  plan.push({
    action: 'scroll_to_top',
    target: selector,
    reason: `Reset virtualized list (${total} rows) to a known start position`,
  });
  plan.push({
    action: 'scroll_sweep',
    target: selector,
    reason: `Sweep through all ${total} virtualized rows in ${passes} passes to extract every row's links`,
    passes,
  });
  plan.push({
    action: 'harvest_links',
    target: selector,
    reason: 'Collect deduplicated links from all extracted virtualized rows',
  });
  return plan;
}

/* ------------------------------------------------------------------ */
/* 728 — Canvas-rendered link recovery                                  */
/* ------------------------------------------------------------------ */

const URL_IN_TEXT_RE = /\b(?:https?:\/\/|www\.)[^\s"'<>)\]]+/gi;

/**
 * Recover links from OCR text captured off canvas-rendered UIs, where the
 * DOM contains no anchor elements at all. Hints (button labels, widget
 * names) help attribute bare paths to the right widget.
 * @param {string} ocrText Raw OCR text read from a <canvas> screenshot
 * @param {{ label: string, baseUrl?: string }[]} hints Widget hints from the DOM model
 * @returns {{ url: string, source: string }[]} recovered links
 */
export function recoverCanvasLinks(ocrText = '', hints = []) {
  const text = String(ocrText);
  const found = new Map();

  const push = (url, source) => {
    const clean = url.replace(/[.,;:!?]+$/, '');
    if (!found.has(clean)) found.set(clean, source);
  };

  // Full URLs straight from the OCR text.
  let m;
  URL_IN_TEXT_RE.lastIndex = 0;
  while ((m = URL_IN_TEXT_RE.exec(text)) !== null) {
    let url = m[0];
    if (/^www\./i.test(url)) url = `https://${url}`;
    push(url, 'ocr_url');
  }

  // Bare paths/route-like tokens attributed to hinted widgets.
  const pathRe = /(?:^|\s)(\/[a-z0-9][a-z0-9\-_./]*(?:\?[^\s"'<>]*)?)/gi;
  pathRe.lastIndex = 0;
  const paths = [];
  while ((m = pathRe.exec(text)) !== null) paths.push(m[1]);

  for (const hint of hints) {
    if (!hint || !hint.baseUrl) continue;
    const base = hint.baseUrl.replace(/\/$/, '');
    for (const p of paths) {
      push(`${base}${p}`, `hint:${hint.label || 'widget'}`);
    }
  }

  return [...found.entries()].map(([url, source]) => ({ url, source }));
}

/* ------------------------------------------------------------------ */
/* 729 — Shadow-DOM link traversal                                      */
/* ------------------------------------------------------------------ */

/**
 * Recursively pierce shadow-DOM boundaries in a serialized DOM model and
 * extract encapsulated links and endpoints from every shadow root.
 * @param {{ tag?: string, id?: string, links?: string[], children?: object[], shadow?: object[] }} node
 *   Serialized node: `links` are URLs found in the node's own markup,
 *   `shadow` holds the node's shadow-root children.
 * @param {string} path Breadcrumb path of host elements (internal use)
 * @returns {{ url: string, shadowPath: string }[]} links with their shadow path
 */
export function traverseShadowRoots(node, path = '') {
  const results = [];
  if (!node || typeof node !== 'object') return results;

  const label = node.id ? `#${node.id}` : node.tag || 'node';
  const here = path ? `${path} > ${label}` : label;

  for (const url of node.links || []) {
    if (typeof url === 'string' && url && !/^javascript:/i.test(url)) {
      // Nodes reached via `${here} #shadow-root` are encapsulated; light-DOM
      // nodes carry a plain host-element path.
      results.push({ url, shadowPath: here });
    }
  }

  // Shadow-root children: their links are encapsulated behind a boundary.
  for (const s of node.shadow || []) {
    results.push(...traverseShadowRoots({ ...s }, `${here} #shadow-root`));
  }

  // Regular light-DOM children.
  for (const child of node.children || []) {
    results.push(...traverseShadowRoots(child, here));
  }

  return results;
}

/* ------------------------------------------------------------------ */
/* 730 — Web-component route mapping                                    */
/* ------------------------------------------------------------------ */

/**
 * Map custom-element routers to their route tables: which paths each
 * web-component router owns, derived from component definitions.
 * @param {{ name: string, router?: boolean, routes?: (string|{ path: string, component?: string })[] }[]} customElements
 *   Custom-element registry model from the page.
 * @returns {{ component: string, routes: { path: string, component?: string }[] }[]} route tables
 */
export function mapWebComponentRoutes(customElements = []) {
  const tables = [];
  for (const el of customElements) {
    if (!el || !el.name) continue;
    const routes = [];
    for (const r of el.routes || []) {
      if (typeof r === 'string') {
        routes.push({ path: r });
      } else if (r && typeof r.path === 'string') {
        const entry = { path: r.path };
        if (r.component) entry.component = r.component;
        routes.push(entry);
      }
    }
    if (el.router || routes.length > 0) {
      tables.push({ component: el.name, routes });
    }
  }
  return tables;
}

export default {
  extractFragmentUrls,
  harvestModalLinks,
  planDropdownExpansion,
  planAccordionExpansion,
  mineCarouselUrls,
  harvestSrcsets,
  planIntersectionTriggers,
  planVirtualListScroll,
  recoverCanvasLinks,
  traverseShadowRoots,
  mapWebComponentRoutes,
};
