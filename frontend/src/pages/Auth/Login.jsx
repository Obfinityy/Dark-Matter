import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Basic';

export const Login = () => {
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    navigate('/dashboard');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
      <div style={{ width: 400, padding: 32, backgroundColor: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontWeight: 700, fontSize: '1.5rem', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center' }}>
            <span style={{ color: 'var(--accent)', marginRight: '8px' }}>▲</span>
            AUTONOMOUS_AI
          </div>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>Sign in to your workspace</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-control" placeholder="researcher@example.com" required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className="form-control" placeholder="••••••••" required />
          </div>
          <Button variant="primary" style={{ width: '100%', marginBottom: 16 }}>Sign In</Button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <a href="#" style={{ fontSize: '0.9rem' }}>Forgot password?</a>
        </div>
      </div>
    </div>
  );
};
