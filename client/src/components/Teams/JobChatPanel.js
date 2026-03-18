import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiRequest } from '../../utils/api';

export default function JobChatPanel({ teamId, jobId, teamMembers = [], currentUserId }) {
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [mentionQuery, setMentionQuery] = useState(null); // null = closed, string = filter
  const [mentionIdx, setMentionIdx] = useState(0);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const load = useCallback(async (before) => {
    try {
      const url = `/api/teams/${teamId}/jobs/${jobId}/chat` + (before ? `?before=${before}&limit=30` : '?limit=30');
      const res = await apiRequest(url);
      if (before) {
        setMessages(prev => [...(res.messages || []), ...prev]);
      } else {
        setMessages(res.messages || []);
      }
      setHasMore(res.hasMore || false);
    } catch { /* silent */ }
  }, [teamId, jobId]);

  useEffect(() => { load(); }, [load]);

  // Poll every 15s for new messages
  useEffect(() => {
    const interval = setInterval(() => { load(); }, 15000);
    return () => clearInterval(interval);
  }, [load]);

  // Track last-read for unread badge
  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.createdAt) {
        localStorage.setItem(`jobChat_${jobId}`, lastMsg.createdAt);
      }
    }
  }, [messages, jobId]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const res = await apiRequest(`/api/teams/${teamId}/jobs/${jobId}/chat`, {
        method: 'POST',
        body: JSON.stringify({ message: text.trim() }),
      });
      setMessages(prev => [...prev, res.message]);
      setText('');
    } catch (err) { alert(err.message || 'Failed to send'); }
    finally { setSending(false); }
  };

  const startEdit = (msg) => {
    setEditingId(msg._id);
    setEditText(msg.message);
  };

  const saveEdit = async (msgId) => {
    if (!editText.trim()) return;
    try {
      const res = await apiRequest(`/api/teams/${teamId}/jobs/${jobId}/chat/${msgId}`, {
        method: 'PUT',
        body: JSON.stringify({ message: editText.trim() }),
      });
      setMessages(prev => prev.map(m => m._id === msgId ? res.message : m));
      setEditingId(null);
    } catch (err) { alert(err.message || 'Failed to edit'); }
  };

  const deleteMsg = async (msgId) => {
    try {
      await apiRequest(`/api/teams/${teamId}/jobs/${jobId}/chat/${msgId}`, { method: 'DELETE' });
      setMessages(prev => prev.map(m => m._id === msgId ? { ...m, deletedAt: new Date().toISOString(), message: 'This message was deleted' } : m));
    } catch (err) { alert(err.message || 'Failed to delete'); }
  };

  const loadMore = () => {
    if (messages.length > 0) {
      load(messages[0].createdAt);
    }
  };

  // @mention helpers
  const filteredMembers = mentionQuery !== null
    ? teamMembers.filter(m => m.firstName?.toLowerCase().startsWith(mentionQuery.toLowerCase()))
    : [];

  const handleInputChange = (e) => {
    const val = e.target.value;
    setText(val);
    // Check for @mention trigger
    const cursor = e.target.selectionStart;
    const before = val.slice(0, cursor);
    const atMatch = before.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionIdx(0);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (member) => {
    const cursor = inputRef.current?.selectionStart || text.length;
    const before = text.slice(0, cursor);
    const after = text.slice(cursor);
    const replaced = before.replace(/@(\w*)$/, `@${member.firstName} `);
    setText(replaced + after);
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (mentionQuery !== null && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, filteredMembers.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(filteredMembers[mentionIdx]); return; }
      if (e.key === 'Escape') { setMentionQuery(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const canEdit = (msg) => {
    if (!msg.author || msg.deletedAt) return false;
    if (String(msg.author._id || msg.author) !== String(currentUserId)) return false;
    return Date.now() - new Date(msg.createdAt).getTime() < 15 * 60 * 1000;
  };

  const isOwnMessage = (msg) => {
    return String(msg.author?._id || msg.author) === String(currentUserId);
  };

  const fmtTime = (d) => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="jc-panel">
      <div className="jc-messages" ref={listRef}>
        {hasMore && (
          <button className="jc-load-more" onClick={loadMore}>Load earlier messages</button>
        )}
        {messages.length === 0 && (
          <div className="jc-empty">No messages yet. Start the conversation.</div>
        )}
        {messages.map(msg => (
          <div key={msg._id} className={`jc-msg${msg.deletedAt ? ' jc-deleted' : ''}`}>
            <div className="jc-msg-header">
              <span className="jc-msg-author">{msg.author?.firstName || 'Unknown'}</span>
              <span className="jc-msg-time">{fmtTime(msg.createdAt)}</span>
              {msg.editedAt && !msg.deletedAt && <span className="jc-msg-edited">(edited)</span>}
              {!msg.deletedAt && (
                <span className="jc-msg-actions">
                  {canEdit(msg) && (
                    <button className="jc-msg-edit-btn" onClick={() => startEdit(msg)} title="Edit">✎</button>
                  )}
                  {isOwnMessage(msg) && (
                    <button className="jc-msg-del-btn" onClick={() => deleteMsg(msg._id)} title="Delete">×</button>
                  )}
                </span>
              )}
            </div>
            {editingId === msg._id ? (
              <div className="jc-edit-row">
                <input
                  className="jc-edit-input"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(msg._id); if (e.key === 'Escape') setEditingId(null); }}
                  autoFocus
                />
                <button className="jc-edit-save" onClick={() => saveEdit(msg._id)}>Save</button>
                <button className="jc-edit-cancel" onClick={() => setEditingId(null)}>Cancel</button>
              </div>
            ) : (
              <div className="jc-msg-body">{msg.message}</div>
            )}
          </div>
        ))}
      </div>
      <div className="jc-input-wrap">
        {mentionQuery !== null && filteredMembers.length > 0 && (
          <div className="jc-mention-dropdown">
            {filteredMembers.map((m, i) => (
              <div
                key={m._id}
                className={`jc-mention-item${i === mentionIdx ? ' jc-mention-active' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); insertMention(m); }}
              >
                {m.firstName} {m.lastName}
              </div>
            ))}
          </div>
        )}
        <input
          ref={inputRef}
          className="jc-input"
          placeholder="Type a message… (@ to mention)"
          value={text}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={sending}
        />
        <button className="jc-send-btn" onClick={send} disabled={sending || !text.trim()}>Send</button>
      </div>
    </div>
  );
}
