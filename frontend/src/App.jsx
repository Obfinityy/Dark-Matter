import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, ProtectedRoute, PublicRoute, useAuth } from './auth/AuthContext';
import { Login } from './pages/Auth/Login';

import { 
  MessageSquare, Home, Clock, Settings, CreditCard, 
  User, MoreHorizontal, Globe, Paperclip, Search, 
  Send, Target, TerminalSquare, CheckCircle2, Download, Sun, Moon,
  Key, ChevronDown, Check, ArrowLeft, Play, Pause, Square, AlertTriangle,
  RefreshCw, Shield, Bug, Cpu, Lock, LogOut, Eye, FileText
} from 'lucide-react';
import { 
  getProviders, updateProviders, updateProfile, changePassword, logoutAccount,
  createAssessment, startAssessment, pauseAssessment, resumeAssessment, stopAssessment,
  getAssessmentFindings, sendAssessmentChat, generateReport, getLatestReport,
  subscribeToAssessmentEvents, listAssessments
} from './services/api';
import './styles/globals.css';
import './styles/infinity.css';

// Custom Logo Component
const Logo = ({ theme }) => (
  <div className="logo-container">
    <img src={theme === 'dark' ? '/dark-logo.png' : '/light-logo.png'} className="logo-icon" alt="" onError={(e) => { e.target.style.display = 'none'; }} />
    <span className="logo-text">DARKMATTER</span>
  </div>
);

// --- Settings Page (Real Database Provider Management) ---
const SettingsPage = () => {
  const navigate = useNavigate();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });
  const [inputs, setInputs] = useState({});

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const res = await getProviders();
      const list = res?.providers || [];
      setProviders(list);
      const initialInputs = {};
      list.forEach(p => {
        initialInputs[p.id] = {
          apiKey: '',
          enabled: p.enabled ?? false,
          model: p.model || '',
          priority: p.priority ?? 100
        };
      });
      setInputs(initialInputs);
    } catch (err) {
      setStatusMsg({ text: err.message || 'Failed to load providers.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (id, field, value) => {
    setInputs(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg({ text: '', type: '' });

    try {
      const payload = providers.map(p => {
        const input = inputs[p.id] || {};
        return {
          id: p.id,
          enabled: Boolean(input.enabled),
          model: input.model || p.model,
          priority: Number(input.priority) || 100,
          apiKey: input.apiKey ? input.apiKey.trim() : undefined
        };
      });

      const res = await updateProviders(payload);
      setProviders(res?.providers || []);
      setStatusMsg({ text: 'Settings & AI Brain keys saved successfully in your database!', type: 'success' });
      // clear the raw key inputs
      setInputs(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(k => {
          updated[k].apiKey = '';
        });
        return updated;
      });
    } catch (err) {
      setStatusMsg({ text: err.message || 'Failed to save settings.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dedicated-page">
      <div className="page-header">
        <button className="icon-button" onClick={() => navigate('/')}><ArrowLeft size={20} /></button>
        <h2>Settings & AI Brain Providers</h2>
      </div>
      <div className="page-content animated-border-box opaque-bg">
        <p className="settings-desc">
          Configure your AI reasoning brains. DarkMatter stores keys securely in your persistent database account and automatically switches providers if rate limits or errors occur.
        </p>

        {statusMsg.text && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '0.9rem',
            background: statusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${statusMsg.type === 'success' ? '#10b981' : '#ef4444'}`,
            color: statusMsg.type === 'success' ? '#10b981' : '#f87171'
          }}>
            {statusMsg.text}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="animate-spin" style={{ display: 'inline-block', marginBottom: '8px' }} />
            <p>Loading AI brain configurations...</p>
          </div>
        ) : (
          <form onSubmit={handleSave}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
              {providers.map((p) => {
                const current = inputs[p.id] || {};
                return (
                  <div key={p.id} style={{
                    padding: '16px',
                    borderRadius: '8px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border-light)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Cpu size={16} className="text-cyan" />
                        <strong style={{ fontSize: '1rem' }}>{p.name}</strong>
                        {p.hasApiKey && <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>Active Key: {p.maskedApiKey}</span>}
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                        <input 
                          type="checkbox" 
                          checked={current.enabled ?? false} 
                          onChange={(e) => handleInputChange(p.id, 'enabled', e.target.checked)} 
                        />
                        <span>Enabled</span>
                      </label>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                      <div className="api-key-group" style={{ margin: 0 }}>
                        <label><Key size={12} /> {p.hasApiKey ? 'Update API Key' : 'API Key'}</label>
                        <input 
                          type="password" 
                          placeholder={p.hasApiKey ? 'Enter new key to replace' : 'Enter API key...'} 
                          value={current.apiKey || ''} 
                          onChange={(e) => handleInputChange(p.id, 'apiKey', e.target.value)}
                          className="modal-input" 
                        />
                      </div>
                      <div className="api-key-group" style={{ margin: 0 }}>
                        <label>Model</label>
                        <input 
                          type="text" 
                          value={current.model || ''} 
                          placeholder={p.model}
                          onChange={(e) => handleInputChange(p.id, 'model', e.target.value)}
                          className="modal-input" 
                        />
                      </div>
                      <div className="api-key-group" style={{ margin: 0 }}>
                        <label>Priority (1=High)</label>
                        <input 
                          type="number" 
                          value={current.priority ?? 100} 
                          onChange={(e) => handleInputChange(p.id, 'priority', e.target.value)}
                          className="modal-input" 
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button type="submit" className="primary-cta modal-save-btn" disabled={saving}>
              {saving ? 'Saving to Database...' : 'Save Settings'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

// --- Billing Page ---
const BillingPage = () => {
  const navigate = useNavigate();
  const plans = [
    { name: "Basic", price: "$0/mo", desc: "Basic reconnaissance." },
    { name: "Intermediate", price: "$49/mo", desc: "Advanced scanning and reporting." },
    { name: "Medium", price: "$99/mo", desc: "Priority support and more targets." },
    { name: "High", price: "$299/mo", desc: "Enterprise API limits and workflows." },
    { name: "Infinity", price: "Custom", desc: "Limitless potential. Contact sales." }
  ];

  return (
    <div className="dedicated-page">
      <div className="page-header">
        <button className="icon-button" onClick={() => navigate('/')}><ArrowLeft size={20} /></button>
        <h2>Billing & Plans</h2>
      </div>
      <div className="page-content transparent-bg">
        <div className="billing-plans-grid">
          {plans.map((plan, i) => (
            <div key={i} className="plan-card animated-border-box opaque-bg">
              <h4>{plan.name}</h4>
              <div className="price">{plan.price}</div>
              <p>{plan.desc}</p>
              <button className="secondary-button w-100">Select Plan</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- Profile & Password Management Page ---
const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, refreshUser, logout } = useAuth();
  const [name, setName] = useState(user?.name || user?.username || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileMsg, setProfileMsg] = useState({ text: '', type: '' });
  const [passwordMsg, setPasswordMsg] = useState({ text: '', type: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg({ text: '', type: '' });
    try {
      await updateProfile({ name: name.trim() });
      setProfileMsg({ text: 'Profile name updated successfully.', type: 'success' });
      if (refreshUser) refreshUser();
    } catch (err) {
      setProfileMsg({ text: err.message || 'Failed to update profile.', type: 'error' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword) {
      setPasswordMsg({ text: 'Current password is required.', type: 'error' });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ text: 'New password must be at least 8 characters long.', type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: 'New passwords do not match.', type: 'error' });
      return;
    }

    setSavingPassword(true);
    setPasswordMsg({ text: '', type: '' });
    try {
      await changePassword({ currentPassword, newPassword });
      setPasswordMsg({ text: 'Password changed successfully!', type: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordMsg({ text: err.message || 'Failed to change password.', type: 'error' });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="dedicated-page">
      <div className="page-header">
        <button className="icon-button" onClick={() => navigate('/')}><ArrowLeft size={20} /></button>
        <h2>Account Profile & Security</h2>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Profile Info */}
        <div className="page-content animated-border-box opaque-bg">
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={18} className="text-cyan" /> Profile Information
          </h3>
          
          {profileMsg.text && (
            <div style={{
              padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem',
              background: profileMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${profileMsg.type === 'success' ? '#10b981' : '#ef4444'}`,
              color: profileMsg.type === 'success' ? '#10b981' : '#f87171'
            }}>
              {profileMsg.text}
            </div>
          )}

          <form onSubmit={handleUpdateProfile}>
            <div className="api-key-group">
              <label>Display Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="modal-input" 
              />
            </div>
            <div className="api-key-group">
              <label>Email Address</label>
              <input type="email" value={user?.email || ''} disabled className="modal-input disabled" />
            </div>
            <button type="submit" className="primary-cta modal-save-btn" disabled={savingProfile}>
              {savingProfile ? 'Updating...' : 'Update Profile'}
            </button>
          </form>
        </div>

        {/* Change Password */}
        <div className="page-content animated-border-box opaque-bg">
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={18} className="text-pink" /> Change Password
          </h3>

          {passwordMsg.text && (
            <div style={{
              padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem',
              background: passwordMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${passwordMsg.type === 'success' ? '#10b981' : '#ef4444'}`,
              color: passwordMsg.type === 'success' ? '#10b981' : '#f87171'
            }}>
              {passwordMsg.text}
            </div>
          )}

          <form onSubmit={handleChangePassword}>
            <div className="api-key-group">
              <label>Current Password</label>
              <input 
                type="password" 
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="modal-input" 
              />
            </div>
            <div className="api-key-group">
              <label>New Password (min 8 chars)</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="modal-input" 
              />
            </div>
            <div className="api-key-group">
              <label>Confirm New Password</label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="modal-input" 
              />
            </div>
            <button type="submit" className="primary-cta modal-save-btn" disabled={savingPassword}>
              {savingPassword ? 'Updating Password...' : 'Change Password'}
            </button>
          </form>
        </div>

        {/* Session Management */}
        <div className="page-content animated-border-box opaque-bg" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ margin: 0 }}>Sign Out</h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Terminate active session on this device.</p>
          </div>
          <button onClick={handleLogout} className="secondary-button" style={{ borderColor: '#ef4444', color: '#f87171' }}>
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Sidebar ---
const Sidebar = ({ toggleTheme, theme, onNewAssessment }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleNewChat = () => {
    if (onNewAssessment) onNewAssessment();
    navigate('/');
  };
  
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Logo theme={theme} />
      </div>
      
      <div className="sidebar-content">
        <button className="new-chat-btn" onClick={handleNewChat}>
          <MessageSquare size={16} />
          <span>New Assessment</span>
          <span className="shortcut">Ctrl + N</span>
        </button>

        <nav className="nav-menu">
          <button className={`nav-item ${location.pathname === '/' ? 'active' : ''}`} onClick={() => navigate('/')}>
            <Home size={18} />
            <span>Autonomous Recon</span>
          </button>
        </nav>
      </div>

      <div className="sidebar-footer">
        <button className={`nav-item ${location.pathname === '/settings' ? 'active' : ''}`} onClick={() => navigate('/settings')}>
          <Settings size={18} />
          <span>AI Brain Settings</span>
        </button>
        <button className={`nav-item ${location.pathname === '/billing' ? 'active' : ''}`} onClick={() => navigate('/billing')}>
          <CreditCard size={18} />
          <span>Billing</span>
        </button>
        <button className={`nav-item profile-item ${location.pathname === '/profile' ? 'active' : ''}`} onClick={() => navigate('/profile')}>
          <User size={18} />
          <span className="text-truncate" style={{maxWidth: '120px'}}>{user?.name || user?.username || 'Researcher'}</span>
          <span className="pro-badge">AI AGENT</span>
          <MoreHorizontal size={16} className="ml-auto" />
        </button>
        <button className="nav-item theme-toggle" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>
    </aside>
  );
};

const TopNav = () => {
  return (
    <header className="top-nav">
      <div className="nav-links">
        <a href="#" className="active">INTELLIGENCE</a>
        <span className="separator">/</span>
        <a href="#">AUTONOMOUS BRAIN</a>
        <span className="separator">/</span>
        <a href="#">REPORTING</a>
      </div>
    </header>
  );
};

const SuggestionCard = ({ icon, title, desc, onClick }) => (
  <div className="suggestion-card animated-border-box opaque-bg" onClick={() => onClick(title)}>
    <div className="card-icon">{icon}</div>
    <h4>{title}</h4>
    <p>{desc}</p>
    <div className="arrow">→</div>
  </div>
);

const ChatInput = ({ onSubmit, disabled, placeholder = "Enter target domain or URL (e.g. example.com)..." }) => {
  const [msg, setMsg] = useState('');
  const [mode, setMode] = useState('Medium');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const modes = ['Low', 'Medium', 'High', 'Extra High', 'Infinity'];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (msg.trim() && !disabled) {
      onSubmit(msg.trim(), mode);
      setMsg('');
    }
  };

  return (
    <div className="chat-input-container">
      <form onSubmit={handleSubmit} className="chat-input-wrapper animated-border-box opaque-bg">
        <input
          type="text"
          placeholder={placeholder}
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          disabled={disabled}
        />
        <div className="input-actions">
          <div className="mode-selector-wrapper">
            <button 
              type="button" 
              className="action-btn mode-select"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <Target size={14} />
              <span>{mode}</span>
              <ChevronDown size={12} />
            </button>
            
            {dropdownOpen && (
              <div className="mode-dropdown">
                {modes.map(m => (
                  <div 
                    key={m} 
                    className={`mode-option ${mode === m ? 'active' : ''}`}
                    onClick={() => { setMode(m); setDropdownOpen(false); }}
                  >
                    <span>{m}</span>
                    {mode === m && <Check size={14} />}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <button 
            type="submit" 
            className="send-btn"
            disabled={!msg.trim() || disabled}
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
};

const LandingView = ({ onSubmit }) => {
  const { user } = useAuth();
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'GOOD MORNING';
    if (hour < 18) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
  };

  const userName = user?.name || user?.username || user?.email?.split('@')[0] || 'RESEARCHER';

  return (
    <div className="landing-view">
      <div className="hero-content">
        <p className="greeting">{getGreeting()}, {userName.toUpperCase()}</p>
        <h1 className="hero-title">
          Autonomous AI Bug Bounty &<br/>
          <span className="gradient-text">Security Intelligence</span>
        </h1>
        <p className="hero-subtitle">
          Multi-Provider Brain · Real-Time Execution · Persistent Memory
        </p>

        <div className="suggestion-cards">
          <SuggestionCard 
            icon={<Target size={20} className="text-cyan" />}
            title="Scan target: example.com"
            desc="Full autonomous reconnaissance, passive DNS, endpoints, and vulnerability discovery."
            onClick={() => onSubmit('https://example.com', 'Medium')}
          />
          <SuggestionCard 
            icon={<TerminalSquare size={20} className="text-pink" />}
            title="Map attack surface"
            desc="Enumerate subdomains and probe services with multi-brain fallback."
            onClick={() => onSubmit('https://example.com', 'Infinity')}
          />
        </div>
      </div>
    </div>
  );
};

const ChatMessage = ({ role, content, time }) => {
  return (
    <div className={`chat-message ${role}`}>
      <div className="message-avatar">
        {role === 'user' ? 'You' : <Cpu size={16} className="text-cyan" />}
      </div>
      <div className="message-content">
        <p style={{ whiteSpace: 'pre-wrap' }}>{content}</p>
        {time && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>{time}</span>}
      </div>
    </div>
  );
};

// Findings Modal / Viewer Component
const FindingsModal = ({ findings, onClose, onGenerateReport }) => {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
    }}>
      <div className="animated-border-box opaque-bg" style={{ width: '100%', maxWidth: '750px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bug size={20} className="text-pink" /> Security Findings ({findings.length})
          </h3>
          <button className="icon-button" onClick={onClose}><ArrowLeft size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
          {findings.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px' }}>No validated vulnerabilities reported yet.</p>
          ) : (
            findings.map((f, i) => (
              <div key={i} style={{
                padding: '14px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border-light)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <strong style={{ fontSize: '0.95rem' }}>{f.title}</strong>
                  <span style={{
                    fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 600,
                    textTransform: 'uppercase',
                    background: f.severity === 'critical' ? 'rgba(239,68,68,0.2)' : f.severity === 'high' ? 'rgba(249,115,22,0.2)' : f.severity === 'medium' ? 'rgba(234,179,8,0.2)' : 'rgba(59,130,246,0.2)',
                    color: f.severity === 'critical' ? '#ef4444' : f.severity === 'high' ? '#f97316' : f.severity === 'medium' ? '#eab308' : '#3b82f6'
                  }}>
                    {f.severity || 'info'}
                  </span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0' }}>{f.description}</p>
                {f.affectedAsset && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Target: <code>{f.affectedAsset}</code></div>
                )}
              </div>
            ))
          )}
        </div>

        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button className="secondary-button" onClick={onClose}>Close</button>
          <button className="primary-cta" onClick={onGenerateReport} style={{ padding: '8px 16px' }}>
            <Download size={16} /> Generate & View Report
          </button>
        </div>
      </div>
    </div>
  );
};

// Report Viewer Modal Component
const ReportModal = ({ report, onClose }) => {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
    }}>
      <div className="animated-border-box opaque-bg" style={{ width: '100%', maxWidth: '850px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} className="text-cyan" /> Executive Security Report
          </h3>
          <button className="icon-button" onClick={onClose}><ArrowLeft size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--surface)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-light)', fontFamily: 'monospace', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
          {report?.markdown || report?.summary || 'Generating report summary...'}
        </div>

        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button className="secondary-button" onClick={() => {
            const blob = new Blob([report?.markdown || ''], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `security-assessment-report.md`;
            a.click();
          }}>
            <Download size={16} /> Download Markdown
          </button>
          <button className="primary-cta" onClick={onClose} style={{ padding: '8px 16px' }}>Done</button>
        </div>
      </div>
    </div>
  );
};

// Real-Time Agent View
const ChatView = ({ assessmentId, target, mode, onRestart }) => {
  const [messages, setMessages] = useState([
    { role: 'ai', content: `Autonomous Agent Initialized for ${target}.\nStarting reconnaissance sequence...`, time: new Date().toLocaleTimeString() }
  ]);
  const [events, setEvents] = useState([]);
  const [phase, setPhase] = useState('Passive Recon');
  const [status, setStatus] = useState('Initializing agent nervous system...');
  const [agentRunning, setAgentRunning] = useState(true);
  const [findings, setFindings] = useState([]);
  const [stats, setStats] = useState({ subdomains: 0, endpoints: 0, tools: 0 });
  const [showFindingsModal, setShowFindingsModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  const terminalScrollRef = useRef(null);
  const chatScrollRef = useRef(null);

  // Subscribe to Live SSE Events
  useEffect(() => {
    if (!assessmentId) return;

    const unsubscribe = subscribeToAssessmentEvents(assessmentId, {
      onEvent: (event) => {
        setEvents(prev => [...prev.slice(-100), event]);

        if (event.type === 'PHASE_CHANGED') {
          setPhase(event.data?.phase || event.message);
          setStatus(`Entering phase: ${event.data?.phase || event.message}`);
        } else if (event.type === 'AGENT_DECISION') {
          setStatus(event.message);
          if (event.data?.action?.description) {
            setMessages(prev => [...prev, {
              role: 'ai',
              content: `🧠 Brain Decision: ${event.data.action.description}`,
              time: new Date().toLocaleTimeString()
            }]);
          }
        } else if (event.type === 'TOOL_STARTED') {
          setStatus(`Executing ${event.data?.tool || 'tool'}...`);
          setStats(s => ({ ...s, tools: s.tools + 1 }));
        } else if (event.type === 'TOOL_COMPLETED') {
          if (event.data?.parsed?.subdomains?.length) {
            setStats(s => ({ ...s, subdomains: s.subdomains + event.data.parsed.subdomains.length }));
          }
          if (event.data?.parsed?.endpoints?.length) {
            setStats(s => ({ ...s, endpoints: s.endpoints + event.data.parsed.endpoints.length }));
          }
        } else if (event.type === 'FINDING_CREATED') {
          setFindings(prev => [...prev, {
            title: event.message,
            severity: event.data?.severity || 'info',
            description: event.data?.description || event.message
          }]);
        } else if (event.type === 'ASSESSMENT_COMPLETED') {
          setAgentRunning(false);
          setStatus('Investigation complete. Report ready.');
          setMessages(prev => [...prev, {
            role: 'ai',
            content: `✅ Assessment complete! Objectives satisfied for target ${target}.`,
            time: new Date().toLocaleTimeString()
          }]);
          fetchFindings();
        } else if (event.type === 'ASSESSMENT_PAUSED') {
          setAgentRunning(false);
          setStatus('Assessment paused.');
        } else if (event.type === 'ASSESSMENT_RESUMED') {
          setAgentRunning(true);
          setStatus('Assessment resumed.');
        }
      },
      onError: (err) => {
        console.warn('SSE stream notice:', err.message);
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [assessmentId, target]);

  // Auto-scroll logs
  useEffect(() => {
    if (terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [events]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchFindings = async () => {
    try {
      const res = await getAssessmentFindings(assessmentId);
      if (res?.findings) setFindings(res.findings);
    } catch (e) {
      console.warn('Could not load findings:', e.message);
    }
  };

  const handlePauseResume = async () => {
    try {
      if (agentRunning) {
        await pauseAssessment(assessmentId);
        setAgentRunning(false);
      } else {
        await resumeAssessment(assessmentId);
        setAgentRunning(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleStop = async () => {
    try {
      await stopAssessment(assessmentId);
      setAgentRunning(false);
      setStatus('Assessment stopped.');
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || sendingChat) return;

    const userText = chatInput.trim();
    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', content: userText, time: new Date().toLocaleTimeString() }]);
    setSendingChat(true);

    try {
      const res = await sendAssessmentChat(assessmentId, userText);
      if (res?.message) {
        setMessages(prev => [...prev, { role: 'ai', content: res.message, time: new Date().toLocaleTimeString() }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', content: `Error: ${err.message}`, time: new Date().toLocaleTimeString() }]);
    } finally {
      setSendingChat(false);
    }
  };

  const handleGenerateReport = async () => {
    try {
      const res = await generateReport(assessmentId);
      setReportData(res?.report || res);
      setShowReportModal(true);
    } catch (err) {
      alert(`Report error: ${err.message}`);
    }
  };

  return (
    <div className="chat-view" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top Target & Telemetry Status Bar */}
      <div className="animated-border-box opaque-bg" style={{ margin: '16px 24px 0 24px', padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe size={18} className="text-cyan" />
            <strong style={{ fontSize: '1rem' }}>{target}</strong>
          </div>
          <span style={{ fontSize: '0.8rem', padding: '3px 10px', borderRadius: '12px', background: 'var(--surface)', border: '1px solid var(--border-light)' }}>
            Phase: <strong className="text-cyan">{phase}</strong>
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Tools: <strong>{stats.tools}</strong> | Subdomains: <strong>{stats.subdomains}</strong> | Endpoints: <strong>{stats.endpoints}</strong>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button className="secondary-button" onClick={handlePauseResume} title={agentRunning ? "Pause Assessment" : "Resume Assessment"}>
            {agentRunning ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Resume</>}
          </button>
          <button className="secondary-button" onClick={handleStop} title="Stop Assessment">
            <Square size={14} /> Stop
          </button>
          <button className="secondary-button" onClick={() => { fetchFindings(); setShowFindingsModal(true); }}>
            <Bug size={14} className="text-pink" /> Findings ({findings.length})
          </button>
          <button className="primary-cta" onClick={handleGenerateReport} style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
            <FileText size={14} /> View Report
          </button>
        </div>
      </div>

      {/* Main Split: Chat Conversation + Live Execution Terminal */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', padding: '16px 24px', minHeight: 0 }}>
        {/* Left: Chat & Reasoning Stream */}
        <div className="animated-border-box opaque-bg" style={{ display: 'flex', flexDirection: 'column', padding: '16px', minHeight: 0 }}>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '6px' }} ref={chatScrollRef}>
            {messages.map((m, idx) => (
              <ChatMessage key={idx} role={m.role} content={m.content} time={m.time} />
            ))}

            {agentRunning && (
              <div className="agent-status animated-border-box opaque-bg" style={{ margin: '8px 0' }}>
                <div className="status-indicator animate-pulse"></div>
                <span style={{ fontSize: '0.85rem' }}>{status}</span>
              </div>
            )}
          </div>

          {/* Interactive Chat Form */}
          <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <input 
              type="text" 
              placeholder="Ask the AI agent a question or give an instruction..." 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="modal-input"
              style={{ flex: 1 }}
            />
            <button type="submit" className="primary-cta" disabled={!chatInput.trim() || sendingChat} style={{ padding: '0 16px' }}>
              <Send size={16} />
            </button>
          </form>
        </div>

        {/* Right: Live Autonomous Activity Terminal */}
        <div className="animated-border-box opaque-bg" style={{ display: 'flex', flexDirection: 'column', padding: '16px', minHeight: 0, background: '#0a0d14' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TerminalSquare size={14} className="text-cyan" /> LIVE AGENT NERVOUS SYSTEM
            </span>
            <span style={{ fontSize: '0.75rem', color: '#10b981' }}>● SSE CONNECTED</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.75rem', lineHeight: '1.5', color: '#cbd5e1' }} ref={terminalScrollRef}>
            {events.length === 0 ? (
              <div style={{ color: '#64748b', padding: '20px 0' }}>[+] Initializing scope and policy validator...</div>
            ) : (
              events.map((ev, i) => (
                <div key={i} style={{ marginBottom: '4px' }}>
                  <span style={{ color: '#64748b' }}>[{new Date(ev.timestamp || Date.now()).toLocaleTimeString()}]</span>{' '}
                  <span style={{
                    color: ev.type?.includes('FINDING') ? '#f43f5e' : ev.type?.includes('TOOL') ? '#38bdf8' : ev.type?.includes('DECISION') ? '#a78bfa' : '#34d399',
                    fontWeight: 600
                  }}>
                    {ev.type}:
                  </span>{' '}
                  <span>{ev.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showFindingsModal && (
        <FindingsModal 
          findings={findings} 
          onClose={() => setShowFindingsModal(false)}
          onGenerateReport={() => { setShowFindingsModal(false); handleGenerateReport(); }}
        />
      )}

      {showReportModal && (
        <ReportModal 
          report={reportData} 
          onClose={() => setShowReportModal(false)} 
        />
      )}
    </div>
  );
};

// Main Chat Route Component
const MainChat = () => {
  const [assessmentState, setAssessmentState] = useState('IDLE'); // IDLE, RUNNING
  const [assessmentId, setAssessmentId] = useState(null);
  const [target, setTarget] = useState('');
  const [mode, setMode] = useState('Medium');
  const [errorMsg, setErrorMsg] = useState('');

  const handleStart = async (targetUrl, chosenMode) => {
    setErrorMsg('');
    setTarget(targetUrl);
    setMode(chosenMode);

    try {
      const res = await createAssessment({
        targetUrl,
        mode: chosenMode,
        authorizationConfirmed: true
      });

      if (res?.assessment?.id) {
        setAssessmentId(res.assessment.id);
        setAssessmentState('RUNNING');
      } else {
        setErrorMsg('Failed to create assessment. Please check target URL.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error starting autonomous assessment.');
    }
  };

  const handleNewAssessment = () => {
    setAssessmentState('IDLE');
    setAssessmentId(null);
    setTarget('');
  };

  return (
    <>
      <div className="main-content" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
        {errorMsg && (
          <div style={{ margin: '16px 24px', padding: '12px 16px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', color: '#f87171' }}>
            {errorMsg}
          </div>
        )}

        {assessmentState === 'IDLE' ? (
          <LandingView onSubmit={handleStart} />
        ) : (
          <ChatView assessmentId={assessmentId} target={target} mode={mode} onRestart={handleNewAssessment} />
        )}
      </div>

      {assessmentState === 'IDLE' && (
        <ChatInput onSubmit={handleStart} disabled={false} />
      )}
    </>
  );
};

// Layout Component
const AppLayout = ({ children, theme, toggleTheme }) => {
  return (
    <div className="app-root">
      <Sidebar toggleTheme={toggleTheme} theme={theme} />
      
      <main className="app-main">
        <TopNav />
        
        {children}
        
        <div className="bottom-bar">
          <div className="system-status">
            <div className="status-dot"></div>
            <span>DarkMatter Autonomous Engine Online</span>
          </div>
          <div className="nav-links-small">
            <span>REASON</span> <span className="separator">/</span>
            <span>EXECUTE</span> <span className="separator">/</span>
            <span>DISCOVER</span>
          </div>
        </div>
      </main>
      
      <div className="bg-graphic"></div>
    </div>
  );
};

export default function App() {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login initialMode="signin" /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Login initialMode="signup" /></PublicRoute>} />
          
          <Route path="/*" element={
            <ProtectedRoute>
              <AppLayout theme={theme} toggleTheme={toggleTheme}>
                <Routes>
                  <Route path="/" element={<MainChat />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/billing" element={<BillingPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                </Routes>
              </AppLayout>
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
