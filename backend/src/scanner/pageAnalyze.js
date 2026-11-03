// Dark Matter rule-based scanner — one-page-deep element analysis.
//
// OWNER MODEL (3 Nov 2026): the user pastes ONE page link. The scanner does
// not spray the whole site — it goes DEEP on that page:
//   1. fingerprint the stack (what the site is built with),
//   2. inventory every element on the page (input boxes, buttons, forms,
//      textareas, selects, URL params — everything),
//   3. for EACH element, look up which vulnerability classes can live in it
//      (ELEMENT_VULN_MATRIX — fully predefined, no AI),
//   4. try every applicable class per element, verify differentially,
//   5. report confirmed findings on the frontend.
// Then the user pastes the next page and it repeats. Minutes per page is
// fine — the scan keeps working automatically until the page is exhausted.
//
// This module is pure (no network): analyzePage() inventories a page body,
// ELEMENT_VULN_MATRIX is the predefined test plan, planForPage() expands it
// into element x vulnerability-class pairs.

/**
 * Predefined test plan: every element kind the scanner understands maps to
 * the vulnerability classes that can live in it. Each class name is a probe
 * phase in the battery (see scanner/index.js DEFAULT_PHASES). A class is
 * tried for an element ONLY if it appears here — nothing is improvised.
 *
 * Out-of-scope notes are explicit so a missing class is a documented
 * decision, not an oversight:
 * - brute-force / credential stuffing: out of scope (needs browser +
 *   rate-limit-safe multi-step flow; documented v1 gap).
 * - file upload: input:file is inventoried but has no probe class yet
 *   (documented gap — the matrix keeps the slot so it can't be forgotten).
 */
export const ELEMENT_VULN_MATRIX = {
  // Text-like inputs: the classic injection surface.
  'input:text': ['sqli-error', 'sqli-blind', 'xss', 'cmdi', 'ssti'],
  'input:search': ['sqli-error', 'sqli-blind', 'xss', 'ssti'],
  'input:email': ['sqli-error', 'xss'],
  'input:url': ['sqli-error', 'xss', 'ssrf', 'redirect'],
  'input:number': ['sqli-error', 'xss'],
  'input:tel': ['sqli-error', 'xss'],
  // Password fields: login inputs are prime injection points.
  'input:password': ['sqli-error', 'sqli-blind', 'xss'],
  // Hidden fields: server-trusted values the client can rewrite.
  'input:hidden': ['sqli-error', 'xss', 'traversal'],
  // File picker: inventoried; upload battery is a documented future slot.
  'input:file': [],
  // Multi-line + choice inputs.
  textarea: ['sqli-error', 'sqli-blind', 'xss', 'ssti'],
  select: ['sqli-error', 'xss'],
  // Query-string parameters on the page URL itself.
  'url-param': [
    'sqli-error',
    'sqli-blind',
    'xss',
    'cmdi',
    'traversal',
    'ssti',
    'redirect',
    'ssrf',
  ],
  // Whole-form properties.
  form: ['csrf', 'post-forms'],
  // Whole-page properties.
  page: ['headers', 'cors', 'cookies', 'files', 'xxe', 'idor'],
};

/** Vulnerability classes applicable to an element kind (never null). */
export function matrixFor(kind) {
  return ELEMENT_VULN_MATRIX[kind] || [];
}

/** Parse tag attributes into a lowercase-keyed object. */
export function extractAttributes(tag) {
  const attrs = {};
  const re = /([a-zA-Z_:][a-zA-Z0-9_:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  // Skip the tag name itself (first match).
  let first = true;
  while ((m = re.exec(String(tag || '')))) {
    if (first) {
      first = false;
      continue;
    }
    const name = m[1].toLowerCase();
    attrs[name] = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : '';
  }
  return attrs;
}

function inputKind(type) {
  const t = String(type || 'text').toLowerCase();
  return `input:${t}`;
}

function parseInputs(inner) {
  const inputs = [];
  const re = /<input\b[^>]*>/gi;
  let m;
  while ((m = re.exec(String(inner || '')))) {
    const attrs = extractAttributes(m[0]);
    if (!attrs.name) continue;
    inputs.push({ name: attrs.name, type: String(attrs.type || 'text').toLowerCase(), id: attrs.id || null });
  }
  return inputs;
}

function parseTextareas(inner) {
  const out = [];
  const re = /<textarea\b[^>]*>/gi;
  let m;
  while ((m = re.exec(String(inner || '')))) {
    const attrs = extractAttributes(m[0]);
    if (!attrs.name) continue;
    out.push({ name: attrs.name, id: attrs.id || null });
  }
  return out;
}

function parseSelects(inner) {
  const out = [];
  const re = /<select\b[^>]*>/gi;
  let m;
  while ((m = re.exec(String(inner || '')))) {
    const attrs = extractAttributes(m[0]);
    if (!attrs.name) continue;
    out.push({ name: attrs.name, id: attrs.id || null });
  }
  return out;
}

function parseButtons(inner) {
  const out = [];
  const re = /<button\b[^>]*>/gi;
  let m;
  while ((m = re.exec(String(inner || '')))) {
    const attrs = extractAttributes(m[0]);
    out.push({ type: String(attrs.type || 'submit').toLowerCase(), name: attrs.name || null });
  }
  // <input type=submit|button|image> also act as buttons.
  const ire = /<input\b[^>]*>/gi;
  while ((m = ire.exec(String(inner || '')))) {
    const attrs = extractAttributes(m[0]);
    const t = String(attrs.type || '').toLowerCase();
    if (t === 'submit' || t === 'button' || t === 'image') {
      out.push({ type: t, name: attrs.name || null });
    }
  }
  return out;
}

/**
 * Inventory every interactable element on one page.
 * Returns { url, forms, inputs, textareas, selects, buttons, params } where
 * each input/textarea/select carries { name, type?, form: {action, method} | null }.
 * Inputs outside any <form> are "standalone" (form: null) — the scanner
 * synthesizes GET targets for them so the param battery still covers them.
 */
export function analyzePage(body, baseUrl) {
  const html = String(body || '');
  const forms = [];
  const formRanges = [];
  const fre = /<form\b[^>]*>([\s\S]*?)<\/form>/gi;
  let m;
  while ((m = fre.exec(html))) {
    const openTag = (/<form\b[^>]*>/i.exec(m[0]) || [])[0] || '';
    const attrs = extractAttributes(openTag);
    let action = attrs.action || baseUrl;
    try {
      action = new URL(action, baseUrl).toString();
    } catch {
      action = baseUrl;
    }
    const method = String(attrs.method || 'get').toLowerCase();
    const inner = m[1];
    const inputs = parseInputs(inner).map((i) => ({ ...i, form: { action, method } }));
    const textareas = parseTextareas(inner).map((t) => ({ ...t, form: { action, method } }));
    const selects = parseSelects(inner).map((s) => ({ ...s, form: { action, method } }));
    forms.push({ action, method, inputs, textareas, selects, buttons: parseButtons(inner) });
    formRanges.push([m.index, m.index + m[0].length]);
  }
  // Aggregate: in-form elements first, then standalone ones.
  const inputs = [];
  const textareas = [];
  const selects = [];
  const buttons = [];
  for (const f of forms) {
    inputs.push(...f.inputs);
    textareas.push(...f.textareas);
    selects.push(...f.selects);
    buttons.push(...f.buttons.map((b) => ({ ...b, form: { action: f.action, method: f.method } })));
  }
  // Standalone elements: strip form blocks, then scan the remainder.
  let stripped = html;
  for (let i = formRanges.length - 1; i >= 0; i--) {
    const [s, e] = formRanges[i];
    stripped = stripped.slice(0, s) + stripped.slice(e);
  }
  for (const i of parseInputs(stripped)) inputs.push({ ...i, form: null });
  for (const t of parseTextareas(stripped)) textareas.push({ ...t, form: null });
  for (const s of parseSelects(stripped)) selects.push({ ...s, form: null });

  let params = [];
  try {
    params = [...new URL(baseUrl).searchParams.keys()];
  } catch {
    params = [];
  }
  return { url: baseUrl, forms, inputs, textareas, selects, buttons, params };
}

/**
 * Expand the page analysis into the full predefined test plan:
 * [{ element, kind, classes }] — one entry per element, classes from the
 * matrix. This is the "ek ek test case predefined" list the owner asked
 * for: auditable, countable, no improvisation.
 */
export function planForPage(analysis) {
  const plan = [];
  const a = analysis || {};
  for (const inp of a.inputs || []) {
    const kind = inputKind(inp.type);
    plan.push({
      element: `input "${inp.name}" (${inp.type || 'text'})${inp.form ? '' : ' [standalone]'}`,
      kind,
      classes: matrixFor(kind),
    });
  }
  for (const t of a.textareas || []) {
    plan.push({ element: `textarea "${t.name}"${t.form ? '' : ' [standalone]'}`, kind: 'textarea', classes: matrixFor('textarea') });
  }
  for (const s of a.selects || []) {
    plan.push({ element: `select "${s.name}"${s.form ? '' : ' [standalone]'}`, kind: 'select', classes: matrixFor('select') });
  }
  for (const p of a.params || []) {
    plan.push({ element: `URL param "${p}"`, kind: 'url-param', classes: matrixFor('url-param') });
  }
  for (const f of a.forms || []) {
    plan.push({ element: `form ${f.method.toUpperCase()} ${f.action}`, kind: 'form', classes: matrixFor('form') });
  }
  plan.push({ element: `page ${a.url || ''}`, kind: 'page', classes: matrixFor('page') });
  return plan;
}
