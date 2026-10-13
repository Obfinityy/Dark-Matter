import React, { useEffect, useState } from 'react';
import Markdown from '../components/Markdown';
import { fetchReportMarkdown, reportPdfUrl } from '../lib/api';
import { toast } from '../lib/toast';

const HUNTS_KEY = 'dm.hunts';

function loadHunts() {
  try {
    const raw = localStorage.getItem(HUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function ReportsPage({ preselectedHuntId }) {
  const [hunts, setHunts] = useState(() => loadHunts());
  const [manualId, setManualId] = useState('');
  const [selectedId, setSelectedId] = useState(preselectedHuntId || null);
  const [markdown, setMarkdown] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (preselectedHuntId) {
      setSelectedId(preselectedHuntId);
      setMarkdown('');
      setError('');
    }
  }, [preselectedHuntId]);

  useEffect(() => {
    setHunts(loadHunts());
  }, []);

  function select(id) {
    setSelectedId(id);
    setMarkdown('');
    setError('');
  }

  async function generateReport() {
    if (!selectedId) return;
    setGenerating(true);
    setError('');
    const res = await fetchReportMarkdown(selectedId);
    setGenerating(false);
    if (res.ok) {
      if (res.data.markdown) {
        setMarkdown(res.data.markdown);
      } else {
        setError('The backend returned an empty report. Try again once the hunt has progressed.');
      }
    } else {
      setError(res.error || 'Could not generate the report.');
      toast(res.error || 'Could not generate the report.', 'error');
    }
  }

  function loadManual() {
    const id = manualId.trim();
    if (!id) return;
    select(id);
    setManualId('');
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Reports</h1>
        <p className="page-sub">
          Generate a report for any hunt — even while it is still running.
        </p>
      </header>

      <div className="reports-layout">
        <div className="reports-list">
          <div className="manual-load">
            <input
              className="text-input"
              placeholder="Load a hunt by ID…"
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') loadManual();
              }}
            />
            <button className="btn btn-ghost btn-sm" onClick={loadManual} disabled={!manualId.trim()}>
              Load
            </button>
          </div>
          {hunts.length === 0 && (
            <div className="empty-hint">No hunts yet. Start one from the chat page.</div>
          )}
          {hunts.map((h) => (
            <button
              key={h.huntId}
              className={`report-hunt-item${selectedId === h.huntId ? ' active' : ''}`}
              onClick={() => select(h.huntId)}
            >
              <div className="report-hunt-target">{h.target}</div>
              <div className="report-hunt-meta">
                {h.status || 'unknown'}
                {h.createdAt ? ` · ${new Date(h.createdAt).toLocaleString()}` : ''}
              </div>
              <div className="report-hunt-id">{h.huntId}</div>
            </button>
          ))}
        </div>

        <div className="reports-detail">
          {!selectedId && <div className="empty-hint">Select a hunt to view or generate its report.</div>}
          {selectedId && (
            <>
              <div className="report-actions">
                <button className="btn btn-primary btn-sm" onClick={generateReport} disabled={generating}>
                  {generating ? 'Generating…' : 'Generate report'}
                </button>
                <a
                  className="btn btn-ghost btn-sm"
                  href={reportPdfUrl(selectedId)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download PDF
                </a>
                <span className="report-hunt-id">Hunt ID: {selectedId}</span>
              </div>
              {error && <div className="alert alert-error">{error}</div>}
              {markdown ? (
                <div className="report-paper">
                  <Markdown text={markdown} />
                </div>
              ) : (
                !error && <div className="empty-hint">No report generated yet for this hunt.</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
