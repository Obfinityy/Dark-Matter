import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge, Button } from '../../components/ui/Basic';
import { mockEvents } from '../../mock/events';
import { Pause, Play, Download, Search } from 'lucide-react';

export const LiveScan = () => {
  const [events, setEvents] = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    // Simulate streaming events
    let i = 0;
    const interval = setInterval(() => {
      if (i < mockEvents.length) {
        setEvents(prev => [...prev, mockEvents[i]]);
        i++;
      } else {
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="animate-fade-in" style={{ height: 'calc(100vh - 128px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h2 style={{ fontSize: '1.2rem' }}>target_1</h2>
          <Badge variant="neutral">HIGH</Badge>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>01:15:22</span>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>$4.50</span>
          <Badge variant="info" className="animate-pulse">Running</Badge>
        </div>
        <Button variant="danger">Stop Investigation</Button>
      </div>

      <div className="grid grid-cols-4" style={{ flex: 1, minHeight: 0 }}>
        {/* AI State Panel */}
        <Card style={{ gridColumn: 'span 1', overflowY: 'auto' }}>
          <CardContent style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 16 }}>AI Research State</h3>
            
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Current Objective</div>
              <div style={{ fontWeight: 500 }}>Analyzing discovered attack surface</div>
            </div>
            
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Status</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="animate-spin" style={{ width: 12, height: 12, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block' }}></span>
                <span style={{ color: 'var(--accent)' }}>Executing</span>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Current Hypothesis</div>
              <div style={{ fontSize: '0.9rem', padding: 12, backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                Target api.acmecorp.com may expose unauthenticated endpoints. Checking /v1/users based on previous recon.
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Next Action</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Send controlled GET request to /v1/users to validate authorization requirements.</div>
            </div>

            <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 16 }}>Timeline</h3>
              <div className="timeline">
                {['Target Initialized', 'Scope Verified', 'Reconnaissance', 'Asset Discovery'].map((phase, idx) => (
                  <div key={idx} className="timeline-item completed">
                    <div className="timeline-icon">✓</div>
                    <div className="timeline-content">
                      <div className="timeline-title" style={{ fontSize: '0.85rem' }}>{phase}</div>
                    </div>
                  </div>
                ))}
                <div className="timeline-item active">
                  <div className="timeline-icon">●</div>
                  <div className="timeline-content">
                    <div className="timeline-title" style={{ fontSize: '0.85rem' }}>Attack Surface Analysis</div>
                  </div>
                </div>
                {['Validation', 'Evidence', 'Reporting'].map((phase, idx) => (
                  <div key={idx} className="timeline-item">
                    <div className="timeline-icon" style={{ borderColor: 'var(--border)' }}>○</div>
                    <div className="timeline-content">
                      <div className="timeline-title" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{phase}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Technical Terminal */}
        <div style={{ gridColumn: 'span 3', display: 'flex', flexDirection: 'column' }}>
          <div className="terminal-container">
            <div className="terminal-header">
              <div className="terminal-title">Technical Output</div>
              <div className="terminal-actions">
                <button className="btn" style={{ padding: 4 }}><Search size={16} color="var(--text-secondary)" /></button>
                <button className="btn" style={{ padding: 4 }} onClick={() => setAutoScroll(!autoScroll)}>
                  {autoScroll ? <Pause size={16} color="var(--text-secondary)" /> : <Play size={16} color="var(--text-secondary)" />}
                </button>
                <button className="btn" style={{ padding: 4 }}><Download size={16} color="var(--text-secondary)" /></button>
              </div>
            </div>
            <div className="terminal-body" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              {events.map((evt, idx) => (
                <div key={idx} className="log-entry">
                  <span className="log-timestamp">[{evt.timestamp}]</span>
                  <span className={`log-level ${evt.level}`}>{evt.level.padEnd(8, ' ')}</span>
                  <span className="log-message">{evt.message}</span>
                </div>
              ))}
              {events.length === mockEvents.length && (
                <div className="log-entry" style={{ marginTop: 8 }}>
                  <span className="log-timestamp" style={{ opacity: 0 }}>[00:00:00]</span>
                  <span className="log-level" style={{ opacity: 0 }}>INFO    </span>
                  <span className="log-message animate-pulse" style={{ color: 'var(--text-muted)' }}>_</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
