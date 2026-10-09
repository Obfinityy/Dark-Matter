/**
 * testArtifactMiner.js — Test-artifact mining engine.
 *
 * Recovers URLs, endpoints, infrastructure hints and realistic identifiers from
 * test and development artifacts the hunt agent has already fetched from the
 * target's own publicly served pages: Storybook stories, Chromatic snapshots,
 * Playwright/Cypress test files, Selenium Grid configuration, test fixtures
 * and database seed scripts.
 *
 * Operates purely on text already in hand (passive/static analysis).
 * No network calls, no execution of target code — fully deterministic.
 * Credential *references* (environment variable names, fixture keys) are
 * recorded as references only; values are never extracted.
 *
 * @module testArtifactMiner
 */

/**
 * 1-based line number of `idx` in `src`.
 *
 * @param {string} src - Source text.
 * @param {number} idx - Character index.
 * @returns {number} Line number.
 */
function lineOf(src, idx) {
  return src.slice(0, idx).split('\n').length;
}

/**
 * Idea 00964 — enumerate Storybook stories from stories.json or CSF source.
 *
 * Recognises the Storybook `stories.json` index format
 * (`"stories": { "<id>": { title, name, importPath } }`) and Component Story
 * Format exports (`export const Primary = {...}`) with their args/prop names.
 *
 * @param {string} source - Raw JSON or JS text already fetched.
 * @returns {Array<{id: string|null, title: string|null, name: string|null, props: string[], line: number}>}
 */
export function enumerateStorybookStories(source = '') {
  const src = String(source);
  const stories = [];
  const seen = new Set();
  const push = (s) => {
    const key = `${s.id}::${s.name}::${s.title}`;
    if (seen.has(key)) return;
    seen.add(key);
    stories.push(s);
  };

  // 1. stories.json index format.
  const storiesBlock = src.match(/["']stories["']\s*:\s*\{/);
  if (storiesBlock) {
    const openIdx = src.indexOf('{', storiesBlock.index);
    let depth = 0;
    let end = -1;
    for (let i = openIdx; i < src.length; i += 1) {
      if (src[i] === '{') depth += 1;
      if (src[i] === '}') { depth -= 1; if (depth === 0) { end = i; break; } }
    }
    if (end !== -1) {
      const block = src.slice(openIdx, end + 1);
      const entryRe = /["']([^"']+)["']\s*:\s*\{\s*["']id["']\s*:\s*["']([^"']+)["']([\s\S]{0,800}?)\}/g;
      let m;
      while ((m = entryRe.exec(block)) !== null) {
        const tail = m[3];
        const title = (tail.match(/["']title["']\s*:\s*["']([^"']+)["']/) || [])[1] || null;
        const name = (tail.match(/["']name["']\s*:\s*["']([^"']+)["']/) || [])[1] || null;
        push({ id: m[2], title, name, props: [], line: lineOf(src, storiesBlock.index) });
      }
    }
  }

  // 2. CSF default export title: export default { title: 'Components/Button' }.
  const defaultTitle = (src.match(/export\s+default\s*\{[\s\S]{0,600}?title\s*:\s*['"`]([^'"`]+)['"`]/) || [])[1] || null;

  // 3. CSF named story exports with args.
  const storyRe = /export\s+const\s+([A-Za-z_$][\w$]*)\s*(?::\s*Story\b[^=]*)?=\s*\{([\s\S]{0,1500}?)\n\};/g;
  let m;
  while ((m = storyRe.exec(src)) !== null) {
    const body = m[2];
    if (!/\bargs\s*:/.test(body)) continue;
    const argsBlock = body.match(/args\s*:\s*\{((?:[^{}]|\{[^{}]*\}){0,1200})\}/);
    const props = argsBlock
      ? [...argsBlock[1].matchAll(/['"]?([A-Za-z_$][\w$]*)['"]?\s*:/g)]
        .map((r) => r[1])
        .filter((v, i, a) => a.indexOf(v) === i)
      : [];
    push({ id: null, title: defaultTitle, name: m[1], props, line: lineOf(src, m.index) });
  }

  return stories;
}

/**
 * Idea 00965 — map Chromatic snapshots / published Storybook URLs.
 *
 * Detects Chromatic build URLs (`*.chromatic.com`), snapshot manifest entries,
 * storybook-static iframe sources and `data-chromatic` story markers that map
 * UI states back to URLs.
 *
 * @param {string} source - Raw HTML/JS/JSON text already fetched.
 * @returns {Array<{type: 'buildUrl'|'snapshot'|'storyId'|'iframeSrc', value: string, line: number}>}
 */
export function mapChromaticSnapshots(source = '') {
  const src = String(source);
  const findings = [];
  const seen = new Set();
  const push = (type, value, line) => {
    const key = `${type}::${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ type, value, line });
  };

  const urlRe = /https?:\/\/[a-zA-Z0-9.-]*chromatic\.com[^\s"'<>]*/g;
  let m;
  while ((m = urlRe.exec(src)) !== null) push('buildUrl', m[0], lineOf(src, m.index));

  const iframeRe = /<iframe[^>]+src=["']([^"']*storybook[^"']*)["']/gi;
  while ((m = iframeRe.exec(src)) !== null) push('iframeSrc', m[1], lineOf(src, m.index));

  const dataRe = /data-chromatic(?:-story)?=["']([^"']+)["']/g;
  while ((m = dataRe.exec(src)) !== null) push('storyId', m[1], lineOf(src, m.index));

  const snapRe = /["']snapshot(?:Url|s)["']\s*:\s*["']([^"']+)["']/g;
  while ((m = snapRe.exec(src)) !== null) push('snapshot', m[1], lineOf(src, m.index));

  return findings;
}

/**
 * Idea 00966 — mine Playwright test files for test URLs and credential refs.
 *
 * Extracts `page.goto(...)` / `toHaveURL(...)` URLs, test titles, and
 * credential *references* (env var names, httpCredentials fields, storageState
 * file paths) — never credential values.
 *
 * @param {string} source - Raw Playwright test source already fetched.
 * @returns {{urls: Array<{url: string, line: number}>, testTitles: Array<{title: string, line: number}>, credentialRefs: string[], storageStates: string[]}}
 */
export function minePlaywrightArtifacts(source = '') {
  const src = String(source);
  const urls = [];
  const testTitles = [];
  const seenUrl = new Set();

  const gotoRe = /(?:page|context)\.(?:goto|waitForURL)\(\s*['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = gotoRe.exec(src)) !== null) {
    if (!seenUrl.has(m[1])) {
      seenUrl.add(m[1]);
      urls.push({ url: m[1], line: lineOf(src, m.index) });
    }
  }
  const toHaveRe = /toHaveURL\(\s*['"`]([^'"`]+)['"`]/g;
  while ((m = toHaveRe.exec(src)) !== null) {
    if (!seenUrl.has(m[1])) {
      seenUrl.add(m[1]);
      urls.push({ url: m[1], line: lineOf(src, m.index) });
    }
  }
  const testRe = /\btest\(\s*['"`]([^'"`]+)['"`]/g;
  while ((m = testRe.exec(src)) !== null) {
    testTitles.push({ title: m[1], line: lineOf(src, m.index) });
  }

  const credentialRefs = [];
  const envRe = /process\.env\.([A-Z_][A-Z0-9_]*)/g;
  while ((m = envRe.exec(src)) !== null) {
    if (/PASS|SECRET|TOKEN|KEY|CRED|AUTH/i.test(m[1]) && !credentialRefs.includes(m[1])) {
      credentialRefs.push(m[1]);
    }
  }
  if (/\bhttpCredentials\b/.test(src) && !credentialRefs.includes('httpCredentials')) {
    credentialRefs.push('httpCredentials');
  }

  const storageStates = [];
  const ssRe = /storageState\s*:\s*['"`]([^'"`]+)['"`]/g;
  while ((m = ssRe.exec(src)) !== null) {
    if (!storageStates.includes(m[1])) storageStates.push(m[1]);
  }

  return { urls, testTitles, credentialRefs, storageStates };
}

/**
 * Idea 00967 — harvest URLs from exposed Cypress specs.
 *
 * Extracts `cy.visit(...)` / `cy.request(...)` URLs, fixture names and
 * `Cypress.env(...)` configuration references.
 *
 * @param {string} source - Raw Cypress spec source already fetched.
 * @returns {{visits: Array<{url: string, line: number}>, requests: Array<{method: string, url: string, line: number}>, fixtures: string[], envRefs: string[]}}
 */
export function harvestCypressSpecUrls(source = '') {
  const src = String(source);
  const visits = [];
  const requests = [];
  const seen = new Set();

  const visitRe = /cy\.visit\(\s*['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = visitRe.exec(src)) !== null) {
    const key = `visit::${m[1]}`;
    if (!seen.has(key)) { seen.add(key); visits.push({ url: m[1], line: lineOf(src, m.index) }); }
  }
  const reqRe = /cy\.request\(\s*(?:['"`](GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)['"`]\s*,\s*)?['"`]([^'"`]+)['"`]/gi;
  while ((m = reqRe.exec(src)) !== null) {
    const key = `req::${m[2]}`;
    if (!seen.has(key)) {
      seen.add(key);
      requests.push({ method: (m[1] || 'GET').toUpperCase(), url: m[2], line: lineOf(src, m.index) });
    }
  }

  const fixtures = [];
  const fxRe = /cy\.fixture\(\s*['"`]([^'"`]+)['"`]/g;
  while ((m = fxRe.exec(src)) !== null) {
    if (!fixtures.includes(m[1])) fixtures.push(m[1]);
  }

  const envRefs = [];
  const envRe = /Cypress\.env\(\s*['"`]([^'"`]+)['"`]/g;
  while ((m = envRe.exec(src)) !== null) {
    if (!envRefs.includes(m[1])) envRefs.push(m[1]);
  }

  return { visits, requests, fixtures, envRefs };
}

/**
 * Idea 00968 — detect Selenium Grid hubs from configuration text.
 *
 * Recognises `/wd/hub` endpoint URLs, the default Grid port 4444, Grid console
 * markers and `RemoteWebDriver` hub wiring — revealing test infrastructure.
 *
 * @param {string} source - Raw config/test text already fetched.
 * @returns {{hubs: Array<{url: string, line: number}>, usesGridConsole: boolean, remoteDriverRefs: number}}
 */
export function detectSeleniumHubs(source = '') {
  const src = String(source);
  const hubs = [];
  const seen = new Set();

  const hubRe = /https?:\/\/[^\s"'<>()]+?\/wd\/hub[^\s"'<>()]*/g;
  let m;
  while ((m = hubRe.exec(src)) !== null) {
    if (!seen.has(m[0])) { seen.add(m[0]); hubs.push({ url: m[0], line: lineOf(src, m.index) }); }
  }
  const portRe = /https?:\/\/[a-zA-Z0-9.-]+:4444[^\s"'<>()]*/g;
  while ((m = portRe.exec(src)) !== null) {
    if (!seen.has(m[0])) { seen.add(m[0]); hubs.push({ url: m[0], line: lineOf(src, m.index) }); }
  }

  return {
    hubs,
    usesGridConsole: /selenium[\s-]?grid|grid\/console|\/grid\/api/i.test(src),
    remoteDriverRefs: (src.match(/\bRemoteWebDriver\b/g) || []).length,
  };
}

/**
 * Idea 00969 — mine test fixtures for realistic IDs and endpoints.
 *
 * Scans JSON/JS fixture text for string fields that look like endpoint paths,
 * absolute URLs, e-mail addresses or identifier values (uuid, slug, numeric
 * id) — the realistic data the agent can reuse for authorised probing.
 *
 * @param {string} source - Raw fixture text already fetched.
 * @returns {Array<{field: string, value: string, kind: 'endpoint'|'url'|'email'|'id'|'other', line: number}>}
 */
export function mineTestFixtures(source = '') {
  const src = String(source);
  const findings = [];
  const seen = new Set();
  const push = (field, value, kind, line) => {
    const key = `${field}::${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ field, value, kind, line });
  };

  const strRe = /["']([A-Za-z_$][\w$-]*)["']\s*:\s*["'`]([^"'`]{1,160})["'`]/g;
  let m;
  while ((m = strRe.exec(src)) !== null) {
    const field = m[1];
    const value = m[2];
    const line = lineOf(src, m.index);
    if (/^\/[a-zA-Z0-9_\-./{}]+$/.test(value)) push(field, value, 'endpoint', line);
    else if (/^https?:\/\/[^\s]+$/.test(value)) push(field, value, 'url', line);
    else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) push(field, value, 'email', line);
    else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) push(field, value, 'id', line);
    else if (/^\d{3,}$/.test(value) && /id|user|account|order|invoice/i.test(field)) push(field, value, 'id', line);
    else if (/^[a-z0-9-]{6,}$/.test(value) && /slug|handle|username|token/i.test(field)) push(field, value, 'id', line);
  }
  return findings.slice(0, 500);
}

/**
 * Idea 00970 — extract seed-data URLs from database seed scripts.
 *
 * Detects seed operations (`prisma.<model>.create`, `knex('<table>').insert`,
 * `seed(`, `.insert(`) and collects literal endpoint/URL strings inside seed
 * files, which document the application's real data model and routes.
 *
 * @param {string} source - Raw seed script text already fetched.
 * @returns {Array<{kind: 'seedOp'|'url'|'table', value: string, line: number}>}
 */
export function extractSeedDataUrls(source = '') {
  const src = String(source);
  const findings = [];
  const seen = new Set();
  const push = (kind, value, line) => {
    const key = `${kind}::${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ kind, value, line });
  };

  const opRe = /\b(?:prisma\.(\w+)\.(?:create|createMany|upsert)|knex\(\s*['"`](\w+)['"`]\s*\)\s*\.\s*insert|db\.seed|seed\(\s*['"`](\w+)['"`])/g;
  let m;
  while ((m = opRe.exec(src)) !== null) {
    const target = m[1] || m[2] || m[3] || 'unknown';
    push('seedOp', target, lineOf(src, m.index));
  }
  const insertRe = /\.insert\s*\(\s*\[?\s*\{/g;
  let inserts = 0;
  while ((m = insertRe.exec(src)) !== null) inserts += 1;
  if (inserts > 0) push('seedOp', `bulk insert (${inserts} call${inserts === 1 ? '' : 's'})`, 1);

  const urlRe = /['"`](\/[a-zA-Z0-9_\-./{}]+|https?:\/\/[^\s"'`]+)['"`]/g;
  while ((m = urlRe.exec(src)) !== null) {
    if (/^\/[a-zA-Z]/.test(m[1]) || /^https?:\/\//.test(m[1])) {
      push('url', m[1], lineOf(src, m.index));
    }
  }
  return findings;
}
