import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  FileText,
  Link,
  Loader2,
  Paperclip,
  Send,
  Terminal,
  Trash2,
  User
} from 'lucide-react';
import { apiClient, extractTargetUrl, normalizeTargetUrl } from '../../services/api';

const modes = ['Normal', 'Medium', 'High', 'Ultra High', 'Infinity'];
const maxAttachmentBytes = 1_000_000;

function formatEventTime(timestamp) {
  if (!timestamp) return '--:--:--';
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? String(timestamp) : date.toLocaleTimeString([], { hour12: false });
}

function eventLevel(level) {
  const normalized = String(level || 'INFO').toUpperCase();
  return ['INFO', 'WARN', 'ERROR', 'SUCCESS'].includes(normalized) ? normalized : 'INFO';
}

function isReadableFile(file) {
  return file.type.startsWith('text/') || /\.(txt|log|json|csv|md|xml|yaml|yml|js|jsx|ts|tsx|html|css|env)$/i.test(file.name);
}

export const Chat = () => {
  const { chatId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [authorizationConfirmed, setAuthorizationConfirmed] = useState(false);
  const [mode, setMode] = useState('Normal');
  const [messages, setMessages] = useState([]);
  const [attachment, setAttachment] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [activeScan, setActiveScan] = useState(null);
  const [events, setEvents] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [streamError, setStreamError] = useState('');
  const messagesEndRef = useRef(null);
  const terminalEndRef = useRef(null);
  const unsubscribeRef = useRef(null);
  const fileInputRef = useRef(null);

  const resetChat = () => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    setInput('');
    setTargetUrl('');
    setAuthorizationConfirmed(false);
    setAttachment(null);
    setMessages([]);
    setActiveScan(null);
    setEvents([]);
    setConnectionStatus('idle');
    setSubmitError('');
    setStreamError('');
  };

  useEffect(() => () => unsubscribeRef.current?.(), []);

  useEffect(() => {
    let cancelled = false;
    resetChat();
    if (!chatId) return undefined;

    apiClient.getScan(chatId)
      .then((scan) => {
        if (cancelled) return;
        const targetMessage = (scan.messages || []).find((message) => message.role === 'user')?.content || '';
        const target = extractTargetUrl(targetMessage) || scan.targetId || '';
        setMessages((scan.messages || []).map((message) => ({ role: message.role, content: message.content })));
        setActiveScan({ id: scan.id, targetUrl: target, status: scan.status });
        setEvents(scan.events || []);
        if (scan.status === 'completed') setConnectionStatus('completed');
        else if (scan.status === 'failed') setConnectionStatus('error');
        else startEventStream(scan.id);
      })
      .catch((error) => {
        if (!cancelled) setStreamError(error.message || 'This investigation could not be loaded.');
      });

    return () => {
      cancelled = true;
      unsubscribeRef.current?.();
    };
  }, [chatId, location.key]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, events]);

  useEffect(() => {
    if (activeScan && connectionStatus === 'connected') {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeScan, connectionStatus, events]);

  const addAssistantMessage = (content, level = 'INFO') => {
    setMessages((current) => [...current, { role: 'assistant', content, level }]);
  };

  function startEventStream(scanId) {
    unsubscribeRef.current?.();
    setConnectionStatus('connecting');
    setStreamError('');
    unsubscribeRef.current = apiClient.subscribeToScanEvents(scanId, {
      onOpen: () => setConnectionStatus('connected'),
      onEvent: (event) => {
        setEvents((current) => current.some((item) => item.id === event.id) ? current : [...current, event]);
        if (event.type === 'tool.completed') {
          setActiveScan((current) => current ? { ...current, status: 'completed' } : current);
          setConnectionStatus('completed');
          unsubscribeRef.current?.();
        }
        if (event.type === 'tool.failed' || event.type === 'scan.failed') {
          setActiveScan((current) => current ? { ...current, status: 'failed' } : current);
          setConnectionStatus('error');
          unsubscribeRef.current?.();
        }
      },
      onError: (error) => {
        setConnectionStatus('error');
        setStreamError(error.message);
      }
    });
  }

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!isReadableFile(file)) {
      setSubmitError('Attach a readable text, log, JSON, CSV, Markdown, YAML, HTML, CSS, or code file.');
      return;
    }
    if (file.size > maxAttachmentBytes) {
      setSubmitError('Attached files must be smaller than 1 MB.');
      return;
    }
    try {
      const content = await file.text();
      setAttachment({ name: file.name, size: file.size, type: file.type || 'text/plain', content });
      setSubmitError('');
    } catch {
      setSubmitError('This file could not be read.');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    const message = input.trim();
    const resolvedTarget = normalizeTargetUrl(targetUrl.trim() || extractTargetUrl(message));
    if (!resolvedTarget) {
      setSubmitError('Add an HTTP or HTTPS target URL before starting reconnaissance.');
      return;
    }
    if (!authorizationConfirmed) {
      setSubmitError('Confirm that you are authorized to test this target before starting.');
      return;
    }

    const visibleMessage = message || `Enumerate subdomains for ${resolvedTarget}`;
    const requestMessage = attachment?.content
      ? `${visibleMessage}\n\nAttached file: ${attachment.name}\n${attachment.content.slice(0, 5000)}`
      : visibleMessage;
    setIsSubmitting(true);
    setSubmitError('');
    setStreamError('');
    setEvents([]);
    setActiveScan(null);
    unsubscribeRef.current?.();
    setConnectionStatus('idle');
    setMessages((current) => [...current, { role: 'user', content: attachment ? `${visibleMessage} [${attachment.name}]` : visibleMessage }]);
    setInput('');
    setTargetUrl('');
    setAuthorizationConfirmed(false);
    setAttachment(null);

    try {
      const response = await apiClient.sendAgentMessage({
        message: requestMessage,
        targetUrl: resolvedTarget,
        authorizationConfirmed: true,
        mode: mode.toUpperCase()
      });
      if (response.status !== 'started' || !response.scanId) throw new Error(response.message || 'The backend did not return a scan id.');
      setActiveScan({ id: response.scanId, targetUrl: resolvedTarget, status: response.scan?.status || 'queued' });
      setEvents(response.scan?.events || []);
      addAssistantMessage(`Investigation started for ${resolvedTarget}. Live subdomain output will appear below.`);
      navigate(`/c/${response.scanId}`, { replace: true });
      startEventStream(response.scanId);
    } catch (error) {
      addAssistantMessage(error.message || 'The backend could not start this investigation.', 'ERROR');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = Boolean(input.trim() || targetUrl.trim()) && !isSubmitting;

  return (
    <>
      <div className="chat-messages">
        {messages.length === 0 && !activeScan ? (
          <div className="chat-empty-state">
            <div className="chat-hero-visual" aria-hidden="true">
              <div className="hero-grid" />
              <div className="hero-orbit hero-orbit-one" />
              <div className="hero-orbit hero-orbit-two" />
              <div className="hero-reticle"><span /><span /><span /><span /></div>
              <div className="hero-data-panel">
                <div className="hero-panel-head"><span><i /> signal monitor</span><span>LIVE</span></div>
                <div className="hero-signal-lines"><span /><span /><span /><span /><span /><span /></div>
                <div className="hero-panel-foot"><span>scope gate</span><strong>READY</strong></div>
              </div>
              <div className="hero-trace hero-trace-one" />
              <div className="hero-trace hero-trace-two" />
            </div>
            <div className="chat-empty-copy">
              <span className="chat-hero-kicker"><span className="status-pulse" /> Authorized recon workspace</span>
              <h1>Turn a target into a <em>clear signal.</em></h1>
              <p>Run focused passive reconnaissance with a live terminal built for authorized security research.</p>
              <div className="chat-hero-points"><span><Terminal size={14} /> Live terminal</span><span><Link size={14} /> Scope-first</span><span><CheckCircle2 size={14} /> Database-backed</span></div>
            </div>
          </div>
        ) : (
          <div className="chat-content-column">
            {!activeScan && messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className="message-row">
                <div className="message-content">
                  <div className={`message-avatar ${message.role === 'user' ? 'avatar-user' : 'avatar-ai'}`}>
                    {message.role === 'user' ? <User size={18} /> : <Terminal size={18} />}
                  </div>
                  <div className="message-body">
                    <div className="message-author">{message.role === 'user' ? 'You' : 'DarkMatter Agent'}</div>
                    <div className={message.level === 'ERROR' ? 'chat-message-error' : message.level === 'WARN' ? 'chat-message-warning' : ''}>{message.content}</div>
                  </div>
                </div>
              </div>
            ))}

            {activeScan && (
              <div className="chat-terminal-row" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div className="terminal-container chat-live-terminal" style={{ flex: 1 }}>
                  <div className="terminal-header">
                    <div className="terminal-title"><Terminal size={14} /> Live subdomain enumeration</div>
                    <div className="chat-terminal-status" style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {['connected', 'completed'].includes(connectionStatus) && <CheckCircle2 size={14} color="var(--success)" />}
                        {connectionStatus === 'connecting' && <Loader2 size={14} color="var(--accent)" className="animate-spin" />}
                        {connectionStatus === 'error' && <AlertCircle size={14} color="var(--danger)" />}
                        <span>{connectionStatus === 'connected' ? 'streaming' : connectionStatus}</span>
                      </div>
                      <button 
                        className="btn" 
                        style={{ padding: '4px', minHeight: 'auto' }}
                        title="Copy terminal output"
                        onClick={() => {
                          const textToCopy = events.map(e => `[${formatEventTime(e.timestamp)}] ${e.level.padEnd(8, ' ')} ${e.message}`).join('\n');
                          navigator.clipboard.writeText(textToCopy);
                        }}
                      >
                        <Copy size={16} color="var(--text-secondary)" />
                      </button>
                    </div>
                  </div>
                  <div className="chat-terminal-target"><Link size={14} /> {activeScan.targetUrl}</div>
                  <div className="terminal-body">
                    {events.length === 0 && !streamError && <div className="terminal-empty">Waiting for terminal events...</div>}
                    {events.map((item) => {
                      const level = eventLevel(item.level);
                      const subdomains = Array.isArray(item.data?.subdomains) ? item.data.subdomains : null;
                      return (
                        <React.Fragment key={item.id || `${item.timestamp}-${item.message}`}>
                          <div className="log-entry">
                            <span className="log-timestamp">[{formatEventTime(item.timestamp)}]</span>
                            <span className={`log-level ${level}`}>{level.padEnd(8, ' ')}</span>
                            <span className="log-message">{item.message}</span>
                            {item.data?.source && !subdomains && <span className="log-data">source: {item.data.source}</span>}
                          </div>
                          {subdomains && <div className="subdomain-results" aria-label="Discovered subdomains">
                            {subdomains.map((subdomain) => <div className="subdomain-result" key={subdomain}><span className="subdomain-marker">&gt;</span><span>{subdomain}</span></div>)}
                          </div>}
                        </React.Fragment>
                      );
                    })}
                    {streamError && <div className="log-entry"><span className="log-level ERROR">ERROR</span><span className="log-message">{streamError}</span></div>}
                    <div ref={terminalEndRef} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {!(activeScan || isSubmitting) && (
        <>
          <div className="chat-input-container">
            <form className="chat-input-wrapper" onSubmit={handleSubmit}>
              <div className="chat-target-context">
                <div className="chat-target-label"><Link size={14} /> Authorized target</div>
                <input
                  className="chat-target-input"
                  value={targetUrl}
                  onChange={(event) => setTargetUrl(event.target.value)}
                  onBlur={(event) => setTargetUrl(normalizeTargetUrl(event.target.value))}
                  placeholder="example.com or https://authorized-target.com"
                  aria-label="Authorized target URL"
                  type="text"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                />
              </div>
              <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Describe the subdomain task, or paste an HTTP(S) URL..." aria-label="Reconnaissance request" onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); handleSubmit(event); } }} rows={1} />
              {attachment && <div className="attachment-chip"><FileText size={15} /><span title={attachment.name}>{attachment.name}</span><button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment" title="Remove attachment"><Trash2 size={14} /></button></div>}
              <input ref={fileInputRef} className="visually-hidden" type="file" accept="text/*,.txt,.log,.json,.csv,.md,.xml,.yaml,.yml,.js,.jsx,.ts,.tsx,.html,.css,.env" onChange={handleFileChange} />
              <label className="checkbox-container chat-authorization"><input type="checkbox" checked={authorizationConfirmed} onChange={(event) => setAuthorizationConfirmed(event.target.checked)} /><span className="checkmark" /><span className="checkbox-text">I confirm I am authorized to test this target and its declared scope.</span></label>
              {submitError && <div className="chat-submit-error"><AlertCircle size={14} /> {submitError}</div>}
              <div className="chat-composer-toolbar">
                <div className="chat-composer-tools">
                  <button type="button" className="btn icon-button" onClick={() => fileInputRef.current?.click()} title="Attach a text or log file" aria-label="Attach a text or log file"><Paperclip size={18} /></button>
                  <label className="mode-control"><span>Mode</span><select value={mode} onChange={(event) => setMode(event.target.value)} aria-label="Execution mode">{modes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                </div>
                <button type="submit" className="btn send-button" disabled={!canSubmit} aria-label={isSubmitting ? 'Starting reconnaissance' : 'Start reconnaissance'}>{isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}</button>
              </div>
            </form>
          </div>
          <div className="chat-footer-note">Authorized targets only. Attachments are read locally and sent as text context.</div>
        </>
      )}
    </>
  );
};
