import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';

const AdminMessagesTab = () => {
  const [conversations, setConversations] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [flagged, setFlagged] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedConvo, setSelectedConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (flagged) params.flagged = 'true';
      const data = await apiRequest('/api/admin/messages/conversations', { params });
      setConversations(data.conversations || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [page, flagged]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  const viewMessages = async (convoId) => {
    try {
      setMsgLoading(true);
      setSelectedConvo(convoId);
      const data = await apiRequest(`/api/admin/messages/conversation/${convoId}`);
      setMessages(data.messages || []);
    } catch (err) {
      alert('Failed to load messages');
    } finally {
      setMsgLoading(false);
    }
  };

  const removeMessage = async (msgId) => {
    const reason = window.prompt('Reason for removal:');
    if (!reason) return;
    try {
      await apiRequest(`/api/admin/messages/${msgId}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason }),
      });
      setMessages(prev => prev.map(m => m._id === msgId ? { ...m, content: '[Removed by moderator]', moderatedAt: new Date() } : m));
    } catch (err) {
      alert('Failed to remove message: ' + (err.message || 'Unknown error'));
    }
  };

  return (
    <div className="admin-tab-content">
      <div className="admin-tab-header">
        <h2>Message Moderation</h2>
        <span className="admin-count-badge">{total} conversations</span>
      </div>

      <div className="admin-filters">
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={flagged} onChange={e => { setFlagged(e.target.checked); setPage(1); }} />
          Flagged only
        </label>
        <button onClick={fetchConversations} className="btn btn-ghost btn-sm">Refresh</button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', minHeight: '400px' }}>
        {/* Conversation list */}
        <div style={{ flex: '0 0 320px', borderRight: '1px solid #e2e8f0', paddingRight: '1rem', overflowY: 'auto', maxHeight: '600px' }}>
          {loading ? (
            <div className="admin-loading">Loading…</div>
          ) : conversations.length === 0 ? (
            <div className="admin-empty">No conversations found.</div>
          ) : (
            conversations.map(c => (
              <div
                key={c._id}
                onClick={() => viewMessages(c._id)}
                style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  marginBottom: '0.5rem',
                  background: selectedConvo === c._id ? '#eff6ff' : '#f8fafc',
                  border: selectedConvo === c._id ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                  {(c.participants || []).map(p => `${p.firstName} ${p.lastName}`).join(' ↔ ')}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  Updated: {new Date(c.updatedAt).toLocaleString()}
                </div>
                {c.flagged && <span style={{ background: '#ef4444', color: '#fff', padding: '1px 6px', borderRadius: '8px', fontSize: '0.7rem', marginTop: '0.25rem', display: 'inline-block' }}>Flagged</span>}
              </div>
            ))
          )}
        </div>

        {/* Message view */}
        <div style={{ flex: 1, overflowY: 'auto', maxHeight: '600px' }}>
          {!selectedConvo ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', paddingTop: '4rem' }}>
              Select a conversation to view messages
            </div>
          ) : msgLoading ? (
            <div className="admin-loading">Loading messages…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {messages.map(m => (
                <div key={m._id} style={{
                  padding: '0.75rem',
                  background: m.moderatedAt ? '#fef2f2' : '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      {m.sender?.firstName} {m.sender?.lastName}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                      {new Date(m.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>{m.content}</div>
                  {!m.moderatedAt && (
                    <button onClick={() => removeMessage(m._id)} className="btn btn-danger btn-sm" style={{ fontSize: '0.75rem' }}>
                      Remove
                    </button>
                  )}
                  {m.moderatedAt && (
                    <span style={{ fontSize: '0.75rem', color: '#ef4444', fontStyle: 'italic' }}>Moderated</span>
                  )}
                </div>
              ))}
              {messages.length === 0 && <div className="admin-empty">No messages in this conversation.</div>}
            </div>
          )}
        </div>
      </div>

      {total > 20 && (
        <div className="admin-pagination" style={{ marginTop: '1rem' }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn btn-ghost btn-sm">← Prev</button>
          <span>Page {page} of {Math.ceil(total / 20)}</span>
          <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)} className="btn btn-ghost btn-sm">Next →</button>
        </div>
      )}
    </div>
  );
};

export default AdminMessagesTab;
