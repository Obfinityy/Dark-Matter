// Be-a-Brain logic test (28 Oct 2026) — no test framework in the
// frontend, so this is a dependency-free node guard, in the same
// pattern as scripts/check-budget-display.mjs.
//
// What it covers (real, executed):
//   1. The five new api.js calls (setBrainMode, getHuntActions,
//      getHuntActionOutput, getHuntProcess, submitBrainAction) hit
//      the contract paths/methods/bodies against a MOCKED fetch —
//      including the 404 unknown_hash case and the rejection of a
//      brain-action while the AI is the brain.
//   2. The pure helpers in src/lib/brainActions.js (imported for
//      real): all six action payload builders + their validation
//      errors, hash/label/status derivations, process summary.
//   3. Source-level wiring checks: HuntCard has the "Be a Brain"
//      button + "You are the brain" badge + BrainConsole mount;
//      BrainConsole reuses LiveMachine (embedded), polls every 10s,
//      and hands back via POST brain-mode {mode:'ai'}.
//
// What it does NOT cover (stated honestly):
//   - No browser/DOM render: it cannot prove the console paints or
//     that a click reaches the handler. That needs a live browser
//     against the real EC2 backend, which is currently unreachable.
//   - No live backend: the contract shapes are the ones in the lane
//     brief; if the backend worker lands different shapes, the
//     mocked responses here will not catch it — only a live run will.
//
// Run: node scripts/check-be-a-brain.mjs   (exit 0 = all checks pass)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const srcDir = join(root, '..', 'src');

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

// ---------------------------------------------------------------------------
// 1. api.js against a mocked fetch (the real request() wrapper runs).
// ---------------------------------------------------------------------------
const calls = [];
const MOCK_ACTIONS = [
  { n: 41, hash: 'a1b2c3d4e5f6', tool: 'shell', label: 'curl DVWA login page', detail: '', at: '2026-10-28T08:00:00.000Z', status: 'done' },
  { n: 42, hash: 'deadbeef0001', tool: 'browser_open', label: 'http://172.17.0.1:3100/login.php', detail: '', at: '2026-10-28T08:01:00.000Z', status: 'done' },
  { n: 43, hash: '1234567890ab', tool: 'browser_type', label: 'typed into username', detail: '', at: '2026-10-28T08:02:00.000Z', status: 'running' },
];
const MOCK_PROCESS = {
  ok: true, running: false, task: 'Probe the DVWA login for SQL injection',
  goal: 'Find a verified vulnerability on DVWA', progress: 'Login works; UNION probe dumped users once',
  done: ['Logged in as admin', 'UNION probe dumped 5 users'], pending: ['Reproduce the UNION dump', 'Try reflected XSS'],
  brainMode: 'parent', state: 'paused', iteration: 247,
};

globalThis.fetch = async (url, opts = {}) => {
  calls.push({ url, method: opts.method || 'GET', body: opts.body ? JSON.parse(opts.body) : undefined });
  const path = String(url).replace(/^https?:\/\/[^/]+/, '');
  const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  if (path === '/api/v1/hunts/h_test/brain-mode') {
    const mode = JSON.parse(opts.body).mode;
    return json(200, { ok: true, brainMode: mode, state: mode === 'parent' ? 'paused' : 'running' });
  }
  if (path === '/api/v1/hunts/h_test/actions') return json(200, { ok: true, actions: MOCK_ACTIONS });
  if (path === '/api/v1/hunts/h_test/output/deadbeef0001') {
    return json(200, { ok: true, hash: 'deadbeef0001', output: '<html>DVWA login</html>', entry: MOCK_ACTIONS[1] });
  }
  if (path.startsWith('/api/v1/hunts/h_test/output/')) {
    return json(404, { ok: false, error: 'unknown_hash' });
  }
  if (path === '/api/v1/hunts/h_test/process') return json(200, MOCK_PROCESS);
  if (path === '/api/v1/hunts/h_test/brain-action') {
    const action = JSON.parse(opts.body).action;
    return json(200, { ok: true, hash: 'feedface9999', output: `ran ${action.action}`, entry: { n: 44, hash: 'feedface9999', tool: action.action, status: 'done' } });
  }
  return json(404, { ok: false, error: 'not_found' });
};

const api = await (async () => {
  // Node ESM (unlike Vite) will not resolve api.js's extensionless
  // `from '../config'` — rewrite that one import to the absolute
  // file URL and load the module from a data: URL. The code under
  // test is api.js itself, byte-for-byte apart from that import.
  const apiSrcRaw = readFileSync(join(srcDir, 'lib', 'api.js'), 'utf8');
  const configUrl = new URL(`file://${join(srcDir, 'config.js')}`).href;
  const rewritten = apiSrcRaw.replace(
    /from '\.\.\/config'/,
    `from '${configUrl}'`,
  );
  if (rewritten === apiSrcRaw) throw new Error('api.js config import not found to rewrite');
  return import(`data:text/javascript;base64,${Buffer.from(rewritten).toString('base64')}`);
})();

// brain-mode: parent pauses, ai resumes; path + body exact.
let r = await api.setBrainMode('h_test', 'parent');
check('POST brain-mode parent → {brainMode:parent, state:paused}',
  r.ok && r.data.brainMode === 'parent' && r.data.state === 'paused', JSON.stringify(r.data));
check('brain-mode POST body is {mode}',
  calls[0].method === 'POST' && calls[0].body.mode === 'parent' && calls[0].url.endsWith('/api/v1/hunts/h_test/brain-mode'));
r = await api.setBrainMode('h_test', 'ai');
check('POST brain-mode ai → {brainMode:ai, state:running}',
  r.ok && r.data.brainMode === 'ai' && r.data.state === 'running');

// actions index: 3 actions, hashes + statuses survive the envelope.
r = await api.getHuntActions('h_test');
check('GET actions → 3 actions with hashes and statuses',
  r.ok && Array.isArray(r.data.actions) && r.data.actions.length === 3
  && r.data.actions[0].hash === 'a1b2c3d4e5f6' && r.data.actions[2].status === 'running');
check('GET actions path is /api/v1/hunts/:id/actions',
  calls.some((c) => c.method === 'GET' && c.url.endsWith('/api/v1/hunts/h_test/actions')));

// output by hash: known hash returns output; unknown hash is a
// clean 404 {ok:false, error:'unknown_hash'} — not a crash.
r = await api.getHuntActionOutput('h_test', 'deadbeef0001');
check('GET output/:hash (known) → output + entry',
  r.ok && r.data.output === '<html>DVWA login</html>' && r.data.hash === 'deadbeef0001');
r = await api.getHuntActionOutput('h_test', 'nope1234');
check('GET output/:hash (unknown) → ok:false, error unknown_hash',
  !r.ok && r.status === 404 && r.error === 'unknown_hash', `error=${r.error}`);

// process state: task/goal/progress/done/pending/brainMode/iteration.
r = await api.getHuntProcess('h_test');
check('GET process → brainMode parent, iteration 247, done+pending lists',
  r.ok && r.data.brainMode === 'parent' && r.data.iteration === 247
  && r.data.done.length === 2 && r.data.pending.length === 2
  && r.data.task.includes('SQL injection'));
check('GET process path is /api/v1/hunts/:id/process',
  calls.some((c) => c.method === 'GET' && c.url.endsWith('/api/v1/hunts/h_test/process')));

// brain-action submit: action object sent as {action}, hash+output back.
r = await api.submitBrainAction('h_test', { action: 'shell', command: 'ls /tmp' });
check('POST brain-action {action} → {hash, output, entry}',
  r.ok && r.data.hash === 'feedface9999' && r.data.output === 'ran shell');
const submitCall = calls.find((c) => c.url.endsWith('/brain-action'));
check('brain-action POST body wraps the action under {action}',
  submitCall && submitCall.body.action && submitCall.body.action.action === 'shell'
  && submitCall.body.action.command === 'ls /tmp');

// Rejection while the AI is the brain: backend 403 must surface as
// ok:false (the console shows it, never pretends the action ran).
globalThis.fetch = async (url, opts = {}) => {
  calls.push({ url, method: opts.method || 'GET' });
  return { ok: false, status: 403, json: async () => ({ ok: false, error: 'brain_mode_ai' }) };
};
r = await api.submitBrainAction('h_test', { action: 'shell', command: 'id' });
check('brain-action rejected while AI is brain → ok:false, error surfaced',
  !r.ok && r.status === 403 && /brain_mode_ai/.test(r.error || ''), `error=${r.error}`);

// ---------------------------------------------------------------------------
// 2. Pure helpers in src/lib/brainActions.js (imported for real).
// ---------------------------------------------------------------------------
const brain = await import(join(srcDir, 'lib', 'brainActions.js'));

const expect = (type, fields, action) => {
  const b = brain.buildBrainAction(type, fields);
  return !b.error && JSON.stringify(b.action) === JSON.stringify(action);
};
check('buildBrainAction shell', expect('shell', { command: 'ls /tmp' }, { action: 'shell', command: 'ls /tmp' }));
check('buildBrainAction browser_open', expect('browser_open', { url: 'http://x/' }, { action: 'browser_open', url: 'http://x/' }));
check('buildBrainAction browser_click', expect('browser_click', { selector: '#login' }, { action: 'browser_click', selector: '#login', text: '#login' }));
check('buildBrainAction browser_type', expect('browser_type', { selector: '#u', text: 'admin' }, { action: 'browser_type', selector: '#u', text: 'admin' }));
check('buildBrainAction recall', expect('recall', { id: '42' }, { action: 'recall', id: 42 }));
check('buildBrainAction claim_finding', expect('claim_finding',
  { title: 'Reflected XSS', severity: 'high', detail: 'payload reflected' },
  { action: 'claim_finding', title: 'Reflected XSS', severity: 'high', detail: 'payload reflected', command: '', evidence: 'payload reflected', counterevidence: '', confidence: 'medium', confidence_rationale: '' }));
// BRAIN JSON (28 Oct 2026): the form claim sends the same proof
// package the JSON reply does — evidence mirrors detail (the gate
// reads evidence, never detail), plus command + counterevidence +
// confidence (the gate requires all three, so a form claim without
// them bounced while the JSON path passed). The click driver reads
// action.text, so browser_click carries text: selector too.
check('buildBrainAction claim_finding carries the full proof package', (() => {
  const b = brain.buildBrainAction('claim_finding',
    { title: 't', severity: 'high', detail: 'resp shows <script>', claimCommand: 'curl x', counterevidence: 'baseline clean', confidence: 'high', confidenceRationale: '' });
  return !b.error && b.action.evidence === 'resp shows <script>' && b.action.command === 'curl x'
    && b.action.counterevidence === 'baseline clean' && b.action.detail === 'resp shows <script>'
    && b.action.confidence === 'high';
})());
check('buildBrainAction browser_click carries text for the driver',
  brain.buildBrainAction('browser_click', { selector: 'Login' }).action.text === 'Login');
check('buildBrainAction claim_finding defaults bad severity to medium',
  brain.buildBrainAction('claim_finding', { title: 't', severity: 'bogus' }).action.severity === 'medium');
check('buildBrainAction shell with empty command → error, no action sent',
  brain.buildBrainAction('shell', { command: '   ' }).error === 'Command is required.');
check('buildBrainAction recall with non-number id → error',
  /whole number/.test(brain.buildBrainAction('recall', { id: 'abc' }).error || ''));
check('buildBrainAction browser_type without text → error',
  brain.buildBrainAction('browser_type', { selector: '#u', text: '' }).error === 'Text to type is required.');
check('buildBrainAction unknown type → error',
  /Unknown action type/.test(brain.buildBrainAction('teleport', {}).error || ''));

check('shortHash truncates to 8 chars', brain.shortHash('a1b2c3d4e5f6') === 'a1b2c3d4');
check('actionLabel combines tool + label', brain.actionLabel(MOCK_ACTIONS[0]) === 'shell — curl DVWA login page');
check('actionLabel falls back to tool alone', brain.actionLabel({ tool: 'shell' }) === 'shell');
check('findActionByHash finds #42', brain.findActionByHash(MOCK_ACTIONS, 'deadbeef0001')?.n === 42);
check('findActionByHash misses unknown hash', brain.findActionByHash(MOCK_ACTIONS, 'nope') === null);
const sum = brain.processSummary(MOCK_PROCESS);
check('processSummary keeps task/goal/done/pending/iteration',
  sum.task === MOCK_PROCESS.task && sum.done.length === 2 && sum.pending.length === 2 && sum.iteration === 247);
check('processSummary degrades missing fields to empties',
  brain.processSummary(null).task === '' && brain.processSummary(null).done.length === 0);
check('actionStatusClass maps done/failed/running',
  brain.actionStatusClass('done').includes('done')
  && brain.actionStatusClass('failed').includes('failed')
  && brain.actionStatusClass('running').includes('running'));

// ---------------------------------------------------------------------------
// 3. Source-level wiring checks (component + card + LiveMachine).
// ---------------------------------------------------------------------------
const consoleSrc = readFileSync(join(srcDir, 'components', 'BrainConsole.jsx'), 'utf8');
const cardSrc = readFileSync(join(srcDir, 'components', 'HuntCard.jsx'), 'utf8');
const liveSrc = readFileSync(join(srcDir, 'components', 'LiveMachine.jsx'), 'utf8');
const apiSrc = readFileSync(join(srcDir, 'lib', 'api.js'), 'utf8');

check('api.js exports all five brain endpoints',
  ['setBrainMode', 'getHuntActions', 'getHuntActionOutput', 'getHuntProcess', 'submitBrainAction']
    .every((fn) => new RegExp(`export async function ${fn}\\b`).test(apiSrc)));
check('api.js brain-mode posts {mode}', /brain-mode`, \{ mode \}\)/.test(apiSrc));
check('HuntCard has a "Be a Brain" button', /Be a Brain/.test(cardSrc));
check('HuntCard shows the "You are the brain" badge', /You are the brain/.test(cardSrc));
check('HuntCard mounts BrainConsole', /<BrainConsole/.test(cardSrc) && /import BrainConsole/.test(cardSrc));
check('HuntCard loads brainMode from GET process on mount', /getHuntProcess\(hunt\.huntId\)/.test(cardSrc));
check('HuntCard suppresses the floating LiveMachine while the console is open',
  /!brainConsoleOpen/.test(cardSrc) && /<LiveMachine huntId=\{hunt\.huntId\}/.test(cardSrc));
check('HuntCard mounts LiveMachine for a running parent-brain process too (live UI, 28 Oct 2026)',
  /brainMode === 'parent' && liveProc && liveProc\.in_process/.test(cardSrc));
check('HuntCard shows the live activity line for a parent-brain hunt',
  /hunt-live-activity/.test(cardSrc) && /liveProc\.activity/.test(cardSrc));
check('BrainConsole reuses LiveMachine embedded', /<LiveMachine huntId=\{huntId\} target=\{target\} embedded \/>/.test(consoleSrc));
check('BrainConsole polls process+actions every 10s while open',
  /PROCESS_POLL_MS = 10000/.test(consoleSrc) && /setInterval\(load, PROCESS_POLL_MS\)/.test(consoleSrc));
check('BrainConsole fetches output by hash on row click', /getHuntActionOutput\(huntId, hash\)/.test(consoleSrc));
check('BrainConsole submits via submitBrainAction', /submitBrainAction\(huntId, built\.action\)/.test(consoleSrc));
check('form builder builds the OS actions (desktop_click, see_screen, launch_tool)',
  expect('desktop_click', { window: 'Burp Suite' }, { action: 'desktop_click', window: 'Burp Suite' })
  && expect('see_screen', {}, { action: 'see_screen' })
  && expect('launch_tool', { tool: 'burp' }, { action: 'launch_tool', tool: 'burp' })
  && expect('desktop_click_at', { x: '1240', y: '310' }, { action: 'desktop_click_at', x: 1240, y: 310 })
  && brain.buildBrainAction('desktop_click', {}).error === 'Window title is required.');
check('BrainConsole hands back via POST brain-mode ai', /setBrainMode\(huntId, 'ai'\)/.test(consoleSrc));
check('BrainConsole offers all action types (shell/browser/recall/claim + OS control)', brain.BRAIN_ACTION_TYPES.length === 23
  && ['shell', 'browser_open', 'browser_click', 'browser_type', 'recall', 'claim_finding',
      'browser_snapshot', 'screenshot', 'desktop_snapshot', 'desktop_click', 'desktop_key', 'desktop_click_at', 'desktop_click_control', 'list_controls', 'desktop_screenshot', 'see_screen', 'desktop_terminal', 'launch_tool', 'download_tool', 'proxy_start', 'intercept_list', 'intercept_read', 'intercept_replay']
    .every((t) => brain.BRAIN_ACTION_TYPES.includes(t)));
check('LiveMachine accepts embedded (default false, PiP unchanged)',
  /embedded = false/.test(liveSrc) && /live-machine-embedded/.test(liveSrc));
check('No new hunt / budget / model mutation in the console',
  !/startHunt|setHuntBudget|setHuntBrain/.test(consoleSrc));

if (failures > 0) {
  console.error(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll Be-a-Brain checks passed.');
