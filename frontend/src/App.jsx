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
  subscribeToAssessmentEvents, listAssessments, sendDirectChat, streamDirectChat, getInfiniteHistory,
  getComputerStatus, cancelComputerTask, answerComputerTask, subscribeToComputerTaskEvents,
  listComputerTasks,
  apiClient
} from './services/api';
import { getBackendMode, setBackendMode, getVercelBackendUrl, setVercelBackendUrl, testBackendConnection, BACKEND_MODES } from './services/backendMode';
import './styles/globals.css';
import './styles/infinity.css';
import './styles/agent.css';
import './styles/polish-pass-payloads-queues-schedules.css';
import './styles/polish-pass-alerts-account-premium.css';
import './styles/polish-pass-coverage-posture-fingerprint.css';
import './styles/polish-pass-surfacemap-diary-terminal.css';
import { AgentConsole } from './pages/agent/AgentConsole';

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

// --- Settings Page: backend connection mode (Localhost vs Vercel) ---
const SettingsPage = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState(getBackendMode());
  const [vercelUrl, setVercelUrl] = useState(getVercelBackendUrl());
  const [testState, setTestState] = useState({ status: 'idle', message: '' });

  const pickMode = (next) => {
    const applied = setBackendMode(next);
    setMode(applied);
    setTestState({ status: 'idle', message: '' });
  };

  const saveVercelUrl = () => {
    const clean = setVercelBackendUrl(vercelUrl);
    setVercelUrl(clean);
    setTestState({ status: 'idle', message: clean ? 'Vercel backend URL saved.' : 'Vercel backend URL cleared.' });
  };

  const runTest = async () => {
    setTestState({ status: 'testing', message: 'Checking connection…' });
    const result = await testBackendConnection();
    setTestState({ status: result.ok ? 'ok' : 'error', message: result.message });
  };

  const isVercel = mode === BACKEND_MODES.VERCEL;

  return (
    <div className="dedicated-page">
      <div className="page-header">
        <button className="icon-button" onClick={() => navigate('/')}><ArrowLeft size={20} /></button>
        <h2>Settings</h2>
      </div>
      <div className="page-content transparent-bg" style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '640px' }}>
        <div className="animated-border-box opaque-bg" style={{ padding: '20px', borderRadius: '12px' }}>
          <h3 style={{ margin: '0 0 6px' }}>Backend Connection</h3>
          <p style={{ margin: '0 0 16px', opacity: 0.7, fontSize: '14px' }}>
            Choose where the app talks to. Switch anytime — it applies instantly, no reload needed.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={() => pickMode(BACKEND_MODES.LOCALHOST)}
              className={`secondary-button ${!isVercel ? 'active' : ''}`}
              style={{ textAlign: 'left', padding: '14px 16px', border: !isVercel ? '2px solid var(--accent, #7c3aed)' : undefined }}
            >
              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>{!isVercel ? '🔘' : '⚪'}</span> Localhost
                {!isVercel && <span className="pro-badge" style={{ marginLeft: 'auto' }}>ACTIVE</span>}
              </div>
              <div style={{ fontSize: '13px', opacity: 0.7, marginTop: '4px' }}>
                Backend on your own machine (http://localhost:4000). Full power: autonomous hunts, local model runner, computer control.
              </div>
            </button>

            <button
              onClick={() => pickMode(BACKEND_MODES.VERCEL)}
              className={`secondary-button ${isVercel ? 'active' : ''}`}
              style={{ textAlign: 'left', padding: '14px 16px', border: isVercel ? '2px solid var(--accent, #7c3aed)' : undefined }}
            >
              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>{isVercel ? '🔘' : '⚪'}</span> Vercel
                {isVercel && <span className="pro-badge" style={{ marginLeft: 'auto' }}>ACTIVE</span>}
              </div>
              <div style={{ fontSize: '13px', opacity: 0.7, marginTop: '4px' }}>
                Backend deployed on Vercel. Works for the stateless API — long hunts and the local model always need Localhost mode.
              </div>
            </button>
          </div>

          {isVercel && (
            <div style={{ marginTop: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Vercel backend URL
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="url"
                  value={vercelUrl}
                  onChange={(e) => setVercelUrl(e.target.value)}
                  placeholder="https://your-backend.vercel.app"
                  className="text-input"
                  style={{ flex: 1 }}
                />
                <button className="secondary-button" onClick={saveVercelUrl}>Save</button>
              </div>
              <div style={{ fontSize: '12px', opacity: 0.6, marginTop: '6px' }}>
                The public URL of your deployed backend (without /api/v1 at the end).
              </div>
            </div>
          )}

          <div style={{ marginTop: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="secondary-button" onClick={runTest} disabled={testState.status === 'testing'}>
              {testState.status === 'testing' ? 'Testing…' : 'Test Connection'}
            </button>
            {testState.message && (
              <span style={{
                fontSize: '13px',
                color: testState.status === 'ok' ? 'var(--success, #22c55e)' : testState.status === 'error' ? 'var(--danger, #ef4444)' : 'inherit'
              }}>
                {testState.status === 'ok' ? '✅ ' : testState.status === 'error' ? '❌ ' : ''}{testState.message}
              </span>
            )}
          </div>
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
  const isAgent = location.pathname === '/' || location.pathname === '/agent';
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
          <button className={`nav-item ${isAgent ? 'active' : ''}`} onClick={() => navigate('/')}>
            <Bug size={18} />
            <span>Autonomous Bug Bounty Agent</span>
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
        <button className={`nav-item ${location.pathname === '/settings' ? 'active' : ''}`} onClick={() => navigate('/settings')}>
          <Settings size={18} />
          <span>Settings</span>
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
      <div className="nav-links">        <a onClick={() => navigate('/')} className={location.pathname === '/' || location.pathname === '/agent' ? 'active' : ''} style={{cursor: 'pointer'}}>AUTONOMOUS BUG BOUNTY AGENT</a>
        <a onClick={() => navigate('/infinite')} className={location.pathname === '/infinite' ? 'active' : ''} style={{cursor: 'pointer'}}>CHAT</a>
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

const Typewriter = ({ text, delay = 12 }) => {
  const [displayedLength, setDisplayedLength] = useState(0);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    setDisplayedLength(0);
    setIsDone(false);
  }, [text]);

  useEffect(() => {
    if (displayedLength >= (text || '').length) {
      setIsDone(true);
      return;
    }

    const strLen = (text || '').length;
    // Adaptively scale typing step size: short text = 1 char, long text = 3-8 chars per tick
    const step = Math.max(1, Math.min(8, Math.ceil((strLen - displayedLength) / 25)));

    const timer = setTimeout(() => {
      setDisplayedLength(prev => Math.min(strLen, prev + step));
    }, delay);

    return () => clearTimeout(timer);
  }, [displayedLength, text, delay]);

  const currentText = (text || '').slice(0, displayedLength);

  return (
    <div 
      className="markdown-body" 
      onClick={() => { setDisplayedLength((text || '').length); setIsDone(true); }}
      style={{ overflowWrap: 'break-word', wordBreak: 'break-word', cursor: isDone ? 'default' : 'pointer' }}
      title={isDone ? '' : 'Click to skip typing animation'}
    >
      <ReactMarkdown components={{ code: CodeBlock }}>{currentText}</ReactMarkdown>
      {!isDone && (
        <span 
          style={{
            display: 'inline-block',
            width: '7px',
            height: '14px',
            backgroundColor: 'var(--accent, #a855f7)',
            marginLeft: '4px',
            verticalAlign: 'middle',
            borderRadius: '2px',
            opacity: 0.85
          }}
        />
      )}
    </div>
  );
};


function formatThinkingTime(totalSec) {
  const sec = Number(totalSec) || 0;
  if (sec <= 0) return '0.0s';
  if (sec < 60) {
    return `${sec.toFixed(1)}s`;
  }
  const mins = Math.floor(sec / 60);
  const remainderSecs = Math.floor(sec % 60);
  return `${mins} min ${remainderSecs}s`;
}

function getDynamicThinkingSteps(msgToSend = '', elapsed = 0) {
  const text = String(msgToSend || '').toLowerCase();
  
  let steps = [];
  if (/\b(code|python|pygame|js|react|html|css|game|function|class|build|create|script)\b/i.test(text)) {
    steps = [
      'Analyzing requirements & code structure…',
      'Structuring functions, classes & logic modules…',
      'Assembling language syntax & code components…',
      'Generating complete code implementation via Phone AI…'
    ];
  } else if (/\b(search|find|explain|what|how|why|summary|summarize|document|file|chunk|pdf)\b/i.test(text)) {
    steps = [
      'Parsing query intent & context scope…',
      'Searching vector memory & indexing references…',
      'Evaluating context budget & prompt assembly…',
      'Synthesizing explanation via Phone AI…'
    ];
  } else if (/\b(open|click|launch|type|notepad|desktop|window|app|browser|cmd|terminal|run)\b/i.test(text)) {
    steps = [
      'Interpreting desktop action instruction…',
      'Probing computer control capabilities & active window…',
      'Formulating desktop interaction plan…',
      'Executing action sequence via local Gemma…'
    ];
  } else if (/\b(target|scan|nmap|subdomain|vuln|security|exploit|recon|port|attack)\b/i.test(text)) {
    steps = [
      'Checking target scope & security policy…',
      'Correlating attack surface data & stored findings…',
      'Evaluating reconnaissance parameters…',
      'Generating security report via Phone AI…'
    ];
  } else {
    steps = [
      'Analyzing prompt intention & conversation history…',
      'Retrieving relevant knowledge context…',
      'Formulating response strategy…',
      'Generating reply via Phone AI…'
    ];
  }

  if (elapsed < 1.2) return steps[0];
  if (elapsed < 3.2) return steps[1];
  if (elapsed < 5.8) return steps[2];
  return steps[3];
}

const ThoughtBlock = ({ thinkingTimeMs, steps, budgetUsage }) => {
  const [expanded, setExpanded] = useState(false);
  if (!thinkingTimeMs) return null;
  const timeStr = formatThinkingTime(thinkingTimeMs / 1000);

  return (
    <div style={{ marginBottom: '8px', fontSize: '0.8rem' }}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          padding: '4px 10px',
          color: 'var(--text-muted, #94a3b8)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.78rem',
          transition: 'all 0.2s ease'
        }}
      >
        <span style={{ display: 'inline-block', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', fontSize: '0.65rem' }}>▶</span>
        <span>Thought for {timeStr}</span>
      </button>

      {expanded && (
        <div style={{
          marginTop: '6px',
          padding: '10px 14px',
          background: 'rgba(0, 0, 0, 0.25)',
          borderLeft: '2px solid var(--accent, #a855f7)',
          borderRadius: '0 8px 8px 0',
          color: 'var(--text-muted, #cbd5e1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          fontFamily: 'monospace',
          fontSize: '0.75rem'
        }}>
          {steps && steps.length > 0 ? (
            steps.map((st, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span>✓ {st.label}</span>
                <span style={{ opacity: 0.6 }}>{st.durationMs}ms</span>
              </div>
            ))
          ) : (
            <div>✓ Synthesized response via Phone AI</div>
          )}
          {budgetUsage && (
            <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px dashed rgba(255,255,255,0.1)', opacity: 0.8 }}>
              Context budget: {budgetUsage.estimatedPromptTokens || 0} tokens used
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── InfiniteChat Computer Task Panel (local brain + real Windows hands) ───
// Renders the live status of a computer task: status card (Computer / Brain /
// Application / Status / Current Action / Last Observation) + a checkmark
// activity feed fed by the backend SSE stream. Data survives browser refresh:
// on mount the full state + event history is fetched, then live events attach.
const TASK_ICONS = {
  agent: '🧠', action: '🖥', observation: '👁', brain: '⚠️', error: '❌',
  wait: '⏳', ask: '❓', complete: '✅', cancel: '🛑', retry: '🔁', verify: '🔎', info: '•'
};

const STATUS_COLORS = {
  queued: '#94a3b8', understanding: '#818cf8', planning: '#818cf8',
  executing: '#a855f7', observing: '#06b6d4', verifying: '#f59e0b',
  continue: '#a855f7', ask_user: '#f59e0b', waiting_ai: '#f59e0b',
  waiting_computer: '#f59e0b', paused: '#94a3b8', resuming: '#818cf8',
  completed: '#10b981', failed: '#ef4444', cancelled: '#94a3b8'
};

const ComputerTaskPanel = ({ taskId, onAnswer }) => {
  const [state, setState] = useState(null);
  const [events, setEvents] = useState([]);
  const [computer, setComputer] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [stopping, setStopping] = useState(false);
  const feedRef = useRef(null);

  // Load persisted state + event history, then attach the live SSE stream.
  useEffect(() => {
    if (!taskId) return undefined;
    let unsubscribe = null;
    let alive = true;

    const load = async () => {
      try {
        const snap = await apiClient.getComputerTask(taskId);
        if (!alive) return;
        setState(snap.task);
        setComputer(snap.computer);
        setEvents((snap.activity || []).slice(-100));
      } catch {
        /* task may have been cleaned up */
      }
    };
    load();

    unsubscribe = subscribeToComputerTaskEvents(taskId, {
      onEvent: (event) => {
        if (!alive) return;
        if (event.type === 'task.completed' || event.type === 'task.failed' || event.type === 'task.cancelled' || event.type === 'task.ask_user' || event.type === 'task.waiting_ai' || event.type === 'task.resumed') {
          load(); // pull the full persisted snapshot on meaningful transitions
        }
        if (event.type?.startsWith('computer.')) return; // adapter noise; activity feed already covers it
        setEvents((prev) => {
          const next = [...prev, {
            id: event.id,
            kind: eventKindFor(event.type),
            icon: TASK_ICONS[eventKindFor(event.type)] || '•',
            message: event.message,
            at: event.timestamp || new Date().toISOString()
          }];
          return next.slice(-120);
        });
      }
    });

    const statusTimer = setInterval(load, 10000); // passive refresh fallback
    return () => {
      alive = false;
      clearInterval(statusTimer);
      unsubscribe?.();
    };
  }, [taskId]);

  // Auto-scroll the activity feed.
  useEffect(() => {
    feedRef.current?.scrollTo?.({ top: feedRef.current.scrollHeight });
  }, [events]);

  const handleStop = async () => {
    setStopping(true);
    try {
      await cancelComputerTask(taskId);
    } finally {
      setStopping(false);
    }
  };

  const handleAnswer = async (e) => {
    e.preventDefault();
    const text = answerText.trim();
    if (!text) return;
    setAnswerText('');
    onAnswer?.(text);
    try {
      await answerComputerTask(taskId, text);
    } catch {
      /* surfaced via task state */
    }
  };

  if (!state) {
    return (
      <div style={{ alignSelf: 'flex-start', background: 'rgba(34, 211, 238, 0.05)', border: '1px solid rgba(34, 211, 238, 0.2)', borderRadius: '14px', padding: '14px 18px', minWidth: '300px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        ⚡ Connecting to computer task…
      </div>
    );
  }

  const statusColor = STATUS_COLORS[state.status] || '#94a3b8';
  const isTerminal = ['completed', 'failed', 'cancelled'].includes(state.status);
  const active = !isTerminal && state.status !== 'ask_user';

  return (
    <div style={{
      alignSelf: 'flex-start', width: 'min(640px, 92%)',
      background: 'linear-gradient(180deg, rgba(34, 211, 238, 0.05), rgba(168, 85, 247, 0.04))',
      border: '1px solid rgba(34, 211, 238, 0.25)', borderRadius: '14px',
      overflow: 'hidden', fontSize: '0.85rem'
    }}>
      {/* Status card */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(34, 211, 238, 0.15)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--text-primary)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColor, boxShadow: `0 0 8px ${statusColor}`, animation: active ? 'pulse 1.6s infinite' : 'none' }} />
            Computer Task
            <span style={{ color: statusColor, fontWeight: 500 }}>
              {state.status === 'waiting_ai' ? 'Waiting for Local AI' :
               state.status === 'waiting_computer' ? 'Waiting for Computer' :
               state.status === 'ask_user' ? 'Needs your answer' :
               state.status === 'continue' ? 'Executing' : state.status}
            </span>
          </div>
          {active && (
            <button onClick={handleStop} disabled={stopping} title="Stop this computer task at the next safe point"
              style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', padding: '4px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600 }}>
              <Square size={11} /> {stopping ? 'Stopping…' : 'Stop Task'}
            </button>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '4px 16px', color: 'var(--text-muted)' }}>
          <span>🖥 Computer: <b style={{ color: computer?.available ? '#10b981' : '#ef4444' }}>{computer?.available ? 'Connected' : 'Unavailable'}</b></span>
          <span>🧠 Brain: <b style={{ color: '#a855f7' }}>Local Gemma</b>{state.waitingReason ? ' ⏳' : ''}</span>
          {state.currentApplication && <span>📦 App: <b style={{ color: 'var(--text-primary)' }}>{state.currentApplication}</b></span>}
          {state.activeWindow && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🪟 {state.activeWindow}</span>}
          <span>👣 Steps: <b style={{ color: 'var(--text-primary)' }}>{state.stepCount}</b></span>
          {state.verificationStatus === 'verified' && <span style={{ color: '#10b981' }}>✓ Verified</span>}
        </div>
        {state.waitingReason && (
          <div style={{ color: '#f59e0b', fontSize: '0.78rem' }}>⏳ {state.waitingReason}</div>
        )}
      </div>

      {/* Checkmark activity feed */}
      <div ref={feedRef} style={{ maxHeight: '220px', overflowY: 'auto', padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {events.map((item, i) => (
          <div key={item.id || i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', color: item.kind === 'error' ? '#ef4444' : item.kind === 'complete' ? '#10b981' : 'var(--text-muted)' }}>
            <span style={{ flexShrink: 0 }}>{item.icon || TASK_ICONS[item.kind] || '•'}</span>
            <span style={{ lineHeight: 1.45 }}>{item.message}</span>
          </div>
        ))}
      </div>

      {/* ask_user answer box */}
      {state.status === 'ask_user' && (
        <form onSubmit={handleAnswer} style={{ padding: '10px 16px', borderTop: '1px solid rgba(34, 211, 238, 0.15)', display: 'flex', gap: '8px' }}>
          <input value={answerText} onChange={(e) => setAnswerText(e.target.value)} placeholder="Type your answer…"
            style={{ flex: 1, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem', outline: 'none' }} />
          <button type="submit" className="primary-cta" style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
            Answer
          </button>
        </form>
      )}
    </div>
  );
};

function eventKindFor(eventType) {
  if (eventType === 'task.completed') return 'complete';
  if (eventType === 'task.failed' || eventType === 'task.action_failed') return 'error';
  if (eventType === 'task.cancelled') return 'cancel';
  if (eventType === 'task.ask_user') return 'ask';
  if (eventType === 'task.waiting_ai' || eventType === 'task.waiting_computer') return 'wait';
  if (eventType === 'task.resumed') return 'agent';
  if (eventType === 'task.observation') return 'observation';
  if (eventType === 'task.decision' || eventType === 'task.started' || eventType === 'task.created') return 'agent';
  if (eventType === 'task.action_started') return 'action';
  return 'info';
}

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
  const lastPromptRef = useRef('');
  const pullRef = useRef(0);
  const touchStartYRef = useRef(0);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [longOp, setLongOp] = useState({ active: false, label: '', detail: '' });
  const [editValue, setEditValue] = useState('');
  const [thinkingSeconds, setThinkingSeconds] = useState(0);
  const [thinkingStep, setThinkingStep] = useState('Analyzing prompt & intention…');
  const [computerTaskId, setComputerTaskId] = useState(null);
  const [computerStatus, setComputerStatus] = useState(null);

  // Live stopwatch timer during loading
  useEffect(() => {
    let interval = null;
    let startTime = Date.now();
    if (loading) {
      setThinkingSeconds(0);
      setThinkingStep(getDynamicThinkingSteps(lastPromptRef.current, 0));
      interval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        setThinkingSeconds(elapsed);
        setThinkingStep(getDynamicThinkingSteps(lastPromptRef.current, elapsed));
      }, 100);
    } else {
      setThinkingSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loading]);

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

  // Restore any active computer task for this conversation + hands status.
  // Survives browser refresh: the task lives in the backend, not in React (#25).
  useEffect(() => {
    if (!conversationId) return undefined;
    let alive = true;
    (async () => {
      try {
        const res = await listComputerTasks(conversationId);
        if (!alive) return;
        const activeTask = (res?.tasks || []).find((t) => !['completed', 'failed', 'cancelled'].includes(t.status));
        setComputerTaskId(activeTask ? activeTask.id : null);
      } catch {
        /* computer tasks optional */
      }
    })();
    getComputerStatus().then((s) => {
      if (alive) setComputerStatus(s);
    }).catch(() => {});
    return () => {
      alive = false;
    };
  }, [conversationId]);

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
    lastPromptRef.current = msgToSend;
    upsertInfiniteSession(conversationId, msgToSend);
    
    if (truncateIndex !== undefined) {
      setMessages(prev => [...prev.slice(0, truncateIndex), { role: 'user', content: msgToSend }]);
      setEditingIndex(null);
    } else {
      setMessages(prev => [...prev, { role: 'user', content: msgToSend }]);
    }

    if (!overrideMsg) setInput('');
    setLoading(true);

    setLongOp({ active: true, label: 'Pipeline Initializing…', detail: 'Validating intent & context budget' });

    const startTs = Date.now();
    try {
      await streamDirectChat(msgToSend, conversationId, truncateIndex, {
        onState: (state) => {
          setLongOp({
            active: true,
            label: state.step || 'Pipeline Active…',
            detail: state.detail || ''
          });
        },
        onToken: (delta, cleanSoFar) => {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'assistant' && !last.isHistory && !last.isMeta) {
              return [...prev.slice(0, -1), { ...last, content: cleanSoFar }];
            } else {
              return [...prev, { role: 'assistant', content: cleanSoFar, isHistory: false }];
            }
          });
        },
        onDone: (res) => {
          if (res?.computerTask) {
            setComputerTaskId(res.computerTask.taskId);
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: `🖥 **Computer task accepted** — local AI is taking over the desktop.\n\nWorking on: "${res.computerTask.instruction}"`,
              isHistory: false,
              isMeta: true,
              computerTaskId: res.computerTask.taskId
            }]);
            return;
          }
          if (res?.chat?.messages) {
            const mapped = res.chat.messages.map((m, idx, arr) => ({
              ...m,
              isHistory: idx < arr.length - 1,
              thinkingTimeMs: idx === arr.length - 1 ? (res.thinkingTimeMs || (Date.now() - startTs)) : m.thinkingTimeMs,
              steps: idx === arr.length - 1 ? res.steps : m.steps,
              budgetUsage: idx === arr.length - 1 ? res.longContext?.budgetUsage : m.budgetUsage
            }));
            setMessages(mapped);
          } else if (res?.reply) {
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'assistant' && !last.isHistory && !last.isMeta) {
                return [...prev.slice(0, -1), {
                  role: 'assistant',
                  content: res.reply,
                  isHistory: false,
                  thinkingTimeMs: res.thinkingTimeMs || (Date.now() - startTs),
                  steps: res.steps,
                  budgetUsage: res.longContext?.budgetUsage
                }];
              } else {
                return [...prev, {
                  role: 'assistant',
                  content: res.reply,
                  isHistory: false,
                  thinkingTimeMs: res.thinkingTimeMs || (Date.now() - startTs),
                  steps: res.steps,
                  budgetUsage: res.longContext?.budgetUsage
                }];
              }
            });
          }
          if (res?.longContext?.ingested) {
            const { inputId, chunkCount } = res.longContext.ingested;
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: `📦 **1M+ Context Ingested**: **${chunkCount} chunks** indexed as \`${inputId}\`. Summary and retrieval index ready!`,
              isHistory: false,
              isMeta: true
            }]);
          }
        },
        onError: (err) => {
          setMessages(prev => [...prev, { role: 'assistant', content: err.message || 'An unknown error occurred.', isError: true }]);
        }
      });
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem', color: 'var(--text-muted)', opacity: 0.8 }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: computerStatus?.available ? '#10b981' : '#64748b', boxShadow: computerStatus?.available ? '0 0 6px #10b981' : 'none' }} />
          {computerStatus?.available
            ? 'Computer connected — this chat can control the real Windows desktop via local Gemma'
            : 'Computer control offline — chat works, desktop control unavailable'}
        </div>
        {messages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{ padding: '24px', background: 'var(--surface-color)', borderRadius: '50%', border: '1px solid var(--border-color)' }}>
              <MessageSquare size={48} className="text-cyan" />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 500, margin: 0, color: 'var(--text-primary)' }}>Welcome to Infinite</h2>
            <p style={{ fontSize: '0.95rem', maxWidth: '340px', lineHeight: '1.5' }}>Chat with your local AI — or let it control your Windows desktop. Try: <i>“Open Notepad and type Hello from DARKMATTER”</i></p>
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
                      <ThoughtBlock thinkingTimeMs={m.thinkingTimeMs} steps={m.steps} budgetUsage={m.budgetUsage} />
                      <ReactMarkdown components={{ code: CodeBlock }}>{m.content || ''}</ReactMarkdown>
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
        {/* Live computer task panel (SSE-driven; survives refresh) */}
        {computerTaskId && (
          <ComputerTaskPanel
            taskId={computerTaskId}
            onAnswer={(text) => {
              setMessages(prev => [...prev, { role: 'user', content: text }]);
            }}
          />
        )}
        {loading && (
          <div style={{ 
            alignSelf: 'flex-start', 
            background: 'rgba(168, 85, 247, 0.06)', 
            padding: '12px 18px', 
            borderRadius: '16px 16px 16px 4px', 
            color: 'var(--text-primary)', 
            border: '1px solid rgba(168, 85, 247, 0.25)', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '6px', 
            minWidth: '260px' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#a855f7', boxShadow: '0 0 8px #a855f7' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>
                  Thinking for {formatThinkingTime(thinkingSeconds)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '3px' }}>
                <div className="typing-dot" style={{ animationDelay: '0s' }}>.</div>
                <div className="typing-dot" style={{ animationDelay: '0.2s' }}>.</div>
                <div className="typing-dot" style={{ animationDelay: '0.4s' }}>.</div>
              </div>
            </div>
            
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#a855f7' }}>⚡</span>
              <span>{longOp.active ? longOp.detail : thinkingStep}</span>
            </div>
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

// ─── Autonomous Bug Bounty Agent dashboard ────────────────────────────────
//
// Observability-first, and the frontend is only a window: every number here
// comes from persisted backend state. Closing this page never stops a job.

const JOB_STATE_STYLE = {
  queued: { color: '#94a3b8', label: 'QUEUED' },
  starting: { color: '#38bdf8', label: 'STARTING' },
  running: { color: '#22c55e', label: 'RUNNING' },
  paused: { color: '#f59e0b', label: 'PAUSED' },
  waiting: { color: '#eab308', label: 'WAITING' },
  resuming: { color: '#38bdf8', label: 'RESUMING' },
  completed: { color: '#10b981', label: 'COMPLETED' },
  failed: { color: '#ef4444', label: 'FAILED' },
  cancelled: { color: '#a1a1aa', label: 'CANCELLED' }
};

const ACTIVITY_COLOR = {
  agent: '#22c55e', scope: '#38bdf8', decision: '#a78bfa', brain: '#a78bfa',
  tool: '#22d3ee', browser: '#f472b6', finding: '#f97316', plan: '#38bdf8',
  validation: '#eab308', report: '#10b981', wait: '#eab308', error: '#ef4444', info: '#94a3b8'
};

const formatDuration = (ms) => {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const totalSeconds = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
};

const formatClock = (value) => {
  if (!value) return '--:--:--';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '--:--:--' : date.toLocaleTimeString();
};

const AutonomousAgent = () => {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(() => localStorage.getItem('darkmatter_active_job') || null);
  const [state, setState] = useState(null);
  const [liveEvents, setLiveEvents] = useState([]);
  const [computer, setComputer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [tick, setTick] = useState(0);
  const [form, setForm] = useState({ target: '', scope: '', authorizationConfirmed: false, objective: '' });
  const terminalRef = useRef(null);

  // Rehydrate from the backend — never from local component state alone.
  const refreshJobs = async () => {
    try {
      const data = await apiClient.listJobs();
      setJobs(data.jobs || []);
      if (!selectedJobId && data.jobs?.length) {
        setSelectedJobId(data.jobs[0].id);
        localStorage.setItem('darkmatter_active_job', data.jobs[0].id);
      }
      return data.jobs || [];
    } catch (err) {
      setError(err.message);
      return [];
    }
  };

  const refreshState = async (jobId = selectedJobId) => {
    if (!jobId) return null;
    try {
      const data = await apiClient.getJobState(jobId);
      setState(data);
      // `/computer` wraps the runtime in `runtime`; the job snapshot is flat.
      const computer = data.computer;
      if (computer) setComputer(computer.runtime ? computer : { enabled: true, runtime: computer });
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    }
  };

  useEffect(() => {
    refreshJobs();
    apiClient.getComputerStatus().then(setComputer).catch(() => {});
    const interval = setInterval(() => refreshJobs(), 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On (re)select: fetch persisted state + replay history, then attach live.
  useEffect(() => {
    if (!selectedJobId) return undefined;
    setLiveEvents([]);
    let cancelled = false;

    (async () => {
      const snapshot = await refreshState(selectedJobId);
      if (cancelled || !snapshot) return;
      try {
        const history = await apiClient.getJobEventHistory(selectedJobId, { limit: 500 });
        if (!cancelled) setLiveEvents(history.events || []);
      } catch { /* history is best-effort */ }
    })();

    const unsubscribe = apiClient.subscribeToJobEvents(selectedJobId, {
      onEvent: (event) => {
        setLiveEvents((prev) => [...prev.slice(-400), event]);
        // Anything that changes persisted state triggers a rehydrate.
        if (typeof event.type === 'string' && !event.type.startsWith('brain.thinking')) {
          refreshState(selectedJobId);
        }
      },
      onError: () => {}
    });

    // Periodic rehydrate keeps the panel truthful even if the stream drops.
    const interval = setInterval(() => refreshState(selectedJobId), 4000);
    const clock = setInterval(() => setTick((value) => value + 1), 1000);

    return () => {
      cancelled = true;
      unsubscribe?.();
      clearInterval(interval);
      clearInterval(clock);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJobId]);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [state?.activity?.length, liveEvents.length]);

  const withBusy = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      const result = await fn();
      await refreshState();
      await refreshJobs();
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const handleStart = async (event) => {
    event.preventDefault();
    if (!form.target.trim()) return;
    const scopeItems = form.scope.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
    const created = await withBusy(() => apiClient.createJob({
      targetUrl: form.target.trim(),
      message: form.objective.trim() || `Assess ${form.target.trim()}`,
      authorizationConfirmed: form.authorizationConfirmed,
      scope: { included: scopeItems, excluded: [] }
    }));
    if (created?.jobId) {
      setSelectedJobId(created.jobId);
      localStorage.setItem('darkmatter_active_job', created.jobId);
    }
  };

  const handleAsk = async (event) => {
    event.preventDefault();
    if (!question.trim() || !selectedJobId) return;
    const result = await withBusy(() => apiClient.askJob(selectedJobId, question.trim()));
    if (result) setAnswer(result);
    setQuestion('');
  };

  const handleDownloadReport = async () => {
    if (!state?.job?.assessmentId) return;
    const report = await apiClient.getLatestReport(state.job.assessmentId);
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `darkmatter-report-${state.job.target}-v${report.version}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const job = state?.job;
  const jobStyle = JOB_STATE_STYLE[job?.status] || { color: '#94a3b8', label: (job?.status || '').toUpperCase() };
  const startedAt = job?.startedAt || job?.createdAt;
  // Elapsed is recomputed from PERSISTED timestamps — never a client-side clock.
  const elapsedMs = startedAt ? (new Date(job.completedAt || Date.now()).getTime() - new Date(startedAt).getTime()) : 0;
  const terminalLines = (state?.activity || []).slice(-200);
  const isTerminal = ['completed', 'failed', 'cancelled'].includes(job?.status);

  return (
    <div className="dedicated-page">
      <div className="page-header" style={{ flexWrap: 'wrap', gap: '8px', alignItems: 'baseline', paddingBottom: '8px' }}>
        <button className="icon-button" onClick={() => navigate('/')} style={{ flexShrink: 0 }}><ArrowLeft size={18} /></button>
        <h2 style={{ fontSize: '1.15rem', whiteSpace: 'nowrap', margin: 0 }}>Autonomous Bug Bounty Agent</h2>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Local AI brain · Persistent memory · background execution
        </span>
      </div>

      <div className="page-content transparent-bg" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* ── The one thing you have to do: paste the link ───────────── */}
        <div className="plan-card opaque-bg" style={{ padding: '16px', borderColor: 'rgba(56,189,248,0.35)' }}>
          <h4 style={{ marginBottom: '4px' }}>Paste the target link</h4>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
            Link डालते ही local brain चालू हो जाता है — यह job backend में चलता है, इसलिए tab बंद करने पर भी
            agent काम करता रहेगा।
          </p>
          <form onSubmit={handleStart} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              placeholder="https://example.com"
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
              style={{ flex: '1 1 280px', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.35)', color: 'inherit', fontSize: '0.95rem' }}
            />
            <button
              className="secondary-button"
              type="submit"
              disabled={busy || !form.authorizationConfirmed || !form.target.trim()}
              style={{ flex: '0 0 auto', padding: '12px 20px' }}
            >
              {busy ? 'Starting…' : 'Start agent'}
            </button>
            <label style={{ fontSize: '0.78rem', display: 'flex', gap: '6px', alignItems: 'center', color: 'var(--text-muted)', flexBasis: '100%' }}>
              <input
                type="checkbox"
                checked={form.authorizationConfirmed}
                onChange={(e) => setForm({ ...form, authorizationConfirmed: e.target.checked })}
              />
              I am authorized to test this target (scope engine इसके बिना कोई action नहीं चलने देगा)
            </label>
          </form>
          <details style={{ marginTop: '10px' }}>
            <summary style={{ fontSize: '0.78rem', color: 'var(--text-muted)', cursor: 'pointer' }}>Optional: scope &amp; objective</summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <textarea
                placeholder="scope (one per line, e.g. *.example.com)"
                value={form.scope}
                onChange={(e) => setForm({ ...form, scope: e.target.value })}
                rows={3}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: 'inherit', resize: 'vertical' }}
              />
              <input
                placeholder="objective (optional)"
                value={form.objective}
                onChange={(e) => setForm({ ...form, objective: e.target.value })}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: 'inherit' }}
              />
            </div>
          </details>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', alignItems: 'start' }}>
        {/* ── Assessments (multi-session) ───────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="plan-card opaque-bg" style={{ padding: '16px' }}>
            <h4 style={{ marginBottom: '10px' }}>Assessments</h4>
            {jobs.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No assessments yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {jobs.map((item) => {
                  const style = JOB_STATE_STYLE[item.status] || { color: '#94a3b8', label: item.status };
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => { setSelectedJobId(item.id); localStorage.setItem('darkmatter_active_job', item.id); }}
                      className={`history-item ${item.id === selectedJobId ? 'active' : ''}`}
                      style={{ textAlign: 'left' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <strong style={{ fontSize: '0.85rem' }}>{item.target}</strong>
                        <span style={{ fontSize: '0.7rem', color: style.color }}>{style.label}</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {item.phase || '—'} · {item.stepCount || 0} steps · {item.findingsCount || 0} findings
                        {item.reportVersion ? ` · report v${item.reportVersion}` : ''}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {computer && (
            <div className="plan-card opaque-bg" style={{ padding: '16px' }}>
              <h4 style={{ marginBottom: '8px' }}>Computer (hands layer)</h4>
              <p style={{ fontSize: '0.8rem', color: computer.runtime?.available ? '#22c55e' : '#eab308' }}>
                {computer.runtime?.state || 'unknown'}
              </p>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', wordBreak: 'break-word' }}>
                {computer.runtime?.reason || `platform ${computer.runtime?.platform || 'n/a'}`}
              </p>
              {computer.runtime?.inputSimulation === false && (
                <p style={{ fontSize: '0.72rem', color: '#eab308' }}>
                  Input simulation unavailable — observations and navigation still work.
                </p>
              )}
              <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Open-Interface bridge · screenshot/mouse/keyboard · {computer.runtime?.actionsPerformed || 0} actions
              </p>
            </div>
          )}
        </div>

        {/* ── Live agent panel ─────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          {error && (
            <div className="plan-card opaque-bg" style={{ padding: '12px', borderColor: '#ef4444' }}>
              <span style={{ color: '#ef4444', fontSize: '0.85rem' }}>{error}</span>
            </div>
          )}

          {!job && (
            <div className="plan-card opaque-bg" style={{ padding: '20px' }}>
              <p style={{ color: 'var(--text-muted)' }}>
                Select an assessment or start a new one. Every panel here is read from the backend,
                so a refresh — or a closed browser — never loses state.
              </p>
            </div>
          )}

          {job && (
            <>
              <div className="plan-card opaque-bg" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assessment</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{job.target}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      scope: {(job.scope?.included || []).join(', ') || job.target}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>STATUS</div>
                    <div style={{ color: jobStyle.color, fontWeight: 700 }} data-tick={tick}>{jobStyle.label}</div>
                    <div style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{formatDuration(elapsedMs)}</div>
                  </div>
                </div>

                {job.waitingReason && (
                  <p style={{ marginTop: '10px', fontSize: '0.8rem', color: '#eab308' }}>{job.waitingReason}</p>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginTop: '14px' }}>
                  {[
                    ['Phase', job.phase || '—'],
                    ['Objective', job.currentObjective || job.objective || '—'],
                    ['Current action', job.currentAction || '—'],
                    ['Brain', job.brainStatus || '—'],
                    ['Steps', job.stepCount || 0],
                    ['Findings', job.findingsCount || 0],
                    ['Evidence', job.evidenceCount || 0],
                    ['Events', state.eventCount || 0]
                  ].map(([label, value]) => (
                    <div key={label} style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '8px', padding: '10px' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</div>
                      <div style={{ fontSize: '0.85rem', wordBreak: 'break-word', color: '#e2e8f0' }}>{String(value)}</div>
                    </div>
                  ))}
                </div>

                {job.lastBrainDecision && (
                  <div style={{ marginTop: '12px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <div style={{ color: '#a78bfa' }}>Latest brain decision</div>
                    <div>{job.lastBrainDecision.reason}</div>
                    <div style={{ color: 'var(--text-muted)' }}>
                      {job.lastBrainDecision.action?.type}
                      {job.lastBrainDecision.action?.name ? ` → ${job.lastBrainDecision.action.name}` : ''}
                      {job.lastBrainDecision.action?.action?.type ? ` → ${job.lastBrainDecision.action.action.type}` : ''}
                      {job.lastBrainDecision.confidence !== null && job.lastBrainDecision.confidence !== undefined ? ` · confidence ${job.lastBrainDecision.confidence}` : ''}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
                  <button className="secondary-button" disabled={busy || isTerminal} onClick={() => withBusy(() => apiClient.pauseJob(job.id))}>
                    <Pause size={14} /> Pause
                  </button>
                  <button className="secondary-button" disabled={busy || job.status !== 'paused'} onClick={() => withBusy(() => apiClient.continueJob(job.id))}>
                    <Play size={14} /> Continue
                  </button>
                  <button className="secondary-button" disabled={busy || isTerminal} onClick={() => withBusy(() => apiClient.resumeJob(job.id))}>
                    <RotateCcw size={14} /> Resume
                  </button>
                  <button className="secondary-button" disabled={busy || isTerminal} onClick={() => withBusy(() => apiClient.cancelJob(job.id))}>
                    <Square size={14} /> Cancel
                  </button>
                  {job.reportId && (
                    <button className="secondary-button" onClick={handleDownloadReport}>
                      <Download size={14} /> Report v{job.reportVersion}
                    </button>
                  )}
                </div>
              </div>

              <div className="plan-card opaque-bg" style={{ padding: '16px' }}>
                <h4 style={{ marginBottom: '8px' }}>Terminal — live agent activity</h4>
                <div
                  ref={terminalRef}
                  style={{
                    fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 1.5,
                    background: 'rgba(0,0,0,0.45)', borderRadius: '8px', padding: '12px',
                    maxHeight: '320px', overflowY: 'auto', whiteSpace: 'pre-wrap'
                  }}
                >
                  {terminalLines.length === 0 ? (
                    <span style={{ color: 'var(--text-muted)' }}>Waiting for the first activity…</span>
                  ) : terminalLines.map((line) => (
                    <div key={line.id} style={{ color: ACTIVITY_COLOR[line.kind] || '#cbd5e1' }}>
                      [{formatClock(line.at)}] {line.message}
                      {line.detail ? `\n         ↳ ${String(line.detail).slice(0, 300)}` : ''}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                <div className="plan-card opaque-bg" style={{ padding: '16px' }}>
                  <h4 style={{ marginBottom: '8px' }}>Plan</h4>
                  {!job.plan?.phases?.length ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No durable plan yet.</p>
                  ) : (
                    <div style={{ fontSize: '0.8rem' }}>
                      {job.plan.phases.map((phase) => (
                        <div key={phase.name} style={{ marginBottom: '8px' }}>
                          <strong>{phase.name}</strong>
                          {(phase.steps || []).map((step) => (
                            <div key={step.step} style={{ color: step.status === 'done' ? '#22c55e' : 'var(--text-muted)' }}>
                              {step.status === 'done' ? '[x]' : '[ ]'} {step.step}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="plan-card opaque-bg" style={{ padding: '16px' }}>
                  <h4 style={{ marginBottom: '8px' }}>Findings</h4>
                  {(state.findings || []).length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      No confirmed findings yet. Observations stay observations until evidence exists.
                    </p>
                  ) : (
                    <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {state.findings.map((finding) => (
                        <div key={finding.id} style={{ borderLeft: '3px solid #f97316', paddingLeft: '8px' }}>
                          <div><strong>{finding.title}</strong></div>
                          <div style={{ color: 'var(--text-muted)' }}>
                            {finding.severity} · {finding.status} · {finding.affectedAsset || 'n/a'}
                          </div>
                          {finding.evidence?.length > 0 && (
                            <div style={{ color: '#22c55e', fontSize: '0.72rem' }}>{finding.evidence.length} evidence record(s)</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                <div className="plan-card opaque-bg" style={{ padding: '16px' }}>
                  <h4 style={{ marginBottom: '8px' }}>Event stream (replayable)</h4>
                  <div style={{ maxHeight: '220px', overflowY: 'auto', fontSize: '0.72rem', fontFamily: 'monospace' }}>
                    {liveEvents.slice(-120).map((event, index) => (
                      <div key={`${event.id || index}-${index}`} style={{ color: 'var(--text-muted)' }}>
                        <span style={{ color: '#38bdf8' }}>{event.type}</span> {String(event.message || '').slice(0, 160)}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="plan-card opaque-bg" style={{ padding: '16px' }}>
                  <h4 style={{ marginBottom: '8px' }}>Ask the agent</h4>
                  <form onSubmit={handleAsk} style={{ display: 'flex', gap: '8px' }}>
                    <input
                      placeholder="What have you found so far?"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: 'inherit' }}
                    />
                    <button className="secondary-button" type="submit" disabled={busy}><Send size={14} /></button>
                  </form>
                  {answer && (
                    <div style={{ marginTop: '10px', fontSize: '0.8rem', background: 'rgba(0,0,0,0.25)', borderRadius: '8px', padding: '10px' }}>
                      {answer.answer}
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                        model: {answer.model || 'local'} · job {answer.jobStatus} · phase {answer.phase}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        </div>
      </div>
    </div>
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

const PrivacyPolicyPage = () => (
  <div className="sg-app" style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto' }}>
    <h1 className="sg-h1" style={{ marginBottom: '20px' }}>Privacy Policy</h1>
    <p className="sg-body">Last updated: October 2026</p>
    <div className="sg-card sg-card-pad" style={{ marginTop: '20px' }}>
      <h2 className="sg-h2" style={{ marginBottom: '10px' }}>1. Data Collection</h2>
      <p className="sg-body" style={{ marginBottom: '20px' }}>We collect minimal data necessary for autonomous security assessments. This includes target definitions and findings.</p>
      
      <h2 className="sg-h2" style={{ marginBottom: '10px' }}>2. Data Usage</h2>
      <p className="sg-body" style={{ marginBottom: '20px' }}>Data is used strictly to provide the security agent service. We do not sell your data.</p>
      
      <h2 className="sg-h2" style={{ marginBottom: '10px' }}>3. Data Security</h2>
      <p className="sg-body">All findings are encrypted at rest and in transit. Reports are generated dynamically and purged based on your data retention settings.</p>
    </div>
  </div>
);

const TermsConditionsPage = () => (
  <div className="sg-app" style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto' }}>
    <h1 className="sg-h1" style={{ marginBottom: '20px' }}>Terms & Conditions</h1>
    <p className="sg-body">Last updated: October 2026</p>
    <div className="sg-card sg-card-pad" style={{ marginTop: '20px' }}>
      <h2 className="sg-h2" style={{ marginBottom: '10px' }}>1. Acceptable Use</h2>
      <p className="sg-body" style={{ marginBottom: '20px' }}>You must only test systems you own or are explicitly authorized to assess. Unauthorized use of this autonomous agent is strictly prohibited.</p>
      
      <h2 className="sg-h2" style={{ marginBottom: '10px' }}>2. Liability</h2>
      <p className="sg-body" style={{ marginBottom: '20px' }}>DarkMatter is provided "as is". We are not responsible for any damage caused by automated actions on misconfigured targets.</p>
      
      <h2 className="sg-h2" style={{ marginBottom: '10px' }}>3. Account Termination</h2>
      <p className="sg-body">We reserve the right to terminate accounts that violate our acceptable use policy immediately.</p>
    </div>
  </div>
);

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
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsConditionsPage />} />
          {/* v2: The agent console IS the app. Simple: Hunt + Infinity AI. */}
          <Route path="/agent/*" element={<AgentConsole />} />
          {/* Everything else redirects to the agent console. */}
          <Route path="/*" element={<Navigate to="/agent" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
