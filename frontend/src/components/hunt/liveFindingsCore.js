/**
 * liveFindingsCore.js — wave 38 (ideas 51509–51520): live findings feed —
 * pure logic for Infinity AI.
 *
 * Real-time findings stream, toast alerts with severity color-coding, audio
 * cue descriptors, a scrolling ticker, rich cards with inline evidence
 * previews, a slide-over detail drawer, live severity badges, confidence
 * sparklines, a new-finding spotlight, feed filters, full-text search, and
 * auto-grouping of related findings.
 *
 * Pure functions only — no DOM/window/timer side effects — unit-testable
 * with node:test. Deterministic: no Date.now(), no Math.random().
 */

export const WAVE38_LF_START = 51509;
export const WAVE38_LF_END = 51520;

/** Registry of the 12 live findings feed ideas — completeness is testable. */
export const WAVE38_LF_IDEAS = [
  [51509, 'live findings feed', 'Findings stream in the moment they are confirmed, newest first'],
  [51510, 'finding toast alerts', 'Unobtrusive popups for new findings with severity color-coding'],
  [51511, 'severity sound cues', 'Optional audio tones distinguishing critical from low findings'],
  [51512, 'findings ticker', 'A scrolling ticker of the latest findings across all hunts'],
  [51513, 'live finding cards', 'Rich cards with evidence preview expanding inline'],
  [51514, 'finding detail drawer', 'Slide-over panel with full evidence without leaving the feed'],
  [51515, 'real-time severity badges', 'Severity updates live as the agent gathers more evidence'],
  [51516, 'finding confidence sparkline', 'Confidence trending up or down as validation proceeds'],
  [51517, 'new-finding spotlight', 'The newest finding highlighted until acknowledged'],
  [51518, 'finding feed filters', 'Filter by severity, confidence, asset, or technique instantly'],
  [51519, 'finding feed search', 'Full-text search across live and historical findings'],
  [51520, 'finding grouping', 'Related findings auto-clustered into collapsible groups'],
];

/* --- 51509 · live findings feed ----------------------------------------------------- */

/**
 * Insert or replace a finding in the feed, keeping newest-first order by seq.
 * Never mutates the input array; returns a fresh array.
 */
export function insertFinding(feed, finding) {
  const list = (feed || []).slice();
  const idx = list.findIndex(f => f && f.id === finding.id);
  if (idx >= 0) {
    list[idx] = { ...finding };
  } else {
    list.push({ ...finding });
  }
  list.sort((a, b) => (b.seq || 0) - (a.seq || 0));
  return list;
}

/* --- 51510 · finding toast alerts ----------------------------------------------------- */

export const SEVERITY_COLORS = {
  critical: '#ff5c5c',
  high: '#ff9f43',
  medium: '#f5c542',
  low: '#6bcB77',
};

export const SEVERITIES = ['critical', 'high', 'medium', 'low'];

export function pushToast(queue, finding) {
  const entry = {
    id: 'toast-' + finding.id,
    findingId: finding.id,
    severity: finding.severity,
    color: SEVERITY_COLORS[finding.severity] || '#9aa3b2',
    dismissed: false,
  };
  return [...(queue || []), entry];
}

export function dismissToast(queue, toastId) {
  return (queue || []).filter(t => t.id !== toastId);
}

/* --- 51511 · severity sound cues ------------------------------------------------------- */

/**
 * Descriptor table for per-severity audio cues. The pure module only carries
 * the descriptors; actual tone playback happens in the UI layer.
 */
export const SOUND_CUES = {
  critical: { tone: 'two-tone high', label: 'Critical: urgent double tone', enabled: true },
  high: { tone: 'single high', label: 'High: single high tone', enabled: true },
  medium: { tone: 'mid chime', label: 'Medium: soft mid chime', enabled: true },
  low: { tone: 'low blip', label: 'Low: quiet low blip', enabled: true },
};

export function soundCueFor(severity) {
  return SOUND_CUES[severity] || SOUND_CUES.low;
}

/* --- 51512 · findings ticker ------------------------------------------------------------ */

export function tickerSlice(feed, count) {
  return (feed || []).slice(0, count).map(f => ({
    id: f.id,
    text: '[' + f.severity + '] ' + f.title,
  }));
}

/* --- 51513 · live finding cards ---------------------------------------------------------- */

export function liveCardPayload(finding) {
  const f = finding || {};
  const evidence = f.evidence || [];
  return {
    id: f.id,
    title: f.title,
    severity: f.severity,
    confidence: f.confidence,
    asset: f.asset,
    technique: f.technique,
    evidencePreview: evidence.slice(0, 2),
    evidenceCount: evidence.length,
  };
}

/* --- 51514 · finding detail drawer --------------------------------------------------------- */

export function openDrawer(findingId) {
  return { open: true, findingId };
}

export function closeDrawer() {
  return { open: false, findingId: null };
}

/* --- 51515 · real-time severity badges ------------------------------------------------------- */

export function mergeSeverity(finding, newSeverity) {
  return {
    ...finding,
    severity: newSeverity,
    severityHistory: [...(finding.severityHistory || [finding.severity]), newSeverity],
  };
}

/* --- 51516 · finding confidence sparkline ------------------------------------------------------ */

/**
 * Build SVG polyline points for a confidence history (0–100 per entry).
 * x spreads across width by index; y maps confidence to height. Coordinates
 * are rounded to one decimal place for stable rendering.
 */
export function sparklinePoints(history, width, height) {
  const values = history || [];
  const n = values.length;
  const points = values
    .map((v, i) => {
      const x = n > 1 ? (i / (n - 1)) * width : width / 2;
      const y = height - (v / 100) * height;
      return `${Number(x.toFixed(1))},${Number(y.toFixed(1))}`;
    })
    .join(' ');
  return { points, width, height };
}

/* --- 51517 · new-finding spotlight ----------------------------------------------------------------- */

export function acknowledgeSpotlight(acknowledged, findingId) {
  return [...new Set([...(acknowledged || []), findingId])];
}

export function isSpotlit(acknowledged, findingId) {
  return !(acknowledged || []).includes(findingId);
}

/* --- 51518 · finding feed filters --------------------------------------------------------------------- */

export function matchFilters(finding, filters) {
  const f = finding || {};
  const flt = filters || {};
  const severities = flt.severities || [];
  if (severities.length > 0 && !severities.includes(f.severity)) return false;
  const minConfidence = flt.minConfidence || 0;
  if ((f.confidence || 0) < minConfidence) return false;
  if (flt.asset && f.asset !== flt.asset) return false;
  if (flt.technique && f.technique !== flt.technique) return false;
  return true;
}

/* --- 51519 · finding feed search ------------------------------------------------------------------------- */

function evidenceText(evidence) {
  return (evidence || []).map(e => (typeof e === 'string' ? e : String(e))).join(' ');
}

export function searchFeed(feed, query) {
  const q = String(query || '')
    .trim()
    .toLowerCase();
  const list = feed || [];
  if (!q) return list;
  return list.filter(f => {
    const haystack = [f.title, f.type, f.asset, f.technique, evidenceText(f.evidence)]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

/* --- 51520 · finding grouping -------------------------------------------------------------------------------- */

export function groupFindings(feed) {
  const groups = new Map();
  (feed || []).forEach(f => {
    const key = `${f.asset || ''}::${f.type || ''}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        asset: f.asset || '',
        type: f.type || '',
        findings: [],
        count: 0,
        collapsed: false,
      });
    }
    const g = groups.get(key);
    g.findings.push(f);
    g.count = g.findings.length;
  });
  return [...groups.values()].sort((a, b) => b.count - a.count);
}
