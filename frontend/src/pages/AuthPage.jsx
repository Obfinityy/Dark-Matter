// Dedicated /login and /signup routes — the auth card centered on the page.
import React from 'react';
import { AuthCard } from '../components/AuthModal';

export default function AuthPage({ mode, onDone }) {
  return (
    <div className="auth-page">
      <AuthCard initialMode={mode} onDone={onDone} />
    </div>
  );
}
