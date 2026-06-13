import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import './AdminMessagesTab.css';

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
      setMessages(prev =>
        prev.map(m =>
          m._id === msgId
            ? { ...m, content: '[Removed by moderator]', moderatedAt: new Date() }
            : m
        )
      );
    } catch (err) {
      alert('Failed to remove message: ' + (err.message || 'Unknown error'));
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="admin-tab-content">
      <div className="admin-tab-header">
        <h2>Message Moderation</h2>
        <span className="admin-count-badge">{total} conversations</span>
      </div>

      <div className="admin-filters admin-messages-filters">
        <label className="amt-filter-label">
          <input
            type="checkbox"
            checked={flagged}
            onChange={e => { setFlagged(e.target.checked); setPage(1); }}
          />
          Flagged only
        </label>
        <button onClick={fetchConversations} className="btn btn-ghost btn-sm">Refresh</button>
      </div>

      <div className="admin-messages-layout">
        {/* Conversation list */}
        <div className="admin-messages-sidebar">
          <div className="admin-messages-sidebar-inner">
            {loading ? (
              <div className="admin-loading">Loading…</div>
            ) : conversations.length === 0 ? (
              <div className="admin-empty">No conversations found.</div>
            ) : (
              conversations.map(c => (
                <div
                  key={c._id}
                  onClick={() => viewMessages(c._id)}
                  className={`admin-convo-card${selectedConvo === c._id ? ' is-selected' : ''}`}
                >
                  <div className="amt-convo-header">
                    <div className="amt-convo-names">
                      {(c.participants || []).map(p => `${p.firstName} ${p.lastName}`).join(' ↔ ')}
                    </div>
                    {c.flagged && <span className="amt-flagged-badge">Flagged</span>}
                  </div>
                  <div className="amt-convo-time">
                    {new Date(c.updatedAt).toLocaleString()}
                  </div>
                  {c.lastMessage && (
                    <div className="amt-convo-preview">{c.lastMessage}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Message thread */}
        <div className="admin-messages-thread">
          <div className="admin-messages-thread-inner">
            {!selectedConvo ? (
              <div className="amt-empty-thread">
                Select a conversation to view messages
              </div>
            ) : msgLoading ? (
              <div className="admin-loading">Loading messages…</div>
            ) : (
              <div className="amt-messages-list">
                {messages.map(m => (
                  <div
                    key={m._id}
                    className={`admin-message-card${m.moderatedAt ? ' is-moderated' : ''}`}
                  >
                    <div className="admin-message-meta">
                      <span className="amt-sender-name">
                        {m.sender?.firstName} {m.sender?.lastName}
                      </span>
                      <span className="amt-message-time">
                        {new Date(m.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className={`amt-message-content${m.moderatedAt ? ' is-moderated' : ''}`}>
                      {m.content}
                    </div>
                    <div className="amt-message-footer">
                      {m.moderatedAt ? (
                        <span className="amt-moderated-label">Moderated</span>
                      ) : (
                        <button
                          onClick={() => removeMessage(m._id)}
                          className="amt-remove-btn"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {messages.length === 0 && (
                  <div className="admin-empty">No messages in this conversation.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {total > 20 && (
        <div className="admin-pagination">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="btn btn-ghost btn-sm"
          >
            ← Prev
          </button>
          <span className="amt-page-info">Page {page} of {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="btn btn-ghost btn-sm"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminMessagesTab;
