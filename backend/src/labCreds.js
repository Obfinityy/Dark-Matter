// Lab-canary credentials gate (#474, CWE-613).
//
// labCreds ({username, password}) lets the session-fixation,
// timing-side-channel and user-enumeration probes log in with OUR canary
// account on a lab target. They are accepted ONLY when the caller is an
// admin AND the hunt target's host is in LAB_TARGETS — the same lab gate
// the hunt route uses for its SSRF exception. Anything else is ignored
// silently (fail-closed): no other caller may inject credentials into a
// scan, and a queued or resumed hunt never carries them (only a fresh
// direct creation passes them through — see routes/hunts.js).
//
// Pure functions — unit-tested in scanner/probes/sessionFixation.test.js
// (test n). labTargets accepts the env-style comma-separated string or
// an array.

export function canonicalLabHost(value) {
  try {
    return new URL(String(value).includes('://') ? String(value) : `https://${value}`)
      .hostname.toLowerCase()
      .replace(/^\[|\]$/g, '');
  } catch {
    return '';
  }
}

export function isLabTargetHost(target, labTargets) {
  const host = canonicalLabHost(target);
  if (!host) return false;
  const labs = (Array.isArray(labTargets) ? labTargets : String(labTargets || '').split(/[,\s]+/))
    .map((s) => String(s).trim())
    .filter(Boolean);
  return labs.some((lab) => canonicalLabHost(lab) === host);
}

export function resolveLabCreds({ role, target, labCreds, labTargets }) {
  if (role !== 'admin') return null;
  if (!labCreds || typeof labCreds.username !== 'string' || !labCreds.username) return null;
  if (typeof labCreds.password !== 'string' || !labCreds.password) return null;
  if (!isLabTargetHost(target, labTargets)) return null;
  return { username: labCreds.username, password: labCreds.password };
}
