// Self (Hunter Self) — the Go.xlsx series as runnable checks.
//
// Sheet order comes from the backend's GET /api/v1/self/checklist (17
// categories, 202 distinct checks). This page renders exactly what the
// backend returns — no checklist data is hardcoded here and nothing is
// mocked: if the backend does not serve the checklist yet, the page says
// so honestly with a Retry button.
//
// Flow: paste a target URL, confirm you are authorised to test it, start
// a run — then run checks one by one, a whole category, or the whole
// series (Recon → A16). Predefined (rule-based) legs run first; when the
// run reaches its first AI leg it stops at `awaiting-ai-consent` and this
// page shows the consent card ("karun ki nahi karun?"). Yes resumes the
// AI legs, No skips them. The gate is enforced server-side; this page
// only surfaces it — it never auto-approves, never hides the card, and
// never defaults to yes. $0 Meta spend: nothing here calls any AI.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import SelfCheckCard from '../components/SelfCheckCard';
import {
  createSelfRun,
  getSelfChecklist,
  getSelfRun,
  normalizeChecklist,
  normalizeRun,
  runSelfAll,
  runSelfCategory,
  runSelfCheck,
  submitSelfAiConsent,
  checkVerdict,
} from '../lib/selfApi';
import { toast } from '../lib/toast';
import { openAuthModal } from '../lib/auth';

const ACTIVE_PHASES = new Set(['running', 'predefined', 'ai', 'awaiting-ai-consent', 'pending', 'in-progress']);

function isActiveRun(run) {
  if (!run) return false;
  const phase = String(run.phase || '').toLowerCase();
  if (ACTIVE_PHASES.has(phase)) return true;
  const status = String(run.status || '').toLowerCase();
  return status === 'running' || status === 'in-progress';
}

export default function SelfPage() {
  const [checklist, setChecklist] = useState(null);
  const [checklistLoading, setChecklistLoading] = useState(true);
  const [checklistError, setChecklistError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);

  const [target, setTarget] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [creating, setCreating] = useState(false);

  const [run, setRun] = useState(null);
  const [runError, setRunError] = useState('');
  const [busyChecks, setBusyChecks] = useState({});
  const [busyCategories, setBusyCategories] = useState({});
  const [runningAll, setRunningAll] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);

  const runIdRef = useRef(null);
  runIdRef.current = run ? run.id : null;

  const loadChecklist = useCallback(async () => {
    setChecklistLoading(true);
    setChecklistError('');
    const res = await getSelfChecklist();
    setChecklistLoading(false);
    if (!res.ok) {
      if (res.status === 401) setNeedsLogin(true);
      setChecklistError(res.error || 'Checklist load failed.');
      return;
    }
    setNeedsLogin(false);
    setChecklist(normalizeChecklist(res.data));
  }, []);

  useEffect(() => { loadChecklist(); }, [loadChecklist]);

  const refreshRun = useCallback(async () => {
    const runId = runIdRef.current;
    if (!runId) return;
    const res = await getSelfRun(runId);
    if (res.ok) {
      const next = normalizeRun(res.data);
      if (next) setRun(next);
    } else if (res.status === 401) {
      setNeedsLogin(true);
    }
  }, []);

  // Poll while the run is active — the backend is the source of truth for
  // per-check Yes/No + evidence. Stops once the run is done.
  useEffect(() => {
    if (!run || !isActiveRun(run)) return undefined;
    const timer = setInterval(refreshRun, 5000);
    return () => clearInterval(timer);
  }, [run, refreshRun]);

  async function ensureRunForUrl(url) {
    if (run && run.target === url) return run;
    if (!authorized) {
      toast('Confirm you are authorised to test this target first.', 'error');
      return null;
    }
    setCreating(true);
    const res = await createSelfRun(url);
    setCreating(false);
    if (!res.ok) {
      if (res.status === 401) setNeedsLogin(true);
      setRunError(res.error || 'Could not start a Self run.');
      toast(res.error || 'Could not start a Self run.', 'error');
      return null;
    }
    const next = normalizeRun(res.data);
    if (!next) {
      setRunError('Backend started a run but returned a state this page cannot read — refresh and retry.');
      return null;
    }
    setRun(next);
    setRunError('');
    return next;
  }

  async function handleStartRun() {
    const url = target.trim();
    if (!url) {
      toast('Paste a target URL first.', 'error');
      return;
    }
    await ensureRunForUrl(url);
  }

  async function handleRunCheck(check, url) {
    if (!url) {
      toast('Paste a target URL for this check first.', 'error');
      return;
    }
    const active = await ensureRunForUrl(url);
    if (!active) return;
    setBusyChecks((prev) => ({ ...prev, [check.id]: true }));
    const res = await runSelfCheck(active.id, check.id);
    setBusyChecks((prev) => ({ ...prev, [check.id]: false }));
    if (!res.ok) {
      toast(res.error || `Check ${check.id} failed to start.`, 'error');
      return;
    }
    await refreshRun();
  }

  async function handleRunCategory(category) {
    if (!run) {
      toast('Start a run first — paste a target URL above.', 'error');
      return;
    }
    setBusyCategories((prev) => ({ ...prev, [category.id]: true }));
    const res = await runSelfCategory(run.id, category.id);
    setBusyCategories((prev) => ({ ...prev, [category.id]: false }));
    if (!res.ok) {
      toast(res.error || `Category ${category.name} failed to start.`, 'error');
      return;
    }
    await refreshRun();
  }

  async function handleRunAll() {
    if (!run) {
      toast('Start a run first — paste a target URL above.', 'error');
      return;
    }
    setRunningAll(true);
    const res = await runSelfAll(run.id);
    setRunningAll(false);
    if (!res.ok) {
      toast(res.error || 'Whole-series run failed to start.', 'error');
      return;
    }
    await refreshRun();
  }

  // AI consent — user-pressed only. Yes resumes the AI legs, No marks
  // them skipped. No default, no auto-approve, no hidden path.
  async function handleAiConsent(consent) {
    if (!run) return;
    setConsentBusy(true);
    const res = await submitSelfAiConsent(run.id, consent);
    setConsentBusy(false);
    if (!res.ok) {
      toast(res.error || 'Could not record your choice.', 'error');
      return;
    }
    toast(consent ? 'AI step approved — AI legs will run last.' : 'AI step declined — AI legs will be skipped.', 'info');
    await refreshRun();
  }

  const categories = checklist ? checklist.categories : [];
  const awaitingConsent = !!run && String(run.phase || '').toLowerCase() === 'awaiting-ai-consent';

  return (
    <div className="page">
      <div className="page-inner self-page">
        <div className="page-header">
          <h1>Self — Hunter Self</h1>
          <p className="page-sub">
            The Go.xlsx bug-bounty series, check by check: Reconnaissance → A16.
            Paste a URL, run the predefined tools for a check, and the checklist
            marks Yes/No with evidence. The AI part runs last — and only if you
            approve it when asked.
          </p>
        </div>

        {needsLogin && (
          <div className="alert alert-error">
            Log in to run Self checks.
            <div style={{ marginTop: 8 }}>
              <button className="btn btn-sm" onClick={() => openAuthModal('login')}>Log in</button>
            </div>
          </div>
        )}

        {checklistLoading && <div className="empty-hint">Loading the checklist…</div>}

        {!checklistLoading && checklistError && (
          <div className="alert alert-error">
            {checklistError} The Self checklist is served by the backend — it is not available yet.
            <div style={{ marginTop: 8 }}>
              <button className="btn btn-sm" onClick={loadChecklist}>Retry</button>
            </div>
          </div>
        )}

        {!checklistLoading && !checklistError && checklist && (
          <>
            <div className="self-run-bar">
              <div className="field-label">
                Target URL
                <input
                  className="text-input"
                  type="url"
                  placeholder="https://target.example.com"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  disabled={creating}
                />
              </div>
              <label className="self-auth-check">
                <input
                  type="checkbox"
                  checked={authorized}
                  onChange={(e) => setAuthorized(e.target.checked)}
                />
                <span>I am authorised to test this target.</span>
              </label>
              <div className="inline-row self-run-actions">
                <button className="btn btn-primary" onClick={handleStartRun} disabled={creating || !target.trim() || !authorized}>
                  {creating ? 'Starting…' : run ? 'Start a new run' : 'Start series run'}
                </button>
                {run && (
                  <button className="btn" onClick={handleRunAll} disabled={runningAll}>
                    {runningAll ? 'Running whole series…' : 'Run whole series'}
                  </button>
                )}
              </div>
              {run && (
                <div className="self-run-status">
                  Run <span className="self-run-id">{run.id}</span> · target {run.target} · phase {run.phase || run.status || '—'}
                </div>
              )}
              {runError && <div className="alert alert-error">{runError}</div>}
            </div>

            {/* AI gate — shown ONLY while the run waits for the user's call. */}
            {awaitingConsent && (
              <div className="self-consent-card" role="alert">
                <div className="self-consent-title">AI step — karun ki nahi karun?</div>
                <p className="page-sub">
                  The predefined (rule-based) checks are done. The remaining
                  checks need the AI — that costs money and runs last, only
                  with your explicit approval. Nothing AI runs until you choose.
                </p>
                <div className="inline-row">
                  <button className="btn btn-primary" onClick={() => handleAiConsent(true)} disabled={consentBusy}>
                    Yes — run the AI part
                  </button>
                  <button className="btn" onClick={() => handleAiConsent(false)} disabled={consentBusy}>
                    No — skip the AI part
                  </button>
                </div>
              </div>
            )}

            <div className="self-series-summary">
              {checklist.totalChecks} checks · {categories.length} categories
              {run && ` · run ${run.id}`}
            </div>

            {categories.map((category) => {
              const counts = { yes: 0, no: 0, running: 0, done: 0 };
              for (const check of category.checks) {
                const v = checkVerdict(run ? run.checks[check.id] : null);
                if (v === 'yes') counts.yes += 1;
                else if (v === 'no') counts.no += 1;
                else if (v === 'running') counts.running += 1;
              }
              const done = counts.yes + counts.no;
              return (
                <section key={category.id} className="self-category" data-category-id={category.id}>
                  <div className="self-category-head">
                    <div>
                      <h2 className="self-category-name">{category.name}</h2>
                      <div className="self-category-counts">
                        {category.checks.length} checks · {done} done ({counts.yes} Yes · {counts.no} No)
                        {counts.running > 0 && ` · ${counts.running} running`}
                      </div>
                    </div>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleRunCategory(category)}
                      disabled={!run || !!busyCategories[category.id]}
                    >
                      {busyCategories[category.id] ? 'Running…' : 'Run all'}
                    </button>
                  </div>
                  <div className="self-check-list">
                    {category.checks.map((check) => (
                      <SelfCheckCard
                        key={check.id}
                        check={check}
                        result={run ? run.checks[check.id] : null}
                        target={run ? run.target : target}
                        busy={!!busyChecks[check.id]}
                        disabled={!target.trim() && !run}
                        onRun={handleRunCheck}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
