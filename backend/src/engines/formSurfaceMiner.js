/**
 * formSurfaceMiner.js — Form/ARIA/input crawl-surface analysis (ideas 761–770).
 *
 * Forms are the richest part of a site's crawl surface: action URLs are
 * candidate endpoints, input names are parameter candidates, hidden fields
 * carry internal references, ARIA references point at hidden content, and
 * autocomplete/select/pagination widgets encode deep-link URL patterns.
 *
 * This engine provides PURE content-analysis helpers used by the Hunt agent's
 * browser-control layer. Every function analyzes GIVEN HTML strings only and
 * returns an inventory of crawl-surface facts:
 *   - harvests endpoints, parameter names, hidden references, and URL
 *     patterns already present in the given markup, or
 *   - resolves ARIA reference chains to surface hidden content for auditing.
 *
 * Defensive framing: these are inventory/auditing utilities for an authorized
 * bug-bounty agent. No network fetching, no exploit payloads.
 */

const ATTR_RE = (name) => new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i');

function attrValue(attrs, name) {
  const m = ATTR_RE(name).exec(attrs || '');
  return m ? m[2] : '';
}

function elementLabel(tag, attrs) {
  const id = attrValue(attrs, 'id');
  const cls = attrValue(attrs, 'class').split(/\s+/)[0];
  if (id) return `${tag}#${id}`;
  if (cls) return `${tag}.${cls}`;
  return tag;
}

function stripTags(html) {
  return String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function isHiddenAttrs(attrs) {
  return /\bhidden\b/i.test(attrs || '') || /\baria-hidden\s*=\s*["']true["']/i.test(attrs || '');
}

/**
 * Index every element carrying an id attribute: id → { tag, attrs, inner }.
 * @param {string} html Page HTML
 * @returns {Map<string, { tag: string, attrs: string, inner: string }>}
 */
function indexElementsById(html) {
  const text = String(html);
  const byId = new Map();
  // Paired elements with content.
  const pairedRe = /<([a-z][a-z0-9]*)\b([^>]*\bid\s*=\s*["']([^"']+)["'][^>]*)>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = pairedRe.exec(text)) !== null) {
    if (!byId.has(m[3])) byId.set(m[3], { tag: m[1], attrs: m[2], inner: m[4] });
  }
  // Self-closing / void elements with an id.
  const voidRe = /<([a-z][a-z0-9]*)\b([^>]*\bid\s*=\s*["']([^"']+)["'][^>]*?)\/>/gi;
  while ((m = voidRe.exec(text)) !== null) {
    if (!byId.has(m[3])) byId.set(m[3], { tag: m[1], attrs: m[2], inner: '' });
  }
  return byId;
}

/**
 * Extract every <form> block: opening attributes plus its inner HTML and
 * character range (used to attribute inner fields to their form).
 * @param {string} html Page HTML
 * @returns {{ attrs: string, inner: string, start: number, end: number }[]}
 */
function extractForms(html) {
  const text = String(html);
  const forms = [];
  const formRe = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
  let m;
  while ((m = formRe.exec(text)) !== null) {
    forms.push({ attrs: m[1], inner: m[2], start: m.index, end: formRe.lastIndex });
  }
  // Unclosed <form> tags still count as crawl surface.
  const openRe = /<form\b([^>]*)>/gi;
  while ((m = openRe.exec(text)) !== null) {
    if (!forms.some((f) => f.start === m.index)) {
      forms.push({ attrs: m[1], inner: '', start: m.index, end: m.index });
    }
  }
  return forms;
}

function formLabel(attrs) {
  const id = attrValue(attrs, 'id');
  const name = attrValue(attrs, 'name');
  if (id) return `form#${id}`;
  if (name) return `form[name="${name}"]`;
  return 'form';
}

/* ------------------------------------------------------------------ */
/* 761 — ARIA-describedby target mapping                               */
/* ------------------------------------------------------------------ */

/**
 * Follow aria-describedby references and return the contents of every
 * referenced element (which often holds hidden help/description content).
 * @param {string} html Page HTML
 * @returns {{ describing: string, refId: string, text: string, hidden: boolean }[]}
 */
export function harvestAriaDescribedByTargets(html = '') {
  const text = String(html);
  const byId = indexElementsById(text);
  const results = [];

  const describedRe = /<([a-z][a-z0-9]*)\b([^>]*\baria-describedby\s*=\s*["']([^"']+)["'][^>]*)>/gi;
  let m;
  while ((m = describedRe.exec(text)) !== null) {
    const describing = elementLabel(m[1], m[2]);
    for (const refId of m[3].split(/\s+/).filter(Boolean)) {
      const target = byId.get(refId);
      if (!target) continue;
      results.push({
        describing,
        refId: `#${refId}`,
        text: stripTags(target.inner).slice(0, 500),
        hidden: isHiddenAttrs(target.attrs),
      });
    }
  }
  return results;
}

/* ------------------------------------------------------------------ */
/* 762 — Form-action endpoint cataloging                               */
/* ------------------------------------------------------------------ */

/**
 * Catalog every form's action URL as a candidate endpoint.
 * @param {string} html Page HTML
 * @returns {{ form: string, action: string, method: string }[]}
 */
export function catalogFormActions(html = '') {
  return extractForms(html).map((f) => ({
    form: formLabel(f.attrs),
    action: attrValue(f.attrs, 'action'),
    method: (attrValue(f.attrs, 'method') || 'GET').toUpperCase(),
  }));
}

/* ------------------------------------------------------------------ */
/* 763 — Form-method override detection                                */
/* ------------------------------------------------------------------ */

/**
 * Detect _method overrides (hidden input or query param) that reveal
 * RESTful routing behind plain POST forms.
 * @param {string} html Page HTML
 * @returns {{ form: string, override: string, source: 'hidden_input'|'query_param' }[]}
 */
export function detectMethodOverrides(html = '') {
  const text = String(html);
  const results = [];
  const seen = new Set();

  for (const f of extractForms(text)) {
    const form = formLabel(f.attrs);
    // Hidden <input name="_method" value="PUT"> style overrides.
    const inputRe = /<input\b[^>]*\bname\s*=\s*["']_method["'][^>]*>/gi;
    let im;
    while ((im = inputRe.exec(f.inner)) !== null) {
      const value = attrValue(im[0], 'value').toUpperCase();
      if (value && !seen.has(`${form}:${value}`)) {
        seen.add(`${form}:${value}`);
        results.push({ form, override: value, source: 'hidden_input' });
      }
    }
    // Query-string style overrides: action="/res/1?_method=DELETE".
    const action = attrValue(f.attrs, 'action');
    const qp = /[?&]_method=([a-zA-Z]+)/i.exec(action);
    if (qp) {
      const value = qp[1].toUpperCase();
      if (!seen.has(`${form}:${value}`)) {
        seen.add(`${form}:${value}`);
        results.push({ form, override: value, source: 'query_param' });
      }
    }
  }
  return results;
}

/* ------------------------------------------------------------------ */
/* 764 — Input-name parameter harvesting                               */
/* ------------------------------------------------------------------ */

/**
 * Harvest input/select/textarea names as parameter candidates for later
 * (authorized) testing, attributing each to its enclosing form.
 * @param {string} html Page HTML
 * @returns {{ name: string, tag: string, type: string, form: string }[]}
 *   Deduplicated by parameter name (first occurrence wins).
 */
export function harvestInputNames(html = '') {
  const text = String(html);
  const forms = extractForms(text);
  const byName = new Map();

  const fieldRe = /<(input|select|textarea)\b([^>]*)>/gi;
  let m;
  while ((m = fieldRe.exec(text)) !== null) {
    const name = attrValue(m[2], 'name');
    if (!name || byName.has(name)) continue;
    const owner = forms.find((f) => m.index >= f.start && m.index <= f.end);
    byName.set(name, {
      name,
      tag: m[1],
      type: m[1] === 'input' ? (attrValue(m[2], 'type') || 'text').toLowerCase() : m[1],
      form: owner ? formLabel(owner.attrs) : '(no form)',
    });
  }
  return [...byName.values()];
}

/* ------------------------------------------------------------------ */
/* 765 — Hidden-field value mining                                     */
/* ------------------------------------------------------------------ */

/**
 * Extract hidden fields (tokens, IDs, internal references) from forms.
 * @param {string} html Page HTML
 * @returns {{ form: string, name: string, value: string }[]}
 */
export function mineHiddenFields(html = '') {
  const text = String(html);
  const results = [];

  for (const f of extractForms(text)) {
    const form = formLabel(f.attrs);
    const inputRe = /<input\b([^>]*)>/gi;
    let im;
    while ((im = inputRe.exec(f.inner)) !== null) {
      const type = (attrValue(im[1], 'type') || '').toLowerCase();
      if (type !== 'hidden') continue;
      const name = attrValue(im[1], 'name');
      if (!name) continue;
      results.push({ form, name, value: attrValue(im[1], 'value') });
    }
  }
  return results;
}

/**
 * Extract <option> elements from select/datalist inner HTML, tolerating the
 * optional </option> end tag common in real-world markup.
 * @param {string} inner Inner HTML of a <select> or <datalist>
 * @returns {{ attrs: string, inner: string }[]}
 */
function extractOptions(inner) {
  const results = [];
  const re = /<option\b([^>]*)>([\s\S]*?)(?=<option\b|<\/)/gi;
  let m;
  while ((m = re.exec(inner)) !== null) results.push({ attrs: m[1], inner: m[2] });
  return results;
}

/* ------------------------------------------------------------------ */
/* 766 — Select-option URL mining                                      */
/* ------------------------------------------------------------------ */

const URL_LIKE_RE = /^(?:https?:\/\/|\/\/|www\.|\/)/i;

/**
 * Extract URLs from <select> options used for navigation (jump menus,
 * locale switchers, "go to" dropdowns).
 * @param {string} html Page HTML
 * @returns {{ select: string, label: string, url: string }[]}
 */
export function mineSelectOptionUrls(html = '') {
  const text = String(html);
  const results = [];

  const selectRe = /<select\b([^>]*)>([\s\S]*?)<\/select>/gi;
  let sm;
  while ((sm = selectRe.exec(text)) !== null) {
    const select = elementLabel('select', sm[1]);
    for (const opt of extractOptions(sm[2])) {
      const value = attrValue(opt.attrs, 'value').trim();
      if (!value || !URL_LIKE_RE.test(value)) continue;
      results.push({ select, label: stripTags(opt.inner), url: value });
    }
  }
  return results;
}

/* ------------------------------------------------------------------ */
/* 767 — Datalist value harvesting                                     */
/* ------------------------------------------------------------------ */

/**
 * Harvest <datalist> option values that reveal search terms, filters,
 * and the endpoints behind suggestion widgets.
 * @param {string} html Page HTML
 * @returns {{ datalist: string, values: string[] }[]}
 */
export function harvestDatalistValues(html = '') {
  const text = String(html);
  const results = [];

  const listRe = /<datalist\b([^>]*)>([\s\S]*?)<\/datalist>/gi;
  let lm;
  while ((lm = listRe.exec(text)) !== null) {
    const values = [];
    for (const opt of extractOptions(lm[2])) {
      const value = attrValue(opt.attrs, 'value').trim();
      const textContent = stripTags(opt.inner);
      const entry = value || textContent;
      if (entry && !values.includes(entry)) values.push(entry);
    }
    if (values.length > 0) {
      results.push({ datalist: elementLabel('datalist', lm[1]), values });
    }
  }
  return results;
}

/* ------------------------------------------------------------------ */
/* 768 — Autocomplete endpoint discovery                               */
/* ------------------------------------------------------------------ */

const URL_IN_ATTR_RE = /((?:https?:\/\/|\/)[\w\-./?=&%#;:+@~]+)/gi;

/**
 * Find autocomplete endpoint hints: URL-like strings inside oninput /
 * onchange handler attributes and data-api style attributes.
 * @param {string} html Page HTML
 * @returns {{ element: string, source: string, hint: string }[]}
 */
export function findAutocompleteHints(html = '') {
  const text = String(html);
  const results = [];
  const seen = new Set();

  const elRe = /<([a-z][a-z0-9]*)\b([^>]*)>/gi;
  let m;
  while ((m = elRe.exec(text)) !== null) {
    const element = elementLabel(m[1], m[2]);
    const sources = [
      ['oninput', attrValue(m[2], 'oninput')],
      ['onchange', attrValue(m[2], 'onchange')],
      ['data-api', attrValue(m[2], 'data-api')],
      ['data-endpoint', attrValue(m[2], 'data-endpoint')],
      ['data-suggest', attrValue(m[2], 'data-suggest')],
      ['data-autocomplete', attrValue(m[2], 'data-autocomplete')],
      ['data-url', attrValue(m[2], 'data-url')],
    ];
    for (const [source, value] of sources) {
      if (!value) continue;
      let um;
      URL_IN_ATTR_RE.lastIndex = 0;
      while ((um = URL_IN_ATTR_RE.exec(value)) !== null) {
        const hint = um[1];
        const key = `${element}|${source}|${hint}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({ element, source, hint });
      }
    }
  }
  return results;
}

/* ------------------------------------------------------------------ */
/* 769 — Search-suggestion API mapping                                  */
/* ------------------------------------------------------------------ */

/**
 * Map search-as-you-type endpoints from keyup/keydown/keypress handler
 * attributes that embed URL-like API candidates.
 * @param {string} html Page HTML
 * @returns {{ element: string, handler: string, candidate: string }[]}
 */
export function mapSearchSuggestionApis(html = '') {
  const text = String(html);
  const results = [];
  const seen = new Set();

  const elRe = /<([a-z][a-z0-9]*)\b([^>]*)>/gi;
  let m;
  while ((m = elRe.exec(text)) !== null) {
    const element = elementLabel(m[1], m[2]);
    for (const handler of ['onkeyup', 'onkeydown', 'onkeypress']) {
      const value = attrValue(m[2], handler);
      if (!value) continue;
      let um;
      URL_IN_ATTR_RE.lastIndex = 0;
      while ((um = URL_IN_ATTR_RE.exec(value)) !== null) {
        const candidate = um[1];
        const key = `${element}|${handler}|${candidate}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({ element, handler, candidate });
      }
    }
  }
  return results;
}

/* ------------------------------------------------------------------ */
/* 770 — Pagination-link pattern inference                              */
/* ------------------------------------------------------------------ */

const PAGE_PATTERN_RES = [
  /([?&](?:page|p|pg|offset)=)(\d+)/i,
  /(\/(?:page|p|seiten?)\/)(\d+)/i,
];

/**
 * Infer pagination URL patterns from page-numbered links and return a
 * generator that produces deep page URLs from each pattern.
 * @param {string} html Page HTML
 * @returns {{ pattern: string, exampleUrls: string[], count: number,
 *             generator: (page: number) => string }[]}
 */
export function inferPaginationPatterns(html = '') {
  const text = String(html);
  const groups = new Map();

  const hrefRe = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = hrefRe.exec(text)) !== null) {
    const url = m[1];
    for (const re of PAGE_PATTERN_RES) {
      const pm = re.exec(url);
      if (!pm) continue;
      const pattern = url.replace(re, `${pm[1]}{n}`);
      if (!groups.has(pattern)) groups.set(pattern, { exampleUrls: [], count: 0 });
      const g = groups.get(pattern);
      g.count += 1;
      if (g.exampleUrls.length < 3 && !g.exampleUrls.includes(url)) g.exampleUrls.push(url);
      break; // one pattern per link
    }
  }

  return [...groups.entries()].map(([pattern, g]) => ({
    pattern,
    exampleUrls: g.exampleUrls,
    count: g.count,
    generator: (page) => pattern.replace('{n}', String(page)),
  }));
}

/* ------------------------------------------------------------------ */
/* Registry — every idea 761–770 is covered by exactly one function.   */
/* ------------------------------------------------------------------ */

export const FORM_SURFACE_IDEAS = {
  761: 'harvestAriaDescribedByTargets',
  762: 'catalogFormActions',
  763: 'detectMethodOverrides',
  764: 'harvestInputNames',
  765: 'mineHiddenFields',
  766: 'mineSelectOptionUrls',
  767: 'harvestDatalistValues',
  768: 'findAutocompleteHints',
  769: 'mapSearchSuggestionApis',
  770: 'inferPaginationPatterns',
};

/**
 * Report registry coverage for ideas 761–770 (no skipped ideas allowed).
 * @returns {{ covered: number, total: number }}
 */
export function registryComplete() {
  const ids = Object.keys(FORM_SURFACE_IDEAS).map(Number).sort((a, b) => a - b);
  const covered = ids.filter((id) => id >= 761 && id <= 770 && FORM_SURFACE_IDEAS[id]).length;
  return { covered, total: 10 };
}

export default {
  harvestAriaDescribedByTargets,
  catalogFormActions,
  detectMethodOverrides,
  harvestInputNames,
  mineHiddenFields,
  mineSelectOptionUrls,
  harvestDatalistValues,
  findAutocompleteHints,
  mapSearchSuggestionApis,
  inferPaginationPatterns,
  FORM_SURFACE_IDEAS,
  registryComplete,
};
