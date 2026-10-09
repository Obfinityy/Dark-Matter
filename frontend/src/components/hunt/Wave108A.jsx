import React, { useMemo, useState } from 'react';
import {
  WAVE108_A_IDEAS,
  SCORE_BANDS,
  SCORE_FACTORS,
  DEFAULT_FACTOR_WEIGHTS,
  WHAT_IF_PRESETS,
  scoreBand,
  scoreBandLabel,
  badgeClass,
  sortTargetsByScore,
  detectScoreJump,
  appendScoreHistory,
  simulateWhatIf,
  registerModelVersion,
  getModelVersion,
  listModelVersions,
  listModelChangelog,
  applyWeights,
  createClientProfile,
  getClientProfile,
  listClientProfiles,
  scoreWithProfile,
  predictBountyLikelihood,
} from './wave108ACore.js';
import './Wave108A.css';

/**
 * Wave 108A — Risk-score presentation, tuning and prediction demo panel.
 * Infinity AI branding only. Demonstrates ideas 54281-54290.
 */

const SAMPLE_TARGETS = [
  { id: 't1', name: 'Acme Web', program: 'Acme BBP', score: 92, findings: 14 },
  { id: 't2', name: 'Acme API', program: 'Acme BBP', score: 74, findings: 9 },
  { id: 't3', name: 'Shopfront', program: 'Retail Program', score: 58, findings: 5 },
  { id: 't4', name: 'Docs Portal', program: 'Retail Program', score: 31, findings: 1 },
  { id: 't5', name: 'Staging', program: 'Acme BBP', score: 83, findings: 11 },
];

const SAMPLE_FACTORS = { exposure: 82, vulnerability: 64, hygiene: 45, businessLogic: 58, reachability: 70 };

export default function Wave108A() {
  // 54282 sortable columns
  const [sortKey, setSortKey] = useState('score');
  const [sortDir, setSortDir] = useState('desc');
  const sortedTargets = useMemo(() => sortTargetsByScore(SAMPLE_TARGETS, sortKey, sortDir), [sortKey, sortDir]);
  const toggleSort = (key) => {
    if (key === sortKey) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  // 54281 jump alerts
  const [prevScore, setPrevScore] = useState(74);
  const [nextScore, setNextScore] = useState(88);
  const [jumpThreshold, setJumpThreshold] = useState(10);
  const [jump, setJump] = useState(null);

  // 54284 history log
  const [history, setHistory] = useState([]);
  const [histScore, setHistScore] = useState(74);
  const [histVersion, setHistVersion] = useState('2.0.0');
  const [histReason, setHistReason] = useState('nightly recompute');

  // 54285 what-if simulator
  const [baseScore, setBaseScore] = useState(74);
  const [picked, setPicked] = useState(new Set(['fix-headers', 'archive-subdomains']));
  const whatIf = useMemo(() => simulateWhatIf(baseScore, [...picked]), [baseScore, picked]);

  // 54286/54287 model versions + changelog
  const [versions, setVersions] = useState(() => listModelVersions());
  const [activeVersion, setActiveVersion] = useState('2.0.0');
  const [newVersion, setNewVersion] = useState('2.1.0');
  const [newChangelog, setNewChangelog] = useState('Reweighted hygiene after the Q3 portfolio review.');
  const activeRecord = getModelVersion(activeVersion);

  // 54288 custom weights
  const [weights, setWeights] = useState({ ...DEFAULT_FACTOR_WEIGHTS });
  const weighted = useMemo(() => applyWeights(SAMPLE_FACTORS, weights), [weights]);

  // 54289 client profiles
  const [profileName, setProfileName] = useState('Acme Corp');
  const [profiles, setProfiles] = useState(() => listClientProfiles());
  const [profileMsg, setProfileMsg] = useState('');

  // 54290 bounty predictor
  const [signals, setSignals] = useState({
    vulnCount: 9, criticalCount: 2, exposureScore: 78, hygieneScore: 44, pastValidFindings: 3, daysSinceLastHunt: 120,
  });
  const [portfolio, setPortfolio] = useState({ totalTargets: 24, totalValidFindings: 61 });
  const [prediction, setPrediction] = useState(null);

  return (
    <div className="wave108 wave108-a">
      <header className="wave108-head">
        <h2 className="wave108-title">Risk Scoring — Infinity AI</h2>
        <p className="wave108-sub">Wave 108A · ideas 54281–54290 · score presentation, tuning and prediction</p>
      </header>

      {/* 54283 Score badges */}
      <section className="wave108-card">
        <h3>{WAVE108_A_IDEAS[2].title}</h3>
        <div className="wave108-badges">
          {SAMPLE_TARGETS.map((t) => {
            const band = scoreBand(t.score);
            return (
              <span key={t.id} className="wave108-badge-row">
                <span className="wave108-muted">{t.name} · {t.score}</span>
                <span className={badgeClass(band)}>{scoreBandLabel(band)}</span>
              </span>
            );
          })}
        </div>
        <p className="wave108-muted">
          Bands: {SCORE_BANDS.map((b) => `${b.label} ${b.min}–${b.max}`).join(' · ')}
        </p>
      </section>

      {/* 54282 Sortable score columns */}
      <section className="wave108-card">
        <h3>{WAVE108_A_IDEAS[1].title}</h3>
        <table className="wave108-table">
          <thead>
            <tr>
              <th>Target</th>
              <th>Program</th>
              <th>
                <button className="wave108-th-btn" onClick={() => toggleSort('score')}>
                  Score {sortKey === 'score' ? (sortDir === 'desc' ? '▼' : '▲') : ''}
                </button>
              </th>
              <th>
                <button className="wave108-th-btn" onClick={() => toggleSort('findings')}>
                  Findings {sortKey === 'findings' ? (sortDir === 'desc' ? '▼' : '▲') : ''}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedTargets.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td className="wave108-muted">{t.program}</td>
                <td><span className={badgeClass(scoreBand(t.score))}>{t.score}</span></td>
                <td>{t.findings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 54281 Score jump alerts */}
      <section className="wave108-card">
        <h3>{WAVE108_A_IDEAS[0].title}</h3>
        <div className="wave108-actions">
          <label className="wave108-muted">Prev <input className="wave108-input wave108-input-narrow" type="number" value={prevScore} onChange={(e) => setPrevScore(Number(e.target.value))} /></label>
          <label className="wave108-muted">Next <input className="wave108-input wave108-input-narrow" type="number" value={nextScore} onChange={(e) => setNextScore(Number(e.target.value))} /></label>
          <label className="wave108-muted">Delta <input className="wave108-input wave108-input-narrow" type="number" value={jumpThreshold} onChange={(e) => setJumpThreshold(Number(e.target.value))} /></label>
          <button className="wave108-btn" onClick={() => setJump(detectScoreJump(prevScore, nextScore, jumpThreshold))}>
            Evaluate jump
          </button>
        </div>
        {jump && (
          <div className={`wave108-alert ${jump.direction === 'up' ? 'wave108-alert-up' : 'wave108-alert-down'}`}>
            <b>Score {jump.direction === 'up' ? 'jumped up' : 'dropped'} by {jump.magnitude} points</b>{' '}
            ({jump.previous} → {jump.current}, threshold {jump.threshold})
            {jump.bandShift && <span> · band shift: {scoreBandLabel(jump.previousBand)} → {scoreBandLabel(jump.currentBand)}</span>}
          </div>
        )}
        {jump === null && <p className="wave108-muted">No jump detected for these readings.</p>}
      </section>

      {/* 54284 Score history log */}
      <section className="wave108-card">
        <h3>{WAVE108_A_IDEAS[3].title}</h3>
        <div className="wave108-actions">
          <label className="wave108-muted">Score <input className="wave108-input wave108-input-narrow" type="number" value={histScore} onChange={(e) => setHistScore(Number(e.target.value))} /></label>
          <label className="wave108-muted">Model <input className="wave108-input wave108-input-narrow" value={histVersion} onChange={(e) => setHistVersion(e.target.value)} /></label>
          <input className="wave108-input" value={histReason} onChange={(e) => setHistReason(e.target.value)} placeholder="reason" />
          <button
            className="wave108-btn"
            onClick={() => {
              const next = [...history];
              const entry = appendScoreHistory(next, {
                targetId: 'acme-api',
                score: histScore,
                version: histVersion,
                inputs: { factors: SAMPLE_FACTORS, weights },
                reason: histReason,
              });
              setHistory(next);
              void entry;
            }}
          >
            Record recomputation
          </button>
        </div>
        <ul className="wave108-list">
          {history.map((h) => (
            <li key={h.id}>
              <span className={badgeClass(h.band)}>{h.score}</span>{' '}
              <code>{h.id}</code> · model {h.version || '—'} · {h.reason} · <span className="wave108-muted">{h.recordedAt}</span>
              <pre className="wave108-pre">{JSON.stringify(h.inputsSnapshot, null, 2)}</pre>
            </li>
          ))}
          {history.length === 0 && <li className="wave108-muted">No recomputations recorded yet.</li>}
        </ul>
      </section>

      {/* 54285 What-if score simulator */}
      <section className="wave108-card">
        <h3>{WAVE108_A_IDEAS[4].title}</h3>
        <label className="wave108-muted">Base score <input className="wave108-input wave108-input-narrow" type="number" value={baseScore} onChange={(e) => setBaseScore(Number(e.target.value))} /></label>
        <div className="wave108-checks">
          {Object.entries(WHAT_IF_PRESETS).map(([id, preset]) => (
            <label key={id} className="wave108-muted">
              <input
                type="checkbox"
                checked={picked.has(id)}
                onChange={() => {
                  const next = new Set(picked);
                  if (next.has(id)) next.delete(id); else next.add(id);
                  setPicked(next);
                }}
              />{' '}
              {preset.label} <code>{preset.delta > 0 ? '+' : ''}{preset.delta}</code>
            </label>
          ))}
        </div>
        <p className="wave108-muted">
          Projected score: <b>{whatIf.projected}</b> (base {whatIf.base} {whatIf.totalDelta >= 0 ? '+' : ''}{whatIf.totalDelta})
          {whatIf.clamped && ' — clamped to the 0–100 range'}
        </p>
        <ul className="wave108-list">
          {whatIf.applied.map((c) => (
            <li key={c.id}>{c.label}: <code>{c.delta > 0 ? '+' : ''}{c.delta}</code></li>
          ))}
        </ul>
      </section>

      {/* 54286 Scoring model versioning */}
      <section className="wave108-card">
        <h3>{WAVE108_A_IDEAS[5].title}</h3>
        <div className="wave108-actions">
          <select className="wave108-select" value={activeVersion} onChange={(e) => setActiveVersion(e.target.value)}>
            {versions.map((v) => <option key={v.version} value={v.version}>v{v.version}</option>)}
          </select>
          <input className="wave108-input wave108-input-narrow" value={newVersion} onChange={(e) => setNewVersion(e.target.value)} placeholder="version" />
          <input className="wave108-input" value={newChangelog} onChange={(e) => setNewChangelog(e.target.value)} placeholder="plain-language change note" />
          <button
            className="wave108-btn"
            onClick={() => {
              const record = registerModelVersion(newVersion, { description: newChangelog, details: {} }, [newChangelog]);
              setVersions(listModelVersions());
              setActiveVersion(record.version);
            }}
          >
            Register version
          </button>
        </div>
        {activeRecord && (
          <div className="wave108-version">
            <p><b>Model v{activeRecord.version}</b> · registered {activeRecord.recordedAt || activeRecord.registeredAt}</p>
            <p className="wave108-muted">{activeRecord.formula.description}</p>
          </div>
        )}
      </section>

      {/* 54287 Scoring changelog */}
      <section className="wave108-card">
        <h3>{WAVE108_A_IDEAS[6].title}</h3>
        <ul className="wave108-list">
          {listModelChangelog().map((entry) => (
            <li key={entry.version}>
              <b>v{entry.version}</b>
              <ul className="wave108-list">
                {entry.changes.map((line, i) => <li key={i} className="wave108-muted">— {line}</li>)}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      {/* 54288 Custom scoring weights */}
      <section className="wave108-card">
        <h3>{WAVE108_A_IDEAS[7].title}</h3>
        {SCORE_FACTORS.map((factor) => (
          <div key={factor} className="wave108-weight-row">
            <label className="wave108-muted wave108-weight-label">{factor}</label>
            <input
              type="range" min="0" max="60" value={weights[factor] ?? 0}
              onChange={(e) => setWeights((w) => ({ ...w, [factor]: Number(e.target.value) }))}
            />
            <code>{weights[factor]}</code>
          </div>
        ))}
        <p className="wave108-muted">
          Weighted score: <b>{weighted.score}</b> <span className={badgeClass(scoreBand(weighted.score))}>{scoreBandLabel(scoreBand(weighted.score))}</span>
        </p>
        <ul className="wave108-list">
          {weighted.contributions.map((c) => (
            <li key={c.factor} className="wave108-muted">
              {c.factor}: factor {c.factorScore} × weight {c.weight} → <code>{c.weightedPoints}</code>
            </li>
          ))}
        </ul>
      </section>

      {/* 54289 Per-client scoring profiles */}
      <section className="wave108-card">
        <h3>{WAVE108_A_IDEAS[8].title}</h3>
        <div className="wave108-actions">
          <input className="wave108-input" value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="profile name" />
          <button
            className="wave108-btn"
            onClick={() => {
              try {
                createClientProfile(profileName, weights);
                setProfiles(listClientProfiles());
                setProfileMsg(`Saved "${profileName}".`);
              } catch (err) {
                setProfileMsg(String(err.message));
              }
            }}
          >
            Save current weights as profile
          </button>
          <button className="wave108-btn wave108-btn-ghost" onClick={() => setProfiles(listClientProfiles())}>
            Refresh
          </button>
        </div>
        {profileMsg && <p className="wave108-muted">{profileMsg}</p>}
        <ul className="wave108-list">
          {profiles.map((p) => (
            <li key={p.name}>
              <b>{p.name}</b>{' '}
              <button
                className="wave108-btn wave108-btn-ghost"
                onClick={() => {
                  const loaded = getClientProfile(p.name);
                  if (loaded) setWeights({ ...loaded.weights });
                }}
              >
                Load
              </button>{' '}
              <span className="wave108-muted">score with this profile: {scoreWithProfile(SAMPLE_FACTORS, p.name).score}</span>
            </li>
          ))}
          {profiles.length === 0 && <li className="wave108-muted">No profiles saved yet.</li>}
        </ul>
      </section>

      {/* 54290 Bounty likelihood predictor */}
      <section className="wave108-card">
        <h3>{WAVE108_A_IDEAS[9].title}</h3>
        <div className="wave108-actions">
          {Object.keys(signals).map((key) => (
            <label key={key} className="wave108-muted">
              {key}{' '}
              <input
                className="wave108-input wave108-input-narrow" type="number"
                value={signals[key]} onChange={(e) => setSignals((s) => ({ ...s, [key]: Number(e.target.value) }))}
              />
            </label>
          ))}
        </div>
        <div className="wave108-actions">
          <label className="wave108-muted">Portfolio targets <input className="wave108-input wave108-input-narrow" type="number" value={portfolio.totalTargets} onChange={(e) => setPortfolio((p) => ({ ...p, totalTargets: Number(e.target.value) }))} /></label>
          <label className="wave108-muted">Valid findings <input className="wave108-input wave108-input-narrow" type="number" value={portfolio.totalValidFindings} onChange={(e) => setPortfolio((p) => ({ ...p, totalValidFindings: Number(e.target.value) }))} /></label>
          <button className="wave108-btn" onClick={() => setPrediction(predictBountyLikelihood(signals, portfolio))}>
            Predict likelihood
          </button>
        </div>
        {prediction && (
          <div className="wave108-prediction">
            <div className="wave108-bar">
              <div className="wave108-bar-fill" style={{ width: `${Math.round(prediction.probability * 100)}%` }} />
            </div>
            <p>
              <b>{Math.round(prediction.probability * 100)}%</b> probability · confidence <b>{prediction.confidence}</b>
            </p>
            <ul className="wave108-list">
              {prediction.reasons.map((r, i) => <li key={i} className="wave108-muted">— {r}</li>)}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
