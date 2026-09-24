import React, { useState } from 'react';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Button, Badge } from '../../components/ui/Basic';
import { ShieldAlert } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export const NewScan = () => {
  const [step, setStep] = useState(1);
  const [selectedMode, setSelectedMode] = useState(null);

  const modes = [
    { id: 'NORMAL', desc: 'Standard coverage', usage: '$', avail: true },
    { id: 'MEDIUM', desc: 'Extended coverage & payloads', usage: '$$', avail: true },
    { id: 'HIGH', desc: 'Advanced AI analysis & deep recon', usage: '$$$', avail: true },
    { id: 'ULTRA HIGH', desc: 'Exhaustive validation & bypass attempts', usage: '$$$$', avail: true },
    { id: 'INFINITY', desc: 'Maximum configured research capacity', usage: '$$$$$', avail: false }
  ];

  return (
    <div className="animate-fade-in" style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="page-header">
        <h1 className="page-title">New Investigation</h1>
        <p className="page-description">Configure and launch a new autonomous security scan.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        {[1, 2, 3, 4, 5].map(s => (
          <div key={s} style={{ flex: 1, height: 4, backgroundColor: s <= step ? 'var(--accent)' : 'var(--border)', borderRadius: 2 }} />
        ))}
      </div>

      <Card>
        <CardContent style={{ padding: 32 }}>
          {step === 1 && (
            <div className="animate-fade-in">
              <h2 style={{ marginBottom: 24 }}>Step 1: Select Project</h2>
              <select className="form-control" style={{ marginBottom: 24 }} defaultValue="">
                <option value="" disabled>Select a project...</option>
                <option value="proj_1">Acme Corp External</option>
                <option value="proj_2">Stark Industries Internal</option>
              </select>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="primary" onClick={() => setStep(2)}>Next</Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in">
              <h2 style={{ marginBottom: 24 }}>Step 2: Select Target</h2>
              <select className="form-control" style={{ marginBottom: 24 }} defaultValue="">
                <option value="" disabled>Select a target...</option>
                <option value="target_1">target_1 (app.acmecorp.com)</option>
                <option value="target_2">target_2 (api.acmecorp.com)</option>
              </select>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
                <Button variant="primary" onClick={() => setStep(3)}>Next</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-fade-in">
              <h2 style={{ marginBottom: 24 }}>Step 3: Verify Authorization</h2>
              <div style={{ padding: 20, backgroundColor: 'var(--danger-transparent)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <ShieldAlert color="var(--danger)" />
                  <h3 style={{ color: 'var(--danger)' }}>Authorization Required</h3>
                </div>
                <p style={{ color: 'var(--text-primary)', marginBottom: 16 }}>Only test targets you are explicitly authorized to assess. Unauthorized testing is illegal and violates our terms of service.</p>
                <label className="checkbox-container">
                  <input type="checkbox" />
                  <span className="checkmark"></span>
                  <span className="checkbox-text" style={{ color: 'var(--text-primary)' }}>I confirm that I am authorized to test this target and its defined scope.</span>
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
                <Button variant="primary" onClick={() => setStep(4)}>Next</Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="animate-fade-in">
              <h2 style={{ marginBottom: 24 }}>Step 4: Execution Mode</h2>
              <div className="grid grid-cols-1" style={{ gap: 16, marginBottom: 24 }}>
                {modes.map(mode => (
                  <div 
                    key={mode.id} 
                    onClick={() => mode.avail && setSelectedMode(mode.id)}
                    style={{ 
                      padding: 20, 
                      border: `2px solid ${selectedMode === mode.id ? 'var(--accent)' : 'var(--border)'}`, 
                      borderRadius: 'var(--radius-md)', 
                      cursor: mode.avail ? 'pointer' : 'not-allowed',
                      opacity: mode.avail ? 1 : 0.5,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: selectedMode === mode.id ? 'var(--accent-transparent)' : 'var(--surface)'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: 4 }}>{mode.id}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{mode.desc}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: 4 }}>{mode.usage}</div>
                      {!mode.avail && <Badge variant="neutral">Coming Soon</Badge>}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Button variant="secondary" onClick={() => setStep(3)}>Back</Button>
                <Button variant="primary" disabled={!selectedMode} onClick={() => setStep(5)}>Next</Button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="animate-fade-in">
              <h2 style={{ marginBottom: 24 }}>Step 5: Review</h2>
              <div style={{ backgroundColor: 'var(--bg-primary)', padding: 24, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: 32 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '16px 24px', fontSize: '0.95rem' }}>
                  <div style={{ color: 'var(--text-secondary)' }}>Project</div>
                  <div style={{ fontWeight: 500 }}>Acme Corp External</div>
                  
                  <div style={{ color: 'var(--text-secondary)' }}>Target</div>
                  <div style={{ fontWeight: 500 }}>target_1 (app.acmecorp.com)</div>
                  
                  <div style={{ color: 'var(--text-secondary)' }}>Mode</div>
                  <div><Badge variant="neutral">{selectedMode}</Badge></div>
                  
                  <div style={{ color: 'var(--text-secondary)' }}>Est. Usage</div>
                  <div style={{ color: 'var(--accent)', fontWeight: 600 }}>~$5.00</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Button variant="secondary" onClick={() => setStep(4)}>Back</Button>
                <NavLink to="/scans/live">
                  <Button variant="primary" style={{ padding: '12px 24px', fontSize: '1.1rem' }}>Start Investigation</Button>
                </NavLink>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
