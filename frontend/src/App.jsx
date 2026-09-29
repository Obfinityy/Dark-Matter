import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { AuthProvider, ProtectedRoute, PublicRoute, useAuth } from './auth/AuthContext';
import { Login } from './pages/Auth/Login';

import { 
  MessageSquare, Home, Clock, Settings, CreditCard, 
  User, MoreHorizontal, Globe, Paperclip, Search, 
  Send, Target, TerminalSquare, CheckCircle2, Download, Sun, Moon,
  Key, ChevronDown, Check, ArrowLeft, Play, Pause, Square, AlertTriangle,
  Shield, Bug, Cpu, Lock, LogOut, Eye, FileText, Copy, Edit2, RotateCcw
} from 'lucide-react';
import { 
  getProviders, updateProviders, updateProfile, changePassword, logoutAccount,
  createAssessment, startAssessment, pauseAssessment, resumeAssessment, stopAssessment,
  getAssessmentFindings, sendAssessmentChat, generateReport, getLatestReport,
  subscribeToAssessmentEvents, listAssessments, sendDirectChat, getInfiniteHistory
} from './services/api';
import './styles/globals.css';
import './styles/infinity.css';

const CodeBlock = ({ node, inline, className, children, ...props }) => {
  const match = /language-(\w+)/.exec(className || '');
  const codeString = String(children).replace(/\n$/, '');
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return !inline && match ? (
    <div style={{ position: 'relative', marginTop: '12px', marginBottom: '12px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div style={{ background: '#1e1e1e', padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#888', borderBottom: '1px solid #333' }}>
        <span style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>{match[1]}</span>
        <button onClick={handleCopy} style={{ background: 'none', border: 'none', color: copied ? '#10b981' : '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', transition: 'color 0.2s' }} onMouseOver={(e) => {if(!copied) e.target.style.color='#fff'}} onMouseOut={(e) => {if(!copied) e.target.style.color='#888'}}>
          {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied!' : 'Copy code'}
        </button>
      </div>
      <SyntaxHighlighter
        {...props}
        children={codeString}
        style={vscDarkPlus}
        language={match[1]}
        PreTag="div"
        customStyle={{ margin: 0, borderRadius: '0 0 8px 8px', background: '#1e1e1e', fontSize: '0.9rem' }}
      />
    </div>
  ) : (
    <code {...props} className={className} style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace', color: '#e2e8f0' }}>
      {children}
    </code>
  );
};

// Custom Logo Component
const Logo = ({ theme }) => (
  <div className="logo-container">
    <img src={theme === 'dark' ? '/dark-logo.png' : '/light-logo.png'} className="logo-icon" alt="" onError={(e) => { e.target.style.display = 'none'; }} />
    <span className="logo-text">DARKMATTER</span>
  </div>
);

// --- Billing Page ---
const BillingPage = () => {
  const navigate = useNavigate();
  const plans = [
    { name: "Basic", price: "$0/mo", desc: "Basic reconnaissance." },
    { name: "Intermediate", price: "$49/mo", desc: "Advanced scanning and reporting." },
    { name: "Medium", price: "$99/mo", desc: "Priority support and more targets." },
    { name: "High", price: "$299/mo", desc: "Enterprise API limits and workflows." },
    { name: "Infinity", price: "$499/mo", desc: "Limitless potential. Contact sales." }
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

const INFINITE_SESSIONS_KEY = 'infinite_chat_sessions';
const INFINITE_ACTIVE_KEY = 'infinite_chat_active_id';
const INFINITE_CHAT_EVENT = 'infinite-chat-updated';
const NEW_CHAT_PULL_THRESHOLD = 110;

const createInfiniteChatId = () => 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

const readInfiniteSessions = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(INFINITE_SESSIONS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const emitInfiniteChatUpdate = (activeId) => {
  window.dispatchEvent(new CustomEvent(INFINITE_CHAT_EVENT, { detail: { activeId } }));
};

const setActiveInfiniteChat = (id) => {
  localStorage.setItem(INFINITE_ACTIVE_KEY, id);
  emitInfiniteChatUpdate(id);
};

const upsertInfiniteSession = (id, title) => {
  if (!id) return;
  const sessions = readInfiniteSessions();
  const existing = sessions.find((s) => s.id === id);
  const keepTitle = existing?.title && existing.title !== 'New chat';
  const nextTitle = keepTitle ? existing.title : (title || 'New chat').trim().slice(0, 72);
  const next = [
    { id, title: nextTitle || 'New chat', updatedAt: Date.now() },
    ...sessions.filter((s) => s.id !== id),
  ];
  localStorage.setItem(INFINITE_SESSIONS_KEY, JSON.stringify(next));
  emitInfiniteChatUpdate(id);
};

// --- Sidebar ---
const Sidebar = ({ toggleTheme, theme }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isInfinite = location.pathname === '/infinite';
  const [chatSessions, setChatSessions] = useState(() => readInfiniteSessions());
  const [activeChatId, setActiveChatId] = useState(() => localStorage.getItem(INFINITE_ACTIVE_KEY));

  useEffect(() => {
    const sync = () => {
      setChatSessions(readInfiniteSessions());
      setActiveChatId(localStorage.getItem(INFINITE_ACTIVE_KEY));
    };
    window.addEventListener(INFINITE_CHAT_EVENT, sync);
    return () => window.removeEventListener(INFINITE_CHAT_EVENT, sync);
  }, []);

  const openChatSession = (id) => {
    setActiveInfiniteChat(id);
    if (!isInfinite) navigate('/infinite');
  };
  
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Logo theme={theme} />
      </div>
      
      <div className="sidebar-content">
        <nav className="nav-menu">
          <button className={`nav-item ${!isInfinite ? 'active' : ''}`} onClick={() => navigate('/')}>
            <Home size={18} />
            <span>Autonomous Recon</span>
          </button>

          <button className={`nav-item ${isInfinite ? 'active' : ''}`} onClick={() => navigate('/infinite')}>
            <MessageSquare size={18} />
            <span>Chat</span>
          </button>

          <div style={{ marginTop: '24px', marginBottom: '8px', paddingLeft: '12px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            System
          </div>
          
          <button className="nav-item">
            <Cpu size={18} />
            <span>Plugins</span>
          </button>
          
          <button className="nav-item">
            <FileText size={18} />
            <span>Libraries</span>
          </button>

          <div style={{ marginTop: '24px', marginBottom: '8px', paddingLeft: '12px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            History
          </div>
          
          {chatSessions.length === 0 ? (
            <div style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <span style={{ opacity: 0.7 }}>No previous chats found.</span>
            </div>
          ) : (
            <div className="infinite-history-list">
              {chatSessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  className={`history-item infinite-history-item ${session.id === activeChatId ? 'active' : ''}`}
                  onClick={() => openChatSession(session.id)}
                  title={session.title}
                >
                  {session.title}
                </button>
              ))}
            </div>
          )}
        </nav>
      </div>

      <div className="sidebar-footer">
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
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <header className="top-nav">
      <div className="nav-links">
        <a onClick={() => navigate('/')} className={location.pathname === '/' ? 'active' : ''} style={{cursor: 'pointer'}}>AUTONOMOUS BRAIN</a>
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

const Typewriter = ({ text, delay = 15 }) => {
  const [currentText, setCurrentText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // When text completely changes (new message), reset
    if (!text.startsWith(currentText)) {
      setCurrentText('');
      setCurrentIndex(0);
    }
  }, [text]);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setCurrentText(prevText => prevText + text[currentIndex]);
        setCurrentIndex(prevIndex => prevIndex + 1);
      }, delay);
      
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, delay, text]);

  return (
    <div className="markdown-body" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
      <ReactMarkdown components={{ code: CodeBlock }}>{currentText}</ReactMarkdown>
    </div>
  );
};

const InfiniteChat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [pullHint, setPullHint] = useState(0);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const conversationIdRef = useRef(null);
  const pullRef = useRef(0);
  const touchStartYRef = useRef(0);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [longOp, setLongOp] = useState({ active: false, label: '', detail: '' });
  const [editValue, setEditValue] = useState('');

  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleEdit = (text, index) => {
    setEditValue(text);
    setEditingIndex(index);
  };

  const handleRetry = (index) => {
    let lastUserMsg = '';
    for (let i = index - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserMsg = messages[i].content;
        break;
      }
    }
    if (lastUserMsg) {
      handleSend(null, lastUserMsg);
    }
  };

  // Global Auto-focus
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (document.activeElement === inputRef.current || document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const loadConversation = async (activeId) => {
    conversationIdRef.current = activeId;
    setConversationId(activeId);
    setMessages([]);
    setPullHint(0);
    pullRef.current = 0;
    try {
      const res = await getInfiniteHistory(activeId);
      if (conversationIdRef.current !== activeId) return;
      if (res?.chat?.messages) {
        const mapped = res.chat.messages.map(m => ({ ...m, isHistory: true }));
        setMessages(mapped);
      }
    } catch (err) {
      console.error("Failed to load chat history", err);
    }
  };

  const handleNewChat = () => {
    const activeId = createInfiniteChatId();
    conversationIdRef.current = activeId;
    setActiveInfiniteChat(activeId);
    setConversationId(activeId);
    setMessages([]);
    setInput('');
    setEditingIndex(null);
    setPullHint(0);
    pullRef.current = 0;
  };

  // Initialize or load conversation
  useEffect(() => {
    let activeId = localStorage.getItem(INFINITE_ACTIVE_KEY);
    if (!activeId) {
      activeId = createInfiniteChatId();
      setActiveInfiniteChat(activeId);
    }
    loadConversation(activeId);

    const onChatUpdate = (event) => {
      const nextId = event.detail?.activeId || localStorage.getItem(INFINITE_ACTIVE_KEY);
      if (!nextId || nextId === conversationIdRef.current) return;
      loadConversation(nextId);
    };
    window.addEventListener(INFINITE_CHAT_EVENT, onChatUpdate);
    return () => window.removeEventListener(INFINITE_CHAT_EVENT, onChatUpdate);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (pullHint > 0) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, pullHint]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const applyPull = (delta) => {
      pullRef.current = Math.min(180, Math.max(0, pullRef.current + delta));
      setPullHint(pullRef.current);
      if (pullRef.current >= NEW_CHAT_PULL_THRESHOLD) {
        pullRef.current = 0;
        setPullHint(0);
        handleNewChat();
        return true;
      }
      return false;
    };

    const onWheel = (e) => {
      if (messages.length === 0 || loading) return;
      if (el.scrollTop <= 0 && e.deltaY < 0) {
        e.preventDefault();
        applyPull(Math.abs(e.deltaY) * 0.35);
      } else if (e.deltaY > 0 && pullRef.current > 0) {
        applyPull(-e.deltaY);
      }
    };

    const onTouchStart = (e) => {
      touchStartYRef.current = e.touches[0]?.clientY || 0;
    };

    const onTouchMove = (e) => {
      if (messages.length === 0 || loading) return;
      const y = e.touches[0]?.clientY || 0;
      const dy = y - touchStartYRef.current;
      if (el.scrollTop <= 0 && dy > 0) {
        e.preventDefault();
        applyPull(dy * 0.25);
        touchStartYRef.current = y;
      }
    };

    const onTouchEnd = () => {
      if (pullRef.current < NEW_CHAT_PULL_THRESHOLD) {
        pullRef.current = 0;
        setPullHint(0);
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [messages.length, loading]);

  const handleSend = async (e, overrideMsg = null, truncateIndex = undefined) => {
    e?.preventDefault();
    if (loading) return;
    const msgToSend = overrideMsg || input.trim();
    if (!msgToSend || !conversationId) return;
    upsertInfiniteSession(conversationId, msgToSend);
    
    if (truncateIndex !== undefined) {
      setMessages(prev => [...prev.slice(0, truncateIndex), { role: 'user', content: msgToSend }]);
      setEditingIndex(null);
    } else {
      setMessages(prev => [...prev, { role: 'user', content: msgToSend }]);
    }

    if (!overrideMsg) setInput('');
    setLoading(true);

    // Long-context progress: large inputs show a processing status instead of a frozen UI.
    const isLarge = msgToSend.length > 8000;
    if (isLarge) {
      setLongOp({ active: true, label: 'Processing large context…', detail: 'Chunking and indexing your input' });
      const ticker = setInterval(() => {
        setLongOp(prev => prev.active ? { ...prev, detail: prev.detail === 'Chunking and indexing your input' ? 'Building hierarchical summary' : prev.detail === 'Building hierarchical summary' ? 'Preparing retrieval index' : prev.detail } : prev);
      }, 2500);
      window.__lcTicker = ticker;
    }

    try {
      const res = await sendDirectChat(msgToSend, conversationId, truncateIndex);
      if (res?.chat?.messages) {
        const mapped = res.chat.messages.map(m => ({ ...m, isHistory: true }));
        setMessages(mapped);
      } else if (res?.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: res.reply }]);
      }
      // Surface long-context metadata quietly under the reply.
      if (res?.longContext?.ingested) {
        const { inputId, chunkCount } = res.longContext.ingested;
        setMessages(prev => [...prev, { role: 'assistant', content: `📦 Large input stored: **${chunkCount} chunks** indexed as \\'${inputId}\\'. You can ask things like "summarize this", "find every occurrence of X", or "show exact chunk 3".`, isHistory: false, isMeta: true }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: err.message || 'An unknown error occurred.', isError: true }]);
    } finally {
      if (window.__lcTicker) { clearInterval(window.__lcTicker); window.__lcTicker = null; }
      setLongOp({ active: false, label: '', detail: '' });
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (loading) return;
      handleSend();
    }
  };

  return (
    <div className="main-content" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', background: 'var(--bg-primary)', borderRadius: '12px', overflow: 'hidden' }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overscrollBehavior: 'contain' }}>
        <div className={`infinite-pull-hint ${pullHint > 24 ? 'visible' : ''}`}>
          New chat
        </div>
        {messages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{ padding: '24px', background: 'var(--surface-color)', borderRadius: '50%', border: '1px solid var(--border-color)' }}>
              <MessageSquare size={48} className="text-cyan" />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 500, margin: 0, color: 'var(--text-primary)' }}>Welcome to Infinite</h2>
            <p style={{ fontSize: '0.95rem', maxWidth: '300px', lineHeight: '1.5' }}>Start typing and let the AI assist you instantly.</p>
          </div>
        ) : (
          messages.map((m, i) => {
            if (m.role === 'system') return null; // Hide system message from UI
            const isUser = m.role === 'user';
            return (
              <div key={i} style={{
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ 
                  background: isUser ? 'var(--accent)' : m.isError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.08)',
                  color: isUser ? '#fff' : m.isError ? '#ef4444' : 'var(--text-primary)',
                  padding: '14px 18px',
                  borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  border: isUser ? 'none' : m.isError ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.1)',
                  lineHeight: '1.6',
                  fontSize: '0.95rem'
                }}>
                  {isUser ? (
                    editingIndex === i ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '300px' }}>
                        <textarea 
                          value={editValue} 
                          onChange={e => setEditValue(e.target.value)} 
                          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '12px', borderRadius: '8px', minHeight: '80px', fontFamily: 'inherit', resize: 'vertical' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <button onClick={() => setEditingIndex(null)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>Cancel</button>
                          <button onClick={() => handleSend(null, editValue, i)} style={{ background: '#fff', border: 'none', color: 'var(--accent)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Save & Submit</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                    )
                  ) : (
                    <div className="markdown-body" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                      {(!m.isHistory && i === messages.length - 1) ? <Typewriter text={m.content} delay={10} /> : <ReactMarkdown components={{ code: CodeBlock }}>{m.content}</ReactMarkdown>}
                    </div>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  padding: '0 4px',
                  opacity: 0.7
                }}>
                  {copiedIndex === i ? (
                    <button style={{ background: 'none', border: 'none', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
                      <Check size={12} /> Copied
                    </button>
                  ) : (
                    <button onClick={() => handleCopy(m.content, i)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', transition: 'color 0.2s' }} onMouseOver={(e) => e.target.style.color='var(--text-primary)'} onMouseOut={(e) => e.target.style.color='var(--text-muted)'} title="Copy">
                      <Copy size={12} /> Copy
                    </button>
                  )}
                  
                  {isUser ? (
                    <button onClick={() => handleEdit(m.content, i)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', transition: 'color 0.2s' }} onMouseOver={(e) => e.target.style.color='var(--text-primary)'} onMouseOut={(e) => e.target.style.color='var(--text-muted)'} title="Edit">
                      <Edit2 size={12} /> Edit
                    </button>
                  ) : (
                    <button onClick={() => handleRetry(i)} disabled={loading} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', opacity: loading ? 0.5 : 1, transition: 'color 0.2s' }} onMouseOver={(e) => {if(!loading) e.target.style.color='var(--text-primary)'}} onMouseOut={(e) => e.target.style.color='var(--text-muted)'} title="Retry">
                      <RotateCcw size={12} /> Retry
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        {loading && (
          <div style={{ alignSelf: 'flex-start', background: 'rgba(255, 255, 255, 0.05)', padding: '12px 20px', borderRadius: '16px 16px 16px 4px', color: 'var(--text-muted)', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', gap: '8px', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                {longOp.active ? longOp.label : 'AI is thinking'}
              </span>
              <div className="typing-dot" style={{ animationDelay: '0s' }}>.</div>
              <div className="typing-dot" style={{ animationDelay: '0.2s' }}>.</div>
              <div className="typing-dot" style={{ animationDelay: '0.4s' }}>.</div>
            </div>
            {longOp.active && longOp.detail && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {longOp.detail} — input is safely chunked & indexed, not sent whole to the model
              </span>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div style={{ padding: '20px 24px', background: 'var(--surface-color)', borderTop: '1px solid var(--border-color)' }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
          <textarea 
            ref={inputRef}
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            onKeyDown={handleKeyDown}
            placeholder="Type your message..." 
            style={{ flex: 1, minHeight: '50px', maxHeight: '150px', padding: '14px 18px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.2)', background: 'rgba(0, 0, 0, 0.2)', color: 'var(--text-primary)', resize: 'none', fontFamily: 'inherit', fontSize: '0.95rem', lineHeight: '1.5', outline: 'none', transition: 'all 0.2s' }}
            onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; e.target.style.background = 'rgba(0,0,0,0.3)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)'; e.target.style.background = 'rgba(0,0,0,0.2)'; }}
          />
          <button type="submit" className="primary-cta" disabled={loading || !input.trim()} style={{ height: '50px', width: '50px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', background: 'var(--accent)', border: 'none', cursor: (!input.trim() || loading) ? 'not-allowed' : 'pointer', opacity: (!input.trim() || loading) ? 0.5 : 1 }}>
            <Send size={18} style={{ color: '#fff', marginLeft: '2px' }} />
          </button>
        </form>
      </div>
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
  const location = useLocation();

  useEffect(() => {
    if (location.state?.reset) {
      setAssessmentState('IDLE');
      setAssessmentId(null);
      setTarget('');
    }
  }, [location.state?.reset]);

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
                  <Route path="/infinite" element={<InfiniteChat />} />
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
