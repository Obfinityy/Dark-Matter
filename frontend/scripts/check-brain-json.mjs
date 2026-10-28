// Brain-JSON logic test (28 Oct 2026) — no test framework in the
// frontend, so this is a dependency-free node guard, in the same
// pattern as scripts/check-be-a-brain.mjs.
//
// What it covers (real, executed):
//   1. The new api.js call (submitBrainActionJson) hits the contract
//      path/method/body against a MOCKED fetch — success {hash,
//      output, entry}, a 400 whose message names the bad field, and
//      a 409 while the AI is the brain.
//   2. The pure helpers in src/lib/brainActions.js (imported for
//      real): parseBrainReplyJson + validateBrainReply — valid JSON
//      passes, every missing/bad field names itself; brainReplyToAction
//      performs the SAME mapping as backend/src/brainReply.js
//      (click/type -> browser_click/browser_type, task block nested
//      on the action, claim lowercased + passthroughs).
//   3. Equivalence: the JSON path and the form composer produce the
//      SAME dispatched action for the same action (all six types):
//      form action -> brainActionToReply -> brainReplyToAction equals
//      JSON reply -> brainReplyToAction, deep-equal.
//   4. Schema sync: frontend/src/lib/brainReply.schema.json is
//      BYTE-IDENTICAL to backend/src/brainReply.schema.json, and its
//      required fields / action.type enum / per-type required lists
//      match what the validator enforces.
//   5. Process status derivation: the backend's one-word
//      processStatus (running/failed/done/pending) drives the panel,
//      with the taskStatus fallback for older backends; a task with
//      no stamp still shows running, never "nothing yet".
//   6. Source-level wiring: HuntCard dropdown parent option +
//      hand-back-before-model-switch; BrainConsole JSON composer
//      (tabs, schema, submit, refresh); api.js exports the new call.
//
// What it does NOT cover (stated honestly):
//   - No browser/DOM render: it cannot prove the dropdown paints,
//     the JSON textarea accepts typing, or a click reaches the
//     handler. That needs a live browser against the real backend.
//   - No live backend: the mocked fetch stands in for the real
//     route. The route IS wired in this worktree now
//     (backend/src/routes/hunts.js POST /:id/brain-action-json,
//     uncommitted, backend worker's lane) and the mocked shapes
//     match it (400 {error:'invalid_reply', errors:[{field,
//     message}]}, 409 brain_mode_ai, success {hash, output,
//     entry}); only a live run against EC2 proves the real backend
//     returns them. The GET /process fields asserted here
//     (processStatus/taskStatus/error) are also in this worktree's
//     backend (deriveProcessState, uncommitted) and the frontend
//     reads them.
//
// Run: node scripts/check-brain-json.mjs   (exit 0 = all checks pass)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const srcDir = join(root, '..', 'src');
const backendDir = join(root, '..', '..', 'backend', 'src');

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

// ---------------------------------------------------------------------------
// 1. api.js submitBrainActionJson against a mocked fetch.
// ---------------------------------------------------------------------------
const calls = [];
const MOCK_REPLY = {
  task: 'Probe the DVWA login for SQL injection',
  goal: 'Find a verified vulnerability on DVWA',
  progress: 'Logged in as admin; UNION probe dumped users once',
  action: { type: 'shell', command: 'curl -s http://172.17.0.1:3100/ | head -40' },
};

globalThis.fetch = async (url, opts = {}) => {
  calls.push({ url, method: opts.method || 'GET', body: opts.body ? JSON.parse(opts.body) : undefined });
  const path = String(url).replace(/^https?:\/\/[^/]+/, '');
  const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  if (path === '/api/v1/hunts/h_test/brain-action-json') {
    const reply = JSON.parse(opts.body).reply;
    // The real route shape (backend/src/routes/hunts.js): 400 carries
    // {error:'invalid_reply', errors:[{field, message}]} and NO
    // top-level message — the field name lives in errors[0].
    if (!reply || !reply.task) {
      return json(400, { ok: false, error: 'invalid_reply', errors: [{ field: 'task', message: '"task" is required — a non-empty string.' }] });
    }
    if (reply.action && reply.action.type === 'shell' && !reply.action.command) {
      return json(400, { ok: false, error: 'invalid_reply', errors: [{ field: 'action.command', message: '"action.command" is required for a shell action.' }] });
    }
    return json(200, { ok: true, hash: 'c0ffee123456', output: 'ran shell', entry: { n: 44, hash: 'c0ffee123456', tool: 'shell', status: 'done' } });
  }
  return json(404, { ok: false, error: 'not_found' });
};

const api = await (async () => {
  const apiSrcRaw = readFileSync(join(srcDir, 'lib', 'api.js'), 'utf8');
  const configUrl = new URL(`file://${join(srcDir, 'config.js')}`).href;
  const rewritten = apiSrcRaw.replace(
    /from '\.\.\/config'/,
    `from '${configUrl}'`,
  );
  if (rewritten === apiSrcRaw) throw new Error('api.js config import not found to rewrite');
  return import(`data:text/javascript;base64,${Buffer.from(rewritten).toString('base64')}`);
})();

let r = await api.submitBrainActionJson('h_test', MOCK_REPLY);
check('POST brain-action-json {reply} → {hash, output, entry}',
  r.ok && r.data.hash === 'c0ffee123456' && r.data.output === 'ran shell');
const jsonCall = calls.find((c) => c.url.endsWith('/brain-action-json'));
check('brain-action-json POST body wraps the reply under {reply}',
  jsonCall && jsonCall.body.reply && jsonCall.body.reply.task === MOCK_REPLY.task
  && jsonCall.body.reply.action.type === 'shell' && jsonCall.body.reply.action.command.includes('curl'));
check('brain-action-json path is /api/v1/hunts/:id/brain-action-json',
  calls.some((c) => c.method === 'POST' && c.url.endsWith('/api/v1/hunts/h_test/brain-action-json')));

// 400: the route's errors[0] names the bad field. The api wrapper
// keeps the parsed body on failure (r.data) so the console can show
// it — the bare error string alone would only say 'invalid_reply'.
r = await api.submitBrainActionJson('h_test', { goal: 'g', progress: 'p', action: { type: 'shell', command: 'id' } });
check('400 invalid reply → ok:false, body keeps errors[0].field (task)',
  !r.ok && r.status === 400 && r.data && r.data.errors && r.data.errors[0].field === 'task',
  `error=${r.error}`);
r = await api.submitBrainActionJson('h_test', { task: 't', goal: 'g', progress: 'p', action: { type: 'shell' } });
check('400 invalid reply → errors[0].field is action.command',
  !r.ok && r.status === 400 && r.data && r.data.errors && r.data.errors[0].field === 'action.command');

// 409 while the AI is the brain: same guard as the form path.
globalThis.fetch = async (url, opts = {}) => {
  calls.push({ url, method: opts.method || 'GET' });
  return { ok: false, status: 409, json: async () => ({ ok: false, error: 'brain_mode_ai', message: 'The AI is the brain right now — switch to parent mode before submitting an action.' }) };
};
r = await api.submitBrainActionJson('h_test', MOCK_REPLY);
check('brain-action-json rejected while AI is brain → ok:false, 409, refusal surfaced',
  !r.ok && r.status === 409 && /AI is the brain/.test(r.error || ''), `error=${r.error}`);

// ---------------------------------------------------------------------------
// 2. Pure helpers in src/lib/brainActions.js (imported for real).
// ---------------------------------------------------------------------------
const brain = await import(join(srcDir, 'lib', 'brainActions.js'));

// formatBrainError — the console's display string for a failed call.
check('formatBrainError shows the bad field from errors[0], not the bare code',
  brain.formatBrainError({ ok: false, error: 'invalid_reply', data: { errors: [{ field: 'task', message: '"task" is required — a non-empty string.' }] } }) === 'task: "task" is required — a non-empty string.');
check('formatBrainError shows action.command for the shell case',
  brain.formatBrainError({ ok: false, error: 'invalid_reply', data: { errors: [{ field: 'action.command', message: '"action.command" is required for a shell action.' }] } }).startsWith('action.command:'));
check('formatBrainError falls back to the error string when there is no errors array',
  brain.formatBrainError({ ok: false, error: 'brain_mode_ai' }) === 'brain_mode_ai'
  && brain.formatBrainError({}) === 'The backend did not accept this action.');

const validReply = (over = {}) => ({
  task: 'Probe the login for SQLi',
  goal: 'Find a verified vulnerability on DVWA',
  progress: 'Logged in as admin',
  ...over,
});
const TB = { task: 'Probe the login', goal: 'Find a verified vuln', progress: 'Logged in' };
const TASK_BLOCK = { task: TB.task, goal: TB.goal, progress: TB.progress, status: 'in_progress' };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// parseBrainReplyJson
check('parseBrainReplyJson parses a valid reply',
  (() => { const p = brain.parseBrainReplyJson(JSON.stringify(MOCK_REPLY)); return !p.error && p.reply.task === MOCK_REPLY.task; })());
check('parseBrainReplyJson names a syntax error',
  /Not valid JSON/.test(brain.parseBrainReplyJson('{not json').error || ''));
check('parseBrainReplyJson refuses an empty textarea',
  /empty/.test(brain.parseBrainReplyJson('   ').error || ''));

// validateBrainReply — valid cases (mirroring backend/src/brainReply.js)
const CLAIM = { type: 'claim_finding', title: 'Reflected XSS', severity: 'high', command: 'curl x', evidence: 'resp <script>', counterevidence: 'baseline clean', confidence: 'high' };
check('validateBrainReply accepts a valid shell reply',
  (() => { const v = brain.validateBrainReply(validReply({ action: { type: 'shell', command: 'id' } })); return !v.error && v.reply.action.command === 'id'; })());
check('validateBrainReply accepts recall {hash}, {id:42}, {id:"7"} and {id:"#7"} at top level',
  !brain.validateBrainReply(validReply({ recall: { hash: 'deadbeef0001' }, action: { type: 'shell', command: 'id' } })).error
  && !brain.validateBrainReply(validReply({ recall: { id: 42 }, action: { type: 'shell', command: 'id' } })).error
  && !brain.validateBrainReply(validReply({ recall: { id: '7' }, action: { type: 'shell', command: 'id' } })).error
  && !brain.validateBrainReply(validReply({ recall: { id: '#7' }, action: { type: 'shell', command: 'id' } })).error);
check('validateBrainReply accepts click with selector OR text alone',
  !brain.validateBrainReply(validReply({ action: { type: 'click', selector: '#login' } })).error
  && !brain.validateBrainReply(validReply({ action: { type: 'click', text: 'Login' } })).error);
check('validateBrainReply accepts type with text alone (selector optional)',
  !brain.validateBrainReply(validReply({ action: { type: 'type', text: 'admin' } })).error);
check('validateBrainReply accepts a full claim_finding proof package',
  !brain.validateBrainReply(validReply({ action: CLAIM })).error);

// validateBrainReply — every bad field names itself
const expectErr = (reply, re) => {
  const v = brain.validateBrainReply(reply);
  return Boolean(v.error) && re.test(v.error);
};
check('validateBrainReply missing task names task',
  expectErr(validReply({ task: undefined, action: { type: 'shell', command: 'id' } }), /^task is required/));
check('validateBrainReply empty task names task',
  expectErr(validReply({ task: '   ', action: { type: 'shell', command: 'id' } }), /^task is required/));
check('validateBrainReply missing goal names goal',
  expectErr(validReply({ goal: undefined, action: { type: 'shell', command: 'id' } }), /^goal is required/));
check('validateBrainReply missing progress names progress',
  expectErr(validReply({ progress: undefined, action: { type: 'shell', command: 'id' } }), /^progress is required/));
check('validateBrainReply non-object reply names reply',
  expectErr(null, /reply must be a JSON object/) && expectErr('hi', /reply must be a JSON object/) && expectErr([], /reply must be a JSON object/));
check('validateBrainReply missing action names action',
  expectErr(validReply({ action: undefined }), /^action is required/));
check('validateBrainReply bad action.type names action.type',
  expectErr(validReply({ action: { type: 'teleport' } }), /action\.type must be one of/));
check('validateBrainReply shell without command names action.command',
  expectErr(validReply({ action: { type: 'shell' } }), /action\.command is required/));
check('validateBrainReply browser_open without url names action.url',
  expectErr(validReply({ action: { type: 'browser_open' } }), /action\.url is required/));
check('validateBrainReply click with neither selector nor text names action.selector',
  expectErr(validReply({ action: { type: 'click' } }), /action\.selector is required/));
check('validateBrainReply type without text names action.text',
  expectErr(validReply({ action: { type: 'type', selector: '#u' } }), /action\.text is required/));
check('validateBrainReply recall action with neither hash nor id names action.hash',
  expectErr(validReply({ action: { type: 'recall' } }), /action\.hash is required/));
check('validateBrainReply recall action with both hash and id names action.recall',
  expectErr(validReply({ action: { type: 'recall', hash: 'abc', id: 42 } }), /action\.recall needs exactly one/));
check('validateBrainReply recall action with bad id names action.id',
  expectErr(validReply({ action: { type: 'recall', id: 0 } }), /action\.id must be an action number/));
check('validateBrainReply top-level recall with neither names recall',
  expectErr(validReply({ recall: {}, action: { type: 'shell', command: 'id' } }), /recall needs exactly one of hash\/id/));
check('validateBrainReply top-level recall with both names recall',
  expectErr(validReply({ recall: { hash: 'abc', id: 42 }, action: { type: 'shell', command: 'id' } }), /recall needs exactly one of hash\/id/));
check('validateBrainReply claim without title names action.title',
  expectErr(validReply({ action: { ...CLAIM, title: undefined } }), /action\.title is required/));
check('validateBrainReply claim without severity names action.severity',
  expectErr(validReply({ action: { ...CLAIM, severity: undefined } }), /action\.severity is required/));
check('validateBrainReply claim without command names action.command',
  expectErr(validReply({ action: { ...CLAIM, command: undefined } }), /action\.command is required/));
check('validateBrainReply claim without evidence names action.evidence',
  expectErr(validReply({ action: { ...CLAIM, evidence: undefined } }), /action\.evidence is required/));
check('validateBrainReply claim without counterevidence names action.counterevidence',
  expectErr(validReply({ action: { ...CLAIM, counterevidence: undefined } }), /action\.counterevidence is required/));
check('validateBrainReply claim without confidence names action.confidence',
  expectErr(validReply({ action: { ...CLAIM, confidence: undefined } }), /action\.confidence is required/));
check('validateBrainReply claim with bad severity names action.severity',
  expectErr(validReply({ action: { ...CLAIM, severity: 'bogus' } }), /action\.severity must be one of/));
check('validateBrainReply claim with bad confidence names action.confidence',
  expectErr(validReply({ action: { ...CLAIM, confidence: 'certain' } }), /action\.confidence must be one of/));

// canonicalBrainActionType + brainReplyToAction — the backend mapper's shape
check('canonicalBrainActionType maps click/type to browser_*',
  brain.canonicalBrainActionType('click') === 'browser_click'
  && brain.canonicalBrainActionType('type') === 'browser_type'
  && brain.canonicalBrainActionType('browser_click') === 'browser_click'
  && brain.canonicalBrainActionType('shell') === 'shell'
  && brain.canonicalBrainActionType('teleport') === null);
check('brainReplyToAction shell nests the task block on the action',
  eq(brain.brainReplyToAction({ ...TB, action: { type: 'shell', command: 'id' } }).action,
    { task: TASK_BLOCK, action: 'shell', command: 'id' }));
check('brainReplyToAction click maps selector to text (the driver clicks text)',
  eq(brain.brainReplyToAction({ ...TB, action: { type: 'click', selector: '#login' } }).action,
    { task: TASK_BLOCK, action: 'browser_click', text: '#login', selector: '#login' }));
check('brainReplyToAction click with text alone carries text, no selector',
  eq(brain.brainReplyToAction({ ...TB, action: { type: 'click', text: 'Login' } }).action,
    { task: TASK_BLOCK, action: 'browser_click', text: 'Login' }));
check('brainReplyToAction type carries text + submit flag, selector optional',
  eq(brain.brainReplyToAction({ ...TB, action: { type: 'type', text: 'admin', submit: true } }).action,
    { task: TASK_BLOCK, action: 'browser_type', text: 'admin', submit: true }));
check('brainReplyToAction claim lowercases severity/confidence and passes the package through',
  eq(brain.brainReplyToAction({ ...TB, action: { ...CLAIM, severity: 'High', confidence: 'High', class: 'xss', confidence_rationale: 'marker reflected raw' } }).action,
    { task: TASK_BLOCK, action: 'claim_finding', title: 'Reflected XSS', severity: 'high', class: 'xss', command: 'curl x', evidence: 'resp <script>', counterevidence: 'baseline clean', confidence: 'high', confidence_rationale: 'marker reflected raw' }));
check('brainReplyToAction recall passes a string id through untouched',
  eq(brain.brainReplyToAction({ ...TB, action: { type: 'recall', id: '#7' } }).action,
    { task: TASK_BLOCK, action: 'recall', id: '#7' }));
check('brainReplyToAction returns the task block beside the action',
  eq(brain.brainReplyToAction({ ...TB, action: { type: 'shell', command: 'id' } }).task, TASK_BLOCK));
check('brainReplyToAction refuses an invalid reply with the field named',
  /action\.command/.test(brain.brainReplyToAction(validReply({ action: { type: 'shell' } })).error || ''));

// ---------------------------------------------------------------------------
// 3. Equivalence: JSON path and form composer dispatch the SAME action.
//    form action -> brainActionToReply -> brainReplyToAction must equal
//    JSON reply -> brainReplyToAction, deep-equal, for every type.
// ---------------------------------------------------------------------------
const viaJson = (reply) => brain.brainReplyToAction(reply).action;
const viaForm = (type, fields) => {
  const built = brain.buildBrainAction(type, fields);
  if (built.error) throw new Error(`form build failed for ${type}: ${built.error}`);
  return brain.brainReplyToAction(brain.brainActionToReply(built.action, TB)).action;
};
check('equivalence shell: JSON reply == form action',
  eq(viaJson({ ...TB, action: { type: 'shell', command: 'ls /tmp' } }),
    viaForm('shell', { command: 'ls /tmp' })));
check('equivalence browser_open: JSON reply == form action',
  eq(viaJson({ ...TB, action: { type: 'browser_open', url: 'http://x/' } }),
    viaForm('browser_open', { url: 'http://x/' })));
check('equivalence click: JSON reply == form action (browser_click, text carried)',
  eq(viaJson({ ...TB, action: { type: 'click', selector: '#login' } }),
    viaForm('browser_click', { selector: '#login' })));
check('equivalence type: JSON reply == form action (browser_type)',
  eq(viaJson({ ...TB, action: { type: 'type', selector: '#u', text: 'admin' } }),
    viaForm('browser_type', { selector: '#u', text: 'admin' })));
check('equivalence recall by id: JSON reply == form action',
  eq(viaJson({ ...TB, action: { type: 'recall', id: 42 } }),
    viaForm('recall', { id: '42' })));
check('equivalence recall by hash: JSON reply carries the hash',
  eq(viaJson({ ...TB, action: { type: 'recall', hash: 'deadbeef0001' } }),
    { task: TASK_BLOCK, action: 'recall', hash: 'deadbeef0001' }));
check('equivalence claim_finding: JSON reply == form action (same proof package)',
  eq(viaJson({ ...TB, action: CLAIM }),
    viaForm('claim_finding', { title: 'Reflected XSS', severity: 'high', detail: 'resp <script>', claimCommand: 'curl x', counterevidence: 'baseline clean', confidence: 'high' })));
check('brainActionToReply round-trips a form action back to the JSON shape',
  (() => {
    const form = brain.buildBrainAction('browser_click', { selector: '#login' }).action;
    const back = brain.brainActionToReply(form, TB);
    return back.action.type === 'click' && back.action.selector === '#login' && back.task === TB.task;
  })());

// ---------------------------------------------------------------------------
// 4. Schema sync: the frontend copy is the backend file, byte for byte.
// ---------------------------------------------------------------------------
const frontendSchemaRaw = readFileSync(join(srcDir, 'lib', 'brainReply.schema.json'), 'utf8');
const backendSchemaRaw = readFileSync(join(backendDir, 'brainReply.schema.json'), 'utf8');
const schema = JSON.parse(frontendSchemaRaw);
check('frontend schema copy is byte-identical to backend/src/brainReply.schema.json',
  frontendSchemaRaw === backendSchemaRaw);
check('schema requires task, goal, progress, action',
  eq(schema.required, ['task', 'goal', 'progress', 'action']));
check('schema action.type enum is the six JSON types',
  eq(schema.properties.action.properties.type.enum,
    ['shell', 'browser_open', 'click', 'type', 'recall', 'claim_finding']));
check('schema action.type enum matches the validator enum',
  eq(schema.properties.action.properties.type.enum, brain.BRAIN_REPLY_ACTION_TYPES));
check('schema claim_finding requires title/severity/command/evidence/counterevidence/confidence',
  schema.properties.action.allOf.some((c) => eq(c.then && c.then.required,
    ['title', 'severity', 'command', 'evidence', 'counterevidence', 'confidence'])));
check('schema click accepts selector OR text, type requires text only',
  (() => {
    const allOf = schema.properties.action.allOf;
    const click = allOf.find((c) => c.if && c.if.properties && c.if.properties.type && c.if.properties.type.const === 'click');
    const type = allOf.find((c) => c.if && c.if.properties && c.if.properties.type && c.if.properties.type.const === 'type');
    return JSON.stringify(click.then) === JSON.stringify({ anyOf: [{ required: ['selector'] }, { required: ['text'] }] })
      && eq(type.then.required, ['text']);
  })());
check('schema recall accepts hash or id (string ids allowed)',
  JSON.stringify(schema.properties.recall).includes('"hash"') && JSON.stringify(schema.properties.recall).includes('"id"'));

// ---------------------------------------------------------------------------
// 5. Process status derivation (processSummary) — the backend's
//    processStatus word is authoritative; taskStatus is the fallback.
// ---------------------------------------------------------------------------
check('processSummary processStatus running → status running',
  brain.processSummary({ processStatus: 'running', task: 'Probe login', taskStatus: 'in_progress' }).status === 'running');
check('processSummary processStatus done → status complete',
  brain.processSummary({ processStatus: 'done', task: 'Probe login', taskStatus: 'complete' }).status === 'complete');
check('processSummary processStatus failed → status failed with its error',
  (() => { const s = brain.processSummary({ processStatus: 'failed', task: 'Probe login', taskStatus: 'failed', error: 'container died' }); return s.status === 'failed' && s.error === 'container died'; })());
check('processSummary processStatus pending → status idle',
  brain.processSummary({ processStatus: 'pending' }).status === 'idle');
check('processSummary taskStatus fallback: in_progress → running, failed → failed',
  brain.processSummary({ taskStatus: 'in_progress', task: 'Probe login' }).status === 'running'
  && brain.processSummary({ taskStatus: 'failed', task: 'Probe login', error: 'scope block' }).status === 'failed');
check('processSummary task with no status stamp still shows running, not idle',
  brain.processSummary({ task: 'Probe login', goal: 'Find a vuln' }).status === 'running');
check('processSummary nothing reported → status idle',
  brain.processSummary({}).status === 'idle' && brain.processSummary(null).status === 'idle');
check('processSummary keeps task/goal/progress/done/pending/iteration',
  (() => { const s = brain.processSummary({ task: 't', goal: 'g', progress: 'p', done: ['a'], pending: ['b'], iteration: 247 }); return s.task === 't' && s.done.length === 1 && s.pending.length === 1 && s.iteration === 247; })());

// ---------------------------------------------------------------------------
// 6. Source-level wiring checks.
// ---------------------------------------------------------------------------
const consoleSrc = readFileSync(join(srcDir, 'components', 'BrainConsole.jsx'), 'utf8');
const cardSrc = readFileSync(join(srcDir, 'components', 'HuntCard.jsx'), 'utf8');
const apiSrc = readFileSync(join(srcDir, 'lib', 'api.js'), 'utf8');
const cssSrc = readFileSync(join(srcDir, 'index.css'), 'utf8');

check('api.js exports submitBrainActionJson',
  /export async function submitBrainActionJson\b/.test(apiSrc));
check('api.js brain-action-json posts {reply} to the json route',
  /brain-action-json`, \{ reply \}\)/.test(apiSrc));
check('HuntCard dropdown has a "Be a Brain (you)" parent option',
  /PARENT_BRAIN_VALUE = 'parent-brain'/.test(cardSrc)
  && /<option value=\{PARENT_BRAIN_VALUE\}>🧠 Be a Brain \(you\)<\/option>/.test(cardSrc));
check('HuntCard dropdown shows the parent as selected while parent is the brain',
  /value=\{brainMode === 'parent' \? PARENT_BRAIN_VALUE : brain\.selected\}/.test(cardSrc));
check('HuntCard dropdown parent selection calls the same takeover as the gold button',
  /value === PARENT_BRAIN_VALUE/.test(cardSrc) && /await takeOverAsBrain\(\)/.test(cardSrc));
check('HuntCard dropdown hands back to AI BEFORE switching the model',
  (() => {
    const h = cardSrc.indexOf('handleBrainSelect');
    const ai = cardSrc.indexOf("setBrainMode(hunt.huntId, 'ai')", h);
    const model = cardSrc.indexOf('setHuntBrain(hunt.huntId, value)', h);
    return h !== -1 && ai !== -1 && model !== -1 && ai < model;
  })());
check('HuntCard dropdown does not switch the model if the hand-back fails',
  /Could not hand back to the AI/.test(cardSrc));
check('HuntCard keeps the gold "Be a Brain" button',
  /Be a Brain/.test(cardSrc) && /takeOverAsBrain/.test(cardSrc));
check('BrainConsole has Form / JSON composer tabs and keeps the form',
  /composerMode === 'form'/.test(consoleSrc) && /composerMode === 'json'/.test(consoleSrc)
  && /submitBrainAction\(huntId, built\.action\)/.test(consoleSrc));
check('BrainConsole JSON composer has a textarea + Fill template',
  /brain-json-textarea/.test(consoleSrc) && /Fill template/.test(consoleSrc) && /jsonTemplate\(proc\)/.test(consoleSrc));
check('BrainConsole shows the schema beside the JSON composer',
  /import brainReplySchema from '\.\.\/lib\/brainReply\.schema\.json'/.test(consoleSrc)
  && /JSON\.stringify\(brainReplySchema, null, 2\)/.test(consoleSrc));
check('BrainConsole validates the JSON client-side before sending',
  /parseBrainReplyJson\(jsonText\)/.test(consoleSrc) && /validateBrainReply\(parsed\.reply\)/.test(consoleSrc));
check('BrainConsole submits the JSON reply via submitBrainActionJson',
  /submitBrainActionJson\(huntId, validated\.reply\)/.test(consoleSrc));
check('BrainConsole shows the server error naming the bad field (errors[0])',
  /formatBrainError\(res\)/.test(consoleSrc) && /import[\s\S]*?formatBrainError/.test(consoleSrc));
check('BrainConsole refreshes the action index AND the process after a JSON submit',
  (() => {
    const i = consoleSrc.indexOf('submitBrainActionJson(huntId, validated.reply)');
    return i !== -1
      && consoleSrc.indexOf('refreshActions()', i) !== -1
      && consoleSrc.indexOf('refreshProcess()', i) !== -1;
  })());
check('BrainConsole process view shows status running/complete/failed + error',
  /summary\.status/.test(consoleSrc) && /Failed/.test(consoleSrc) && /summary\.error/.test(consoleSrc));
check('BrainConsole process view never embeds full outputs (titles only)',
  (() => {
    const start = consoleSrc.indexOf('What is happening now');
    const end = consoleSrc.indexOf('Action index', start);
    const section = consoleSrc.slice(start, end);
    return start !== -1 && end !== -1 && !/output/i.test(section) && /summary\.task/.test(section) && /summary\.progress/.test(section);
  })());
check('BrainConsole form claim asks for reproduce command + counter-evidence + confidence',
  /findingCommand/.test(consoleSrc) && /findingCounterevidence/.test(consoleSrc) && /findingConfidence/.test(consoleSrc));
check('No new hunt / budget / model mutation in the console',
  !/startHunt|setHuntBudget|setHuntBrain/.test(consoleSrc));
check('CSS has the composer tabs, JSON pane and process-status styles',
  /\.brain-composer-tab/.test(cssSrc) && /\.brain-json-textarea/.test(cssSrc)
  && /\.brain-process-status\.failed/.test(cssSrc) && /\.brain-schema/.test(cssSrc));

if (failures > 0) {
  console.error(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll Brain-JSON checks passed.');
