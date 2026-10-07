import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/singularity.css'
import App from './App.jsx'

// The mount node must exist in index.html. Fail loudly here with a clear
// message instead of inside createRoot with a cryptic one.
const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('[Infinity AI] Mount node #root not found — check index.html')
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
