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
import { Brain, AlertTriangle, Loader2 } from 'lucide-react';
import { getRunningBrains } from '../services/localModelApi';

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
      <div className="sg-card sg-card-pad" style={{ textAlign: 'center', padding: 40 }}>
        <Loader2 size={24} className="sg-spin" />
        <p className="sg-small" style={{ marginTop: 12 }}>Checking your local brains…</p>
      </div>
    );
  }

  const missing = required.filter(b => !brains?.[b]);

  if (missing.length > 0) {
    return (
      <div className="sg-card sg-card-pad" style={{ borderColor: 'var(--sg-warn, #f59e0b)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <AlertTriangle size={22} style={{ color: 'var(--sg-warn, #f59e0b)' }} />
          <strong>Brains not running</strong>
        </div>
        <p>
          <b>{featureName}</b> needs {missing.map(b => BRAIN_LABELS[b]).join(', ')} running on your computer.
        </p>
        <p className="sg-small" style={{ opacity: 0.7 }}>
          Models run on your local machine — download them once from Models, press Run, and they stay ready.
        </p>
        <div style={{ marginTop: 12 }}>
          {missing.map(b => (
            <div key={b} className="sg-small" style={{ marginBottom: 4 }}>
              <Brain size={14} style={{ marginRight: 6 }} />
              {BRAIN_LABELS[b]} — <span style={{ color: 'var(--sg-warn, #f59e0b)' }}>not running</span>
            </div>
          ))}
        </div>
        <Link to="/agent/models" className="sg-btn sg-btn-primary" style={{ marginTop: 16 }}>
          Open Models to download & run
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
