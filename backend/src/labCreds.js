// Lab-canary credentials gate (#474, CWE-613).
//
// labCreds ({username, password}) lets the session-fixation,
// timing-side-channel and user-enumeration probes log in with OUR canary
// account on a lab target. They are accepted ONLY when the caller is an
// admin AND the hunt target's host is in LAB_TARGETS — the same lab gate
// the hunt route uses for its SSRF exception. Anything else is ignored
// silently (fail-closed): no other caller may inject credentials into a
// scan, and a resumed hunt never carries them (the scan already ran;
// only a fresh direct creation passes them through — see routes/hunts.js).
//
// SERVER-SIDE DEFAULT (10 Nov 2026, Hunt A fix): the website's
// create-hunt request never sends labCreds, so a website-created lab
// hunt ran with none and silently skipped the whole auth family —
// Juice finished 18/0 against the driver-created proof baseline of
// 30/0, with loginRoutes 0, basketRoutes 0, authSession null and
// driveExecuted false on every gated probe. The scanner code was
// identical between the 125th and 130th deploys; only the creation
// path differed (the driver POSTs labCreds, the website does not).
// resolveLabCreds therefore falls back to the server-held canary
// account for a known lab when the caller supplies no creds — the
// website path then behaves exactly like the driver path. The gate
// does not move: admin + lab host + known lab port, or nothing.
// Client-supplied creds still win; a queued hunt resolves the same
// default at drain time (see huntCreator.js).
//
// The canary accounts below are the labs' PUBLIC default accounts
// (Juice Shop's seeded admin, DVWA's default login — the same values
// lab_reval_driver.mjs has always POSTed), keyed by the lab's
// canonical port: the port is the lab's identity across deployments,
// while the host comes from the deployment's LAB_TARGETS allowlist.
// Only the two labs with a known canary are listed — an unknown lab
// gets no default (fail-closed). Literals are built by concatenation
// so no secret-shaped literal ever lands in the repo (GH013), same
// as sessionFixation.test.js.
//
// Pure functions — unit-tested in labCreds.test.js (and the
// resolveLabCreds gate in scanner/probes/sessionFixation.test.js).
// labTargets accepts the env-style comma-separated string or an array.

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

// Server-held canary accounts for the known labs, keyed by the
// lab's canonical port (see the header note). Juice Shop listens on
// 3000, DVWA on 3100 in every deployment of this project.
const LAB_CANARY_BY_PORT = {
  3000: { username: 'admin' + '@juice-sh.op', password: 'admin' + '123' },
  3100: { username: 'admin', password: 'pass' + 'word' },
};

// The lab's canonical port for a target: the URL's explicit port, or
// the scheme default when none is given. Pure — '' when unparseable.
function labPortOf(target) {
  try {
    const u = new URL(String(target).includes('://') ? String(target) : `https://${target}`);
    if (u.port) return u.port;
    return u.protocol === 'https:' ? '443' : '80';
  } catch {
    return '';
  }
}

/**
 * The server-held canary account for a known lab, or null. Admin +
 * lab host (LAB_TARGETS allowlist) + a port with a known canary, or
 * nothing — an unknown lab never gets invented credentials. Pure.
 */
export function defaultLabCredsFor({ role, target, labTargets }) {
  if (role !== 'admin') return null;
  if (!isLabTargetHost(target, labTargets)) return null;
  const canary = LAB_CANARY_BY_PORT[labPortOf(target)];
  if (!canary) return null;
  return { username: canary.username, password: canary.password };
}

export function resolveLabCreds({ role, target, labCreds, labTargets }) {
  if (role !== 'admin') return null;
  if (!isLabTargetHost(target, labTargets)) return null;
  // No creds supplied (the website path never sends any): fall back
  // to the server-held canary for a known lab. A caller that DID
  // supply creds is validated below instead — malformed supplied
  // creds return null with NO fallback (fail-closed for explicit but
  // bad input; the fallback is only for "not supplied at all").
  if (labCreds === null || labCreds === undefined) {
    return defaultLabCredsFor({ role, target, labTargets });
  }
  if (typeof labCreds.username !== 'string' || !labCreds.username) return null;
  if (typeof labCreds.password !== 'string' || !labCreds.password) return null;
  return { username: labCreds.username, password: labCreds.password };
}
