/**
 * dnsSecurityRecon.js — DNS security reconnaissance (ideas 00651–00655).
 *
 * Defensive analysis capabilities for an authorized bug-bounty agent:
 *  - Zone-transfer attempt scheduling around SOA serial increments (00651)
 *  - NSEC3 opt-out analysis identifying unsigned delegations (00652)
 *  - DNSSEC key-rollover monitoring with validation-gap detection (00653)
 *  - DANE TLSA rotation tracking correlated with certificate changes (00654)
 *  - SSHFP rotation monitoring distinguishing planned rotation from anomaly (00655)
 *
 * All functions are pure and side-effect free: they analyse supplied
 * observations (SOA history, NSEC3PARAM/DNSKEY/TLSA/SSHFP snapshots). No
 * network I/O happens in this module.
 */

/**
 * Idea 00651 — Schedule authorized AXFR attempts around zone serial increments.
 *
 * An AXFR attempt made just after a zone's SOA serial increments returns the
 * freshest data; attempts fired at random times usually return the same stale
 * copy and add load. This planner derives the zone's serial-change cadence
 * from observed SOA history and emits a per-nameserver attempt schedule that
 * clusters attempts around the expected next serial increment, with jitter
 * and cooldowns so the target is never hammered.
 *
 * AXFR is only ever attempted against explicitly authorized targets: when
 * `authorized` is false the plan is refused instead of emitted.
 *
 * @param {object} opts
 * @param {string} opts.zone zone name, e.g. "example.com"
 * @param {string[]} [opts.nameservers] authoritative nameservers to schedule
 * @param {Array<{serial: number, observedAt: string}>} [opts.soaHistory] SOA observations, oldest first
 * @param {boolean} [opts.authorized] must be true for an authorized target
 * @param {string} [opts.asOf] ISO timestamp the schedule is anchored to
 * @param {number} [opts.maxAttemptsPerDay] cap per nameserver (default 6)
 * @returns {{authorized: boolean, zone: string, reason?: string, strategy?: string,
 *   avgChangeIntervalHours?: number|null, expectedNextChangeAt?: string|null,
 *   attempts?: Array<object>}}
 */
export function planAxfrSchedule({
  zone,
  nameservers = [],
  soaHistory = [],
  authorized = false,
  asOf,
  maxAttemptsPerDay = 6,
} = {}) {
  const zoneName = String(zone || '');
  if (!authorized) {
    return {
      authorized: false,
      zone: zoneName,
      reason:
        'AXFR scheduling refused: target is not marked as authorized. Zone-transfer ' +
        'attempts are only scheduled against explicitly authorized scopes.',
    };
  }

  const history = [...(soaHistory || [])]
    .filter(h => h && Number.isFinite(Number(h.serial)) && h.observedAt)
    .sort((a, b) => new Date(a.observedAt) - new Date(b.observedAt));

  // Derive serial-change cadence: only count observations where the serial moved.
  const changeTimes = [];
  for (let i = 1; i < history.length; i++) {
    if (Number(history[i].serial) !== Number(history[i - 1].serial)) {
      changeTimes.push(new Date(history[i].observedAt).getTime());
    }
  }
  let avgChangeIntervalHours = null;
  if (changeTimes.length >= 2) {
    let sum = 0;
    for (let i = 1; i < changeTimes.length; i++) sum += changeTimes[i] - changeTimes[i - 1];
    avgChangeIntervalHours = sum / (changeTimes.length - 1) / 3_600_000;
  }

  const anchor = new Date(asOf || new Date().toISOString()).getTime();
  const lastChange = changeTimes.length
    ? changeTimes[changeTimes.length - 1]
    : history.length
      ? new Date(history[history.length - 1].observedAt).getTime()
      : anchor;
  const expectedNextChangeAt = avgChangeIntervalHours
    ? new Date(lastChange + avgChangeIntervalHours * 3_600_000).toISOString()
    : null;

  const strategy = avgChangeIntervalHours
    ? `Serial increments every ~${avgChangeIntervalHours.toFixed(1)}h; attempts cluster around the expected next change.`
    : 'Serial cadence unknown; attempts spread evenly across the day with jitter.';

  const servers = nameservers.length ? nameservers : ['primary'];
  const attempts = [];
  const perServer = Math.max(1, Math.min(maxAttemptsPerDay, 12));
  const dayMs = 86_400_000;

  servers.forEach((ns, nsIndex) => {
    for (let i = 0; i < perServer; i++) {
      let at;
      let kind;
      if (expectedNextChangeAt) {
        // Cluster around the expected increment: half before, half after,
        // staggered per nameserver so no two servers are hit simultaneously.
        const windowHours = Math.max(avgChangeIntervalHours * 0.15, 0.25);
        const offsetHours = (i - (perServer - 1) / 2) * (windowHours / Math.max(perServer - 1, 1));
        at = new Date(
          lastChange +
            avgChangeIntervalHours * 3_600_000 +
            offsetHours * 3_600_000 +
            nsIndex * 5 * 60_000
        ).getTime();
        kind = 'serial-refresh';
      } else {
        // Unknown cadence: spread across the day with deterministic jitter.
        const spread = (i / perServer) * dayMs;
        const jitter = ((nsIndex * 37 + i * 17) % 30) * 60_000; // 0–29 min
        at = anchor + spread + jitter;
        kind = 'baseline-poll';
      }
      attempts.push({
        nameserver: String(ns),
        kind,
        scheduledAt: new Date(at).toISOString(),
        jitterMinutes: 5,
        maxRetries: 2,
        cooldownMinutes: 30,
        reason:
          kind === 'serial-refresh'
            ? 'Attempt lands near the expected SOA serial increment for fresh zone data.'
            : 'Baseline attempt: serial cadence unknown, probing for increments.',
      });
    }
  });

  attempts.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

  return {
    authorized: true,
    zone: zoneName,
    strategy,
    avgChangeIntervalHours,
    expectedNextChangeAt,
    attempts,
  };
}

/**
 * Idea 00652 — Detect NSEC3 opt-out zones and rank unsigned delegations.
 *
 * When a zone enables NSEC3 opt-out, unsigned delegations are not covered by
 * NSEC3 records — an attacker can spoof them. This analysis reads the
 * NSEC3PARAM flags and the zone's delegation set and ranks the unsigned
 * delegations that are worth targeting during an authorized hunt.
 *
 * @param {object} opts
 * @param {string} opts.zone zone name
 * @param {Array<{algorithm?: number, flags?: number, iterations?: number, salt?: string}>} [opts.nsec3Params]
 * @param {Array<{name: string, nsTargets?: string[], hasDs?: boolean}>} [opts.delegations]
 * @returns {{optOutEnabled: boolean, unsignedDelegations: Array<object>, summary: string}}
 */
export function analyzeNsec3OptOut({ zone, nsec3Params = [], delegations = [] } = {}) {
  const zoneName = String(zone || '');
  const params = nsec3Params || [];
  const optOutEnabled = params.some(p => p && (Number(p.flags) & 1) === 1);

  const PROVIDER_NS =
    /cloudflare|akamai|awsdns|azure-dns|googledomains|ns\d+\.digitalocean|route53|dnsmadeeasy/i;

  const unsignedDelegations = [];
  if (optOutEnabled) {
    for (const d of delegations || []) {
      if (!d || !d.name || d.hasDs) continue;
      const reasons = [
        'Unsigned delegation in an NSEC3 opt-out zone: responses for this name can be spoofed.',
      ];
      let risk = 50;
      const depth = String(d.name).split('.').length;
      if (depth >= 4) {
        risk += 20;
        reasons.push('Deeply nested delegation — typically receives less operational oversight.');
      }
      const targets = d.nsTargets || [];
      if (targets.some(t => String(t).toLowerCase().endsWith(`.${zoneName.toLowerCase()}`))) {
        risk += 15;
        reasons.push(
          'In-bailiwick nameservers: the delegation cut itself is a spoofing candidate.'
        );
      }
      if (targets.some(t => PROVIDER_NS.test(String(t)))) {
        risk -= 20;
        reasons.push('Delegated to a managed DNS provider — harder to exploit.');
      }
      risk = Math.max(0, Math.min(100, risk));
      unsignedDelegations.push({
        name: d.name,
        nsTargets: targets,
        risk,
        severity: risk >= 70 ? 'high' : risk >= 40 ? 'medium' : 'low',
        reasons,
      });
    }
    unsignedDelegations.sort((a, b) => b.risk - a.risk);
  }

  return {
    optOutEnabled,
    zone: zoneName,
    unsignedDelegations,
    unsignedCount: unsignedDelegations.length,
    summary: optOutEnabled
      ? `${unsignedDelegations.length} unsigned delegation(s) in NSEC3 opt-out zone ${zoneName}; highest risk first.`
      : `NSEC3 opt-out is not enabled in ${zoneName}; delegations remain covered by NSEC3.`,
  };
}

/**
 * Idea 00653 — Monitor DNSSEC key rollovers and flag validation gaps.
 *
 * Compares DNSKEY snapshots over time to reconstruct the key lifecycle:
 * introductions, removals, rollover phases (pre-publish, double-signature,
 * double-DS) and, critically, windows where the zone was left without a
 * valid signing key — the validation gaps a hunter wants to know about.
 *
 * @param {object} opts
 * @param {string} opts.zone zone name
 * @param {Array<{observedAt: string, dnskeys: Array<{keyTag: number, algorithm: number, flags: number, publicKey?: string}>}>} [opts.snapshots]
 * @returns {{zone: string, events: Array<object>, gaps: Array<object>, currentKeys: Array<object>, summary: string}}
 */
export function monitorKeyRollover({ zone, snapshots = [] } = {}) {
  const zoneName = String(zone || '');
  const snaps = [...(snapshots || [])]
    .filter(s => s && s.observedAt && Array.isArray(s.dnskeys))
    .sort((a, b) => new Date(a.observedAt) - new Date(b.observedAt));

  const roleOf = flags => ((Number(flags) & 1) === 1 ? 'KSK' : 'ZSK');
  const idOf = k => `${k.keyTag}/${k.algorithm}`;
  const keySet = s => new Map(s.dnskeys.map(k => [idOf(k), { ...k, role: roleOf(k.flags) }]));

  const events = [];
  const gaps = [];
  let previous = null;

  for (const snap of snaps) {
    const current = keySet(snap);
    if (previous) {
      for (const [id, key] of current) {
        if (!previous.has(id)) {
          events.push({
            type: 'key-introduced',
            keyTag: key.keyTag,
            algorithm: key.algorithm,
            role: key.role,
            at: snap.observedAt,
            detail: `New ${key.role} ${key.keyTag} published — rollover started.`,
          });
          const oldSameRole = [...previous.values()].filter(p => p.role === key.role);
          if (oldSameRole.length) {
            events.push({
              type: key.role === 'ZSK' ? 'double-signature-phase' : 'double-ds-phase',
              keyTag: key.keyTag,
              algorithm: key.algorithm,
              role: key.role,
              at: snap.observedAt,
              detail:
                key.role === 'ZSK'
                  ? `Old ZSK(s) ${oldSameRole.map(k => k.keyTag).join(',')} still present: double-signature phase.`
                  : `Old KSK(s) ${oldSameRole.map(k => k.keyTag).join(',')} still present: double-DS phase.`,
            });
          } else {
            events.push({
              type: 'prepublish-phase',
              keyTag: key.keyTag,
              algorithm: key.algorithm,
              role: key.role,
              at: snap.observedAt,
              detail: `No prior ${key.role} seen: key is in pre-publish/standby before activation.`,
            });
          }
        }
      }
      for (const [id, key] of previous) {
        if (!current.has(id)) {
          const replacement = [...current.values()].filter(c => c.role === key.role);
          events.push({
            type: 'key-removed',
            keyTag: key.keyTag,
            algorithm: key.algorithm,
            role: key.role,
            at: snap.observedAt,
            detail: replacement.length
              ? `${key.role} ${key.keyTag} retired; ${replacement.map(k => k.keyTag).join(',')} now active — rollover complete.`
              : `${key.role} ${key.keyTag} retired with NO replacement.`,
          });
          if (!replacement.length && key.role === 'ZSK') {
            gaps.push({
              type: 'validation-gap-no-zsk',
              at: snap.observedAt,
              severity: 'critical',
              detail:
                'Last zone-signing key removed — validators cannot verify new signatures until a ZSK returns.',
            });
          }
        }
      }
      if (current.size === 0 && previous.size > 0) {
        gaps.push({
          type: 'zone-unsigned-window',
          at: snap.observedAt,
          severity: 'critical',
          detail: 'DNSKEY set is empty: the zone is unsigned in this snapshot.',
        });
      }
    }
    previous = current;
  }

  const currentKeys = previous ? [...previous.values()] : [];
  return {
    zone: zoneName,
    events,
    gaps,
    currentKeys,
    keyCount: currentKeys.length,
    summary: `${events.length} rollover event(s), ${gaps.length} validation gap(s) across ${snaps.length} snapshot(s).`,
  };
}

/**
 * Idea 00654 — Track DANE TLSA rotations and correlate with certificate deployments.
 *
 * Diffs TLSA record sets across snapshots to detect rotations and checks
 * each snapshot's served certificate (SPKI hash) against the published TLSA
 * records, flagging windows where DANE clients would fail validation —
 * typically a stale TLSA set after a certificate deployment.
 *
 * @param {object} opts
 * @param {string} opts.service service label, e.g. "_443._tcp.example.com"
 * @param {Array<{observedAt: string, records: Array<{usage: number, selector: number, matchingType: number, associationData: string}>, servedSpki?: string}>} [opts.snapshots]
 * @returns {{service: string, rotations: Array<object>, correlations: Array<object>, gaps: Array<object>, summary: string}}
 */
export function trackTlsaRotation({ service, snapshots = [] } = {}) {
  const serviceName = String(service || '');
  const snaps = [...(snapshots || [])]
    .filter(s => s && s.observedAt && Array.isArray(s.records))
    .sort((a, b) => new Date(a.observedAt) - new Date(b.observedAt));

  const idOf = r =>
    `${r.usage}/${r.selector}/${r.matchingType}/${String(r.associationData || '').toLowerCase()}`;

  const rotations = [];
  const correlations = [];
  const gaps = [];
  let previous = null;

  for (const snap of snaps) {
    const current = new Set(snap.records.map(idOf));
    if (previous) {
      const added = [...current].filter(id => !previous.has(id));
      const removed = [...previous].filter(id => !current.has(id));
      if (added.length || removed.length) {
        rotations.push({
          at: snap.observedAt,
          kind: added.length && removed.length ? 'rotation' : added.length ? 'addition' : 'removal',
          added,
          removed,
          detail:
            added.length && removed.length
              ? 'TLSA record set rotated — correlate with a certificate deployment.'
              : added.length
                ? 'New TLSA records published (likely pre-publish ahead of cert deployment).'
                : 'TLSA records removed (likely post-deployment cleanup).',
        });
      }
    }
    previous = current;

    if (snap.servedSpki) {
      const spki = String(snap.servedSpki).toLowerCase();
      const matched = snap.records.filter(
        r => String(r.associationData || '').toLowerCase() === spki
      );
      correlations.push({
        at: snap.observedAt,
        servedSpki: snap.servedSpki,
        matchesPublishedTlsa: matched.length > 0,
        matchedRecords: matched.length,
      });
      if (!matched.length && snap.records.length) {
        gaps.push({
          type: 'dane-mismatch-window',
          at: snap.observedAt,
          severity: 'high',
          detail:
            'Served certificate SPKI matches no published TLSA record — DANE-EE/DANE-TA clients would fail validation.',
        });
      }
    }
  }

  return {
    service: serviceName,
    rotations,
    correlations,
    gaps,
    summary: `${rotations.length} TLSA rotation(s), ${gaps.length} DANE mismatch window(s) across ${snaps.length} snapshot(s).`,
  };
}

/**
 * Idea 00655 — Monitor SSHFP records for host-key rotations and migrations.
 *
 * Diffs SSHFP record sets across snapshots and classifies each change:
 * a planned rotation (same algorithm, new key, stable afterwards), a host
 * migration (full key-set replacement) or an anomaly worth investigating
 * (algorithm downgrade, rapid key flapping).
 *
 * @param {object} opts
 * @param {string} opts.hostname hostname being monitored
 * @param {Array<{observedAt: string, records: Array<{algorithm: number, fpType: number, fingerprint: string}>}>} [opts.snapshots]
 * @returns {{hostname: string, events: Array<object>, anomalies: Array<object>, currentRecords: Array<object>, summary: string}}
 */
export function monitorSshfpRotation({ hostname, snapshots = [] } = {}) {
  const host = String(hostname || '');
  const snaps = [...(snapshots || [])]
    .filter(s => s && s.observedAt && Array.isArray(s.records))
    .sort((a, b) => new Date(a.observedAt) - new Date(b.observedAt));

  const idOf = r => `${r.algorithm}/${r.fpType}/${String(r.fingerprint || '').toLowerCase()}`;
  const STRONG_ALGS = new Set([3, 4]); // ECDSA, Ed25519

  const events = [];
  const anomalies = [];
  let previous = null;
  const changeTimesByAlg = new Map();

  for (const snap of snaps) {
    const current = new Map(snap.records.map(r => [idOf(r), r]));
    if (previous) {
      const added = [...current.values()].filter(r => !previous.has(idOf(r)));
      const removed = [...previous.values()].filter(r => !current.has(idOf(r)));

      const prevAlgs = new Set([...previous.values()].map(r => r.algorithm));
      const currAlgs = new Set([...current.values()].map(r => r.algorithm));
      const hadStrong = [...prevAlgs].some(a => STRONG_ALGS.has(a));
      const hasStrong = [...currAlgs].some(a => STRONG_ALGS.has(a));
      if (hadStrong && !hasStrong && current.size > 0) {
        anomalies.push({
          type: 'algorithm-downgrade',
          at: snap.observedAt,
          severity: 'high',
          detail:
            'Strong host-key algorithms (ECDSA/Ed25519) disappeared; only weaker algorithms remain.',
        });
      }

      for (const r of added) {
        const sameAlgOld = [...previous.values()].find(p => p.algorithm === r.algorithm);
        const flapTimes = changeTimesByAlg.get(r.algorithm) || [];
        const recent = flapTimes.filter(t => new Date(snap.observedAt) - new Date(t) < 86_400_000);
        changeTimesByAlg.set(r.algorithm, [...flapTimes, snap.observedAt]);
        if (recent.length >= 1) {
          anomalies.push({
            type: 'rapid-key-flap',
            at: snap.observedAt,
            severity: 'medium',
            detail: `Host key for algorithm ${r.algorithm} changed again within 24h — investigate before trusting.`,
          });
        }
        const isMigration =
          removed.length > 0 &&
          added.length >= removed.length &&
          ![...previous.values()].some(p => current.has(idOf(p)));
        events.push({
          type: isMigration ? 'migration' : 'planned-rotation',
          algorithm: r.algorithm,
          fpType: r.fpType,
          at: snap.observedAt,
          detail: isMigration
            ? 'Full SSHFP set replaced with no key overlap — host migration or rebuild.'
            : sameAlgOld
              ? `Host key rotated for algorithm ${r.algorithm} (old fingerprint retired, new one published).`
              : `New SSHFP record for algorithm ${r.algorithm}.`,
        });
      }
    }
    previous = current;
  }

  return {
    hostname: host,
    events,
    anomalies,
    currentRecords: previous ? [...previous.values()] : [],
    summary: `${events.length} rotation event(s), ${anomalies.length} anomalie(s) across ${snaps.length} snapshot(s).`,
  };
}

export const DNS_SECURITY_RECON = {
  planAxfrSchedule,
  analyzeNsec3OptOut,
  monitorKeyRollover,
  trackTlsaRotation,
  monitorSshfpRotation,
};

export default DNS_SECURITY_RECON;
