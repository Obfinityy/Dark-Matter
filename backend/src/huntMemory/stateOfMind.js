// State-of-mind section builders, split out of huntMemory.js by the P3
// professionalization lane (split-only, no behaviour change).
//
// Each builder renders one section of the block buildStateOfMind used to
// build inline ((a) left-off through (f) inheritance, plus the budget
// trim). Moved verbatim; only the helper references changed — the small
// helpers the sections need (clip, classLabelFor, buildActionIndex,
// indexLines, deadEndLines, dedupeFindings, isErrorPageFinding,
// rowOutcome) arrive as the `u` argument, so this module never imports
// huntMemory.js (no import cycle) and buildStateOfMind keeps owning the
// snapshot shape and the completeness contract.
//
// Completeness contract (unchanged): the WHAT I HAVE NOT DONE table
// renders IN FULL and the left-off / done sections are never trimmed.
// The block as a whole is bounded by the budget passed to
// trimSectionsToBudget: past it, the lowest-priority tails (ruled-out
// lines, then finding lines) are dropped and replaced with ONE note per
// section stating how many more are on record.

export function leftOffSections(memory, u) {
  const sections = [];
  const lo = memory.leftOff;
  if (lo) {
    const tail = lo.lastThinking || lo.lastNote || '';
    if (tail) {
      sections.push({ kind: 'leftoff', lines: [`WHERE I LEFT OFF: ${u.clip(tail, 220)}${memory.leftOffDerived ? ' (hand-off rebuilt from your record — the last session ended before writing one)' : ''}`] });
    }
    if (Array.isArray(lo.openThreads) && lo.openThreads.length) {
      sections.push({ kind: 'threads', lines: [`Open threads you left (${lo.openThreads.length}): ${lo.openThreads.slice(0, 3).map((t) => u.clip(String(t).replace(/^-\s*/, ''), 130)).join(' · ')}`] });
    }
  }
  return sections;
}

export function currentTaskSections(memory, events, rows, u) {
  const sections = [];
  // KEYWORD-INDEX (27 Oct 2026): the current task + the Action
  // Index. The current task is the hunt's live state — what is
  // running RIGHT NOW — from meta.humanLoop (written by the loop's
  // checkpoint from the brain's task block). The index is the
  // complete map of what is done: one line per action, numbered,
  // capped at 2,000 chars, never trimmed by the section trimmers
  // (the hard total-budget clip still guards the sum).
  const hl = (memory.meta && memory.meta.humanLoop) || {};
  if (hl.currentTask && (hl.currentTask.task || hl.currentTask.goal)) {
    const ct = hl.currentTask;
    sections.push({ kind: 'currenttask', lines: [`ABHI YE CHAL RAHA HAI: ${u.clip(ct.task || ct.goal, 200)}${ct.goal && ct.task ? ` — goal: ${u.clip(ct.goal, 160)}` : ''}${ct.progress ? ` — progress: ${u.clip(ct.progress, 160)}` : ''}`] });
  }
  if (hl.lastCompletedTask && (hl.lastCompletedTask.task || hl.lastCompletedTask.summary)) {
    const lt = hl.lastCompletedTask;
    sections.push({ kind: 'currenttask', lines: [`LAST COMPLETED TASK: ${u.clip(lt.task || lt.summary, 200)}${lt.summary && lt.task ? ` — ${u.clip(lt.summary, 160)}` : ''}`] });
  }
  const indexEntries = u.buildActionIndex(events, rows);
  if (indexEntries.length) {
    sections.push({ kind: 'index', lines: u.indexLines(indexEntries) });
  }
  return sections;
}

export function doneSection(memory, events, rows, covRows, topicStats, endpoints, u) {
  const done = [];
  const toolCalls = events.filter((e) => e && e.type === 'tool_call');
  if (toolCalls.length || rows.length) {
    const byTool = new Map();
    for (const e of toolCalls) byTool.set(e.tool || '?', (byTool.get(e.tool || '?') || 0) + 1);
    const breakdown = [...byTool.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([t, n]) => `${t} ×${n}`).join(', ');
    done.push(`Actions on record: ${toolCalls.length}${breakdown ? ` (${breakdown})` : ''} · reasoning entries: ${rows.length}${memory.meta && memory.meta.iteration != null ? ` · hunt iteration: ${memory.meta.iteration}` : ''}`);
  }
  const testedRows = covRows.filter((r) => r.outcome === 'probed_clean' || r.outcome === 'confirmed');
  for (const r of testedRows) {
    done.push(`- Tested: ${r.surface} × ${u.classLabelFor(r.class)} → ${r.outcome}`);
  }
  const testedClasses = new Set(testedRows.map((r) => r.class));
  for (const s of topicStats || []) {
    if (s && s.probed && !testedClasses.has(s.topic.id)) {
      done.push(`- ${s.topic.label}: probed (payload actions in your record, researched ×${s.n})`);
    }
  }
  const epList = endpoints || [];
  for (const ep of epList.slice(0, 8)) {
    const probedFor = (ep.probedClasses || []).map((c) => u.classLabelFor(c)).join(', ');
    done.push(`- ${ep.url} — visited ×${ep.visits}${ep.params && ep.params.length ? `, inputs seen: ${ep.params.join(', ')}` : ''}${probedFor ? `, probed for: ${probedFor}` : ', no probe has reached it'}`);
  }
  if (epList.length > 8) done.push(`- …and ${epList.length - 8} more endpoint(s) you have touched (RECALL for the full list)`);
  const recent = rows.slice(-5);
  if (recent.length) {
    done.push('Most recent actions:');
    for (const r of recent) {
      done.push(`- [${u.rowOutcome(r)}] ${u.clip(r.action, 90)}${r.result ? ` — ${u.clip(r.result, 90)}` : ''}`);
    }
  }
  if (!done.length) return null;
  return { kind: 'done', lines: ['WHAT I HAVE DONE SO FAR:', ...done] };
}

export function knowSection(memory, findings, u) {
  const know = [];
  const verified = u.dedupeFindings(findings.filter((f) => f.verified && !u.isErrorPageFinding(f)));
  const unverified = u.dedupeFindings(findings.filter((f) => !f.verified));
  for (const d of verified) know.push(`- [VERIFIED] ${d.title} (${d.sev})${d.n > 1 ? ` ×${d.n}` : ''}`);
  for (const d of unverified) know.push(`- [claimed, NOT verified] ${d.title} (${d.sev})${d.n > 1 ? ` ×${d.n}` : ''}`);
  if (!verified.length && !unverified.length) know.push('- No findings recorded yet.');
  if (memory.retractedCount > 0) {
    know.push(`- (${memory.retractedCount} earlier claim(s) were retracted as false positives — they are not findings; the paths sit under ruled-out below.)`);
  }
  const meta = memory.meta || {};
  const chain = meta.chainContext && typeof meta.chainContext === 'object' ? meta.chainContext : null;
  if (chain && Object.keys(chain).length) {
    know.push(`- Captured artefacts on hand: ${Object.keys(chain).join(', ')} (values live in your workspace — read the artefact when you need one)`);
  }
  const fp = meta.appFingerprint;
  if (fp && (fp.appType || (Array.isArray(fp.techStack) && fp.techStack.length))) {
    know.push(`- Target fingerprint: ${fp.appType || 'unknown'}${Array.isArray(fp.techStack) && fp.techStack.length ? ` · ${fp.techStack.join(', ')}` : ''}`);
  }
  return { kind: 'know', lines: ['WHAT I KNOW:', ...know] };
}

export function notDoneSection(memory, covRows, debt, topicStats, endpoints, u) {
  const notDone = [];
  const gapClasses = new Set();
  for (const r of covRows) {
    if (r.outcome !== 'open_gap') continue;
    gapClasses.add(r.class);
    notDone.push(`- OPEN GAP: ${r.surface} × ${u.classLabelFor(r.class)}${r.evidence ? ` — ${u.clip(r.evidence, 110)}` : ''}`);
  }
  const debtListed = new Set();
  for (const [cls, d] of Object.entries(debt)) {
    if (!d || !(Number(d.researched) > 0) || d.probed) continue;
    if (gapClasses.has(cls)) continue;
    if (covRows.some((r) => r.class === cls)) continue;
    debtListed.add(cls);
    notDone.push(`- RESEARCHED, NEVER PROBED: ${u.classLabelFor(cls)} — researched ×${d.researched} across ${d.sessionsResearched || 1} session(s), no probe yet and no coverage row accounts for it`);
  }
  for (const s of topicStats || []) {
    if (!s || s.probed) continue;
    if (gapClasses.has(s.topic.id) || debtListed.has(s.topic.id)) continue;
    if (covRows.some((r) => r.class === s.topic.id)) continue;
    notDone.push(`- ${s.topic.label}: researched ×${s.n}, never probed`);
  }
  const epList = endpoints || [];
  for (const ep of epList) {
    if (ep.probeActions > 0) continue;
    if (ep.path === '/' && !(ep.params && ep.params.length)) continue; // the lobby is not an obligation
    notDone.push(`- ${ep.url} — discovered (visited ×${ep.visits}) but never probed${ep.params && ep.params.length ? `; it takes inputs: ${ep.params.join(', ')}` : ''}`);
  }
  const rows = memory.reasoningRows || [];
  const events = memory.events || [];
  if (notDone.length) {
    return { kind: 'notdone', lines: ['WHAT I HAVE NOT DONE YET (complete — if it is not listed here, your record does not show it as outstanding):', ...notDone] };
  }
  if (rows.length || events.length) {
    return { kind: 'notdone', lines: ['WHAT I HAVE NOT DONE YET: nothing outstanding in your record — every researched class has been probed or accounted for in your coverage ledger.'] };
  }
  return null;
}

export function ruledOutSection(memory, events, u) {
  const dead = u.deadEndLines({ ruledOut: memory.ruledOut || [], events }, { limit: 500 });
  const deadHyps = ((memory.hypothesisLedger || {}).dead || [])
    .map((d) => `- Dead premise (failed ×${d.failed}): "${u.clip(d.text, 140)}"`);
  if (dead.length || deadHyps.length) {
    return { kind: 'ruledout', lines: ['PATHS ALREADY RULED OUT (do not repeat these):', ...dead, ...deadHyps] };
  }
  return null;
}

export function inheritSection(memory, u) {
  const priors = memory.priorHunts || [];
  if (!priors.length) return null;
  const inh = [];
  for (const p of priors) {
    inh.push(`- Earlier hunt ${p.huntId} (${p.state}${p.iteration != null ? `, iteration ${p.iteration}` : ''}) on this target:`);
    for (const t of p.confirmedFacts.slice(0, 6)) inh.push(`  - Already proven on this target: ${u.clip(t, 150)}`);
    for (const t of p.ruledOut.slice(0, 6)) inh.push(`  - Ruled out there: ${u.clip(t, 150)}`);
    for (const r of p.openGaps.slice(0, 6)) inh.push(`  - Left open there: ${r.surface} × ${u.classLabelFor(r.class)} (open gap)`);
    if (p.dossierBriefing) {
      for (const line of p.dossierBriefing.split('\n')) {
        const t = line.trim();
        if (t && t !== 'Open threads:' && t !== 'Next step:') inh.push(`  - ${u.clip(t.replace(/^-\s*/, ''), 150)}`);
      }
    }
  }
  if (!inh.length) return null;
  return { kind: 'inherit', lines: ['FROM YOUR EARLIER HUNTS ON THIS TARGET:', ...inh] };
}

// Lane Q: hard TOTAL budget. The sections above carry generous
// per-section caps, but nothing bounded their sum — on the biggest
// records the block reached ~27k chars and ate the model's context
// window (and prefill time) every single turn. Trim from the
// lowest-priority tail only: ruled-out lines first (already sorted
// most-frequent first, so the tail is the least-hit paths), then
// finding lines (claimed drop before verified — verified render
// first). Every trimmed section gains ONE explicit note carrying
// the dropped count, so the agent still KNOWS how much more is on
// record (knowledge, not silence). Left-off, done and not-done are
// never trimmed here; if they alone exceed the budget, the whole
// block is hard-clipped at the budget with a visible marker.
export function trimSectionsToBudget(sections, budget) {
  const header = '=== STATE OF MIND — YOUR COMPLETE MEMORY (rebuilt from your permanent record every turn; the essentials are never cut short) ===';
  const assemble = () => [
    header,
    ...sections.flatMap((s, i) => (i === 0 ? s.lines : ['', ...s.lines])),
  ];
  let out = assemble();
  const totalLen = () => out.join('\n').length;

  if (totalLen() > budget) {
    const trimTail = (section, isDroppable, noteText) => {
      let dropped = 0;
      let noteAt = -1;
      while (totalLen() > budget) {
        let idx = -1;
        for (let i = section.lines.length - 1; i >= 1; i--) {
          if (i === noteAt) continue;
          if (isDroppable(section.lines[i])) { idx = i; break; }
        }
        if (idx < 0) break;
        section.lines.splice(idx, 1);
        if (noteAt > idx) noteAt--;
        dropped++;
        if (noteAt < 0) {
          let ins = 0;
          for (let i = section.lines.length - 1; i >= 1; i--) {
            if (isDroppable(section.lines[i])) { ins = i; break; }
          }
          section.lines.splice(ins + 1, 0, noteText(dropped));
          noteAt = ins + 1;
        } else {
          section.lines[noteAt] = noteText(dropped);
        }
        out = assemble();
      }
      return dropped;
    };

    const ruled = sections.find((s) => s.kind === 'ruledout');
    if (ruled) {
      trimTail(ruled, () => true,
        (n) => `- …and ${n} more ruled-out paths on record (ask via recall if needed)`);
    }
    if (totalLen() > budget) {
      const know = sections.find((s) => s.kind === 'know');
      if (know) {
        trimTail(know,
          (l) => l.startsWith('- [VERIFIED] ') || l.startsWith('- [claimed, NOT verified] '),
          (n) => `- …and ${n} more findings on record`);
      }
    }
    if (totalLen() > budget) {
      const marker = '… (state of mind trimmed to budget)';
      const text = out.join('\n');
      return (text.slice(0, budget - marker.length - 1) + '\n' + marker).split('\n');
    }
  }
  return out;
}
