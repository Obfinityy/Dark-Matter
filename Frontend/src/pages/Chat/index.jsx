import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, Paperclip, Globe, Target, Terminal, User } from 'lucide-react';

export const Chat = () => {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('Normal');
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);

  // If chatId is present, mock loading a previous chat
  useEffect(() => {
    if (chatId) {
      setMessages([
        { role: 'user', content: 'Can you analyze the attack surface for api.acmecorp.com?' },
        { role: 'assistant', content: 'I have started analyzing the attack surface for `api.acmecorp.com`. \n\n### Reconnaissance Phase\n- Enumerating subdomains...\n- Checking for open ports...\n- Identifying active services.\n\nI will notify you once the initial phase is complete. Would you like me to use aggressive scanning or remain stealthy?' }
      ]);
    } else {
      setMessages([]);
    }
  }, [chatId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    if (!chatId) {
      // Create new chat and navigate (mock behavior)
      navigate('/c/new_123');
    }

    const newMsgs = [...messages, { role: 'user', content: input }];
    setMessages(newMsgs);
    setInput('');

    // Mock AI response
    setTimeout(() => {
      setMessages([...newMsgs, { role: 'assistant', content: 'I am processing your request. I will initiate the necessary autonomous tools and plugins to execute the task securely.' }]);
    }, 1000);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <>
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, width: '100%', maxWidth: 800 }}>
            <div style={{ width: 64, height: 64, borderRadius: '24%', backgroundColor: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <span style={{ fontSize: '2rem', color: '#fff' }}>▲</span>
            </div>
            <h1 style={{ fontSize: '2rem', fontWeight: 600, marginBottom: 32 }}>How can I help you research today?</h1>
            
            <div className="chat-options-grid">
              <button className="btn" style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', backgroundColor: 'var(--bg-secondary)' }} onClick={() => setInput('Map the attack surface for app.acmecorp.com')}>
                <Target size={20} color="var(--accent)" style={{ marginBottom: 12 }} />
                <span style={{ fontWeight: 500, marginBottom: 4 }}>Map attack surface</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Identify subdomains and open ports for an authorized target.</span>
              </button>
              <button className="btn" style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', backgroundColor: 'var(--bg-secondary)' }} onClick={() => setInput('Analyze this Nginx error log for vulnerabilities:\n\n')}>
                <Terminal size={20} color="var(--warning)" style={{ marginBottom: 12 }} />
                <span style={{ fontWeight: 500, marginBottom: 4 }}>Analyze error logs</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Find potential misconfigurations or vulnerabilities in logs.</span>
              </button>
            </div>
          </div>
        ) : (
          <div style={{ width: '100%' }}>
            {messages.map((msg, idx) => (
              <div key={idx} className="message-row">
                <div className="message-content">
                  <div className={`message-avatar ${msg.role === 'user' ? 'avatar-user' : 'avatar-ai'}`}>
                    {msg.role === 'user' ? <User size={20} /> : <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>▲</span>}
                  </div>
                  <div className="message-body">
                    <div style={{ fontWeight: 600, marginBottom: 4, color: msg.role === 'user' ? 'var(--text-primary)' : 'var(--text-primary)' }}>
                      {msg.role === 'user' ? 'You' : 'DarkMatter Agent'}
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="chat-input-container">
        <form className="chat-input-wrapper" onSubmit={handleSubmit}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message DarkMatter..."
            style={{
              width: '100%',
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
              fontSize: '1rem',
              resize: 'none',
              padding: '0 4px',
              outline: 'none',
              minHeight: 44,
              maxHeight: 200,
              overflowY: 'auto'
            }}
            rows={1}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn" style={{ padding: 8, color: 'var(--text-secondary)', borderRadius: 'var(--radius-full)' }} title="Attach file">
                <Paperclip size={18} />
              </button>
              <button type="button" className="btn" style={{ padding: 8, color: 'var(--text-secondary)', borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', gap: 6 }} title="Search Web">
                <Globe size={18} />
                <span style={{ fontSize: '0.85rem' }}>Search</span>
              </button>
              <select 
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                style={{ 
                  backgroundColor: 'transparent', 
                  color: 'var(--text-secondary)', 
                  border: '1px solid var(--border)', 
                  borderRadius: 'var(--radius-full)', 
                  padding: '4px 12px', 
                  fontSize: '0.85rem',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="Normal">Normal</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Ultra High">Ultra High</option>
                <option value="Infinity">Infinity</option>
              </select>
            </div>
            <button 
              type="submit" 
              className="btn" 
              disabled={!input.trim()}
              style={{ 
                padding: 8, 
                backgroundColor: input.trim() ? 'var(--text-primary)' : 'var(--border-light)', 
                color: input.trim() ? 'var(--bg-primary)' : 'var(--text-muted)', 
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
            >
              <Send size={18} />
            </button>
          </div>
        </form>
      </div>
      <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', paddingBottom: 12 }}>
        DarkMatter can make mistakes. Consider verifying important information.
      </div>
    </>
  );
};
