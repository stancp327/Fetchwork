import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../socket/useSocket';
import { apiRequest } from '../../utils/api';
import OnlineStatus, { formatLastSeen } from '../common/OnlineStatus';
import CustomOfferModal from '../Offers/CustomOfferModal';
import './Messages.css';
import SEO from '../common/SEO';

import { formatTime, ConvoItem, ProposalActionCard, MilestoneRequestCard, MsgBubble, OrderStatusBar } from './parts/components';

// ── Main Messages ───────────────────────────────────────────────
const Messages = () => {
  const { user } = useAuth();
  const { search: locationSearch } = useLocation();
  const userId = user?._id || user?.id || user?.userId;
  const [conversations, setConversations] = useState([]);
  const [selectedConvo, setSelectedConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [attachFiles, setAttachFiles] = useState([]);
  const fileInputRef = React.useRef(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [deliveryStatus, setDeliveryStatus] = useState(new Map());
  const [showContext, setShowContext] = useState(false);
  const [mobileView, setMobileView] = useState('inbox');
  const [onlineUsers, setOnlineUsers] = useState({}); // userId → { isOnline, lastSeen }
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastSeqByConvoRef = useRef({});

  const token = localStorage.getItem('token');

  // ── Data fetchers (defined first — used by socket handler) ───
  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/api/messages/conversations');
      setConversations(data.conversations || []);
      setError(null);
    } catch (err) {
      setError(err.data?.error || err.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch online status for all conversation participants
  useEffect(() => {
    if (conversations.length === 0) return;
    const ids = [...new Set(
      conversations.flatMap(c => (c.participants || []).map(p => p._id).filter(Boolean))
    )].filter(id => id !== userId);
    if (ids.length === 0) return;
    apiRequest(`/api/users/online-status?ids=${ids.join(',')}`)
      .then(data => setOnlineUsers(data.statuses || {}))
      .catch(() => {});
  }, [conversations, userId]);

  // ── Stable refs — socket handler always gets latest values
  //    without causing reconnects on every state change ─────────
  const selectedConvoRef = useRef(selectedConvo);
  useEffect(() => { selectedConvoRef.current = selectedConvo; }, [selectedConvo]);
  const userIdRef = useRef(userId);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  const syncConversationSinceLastSeq = useCallback(async (conversationId) => {
    const sinceSeq = Number(lastSeqByConvoRef.current[conversationId] || 0);
    const data = await apiRequest(`/api/messages/conversations/${conversationId}/sync?sinceSeq=${sinceSeq}&limit=200`);
    const syncedMessages = data.messages || [];
    if (syncedMessages.length > 0) {
      const maxSeq = Math.max(...syncedMessages.map((m) => Number(m.seq || 0)));
      lastSeqByConvoRef.current[conversationId] = Math.max(sinceSeq, maxSeq);
      if (selectedConvoRef.current?._id === conversationId) {
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m._id));
          const merged = [...prev];
          syncedMessages.forEach((m) => { if (!seen.has(m._id)) merged.push(m); });
          return merged.sort((a, b) => Number(a.seq || 0) - Number(b.seq || 0));
        });
      }
    }
  }, []);

  const handleSocketEvent = useCallback((event, data) => {
    const convo = selectedConvoRef.current;
    switch (event) {
      case 'message:receive': {
        const msg = data?.message;
        if (!msg) break;
        if (msg?.conversation && Number.isFinite(Number(msg.seq))) {
          const cid = msg.conversation?.toString?.() || msg.conversation;
          lastSeqByConvoRef.current[cid] = Math.max(Number(lastSeqByConvoRef.current[cid] || 0), Number(msg.seq));
        }
        const msgConvoId = msg.conversation?.toString() || msg.conversation;
        const currentConvoId = convo?._id?.toString();
        if (msgConvoId && currentConvoId && msgConvoId === currentConvoId) {
          setMessages(prev => {
            // Already have this real message — skip
            if (prev.some(m => m._id === msg._id)) return prev;

            const senderId = msg.sender?._id?.toString() || msg.sender?.toString();
            const me = userIdRef.current?.toString();

            // If this is our own echo-back, replace optimistic message by requestId first.
            if (senderId === me) {
              if (msg.requestId) {
                const byReq = prev.findIndex((m) => m.requestId && m.requestId === msg.requestId);
                if (byReq !== -1) {
                  return prev.map((m, i) => i === byReq ? msg : m);
                }
              }

              // Legacy fallback: match temp by content
              const tempIdx = prev.findIndex(
                m => String(m._id).startsWith('temp-') && m.content === msg.content
              );
              if (tempIdx !== -1) {
                return prev.map((m, i) => i === tempIdx ? msg : m);
              }
            }

            return [...prev, msg];
          });
        }
        // Always refresh conversation list (last-message preview + unread badge)
        fetchConversations();
        break;
      }
      case 'message:read':
        setMessages(prev => prev.map(m =>
          data.messageIds?.includes(m._id) ? { ...m, isRead: true } : m
        ));
        break;
      case 'conversation:update':
        fetchConversations();
        break;
      case 'typing:start':
        if (data.conversationId === convo?._id) {
          setTypingUsers(prev => new Set([...prev, data.userId]));
        }
        break;
      case 'typing:stop':
        if (data.conversationId === convo?._id) {
          setTypingUsers(prev => { const s = new Set(prev); s.delete(data.userId); return s; });
        }
        break;
      case 'message:delivered':
        setDeliveryStatus(prev => new Map([...prev, [data.messageId, data.deliveredAt]]));
        break;
      case 'user:online':
        if (data?.userId) {
          setOnlineUsers(prev => ({
            ...prev,
            [data.userId]: { isOnline: true, lastSeen: null }
          }));
        }
        break;
      case 'user:offline':
        if (data?.userId) {
          setOnlineUsers(prev => ({
            ...prev,
            [data.userId]: { isOnline: false, lastSeen: data.lastSeen || new Date().toISOString() }
          }));
        }
        break;
      case 'socket:connect':
        if (convo?._id) syncConversationSinceLastSeq(convo._id).catch(() => {});
        break;
      default:
        break;
    }
  // selectedConvoRef is a ref (never a dep); fetchConversations is stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchConversations, syncConversationSinceLastSeq]);

  const socketRef = useSocket({ token, onEvent: handleSocketEvent });

  const initiateCall = useCallback((recipient, type = 'video') => {
    if (!socketRef.current || !recipient?._id) return;

    socketRef.current.emit('call:initiate', {
      recipientId: recipient._id,
      type,
      conversationId: selectedConvo?._id,
    });

    // Listen for call initiated response
    const handler = ({ callId }) => {
      window.dispatchEvent(new CustomEvent('fetchwork:start-call', {
        detail: { callId, remoteUser: recipient, type },
      }));
      socketRef.current.off('call:initiated', handler);
    };
    socketRef.current.on('call:initiated', handler);

    // Handle error
    const errHandler = ({ message }) => {
      alert(message || 'Could not start call');
      socketRef.current.off('call:error', errHandler);
    };
    socketRef.current.on('call:error', errHandler);
    setTimeout(() => socketRef.current.off('call:error', errHandler), 5000);
  }, [socketRef, selectedConvo]);

  const fetchMessages = useCallback(async (convo) => {
    try {
      const data = await apiRequest(`/api/messages/conversations/${convo._id}`);
      setMessages(data.messages || []);
      setSelectedConvo(data.conversation || convo);
      setMobileView('chat');
      const seqs = (data.messages || []).map((m) => Number(m.seq || 0)).filter((n) => Number.isFinite(n));
      lastSeqByConvoRef.current[convo._id] = seqs.length ? Math.max(...seqs) : Number(lastSeqByConvoRef.current[convo._id] || 0);

      const unread = (data.messages || []).filter(m => !m.isRead && m.recipient === userId);
      if (unread.length > 0 && socketRef.current) {
        socketRef.current.emit('message:read', {
          conversationId: convo._id,
          messageIds: unread.map(m => m._id)
        });
      }
    } catch (err) {
      setError(err.data?.error || err.message || 'Failed to load messages');
    }
  }, [userId]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && attachFiles.length === 0) || !selectedConvo || sending) return;

    setSending(true);
    const content = newMessage.trim();
    const hasFiles = attachFiles.length > 0;
    const requestId = (window.crypto?.randomUUID?.() || `req-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const optimistic = {
      _id: `temp-${Date.now()}`,
      requestId,
      content: content || (hasFiles ? `📎 Sent ${attachFiles.length} file${attachFiles.length > 1 ? 's' : ''}` : ''),
      sender: { _id: userId, firstName: user?.firstName, lastName: user?.lastName },
      createdAt: new Date().toISOString(),
      isRead: false,
      conversation: selectedConvo._id,
      attachments: attachFiles.map(f => ({ filename: f.name, url: URL.createObjectURL(f), size: f.size, mimeType: f.type }))
    };
    setMessages(prev => [...prev, optimistic]);
    setNewMessage('');
    setAttachFiles([]);

    try {
      const other = selectedConvo.participants?.find(p => p._id !== userId);

      if (hasFiles) {
        // Use upload endpoint for files
        const formData = new FormData();
        if (content) formData.append('content', content);
        attachFiles.forEach(f => formData.append('attachments', f));

        const token = localStorage.getItem('token');
        const baseUrl = process.env.REACT_APP_API_URL || '';
        const resp = await fetch(
          `${baseUrl}/api/messages/conversations/${selectedConvo._id}/messages/upload`,
          { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData }
        );
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Upload failed');
        setMessages(prev => prev.map(m => m._id === optimistic._id ? data.data : m));
        fetchConversations();
      } else if (socketRef.current) {
        socketRef.current.emit('message:send', {
          v: 1,
          requestId,
          correlationId: requestId,
          clientTs: Date.now(),
          recipientId: other?._id,
          content,
          messageType: 'text'
        }, (ack) => {
          if (!ack?.ok) {
            setMessages(prev => prev.filter(m => m._id !== optimistic._id));
            setError(ack?.message || 'Failed to send message');
          }
        });
      } else {
        const res = await apiRequest(
          `/api/messages/conversations/${selectedConvo._id}/messages`,
          { method: 'POST', body: JSON.stringify({ content }) }
        );
        setMessages(prev => prev.map(m => m._id === optimistic._id ? res.data : m));
        fetchConversations();
      }
    } catch (err) {
      setError('Failed to send message');
      setMessages(prev => prev.filter(m => m._id !== optimistic._id));
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (socketRef.current && selectedConvo) {
      socketRef.current.emit('typing:start', { conversationId: selectedConvo._id });
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current?.emit('typing:stop', { conversationId: selectedConvo._id });
      }, 2000);
    }
  };

  useEffect(() => { if (user) fetchConversations(); }, [user, fetchConversations]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Auto-open conversation from URL ?conversation=ID
  useEffect(() => {
    const params = new URLSearchParams(locationSearch);
    const targetId = params.get('conversation');
    if (targetId && conversations.length > 0 && !selectedConvo) {
      const match = conversations.find(c => c._id === targetId);
      if (match) fetchMessages(match);
    }
  }, [locationSearch, conversations]); // eslint-disable-line react-hooks/exhaustive-deps

  const otherParticipant = selectedConvo?.participants?.find(p => p._id !== userId);

  // Filter conversations
  const filtered = conversations.filter(c => {
    if (filter === 'unread' && !c.unreadCount) return false;
    if (search) {
      const other = c.participants?.find(p => p._id !== userId);
      const name = `${other?.firstName} ${other?.lastName}`.toLowerCase();
      const jobTitle = c.job?.title?.toLowerCase() || '';
      return name.includes(search.toLowerCase()) || jobTitle.includes(search.toLowerCase());
    }
    return true;
  });

  return (
    <div className="messages-page">
      <SEO title="Messages" path="/messages" noIndex={true} />
      {/* Header */}
      <div className="messages-header">
        <div className="messages-header-left">
          {mobileView === 'chat' && (
            <button className="mobile-back-btn" onClick={() => setMobileView('inbox')}>← Back</button>
          )}
          <h1>Messages</h1>
        </div>
        <div className="messages-header-right">
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search conversations..." className="messages-search"
          />
        </div>
      </div>

      {error && <div className="messages-error">⚠️ {error} <button onClick={() => setError(null)}>×</button></div>}

      <div className="messages-layout">
        {/* ── Inbox ──────────────────────────────────────────── */}
        <div className={`messages-inbox ${mobileView === 'inbox' ? 'mobile-show' : 'mobile-hide'}`}>
          <div className="inbox-filters">
            <button className={`inbox-filter ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
            <button className={`inbox-filter ${filter === 'unread' ? 'active' : ''}`} onClick={() => setFilter('unread')}>Unread</button>
          </div>
          <div className="inbox-list">
            {loading ? (
              <div className="inbox-loading">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="inbox-empty">
                <p>{search ? 'No matching conversations' : 'No conversations yet'}</p>
                <p className="inbox-empty-sub">Start by applying to a job or posting one</p>
              </div>
            ) : (
              filtered.map(c => (
                <ConvoItem
                  key={c._id} convo={c} userId={userId}
                  selected={selectedConvo?._id === c._id}
                  onClick={() => fetchMessages(c)}
                  onlineStatus={onlineUsers}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Chat Thread ────────────────────────────────────── */}
        <div className={`messages-chat ${mobileView === 'chat' ? 'mobile-show' : 'mobile-hide'}`}>
          {selectedConvo ? (
            <>
              {selectedConvo.service && selectedConvo.serviceOrderId && (
                <OrderStatusBar
                  serviceId={selectedConvo.service._id || selectedConvo.service}
                  orderId={String(selectedConvo.serviceOrderId)}
                  userId={userId}
                  onAction={() => fetchMessages(selectedConvo)}
                />
              )}
              <div className="chat-header">
                <div className="chat-header-info">
                  <div className="chat-avatar">
                    {otherParticipant?.profilePicture ? (
                      <img src={otherParticipant.profilePicture} alt="" />
                    ) : (
                      <span>{otherParticipant?.firstName?.[0]}{otherParticipant?.lastName?.[0]}</span>
                    )}
                  </div>
                  <div>
                    <h3>{otherParticipant?.firstName} {otherParticipant?.lastName}</h3>
                    {otherParticipant?._id && onlineUsers[otherParticipant._id] !== undefined && (
                      <OnlineStatus
                        isOnline={onlineUsers[otherParticipant._id]?.isOnline ?? false}
                        lastSeen={onlineUsers[otherParticipant._id]?.lastSeen}
                        size="sm"
                      />
                    )}
                    {selectedConvo.job && (
                      <Link
                        to={`/jobs/${selectedConvo.job._id}`}
                        className="chat-job-link"
                      >
                        📋 {selectedConvo.job.title} →
                      </Link>
                    )}
                  </div>
                </div>
                <div className="chat-header-actions">
                  <button
                    className="call-btn"
                    title="Voice call"
                    onClick={() => initiateCall(otherParticipant, 'audio')}
                  >
                    📞
                  </button>
                  <button
                    className="call-btn"
                    title="Video call"
                    onClick={() => initiateCall(otherParticipant, 'video')}
                  >
                    🎥
                  </button>
                  <button className="context-toggle" onClick={() => setShowContext(!showContext)}>
                    ℹ️
                  </button>
                </div>
              </div>

              <div className="chat-messages">
                {messages.length === 0 ? (
                  <div className="chat-empty"><p>No messages yet. Start the conversation!</p></div>
                ) : (
                  messages.map(msg => (
                    <MsgBubble
                      key={msg._id} msg={msg}
                      isMine={msg.sender?._id === userId || msg.sender === userId}
                      deliveryStatus={deliveryStatus}
                      userId={userId}
                      onProposalAction={() => fetchMessages(selectedConvo)}
                    />
                  ))
                )}
                {typingUsers.size > 0 && (
                  <div className="typing-indicator">
                    {otherParticipant?.firstName} is typing...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {attachFiles.length > 0 && (
                <div className="attach-preview">
                  {attachFiles.map((f, i) => (
                    <div key={i} className="attach-preview-item">
                      <span className="attach-preview-name">{f.type?.startsWith('image/') ? '🖼️' : '📄'} {f.name}</span>
                      <span className="attach-preview-size">{(f.size / 1024).toFixed(0)}KB</span>
                      <button type="button" className="attach-preview-remove" onClick={() => setAttachFiles(prev => prev.filter((_, idx) => idx !== i))}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <form className="chat-composer" onSubmit={sendMessage}>
                <input
                  type="file" ref={fileInputRef} multiple hidden
                  accept="image/*,.pdf,.doc,.docx,.txt"
                  onChange={e => {
                    const files = Array.from(e.target.files || []).slice(0, 5);
                    setAttachFiles(prev => [...prev, ...files].slice(0, 5));
                    e.target.value = '';
                  }}
                />
                <button type="button" className="attach-btn" onClick={() => fileInputRef.current?.click()} title="Attach file">
                  📎
                </button>
                <input
                  type="text" value={newMessage} onChange={handleTyping}
                  placeholder="Type a message..."
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) sendMessage(e); }}
                  disabled={sending}
                  onBlur={() => {
                    socketRef.current?.emit('typing:stop', { conversationId: selectedConvo._id });
                    clearTimeout(typingTimeoutRef.current);
                  }}
                />
                <button type="submit" disabled={(!newMessage.trim() && attachFiles.length === 0) || sending} className="send-btn">
                  {sending ? '...' : '→'}
                </button>
              </form>

              {/* Quick Actions */}
              <div className="chat-quick-actions">
                {selectedConvo.job && (
                  <Link to={`/disputes`} className="quick-act">⚖️ Dispute</Link>
                )}
                <button className="quick-act">💳 Request Payment</button>
                <button className="quick-act">📅 Schedule</button>
              </div>
            </>
          ) : (
            <div className="chat-placeholder">
              <div className="chat-placeholder-icon">💬</div>
              <h3>Select a conversation</h3>
              <p>Choose from the left to start messaging</p>
            </div>
          )}
        </div>

        {/* ── Context Panel ──────────────────────────────────── */}
        {selectedConvo && showContext && (
          <div className="messages-context">
            <div className="context-header">
              <h3>Details</h3>
              <button onClick={() => setShowContext(false)}>×</button>
            </div>
            <div className="context-profile">
              <div className="context-avatar">
                {otherParticipant?.profilePicture ? (
                  <img src={otherParticipant.profilePicture} alt="" />
                ) : (
                  <span>{otherParticipant?.firstName?.[0]}{otherParticipant?.lastName?.[0]}</span>
                )}
              </div>
              <h4>{otherParticipant?.firstName} {otherParticipant?.lastName}</h4>
              <Link to={`/freelancers/${otherParticipant?._id}`} className="context-link">View Profile</Link>
            </div>
            {selectedConvo.job && (
              <div className="context-section">
                <h4>Linked Job</h4>
                <Link to={`/jobs/${selectedConvo.job._id}`} className="context-job-card">
                  <span>{selectedConvo.job.title}</span>
                  <span className="context-job-budget">{selectedConvo.job.budget?.amount ? `$${selectedConvo.job.budget.amount}` : ''}</span>
                </Link>
              </div>
            )}
            {selectedConvo.service && (
              <div className="context-section">
                <h4>Linked Service</h4>
                <Link to={`/services/${selectedConvo.service._id}`} className="context-job-card">
                  <span>{selectedConvo.service.title}</span>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;


