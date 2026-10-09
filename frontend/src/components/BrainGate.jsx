/**
 * BrainGate — lets the user see the normal view immediately. The brain
 * check runs silently in the background. Only when the user actually tries to
 * use the feature (submit / Enter) do we verify: if a required brain isn't
 * ready on their machine, the action is held and a warning panel appears
 * with a shortcut to Models. No warning is ever shown at page open.
 *
 * A brain counts as ready when its local model is running OR a Kaggle link
 * is connected for its slot (Models page).
 *
 * Hunt needs: vision + hacker (grounding is optional — vision doubles as grounder)
 * Infinity AI Chat/Plan/Build needs: vision
 * Infinity AI Control needs: vision (+ grounding optional)
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Brain, AlertTriangle, ArrowRight, X } from 'lucide-react';
import { getRunningBrains } from '../services/localModelApi';
import { getAllKaggleSlots } from '../services/gradioDirect';
import './BrainGate.css';

const BRAIN_LABELS = {
  vision: 'Vision Brain',
  grounding: 'Grounding Brain',
  hacker: 'Hacking Brain',
};

/** A slot is ready when its local model runs or a Kaggle link is connected. */
function slotReady(localRunning, kaggleSlots, slot) {
  if (localRunning && localRunning[slot]) return true;
  try {
    const entry = kaggleSlots && kaggleSlots[slot];
    return !!(entry && entry.url);
  } catch {
    return false;
  }
}

export function BrainGate({ required = [], featureName = 'this feature', children }) {
  const [brains, setBrains] = useState(null); // null = not yet known
  const [warnVisible, setWarnVisible] = useState(false);

  const refresh = useCallback(async () => {
    let running = null;
    try {
      running = await getRunningBrains();
    } catch {
      running = { vision: false, grounding: false, hacker: false };
    }
    let kaggle = null;
    try {
      kaggle = getAllKaggleSlots();
    } catch {
      kaggle = null;
    }
    const merged = {
      vision: slotReady(running, kaggle, 'vision'),
      grounding: slotReady(running, kaggle, 'grounding'),
      hacker: slotReady(running, kaggle, 'hacker'),
    };
    setBrains(merged);
    return merged;
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
            <b>{featureName}</b> needs {missing.map(b => BRAIN_LABELS[b]).join(', ')} ready.
          </p>
          <p className="sg-small brain-gate-hint">
            Run a local model from Models, or connect a Kaggle link for each missing brain —
            then come back and hit enter again.
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
