import React from 'react';
import { NavLink } from 'react-router-dom';
import { Button } from '../../components/ui/Basic';

export const Landing = () => {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '24px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}>
          <span style={{ color: 'var(--accent)', marginRight: '8px' }}>▲</span>
          AUTONOMOUS_AI
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <NavLink to="/login">
            <Button variant="secondary">Log In</Button>
          </NavLink>
          <NavLink to="/login">
            <Button variant="primary">Start Research</Button>
          </NavLink>
        </div>
      </header>
      
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px' }}>
        <h1 style={{ fontSize: '4rem', fontWeight: 800, marginBottom: 24, background: 'linear-gradient(to right, #ffffff, #a0a0b0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Autonomous Security Research.<br/>
          Powered by AI.
        </h1>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', maxWidth: 600, marginBottom: 48, lineHeight: 1.6 }}>
          An elite AI agent that plans, investigates, validates, and reports on authorized targets. Scale your security operations with autonomous intelligence.
        </p>
        <div style={{ display: 'flex', gap: 16 }}>
          <NavLink to="/login">
            <Button variant="primary" style={{ padding: '16px 32px', fontSize: '1.1rem' }}>Start Research</Button>
          </NavLink>
          <Button variant="secondary" style={{ padding: '16px 32px', fontSize: '1.1rem' }}>Explore Platform</Button>
        </div>
        
        <div style={{ display: 'flex', gap: 32, marginTop: 80, padding: 32, borderTop: '1px solid var(--border)' }}>
          <div style={{ textAlign: 'left', maxWidth: 250 }}>
            <h3 style={{ color: 'var(--accent)', marginBottom: 8 }}>Autonomous Research</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>AI plans → investigates → analyzes → validates → reports.</p>
          </div>
          <div style={{ textAlign: 'left', maxWidth: 250 }}>
            <h3 style={{ color: 'var(--accent)', marginBottom: 8 }}>Secure Execution</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Policy-driven sandboxed security tool orchestration.</p>
          </div>
          <div style={{ textAlign: 'left', maxWidth: 250 }}>
            <h3 style={{ color: 'var(--accent)', marginBottom: 8 }}>Professional Reports</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Export findings in PDF, JSON, and Markdown formats.</p>
          </div>
        </div>
      </main>
    </div>
  );
};
