/**
 * BrainGate — blocks a feature until its required brains are running on the
 * user's local machine.
 *
 * Hunt needs: vision + grounding + hacker (all 3)
 * Infinity AI Chat/Plan/Build needs: vision
 * Infinity AI Control needs: vision + grounding
 *
 * If a required brain isn't running, shows which ones are missing with a
 * button to open Models.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Brain, AlertTriangle, Loader2, ArrowRight } from 'lucide-react';
import { getRunningBrains } from '../services/localModelApi';
import './BrainGate.css';

const BRAIN_LABELS = {
  vision: 'Vision Brain',
  grounding: 'Grounding Brain',
  hacker: 'Hacking Brain'
};

export function BrainGate({ required = [], featureName = 'this feature', children }) {
  const [brains, setBrains] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const running = await getRunningBrains();
        if (!cancelled) setBrains(running);
      } catch {
        if (!cancelled) setBrains({ vision: false, grounding: false, hacker: false });
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (checking) {
    return (
      <div className="sg-card sg-card-pad brain-gate brain-gate-checking" role="status" aria-label="Checking local brains">
        <Loader2 size={24} className="sg-spin" aria-hidden="true" />
        <p className="sg-small">Checking your local brains…</p>
      </div>
    );
  }

  const missing = required.filter(b => !brains?.[b]);

  if (missing.length > 0) {
    return (
      <div className="sg-card sg-card-pad brain-gate brain-gate-warn" role="alert">
        <div className="brain-gate-head">
          <AlertTriangle size={22} aria-hidden="true" />
          <strong>Brains not running</strong>
        </div>
        <p className="brain-gate-copy">
          <b>{featureName}</b> needs {missing.map(b => BRAIN_LABELS[b]).join(', ')} running on your computer.
        </p>
        <p className="sg-small brain-gate-hint">
          Models run on your local machine — download them once from Models, press Run, and they stay ready.
        </p>
        <div className="brain-gate-missing">
          {missing.map(b => (
            <div key={b} className="brain-gate-missing-item">
              <Brain size={14} aria-hidden="true" />
              <span>{BRAIN_LABELS[b]} — <span className="brain-gate-off">not running</span></span>
            </div>
          ))}
        </div>
        <Link to="/agent/models" className="sg-btn sg-btn-primary brain-gate-cta">
          Open Models to download & run <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
