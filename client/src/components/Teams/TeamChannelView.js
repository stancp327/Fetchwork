import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import './TeamChannelView.css';

function Avatar({ user, size = 32 }) {
  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?';
  if (user?.avatar) return <img src={user.avatar} alt={initials} className="tcv-avatar" style={{ width: size, height: size }} />;
  return <div className="tcv-avatar tcv-avatar-initials" style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials}</div>;
}

function formatTime(date) {
  const d = new Date(date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function TeamChannelView({ channel, teamMembers = [], onChannelUpdate }) {
  const [messages, setMessages]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [input, setInput]           = useState('');
  const [sending, setSending]       = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const bottomRef                   = useRef(null);
  const inputRef                    = useRef(null);

  const loadMessages = useCallback(async () => {
    if (!channel?._id) return;
    setLoading(true);
    try {
      const data = await apiRequest(`/api/team-channels/${channel._id}/messages`);
      setMessages(data.messages || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [channel?._id]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const content = input.trim();
    setInput('');
    setSending(true);
    try {
      const data = await apiRequest(`/api/team-channels/${channel._id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      setMessages(prev => [...prev, data.message]);
    } catch {
      setInput(content); // restore on fail
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); }
  };

  // Group consecutive messages from same sender
  const grouped = messages.reduce((acc, msg, i) => {
    const prev = messages[i - 1];
    const sameUser = prev?.sender?._id === msg.sender?._id;
    const closeInTime = prev && (new Date(msg.createdAt) - new Date(prev.createdAt)) < 5 * 60 * 1000;
    acc.push({ ...msg, isGrouped: sameUser && closeInTime });
    return acc;
  }, []);

  const memberCount = channel.members?.length || 0;

  return (
    <div className="tcv-root">
      {/* Header */}
      <div className="tcv-header">
        <div className="tcv-header-left">
          <span className="tcv-hash">#</span>
          <span className="tcv-channel-name">{channel.name}</span>
          {channel.description && <span className="tcv-channel-desc">{channel.description}</span>}
        </div>
        <button
          className={`tcv-members-toggle${showMembers ? ' active' : ''}`}
          onClick={() => setShowMembers(s => !s)}
          title="Toggle member list"
        >
          👥 {memberCount}
        </button>
      </div>

      <div className="tcv-body">
        {/* Messages */}
        <div className="tcv-messages">
          {loading ? (
            <p className="tcv-loading">Loading messages…</p>
          ) : messages.length === 0 ? (
            <div className="tcv-empty">
              <p className="tcv-empty-icon">#</p>
              <p>This is the beginning of <strong>#{channel.name}</strong></p>
              <p className="tcv-empty-hint">Send a message to get the conversation started.</p>
            </div>
          ) : (
            grouped.map((msg) => (
              <div key={msg._id} className={`tcv-msg${msg.isGrouped ? ' tcv-msg--grouped' : ''}`}>
                {!msg.isGrouped && <Avatar user={msg.sender} />}
                {msg.isGrouped && <div className="tcv-msg-spacer" />}
                <div className="tcv-msg-body">
                  {!msg.isGrouped && (
                    <div className="tcv-msg-meta">
                      <span className="tcv-msg-name">
                        {msg.sender?.firstName} {msg.sender?.lastName}
                      </span>
                      <span className="tcv-msg-time">{formatTime(msg.createdAt)}</span>
                    </div>
                  )}
                  <p className="tcv-msg-content">{msg.content}</p>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Member list sidebar */}
        {showMembers && (
          <div className="tcv-members-panel">
            <p className="tcv-members-title">Members — {memberCount}</p>
            {(channel.members || []).map(m => {
              const user = m.user;
              const name = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Member';
              return (
                <div key={m._id || m.user?._id} className="tcv-member-row">
                  <Avatar user={user} size={28} />
                  <div>
                    <span className="tcv-member-name">{name}</span>
                    {m.role !== 'member' && <span className="tcv-member-role">{m.role}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Input bar */}
      <form className="tcv-input-bar" onSubmit={send}>
        <textarea
          ref={inputRef}
          className="tcv-input"
          placeholder={`Message #${channel.name}`}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
          maxLength={2000}
        />
        <button type="submit" className="tcv-send-btn" disabled={!input.trim() || sending}>
          ➤
        </button>
      </form>
    </div>
  );
}
