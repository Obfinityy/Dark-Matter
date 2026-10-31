// Claim-title sanity + dedup guard for the Be-a-Brain claim lane.
//
// INCIDENT (31 Oct 2026, hunt h_6e909d3c1965): the brain filed a claim
// titled "model_raw_plan" — the verbatim test-name from its own raw plan
// JSON ("model raw plan: ```json [{\"test\": \"model_raw_plan\", ...") —
// and the pipeline VERIFIED it as a second MEDIUM finding next to the
// genuine "sql_injection_login" (which itself got verified TWICE). The
// 100%-truth rule broke: the frontend "Confirmed" list showed the brain's
// own plan label as a vulnerability.
//
// Two guards, both bounce BEFORE the completeness gate so nothing is
// recorded except a countable claim_bounce event. ORDER MATTERS:
// duplicate is checked FIRST — when a title is already verified, the
// duplicate diagnosis is always the accurate one ("already verified,
// re-title if this is a different sink"). The plan-echo message would be
// misleading there: a re-filed "sql_injection_login" for a new sink IS a
// vulnerability name, not a plan label. The plan-echo rule then handles
// the never-verified case — the FIRST filing of a plan slug like
// "model_raw_plan", which is exactly what would have saved the hunt.
//   1. duplicate verified title — a finding/claim with the same
//      normalised title is already verified:true on this hunt. The
//      brain must re-title (different sink/URL) instead of re-filing.
//   2. plan-wrapper echo — the title is the test-name slug from the
//      brain's own raw-plan dump ("model raw plan:" thinking events).
//      Narrow on purpose: it only fires inside texts that carry a raw
//      plan, so a genuine "sql_injection_login" title is never bounced
//      by this rule on its FIRST filing.
//
// Pure functions — no fs, no imports. events = readHuntEvents(huntId).

export function normaliseTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// The raw-plan dump shape the brain emits, e.g.
//   model raw plan: ```json\n[ { "test": "model_raw_plan", "command": ... } ]
// Only texts that mention a raw plan are scanned, so genuine titles
// that merely share a test-name slug elsewhere are left alone.
export function findPlanWrapperEcho(title, events) {
  const raw = String(title || '').trim();
  if (!raw) return null;
  const slugs = new Set([raw, raw.replace(/\s+/g, '_'), raw.replace(/\s+/g, '-')]);
  for (const ev of events || []) {
    const text = String((ev && (ev.text || ev.output)) || '');
    if (!text || !/raw plan/i.test(text)) continue;
    for (const slug of slugs) {
      const re = new RegExp(`["']?test["']?\\s*[:=]\\s*["']${escapeRegExp(slug)}["']`, 'i');
      if (re.test(text)) return slug;
    }
  }
  return null;
}

// P0 (31 Oct 2026, h_6e909d3c1965 incident): probe/test names filed as
// vulnerability titles. The autonomous pipeline (assessResult) uses
// plan.test as the finding title — when the brain names its probe
// "probe_session_handling", that TEST NAME becomes the finding title,
// and the verifier stamps it verified:true. The frontend then counts it
// as a confirmed vulnerability. A probe name is not a vulnerability;
// it must be re-titled with the VULNERABILITY name before it can verify.
export function isProbeNameTitle(title) {
  const t = String(title || '').trim().toLowerCase();
  if (!t) return false;
  // Probe/test name patterns: probe_*, *_probe, *_test, test_*
  if (/^probe[_-]/.test(t)) return true;
  if (/[_-]probe([_-]|$)/.test(t)) return true;
  if (/[_-]test([_-]|$)/.test(t)) return true;
  if (/^test[_-]/.test(t)) return true;
  return false;
}

export function findVerifiedDuplicate(title, events) {
  const norm = normaliseTitle(title);
  if (!norm) return null;
  for (const ev of events || []) {
    if (!ev || (ev.type !== 'finding' && ev.type !== 'claim')) continue;
    if (ev.verified !== true) continue;
    if (normaliseTitle(ev.title) === norm) return ev.title || norm;
  }
  return null;
}

// { ok:true } or { ok:false, error, message }.
// Duplicate is checked first: for an already-verified title it is always
// the accurate, actionable diagnosis. Plan-echo then covers the
// never-verified first filing (the incident's original "model_raw_plan"
// claim would have been stopped here).
export function guardClaimTitle(title, events) {
  const dup = findVerifiedDuplicate(title, events);
  if (dup) {
    return {
      ok: false,
      error: 'claim_duplicate',
      message:
        `CLAIM NOT RECORDED — "${dup}" is already a VERIFIED finding on this hunt. ` +
        'Do not re-file it. If this is a different sink/URL, re-title the claim to say how it differs and claim again.',
    };
  }
  const echo = findPlanWrapperEcho(title, events);
  if (echo) {
    return {
      ok: false,
      error: 'claim_title_is_plan_name',
      message:
        `CLAIM NOT RECORDED — "${title}" is the test-name from your own raw plan, not a vulnerability title. ` +
        'Re-title the claim with the VULNERABILITY name (e.g. "SQL injection in login form"), then claim again.',
    };
  }
  if (isProbeNameTitle(title)) {
    return {
      ok: false,
      error: 'claim_title_is_probe_name',
      message:
        `CLAIM NOT RECORDED — "${title}" is a probe/test name, not a vulnerability title. ` +
        'A probe name describes WHAT YOU RAN; a finding title must describe THE VULNERABILITY (e.g. "SQL injection in login form", "Reflected XSS in search"). Re-title with the vulnerability name and claim again.',
    };
  }
  return { ok: true };
}
