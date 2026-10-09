/**
 * wave102BCores.js — Infinity AI · Wave 102B
 * Scope suite operations, ideas 54061–54080: HTTP method scoping, visual
 * scope trees, in-scope testing, wildcard expansion, overbroad warnings,
 * exclusion codes and templates, syntax validation, rule ordering,
 * shadowing detection, version history, diffs, approval flow, rollback,
 * import and export, scope copying, templates, inheritance, and per-rule
 * enable toggles.
 * Every helper takes explicit inputs, never mutates them, and returns structured view models.
 *
 * Part of: Infinity AI frontend (hunt operations).
 */
export const WAVE102_B_IDEAS = [
  { id: 54061, title: 'HTTP method scoping', skip: false },
  { id: 54062, title: 'Visual scope tree', skip: false },
  { id: 54063, title: '"Is this URL in scope?" tester', skip: false },
  { id: 54064, title: 'Wildcard expansion preview', skip: false },
  { id: 54065, title: 'Overbroad wildcard warnings', skip: false },
  { id: 54066, title: 'Exclusion reason codes', skip: false },
  { id: 54067, title: 'Exclusion templates library', skip: false },
  { id: 54068, title: 'Scope syntax validator', skip: false },
  { id: 54069, title: 'Scope rule drag-drop reorder', skip: false },
  { id: 54070, title: 'Rule shadowing indicator', skip: false },
  { id: 54071, title: 'Scope version history', skip: false },
  { id: 54072, title: 'Scope diff viewer (targets)', skip: false },
  { id: 54073, title: 'Scope change approval flow', skip: false },
  { id: 54074, title: 'Scope rollback', skip: false },
  { id: 54075, title: 'Scope import from program', skip: false },
  { id: 54076, title: 'Scope export as JSON', skip: false },
  { id: 54077, title: 'Copy scope between targets', skip: false },
  { id: 54078, title: 'Scope templates library', skip: false },
  { id: 54079, title: 'Scope inheritance from program', skip: false },
  { id: 54080, title: 'Per-rule enable toggle', skip: false },
];

function round2(v){return Math.round(Number(v||0)*100)/100;}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function rate(p,w){return w?round2(p/w):0;}
function mean(a){return a.length?round2(a.reduce((s,v)=>s+v,0)/a.length):0;}
function escapeRegExp(s){return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function wildcardToRegExp(pattern){const p=String(pattern||'').trim().toLowerCase();if(p==='*')return /^.*$/;if(p.startsWith('*.')){const base=escapeRegExp(p.slice(2));return new RegExp('^[^.]+\\.'+base+'$');}return new RegExp('^'+escapeRegExp(p)+'$');}
function hostMatches(host,pattern){const h=String(host||'').toLowerCase();const p=String(pattern||'').toLowerCase();if(!h||!p)return false;try{return wildcardToRegExp(p).test(h);}catch(e){return h===p;}}
function pathMatchesPrefix(pathname,prefix){const path=String(pathname||'/');const pre=String(prefix||'/');if(pre==='/'||pre==='*')return true;const clean=pre.endsWith('/')?pre.slice(0,-1):pre;return path===clean||path.startsWith(clean+'/');}
function methodMatches(method,allowed){const m=String(method||'GET').toUpperCase();const list=Array.isArray(allowed)&&allowed.length?allowed.map(x=>String(x).toUpperCase()):['*'];return list.includes('*')||list.includes(m);}
function ruleKey(rule){return [String(rule.pattern||'').toLowerCase(),String(rule.pathPrefix||'/'),(Array.isArray(rule.methods)?rule.methods.map(m=>String(m).toUpperCase()).sort().join(','):'*'),String(rule.type||'include')].join('|');}
function normalizeRule(rule,idx){return{id:String(rule.id||`rule-${idx+1}`),pattern:String(rule.pattern||'').toLowerCase(),pathPrefix:String(rule.pathPrefix||'/'),methods:Array.isArray(rule.methods)&&rule.methods.length?rule.methods.map(m=>String(m).toUpperCase()):['*'],type:String(rule.type||'include').toLowerCase()==='exclude'?'exclude':'include',enabled:rule.enabled!==false,reasonCode:String(rule.reasonCode||'').toUpperCase()};}
function evaluateRules(rules,host,pathname,method){const list=(Array.isArray(rules)?rules:[]).map((r,i)=>normalizeRule(r,i));let verdict=null;for(const rule of list){if(!rule.enabled)continue;if(!hostMatches(host,rule.pattern))continue;if(!pathMatchesPrefix(pathname,rule.pathPrefix))continue;if(!methodMatches(method,rule.methods))continue;verdict={rule,inScope:rule.type==='include'};}if(!verdict)return{inScope:false,matchedRule:null,reason:'No enabled scope rule matched this host, path, and method.'};return{inScope:verdict.inScope,matchedRule:verdict.rule,reason:verdict.inScope?`Matched include rule ${verdict.rule.id} (${verdict.rule.pattern}).`:`Matched exclude rule ${verdict.rule.id} (${verdict.rule.pattern}); exclusions win by later precedence.`};}

export const EXCLUSION_REASON_CODES = ['OUT_OF_SCOPE_REQUEST','THIRD_PARTY','LEGAL_HOLD','RATE_LIMIT_RISK','DESTRUCTIVE','DUPLICATE'];
export const EXCLUSION_TEMPLATES = [
  { id: 'tpl-logout', name: 'Logout endpoints', pattern: '*.example.com', pathPrefix: '/logout', reasonCode: 'DESTRUCTIVE', description: 'Session-ending paths stay out of automated hunts.' },
  { id: 'tpl-static', name: 'Static asset hosts', pattern: 'static.example.com', pathPrefix: '/', reasonCode: 'OUT_OF_SCOPE_REQUEST', description: 'Pure asset delivery hosts carry no application logic.' },
  { id: 'tpl-status', name: 'Status pages', pattern: 'status.example.com', pathPrefix: '/', reasonCode: 'THIRD_PARTY', description: 'Hosted status pages belong to a third party.' },
  { id: 'tpl-marketing', name: 'Marketing pages', pattern: 'www.example.com', pathPrefix: '/blog', reasonCode: 'OUT_OF_SCOPE_REQUEST', description: 'Public marketing content is excluded by the program.' },
];
export const SCOPE_TEMPLATES = [
  { id: 'saas-standard', name: 'Standard SaaS', rules: [{ pattern: '*.example.com', pathPrefix: '/', methods: ['GET', 'POST'], type: 'include' }, { pattern: '*.example.com', pathPrefix: '/logout', methods: ['*'], type: 'exclude' }] },
  { id: 'api-only', name: 'API-only', rules: [{ pattern: 'api.example.com', pathPrefix: '/v1', methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], type: 'include' }] },
  { id: 'apex-web', name: 'Apex web only', rules: [{ pattern: 'example.com', pathPrefix: '/', methods: ['GET', 'POST'], type: 'include' }, { pattern: 'www.example.com', pathPrefix: '/', methods: ['GET', 'POST'], type: 'include' }] },
];

/** Idea 54061 — HTTP method scoping. Input records: {allowedMethods, method}. A request is in scope only when its method is explicitly allowed. Matches HTTP methods against scope allowlists. */
export function matchHttpMethodScope(records = []) {
  const known = ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'];
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const method = String(r.method || 'GET').toUpperCase();
    const allowedMethods = Array.isArray(r.allowedMethods) && r.allowedMethods.length ? [...new Set(r.allowedMethods.map(m => String(m).toUpperCase()))] : [];
    const validMethod = known.includes(method);
    const matched = validMethod && methodMatches(method, allowedMethods.length ? allowedMethods : ['*']);
    return { key: `${method}|${allowedMethods.join(',')}`, method, allowedMethods, validMethod, matched, status: !validMethod ? 'method-unknown' : matched ? 'method-in-scope' : 'method-out-of-scope' };
  }).sort((a, b) => Number(b.matched) - Number(a.matched) || String(a.key).localeCompare(String(b.key)));
  const matchedCount = rows.filter(r => r.matched).length;
  return { rows, count: rows.length, matchedCount, top: rows[0] || null, summary: `Infinity AI matched ${matchedCount} of ${rows.length} method check(s) against scope allowlists.` };
}
/** Idea 54062 — Visual scope tree. Input records: {rules}. Rules group into a nested tree by registrable domain, then subdomain. Builds the visual scope tree from rules. */
export function buildVisualScopeTree(records = []) {
  const rows = (Array.isArray(records) ? records : []).map((r, idx) => {
    const rules = (Array.isArray(r.rules) ? r.rules : []).map((rule, i) => normalizeRule(rule, i));
    const tree = {};
    for (const rule of rules) {
      const host = rule.pattern.replace(/^\*\./, '');
      const parts = host.split('.').filter(Boolean);
      const root = parts.length >= 2 ? parts.slice(-2).join('.') : host || 'unknown';
      if (!tree[root]) tree[root] = { domain: root, children: {}, ruleCount: 0 };
      tree[root].ruleCount += 1;
      const label = rule.pattern;
      if (!tree[root].children[label]) tree[root].children[label] = { pattern: label, paths: [], methods: new Set(), types: new Set() };
      tree[root].children[label].paths.push(rule.pathPrefix);
      rule.methods.forEach(m => tree[root].children[label].methods.add(m));
      tree[root].children[label].types.add(rule.type);
    }
    const domains = Object.values(tree).map(d => ({ domain: d.domain, ruleCount: d.ruleCount, children: Object.values(d.children).map(c => ({ pattern: c.pattern, paths: c.paths, methods: [...c.methods].sort(), types: [...c.types].sort() })).sort((a, b) => a.pattern.localeCompare(b.pattern)) })).sort((a, b) => a.domain.localeCompare(b.domain));
    const target = String(r.target || `target-${idx + 1}`);
    return { key: target, target, rules, domains, domainCount: domains.length, ruleCount: rules.length, status: rules.length ? 'tree-built' : 'tree-empty' };
  }).sort((a, b) => b.ruleCount - a.ruleCount || String(a.key).localeCompare(String(b.key)));
  const totalRules = rows.reduce((s, r) => s + r.ruleCount, 0);
  return { rows, count: rows.length, totalRules, treedCount: rows.filter(r => r.ruleCount >= 1).length, top: rows[0] || null, summary: `Infinity AI built scope trees covering ${totalRules} rule(s) across ${rows.length} target(s).` };
}
/** Idea 54063 — "Is this URL in scope?" tester. Input records: {url, method, rules}. The verdict names the winning rule and why it won. Tests one URL against the full scope rule set. */
export function testUrlInScope(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const url = String(r.url || '');
    const method = String(r.method || 'GET').toUpperCase();
    const rules = Array.isArray(r.rules) ? r.rules : [];
    let host = ''; let pathname = '/'; let parsed = false; let parseError = '';
    try { const u = new URL(url); host = u.hostname.toLowerCase(); pathname = u.pathname || '/'; parsed = true; } catch (e) { parseError = 'URL could not be parsed; include a scheme such as https://.'; }
    const verdict = parsed ? evaluateRules(rules, host, pathname, method) : { inScope: false, matchedRule: null, reason: parseError };
    return { key: `${url}|${method}`, url, method, host, pathname, parsed, parseError, rules: rules.map((x, i) => normalizeRule(x, i)), inScope: verdict.inScope, matchedRule: verdict.matchedRule, matchedRuleId: verdict.matchedRule ? verdict.matchedRule.id : '', reason: verdict.reason, status: !parsed ? 'url-invalid' : verdict.inScope ? 'in-scope' : 'out-of-scope' };
  }).sort((a, b) => Number(b.inScope) - Number(a.inScope) || String(a.key).localeCompare(String(b.key)));
  const inScopeCount = rows.filter(r => r.inScope).length;
  return { rows, count: rows.length, inScopeCount, outOfScopeCount: rows.length - inScopeCount, top: rows[0] || null, summary: `Infinity AI found ${inScopeCount} of ${rows.length} tested URL(s) in scope.` };
}
/** Idea 54064 — Wildcard expansion preview. Input records: {pattern, knownSubdomains}. The preview lists exactly which known hosts a wildcard would cover. Expands a wildcard against known subdomains. */
export function previewWildcardExpansion(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const pattern = String(r.pattern || '').toLowerCase();
    const knownSubdomains = Array.isArray(r.knownSubdomains) ? [...new Set(r.knownSubdomains.map(s => String(s).toLowerCase()))].sort() : [];
    const covered = knownSubdomains.filter(h => hostMatches(h, pattern));
    const uncovered = knownSubdomains.filter(h => !hostMatches(h, pattern));
    return { key: pattern, pattern, knownSubdomains, covered, coveredCount: covered.length, uncovered, uncoveredCount: uncovered.length, coverageRate: rate(covered.length, knownSubdomains.length), status: covered.length ? 'expansion-nonempty' : 'expansion-empty' };
  }).sort((a, b) => b.coveredCount - a.coveredCount || String(a.key).localeCompare(String(b.key)));
  const totalCovered = rows.reduce((s, r) => s + r.coveredCount, 0);
  return { rows, count: rows.length, totalCovered, fullyCoveringCount: rows.filter(r => r.uncoveredCount === 0 && r.coveredCount >= 1).length, averageCoverage: mean(rows.map(r => r.coverageRate)), top: rows[0] || null, summary: `Infinity AI previewed wildcard coverage for ${rows.length} pattern(s); ${totalCovered} known host(s) would be covered.` };
}
/** Idea 54065 — Overbroad wildcard warnings. Input records: {pattern}. Breadth is scored by how much of the namespace the pattern claims. Warns on dangerously broad wildcards with severity. */
export function warnOverbroadWildcard(records = []) {
  const rows = (Array.isArray(records) ? records : []).map(r => {
    const pattern = String(r.pattern || '').trim().toLowerCase();
    let severity = 'none'; let warning = ''; let breadth = 0;
    if (pattern === '*' || pattern === '*.*') { severity = 'critical'; warning = 'This pattern claims every host on the internet. Narrow it to a registrable domain.'; breadth = 100; }
    else if (/^\*\.[a-z]{2,}$/.test(pattern)) { severity = 'high'; warning = 'This pattern claims an entire public suffix. Add the registrable domain, for example *.example.com.'; breadth = 90; }
    else if (/^\*\.[^.]+\.[a-z]{2,}$/.test(pattern)) { severity = 'low'; warning = 'Broad but bounded to one registrable domain; confirm every subdomain is authorized.'; breadth = 40; }
    else if (pattern.startsWith('*.')) { severity = 'low'; warning = 'Wildcard bounded to a parent domain; confirm nested subdomains are intended.'; breadth = 30; }
    else { warning = 'Exact host pattern; no wildcard breadth risk.'; breadth = 5; }
    return { key: pattern || 'blank', pattern, severity, warning, breadth, overbroad: severity === 'critical' || severity === 'high', status: severity === 'none' || severity === 'low' ? 'breadth-acceptable' : 'breadth-dangerous' };
  }).sort((a, b) => b.breadth - a.breadth || String(a.key).localeCompare(String(b.key)));
  const dangerousCount = rows.filter(r => r.overbroad).length;
  return { rows, count: rows.length, dangerousCount, criticalCount: rows.filter(r => r.severity === 'critical').length, top: rows[0] || null, summary: `Infinity AI flagged ${dangerousCount} of ${rows.length} wildcard pattern(s) as overbroad.` };
}
/** Idea 54066 — Exclusion reason codes. Input records: {pattern, reasonCode}. Every exclusion must carry a recognized reason code to take effect. Enforces exclusion reason codes. */
export function enforceExclusionReasonCodes(records = []) {
  const rows = (Array.isArray(records) ? records : []).map((r, idx) => {
    const rule = normalizeRule({ ...r, type: 'exclude' }, idx);
    const reasonCode = String(r.reasonCode || '').toUpperCase();
    const recognized = EXCLUSION_REASON_CODES.includes(reasonCode);
    const enforced = recognized;
    return { key: `${rule.pattern}|${reasonCode || 'none'}`, pattern: rule.pattern, pathPrefix: rule.pathPrefix, reasonCode, recognized, enforced, allowedCodes: [...EXCLUSION_REASON_CODES], status: enforced ? 'exclusion-enforced' : 'exclusion-rejected', guidance: enforced ? 'Exclusion carries a recognized reason code.' : 'Add one of the recognized reason codes before this exclusion can apply.' };
  }).sort((a, b) => Number(b.enforced) - Number(a.enforced) || String(a.key).localeCompare(String(b.key)));
  const enforcedCount = rows.filter(r => r.enforced).length;
  return { rows, count: rows.length, enforcedCount, rejectedCount: rows.length - enforcedCount, allowedCodes: [...EXCLUSION_REASON_CODES], top: rows[0] || null, summary: `Infinity AI enforced ${enforcedCount} of ${rows.length} exclusion(s) with recognized reason codes.` };
}
/** Idea 54067 — Exclusion templates library. Input records: {templateId}. Templates instantiate into ready-to-review exclusion rules. Serves the exclusion templates library. */
export function getExclusionTemplates(records = []) {
  const wanted = Array.isArray(records) && records.length ? records.map(r => String(r.templateId || '')) : [];
  const library = EXCLUSION_TEMPLATES.map(t => ({ ...t }));
  const rows = library.map(t => {
    const instantiated = { pattern: t.pattern, pathPrefix: t.pathPrefix, methods: ['*'], type: 'exclude', reasonCode: t.reasonCode, enabled: true };
    return { key: t.id, templateId: t.id, name: t.name, pattern: t.pattern, pathPrefix: t.pathPrefix, reasonCode: t.reasonCode, description: t.description, instantiated, requested: wanted.length === 0 || wanted.includes(t.id), status: 'template-ready' };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return { rows, count: rows.length, library, requestedCount: rows.filter(r => r.requested).length, top: rows[0] || null, summary: `Infinity AI offers ${rows.length} exclusion template(s) ready to instantiate.` };
}
/** Idea 54068 — Scope syntax validator. Input records: {pattern, pathPrefix, methods}. Errors are written in plain language, each paired with a fix. Validates scope rule syntax. */
export function validateScopeSyntax(records = []) {
  const known = ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS','*'];
  const rows = (Array.isArray(records) ? records : []).map((r, idx) => {
    const pattern = String(r.pattern || '');
    const pathPrefix = String(r.pathPrefix || '/');
    const methods = Array.isArray(r.methods) && r.methods.length ? r.methods.map(m => String(m).toUpperCase()) : ['*'];
    const errors = []; const fixes = [];
    if (!pattern.trim()) { errors.push('The host pattern is empty.'); fixes.push('Enter a host such as *.example.com or api.example.com.'); }
    if (/\s/.test(pattern)) { errors.push('The host pattern contains spaces.'); fixes.push('Remove spaces; hosts never contain spaces.'); }
    if (pattern.includes('://')) { errors.push('The host pattern includes a scheme.'); fixes.push('Remove the scheme; write example.com instead of a full URL.'); }
    if (pattern && !pattern.includes('.') && pattern !== '*') { errors.push('The host pattern has no dot.'); fixes.push('Use a full domain such as example.com.'); }
    if (!pathPrefix.startsWith('/')) { errors.push('The path prefix does not start with a slash.'); fixes.push('Start the path with /, for example /v1.'); }
    const badMethods = methods.filter(m => !known.includes(m));
    if (badMethods.length) { errors.push(`Unknown method(s): ${badMethods.join(', ')}.`); fixes.push('Use standard methods such as GET or POST, or * for all methods.'); }
    const valid = errors.length === 0;
    return { key: `rule-${idx + 1}|${pattern}`, pattern, pathPrefix, methods, valid, errors, fixes, errorCount: errors.length, status: valid ? 'syntax-valid' : 'syntax-invalid' };
  }).sort((a, b) => a.errorCount - b.errorCount || String(a.key).localeCompare(String(b.key)));
  const validCount = rows.filter(r => r.valid).length;
  return { rows, count: rows.length, validCount, invalidCount: rows.length - validCount, totalErrors: rows.reduce((s, r) => s + r.errorCount, 0), top: rows[0] || null, summary: `Infinity AI validated ${validCount} of ${rows.length} scope rule(s) as syntactically sound.` };
}
/** Idea 54069 — Scope rule drag-drop reorder. Input records: {rules, order}. Reordering previews how precedence changes the effective scope. Reorders rules with an effective-scope preview. */
export function reorderScopeRules(records = []) {
  const rows = (Array.isArray(records) ? records : []).map((r, idx) => {
    const rules = (Array.isArray(r.rules) ? r.rules : []).map((rule, i) => normalizeRule(rule, i));
    const order = Array.isArray(r.order) ? r.order.map(x => String(x)) : rules.map(x => x.id);
    const byId = Object.fromEntries(rules.map(x => [x.id, x]));
    const reordered = [...order.filter(id => byId[id]).map(id => byId[id]), ...rules.filter(x => !order.includes(x.id))];
    const effectiveIncludes = reordered.filter(x => x.enabled && x.type === 'include').map(x => x.pattern);
    const effectiveExcludes = reordered.filter(x => x.enabled && x.type === 'exclude').map(x => x.pattern);
    const target = String(r.target || `target-${idx + 1}`);
    return { key: target, target, rules, order, reordered, precedence: reordered.map(x => x.id), effectiveIncludes, effectiveExcludes, lastWins: reordered.length ? reordered[reordered.length - 1].id : '', status: reordered.length ? 'reorder-previewed' : 'reorder-empty' };
  }).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, totalRules: rows.reduce((s, r) => s + r.reordered.length, 0), top: rows[0] || null, summary: `Infinity AI previewed precedence for ${rows.length} reordered scope set(s).` };
}
/** Idea 54070 — Rule shadowing indicator. Input records: {rules}. A rule is shadowed when an earlier, broader rule decides every request it could decide, with the opposite outcome. Detects shadowed rules. */
export function detectRuleShadowing(records = []) {
  const rows = (Array.isArray(records) ? records : []).map((r, idx) => {
    const rules = (Array.isArray(r.rules) ? r.rules : []).map((rule, i) => normalizeRule(rule, i));
    const findings = [];
    for (let j = 0; j < rules.length; j += 1) {
      for (let i = 0; i < j; i += 1) {
        const earlier = rules[i]; const later = rules[j];
        if (!earlier.enabled || !later.enabled) continue;
        const hostCovered = earlier.pattern === '*' || earlier.pattern === later.pattern || (earlier.pattern.startsWith('*.') && (later.pattern === earlier.pattern.slice(2) || hostMatches(later.pattern.replace(/^\*\./, 'x.'), earlier.pattern)));
        const pathCovered = earlier.pathPrefix === '/' || pathMatchesPrefix(later.pathPrefix, earlier.pathPrefix);
        const methodCovered = earlier.methods.includes('*') || later.methods.every(m => earlier.methods.includes(m));
        const identical = ruleKey(earlier) === ruleKey(later);
        if ((hostCovered && pathCovered && methodCovered) || identical) findings.push({ shadowedRuleId: later.id, shadowedById: earlier.id, identical, reason: identical ? 'An identical rule appears earlier, so this rule never changes the verdict.' : 'An earlier broader rule decides the same requests first in this preview order.' });
      }
    }
    const target = String(r.target || `target-${idx + 1}`);
    return { key: target, target, rules, findings, findingCount: findings.length, shadowedIds: [...new Set(findings.map(f => f.shadowedRuleId))], status: findings.length ? 'shadowing-found' : 'shadowing-clear' };
  }).sort((a, b) => b.findingCount - a.findingCount || String(a.key).localeCompare(String(b.key)));
  const setsWithShadowing = rows.filter(r => r.findingCount >= 1).length;
  return { rows, count: rows.length, setsWithShadowing, totalFindings: rows.reduce((s, r) => s + r.findingCount, 0), top: rows[0] || null, summary: `Infinity AI found rule shadowing in ${setsWithShadowing} of ${rows.length} scope set(s).` };
}
/** Idea 54071 — Scope version history. Input records: {versions}. History is append-only; each entry keeps author, timestamp, and a diff summary. Keeps scope version history. */
export function keepScopeVersionHistory(records = []) {
  const rows = (Array.isArray(records) ? records : []).map((r, idx) => {
    const versions = (Array.isArray(r.versions) ? r.versions : []).map((v, i) => ({ version: num(v.version, i + 1), author: String(v.author || 'operator'), timestamp: String(v.timestamp || ''), summary: String(v.summary || ''), ruleCount: Array.isArray(v.rules) ? v.rules.length : num(v.ruleCount, 0) })).sort((a, b) => a.version - b.version);
    const target = String(r.target || `target-${idx + 1}`);
    return { key: target, target, versions, versionCount: versions.length, latest: versions.length ? versions[versions.length - 1] : null, authors: [...new Set(versions.map(v => v.author))], status: versions.length ? 'history-kept' : 'history-empty' };
  }).sort((a, b) => b.versionCount - a.versionCount || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, totalVersions: rows.reduce((s, r) => s + r.versionCount, 0), top: rows[0] || null, summary: `Infinity AI keeps ${rows.reduce((s, r) => s + r.versionCount, 0)} scope version(s) across ${rows.length} target(s).` };
}
/** Idea 54072 — Scope diff viewer (targets). Input records: {before, after}. Rules compare by pattern, path, methods, and type. Shows added, removed, and modified scope rules. */
export function viewScopeDiff(records = []) {
  const rows = (Array.isArray(records) ? records : []).map((r, idx) => {
    const before = (Array.isArray(r.before) ? r.before : []).map((x, i) => normalizeRule(x, i));
    const after = (Array.isArray(r.after) ? r.after : []).map((x, i) => normalizeRule(x, i));
    const beforeMap = new Map(before.map(x => [x.id, x])); const afterMap = new Map(after.map(x => [x.id, x]));
    const added = after.filter(x => !beforeMap.has(x.id));
    const removed = before.filter(x => !afterMap.has(x.id));
    const modified = after.filter(x => beforeMap.has(x.id) && ruleKey(beforeMap.get(x.id)) !== ruleKey(x)).map(x => ({ id: x.id, from: beforeMap.get(x.id), to: x }));
    const target = String(r.target || `target-${idx + 1}`);
    const changed = added.length + removed.length + modified.length > 0;
    return { key: target, target, before, after, added, removed, modified, addedCount: added.length, removedCount: removed.length, modifiedCount: modified.length, changed, status: changed ? 'diff-changed' : 'diff-identical' };
  }).sort((a, b) => (b.addedCount + b.removedCount) - (a.addedCount + a.removedCount) || String(a.key).localeCompare(String(b.key)));
  const changedCount = rows.filter(r => r.changed).length;
  return { rows, count: rows.length, changedCount, totalAdded: rows.reduce((s, r) => s + r.addedCount, 0), totalRemoved: rows.reduce((s, r) => s + r.removedCount, 0), top: rows[0] || null, summary: `Infinity AI found scope changes in ${changedCount} of ${rows.length} target diff(s).` };
}
/** Idea 54073 — Scope change approval flow. Input records: {changeRisk, requestedBy, approver}. High-risk changes route to a senior approver; the state machine names each state. Runs the scope change approval flow. */
export function runScopeChangeApprovalFlow(records = []) {
  const rows = (Array.isArray(records) ? records : []).map((r, idx) => {
    const changeRisk = num(r.changeRisk, 0);
    const requestedBy = String(r.requestedBy || 'operator');
    const approver = String(r.approver || '');
    const widening = Boolean(r.widening);
    const needsSenior = changeRisk >= 70 || widening;
    const state = needsSenior ? (approver ? 'pending-senior-approval' : 'awaiting-approver') : 'auto-approved';
    const steps = needsSenior ? ['submitted', 'risk-checked', state, 'decided'] : ['submitted', 'risk-checked', 'auto-approved'];
    const changeId = String(r.changeId || `change-${idx + 1}`);
    return { key: changeId, changeId, changeRisk, requestedBy, approver, widening, needsSenior, state, steps, approved: state === 'auto-approved', status: state };
  }).sort((a, b) => b.changeRisk - a.changeRisk || String(a.key).localeCompare(String(b.key)));
  const autoApprovedCount = rows.filter(r => r.approved).length;
  return { rows, count: rows.length, autoApprovedCount, seniorCount: rows.filter(r => r.needsSenior).length, top: rows[0] || null, summary: `Infinity AI auto-approved ${autoApprovedCount} of ${rows.length} scope change(s); the rest need senior review.` };
}
/** Idea 54074 — Scope rollback. Input records: {versions, targetVersion}. Rollback restores the exact rule set recorded at the chosen version. Rolls scope back to a version. */
export function rollbackScopeToVersion(records = []) {
  const rows = (Array.isArray(records) ? records : []).map((r, idx) => {
    const versions = (Array.isArray(r.versions) ? r.versions : []).map((v, i) => ({ version: num(v.version, i + 1), author: String(v.author || 'operator'), timestamp: String(v.timestamp || ''), rules: (Array.isArray(v.rules) ? v.rules : []).map((x, j) => normalizeRule(x, j)) }));
    const targetVersion = num(r.targetVersion, 0);
    const found = versions.find(v => v.version === targetVersion) || null;
    const target = String(r.target || `target-${idx + 1}`);
    const restoredRules = found ? found.rules.map(x => ({ ...x, methods: [...x.methods] })) : [];
    return { key: `${target}|v${targetVersion}`, target, targetVersion, found: Boolean(found), restoredRules, restoredCount: restoredRules.length, status: found ? 'rollback-ready' : 'version-missing', note: found ? `Version ${targetVersion} by ${found.author} is ready to restore.` : `Version ${targetVersion} was not found in history.` };
  }).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  const readyCount = rows.filter(r => r.found).length;
  return { rows, count: rows.length, readyCount, missingCount: rows.length - readyCount, totalRestored: rows.reduce((s, r) => s + r.restoredCount, 0), top: rows[0] || null, summary: `Infinity AI prepared rollbacks for ${readyCount} of ${rows.length} scope version request(s).` };
}
/** Idea 54075 — Scope import from program. Input records: {programText}. Each non-empty line becomes a rule; "exclude" lines become exclusions. Imports scope from program text. */
export function importScopeFromProgramText(records = []) {
  const rows = (Array.isArray(records) ? records : []).map((r, idx) => {
    const programText = String(r.programText || '');
    const lines = programText.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const rules = []; const skipped = [];
    lines.forEach((line, i) => {
      const isExclude = /^exclude\b/i.test(line) || line.startsWith('!');
      const cleaned = line.replace(/^exclude\s+/i, '').replace(/^!/, '').trim();
      const hostToken = cleaned.split(/\s+/)[0] || '';
      if (!hostToken.includes('.') && hostToken !== '*') { skipped.push(line); return; }
      rules.push(normalizeRule({ id: `imported-${i + 1}`, pattern: hostToken.toLowerCase(), pathPrefix: '/', methods: ['*'], type: isExclude ? 'exclude' : 'include' }, i));
    });
    const target = String(r.target || `target-${idx + 1}`);
    return { key: target, target, programText, rules, ruleCount: rules.length, skipped, skippedCount: skipped.length, status: rules.length ? 'import-parsed' : 'import-empty' };
  }).sort((a, b) => b.ruleCount - a.ruleCount || String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, totalRules: rows.reduce((s, r) => s + r.ruleCount, 0), totalSkipped: rows.reduce((s, r) => s + r.skippedCount, 0), top: rows[0] || null, summary: `Infinity AI imported ${rows.reduce((s, r) => s + r.ruleCount, 0)} scope rule(s) from program text.` };
}
/** Idea 54076 — Scope export as JSON. Input records: {target, rules, version}. The export is versioned, sorted, and safe to re-import. Exports scope as versioned JSON. */
export function exportScopeAsJson(records = []) {
  const rows = (Array.isArray(records) ? records : []).map((r, idx) => {
    const target = String(r.target || `target-${idx + 1}`);
    const rules = (Array.isArray(r.rules) ? r.rules : []).map((x, i) => normalizeRule(x, i)).sort((a, b) => ruleKey(a).localeCompare(ruleKey(b)));
    const version = num(r.version, 1);
    const payload = { product: 'Infinity AI', kind: 'scope-export', version, target, exportedRules: rules.length, rules };
    const json = JSON.stringify(payload, null, 2);
    return { key: target, target, version, rules, payload, json, bytes: json.length, roundTrips: JSON.parse(json).rules.length === rules.length, status: 'export-ready' };
  }).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, totalRules: rows.reduce((s, r) => s + r.rules.length, 0), allRoundTrip: rows.every(r => r.roundTrips), top: rows[0] || null, summary: `Infinity AI exported versioned scope JSON for ${rows.length} target(s).` };
}
/** Idea 54077 — Copy scope between targets. Input records: {sourceRules, targetRules}. Conflicts are rules with the same identity but a different outcome. Copies scope with a conflict review. */
export function copyScopeBetweenTargets(records = []) {
  const rows = (Array.isArray(records) ? records : []).map((r, idx) => {
    const sourceRules = (Array.isArray(r.sourceRules) ? r.sourceRules : []).map((x, i) => normalizeRule(x, i));
    const targetRules = (Array.isArray(r.targetRules) ? r.targetRules : []).map((x, i) => normalizeRule(x, i));
    const targetByShape = new Map(targetRules.map(x => [`${x.pattern}|${x.pathPrefix}`, x]));
    const conflicts = []; const additions = [];
    for (const rule of sourceRules) {
      const shape = `${rule.pattern}|${rule.pathPrefix}`;
      const existing = targetByShape.get(shape);
      if (existing && existing.type !== rule.type) conflicts.push({ shape, sourceRule: rule, targetRule: existing, reason: 'Same host and path with opposite outcomes; a human must choose which wins.' });
      else if (!existing) additions.push(rule);
    }
    const target = String(r.target || `target-${idx + 1}`);
    return { key: target, target, sourceRules, targetRules, additions, additionCount: additions.length, conflicts, conflictCount: conflicts.length, cleanCopy: conflicts.length === 0, status: conflicts.length ? 'copy-needs-review' : 'copy-clean' };
  }).sort((a, b) => b.conflictCount - a.conflictCount || String(a.key).localeCompare(String(b.key)));
  const cleanCount = rows.filter(r => r.cleanCopy).length;
  return { rows, count: rows.length, cleanCount, totalConflicts: rows.reduce((s, r) => s + r.conflictCount, 0), totalAdditions: rows.reduce((s, r) => s + r.additionCount, 0), top: rows[0] || null, summary: `Infinity AI found ${cleanCount} of ${rows.length} scope copy job(s) free of conflicts.` };
}
/** Idea 54078 — Scope templates library. Input records: {templateId}. Templates instantiate into editable rule sets, never shared references. Serves the scope templates library. */
export function getScopeTemplates(records = []) {
  const wanted = Array.isArray(records) && records.length ? records.map(r => String(r.templateId || '')) : [];
  const rows = SCOPE_TEMPLATES.map(t => {
    const instantiated = t.rules.map((rule, i) => normalizeRule({ ...rule, id: `${t.id}-rule-${i + 1}` }, i));
    return { key: t.id, templateId: t.id, name: t.name, rules: t.rules.map(x => ({ ...x })), instantiated, ruleCount: instantiated.length, requested: wanted.length === 0 || wanted.includes(t.id), status: 'template-ready' };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return { rows, count: rows.length, library: SCOPE_TEMPLATES.map(t => ({ id: t.id, name: t.name })), totalRules: rows.reduce((s, r) => s + r.ruleCount, 0), top: rows[0] || null, summary: `Infinity AI offers ${rows.length} scope template(s) covering ${rows.reduce((s, r) => s + r.ruleCount, 0)} rule(s).` };
}
/** Idea 54079 — Scope inheritance from program. Input records: {programRules, overrides}. Local overrides win over inherited rules and are marked as overrides. Applies program scope inheritance with override markers. */
export function applyScopeInheritance(records = []) {
  const rows = (Array.isArray(records) ? records : []).map((r, idx) => {
    const programRules = (Array.isArray(r.programRules) ? r.programRules : []).map((x, i) => normalizeRule(x, i));
    const overrides = (Array.isArray(r.overrides) ? r.overrides : []).map((x, i) => normalizeRule(x, i));
    const overrideShapes = new Set(overrides.map(x => `${x.pattern}|${x.pathPrefix}`));
    const inherited = programRules.map(x => ({ ...x, methods: [...x.methods], inherited: true, isOverride: false, overridden: overrideShapes.has(`${x.pattern}|${x.pathPrefix}`) }));
    const local = overrides.map(x => ({ ...x, methods: [...x.methods], inherited: false, isOverride: true, overridden: false }));
    const effective = [...inherited.filter(x => !x.overridden), ...local];
    const target = String(r.target || `target-${idx + 1}`);
    return { key: target, target, programRules, overrides, inherited, local, effective, effectiveCount: effective.length, overrideCount: local.length, suppressedCount: inherited.filter(x => x.overridden).length, status: 'inheritance-applied' };
  }).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  return { rows, count: rows.length, totalEffective: rows.reduce((s, r) => s + r.effectiveCount, 0), totalOverrides: rows.reduce((s, r) => s + r.overrideCount, 0), top: rows[0] || null, summary: `Infinity AI applied program inheritance to ${rows.length} target(s) with explicit override markers.` };
}
/** Idea 54080 — Per-rule enable toggle. Input records: {rules, toggleRuleId, testUrl}. Toggling one rule previews the effective scope with and without it. Models the per-rule enable toggle effect. */
export function toggleScopeRuleEnabled(records = []) {
  const rows = (Array.isArray(records) ? records : []).map((r, idx) => {
    const rules = (Array.isArray(r.rules) ? r.rules : []).map((x, i) => normalizeRule(x, i));
    const toggleRuleId = String(r.toggleRuleId || '');
    const toggled = rules.map(x => (x.id === toggleRuleId ? { ...x, methods: [...x.methods], enabled: !x.enabled } : { ...x, methods: [...x.methods] }));
    const testUrl = String(r.testUrl || '');
    let host = ''; let pathname = '/'; let parsed = false;
    try { const u = new URL(testUrl); host = u.hostname.toLowerCase(); pathname = u.pathname || '/'; parsed = true; } catch (e) { parsed = false; }
    const before = parsed ? evaluateRules(rules, host, pathname, 'GET') : { inScope: false, matchedRule: null, reason: 'Test URL could not be parsed.' };
    const after = parsed ? evaluateRules(toggled, host, pathname, 'GET') : before;
    const target = String(r.target || `target-${idx + 1}`);
    const found = rules.some(x => x.id === toggleRuleId);
    return { key: `${target}|${toggleRuleId}`, target, rules, toggled, toggleRuleId, found, testUrl, host, pathname, beforeInScope: before.inScope, afterInScope: after.inScope, verdictChanged: before.inScope !== after.inScope, beforeReason: before.reason, afterReason: after.reason, effectiveCount: toggled.filter(x => x.enabled).length, status: !found ? 'toggle-rule-missing' : before.inScope !== after.inScope ? 'toggle-changes-verdict' : 'toggle-keeps-verdict' };
  }).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  const changedCount = rows.filter(r => r.verdictChanged).length;
  return { rows, count: rows.length, changedCount, foundCount: rows.filter(r => r.found).length, top: rows[0] || null, summary: `Infinity AI previewed toggles for ${rows.length} rule(s); ${changedCount} change the test verdict.` };
}
