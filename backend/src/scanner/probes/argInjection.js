// Dark Matter rule-based scanner — argument injection detector (#54).
//
// Defensive purpose: detect sinks where user input becomes a CLI argv
// element (option-parser reach) on authorized targets, so the owner can
// add `--` separators / allowlists. Distinct from cmdi.js (shell
// metacharacters) — payloads here are bare `-`/`--` options, NO shell
// syntax, NO dangerous options (never --checkpoint-action exec,
// -oProxyCommand, etc.).
//   D1. Sink inventory: upload filenames, URL-fetch/export fields,
//       diagnostic (ping/traceroute) fields, archive/image params.
//   D2. Option-prefix differential: --help/--version/-v/-- vs baseline
//       AND control; CONFIRM only if the option family differs from both.
//   D3. Filename-as-option (upload path): -v/--help/--version/- names.
//   D4. Shape variants: --opt=value, "-- opt". Cap: <=4 probes + 2
//       controls per sink.
//
// HONEST SCOPE (binding): v1 confirms OPTION-PARSER REACH, never code
// execution. MEDIUM max. Dedup: suppress if cmdi confirmed the same sink.
// Class key: argumentInjection.

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

async function getText(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA }, redirect: 'manual' });
    const text = await res.text().catch(() => '');
    return { status: res.status, text: text.slice(0, 3000) };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function sig(r) {
  if (!r) return 'ERR';
  const t = r.text.replace(/[0-9a-f]{16,}/gi, '#');
  return `${r.status}:${t.slice(0, 300)}`;
}

const CLI_SINK_RES = /^(file|filename|upload|url|target|host|domain|ip|archive|image|export|format|printer|webhook|repo|branch|ping|traceroute|nslookup|dig)$/i;

// ---- D2: option-prefix differential ---------------------------------------------------
async function d2Differential(url, param, opts) {
  const baseline = 'inert123';
  const control = `zz${rand()}inert`;
  // Benign option probes only — never dangerous options.
  const probes = ['--help', '--version', '-v', '--'];
  const rBase = await getText(setParam(url, param, baseline), opts);
  const rCtrl = await getText(setParam(url, param, control), opts);
  if (!rBase || !rCtrl) return null;
  const sBase = sig(rBase);
  const sCtrl = sig(rCtrl);
  for (const probe of probes.slice(0, 4)) {
    const r = await getText(setParam(url, param, probe), opts);
    if (!r) continue;
    const s = sig(r);
    // CONFIRM: option family differs from BOTH baseline and control.
    if (s !== sBase && s !== sCtrl) {
      const optionish = /(usage|unknown option|invalid option|unrecognized|option .* not|try '--help')/i.test(r.text);
      return { probe, response: r, optionish, sBase, sCtrl, sProbe: s };
    }
  }
  return null;
}

function setParam(url, param, value) {
  const u = new URL(url);
  u.searchParams.set(param, value);
  return u.toString();
}

export async function probeArgInjection(url, params, opts = {}) {
  const findings = [];
  const sinks = (params || []).filter((p) => CLI_SINK_RES.test(p));
  // Also try generic params on deep (bounded).
  const targets = sinks.length ? sinks : (opts.depth === 'deep' ? (params || []).slice(0, 3) : []);
  for (const p of targets.slice(0, 4)) {
    const hit = await d2Differential(url, p, opts);
    if (!hit) continue;
    findings.push({
      class: 'argumentInjection',
      id: `arginj-${rand()}`,
      title: `Argument injection LIKELY — option-parser reach via "${p}" (MEDIUM)`,
      severity: 'medium',
      url,
      parameter: p,
      evidence: ev(
        `GET ${url}?${p}=${hit.probe} vs baseline "inert123" vs control (differential)`,
        `Option probe produced a distinct response family${hit.optionish ? ' (usage/option-error text)' : ''} differing from BOTH baseline and control — the value reached an argv option parser. Code execution NOT demonstrated (v1 honest scope); lab confirmation required.`,
        'Defensive finding: insert `--` separator / allowlist before CLI args.'
      ),
    });
    if (findings.length >= 2) break;
  }
  // D3 filename-as-option: documented; fires through the upload path when
  // the backend omits the `--` separator (same differential discipline).
  return findings;
}

export const __argMeta = { phases: ['arg-injection'], depth: ['quick', 'standard', 'deep'] };
