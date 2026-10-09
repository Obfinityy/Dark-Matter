/**
 * main — the application entry point.
 * Mounts the React tree into the #root node with StrictMode enabled.
 * Fails loudly with a clear message if the mount node is missing.
 * Part of: Infinity AI / Dark-Matter frontend (app shell).
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// index.css intentionally not imported: the file is empty (only a comment).
import './styles/singularity.css';
import './styles/elegant.css';
import './styles/dark-matter-overrides.css';
import App from './App.jsx';

// The mount node must exist in index.html. Fail loudly here with a clear
// message instead of inside createRoot with a cryptic one. If the node is
// missing, also paint a plain-language banner into the body (inline styles
// so it renders even if stylesheets failed) — a blank page explains nothing.
const rootEl = document.getElementById('root');
if (!rootEl) {
  const banner = document.createElement('div');
  banner.setAttribute('role', 'alert');
  banner.style.cssText =
    'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
    'background:#0a0614;color:#f5f1e8;font:16px/1.6 system-ui,sans-serif;' +
    'padding:24px;text-align:center;z-index:99999;';
  banner.textContent =
    'Infinity AI could not start: the page is missing its mount point (#root). ' +
    'Please check index.html or contact support.';
  document.body.appendChild(banner);
  throw new Error('[Infinity AI] Mount node #root not found — check index.html');
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);
