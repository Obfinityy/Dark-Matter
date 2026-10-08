/**
 * main — the application entry point.
 * Mounts the React tree into the #root node with StrictMode enabled.
 * Fails loudly with a clear message if the mount node is missing.
 * Part of: Infinity AI / Dark-Matter frontend (app shell).
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/singularity.css';
import './styles/elegant.css';
import './styles/dark-matter-overrides.css';
import App from './App.jsx';

// The mount node must exist in index.html. Fail loudly here with a clear
// message instead of inside createRoot with a cryptic one.
const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('[Infinity AI] Mount node #root not found — check index.html');
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);
