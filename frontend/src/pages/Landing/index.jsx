import React from 'react';
import { NavLink } from 'react-router-dom';
import { Button } from '../../components/ui/Basic';
import { ArrowRight, Radar } from 'lucide-react';

export const Landing = () => {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="landing-brand"><span className="landing-brand-mark"><Radar size={17} /></span> DARK<span>MATTER</span></div>
        <div className="landing-header-actions">
          <NavLink to="/login">
            <Button variant="secondary">Log In</Button>
          </NavLink>
          <NavLink to="/register">
            <Button variant="primary">Start Research <ArrowRight size={16} /></Button>
          </NavLink>
        </div>
      </header>
      
      <main className="landing-main">
        <span className="landing-kicker"><span /> Autonomous authorized research workspace</span>
        <h1>
          Autonomous Security Research.<br/>
          <em>Powered by AI.</em>
        </h1>
        <p className="landing-lede">
          An elite AI agent that plans, investigates, validates, and reports on authorized targets. Scale your security operations with autonomous intelligence.
        </p>
        <div className="landing-main-actions">
          <NavLink to="/login">
            <Button variant="primary">Start Research <ArrowRight size={17} /></Button>
          </NavLink>
          <Button variant="secondary">Explore Platform</Button>
        </div>
        
        <div className="landing-capabilities">
          <div>
            <h3>Autonomous Research</h3>
            <p>AI plans, investigates, analyzes, validates and reports.</p>
          </div>
          <div>
            <h3>Secure Execution</h3>
            <p>Policy-driven, scoped security tool orchestration.</p>
          </div>
          <div>
            <h3>Professional Reports</h3>
            <p>Turn validated evidence into clear security reports.</p>
          </div>
        </div>
      </main>
    </div>
  );
};
