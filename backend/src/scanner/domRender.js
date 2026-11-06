// Dark Matter rule-based scanner — DOM form discovery for SPA targets.
//
// DIAGNOSIS (6 Nov 2026, param-battery skip diagnosis, parent-verified):
// the 28 skipped phases on Juice Shop / bWAPP / VAmPI mean zero
// param-bearing targets on the pasted page. Juice Shop is an SPA: its
// root returns the Angular shell, static analysis finds 0 forms, so the
// injection battery never runs there — yet its baseline (6 findings)
// was produced without injection testing on it.
//
// WHY STATIC ANALYSIS CANNOT FIX THIS: even a full JS render of the
// Juice Shop ROOT yields zero named inputs and zero <form> tags (live
// proof 6 Nov 2026, transient-container chromium --dump-dom on EC2:
// 272KB rendered DOM, exactly one <input> — the navbar search box,
// nameless + disabled). Angular reactive forms have no <form> element
// and most controls carry no name attribute. The app's forms live on
// its ROUTES: /#/login renders two NAMED standalone inputs
// (email, password). So this pass renders the pasted page AND the
// same-origin SPA routes it links to (routerlink / hash hrefs), and
// merges every named input/form into the existing target builder.
// A pasted-page-only render would still find nothing on Juice root —
// route discovery is the unlock, not an optional extra.
//
// MECHANISM (reuses the repo's proven paths, no new dependency):
// - Render: `chromium --headless=new --dump-dom` — the exact command
//   guiTools.js headlessSnapshot has used inside hunt containers since
//   Oct 2026 (same flags, same 60s timeout, same virtual-time-budget
//   shape). It runs in a TRANSIENT `docker run --rm` container from
//   the hunt image (darkmatter/hunt:latest, already on EC2 with
//   chromium installed). The hunt image's ENTRYPOINT is /opt/hunt/run.sh
//   (Dockerfile.hunt:301) — without `--entrypoint chromium` the args
//   are swallowed by the hunt agent, which fails with "no target"
//   (proven live 6 Nov 2026: the first render attempt returned the
//   agent's {"state":"failed","error":"no target"} JSON, not a DOM).
// - Inventory: the rendered HTML goes through the SAME analyzePage()
//   the static path uses — a DOM form is just HTML once rendered.
//   No new parser, no fake DOM: if the render fails, the pass fails
//   honestly (phase ok:false) and the scan continues static-only.
// - Scope: read-only GET rendering only. No clicks, no typing, no
//   form submission by the render itself — the merged forms/inputs
//   flow into the existing target builder (the param battery only
//   GETs the synthesised targets; the dedicated post-forms probe
//   still POSTs to POST forms by design, exactly as for static forms).
//   Network posture equals the existing host-side fetchPage: the
//   transient container fetches the same pasted URL the backend
//   already GETs from the host process.
// - Cost: one render per page (pasted + up to DOM_MAX_ROUTES routes),
//   ~10s each on EC2. The pass fires ONLY when static analysis found
//   zero forms/inputs/textareas/selects, so DVWA/WebGoat-style
//   server-rendered targets never pay it and their rollups are
//   byte-identical.
//
// What this does NOT do (honest limits):
// - It cannot invent a param name: an input with no `name` attribute
//   (Juice Shop's search box, its contact-form fields) is still
//   invisible to the battery — analyzePage requires a name, and using
//   the element `id` as a param name would probe a surface that does
//   not exist. Only NAMED controls become targets.
// - It does not reach API endpoints (/rest/*): the battery probes page
//   URLs, and a SPA's JSON login/search APIs are a separate (API-driven)
//   surface — same honest limit as the static battery.
// - VAmPI (pure API, no HTML) and bWAPP (lab defect, DB gone) are out
//   of scope for this pass by construction.
import { runCmd } from './runner.js';
import { analyzePage } from './pageAnalyze.js';

// Same image default as huntRunner.js HUNT_IMAGE (kept as a literal
// here on purpose: importing huntRunner into the scanner would drag
// the container/egress machinery into the probe path).
export const DOM_RENDER_IMAGE = process.env.HUNT_IMAGE || 'darkmatter/hunt:latest';
export const DOM_RENDER_TIMEOUT_MS = 60000;
export const DOM_VIRTUAL_TIME_BUDGET_MS = 8000;
export const DOM_MAX_ROUTES = 5;
export const DOM_MAX_HTML_BYTES = 500000;

/**
 * Pure builder for the transient-container render command.
 * The --entrypoint override is load-bearing: without it the hunt
 * image's ENTRYPOINT (/opt/hunt/run.sh) swallows the chromium args
 * and the "render" returns the agent's no-target JSON instead of a DOM.
 */
export function buildDomRenderArgs(url, opts = {}) {
  const image = opts.image || DOM_RENDER_IMAGE;
  const budget =
    Number.isFinite(opts.virtualTimeBudgetMs) && opts.virtualTimeBudgetMs > 0
      ? opts.virtualTimeBudgetMs
      : DOM_VIRTUAL_TIME_BUDGET_MS;
  return [
    'run',
    '--rm',
    '--entrypoint',
    'chromium',
    image,
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    `--virtual-time-budget=${budget}`,
    '--dump-dom',
    String(url),
  ];
}

/**
 * Render one URL in a real browser (transient container) and return
 * its DOM as HTML. Never throws: any failure (no docker, no image,
 * timeout, empty output) returns { ok:false, error } so the caller
 * can fail honestly and the scan continues static-only.
 * opts.runner is the test seam (defaults to runCmd, same as nuclei).
 */
export async function renderDom(url, opts = {}) {
  const startedAt = Date.now();
  const runner = typeof opts.runner === 'function' ? opts.runner : runCmd;
  const timeoutMs =
    Number.isFinite(opts.timeoutMs) && opts.timeoutMs > 0 ? opts.timeoutMs : DOM_RENDER_TIMEOUT_MS;
  const durationMs = () => Date.now() - startedAt;
  let res;
  try {
    res = await runner('docker', buildDomRenderArgs(url, opts), { timeoutMs });
  } catch (e) {
    return { ok: false, html: '', error: e && e.message ? String(e.message) : String(e), durationMs: durationMs() };
  }
  const html = String((res && res.stdout) || '');
  if (!res || !res.ok || !html.trim()) {
    const detail = String((res && res.stderr) || '').trim().slice(0, 300);
    return {
      ok: false,
      html: '',
      error: detail || (res && res.timedOut ? 'dom render timed out' : 'dom render produced no output'),
      durationMs: durationMs(),
    };
  }
  return { ok: true, html: html.slice(0, DOM_MAX_HTML_BYTES), error: null, durationMs: durationMs() };
}

/**
 * Extract the same-origin SPA routes a rendered page links to, in DOM
 * order, capped at DOM_MAX_ROUTES. Sources: `href` attributes (the
 * navigable URL, hash included) and `routerlink` attributes (Angular
 * buttons carry routes with no href). A routerlink path maps to a hash
 * route (#/login, not /login) when the DOM shows the app uses hash
 * routing (any href="#/..."); without that evidence it resolves as a
 * plain path. Pure — exported for unit tests.
 */
export function extractSpaRoutes(html, baseUrl) {
  const routes = [];
  const seen = new Set();
  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    return routes;
  }
  const body = String(html || '');
  const hasHashRoutes = /href\s*=\s*["']#\//i.test(body);
  const re = /(?:routerlink|href)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  let m;
  while ((m = re.exec(body))) {
    if (routes.length >= DOM_MAX_ROUTES) break;
    const raw = (m[1] !== undefined ? m[1] : m[2] || '').trim();
    if (!raw || raw === '#' || raw === '#/') continue;
    if (/^(javascript|mailto|tel|data):/i.test(raw)) continue;
    let candidate = raw;
    // routerlink="/login" on a hash-routed app navigates to #/login —
    // the router reads the fragment, so /login would render root.
    if (hasHashRoutes && candidate.startsWith('/') && !candidate.startsWith('//')) {
      candidate = `#${candidate}`;
    }
    let u;
    try {
      u = new URL(candidate, baseUrl);
    } catch {
      continue;
    }
    if (u.protocol !== base.protocol || u.host !== base.host) continue;
    // The pasted page itself (same URL, or the bare hash root) is not
    // a route to re-render.
    if (u.toString() === base.toString()) continue;
    if (u.hash === '#/' || u.hash === '#') continue;
    const key = u.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    routes.push(key);
  }
  return routes;
}

/**
 * Discover DOM forms/inputs for one pasted page: render it, extract
 * its SPA routes, render each, and merge every analysis into one
 * analyzePage-shaped object. Standalone inputs found on a route carry
 * `page: <routeUrl>` so the target builder synthesises their GET
 * target against the route they live on (the fragment survives in the
 * evidence URL; the server sees the same shell either way). In-form
 * inputs need no marker — analyzePage already resolves their action
 * against the route URL. Never throws: a failed pasted-page render
 * returns { analysis: null, errors }; a failed route render is
 * recorded and the remaining routes still render.
 * opts.domRender is the test seam (defaults to renderDom).
 */
export async function discoverDomForms(url, opts = {}) {
  const render = typeof opts.domRender === 'function' ? opts.domRender : renderDom;
  const errors = [];
  const rendered = [];
  const maxRoutes =
    Number.isInteger(opts.domMaxRoutes) && opts.domMaxRoutes >= 0 ? opts.domMaxRoutes : DOM_MAX_ROUTES;

  const renderOne = async (targetUrl) => {
    try {
      return await render(targetUrl, opts);
    } catch (e) {
      return { ok: false, html: '', error: e && e.message ? String(e.message) : String(e) };
    }
  };

  const first = await renderOne(url);
  rendered.push({
    url,
    ok: Boolean(first && first.ok),
    bytes: first && first.html ? String(first.html).length : 0,
    error: first && !first.ok ? first.error || 'render failed' : null,
  });
  if (!first || !first.ok || !String(first.html || '').trim()) {
    errors.push(`dom render failed for ${url}: ${(first && first.error) || 'no output'}`);
    return { analysis: null, errors, rendered };
  }

  const analysis = analyzePage(first.html, url);
  const routes = extractSpaRoutes(first.html, url).slice(0, maxRoutes);
  for (const routeUrl of routes) {
    const r = await renderOne(routeUrl);
    rendered.push({
      url: routeUrl,
      ok: Boolean(r && r.ok),
      bytes: r && r.html ? String(r.html).length : 0,
      error: r && !r.ok ? r.error || 'render failed' : null,
    });
    if (!r || !r.ok || !String(r.html || '').trim()) {
      errors.push(`dom render failed for ${routeUrl}: ${(r && r.error) || 'no output'}`);
      continue;
    }
    const ra = analyzePage(r.html, routeUrl);
    analysis.forms.push(...(ra.forms || []));
    // Standalone controls live on the route, not the pasted page —
    // mark them so their synthesised target uses the route URL.
    for (const inp of ra.inputs || []) {
      analysis.inputs.push(inp.form ? inp : { ...inp, page: routeUrl });
    }
    for (const t of ra.textareas || []) {
      analysis.textareas.push(t.form ? t : { ...t, page: routeUrl });
    }
    for (const s of ra.selects || []) {
      analysis.selects.push(s.form ? s : { ...s, page: routeUrl });
    }
    analysis.buttons.push(...(ra.buttons || []));
    for (const p of ra.params || []) {
      if (!analysis.params.includes(p)) analysis.params.push(p);
    }
  }
  return { analysis, errors, rendered };
}
