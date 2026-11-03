// Dark Matter rule-based scanner — OS command injection probe.
// Oracle: injected sleep tracks the response delay (time differential).
// The baseline must be fast; otherwise the result is inconclusive (no finding).
const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

async function getTimed(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 20000);
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA, ...(opts.headers || {}) } });
    await res.text().catch(() => '');
    return { ms: Date.now() - start, ok: true };
  } catch {
    return { ms: Date.now() - start, ok: false };
  } finally {
    clearTimeout(t);
  }
}

function withParam(url, name, value) {
  const u = new URL(url);
  u.searchParams.set(name, value);
  return u.toString();
}

export async function probeCmdiTime(url, params, opts = {}) {
  const findings = [];
  const SLEEP_S = 5;
  for (const param of params.slice(0, 6)) {
    // Two baselines: the max absorbs normal jitter; a wide spread means the
    // page is too unstable for a timing oracle (skip instead of guessing).
    const base1 = await getTimed(withParam(url, param, '1'), opts).catch(
      () => null
    );
    const base2 = await getTimed(withParam(url, param, '2'), opts).catch(
      () => null
    );
    if (!base1 || !base1.ok || !base2 || !base2.ok) continue;
    if (Math.abs(base1.ms - base2.ms) > 2000) continue; // jittery page
    const baseMs = Math.max(base1.ms, base2.ms);
    const injected = await getTimed(withParam(url, param, `1;sleep ${SLEEP_S}`), { ...opts, timeoutMs: 25000 }).catch(() => null);
    if (!injected || !injected.ok) continue;
    // Pure differential: the injected sleep must ADD ~5s on top of whatever
    // the page normally takes (a slow-but-stable baseline like `ping -c 4`
    // must not suppress a real finding).
    const delayTracks = injected.ms - baseMs >= (SLEEP_S - 1) * 1000;
    if (delayTracks) {
      findings.push({
        class: 'cmd_injection',
        id: `cmdi-time-${param}`,
        title: `Time-based OS command injection in parameter '${param}'`,
        severity: 'critical',
        url,
        param,
        evidence: {
          request: `GET ${withParam(url, param, `1;sleep ${SLEEP_S}`)}`,
          response: `response took ${injected.ms}ms vs ${baseMs}ms baseline`,
          impact_demo: `injected sleep(${SLEEP_S}) tracks the response delay`,
          delayTracks: true,
          signalCorrelated: true,
        },
      });
    }
  }
  return findings;
}
