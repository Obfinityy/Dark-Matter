/**
 * focusTrapBoundaryMapping.js — Focus-trap boundary mapping.
 *
 * Idea 00919: map modal focus traps to dialog routes.
 *
 * Defensive engine: identifies modal dialogs and their focus-trap boundaries
 * (elements with role="dialog", aria-modal, focus-trap libraries, inert
 * siblings) from operator-collected page HTML/JS of an authorized target, and
 * maps each dialog to the routes/actions it exposes. Pure parsing — no network.
 */

const FOCUS_TRAP_LIB_REGEX = /(focus[-_ ]?trap|focus[-_ ]?lock|trap[-_ ]?focus|inert[-_ ]?polyfill|ally\.js|focusOn|tabbable)/i;

/**
 * Find dialog-like containers in page HTML.
 * @param {string} html
 * @returns {{tag: string, id: string|null, role: string|null, ariaModal: boolean, classes: string, snippet: string}[]}
 */
export function findDialogs(html = '') {
  const text = String(html);
  const dialogs = [];
  const re = /<(div|section|dialog|aside)\b([^>]*?)>/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const attrs = m[2];
    const role = (attrs.match(/\brole=["']([^"']+)["']/i) || [])[1] || null;
    const ariaModal = /\baria-modal=["']true["']/i.test(attrs);
    const isDialogTag = m[1].toLowerCase() === 'dialog';
    const classMatch = attrs.match(/\bclass=["']([^"']*)["']/i);
    const classes = classMatch ? classMatch[1] : '';
    const looksModal = /\b(modal|dialog|popup|overlay|lightbox|drawer)\b/i.test(classes);
    if (role === 'dialog' || role === 'alertdialog' || ariaModal || (isDialogTag || looksModal)) {
      const id = (attrs.match(/\bid=["']([^"']+)["']/i) || [])[1] || null;
      dialogs.push({
        tag: m[1].toLowerCase(),
        id,
        role,
        ariaModal,
        classes,
        snippet: m[0].slice(0, 220),
      });
    }
  }
  return dialogs;
}

/**
 * Detect focus-trap wiring in page JS/HTML.
 * @param {string} html - Page HTML/JS text.
 * @returns {{hasFocusTrap: boolean, libraries: string[], inertUsed: boolean}}
 */
export function detectFocusTrap(html = '') {
  const text = String(html);
  const libs = [];
  let m;
  const libRe = new RegExp(FOCUS_TRAP_LIB_REGEX.source, 'gi');
  while ((m = libRe.exec(text)) !== null) {
    const name = m[0].toLowerCase().replace(/[-_ ]/g, '');
    if (!libs.includes(name)) libs.push(name);
  }
  return {
    hasFocusTrap: libs.length > 0 || /\binert\b/i.test(text),
    libraries: libs,
    inertUsed: /\binert\b/i.test(text),
  };
}

/**
 * Map dialogs to the routes/actions they expose (links/forms inside the dialog).
 * @param {string} html
 * @param {string} [baseUrl]
 * @returns {{boundaries: {dialog: object, links: string[], forms: string[], trap: object}[]}}
 */
export function mapFocusTrapBoundaries(html = '', baseUrl = '') {
  const text = String(html);
  const trap = detectFocusTrap(html);
  const dialogs = findDialogs(html);
  const boundaries = dialogs.map(dialog => {
    // Grab a window of HTML after the dialog opening tag as its body.
    const start = text.indexOf(dialog.snippet);
    const body = start >= 0 ? text.slice(start, start + 6000) : '';
    const links = [];
    const linkRe = /<a\b[^>]*?href=["']([^"']+)["']/gi;
    let lm;
    while ((lm = linkRe.exec(body)) !== null) {
      let href = lm[1].replace(/&amp;/g, '&');
      if (/^(javascript|mailto|tel)/i.test(href)) continue;
      if (baseUrl && href.startsWith('/')) {
        try { href = new URL(href, baseUrl).href; } catch { /* keep raw */ }
      }
      if (!links.includes(href)) links.push(href);
      if (links.length >= 25) break;
    }
    const forms = [];
    const formRe = /<form\b[^>]*?\baction=["']([^"']+)["']/gi;
    let fm;
    while ((fm = formRe.exec(body)) !== null) {
      let action = fm[1].replace(/&amp;/g, '&');
      if (baseUrl && action.startsWith('/')) {
        try { action = new URL(action, baseUrl).href; } catch { /* keep raw */ }
      }
      if (!forms.includes(action)) forms.push(action);
      if (forms.length >= 10) break;
    }
    return { dialog, links, forms, trap };
  });
  return { boundaries };
}
