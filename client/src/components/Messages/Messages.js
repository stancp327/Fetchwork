import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../socket/useSocket';
import { getApiBaseUrl } from '../../utils/api';
import './Messages.css';

// ── Time Formatting ─────────────────────────────────────────────
const formatTime = (ts) => {
  const d = new Date(ts);
  const now = new Date();
  const hrs = (now - d) / 3600000;
  if (hrs < 24) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (hrs < 168) return d.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

// ── Conversation Item ───────────────────────────────────────────
const ConvoItem = ({ convo, selected, userId, onClick }) => {
  const other = convo.participants?.find(p => p._id !== userId);
  const unread = convo.unreadCount > 0;

  return (
    <div className={`convo-item ${selected ? 'selected' : ''} ${unread ? 'unread' : ''}`} onClick={onClick}>
      <div className="convo-avatar">
        {other?.profilePicture ? (
          <img src={other.profilePicture} alt="" />
        ) : (
          <span>{other?.firstName?.[0]}{other?.lastName?.[0]}</span>
        )}
      </div>
      <div className="convo-info">
        <div className="convo-top">
          <span className="convo-name">{other?.firstName} {other?.lastName}</span>
          <span className="convo-time">{formatTime(convo.lastActivity)}</span>
        </div>
        {convo.job && <div className="convo-job">Re: {convo.job.title}</div>}
        {convo.lastMessage && (
          <div className="convo-preview">{convo.lastMessage.content?.substring(0, 60)}{convo.lastMessage.content?.length > 60 ? '...' : ''}</div>
        )}
      </div>
      {unread && <span className="convo-badge">{convo.unreadCount}</span>}
    </div>
  );
};

// ── Message Bubble ──────────────────────────────────────────────
const MsgBubble = ({ msg, isMine, deliveryStatus }) => (
  <div className={`msg-row ${isMine ? 'mine' : 'theirs'}`}>
    <div className="msg-bubble">
      <div className="msg-content">{msg.content}</div>
      {msg.attachments?.length > 0 && (
        <div className="msg-attachments">
          {msg.attachments.map((a, i) => (
            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="msg-attach-link">
              📎 {a.filename || 'Attachment'}
            </a>
          ))}
        </div>
      )}
      <div className="msg-meta">
        <span>{formatTime(msg.createdAt)}</span>
        {isMine && (
          <span className="msg-status">
            {msg.isRead ? '✓✓' : deliveryStatus?.has(msg._id) ? '✓✓' : '✓'}
          </span>
        )}
      </div>
    </div>
  </div>
);

// ── Main Messages ───────────────────────────────────────────────
const Messages = () => {
  const { user } = useAuth();
  const userId = user?._id || user?.id || user?.userId;
  const [conversations, setConversations] = useState([]);
  const [selectedConvo, setSelectedConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [deliveryStatus, setDeliveryStatus] = useState(new Map());
  const [showContext, setShowContext] = useState(false);
  const [mobileView, setMobileView] = useState('inbox');
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const apiBaseUrl = getApiBaseUrl();
  const token = localStorage.getItem('token');

  const socketRef = useSocket({
    token,
    onEvent: (event, data) => {
      switch (event) {
        case 'message:receive':
          setMessages(prev => {
            if (prev.some(m => m._id === data.message._id)) return prev;
            return [...prev, data.message];
          });
          fetchConversations();
          break;
        case 'message:read':
          setMessages(prev => prev.map(m =>
            data.messageIds?.includes(m._id) ? { ...m, isRead: true } : m
          ));
          break;
        case 'conversation:update':
          fetchConversations();
          break;
        case 'typing:start':
          if (data.conversationId === selectedConvo?._id) {
            setTypingUsers(prev => new Set([...prev, data.userId]));
          }
          break;
        case 'typing:stop':
          if (data.conversationId === selectedConvo?._id) {
            setTypingUsers(prev => { const s = new Set(prev); s.delete(data.userId); return s; });
          }
          break;
        case 'message:delivered':
          setDeliveryStatus(prev => new Map([...prev, [data.messageId, data.deliveredAt]]));
          break;
        default:
          break;
      }
    }
  });

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${apiBaseUrl}/api/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConversations(res.data.conversations || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, token]);

  const fetchMessages = useCallback(async (convo) => {
    try {
      const res = await axios.get(`${apiBaseUrl}/api/messages/conversations/${convo._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(res.data.messages || []);
      setSelectedConvo(res.data.conversation || convo);
      setMobileView('chat');

      const unread = (res.data.messages || []).filter(m => !m.isRead && m.recipient === userId);
      if (unread.length > 0 && socketRef.current) {
        socketRef.current.emit('message:read', {
          conversationId: convo._id,
          messageIds: unread.map(m => m._id)
        });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load messages');
    }
  }, [apiBaseUrl, token, userId]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConvo || sending) return;

    setSending(true);
    const optimistic = {
      _id: `temp-${Date.now()}`,
      content: newMessage.trim(),
      sender: { _id: userId, firstName: user?.firstName, lastName: user?.lastName },
      createdAt: new Date().toISOString(),
      isRead: false,
      conversation: selectedConvo._id
    };
    setMessages(prev => [...prev, optimistic]);
    const content = newMessage.trim();
    setNewMessage('');

    try {
      const other = selectedConvo.participants?.find(p => p._id !== userId);
      if (socketRef.current) {
        socketRef.current.emit('message:send', {
          recipientId: other?._id,
          content,
          messageType: 'text'
        });
      } else {
        const res = await axios.post(
          `${apiBaseUrl}/api/messages/conversations/${selectedConvo._id}/messages`,
          { content },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setMessages(prev => prev.map(m => m._id === optimistic._id ? res.data.data : m));
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
                />
              ))
            )}
          </div>
        </div>

        {/* ── Chat Thread ────────────────────────────────────── */}
        <div className={`messages-chat ${mobileView === 'chat' ? 'mobile-show' : 'mobile-hide'}`}>
          {selectedConvo ? (
            <>
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
                    {selectedConvo.job && <p className="chat-job-link">Re: {selectedConvo.job.title}</p>}
                  </div>
                </div>
                <button className="context-toggle" onClick={() => setShowContext(!showContext)}>
                  ℹ️
                </button>
              </div>

              <div className="chat-messages">
                {messages.length === 0 ? (
                  <div className="chat-empty"><p>No messages yet. Start the conversation!</p></div>
                ) : (
                  messages.map(msg => (
                    <MsgBubble
                      key={msg._id} msg={msg}
                      isMine={msg.sender?._id === userId}
                      deliveryStatus={deliveryStatus}
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

              <form className="chat-composer" onSubmit={sendMessage}>
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
                <button type="submit" disabled={!newMessage.trim() || sending} className="send-btn">
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
