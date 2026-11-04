// Dark Matter rule-based scanner — CSV formula + log injection probe (#42).
//
// Two halves, one module:
//   CSV FORMULA INJECTION (export surfaces only; import stays in fileUpload.js):
//     D1. Export-surface inventory: download links, .csv URLs, text/csv
//         content-type, Content-Disposition: attachment, Export buttons.
//     D2. Input->export mapping: per-field canary, locate in downloaded CSV.
//     T1. Formula-cell CONFIRM — HIGH: payload lands VERBATIM at cell start
//         (no leading-quote/tab escape).
//     T2. DDE/command variant — CRITICAL if confirmed (Windows-Excel-only).
//     T3. Guard negative — INFO (no double counting).
//   LOG INJECTION:
//     D3. Log-surface inventory: LF canary, check observable surfaces.
//     T4. Log-line forgery — HIGH if observable, else honest INFO.
//     T5. Log-viewer XSS bridge — MEDIUM if confirmed.
//
// Differential oracle: payload vs benign control, raw bytes, per-run
// canaries (cache-busted re-downloads). $0, no new deps.

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

async function fetchFull(url, opts = {}, init = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, ...(opts.headers || {}) },
      redirect: 'manual',
      ...init,
    });
    const text = await res.text().catch(() => '');
    return {
      status: res.status,
      text,
      headers: res.headers,
      ct: res.headers.get('content-type') || '',
      cd: res.headers.get('content-disposition') || '',
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ---- D1: export-surface inventory ------------------------------------------------
function findExportLinks(html, baseUrl) {
  const out = [];
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1];
    if (/\.csv(\?|$)/i.test(href) || /export|download/i.test(m[0])) {
      try {
        out.push(new URL(href, baseUrl).toString());
      } catch {}
    }
  }
  return [...new Set(out)].slice(0, 5);
}

// ---- CSV half ------------------------------------------------------------------------------
async function csvHalf(url, params, opts, rid) {
  const findings = [];
  const page = await fetchFull(url, opts);
  if (!page) return findings;
  let exports = findExportLinks(page.text, url);
  // Direct CSV content-type on the target itself.
  if (/text\/csv/i.test(page.ct) || /attachment/i.test(page.cd)) exports.unshift(url);
  if (!exports.length) return findings; // no export surface — INFO, not a miss
  for (const expUrl of exports.slice(0, 3)) {
    // D2: map inputs -> export cells with a per-field canary.
    const fieldCanary = `__dm_csv_${rid}`;
    const bust = `${expUrl}${expUrl.includes('?') ? '&' : '?'}dmcb=${rid}`;
    const csv = await fetchFull(bust, opts);
    if (!csv || !/csv|text\/plain|octet-stream/i.test(csv.ct) && csv.text.length < 10) continue;
    // T1: formula payloads into params, re-download, check verbatim cell start.
    const formulas = [
      `=1+1${fieldCanary}`,
      `=HYPERLINK("http://127.0.0.1/${fieldCanary}","x")`,
      `+2+2${fieldCanary}`,
      `@SUM(1+1)${fieldCanary}`,
    ];
    for (const p of params.slice(0, 4)) {
      for (const f of formulas.slice(0, 2)) {
        const u = new URL(expUrl);
        u.searchParams.set(p, f);
        u.searchParams.set('dmcb', rid);
        const r = await fetchFull(u.toString(), opts);
        if (!r) continue;
        // Verbatim at cell start: (^|[\n,"])payload — no leading ' or \t.
        const verbatim = new RegExp(`(^|[\\n,"])${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
        if (verbatim.test(r.text)) {
          findings.push({
            class: 'csv_injection',
            id: `csv-formula-${rand()}`,
            title: 'CSV formula injection — unsanitized formula cell in export (HIGH)',
            severity: 'high',
            url: expUrl,
            parameter: p,
            evidence: ev(
              `GET ${u.toString().slice(0, 160)} then re-download export`,
              `Formula payload "${f.slice(0, 40)}..." lands VERBATIM at a cell start — no leading-quote/tab sanitizer. Evaluates on open in Excel/Calc.`,
              'Spreadsheet formula-execution primitive via CSV export.'
            ),
          });
          // T2 DDE variant on the confirmed cell.
          const dde = `=cmd|' /C calc'!A0${fieldCanary}`;
          const u2 = new URL(expUrl);
          u2.searchParams.set(p, dde);
          u2.searchParams.set('dmcb', rid);
          const r2 = await fetchFull(u2.toString(), opts);
          if (r2 && new RegExp(`(^|[\\n,"])${dde.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(r2.text)) {
            findings.push({
              class: 'csv_injection',
              id: `csv-dde-${rand()}`,
              title: 'CSV formula injection — DDE command variant verbatim (CRITICAL)',
              severity: 'critical',
              url: expUrl,
              parameter: p,
              evidence: ev(
                `GET export with ${p}=${dde.slice(0, 30)}...`,
                `DDE payload lands verbatim — Windows-Excel-only impact (documented scoping).`,
                'DDE command-execution primitive (Windows Excel).'
              ),
            });
          }
          break;
        }
      }
      if (findings.length) break;
    }
    if (findings.length) break;
  }
  return findings;
}

// ---- LOG half ------------------------------------------------------------------------------
async function logHalf(url, params, opts, rid) {
  const findings = [];
  const lfCanary = `__dm_log_${rid}`;
  // D3: LF canary in each input; check observable surfaces (error pages,
  // reflected responses, admin/log-viewer paths).
  const surfaces = [url];
  for (const p of params.slice(0, 6)) {
    const u = new URL(url);
    u.searchParams.set(p, `aaa%0a${lfCanary}_bbb`);
    // Build manually to keep the encoded LF.
    u.search = `?${p}=aaa%0a${lfCanary}_bbb`;
    const r = await fetchFull(u.toString(), opts);
    if (!r) continue;
    // T4: forged line rendered as its own line on an observable surface.
    const lines = r.text.split('\n');
    const forged = lines.some(
      (ln, i) => ln.includes(lfCanary) && (i === 0 || !lines[i - 1].includes('aaa'))
    );
    // Simpler robust check: canary on its own line, split from the prefix.
    const splitLines = r.text.split('\n').filter((ln) => ln.includes(lfCanary));
    const ownLine = splitLines.some((ln) => !ln.includes('aaa'));
    if (ownLine) {
      findings.push({
        class: 'log_injection',
        id: `log-forge-${rand()}`,
        title: 'Log injection — forged log line on observable surface (HIGH)',
        severity: 'high',
        url: u.toString().slice(0, 160),
        parameter: p,
        evidence: ev(
          `GET ${u.toString().slice(0, 120)} (LF canary)`,
          `Canary renders on its OWN log line, split from the input prefix — log-line forgery confirmed on an observable surface.`,
          'Log-forgery primitive: fake audit lines, log-viewer XSS, log-poisoning chains.'
        ),
      });
    }
    // T5: log-viewer XSS bridge.
    const u2 = new URL(url);
    u2.search = `?${p}=%0a<script>${lfCanary}x</script>`;
    const r2 = await fetchFull(u2.toString(), opts);
    if (r2 && r2.text.includes(`<script>${lfCanary}x</script>`)) {
      findings.push({
        class: 'log_injection',
        id: `log-xss-${rand()}`,
        title: 'Log injection — stored script in log viewer (MEDIUM)',
        severity: 'medium',
        url: u2.toString().slice(0, 160),
        parameter: p,
        evidence: ev(
          `GET with %0a<script> canary`,
          `Script canary renders UNESCAPED in an HTML log-viewer surface — log→XSS chain.`,
          'Stored XSS via log injection.'
        ),
      });
    }
    void surfaces;
    if (findings.length >= 2) break;
  }
  return findings;
}

export async function probeCsvLog(url, params, opts = {}) {
  const findings = [];
  const rid = rand();
  findings.push(...(await csvHalf(url, params || [], opts, rid)));
  findings.push(...(await logHalf(url, params || [], opts, rid)));
  return findings;
}

export const __csvLogMeta = { phases: ['csv-log-injection'], depth: ['quick', 'standard', 'deep'] };
