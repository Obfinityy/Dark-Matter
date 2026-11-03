// Dark Matter rule-based scanner — OS command injection probe.
// Oracle: injected sleep tracks the response delay (time differential).
// The baseline must be fast; otherwise the result is inconclusive (no finding).
const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

async function getTimed(url, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA } });
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
    const base = await getTimed(withParam(url, param, '1'), opts.timeoutMs).catch(
      () => null
    );
    if (!base || !base.ok || base.ms > 3000) continue;
    const injected = await getTimed(
      withParam(url, param, `1;sleep ${SLEEP_S}`),
      25000
    ).catch(() => null);
    if (!injected || !injected.ok) continue;
    const delayTracks =
      injected.ms >= SLEEP_S * 1000 - 1500 && injected.ms - base.ms >= (SLEEP_S - 1) * 1000;
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
          response: `response took ${injected.ms}ms vs ${base.ms}ms baseline`,
          impact_demo: `injected sleep(${SLEEP_S}) tracks the response delay`,
          delayTracks: true,
          signalCorrelated: true,
        },
      });
    }
  }
  return findings;
}
