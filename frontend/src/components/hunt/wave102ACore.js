/**
 * wave102ACore.js — Infinity AI · Wave 102A
 * Target onboarding tail plus scope suite foundations, ideas 54041–54060:
 * WHOIS preview, certificate preview, rate-limit notes, language detection,
 * bundle and form inventory, port pre-scan, onboarding payloads, welcome
 * tours, attestation, first-note prompts, screenshot seeds, canonical
 * aliases, completion webhooks, dual-pane scope editing, wildcard matching,
 * regex rules, CIDR scoping, port scoping, and path-prefix scoping.
 * Every helper takes explicit inputs, never mutates them, and returns
 * structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE102_A_IDEAS = [
  { id: 54041, title: 'WHOIS preview', skip: false },
  { id: 54042, title: 'Certificate preview', skip: false },
  { id: 54043, title: 'Rate-limit discovery note', skip: false },
  { id: 54044, title: 'Language and locale detection', skip: false },
  { id: 54045, title: 'JS bundle inventory preview', skip: false },
  { id: 54046, title: 'Form count preview', skip: false },
  { id: 54047, title: 'Port pre-scan lite', skip: false },
  { id: 54048, title: 'Onboarding progress API (targets)', skip: false },
  { id: 54049, title: 'Welcome tour per target type', skip: false },
  { id: 54050, title: 'Attestation checkbox', skip: false },
  { id: 54051, title: 'Notes prompt at add', skip: false },
  { id: 54052, title: 'Screenshot gallery seed', skip: false },
  { id: 54053, title: 'Canonical alias confirmation', skip: false },
  { id: 54054, title: 'Onboarding completion webhook', skip: false },
  { id: 54055, title: 'Dual-pane scope editor', skip: false },
  { id: 54056, title: 'Wildcard syntax support', skip: false },
  { id: 54057, title: 'Regex scope rules', skip: false },
  { id: 54058, title: 'CIDR range scoping', skip: false },
  { id: 54059, title: 'Port-level scoping', skip: false },
  { id: 54060, title: 'Path-prefix scoping', skip: false },
];

function round2(v){return Math.round(Number(v||0)*100)/100;}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp01(v){return Math.min(1,Math.max(0,num(v,0)));}
function rate(p,w){return w?round2(p/w):0;}
function mean(a){return a.length?round2(a.reduce((s,v)=>s+v,0)/a.length):0;}
function normalizeHost(h){return String(h||'').trim().toLowerCase().replace(/^\*\./,'').replace(/^https?:\/\//,'').replace(/\/.*$/,'');}
function escapeRegExp(s){return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function wildcardToRegExp(pattern){const p=String(pattern||'').trim().toLowerCase();if(p==='*')return /^.*$/;if(p.startsWith('*.')){const base=escapeRegExp(p.slice(2));return new RegExp('^[^.]+\\.'+base+'$');}return new RegExp('^'+escapeRegExp(p)+'$');}
function parseIpv4(ip){const parts=String(ip||'').trim().split('.');if(parts.length!==4)return null;const nums=parts.map(x=>Number(x));if(nums.some(n=>!Number.isInteger(n)||n<0||n>255))return null;return nums.reduce((acc,n)=>((acc<<8)>>>0)+n,0)>>>0;}
function parseCidr(cidr){const raw=String(cidr||'').trim();const slash=raw.lastIndexOf('/');if(slash<0)return null;const ipPart=raw.slice(0,slash);const bits=Number(raw.slice(slash+1));if(!Number.isInteger(bits)||bits<0||bits>32)return null;const base=parseIpv4(ipPart);if(base===null)return null;const mask=bits===0?0:(0xffffffff<< (32-bits))>>>0;const network=(base & mask)>>>0;return{raw,base,bits,mask,network};}
function ipInParsedCidr(ipInt,parsed){if(!parsed||ipInt===null)return false;return ((ipInt & parsed.mask)>>>0)===parsed.network;}
function cidrRanges(parsed){if(!parsed)return null;const start=parsed.network;const end=(parsed.network | ((~parsed.mask)>>>0))>>>0;return{start,end};}
function portInRange(port,rangeStr){const raw=String(rangeStr||'').trim();if(!raw)return false;const p=num(port,NaN);if(!Number.isFinite(p))return false;if(raw==='*')return true;return raw.split(',').some(part=>{const t=part.trim();if(t.includes('-')){const[a,b]=t.split('-').map(x=>num(x,NaN));return Number.isFinite(a)&&Number.isFinite(b)&&p>=Math.min(a,b)&&p<=Math.max(a,b);}const single=num(t,NaN);return Number.isFinite(single)&&p===single;});}
function pathMatchesPrefix(pathname,prefix){const path=String(pathname||'/');const pre=String(prefix||'/');if(pre==='/'||pre==='*')return true;const clean=pre.endsWith('/')?pre.slice(0,-1):pre;return path===clean||path.startsWith(clean+'/');}

/** Idea 54041 — WHOIS preview. Input records: {domain, registrar, createdYear, expiresYear, privacyProtected}. A WHOIS preview is complete only when registrar and expiry are both known. Summarizes registration facts before a hunt. */
export function summarizeWhoisPreview(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const domain = String(r.domain || 'domain').toLowerCase();
    const registrar = String(r.registrar || '');
    const createdYear = num(r.createdYear, 0);
    const expiresYear = num(r.expiresYear, 0);
    const privacyProtected = Boolean(r.privacyProtected);
    const complete = registrar.length >= 2 && expiresYear >= createdYear && expiresYear >= 2024;
    const ageYears = createdYear ? Math.max(0, 2026 - createdYear) : 0;
    return { key: domain, domain, registrar, createdYear, expiresYear, privacyProtected, ageYears, complete, status: complete ? 'whois-complete' : 'whois-partial' };
  }).sort((a, b) => Number(b.complete) - Number(a.complete) || String(a.key).localeCompare(String(b.key)));
  const completeCount = rows.filter(r => r.complete).length;
  return { rows, count: rows.length, completeCount, privacyCount: rows.filter(r => r.privacyProtected).length, averageAgeYears: mean(rows.map(r => r.ageYears)), top: rows[0] || null, summary: `Infinity AI produced complete WHOIS previews for ${completeCount} of ${rows.length} domain(s).` };
}
/** Idea 54042 — Certificate preview. Input records: {host, issuer, sans, notAfterDays}. A certificate preview warns only when expiry is near or already passed. Previews TLS certificate facts for a host. */
export function previewTlsCertificate(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const host = String(r.host || 'host').toLowerCase();
    const issuer = String(r.issuer || '');
    const sans = Array.isArray(r.sans) ? r.sans.map(s => String(s).toLowerCase()) : [];
    const notAfterDays = num(r.notAfterDays, 0);
    const expired = notAfterDays < 0;
    const expiringSoon = !expired && notAfterDays <= 30;
    const valid = !expired && issuer.length >= 2;
    return { key: host, host, issuer, sans, sanCount: sans.length, notAfterDays, expired, expiringSoon, valid, status: expired ? 'certificate-expired' : expiringSoon ? 'certificate-expiring' : valid ? 'certificate-valid' : 'certificate-unknown' };
  }).sort((a, b) => a.notAfterDays - b.notAfterDays || String(a.key).localeCompare(String(b.key)));
  const validCount = rows.filter(r => r.valid && !r.expiringSoon).length;
  return { rows, count: rows.length, validCount, expiringCount: rows.filter(r => r.expiringSoon).length, expiredCount: rows.filter(r => r.expired).length, totalSans: rows.reduce((s, r) => s + r.sanCount, 0), top: rows[0] || null, summary: `Infinity AI found ${validCount} healthy certificate(s); ${rows.filter(r => r.expiringSoon).length} expire within 30 days.` };
}
/** Idea 54043 — Rate-limit discovery note. Input records: {endpoint, limitPerMinute, retryAfterSeconds, headerPresent}. A note is actionable only when a numeric limit and a retry hint are both captured. Builds a rate-limit note for hunters. */
export function buildRateLimitDiscoveryNote(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const endpoint = String(r.endpoint || '/');
    const limitPerMinute = num(r.limitPerMinute, 0);
    const retryAfterSeconds = num(r.retryAfterSeconds, 0);
    const headerPresent = Boolean(r.headerPresent);
    const documented = limitPerMinute > 0 && headerPresent;
    const note = documented ? `Limit ${limitPerMinute}/min on ${endpoint}; retry after ${retryAfterSeconds}s when throttled.` : `No numeric rate limit captured for ${endpoint}; probe headers before heavy scanning.`;
    return { key: endpoint, endpoint, limitPerMinute, retryAfterSeconds, headerPresent, documented, note, status: documented ? 'limit-documented' : 'limit-unknown' };
  }).sort((a, b) => b.limitPerMinute - a.limitPerMinute || String(a.key).localeCompare(String(b.key)));
  const documentedCount = rows.filter(r => r.documented).length;
  return { rows, count: rows.length, documentedCount, averageLimit: mean(rows.map(r => r.limitPerMinute)), top: rows[0] || null, summary: `Infinity AI documented rate limits for ${documentedCount} of ${rows.length} endpoint(s).` };
}
/** Idea 54044 — Language and locale detection. Input records: {target, htmlLang, textHints}. Locale is trusted only when the declared language and text hints agree. Detects page language from markup and copy. */
export function detectLanguageLocale(records = []) {
  const hints = { hello: 'en', bonjour: 'fr', hola: 'es', hallo: 'de', ciao: 'it' };
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const htmlLang = String(r.htmlLang || '').toLowerCase().slice(0, 5);
    const textHints = Array.isArray(r.textHints) ? r.textHints.map(s => String(s).toLowerCase()) : [];
    const detected = hints[textHints[0]] || '';
    const hintLocale = detected || htmlLang.slice(0, 2);
    const locale = htmlLang || hintLocale || 'und';
    const agrees = Boolean(htmlLang && hintLocale && htmlLang.slice(0, 2) === hintLocale.slice(0, 2));
    return { key: target, target, htmlLang, textHints, hintLocale, locale, agrees, detected: Boolean(locale && locale !== 'und'), status: agrees ? 'locale-agreed' : locale !== 'und' ? 'locale-single-source' : 'locale-unknown' };
  }).sort((a, b) => Number(b.agrees) - Number(a.agrees) || String(a.key).localeCompare(String(b.key)));
  const agreedCount = rows.filter(r => r.agrees).length;
  return { rows, count: rows.length, agreedCount, detectedCount: rows.filter(r => r.detected).length, top: rows[0] || null, summary: `Infinity AI confirmed locales by dual signals for ${agreedCount} of ${rows.length} target(s).` };
}
/** Idea 54045 — JS bundle inventory preview. Input records: {target, bundles}. A bundle inventory matters only when each file carries a real byte size. Counts script bundles and weight per target. */
export function countJsBundleInventory(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const bundles = Array.isArray(r.bundles) ? r.bundles.map(b => ({ name: String(b.name || 'bundle.js'), sizeKb: num(b.sizeKb, 0) })) : [];
    const totalKb = bundles.reduce((s, b) => s + b.sizeKb, 0);
    const largest = bundles.length ? bundles.reduce((m, b) => (b.sizeKb > m.sizeKb ? b : m), bundles[0]) : null;
    return { key: target, target, bundles, bundleCount: bundles.length, totalKb, largestName: largest ? largest.name : '', largestKb: largest ? largest.sizeKb : 0, heavy: totalKb >= 500, status: bundles.length === 0 ? 'no-bundles' : totalKb >= 500 ? 'bundle-heavy' : 'bundle-light' };
  }).sort((a, b) => b.totalKb - a.totalKb || String(a.key).localeCompare(String(b.key)));
  const heavyCount = rows.filter(r => r.heavy).length;
  return { rows, count: rows.length, heavyCount, totalBundles: rows.reduce((s, r) => s + r.bundleCount, 0), totalKb: rows.reduce((s, r) => s + r.totalKb, 0), top: rows[0] || null, summary: `Infinity AI inventoried bundles for ${rows.length} target(s); ${heavyCount} look heavy.` };
}
/** Idea 54046 — Form count preview. Input records: {target, forms}. Forms are huntable surfaces only when they expose at least one input. Counts forms and upload inputs per target. */
export function countFormInputs(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const forms = Array.isArray(r.forms) ? r.forms.map(f => ({ action: String(f.action || ''), inputs: Math.max(0, num(f.inputs, 0)), uploads: Math.max(0, num(f.uploads, 0)) })) : [];
    const totalInputs = forms.reduce((s, f) => s + f.inputs, 0);
    const totalUploads = forms.reduce((s, f) => s + f.uploads, 0);
    return { key: target, target, forms, formCount: forms.length, totalInputs, totalUploads, hasUpload: totalUploads >= 1, interactive: totalInputs >= 1, status: totalUploads >= 1 ? 'upload-surface' : totalInputs >= 1 ? 'form-surface' : 'no-forms' };
  }).sort((a, b) => b.totalInputs - a.totalInputs || String(a.key).localeCompare(String(b.key)));
  const uploadCount = rows.filter(r => r.hasUpload).length;
  return { rows, count: rows.length, uploadCount, interactiveCount: rows.filter(r => r.interactive).length, totalForms: rows.reduce((s, r) => s + r.formCount, 0), totalInputs: rows.reduce((s, r) => s + r.totalInputs, 0), top: rows[0] || null, summary: `Infinity AI found upload surfaces on ${uploadCount} of ${rows.length} target(s).` };
}
/** Idea 54047 — Port pre-scan lite. Input records: {host, openPorts}. A lite pre-scan flags interest only when a well-known service port answers. Evaluates top-port answers without a full scan. */
export function evaluateTopPortsPreScan(records = []) {
  const interesting = new Set([22, 80, 443, 3000, 3306, 5432, 8000, 8080, 8443]);
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const host = String(r.host || 'host').toLowerCase();
    const openPorts = Array.isArray(r.openPorts) ? [...new Set(r.openPorts.map(p => num(p, 0)).filter(p => p >= 1 && p <= 65535))].sort((a, b) => a - b) : [];
    const interestingPorts = openPorts.filter(p => interesting.has(p));
    return { key: host, host, openPorts, openCount: openPorts.length, interestingPorts, interestingCount: interestingPorts.length, worthFullScan: interestingPorts.length >= 2 || openPorts.includes(443) || openPorts.includes(80), status: interestingPorts.length >= 2 ? 'prescan-promising' : openPorts.length >= 1 ? 'prescan-thin' : 'prescan-closed' };
  }).sort((a, b) => b.interestingCount - a.interestingCount || String(a.key).localeCompare(String(b.key)));
  const promisingCount = rows.filter(r => r.status === 'prescan-promising').length;
  return { rows, count: rows.length, promisingCount, worthFullScanCount: rows.filter(r => r.worthFullScan).length, totalOpen: rows.reduce((s, r) => s + r.openCount, 0), top: rows[0] || null, summary: `Infinity AI flagged ${promisingCount} of ${rows.length} host(s) as promising in the lite pre-scan.` };
}
/** Idea 54048 — Onboarding progress API (targets). Input records: {targetId, stepsDone, stepsTotal, blocked}. The progress payload is API-ready only when counts are consistent and unblocked. Builds the onboarding progress payload. */
export function buildOnboardingProgressPayload(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const targetId = String(r.targetId || 'target');
    const stepsTotal = Math.max(1, num(r.stepsTotal, 1));
    const stepsDone = Math.min(stepsTotal, Math.max(0, num(r.stepsDone, 0)));
    const blocked = Boolean(r.blocked);
    const percent = Math.round(rate(stepsDone, stepsTotal) * 100);
    const payload = { targetId, stepsDone, stepsTotal, percent, blocked, state: blocked ? 'blocked' : stepsDone >= stepsTotal ? 'complete' : 'in-progress' };
    return { key: targetId, ...payload, payload, apiReady: !blocked, status: payload.state };
  }).sort((a, b) => b.percent - a.percent || String(a.key).localeCompare(String(b.key)));
  const completeCount = rows.filter(r => r.status === 'complete').length;
  return { rows, count: rows.length, completeCount, blockedCount: rows.filter(r => r.blocked).length, averagePercent: mean(rows.map(r => r.percent)), top: rows[0] || null, summary: `Infinity AI built progress payloads for ${rows.length} target(s); ${completeCount} are complete.` };
}
/** Idea 54049 — Welcome tour per target type. Input records: {targetType}. Each target type gets an ordered tour tuned to its surface. Builds welcome tour steps per target type. */
export function buildWelcomeTourSteps(records = []) {
  const tours = {
    web: ['Add the apex domain', 'Confirm canonical aliases', 'Review forms and uploads', 'Set scope rules', 'Launch the first hunt'],
    api: ['Add the base URL', 'Import the method scope', 'Attach auth notes', 'Set rate-limit expectations', 'Launch the first hunt'],
    mobile: ['Bind the companion app', 'Add the store listing', 'Confirm deep links', 'Set scope rules', 'Launch the first hunt'],
  };
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const targetType = String(r.targetType || 'web').toLowerCase();
    const steps = tours[targetType] ? [...tours[targetType]] : [...tours.web];
    return { key: targetType, targetType, steps, stepCount: steps.length, tailored: Boolean(tours[targetType]), status: tours[targetType] ? 'tour-tailored' : 'tour-default' };
  }).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  const tailoredCount = rows.filter(r => r.tailored).length;
  return { rows, count: rows.length, tailoredCount, totalSteps: rows.reduce((s, r) => s + r.stepCount, 0), top: rows[0] || null, summary: `Infinity AI tailored welcome tours for ${tailoredCount} of ${rows.length} target type(s).` };
}
/** Idea 54050 — Attestation checkbox. Input records: {target, confirmed, attestedAt}. An attestation record exists only when confirmation and a timestamp are both present. Builds the attestation record for a target. */
export function buildAttestationRecord(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const confirmed = Boolean(r.confirmed);
    const attestedAt = String(r.attestedAt || '');
    const hasTimestamp = attestedAt.length >= 8;
    const valid = confirmed && hasTimestamp;
    const record = valid ? { target, confirmed: true, attestedAt, statement: `Operator attests authorization to test ${target}.` } : null;
    return { key: target, target, confirmed, attestedAt, hasTimestamp, valid, record, status: valid ? 'attested' : confirmed ? 'timestamp-missing' : 'not-attested' };
  }).sort((a, b) => Number(b.valid) - Number(a.valid) || String(a.key).localeCompare(String(b.key)));
  const validCount = rows.filter(r => r.valid).length;
  return { rows, count: rows.length, validCount, top: rows[0] || null, summary: `Infinity AI recorded valid attestations for ${validCount} of ${rows.length} target(s).` };
}
/** Idea 54051 — Notes prompt at add. Input records: {target, huntStyle}. The first-note prompt adapts its questions to the way the target will be hunted. Builds the first-note prompt model. */
export function buildFirstNotePrompt(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const huntStyle = String(r.huntStyle || 'standard').toLowerCase();
    const base = ['What is explicitly in scope here?', 'Which accounts or roles exist for testing?'];
    const extra = huntStyle === 'api' ? ['Which auth scheme protects the API?', 'Where is the API schema published?'] : huntStyle === 'deep' ? ['Which areas are highest value?', 'What testing windows apply?'] : ['Any pages that must never be touched?'];
    const prompts = [...base, ...extra];
    return { key: `${target}|${huntStyle}`, target, huntStyle, prompts, promptCount: prompts.length, tailored: huntStyle === 'api' || huntStyle === 'deep', status: 'prompt-ready' };
  }).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  const tailoredCount = rows.filter(r => r.tailored).length;
  return { rows, count: rows.length, tailoredCount, totalPrompts: rows.reduce((s, r) => s + r.promptCount, 0), top: rows[0] || null, summary: `Infinity AI prepared first-note prompts for ${rows.length} target(s); ${tailoredCount} are style-tailored.` };
}
/** Idea 54052 — Screenshot gallery seed. Input records: {target, pages}. The seed plan captures the highest-value pages first, capped per target. Plans the initial screenshot gallery. */
export function planScreenshotGallerySeed(records = []) {
  const priority = ['/', '/login', '/signup', '/pricing', '/dashboard', '/settings'];
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const target = String(r.target || 'target');
    const pages = Array.isArray(r.pages) ? r.pages.map(p => String(p)) : [];
    const planned = [...new Set(pages)].sort((a, b) => { const ia = priority.indexOf(a); const ib = priority.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b); }).slice(0, 6);
    return { key: target, target, pages, planned, plannedCount: planned.length, seeded: planned.length >= 1, status: planned.length >= 3 ? 'gallery-rich' : planned.length >= 1 ? 'gallery-thin' : 'gallery-empty' };
  }).sort((a, b) => b.plannedCount - a.plannedCount || String(a.key).localeCompare(String(b.key)));
  const richCount = rows.filter(r => r.status === 'gallery-rich').length;
  return { rows, count: rows.length, richCount, totalPlanned: rows.reduce((s, r) => s + r.plannedCount, 0), top: rows[0] || null, summary: `Infinity AI seeded rich screenshot galleries for ${richCount} of ${rows.length} target(s).` };
}
/** Idea 54053 — Canonical alias confirmation. Input records: {host}. Every alias variant resolves to one canonical HTTPS host. Resolves www, apex, and scheme aliases. */
export function resolveCanonicalAliases(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const host = normalizeHost(r.host);
    const bare = host.startsWith('www.') ? host.slice(4) : host;
    const aliases = [...new Set([`http://${bare}`, `https://${bare}`, `http://www.${bare}`, `https://www.${bare}`])];
    const canonical = `https://${bare}`;
    return { key: host || 'host', host, bare, aliases, aliasCount: aliases.length, canonical, confirmed: bare.includes('.'), status: bare.includes('.') ? 'alias-confirmed' : 'alias-invalid' };
  }).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  const confirmedCount = rows.filter(r => r.confirmed).length;
  return { rows, count: rows.length, confirmedCount, totalAliases: rows.reduce((s, r) => s + r.aliasCount, 0), top: rows[0] || null, summary: `Infinity AI confirmed canonical aliases for ${confirmedCount} of ${rows.length} host(s).` };
}
/** Idea 54054 — Onboarding completion webhook. Input records: {targetId, completed, completedAt}. The webhook fires only for genuinely completed onboarding. Builds the completion webhook payload. */
export function buildOnboardingCompletionWebhook(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const targetId = String(r.targetId || 'target');
    const completed = Boolean(r.completed);
    const completedAt = String(r.completedAt || '');
    const shouldFire = completed && completedAt.length >= 8;
    const payload = shouldFire ? { event: 'target.onboarding.completed', targetId, completedAt, source: 'Infinity AI' } : null;
    return { key: targetId, targetId, completed, completedAt, shouldFire, payload, status: shouldFire ? 'webhook-ready' : 'webhook-held' };
  }).sort((a, b) => Number(b.shouldFire) - Number(a.shouldFire) || String(a.key).localeCompare(String(b.key)));
  const readyCount = rows.filter(r => r.shouldFire).length;
  return { rows, count: rows.length, readyCount, top: rows[0] || null, summary: `Infinity AI prepared completion webhooks for ${readyCount} of ${rows.length} target(s).` };
}
/** Idea 54055 — Dual-pane scope editor. Input records: {inScope, exclusions}. The effective preview is the in-scope set minus anything excluded. Models the dual-pane scope editor. */
export function buildDualPaneScopeEditor(records = []) {
  const rows = (Array.isArray(records) ? records : []).map((r, idx) => {
    const inScope = Array.isArray(r.inScope) ? [...new Set(r.inScope.map(s => String(s).toLowerCase()))].sort() : [];
    const exclusions = Array.isArray(r.exclusions) ? [...new Set(r.exclusions.map(s => String(s).toLowerCase()))].sort() : [];
    const excludedSet = new Set(exclusions);
    const effective = inScope.filter(h => !excludedSet.has(h));
    const conflicts = inScope.filter(h => excludedSet.has(h));
    const target = String(r.target || `target-${idx + 1}`);
    return { key: target, target, inScope, exclusions, effective, effectiveCount: effective.length, conflicts, conflictCount: conflicts.length, balanced: conflicts.length === 0, status: conflicts.length ? 'scope-conflict' : effective.length ? 'scope-clean' : 'scope-empty' };
  }).sort((a, b) => b.effectiveCount - a.effectiveCount || String(a.key).localeCompare(String(b.key)));
  const cleanCount = rows.filter(r => r.status === 'scope-clean').length;
  return { rows, count: rows.length, cleanCount, totalEffective: rows.reduce((s, r) => s + r.effectiveCount, 0), totalConflicts: rows.reduce((s, r) => s + r.conflictCount, 0), top: rows[0] || null, summary: `Infinity AI found ${cleanCount} of ${rows.length} scope set(s) free of pane conflicts.` };
}
/** Idea 54056 — Wildcard syntax support. Input records: {pattern, hostname}. Wildcard patterns compile to real regular expressions before matching. Matches hostnames against wildcard scope patterns. Documentation: "*.example.com" matches exactly one subdomain label; "*" matches any host; a bare host matches only itself. */
export function matchWildcardPattern(records = []) {
  const docs = '"*.example.com" matches exactly one subdomain label; "*" matches any host; a bare host matches only itself.';
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const pattern = String(r.pattern || '').trim().toLowerCase();
    const hostname = String(r.hostname || '').trim().toLowerCase();
    let regexSource = ''; let matched = false; let valid = true; let error = '';
    try { const re = wildcardToRegExp(pattern); regexSource = re.source; matched = hostname ? re.test(hostname) : false; if (!pattern) { valid = false; error = 'Pattern is empty.'; } } catch (e) { valid = false; error = 'Pattern could not be compiled.'; }
    return { key: `${pattern}|${hostname}`, pattern, hostname, regexSource, matched, valid, error, docs, status: !valid ? 'pattern-invalid' : matched ? 'host-matched' : 'host-outside' };
  }).sort((a, b) => Number(b.matched) - Number(a.matched) || String(a.key).localeCompare(String(b.key)));
  const matchedCount = rows.filter(r => r.matched).length;
  return { rows, count: rows.length, matchedCount, docs, top: rows[0] || null, summary: `Infinity AI matched ${matchedCount} of ${rows.length} hostname check(s) against wildcard patterns.` };
}
/** Idea 54057 — Regex scope rules. Input records: {pattern, hostname}. Regex rules are usable only when they compile and are anchored safely. Builds a regex scope rule with a live tester. */
export function buildRegexScopeRule(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const pattern = String(r.pattern || '');
    const hostname = String(r.hostname || '').toLowerCase();
    let compiled = null; let valid = true; let error = ''; let matched = false;
    try { compiled = new RegExp(pattern); matched = hostname ? compiled.test(hostname) : false; } catch (e) { valid = false; error = 'Regex does not compile; check brackets and escapes.'; }
    const anchored = pattern.startsWith('^') && pattern.endsWith('$');
    return { key: `${pattern}|${hostname}`, pattern, hostname, valid, error, matched, anchored, regexSource: valid ? pattern : '', status: !valid ? 'regex-invalid' : matched ? 'regex-matched' : 'regex-no-match' };
  }).sort((a, b) => Number(b.matched) - Number(a.matched) || String(a.key).localeCompare(String(b.key)));
  const matchedCount = rows.filter(r => r.matched).length;
  return { rows, count: rows.length, matchedCount, validCount: rows.filter(r => r.valid).length, invalidCount: rows.filter(r => !r.valid).length, top: rows[0] || null, summary: `Infinity AI matched ${matchedCount} of ${rows.length} regex scope check(s).` };
}
/** Idea 54058 — CIDR range scoping. Input records: {cidr, ip, peerCidr}. Containment uses real IPv4 mask arithmetic; overlap compares network ranges. Checks CIDR containment and overlap. */
export function checkCidrContainment(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const cidr = String(r.cidr || '');
    const ip = String(r.ip || '');
    const peerCidr = String(r.peerCidr || '');
    const parsed = parseCidr(cidr);
    const ipInt = parseIpv4(ip);
    const validCidr = Boolean(parsed);
    const validIp = ipInt !== null;
    const contains = validCidr && validIp ? ipInParsedCidr(ipInt, parsed) : false;
    let overlaps = false; let peerValid = false;
    if (peerCidr) { const peer = parseCidr(peerCidr); peerValid = Boolean(peer); if (parsed && peer) { const a = cidrRanges(parsed); const b = cidrRanges(peer); overlaps = a.start <= b.end && b.start <= a.end; } }
    const hostCount = parsed ? Math.pow(2, 32 - parsed.bits) : 0;
    return { key: `${cidr}|${ip}`, cidr, ip, peerCidr, validCidr, validIp, peerValid, contains, overlaps, hostCount, network: parsed ? cidr : '', status: !validCidr ? 'cidr-invalid' : !validIp ? 'ip-invalid' : contains ? 'ip-in-range' : 'ip-out-of-range' };
  }).sort((a, b) => Number(b.contains) - Number(a.contains) || String(a.key).localeCompare(String(b.key)));
  const insideCount = rows.filter(r => r.contains).length;
  return { rows, count: rows.length, insideCount, overlapCount: rows.filter(r => r.overlaps).length, invalidCount: rows.filter(r => !r.validCidr || !r.validIp).length, top: rows[0] || null, summary: `Infinity AI placed ${insideCount} of ${rows.length} address(es) inside their CIDR range.` };
}
/** Idea 54059 — Port-level scoping. Input records: {portSpec, port}. Port specs accept single ports, comma lists, and inclusive ranges. Matches ports against scope port specs. */
export function matchPortRangeScope(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const portSpec = String(r.portSpec || '');
    const port = num(r.port, NaN);
    const validSpec = portSpec.trim().length >= 1;
    const validPort = Number.isInteger(port) && port >= 1 && port <= 65535;
    const matched = validSpec && validPort ? portInRange(port, portSpec) : false;
    return { key: `${portSpec}|${String(r.port)}`, portSpec, port: validPort ? port : num(r.port, 0), validSpec, validPort, matched, status: !validSpec || !validPort ? 'port-check-invalid' : matched ? 'port-in-scope' : 'port-out-of-scope' };
  }).sort((a, b) => Number(b.matched) - Number(a.matched) || String(a.key).localeCompare(String(b.key)));
  const matchedCount = rows.filter(r => r.matched).length;
  return { rows, count: rows.length, matchedCount, top: rows[0] || null, summary: `Infinity AI matched ${matchedCount} of ${rows.length} port check(s) against scope port specs.` };
}
/** Idea 54060 — Path-prefix scoping. Input records: {pathPrefix, urlPath}. A path is in scope only when it equals the prefix or sits beneath it. Matches URL paths against scope prefixes. */
export function matchPathPrefixScope(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const pathPrefix = String(r.pathPrefix || '/');
    const urlPath = String(r.urlPath || '/');
    const matched = pathMatchesPrefix(urlPath, pathPrefix);
    return { key: `${pathPrefix}|${urlPath}`, pathPrefix, urlPath, matched, status: matched ? 'path-in-scope' : 'path-out-of-scope' };
  }).sort((a, b) => Number(b.matched) - Number(a.matched) || String(a.key).localeCompare(String(b.key)));
  const matchedCount = rows.filter(r => r.matched).length;
  return { rows, count: rows.length, matchedCount, top: rows[0] || null, summary: `Infinity AI matched ${matchedCount} of ${rows.length} path check(s) against scope prefixes.` };
}
