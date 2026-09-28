import React from 'react';
import { X, CheckCircle, Zap, Shield, Infinity as InfinityIcon } from 'lucide-react';

export const SubscriptionModal = ({ onClose }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content subscription-modal animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Upgrade your plan</h2>
          <button className="btn icon-button" onClick={onClose} aria-label="Close plans" title="Close plans"><X size={20} /></button>
        </div>
        <div className="modal-body subscription-modal-body">
          <div className="plan-grid">
            
            {/* Free Plan */}
            <div className="plan-card">
              <h3>DarkMatter Free</h3>
              <div className="plan-description">For individuals experimenting with autonomous security.</div>
              <div className="plan-price">$0<span>/month</span></div>
              <button className="btn plan-cta plan-cta-muted" disabled>Current Plan</button>
              <ul className="plan-features">
                <li><CheckCircle size={18} /> <span>Basic reconnaissance capabilities</span></li>
                <li><CheckCircle size={18} /> <span>Standard AI model access</span></li>
                <li><CheckCircle size={18} /> <span>Normal & Medium modes</span></li>
              </ul>
            </div>

            {/* Pro Plan */}
            <div className="plan-card plan-card-featured">
              <div className="plan-ribbon">MOST POPULAR</div>
              <h3>DarkMatter Pro <Zap size={18} /></h3>
              <div className="plan-description">For professional security researchers.</div>
              <div className="plan-price">$20<span>/month</span></div>
              <button className="btn plan-cta plan-cta-accent">Upgrade to Pro</button>
              <ul className="plan-features">
                <li><CheckCircle size={18} /> <span>High mode access</span></li>
                <li><CheckCircle size={18} /> <span>Priority access to latest models</span></li>
                <li><CheckCircle size={18} /> <span>Premium tool integrations</span></li>
              </ul>
            </div>

            {/* Elite Plan */}
            <div className="plan-card">
              <h3>DarkMatter Elite <Shield size={18} /></h3>
              <div className="plan-description">For boutique security firms and teams.</div>
              <div className="plan-price">$99<span>/month</span></div>
              <button className="btn plan-cta plan-cta-muted">Upgrade to Elite</button>
              <ul className="plan-features">
                <li><CheckCircle size={18} /> <span>Ultra High mode access</span></li>
                <li><CheckCircle size={18} /> <span>Advanced autonomous validation</span></li>
                <li><CheckCircle size={18} /> <span>Export professional PDF/JSON reports</span></li>
              </ul>
            </div>

            {/* Infinity Plan */}
            <div className="plan-card plan-card-infinity">
              <h3>Infinity <InfinityIcon size={18} /></h3>
              <div className="plan-description">Maximum configured research capacity for enterprise scale.</div>
              <div className="plan-price">$499<span>/month</span></div>
              <button className="btn plan-cta plan-cta-danger">Upgrade to Infinity</button>
              <ul className="plan-features">
                <li><CheckCircle size={18} /> <span>Infinity mode access</span></li>
                <li><CheckCircle size={18} /> <span>Unrestricted sandbox limits</span></li>
                <li><CheckCircle size={18} /> <span>Zero-day hunter & custom plugins</span></li>
              </ul>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
