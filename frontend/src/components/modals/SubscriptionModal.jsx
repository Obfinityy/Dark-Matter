import React from 'react';
import { X, CheckCircle, Zap, Shield, Infinity } from 'lucide-react';

export const SubscriptionModal = ({ onClose }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: 1200, margin: '20px', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Upgrade your plan</h2>
          <button className="btn" onClick={onClose}><X size={20} color="var(--text-secondary)" /></button>
        </div>
        <div className="modal-body" style={{ overflowY: 'auto', padding: 32 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
            
            {/* Free Plan */}
            <div style={{ padding: 24, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: 8 }}>DarkMatter Free</h3>
              <div style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '0.9rem', flex: 1 }}>For individuals experimenting with autonomous security.</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: 24 }}>$0<span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 400 }}>/month</span></div>
              <button className="btn" style={{ width: '100%', padding: 12, backgroundColor: 'var(--surface-hover)', borderRadius: 'var(--radius-md)', marginBottom: 24 }} disabled>Current Plan</button>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}><CheckCircle size={18} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 2 }} /> <span style={{ fontSize: '0.9rem' }}>Basic reconnaissance capabilities</span></li>
                <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}><CheckCircle size={18} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 2 }} /> <span style={{ fontSize: '0.9rem' }}>Standard AI model access</span></li>
                <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}><CheckCircle size={18} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 2 }} /> <span style={{ fontSize: '0.9rem' }}>Normal & Medium modes</span></li>
              </ul>
            </div>

            {/* Pro Plan */}
            <div style={{ padding: 24, border: '2px solid var(--accent)', borderRadius: 'var(--radius-lg)', position: 'relative', display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'absolute', top: -12, left: 24, backgroundColor: 'var(--accent)', color: '#fff', padding: '4px 12px', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', fontWeight: 600 }}>MOST POPULAR</div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>DarkMatter Pro <Zap size={18} color="var(--accent)" /></h3>
              <div style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '0.9rem', flex: 1 }}>For professional security researchers.</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: 24 }}>$20<span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 400 }}>/month</span></div>
              <button className="btn" style={{ width: '100%', padding: 12, backgroundColor: 'var(--accent)', color: '#fff', borderRadius: 'var(--radius-md)', marginBottom: 24 }}>Upgrade to Pro</button>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}><CheckCircle size={18} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} /> <span style={{ fontSize: '0.9rem' }}>High mode access</span></li>
                <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}><CheckCircle size={18} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} /> <span style={{ fontSize: '0.9rem' }}>Priority access to latest models</span></li>
                <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}><CheckCircle size={18} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} /> <span style={{ fontSize: '0.9rem' }}>Premium tool integrations</span></li>
              </ul>
            </div>

            {/* Elite Plan */}
            <div style={{ padding: 24, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>DarkMatter Elite <Shield size={18} color="var(--info)" /></h3>
              <div style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '0.9rem', flex: 1 }}>For boutique security firms and teams.</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: 24 }}>$99<span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 400 }}>/month</span></div>
              <button className="btn" style={{ width: '100%', padding: 12, backgroundColor: 'var(--surface-hover)', borderRadius: 'var(--radius-md)', marginBottom: 24 }}>Upgrade to Elite</button>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}><CheckCircle size={18} color="var(--info)" style={{ flexShrink: 0, marginTop: 2 }} /> <span style={{ fontSize: '0.9rem' }}>Ultra High mode access</span></li>
                <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}><CheckCircle size={18} color="var(--info)" style={{ flexShrink: 0, marginTop: 2 }} /> <span style={{ fontSize: '0.9rem' }}>Advanced autonomous validation</span></li>
                <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}><CheckCircle size={18} color="var(--info)" style={{ flexShrink: 0, marginTop: 2 }} /> <span style={{ fontSize: '0.9rem' }}>Export professional PDF/JSON reports</span></li>
              </ul>
            </div>

            {/* Infinity Plan */}
            <div style={{ padding: 24, border: '1px solid var(--danger)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>Infinity <Infinity size={18} color="var(--danger)" /></h3>
              <div style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '0.9rem', flex: 1 }}>Maximum configured research capacity for enterprise scale.</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: 24 }}>$499<span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 400 }}>/month</span></div>
              <button className="btn" style={{ width: '100%', padding: 12, backgroundColor: 'var(--danger-transparent)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', marginBottom: 24 }}>Upgrade to Infinity</button>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}><CheckCircle size={18} color="var(--danger)" style={{ flexShrink: 0, marginTop: 2 }} /> <span style={{ fontSize: '0.9rem' }}>Infinity mode access</span></li>
                <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}><CheckCircle size={18} color="var(--danger)" style={{ flexShrink: 0, marginTop: 2 }} /> <span style={{ fontSize: '0.9rem' }}>Unrestricted sandbox limits</span></li>
                <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}><CheckCircle size={18} color="var(--danger)" style={{ flexShrink: 0, marginTop: 2 }} /> <span style={{ fontSize: '0.9rem' }}>Zero-day hunter & custom plugins</span></li>
              </ul>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
