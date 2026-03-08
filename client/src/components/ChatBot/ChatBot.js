import React, { useState, useRef, useEffect } from 'react';
import { apiRequest } from '../../utils/api';
import './ChatBot.css';

const INITIAL_MESSAGE = {
  role: 'assistant',
  content: "Hi! I'm the Fetchwork assistant 👋 Ask me anything about the platform — posting jobs, finding freelancers, billing, or how things work.",
};

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const data = await apiRequest('/api/ai/support-chat', {
        method: 'POST',
        body: JSON.stringify({ messages: next }),
      });
      const reply = { role: 'assistant', content: data.reply };
      setMessages(prev => [...prev, reply]);
      if (!open) setUnread(u => u + 1);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I'm having trouble connecting. Please try again or email support@fetchwork.net.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="cb-root">
      {/* Chat panel */}
      {open && (
        <div className="cb-panel">
          <div className="cb-header">
            <div className="cb-header-left">
              <div className="cb-avatar">FW</div>
              <div>
                <div className="cb-header-name">Fetchwork Support</div>
                <div className="cb-header-status">
                  <span className="cb-status-dot" />
                  AI-powered · typically instant
                </div>
              </div>
            </div>
            <button className="cb-close-btn" onClick={() => setOpen(false)} aria-label="Close chat">✕</button>
          </div>

          <div className="cb-messages">
            {messages.map((m, i) => (
              <div key={i} className={`cb-msg cb-msg-${m.role}`}>
                {m.role === 'assistant' && <div className="cb-msg-avatar">FW</div>}
                <div className="cb-msg-bubble">{m.content}</div>
              </div>
            ))}
            {loading && (
              <div className="cb-msg cb-msg-assistant">
                <div className="cb-msg-avatar">FW</div>
                <div className="cb-msg-bubble cb-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="cb-input-row">
            <textarea
              ref={inputRef}
              className="cb-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask anything…"
              rows={1}
              disabled={loading}
            />
            <button
              className="cb-send-btn"
              onClick={send}
              disabled={!input.trim() || loading}
              aria-label="Send message"
            >
              ➤
            </button>
          </div>
          <div className="cb-footer">Powered by Fetchwork AI</div>
        </div>
      )}

      {/* Bubble trigger */}
      <button
        className="cb-bubble"
        onClick={() => setOpen(o => !o)}
        aria-label="Open support chat"
      >
        {open ? '✕' : '💬'}
        {!open && unread > 0 && <span className="cb-unread">{unread}</span>}
      </button>
    </div>
  );
}
