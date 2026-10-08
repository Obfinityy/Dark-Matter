/**
 * wave28.test.js — wave 28 (ideas 51081–51120): live hunt-status
 * transparency suite, round 2 pure logic.
 *
 * node:test checks for statusRound2Core pure logic and the wave-28
 * registry completeness (40/40, zero skips).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAVE28_IDEAS,
  WAVE28_START,
  WAVE28_END,
  tabTitleStatus,
  statusApiPayload,
  captureSnapshot,
  intentExplanation,
  dependencyDisplay,
  approachConfidence,
  confidenceLabel,
  CONF_HIGH,
  CONF_MEDIUM,
  CONF_LOW,
  consideredAlternatives,
  moduleStatus,
  quietModeFilter,
  QUIET_ON,
  QUIET_OFF,
  pushAlertPayload,
  terminalLine,
  emojiForPhase,
  STATUS_EMOJI,
  timeSinceFinding,
  coverageSummary,
  pausedStatus,
  approvalWaitStatus,
  exportStatusCsv,
  exportStatusMarkdown,
  openQaThread,
  qaReply,
  flagUncertain,
  forecastPhases,
  GRAN_SUMMARY,
  GRAN_STANDARD,
  GRAN_VERBOSE,
  GRANULARITIES,
  applyGranularity,
  componentStatus,
  scrubTimeline,
  addBookmark,
  removeBookmark,
  workloadMeter,
  modelSwitchNotice,
  bilingualStatus,
  redactPayload,
  linkFindings,
  idleNudges,
  activityHeatmap,
  avatarNarration,
  managerStatus,
  lastVisitDiff,
  currentTaskEta,
  confidenceTrend,
  parseFocusCommand,
  parseSkipCommand,
  priorityBoost,
  demoteNoisy,
} from './statusRound2Core.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('wave 28 registry', () => {
  it('covers 40/40 ideas, zero skips, ids 51081–51120 in order', () => {
    assert.equal(WAVE28_IDEAS.length, 40);
    assert.equal(WAVE28_START, 51081);
    assert.equal(WAVE28_END, 51120);
    const ids = WAVE28_IDEAS.map(([id]) => id);
    assert.deepEqual(
      ids,
      Array.from({ length: 40 }, (_, i) => 51081 + i)
    );
    for (const [id, name, desc] of WAVE28_IDEAS) {
      assert.ok(name && name.length > 0, `idea ${id} missing name`);
      assert.ok(desc && desc.length > 0, `idea ${id} missing description`);
    }
  });
});

describe('51081 tab-title status', () => {
  it('builds a one-line live status string', () => {
    const t = tabTitleStatus({ phase: 'probe', action: 'testing login', findingCount: 3 });
    assert.ok(t.includes('probe'));
    assert.ok(t.includes('testing login'));
    assert.ok(t.includes('3 findings'));
  });
  it('handles missing fields', () => {
    assert.ok(tabTitleStatus({}).includes('idle'));
  });
});

describe('51082 status API payload', () => {
  it('returns machine-readable JSON shape', () => {
    const p = statusApiPayload({
      huntId: 'h-1',
      phase: 'crawl',
      progressPct: 50,
      findingCount: 2,
      updatedAtMs: 1000,
    });
    assert.equal(p.version, 1);
    assert.equal(p.huntId, 'h-1');
    assert.equal(p.phase, 'crawl');
    assert.equal(p.progressPct, 50);
  });
});

describe('51083 status snapshots', () => {
  it('captures timestamped snapshots', () => {
    const snaps = captureSnapshot({ phase: 'probe', progressPct: 30 }, 5000, []);
    assert.equal(snaps.length, 1);
    assert.equal(snaps[0].capturedAtMs, 5000);
    assert.equal(snaps[0].phase, 'probe');
  });
});

describe('51084 intent explanation', () => {
  it('connects action to goal', () => {
    const s = intentExplanation('fuzzing /api/login', 'find auth bypass');
    assert.ok(s.includes('fuzzing /api/login'));
    assert.ok(s.includes('find auth bypass'));
  });
});

describe('51085 dependency display', () => {
  it('reports blocked state and waits-for list', () => {
    const d = dependencyDisplay({ waitsFor: ['recon results'] });
    assert.equal(d.blocked, true);
    assert.deepEqual(d.waitsFor, ['recon results']);
  });
  it('reports unblocked when nothing pending', () => {
    assert.equal(dependencyDisplay({ waitsFor: [] }).blocked, false);
    assert.equal(dependencyDisplay(null).blocked, false);
  });
});

describe('51086 approach confidence', () => {
  it('bands scores into high/medium/low', () => {
    assert.equal(approachConfidence(0.9), CONF_HIGH);
    assert.equal(approachConfidence(0.5), CONF_MEDIUM);
    assert.equal(approachConfidence(0.1), CONF_LOW);
  });
  it('clamps out-of-range scores', () => {
    assert.equal(approachConfidence(5), CONF_HIGH);
    assert.equal(approachConfidence(-1), CONF_LOW);
  });
  it('labels each band', () => {
    assert.ok(confidenceLabel(CONF_HIGH).length > 0);
    assert.ok(confidenceLabel(CONF_LOW).length > 0);
  });
});

describe('51087 considered alternatives', () => {
  it('lists alternatives with rejection reasons', () => {
    const alts = consideredAlternatives({
      alternatives: [{ name: 'manual', rejectedBecause: 'slow' }],
    });
    assert.equal(alts[0].name, 'manual');
    assert.equal(alts[0].rejectedBecause, 'slow');
  });
  it('returns empty for missing data', () => {
    assert.deepEqual(consideredAlternatives({}), []);
  });
});

describe('51088 per-module status', () => {
  it('drills into a named module', () => {
    const r = moduleStatus([{ name: 'crawler', status: 'crawling', progressPct: 61 }], 'crawler');
    assert.equal(r.found, true);
    assert.equal(r.status, 'crawling');
  });
  it('reports unknown modules', () => {
    assert.equal(moduleStatus([], 'nope').found, false);
  });
});

describe('51089 quiet status mode', () => {
  it('keeps only phase changes and findings when on', () => {
    const updates = [{ kind: 'phase' }, { kind: 'routine' }, { kind: 'finding' }];
    assert.equal(quietModeFilter(updates, QUIET_ON).length, 2);
    assert.equal(quietModeFilter(updates, QUIET_OFF).length, 3);
  });
});

describe('51090 push status alerts', () => {
  it('builds a notification payload', () => {
    const p = pushAlertPayload({ title: 'Done', body: 'Recon finished', kind: 'phase' });
    assert.equal(p.title, 'Done');
    assert.equal(p.kind, 'phase');
  });
});

describe('51091 terminal-style status', () => {
  it('formats a monospace line', () => {
    const line = terminalLine({ atMs: 1728300000000, kind: 'phase', text: 'Recon done' });
    assert.ok(line.includes('PHASE'));
    assert.ok(line.includes('Recon done'));
  });
});

describe('51092 status emoji legend', () => {
  it('maps known phases and falls back', () => {
    assert.equal(emojiForPhase('recon'), STATUS_EMOJI.recon);
    assert.equal(emojiForPhase('nope'), '•');
  });
});

describe('51093 time-since-finding', () => {
  it('formats elapsed time', () => {
    assert.equal(timeSinceFinding(0, 1000), 'No findings yet');
    assert.equal(timeSinceFinding(999000, 1000000), 'Just now');
    assert.ok(timeSinceFinding(1000000 - 5 * 60000, 1000000).includes('5m'));
  });
});

describe('51094 coverage-so-far summary', () => {
  it('splits covered vs untouched', () => {
    const c = coverageSummary([
      { name: '/a', covered: true },
      { name: '/b', covered: false },
    ]);
    assert.equal(c.covered, 1);
    assert.deepEqual(c.untouched, ['/b']);
    assert.equal(c.pct, 50);
  });
});

describe('51095 paused-state status', () => {
  it('describes the freeze point and resume plan', () => {
    const ps = pausedStatus({ frozenPhase: 'probe', frozenAction: 'x', resumeNext: 'y' });
    assert.equal(ps.paused, true);
    assert.ok(ps.summary.includes('probe'));
  });
});

describe('51096 approval-wait status', () => {
  it('names the pending action and holder', () => {
    const aw = approvalWaitStatus({ action: 'intrusive scan', holder: 'you' });
    assert.ok(aw.summary.includes('intrusive scan'));
    assert.ok(aw.summary.includes('you'));
  });
});

describe('51097 status export', () => {
  const h = [{ atMs: 1000, kind: 'phase', phase: 'recon', text: 'done, "quoted"' }];
  it('exports CSV with quoting', () => {
    const csv = exportStatusCsv(h);
    assert.ok(csv.startsWith('atMs,kind,phase,text'));
    assert.ok(csv.includes('"""quoted"""') || csv.includes('"done, ""quoted"""'));
  });
  it('exports markdown', () => {
    const md = exportStatusMarkdown(h);
    assert.ok(md.startsWith('# Hunt status history'));
    assert.ok(md.includes('recon'));
  });
});

describe('51098 status Q&A thread', () => {
  it('opens and appends exchanges', () => {
    const t = qaReply(openQaThread('st-1'), 'why?', 'because');
    assert.equal(t.statusId, 'st-1');
    assert.equal(t.exchanges[0].question, 'why?');
  });
});

describe('51099 uncertainty flag', () => {
  it('marks unsure lines', () => {
    const f = flagUncertain('No SQLi', 'limited payloads');
    assert.equal(f.uncertain, true);
    assert.ok(f.display.startsWith('~'));
  });
});

describe('51100 upcoming-phase forecast', () => {
  it('looks ahead n steps', () => {
    const f = forecastPhases(
      [{ phase: 'a' }, { phase: 'b' }, { phase: 'c' }, { phase: 'd' }],
      0,
      2
    );
    assert.equal(f.length, 2);
    assert.equal(f[0].phase, 'b');
  });
});

describe('51101 status granularity dial', () => {
  it('filters by depth level', () => {
    const u = [{ depth: 'summary' }, { depth: 'standard' }, { depth: 'verbose' }];
    assert.equal(applyGranularity(u, GRAN_SUMMARY).length, 1);
    assert.equal(applyGranularity(u, GRAN_STANDARD).length, 2);
    assert.equal(applyGranularity(u, GRAN_VERBOSE).length, 3);
    assert.deepEqual(GRANULARITIES, ['summary', 'standard', 'verbose']);
  });
});

describe('51102 component-specific status', () => {
  it('answers focused component queries', () => {
    const r = componentStatus([{ name: 'crawler', status: 'crawling' }], 'crawl');
    assert.equal(r.found, true);
    assert.ok(r.answer.includes('crawler'));
  });
  it('handles misses', () => {
    assert.equal(componentStatus([], 'zzz').found, false);
  });
});

describe('51103 timeline scrubber', () => {
  it('reports state at a minute', () => {
    const r = scrubTimeline([{ minute: 2, phase: 'recon', action: 'enum' }], 5);
    assert.equal(r.found, true);
    assert.equal(r.phase, 'recon');
  });
  it('handles pre-start minutes', () => {
    assert.equal(scrubTimeline([], 0).found, false);
  });
});

describe('51104 status bookmarks', () => {
  it('adds and removes bookmarks without duplicates', () => {
    let b = addBookmark([], { atMs: 1000, text: 'x', phase: 'p' }, 'lbl');
    assert.equal(b.length, 1);
    b = addBookmark(b, { atMs: 1000, text: 'x', phase: 'p' }, 'lbl');
    assert.equal(b.length, 1);
    b = removeBookmark(b, b[0].id);
    assert.equal(b.length, 0);
  });
});

describe('51105 agent workload meter', () => {
  it('gauges load with labels', () => {
    assert.equal(workloadMeter(2, 8).label, 'light');
    assert.equal(workloadMeter(5, 8).label, 'busy');
    assert.equal(workloadMeter(8, 8).label, 'saturated');
  });
});

describe('51106 model-switch status', () => {
  it('notices brain swaps with reason', () => {
    const n = modelSwitchNotice('a', 'b', 'deeper reasoning', 1000);
    assert.ok(n.summary.includes('a'));
    assert.ok(n.summary.includes('b'));
  });
});

describe('51107 bilingual status view', () => {
  it('pairs two languages', () => {
    const b = bilingualStatus('Probing', 'जाँच', 'en', 'hi');
    assert.equal(b.primary.lang, 'en');
    assert.equal(b.secondary.lang, 'hi');
  });
});

describe('51108 payload-redacted status', () => {
  it('redacts secrets', () => {
    const r = redactPayload('POST /login password=hunter2');
    assert.equal(r.wasRedacted, true);
    assert.ok(r.redacted.includes('[redacted]'));
    assert.ok(!r.redacted.includes('hunter2'));
  });
  it('leaves clean lines alone', () => {
    assert.equal(redactPayload('GET /home').wasRedacted, false);
  });
});

describe('51109 finding-linked status', () => {
  it('attaches finding links', () => {
    const s = linkFindings({ text: 'done' }, [{ id: 'f1', title: 'XSS' }]);
    assert.equal(s.findingCount, 1);
    assert.equal(s.findingLinks[0].title, 'XSS');
  });
});

describe('51110 idle-nudge suggestions', () => {
  it('suggests next steps when idle', () => {
    const n = idleNudges(120000, { unreviewedFindings: 2, uncoveredAreas: 0 });
    assert.ok(n.length > 0);
    assert.ok(n[0].text.includes('2'));
  });
  it('stays quiet when active', () => {
    assert.deepEqual(idleNudges(10000, {}), []);
  });
});

describe('51111 activity heatmap', () => {
  it('buckets events by time', () => {
    const cells = activityHeatmap([{ minute: 1 }, { minute: 2 }, { minute: 7 }], 5);
    assert.equal(cells.length, 2);
    assert.equal(cells[0].count, 2);
  });
});

describe('51112 avatar status narration', () => {
  it('produces a speakable script', () => {
    const s = avatarNarration({ phase: 'probe', action: 'testing login', findingCount: 3 });
    assert.ok(s.includes('probe'));
    assert.ok(s.includes('3 findings'));
  });
});

describe('51113 manager-friendly status', () => {
  it('replaces jargon', () => {
    const s = managerStatus({ phase: 'fuzzing', action: 'sending payload' });
    assert.ok(!s.toLowerCase().includes('fuzzing'));
    assert.ok(s.includes('automated security testing'));
  });
});

describe('51114 since-last-visit diff', () => {
  it('summarizes new activity', () => {
    const d = lastVisitDiff(
      [
        { atMs: 2000, kind: 'finding', phase: 'probe' },
        { atMs: 500, kind: 'phase', phase: 'recon' },
      ],
      1000
    );
    assert.equal(d.eventCount, 1);
    assert.equal(d.newFindings, 1);
    assert.ok(d.summary.includes('1 update'));
  });
  it('reports nothing new', () => {
    assert.ok(lastVisitDiff([{ atMs: 500 }], 1000).summary.includes('Nothing new'));
  });
});

describe('51115 current-task ETA', () => {
  it('estimates remaining time', () => {
    const e = currentTaskEta(1000000, 300000, 1100000);
    assert.ok(e.label.includes('remaining') || e.label.includes('finishing'));
    assert.ok(e.remainingMs > 0);
  });
  it('handles unknown estimates', () => {
    assert.equal(currentTaskEta(0, 0, 0).label, 'ETA unknown');
  });
});

describe('51116 status confidence trend', () => {
  it('computes direction', () => {
    assert.equal(confidenceTrend([0.3, 0.8]).direction, 'up');
    assert.equal(confidenceTrend([0.8, 0.3]).direction, 'down');
    assert.equal(confidenceTrend([0.5, 0.52]).direction, 'flat');
  });
});

describe('51117 focus-this-URL command', () => {
  it('parses focus commands', () => {
    const r = parseFocusCommand('focus https://t/login');
    assert.equal(r.url, 'https://t/login');
  });
  it('rejects non-commands', () => {
    assert.equal(parseFocusCommand('hello'), null);
  });
});

describe('51118 skip-this-area command', () => {
  it('parses skip commands', () => {
    const r = parseSkipCommand('skip /static');
    assert.equal(r.area, '/static');
  });
  it('rejects non-commands', () => {
    assert.equal(parseSkipCommand('hello'), null);
  });
});

describe('51119 finding-type priority boost', () => {
  it('moves a class to the front', () => {
    assert.deepEqual(priorityBoost(['SQLi', 'XSS', 'IDOR'], 'xss'), ['XSS', 'SQLi', 'IDOR']);
  });
  it('leaves order when already first or missing', () => {
    assert.deepEqual(priorityBoost(['XSS'], 'XSS'), ['XSS']);
    assert.deepEqual(priorityBoost(['A'], 'B'), ['A']);
  });
});

describe('51120 noisy-check demotion', () => {
  it('pushes noisy checks to the back', () => {
    const out = demoteNoisy([{ id: 'a' }, { id: 'b' }, { id: 'c' }], ['a']);
    assert.deepEqual(
      out.map(x => x.id),
      ['b', 'c', 'a']
    );
  });
  it('keeps disabled checks in the list', () => {
    assert.equal(demoteNoisy([{ id: 'a' }], ['a']).length, 1);
  });
});

describe('wave 28 CSS audit', () => {
  it('has zero keyframes and a reduced-motion guard', () => {
    const css = readFileSync(join(__dirname, 'StatusRound2.css'), 'utf8');
    assert.ok(!/@keyframes/.test(css), 'no keyframes allowed per zero-animation order');
    assert.ok(css.includes('prefers-reduced-motion'), 'reduced-motion guard required');
    assert.ok(css.includes('.st28-card'), 'scoped card class required');
  });
  it('uses only scoped st28-* classes', () => {
    const css = readFileSync(join(__dirname, 'StatusRound2.css'), 'utf8');
    // Strip comments, then collect class selectors from selector lists (before '{')
    const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const selectors = [];
    for (const m of noComments.matchAll(/([^{}]+)\{/g)) {
      for (const sm of m[1].matchAll(/\.([A-Za-z0-9_-]+)/g)) selectors.push(sm[1]);
    }
    const unscoped = selectors.filter(s => !s.startsWith('st28-'));
    assert.deepEqual(unscoped, []);
  });
});

describe('wave 28 no-debris audit', () => {
  it('core has no TODO/FIXME/mock markers', () => {
    const src = readFileSync(join(__dirname, 'statusRound2Core.js'), 'utf8');
    assert.ok(!/TODO|FIXME|mock/i.test(src), 'no debris markers');
  });
});
