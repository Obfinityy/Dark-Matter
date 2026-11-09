// Dark Matter frontend — entry point.
//
// Mounts <App /> into #root (see frontend/index.html) and imports the
// stylesheets: ./index.css (component rules) and ./design-system.css
// (design tokens). React.StrictMode is on in development.

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './design-system.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
