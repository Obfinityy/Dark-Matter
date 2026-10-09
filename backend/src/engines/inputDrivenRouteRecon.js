/**
 * inputDrivenRouteRecon.js — Input-driven route & asset surface reconnaissance engine.
 *
 * Maps the parts of a web application's attack surface that are only reachable
 * through non-obvious input channels: keyboard shortcuts, voice commands,
 * gestures, haptic triggers, and adaptive asset variants (dark mode,
 * reduced motion, high contrast, font strategies, critical CSS, deferred scripts).
 *
 * Operates purely on HTML/JS/CSS text the hunt agent has already fetched from the
 * target's own publicly served pages (passive/static analysis). No network calls,
 * no execution of target code — fully deterministic.
 *
 * @module inputDrivenRouteRecon
 */

/**
 * Extract a route/action target from a short JS code fragment by recognising
 * common navigation idioms (router.push, navigate(), location.href, history.push).
 *
 * @param {string} code - JS fragment to inspect.
 * @returns {string|null} The extracted route/action or null when unrecognised.
 */
function extractRouteFromCode(code) {
  const patterns = [
    /(?:router|this\.\$router|history)\.push\(\s*['"`]([^'"`]+)['"`]/i,
    /\bnavigate\(\s*['"`]([^'"`]+)['"`]/i,
    /(?:window\.)?location\.(?:href|pathname)\s*=\s*['"`]([^'"`]+)['"`]/i,
    /(?:window\.)?open\(\s*['"`]([^'"`]+)['"`]/i,
    /\bgo\(\s*['"`]([^'"`]+)['"`]/i,
    /\bsetPathname\(\s*['"`]([^'"`]+)['"`]/i,
  ];
  for (const re of patterns) {
    const m = code.match(re);
    if (m) return m[1];
  }
  // Fallback: recognise a named action (function call) so the finding is still useful.
  const fn = code.match(/(?:function\s+(\w+)\s*\(|(?:const|let|var)\s+(\w+)\s*=\s*(?:\([^)]*\)|[a-zA-Z_$][\w$]*)\s*=>)/);
  if (fn) return `action:${fn[1] || fn[2]}`;
  const call = code.match(/\b([a-zA-Z_$][\w$]*)\s*\(\s*\)/);
  if (call && !/^(?:if|for|while|switch|catch)$/.test(call[1])) return `action:${call[1]}`;
  return null;
}

/**
 * Idea 00921 — extract keyboard shortcuts that navigate to hidden routes.
 *
 * Recognises raw keydown/keyup listeners, Mousetrap.bind, keymaster/key(),
 * hotkeys-js and case/switch(e.key) dispatchers, then links each binding to
 * the navigation target found in its handler body.
 *
 * @param {string} htmlOrJs - Raw HTML or JS source.
 * @returns {Array<{shortcut: string, route: string|null, binding: string, line: number}>}
 */
export function extractKeyboardShortcutRoutes(htmlOrJs = '') {
  const src = String(htmlOrJs);
  const lines = src.split('\n');
  const findings = [];
  const seen = new Set();

  const push = (shortcut, route, binding, line) => {
    const key = `${shortcut}::${route}::${line}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ shortcut, route, binding, line });
  };

  // 1. Mousetrap / keymaster / hotkeys style bindings: bind('g d', handler)
  const bindRe = /\b(?:Mousetrap|hotkeys|key)\.(?:bind|add)\(\s*['"`]([^'"`]+)['"`]\s*(?:,\s*['"`][^'"`]*['"`])?\s*,\s*(?:function\s*\([^)]*\)\s*\{([\s\S]{0,400}?)\}|\(([^)]*)\)\s*=>\s*\{([\s\S]{0,400}?)\}|(\w+))/g;
  let m;
  while ((m = bindRe.exec(src)) !== null) {
    const body = m[2] || m[4] || '';
    const route = body ? extractRouteFromCode(body) : null;
    const line = src.slice(0, m.index).split('\n').length;
    push(m[1].trim(), route, m[0].slice(0, 60), line);
  }

  // 1b. keymaster / hotkeys-js direct calls: key('ctrl+s', handler), hotkeys('ctrl+a', handler)
  const directRe = /\b(?:key|hotkeys)\(\s*['"`]([^'"`]+)['"`]\s*,\s*(?:function\s*\([^)]*\)\s*\{([\s\S]{0,400}?)\}|\([^)]*\)\s*=>\s*\{([\s\S]{0,400}?)\}|(\w+))/g;
  while ((m = directRe.exec(src)) !== null) {
    const body = m[2] || m[3] || '';
    const route = body ? extractRouteFromCode(body) : (m[4] ? `action:${m[4]}` : null);
    push(m[1].trim(), route, m[0].slice(0, 40), src.slice(0, m.index).split('\n').length);
  }

  // 2. Raw keydown/keyup listeners with explicit key checks.
  const listenerRe = /addEventListener\(\s*['"`](key(?:down|up|press))['"`]\s*,\s*(?:function\s*\((\w+)\)\s*\{([\s\S]{0,1200})|\((\w+)\)\s*=>\s*\{([\s\S]{0,1200}))/g;
  while ((m = listenerRe.exec(src)) !== null) {
    const ev = m[1];
    const param = m[2] || m[4] || 'e';
    const body = m[3] || m[5] || '';
    const line0 = src.slice(0, m.index).split('\n').length;

    // e.key === 'x' / e.code === 'KeyX' / e.keyCode === 13 comparisons.
    const keyRe = new RegExp(`${param}\\.(?:key|code)\\s*===?\\s*['"\`]([^'"\`]+)['"\`]|${param}\\.keyCode\\s*===?\\s*(\\d+)`, 'g');
    let km;
    while ((km = keyRe.exec(body)) !== null) {
      const key = km[1] || `keyCode:${km[2]}`;
      const tail = body.slice(km.index, km.index + 400);
      // Scope the modifier search to the current statement (after the last block/statement boundary).
      const stmtStart = Math.max(body.lastIndexOf('{', km.index), body.lastIndexOf('}', km.index), body.lastIndexOf(';', km.index)) + 1;
      const ctx = body.slice(stmtStart, km.index + 400);
      const route = extractRouteFromCode(tail);
      // Modifier flags may appear before the key comparison (e.g. e.ctrlKey && e.key === 'k').
      const mods = [];
      if (new RegExp(`${param}\\.(?:ctrlKey|metaKey)`).test(ctx)) mods.push('ctrl');
      if (new RegExp(`${param}\\.shiftKey`).test(ctx)) mods.push('shift');
      if (new RegExp(`${param}\\.altKey`).test(ctx)) mods.push('alt');
      const shortcut = [...mods, key].join('+');
      push(shortcut, route, `addEventListener('${ev}')`, line0);
    }

    // switch (e.key) { case 'x': ... } dispatchers.
    const switchRe = new RegExp(`switch\\s*\\(\\s*${param}\\.key\\s*\\)\\s*\\{([\\s\\S]{0,1500})`);
    const sm = body.match(switchRe);
    if (sm) {
      const caseRe = /case\s*['"`]([^'"`]+)['"`]\s*:\s*([\s\S]{0,300}?)break;/g;
      let cm;
      while ((cm = caseRe.exec(sm[1])) !== null) {
        push(cm[1], extractRouteFromCode(cm[2]), `switch(${param}.key)`, line0);
      }
    }
  }

  return findings.sort((a, b) => a.line - b.line);
}

/**
 * Idea 00922 — map voice commands to app actions and routes.
 *
 * Recognises annyang.addCommands, the Web Speech API (SpeechRecognition /
 * webkitSpeechRecognition), alan.ai button integration and generic
 * `commands: { 'phrase': handler }` maps.
 *
 * @param {string} js - Raw JS source.
 * @returns {Array<{phrase: string, action: string|null, framework: string, line: number}>}
 */
export function mapVoiceCommandActions(js = '') {
  const src = String(js);
  const findings = [];
  const seen = new Set();

  const push = (phrase, action, framework, line) => {
    const key = `${phrase}::${line}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ phrase, action, framework, line });
  };

  // annyang.addCommands({ 'open dashboard': () => router.push('/dashboard') })
  const annyangRe = /annyang\.addCommands\(\s*\{([\s\S]{0,2000}?)\}\s*\)/g;
  let m;
  while ((m = annyangRe.exec(src)) !== null) {
    const body = m[1];
    const entryRe = /['"`]([^'"`]+)['"`]\s*:\s*(?:function\s*\([^)]*\)\s*\{([\s\S]{0,300}?)\}|\([^)]*\)\s*=>\s*\{([\s\S]{0,300}?)\}|(\w+))/g;
    let em;
    while ((em = entryRe.exec(body)) !== null) {
      const action = em[2] || em[3] ? extractRouteFromCode(em[2] || em[3]) : `action:${em[4]}`;
      push(em[1].trim(), action, 'annyang', src.slice(0, m.index).split('\n').length);
    }
  }

  // Web Speech API: recognition.onresult -> transcript keyword mapping.
  const speechRe = /(?:SpeechRecognition|webkitSpeechRecognition)\s*\(\s*\)/g;
  while ((m = speechRe.exec(src)) !== null) {
    const window = src.slice(m.index, m.index + 2500);
    const phraseRe = /(?:includes|indexOf|match|test)\(\s*['"`]([^'"`]+)['"`]\s*\)[\s\S]{0,200}?/;
    const pm = window.match(phraseRe);
    const line = src.slice(0, m.index).split('\n').length;
    push(pm ? pm[1] : '<transcript>', extractRouteFromCode(window), 'web-speech-api', line);
  }

  // alan.ai: alanBtn({ onCommand: ({command}) => ... })
  const alanRe = /alanBtn\(\s*\{([\s\S]{0,800}?)\}\s*\)/;
  const am = src.match(alanRe);
  if (am) {
    const cmdRe = /command\s*===?\s*['"`]([^'"`]+)['"`][\s\S]{0,250}?/;
    const line = src.slice(0, am.index).split('\n').length;
    const cm = am[1].match(cmdRe);
    push(cm ? cm[1] : '<command>', extractRouteFromCode(am[1]), 'alan-ai', line);
  }

  return findings.sort((a, b) => a.line - b.line);
}

/**
 * Idea 00923 — map swipe and gesture handlers to navigation targets.
 *
 * Recognises Hammer.js (`hammer.on('swipeleft', ...)`), raw touchstart/touchend
 * pairs computing swipe deltas, and wheel/gesture event navigation.
 *
 * @param {string} js - Raw JS source.
 * @returns {Array<{gesture: string, target: string|null, library: string, line: number}>}
 */
export function mapGestureNavigationTargets(js = '') {
  const src = String(js);
  const findings = [];
  const seen = new Set();

  const push = (gesture, target, library, line) => {
    const key = `${gesture}::${library}::${line}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ gesture, target, library, line });
  };

  // Hammer.js: new Hammer(el).on('swipeleft panright', handler)
  const hammerRe = /\.on\(\s*['"`]([^'"`]+)['"`]\s*,\s*(?:function\s*\([^)]*\)\s*\{([\s\S]{0,400}?)\}|\([^)]*\)\s*=>\s*\{([\s\S]{0,400}?)\})/g;
  let m;
  while ((m = hammerRe.exec(src)) !== null) {
    const body = m[2] || m[3] || '';
    const events = m[1].split(/\s+/).filter(Boolean);
    const line = src.slice(0, m.index).split('\n').length;
    for (const ev of events) push(ev, extractRouteFromCode(body), 'hammerjs', line);
  }

  // Raw touch: touchstart records X, touchend compares -> swipe.
  const touchRe = /addEventListener\(\s*['"`](touch(?:start|end|move))['"`]\s*,[\s\S]{0,600}?touches\[0\]\.client[XY]/g;
  while ((m = touchRe.exec(src)) !== null) {
    const context = src.slice(m.index, m.index + 1200);
    const dir = /clientX/.test(context) && /<|-|left/i.test(context) ? 'swipe-horizontal' : 'swipe-vertical';
    const line = src.slice(0, m.index).split('\n').length;
    push(dir, extractRouteFromCode(context), 'touch-events', line);
  }

  // Wheel / gesture-driven navigation.
  const wheelRe = /addEventListener\(\s*['"`](?:wheel|gesture(?:start|change|end))['"`]\s*,\s*(?:function\s*\([^)]*\)\s*\{([\s\S]{0,400}?)\}|\([^)]*\)\s*=>\s*\{([\s\S]{0,400}?)\})/g;
  while ((m = wheelRe.exec(src)) !== null) {
    const body = m[1] || m[2] || '';
    push(m[0].match(/['"`](\w+)['"`]/)[1], extractRouteFromCode(body), 'wheel-gesture', src.slice(0, m.index).split('\n').length);
  }

  return findings.sort((a, b) => a.line - b.line);
}

/**
 * Idea 00924 — map haptic triggers to interactive elements.
 *
 * Finds navigator.vibrate(...) / navigator.vibrate(pattern) calls and records
 * the surrounding code context (nearest function/element id) so the hunt agent
 * knows which interactive element fires haptics.
 *
 * @param {string} htmlOrJs - Raw HTML or JS source.
 * @returns {Array<{pattern: string, context: string, line: number}>}
 */
export function mapHapticTriggerElements(htmlOrJs = '') {
  const src = String(htmlOrJs);
  const findings = [];
  const re = /navigator\.vibrate\(\s*(\[[^\]]*\]|\d+)\s*\)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const line = src.slice(0, m.index).split('\n').length;
    // Nearest enclosing function name or element id/class for context.
    const before = src.slice(Math.max(0, m.index - 500), m.index);
    const fn = before.match(/(?:function\s+(\w+)|(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\()/g);
    const el = before.match(/(?:getElementById|querySelector)\(\s*['"`]([^'"`]+)['"`]\s*\)/g);
    const lastFn = fn ? fn[fn.length - 1].replace(/.*(?:function\s+|const\s+|let\s+)/, '').replace(/\s*=\s*$/, '') : null;
    const lastEl = el ? el[el.length - 1].match(/['"`]([^'"`]+)['"`]/)[1] : null;
    findings.push({
      pattern: m[1],
      context: lastEl ? `element:${lastEl}` : lastFn ? `function:${lastFn}` : 'unknown',
      line,
    });
  }
  return findings.sort((a, b) => a.line - b.line);
}

/**
 * Idea 00925 — map dark-mode asset variants for full asset inventory.
 *
 * Detects prefers-color-scheme: dark media queries, [data-theme="dark"]
 * selectors, .dark class rules, Tailwind `dark:` variant classes in HTML,
 * dark-only <picture> <source> entries and dark image URLs.
 *
 * @param {string} htmlOrCss - Raw HTML or CSS source.
 * @returns {Array<{kind: string, selector: string, assets: string[], line: number}>}
 */
export function mapDarkModeAssetVariants(htmlOrCss = '') {
  const src = String(htmlOrCss);
  const findings = [];
  const seen = new Set();

  const push = (kind, selector, assets, line) => {
    const key = `${kind}::${selector}::${line}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ kind, selector, assets, line });
  };

  // @media (prefers-color-scheme: dark) { ... } blocks.
  const mediaRe = /@media[^{]*prefers-color-scheme\s*:\s*dark[^{]*\{([\s\S]{0,3000}?)\n\}/g;
  let m;
  while ((m = mediaRe.exec(src)) !== null) {
    const body = m[1];
    const assets = [...body.matchAll(/url\(\s*['"`]?([^'"`)]+)['"`]?\s*\)/g)].map(x => x[1]);
    const selectors = [...body.matchAll(/([.#\[][^{\n]+?)\s*\{/g)].map(x => x[1].trim()).slice(0, 5);
    push('media-query', selectors.join(', ') || '@media(prefers-color-scheme:dark)', assets, src.slice(0, m.index).split('\n').length);
  }

  // [data-theme="dark"] / .dark / .dark-mode selector rules with assets.
  const darkSelRe = /((?:\[data-theme=['"]?dark['"]?\]|\.dark(?:-mode)?)[^{]*)\{([^}]{0,600})\}/g;
  while ((m = darkSelRe.exec(src)) !== null) {
    const assets = [...m[2].matchAll(/url\(\s*['"`]?([^'"`)]+)['"`]?\s*\)/g)].map(x => x[1]);
    push('dark-selector', m[1].trim(), assets, src.slice(0, m.index).split('\n').length);
  }

  // Tailwind dark: variant classes in HTML.
  const twRe = /class\s*=\s*["']([^"']*\bdark:[^"']*)["']/g;
  while ((m = twRe.exec(src)) !== null) {
    const classes = m[1].split(/\s+/).filter(c => c.startsWith('dark:'));
    push('tailwind-variant', classes.join(' '), [], src.slice(0, m.index).split('\n').length);
  }

  // <picture><source media="(prefers-color-scheme: dark)" srcset="...">
  const picRe = /<source[^>]*media\s*=\s*["'][^"']*prefers-color-scheme:\s*dark[^"']*["'][^>]*srcset\s*=\s*["']([^"']+)["'][^>]*>/g;
  while ((m = picRe.exec(src)) !== null) {
    push('picture-source', 'source[media=prefers-color-scheme:dark]', m[1].split(/[,\s]+/).filter(Boolean), src.slice(0, m.index).split('\n').length);
  }

  return findings.sort((a, b) => a.line - b.line);
}

/**
 * Idea 00926 — map reduced-motion fallbacks that load alternate assets.
 *
 * Detects prefers-reduced-motion media queries, JS matchMedia checks for
 * reduced motion, and animation: none overrides — the assets/behaviour that
 * load when the user prefers reduced motion.
 *
 * @param {string} htmlOrCss - Raw HTML or CSS source.
 * @returns {Array<{kind: string, detail: string, assets: string[], line: number}>}
 */
export function mapReducedMotionFallbacks(htmlOrCss = '') {
  const src = String(htmlOrCss);
  const findings = [];
  const seen = new Set();

  const push = (kind, detail, assets, line) => {
    const key = `${kind}::${detail}::${line}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ kind, detail, assets, line });
  };

  // @media (prefers-reduced-motion: reduce) { ... }
  const mediaRe = /@media[^{]*prefers-reduced-motion\s*:\s*(reduce|no-preference)[^{]*\{([\s\S]{0,3000}?)\n\}/g;
  let m;
  while ((m = mediaRe.exec(src)) !== null) {
    const body = m[2];
    const assets = [...body.matchAll(/url\(\s*['"`]?([^'"`)]+)['"`]?\s*\)/g)].map(x => x[1]);
    const animationsDisabled = /animation\s*:\s*none|transition\s*:\s*none/.test(body);
    push('media-query', `prefers-reduced-motion:${m[1]}${animationsDisabled ? ' (animations disabled)' : ''}`, assets, src.slice(0, m.index).split('\n').length);
  }

  // JS: matchMedia('(prefers-reduced-motion: reduce)')
  const jsRe = /matchMedia\(\s*['"`]\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)['"`]\s*\)/g;
  while ((m = jsRe.exec(src)) !== null) {
    const context = src.slice(m.index, m.index + 400);
    const alt = context.match(/['"`]([^'"`]*static[^'"`]*|[^'"`]*still[^'"`]*)['"`]/);
    push('js-check', 'matchMedia prefers-reduced-motion', alt ? [alt[1]] : [], src.slice(0, m.index).split('\n').length);
  }

  return findings.sort((a, b) => a.line - b.line);
}

/**
 * Idea 00927 — map high-contrast stylesheets and assets.
 *
 * Detects forced-colors / -ms-high-contrast media queries, high-contrast
 * <link> stylesheets (media attr or hc filename hints) and forced-color-adjust rules.
 *
 * @param {string} htmlOrCss - Raw HTML or CSS source.
 * @returns {Array<{kind: string, detail: string, href: string|null, line: number}>}
 */
export function mapHighContrastAssets(htmlOrCss = '') {
  const src = String(htmlOrCss);
  const findings = [];
  const seen = new Set();

  const push = (kind, detail, href, line) => {
    const key = `${kind}::${detail}::${line}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ kind, detail, href, line });
  };

  // <link rel="stylesheet" media="(forced-colors: active)" href="hc.css">
  const linkRe = /<link[^>]*>/g;
  let m;
  while ((m = linkRe.exec(src)) !== null) {
    const tag = m[0];
    const href = (tag.match(/href\s*=\s*["']([^"']+)["']/) || [])[1] || null;
    const media = (tag.match(/media\s*=\s*["']([^"']+)["']/) || [])[1] || '';
    const isHcMedia = /forced-colors|-ms-high-contrast/.test(media);
    const isHcFile = href && /high-contrast|hc\.|contrast/i.test(href) && /stylesheet/i.test(tag);
    if (isHcMedia || isHcFile) {
      push('stylesheet', media || 'high-contrast filename', href, src.slice(0, m.index).split('\n').length);
    }
  }

  // @media (forced-colors: active) / (-ms-high-contrast: active) blocks.
  const mediaRe = /@media[^{]*(forced-colors\s*:\s*active|-ms-high-contrast\s*:\s*active)[^{]*\{([\s\S]{0,2000}?)\n\}/g;
  while ((m = mediaRe.exec(src)) !== null) {
    const adjust = /forced-color-adjust\s*:\s*none/.test(m[2]);
    push('media-query', `@media(${m[1]})${adjust ? ' (forced-color-adjust:none)' : ''}`, null, src.slice(0, m.index).split('\n').length);
  }

  return findings.sort((a, b) => a.line - b.line);
}

/**
 * Idea 00928 — map font-display strategies to font hosts.
 *
 * Parses @font-face blocks for font-display values and src URLs, groups
 * strategies (swap/block/fallback/optional) per host, and records
 * preconnect/preload font hints from <link> tags.
 *
 * @param {string} htmlOrCss - Raw HTML or CSS source.
 * @returns {Array<{host: string, strategy: string, families: string[], sampleUrls: string[]}>}
 */
export function mapFontLoadingStrategies(htmlOrCss = '') {
  const src = String(htmlOrCss);
  /** @type {Map<string, {host: string, strategy: string, families: string[], sampleUrls: string[]}>} */
  const byHost = new Map();

  const hostOf = url => {
    try {
      const u = new URL(url, 'https://placeholder.local');
      return u.hostname === 'placeholder.local' ? '(same-origin)' : u.hostname;
    } catch {
      return '(same-origin)';
    }
  };

  // @font-face { font-family: X; font-display: swap; src: url(...) ... }
  const faceRe = /@font-face\s*\{([^}]{0,1200})\}/g;
  let m;
  while ((m = faceRe.exec(src)) !== null) {
    const body = m[1];
    const family = (body.match(/font-family\s*:\s*['"`]?([^;'"`]+)['"`]?/) || [])[1]?.trim() || '(unnamed)';
    const strategy = (body.match(/font-display\s*:\s*(\w+)/) || [])[1] || '(unspecified)';
    const urls = [...body.matchAll(/url\(\s*['"`]?([^'"`)]+)['"`]?\s*\)/g)].map(x => x[1]);
    for (const url of urls) {
      const host = hostOf(url);
      const key = `${host}::${strategy}`;
      if (!byHost.has(key)) byHost.set(key, { host, strategy, families: [], sampleUrls: [] });
      const entry = byHost.get(key);
      if (!entry.families.includes(family)) entry.families.push(family);
      if (entry.sampleUrls.length < 3 && !entry.sampleUrls.includes(url)) entry.sampleUrls.push(url);
    }
  }

  // <link rel="preconnect|preload" href="https://fonts.gstatic.com">
  const linkRe = /<link[^>]*>/g;
  while ((m = linkRe.exec(src)) !== null) {
    const tag = m[0];
    const rel = (tag.match(/rel\s*=\s*["']([^"']+)["']/) || [])[1] || '';
    const href = (tag.match(/href\s*=\s*["']([^"']+)["']/) || [])[1] || null;
    if (!href || !/preconnect|preload|dns-prefetch/.test(rel)) continue;
    const host = hostOf(href);
    const key = `${host}::hint:${rel}`;
    if (!byHost.has(key)) byHost.set(key, { host, strategy: `link-hint:${rel}`, families: [], sampleUrls: [href] });
  }

  return [...byHost.values()].sort((a, b) => a.host.localeCompare(b.host) || a.strategy.localeCompare(b.strategy));
}

/**
 * Idea 00929 — extract critical CSS URLs for above-fold asset mapping.
 *
 * Collects preload-as-style links, blocking stylesheets (media=all or no
 * media), inline <style> blocks flagged as critical, and stylesheet URLs
 * referenced by loadCSS-style loaders.
 *
 * @param {string} html - Raw HTML source.
 * @returns {Array<{url: string|null, kind: string, line: number}>}
 */
export function extractCriticalCssUrls(html = '') {
  const src = String(html);
  const findings = [];
  const seen = new Set();

  const push = (url, kind, line) => {
    const key = `${url}::${kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ url, kind, line });
  };

  // <link rel="preload" as="style" href="..."> and <link rel="stylesheet" ...>
  const linkRe = /<link[^>]*>/g;
  let m;
  while ((m = linkRe.exec(src)) !== null) {
    const tag = m[0];
    const rel = (tag.match(/rel\s*=\s*["']([^"']+)["']/) || [])[1] || '';
    const href = (tag.match(/href\s*=\s*["']([^"']+)["']/) || [])[1] || null;
    if (!href) continue;
    const media = (tag.match(/media\s*=\s*["']([^"']+)["']/) || [])[1] || 'all';
    const line = src.slice(0, m.index).split('\n').length;
    if (/preload/.test(rel) && /as\s*=\s*["']style["']/.test(tag)) {
      push(href, 'preload-style', line);
    } else if (/stylesheet/.test(rel) && (/all/.test(media) || !/print|screen and/.test(media))) {
      push(href, media === 'all' ? 'blocking-stylesheet' : `media:${media}`, line);
    }
  }

  // Inline critical <style> blocks (data-critical or id=critical).
  const styleRe = /<style([^>]*)>([\s\S]{0,5000}?)<\/style>/g;
  while ((m = styleRe.exec(src)) !== null) {
    if (/data-critical|critical/i.test(m[1])) {
      push(null, 'inline-critical', src.slice(0, m.index).split('\n').length);
    }
  }

  return findings.sort((a, b) => a.line - b.line);
}

/**
 * Idea 00930 — map deferred scripts' execution order to dependency graphs.
 *
 * Parses script tags in document order, classifies defer/async/module/inline,
 * and builds an execution-order model: deferred scripts execute in document
 * order after parsing, async execute in load order, modules are deferred by
 * default. Edges link each deferred script to its predecessor.
 *
 * @param {string} html - Raw HTML source.
 * @returns {{scripts: Array<{src: string|null, kind: string, order: number, execOrder: number}>, edges: Array<{from: number, to: number, relation: string}>}}
 */
export function mapDeferredScriptExecutionGraph(html = '') {
  const src = String(html);
  const scripts = [];
  const scriptRe = /<script([^>]*)>([\s\S]*?)<\/script>|<script([^>]*)\/>/g;
  let m;
  let order = 0;
  while ((m = scriptRe.exec(src)) !== null) {
    const attrs = m[1] || m[3] || '';
    const body = (m[2] || '').trim();
    const srcAttr = (attrs.match(/\ssrc\s*=\s*["']([^"']+)["']/) || [])[1] || null;
    if (!srcAttr && !body) continue; // empty script tag
    const isDefer = /\sdefer(?:\s|=|>)/.test(attrs + ' ');
    const isAsync = /\sasync(?:\s|=|>)/.test(attrs + ' ');
    const isModule = /type\s*=\s*["']module["']/.test(attrs);
    const kind = isModule ? (isAsync ? 'module-async' : 'module-deferred') : isDefer ? 'deferred' : isAsync ? 'async' : srcAttr ? 'blocking' : 'inline';
    scripts.push({ src: srcAttr, kind, order: order++, execOrder: -1, inline: !srcAttr });
  }

  // Execution order model: blocking/inline execute immediately in order,
  // deferred + module-deferred execute after parsing in document order,
  // async/module-async execute in unpredictable load order (marked -1).
  let exec = 0;
  for (const s of scripts) {
    if (s.kind === 'blocking' || s.kind === 'inline') s.execOrder = exec++;
  }
  const deferredFirst = exec;
  for (const s of scripts) {
    if (s.kind === 'deferred' || s.kind === 'module-deferred') s.execOrder = exec++;
  }

  // Dependency graph edges: each deferred script depends on earlier ones.
  const edges = [];
  const deferredSeq = scripts.filter(s => s.kind === 'deferred' || s.kind === 'module-deferred');
  for (let i = 1; i < deferredSeq.length; i++) {
    edges.push({ from: deferredSeq[i - 1].order, to: deferredSeq[i].order, relation: 'executes-after' });
  }
  // DOMContentLoaded gate for deferred scripts.
  if (deferredSeq.length > 0) {
    edges.push({ from: deferredFirst > 0 ? scripts[deferredFirst - 1]?.order ?? -1 : -1, to: deferredSeq[0].order, relation: 'after-dom-parse' });
  }

  return { scripts, edges };
}

export const INPUT_DRIVEN_ROUTE_RECON = {
  extractKeyboardShortcutRoutes,
  mapVoiceCommandActions,
  mapGestureNavigationTargets,
  mapHapticTriggerElements,
  mapDarkModeAssetVariants,
  mapReducedMotionFallbacks,
  mapHighContrastAssets,
  mapFontLoadingStrategies,
  extractCriticalCssUrls,
  mapDeferredScriptExecutionGraph,
};

export default INPUT_DRIVEN_ROUTE_RECON;
