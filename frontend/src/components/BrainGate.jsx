/**
 * BrainGate — lets the user see the normal view immediately. The local-brain
 * check runs silently in the background. Only when the user actually tries to
 * use the feature (submit / Enter) do we verify: if a required brain isn't
 * running on their machine, the action is held and a warning panel appears
 * with a shortcut to Models. No warning is ever shown at page open.
 *
 * Hunt needs: vision + grounding + hacker (all 3)
 * Infinity AI Chat/Plan/Build needs: vision
 * Infinity AI Control needs: vision + grounding
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Brain, AlertTriangle, ArrowRight, X } from 'lucide-react';
import { getRunningBrains } from '../services/localModelApi';
import './BrainGate.css';

const BRAIN_LABELS = {
  vision: 'Vision Brain',
  grounding: 'Grounding Brain',
  hacker: 'Hacking Brain',
};

export function BrainGate({ required = [], featureName = 'this feature', children }) {
  const [brains, setBrains] = useState(null); // null = not yet known
  const [warnVisible, setWarnVisible] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const running = await getRunningBrains();
      setBrains(running);
      return running;
    } catch {
      const none = { vision: false, grounding: false, hacker: false };
      setBrains(none);
      return none;
    }
  }, []);

  // Silent background check — never blocks the view.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const running = await refresh();
      if (!cancelled) setBrains(running);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const missing = required.filter(b => !(brains && brains[b]));

  const handleAttempt = e => {
    // Keep the check fresh in the background.
    refresh();
    if (brains && missing.length > 0) {
      // Hold the action and show the warning instead.
      e.preventDefault();
      e.stopPropagation();
      setWarnVisible(true);
    }
    // Brains unknown or all running → let the action through normally.
  };

  const handleKeyAttempt = e => {
    // Plain Enter (not Shift+Enter for newlines) counts as an attempt.
    if (e.key === 'Enter' && !e.shiftKey) handleAttempt(e);
  };

  return (
    <div
      className="brain-gate-wrap"
      onSubmitCapture={handleAttempt}
      onKeyDownCapture={handleKeyAttempt}
    >
      {warnVisible && missing.length > 0 && (
        <div className="sg-card sg-card-pad brain-gate brain-gate-warn" role="alert">
          <div className="brain-gate-head">
            <span className="brain-gate-head-title">
              <AlertTriangle size={22} aria-hidden="true" />
              <strong>Brains not running</strong>
            </span>
            <button
              type="button"
              className="sg-icon-btn brain-gate-dismiss"
              onClick={() => setWarnVisible(false)}
              aria-label="Dismiss warning"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <p className="brain-gate-copy">
            <b>{featureName}</b> needs {missing.map(b => BRAIN_LABELS[b]).join(', ')} running on
            your computer.
          </p>
          <p className="sg-small brain-gate-hint">
            Models run on your local machine — download them once from Models, press Run, and they
            stay ready.
          </p>
          <div className="brain-gate-missing">
            {missing.map(b => (
              <div key={b} className="brain-gate-missing-item">
                <Brain size={14} aria-hidden="true" />
                <span>
                  {BRAIN_LABELS[b]} — <span className="brain-gate-off">not running</span>
                </span>
              </div>
            ))}
          </div>
          <Link to="/agent/models" className="sg-btn sg-btn-primary brain-gate-cta">
            Open Models to download &amp; run <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      )}
      {children}
    </div>
  );
}
