// Dedicated /login route — the auth card centered on the page.
import React from 'react';
import { AuthCard } from '../components/AuthModal';

export default function AuthPage({ onDone }) {
  return (
    <div className="auth-page">
      <AuthCard onDone={onDone} />
    </div>
  );
}
