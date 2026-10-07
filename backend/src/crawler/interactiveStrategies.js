/**
 * interactiveStrategies.js — Interactive-crawl strategy generation for the
 * authorized agent's headless browser.
 *
 * Many targets are single-page applications whose routes only appear after
 * user interaction: clicks, form submits, wizard steps, tab switches and
 * infinite scroll. This module generates DETERMINISTIC crawl action plans
 * from a description of the page state plus DOM-string analyzers that
 * extract routes from rendered HTML. It does not drive a real browser —
 * the agent's browser driver consumes these plans step by step.
 *
 * Ideas covered:
 *  - 716 Headless-browser interactive crawling (click / fill / scroll action
 *        plans from a page-state description so SPA content renders first)
 *  - 717 Infinite-scroll pagination harvesting (scroll action sequences +
 *        item-URL harvest planning)
 *  - 718 Form-fill state exploration (benign value plans that reach
 *        post-submit states and their routes)
 *  - 719 Multi-step wizard traversal (wizard step enumeration + traversal plan)
 *  - 720 Tab-interface content extraction (tab activation plan + lazy-content
 *        route extraction)
 *
 * Defensive by construction: plans describe ordinary user interactions
 * (clicking visible buttons, filling forms with clearly benign placeholder
 * values, scrolling). Nothing here submits hostile input, bypasses
 * controls, or automates against a non-authorized target.
 */

/**
 * An action plan step.
 * @typedef {object} CrawlAction
 * @property {string} action one of click|fill|scroll|navigate|activate-tab|submit|wait|extract
 * @property {string} [selector] CSS selector for the element
 * @property {string} [value] value to fill (benign placeholders only)
 * @property {number} [amount] scroll distance in pixels or scroll count
 * @property {string} [reason] why this step exists
 */

/**
 * Build a CSS-ish selector for an element described by tag, id, class, name.
 * @param {object} el element description {tag,id,class,name,text}
 * @returns {string} selector string
 */
export function selectorFor(el) {
  if (!el || typeof el !== 'object') return '';
  const tag = (el.tag || '*').toLowerCase();
  if (el.id) return `${tag}#${el.id}`;
  if (el.class) {
    const cls = String(el.class).trim().split(/\s+/)[0];
    if (cls) return `${tag}.${cls}`;
  }
  if (el.name) return `${tag}[name="${el.name}"]`;
  if (el.text) return `${tag}:contains("${String(el.text).slice(0, 40)}")`;
  return tag;
}

// ---------------------------------------------------------------------------
// Idea 716 — Headless-browser interactive crawling
// ---------------------------------------------------------------------------

/**
 * Generate an interaction plan that renders SPA content before extraction.
 * The page-state description lists clickable elements and forms the
 * crawler's DOM analysis already found; this function orders the safe
 * interactions (clicks, scrolls, waits) and ends with extraction steps.
 * @param {object} pageState { url, clickables?:Array, forms?:Array, scrolled?:boolean }
 * @returns {Array<CrawlAction>} ordered action plan
 */
export function planInteractiveCrawl(pageState) {
  const plan = [];
  const state = pageState || {};
  if (!state.url) return plan;

  // 1. Scroll once to trigger viewport-lazy content.
  if (!state.scrolled) {
    plan.push({ action: 'scroll', amount: 1200, reason: 'trigger viewport-lazy rendering' });
    plan.push({ action: 'wait', value: '500ms', reason: 'let lazy components mount' });
  }

  // 2. Click each safe clickable once.
  for (const el of state.clickables || []) {
    const selector = selectorFor(el);
    if (!selector) continue;
    const label = (el.text || el.ariaLabel || '').toLowerCase();
    if (/logout|delete|remove|close account/i.test(label)) continue; // never destructive
    plan.push({ action: 'click', selector, reason: `activate "${(el.text || el.tag || 'element').slice(0, 48)}"` });
    plan.push({ action: 'extract', selector: 'a[href]', reason: 'harvest links revealed by interaction' });
  }

  // 3. Forms get benign fill plans (delegated to idea 718).
  for (const form of state.forms || []) {
    plan.push(...planFormFill({ forms: [form] }, { submit: false }));
  }

  plan.push({ action: 'extract', selector: 'a[href]', reason: 'final link harvest after interactions' });
  return plan;
}

// ---------------------------------------------------------------------------
// Idea 717 — Infinite-scroll pagination harvesting
// ---------------------------------------------------------------------------

/** Markers that suggest an infinite-scroll container. */
export const INFINITE_SCROLL_MARKERS = [
  /infinite-?scroll/i,
  /load-?more/i,
  /data-infinite/i,
  /IntersectionObserver/i,
  /sentinel/i,
];

/**
 * Detect whether HTML hints at infinite-scroll pagination.
 * @param {string} html rendered HTML text
 * @returns {{infinite:boolean, markers:Array<string>, container:string|null}}
 */
export function detectInfiniteScroll(html) {
  const text = String(html || '');
  const hits = INFINITE_SCROLL_MARKERS.filter((re) => re.test(text)).map((re) => String(re));
  const cont = text.match(/<(?:div|section|ul)[^>]*(?:class|id)=["'][^"']*(?:infinite|feed|results|items)[^"']*["'][^>]*>/i);
  return { infinite: hits.length > 0, markers: hits, container: cont ? cont[0].slice(0, 120) : null };
}

/**
 * Generate an infinite-scroll harvest plan: repeated scroll actions capped
 * by a deterministic budget, with extraction after each step.
 * @param {object} opts { maxScrolls?:number, scrollAmount?:number, itemSelector?:string }
 * @returns {Array<CrawlAction>} scroll + extract plan
 */
export function planInfiniteScroll(opts = {}) {
  const maxScrolls = Math.min(Math.max(opts.maxScrolls || 10, 1), 50);
  const amount = opts.scrollAmount || 1500;
  const itemSelector = opts.itemSelector || '[data-item], article, .card, li';
  const plan = [];
  for (let i = 0; i < maxScrolls; i++) {
    plan.push({
      action: 'scroll',
      amount,
      reason: `infinite-scroll pass ${i + 1}/${maxScrolls}`,
    });
    plan.push({ action: 'wait', value: '400ms', reason: 'let new items render' });
    plan.push({
      action: 'extract',
      selector: `${itemSelector} a[href]`,
      reason: `harvest item URLs after pass ${i + 1}`,
    });
  }
  return plan;
}

// ---------------------------------------------------------------------------
// Idea 718 — Form-fill state exploration
// ---------------------------------------------------------------------------

/** Benign placeholder values per input type. Never hostile, never real data. */
export const BENIGN_FILL_VALUES = {
  text: 'HuntBot Test',
  search: 'security test query',
  email: 'test@example.com',
  tel: '+10000000000',
  url: 'https://example.com',
  number: '42',
  date: '2026-01-01',
  password: 'TestPass123!',
  textarea: 'Benign automated test input.',
  select: 0,
  checkbox: true,
  radio: 0,
};

/**
 * Pick a benign fill value for a field description.
 * @param {object} field { type, name, options? }
 * @returns {string|number|boolean} benign value
 */
export function benignFillValue(field) {
  const type = String(field?.type || 'text').toLowerCase();
  if (type === 'select' || type === 'radio') return BENIGN_FILL_VALUES[type];
  if (type === 'checkbox') return true;
  return BENIGN_FILL_VALUES[type] ?? BENIGN_FILL_VALUES.text;
}

/**
 * Parse forms and inputs from an HTML string.
 * @param {string} html HTML text
 * @returns {Array} form schemas { action, method, fields:[{type,name,placeholder,required}] }
 */
export function extractFormSchemas(html) {
  const text = String(html || '');
  const forms = [];
  const formRe = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
  let fm;
  while ((fm = formRe.exec(text)) !== null) {
    const attrs = fm[1];
    const inner = fm[2];
    const fields = [];
    const fieldRe = /<(input|select|textarea)\b([^>]*)>/gi;
    let im;
    while ((im = fieldRe.exec(inner)) !== null) {
      const tag = im[1].toLowerCase();
      const a = im[2];
      const pick = (name) => {
        const r = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i');
        const m2 = a.match(r);
        return m2 ? m2[1] : '';
      };
      fields.push({
        type: tag === 'input' ? (pick('type') || 'text') : tag,
        name: pick('name'),
        placeholder: pick('placeholder'),
        required: /\brequired\b/i.test(a),
      });
    }
    const pickAttr = (name) => {
      const r = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i');
      const m2 = attrs.match(r);
      return m2 ? m2[1] : '';
    };
    forms.push({ action: pickAttr('action'), method: (pickAttr('method') || 'get').toLowerCase(), fields });
  }
  return forms;
}

/**
 * Build a benign fill plan for the given forms to reach post-submit states.
 * @param {object} formSet { forms: Array<form schema> }
 * @param {object} [opts] { submit?:boolean } default true
 * @returns {Array<CrawlAction>} fill (+optional submit) actions
 */
export function planFormFill(formSet, opts = {}) {
  const plan = [];
  const submit = opts.submit !== false;
  for (const form of (formSet && formSet.forms) || []) {
    const selector = form.action
      ? `form[action="${form.action}"]`
      : selectorFor({ tag: 'form' });
    for (const field of form.fields || []) {
      if (String(field.type).toLowerCase() === 'hidden') continue;
      const fieldSel = field.name ? `input[name="${field.name}"], select[name="${field.name}"], textarea[name="${field.name}"]` : 'input';
      plan.push({
        action: 'fill',
        selector: `${selector} ${fieldSel}`,
        value: benignFillValue(field),
        reason: `benign fill of ${field.name || field.type}`,
      });
    }
    if (submit) {
      plan.push({
        action: 'submit',
        selector,
        reason: 'reach post-submit state with benign values',
      });
      plan.push({ action: 'extract', selector: 'a[href]', reason: 'harvest routes from post-submit state' });
    }
  }
  return plan;
}

// ---------------------------------------------------------------------------
// Idea 719 — Multi-step wizard traversal
// ---------------------------------------------------------------------------

/** Markup hints of a wizard / stepper component. */
export const WIZARD_MARKERS = [
  /data-?wizard/i,
  /data-?stepper/i,
  /wizard-?step/i,
  /step-?indicator/i,
  /role=["']tablist["']/i,
];

/**
 * Detect wizard structure in HTML: steps, next/back controls.
 * @param {string} html HTML text
 * @returns {{wizard:boolean, steps:Array<string>, nextSelector:string|null, backSelector:string|null}}
 */
export function detectWizardStructure(html) {
  const text = String(html || '');
  const wizard = WIZARD_MARKERS.some((re) => re.test(text));
  const steps = [];
  const stepRe = /data-step(?:-?name)?=["']([^"']{1,60})["']/gi;
  let sm;
  while ((sm = stepRe.exec(text)) !== null) steps.push(sm[1]);
  const btn = (pat) => {
    const m = text.match(new RegExp(`<button[^>]*?(?:${pat})[^>]*>`, 'i'));
    if (!m) return null;
    const id = m[0].match(/id=["']([^"']+)["']/i);
    const cls = m[0].match(/class=["']([^"'\s]+)/i);
    return id ? `button#${id[1]}` : cls ? `button.${cls[1]}` : 'button';
  };
  return {
    wizard,
    steps,
    nextSelector: btn('next|continue|proceed'),
    backSelector: btn('back|previous'),
  };
}

/**
 * Generate a wizard traversal plan that visits every step route.
 * @param {object} wizard { steps:Array<string>, nextSelector?:string, totalSteps?:number }
 * @returns {Array<CrawlAction>} next-step traversal + per-step extraction
 */
export function planWizardTraversal(wizard) {
  const plan = [];
  const w = wizard || {};
  const steps = Array.isArray(w.steps) && w.steps.length ? w.steps : [];
  const total = w.totalSteps || Math.max(steps.length, 1);
  const nextSel = w.nextSelector || 'button';
  for (let i = 0; i < total; i++) {
    plan.push({
      action: 'extract',
      selector: 'a[href]',
      reason: `enumerate routes on wizard step ${steps[i] || i + 1}`,
    });
    if (i < total - 1) {
      plan.push({
        action: 'click',
        selector: nextSel,
        reason: `advance to wizard step ${i + 2} (benign, no destructive confirms)`,
      });
      plan.push({ action: 'wait', value: '400ms', reason: 'let next step render' });
    }
  }
  return plan;
}

// ---------------------------------------------------------------------------
// Idea 720 — Tab-interface content extraction
// ---------------------------------------------------------------------------

/**
 * Detect tab interfaces in HTML: tab buttons and their panels.
 * @param {string} html HTML text
 * @returns {Array} tabs { label, target, panelSelector }
 */
export function detectTabs(html) {
  const text = String(html || '');
  const tabs = [];
  const tabRe = /<(?:button|a|div)[^>]*role=["']tab["'][^>]*>([\s\S]{1,80}?)<\/(?:button|a|div)>/gi;
  let m;
  while ((m = tabRe.exec(text)) !== null) {
    const tag = m[0];
    const ctrl = tag.match(/aria-controls=["']([^"']+)["']/i);
    const label = m[1].replace(/<[^>]*>/g, '').trim().slice(0, 60);
    tabs.push({
      label,
      target: ctrl ? ctrl[1] : '',
      panelSelector: ctrl ? `#${ctrl[1]}` : '',
    });
  }
  // Fallback: data-tab attributes without ARIA roles.
  if (!tabs.length) {
    const dataRe = /<(?:button|a|li)[^>]*data-tab=["']([^"']{1,60})["'][^>]*>([\s\S]{1,80}?)<\/(?:button|a|li)>/gi;
    while ((m = dataRe.exec(text)) !== null) {
      const label = m[2].replace(/<[^>]*>/g, '').trim().slice(0, 60);
      tabs.push({ label, target: m[1], panelSelector: `[data-tab-panel="${m[1]}"]` });
    }
  }
  return tabs;
}

/**
 * Build a tab-activation plan: activate every tab, then extract its
 * lazy-loaded content and routes.
 * @param {Array} tabs output of detectTabs()
 * @returns {Array<CrawlAction>} activate + extract plan
 */
export function planTabExtraction(tabs) {
  const plan = [];
  for (const tab of tabs || []) {
    const selector = tab.panelSelector
      ? `[role="tab"][aria-controls="${tab.target}"], [data-tab="${tab.target}"]`
      : selectorFor({ tag: 'button', text: tab.label });
    plan.push({
      action: 'activate-tab',
      selector,
      reason: `activate tab "${tab.label || tab.target}"`,
    });
    plan.push({ action: 'wait', value: '300ms', reason: 'let lazy tab content load' });
    plan.push({
      action: 'extract',
      selector: tab.panelSelector ? `${tab.panelSelector} a[href]` : 'a[href]',
      reason: `harvest routes from tab "${tab.label || tab.target}"`,
    });
  }
  return plan;
}

// ---------------------------------------------------------------------------
// Shared DOM-string route analyzers
// ---------------------------------------------------------------------------

/**
 * Extract link routes from HTML.
 * @param {string} html HTML text
 * @param {string} [baseUrl] origin used to absolutize relative hrefs
 * @returns {Array} routes { path, source, detail }
 */
export function extractRoutesFromHtml(html, baseUrl = '') {
  const text = String(html || '');
  const routes = [];
  const seen = new Set();
  const hrefRe = /href\s*=\s*["']([^"'#]{1,500})["']/gi;
  let m;
  while ((m = hrefRe.exec(text)) !== null) {
    let href = m[1].trim();
    if (!href || /^(javascript|mailto|tel|data):/i.test(href)) continue;
    if (baseUrl && href.startsWith('/')) {
      try {
        href = new URL(href, baseUrl).toString();
      } catch {
        /* keep relative */
      }
    }
    if (seen.has(href)) continue;
    seen.add(href);
    routes.push({ path: href, source: 'html-link', detail: {} });
  }
  return routes;
}

/**
 * Find clickable elements (buttons, links, inputs) from HTML.
 * @param {string} html HTML text
 * @returns {Array} element descriptions for selectorFor()/planInteractiveCrawl()
 */
export function analyzeClickables(html) {
  const text = String(html || '');
  const out = [];
  const re = /<(button|a|input|select|summary)([^>]*)>([\s\S]{0,120}?)(?:<\/\1>)?/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const tag = m[1].toLowerCase();
    const attrs = m[2];
    const pick = (name) => {
      const r = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i');
      const m2 = attrs.match(r);
      return m2 ? m2[1] : '';
    };
    const type = pick('type');
    if (tag === 'input' && !/^(button|submit|checkbox|radio|image)$/i.test(type)) continue;
    out.push({
      tag,
      id: pick('id'),
      class: pick('class'),
      name: pick('name'),
      text: m[3].replace(/<[^>]*>/g, '').trim(),
      ariaLabel: pick('aria-label'),
    });
  }
  return out;
}

/**
 * Compose a full interactive-crawl plan for a page from its HTML:
 * detects scroll/wizard/tab affordances and merges their plans.
 * @param {string} url page URL
 * @param {string} html rendered HTML text
 * @returns {{url:string, plan:Array<CrawlAction>, detected:object}}
 */
export function composePagePlan(url, html) {
  const detected = {
    infiniteScroll: detectInfiniteScroll(html),
    wizard: detectWizardStructure(html),
    tabs: detectTabs(html),
    forms: extractFormSchemas(html),
    clickables: analyzeClickables(html).length,
  };
  let plan = planInteractiveCrawl({ url, clickables: analyzeClickables(html), forms: detected.forms });
  if (detected.infiniteScroll.infinite) plan = plan.concat(planInfiniteScroll({ maxScrolls: 8 }));
  if (detected.wizard.wizard) {
    plan = plan.concat(
      planWizardTraversal({
        steps: detected.wizard.steps,
        nextSelector: detected.wizard.nextSelector,
        totalSteps: detected.wizard.steps.length || 3,
      })
    );
  }
  if (detected.tabs.length) plan = plan.concat(planTabExtraction(detected.tabs));
  plan.push({ action: 'extract', selector: 'a[href]', reason: 'final route harvest' });
  return { url, plan, detected };
}

export default {
  selectorFor,
  planInteractiveCrawl,
  detectInfiniteScroll,
  planInfiniteScroll,
  benignFillValue,
  extractFormSchemas,
  planFormFill,
  detectWizardStructure,
  planWizardTraversal,
  detectTabs,
  planTabExtraction,
  extractRoutesFromHtml,
  analyzeClickables,
  composePagePlan,
  INFINITE_SCROLL_MARKERS,
  WIZARD_MARKERS,
  BENIGN_FILL_VALUES,
};
