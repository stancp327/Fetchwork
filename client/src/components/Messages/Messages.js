import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../socket/useSocket';
import { apiRequest } from '../../utils/api';
import OnlineStatus from '../common/OnlineStatus';
import CustomOfferModal from '../Offers/CustomOfferModal';
import '../Offers/CustomOffer.css';
import './Messages.css';
import SEO from '../common/SEO';

import { ConvoItem, MsgBubble, OrderStatusBar } from './parts/components';
import SafetyNudge from './parts/SafetyNudge';

import useConversations from './hooks/useConversations';
import useReceiptSync from './hooks/useReceiptSync';
import useMessages from './hooks/useMessages';
import useScheduling from './hooks/useScheduling';
import usePayments from './hooks/usePayments';
import { getEntityId, idEq } from './utils';

const extractAppointmentId = (content) => {
  if (!content || typeof content !== 'string') return null;
  const m = content.match(/\[appt:([0-9a-fA-F-]{10,})\]/);
  return m?.[1] || null;
};

const extractPayReqId = (content) => {
  if (!content || typeof content !== 'string') return null;
  const m = content.match(/\[pr:([a-fA-F0-9]{24})\]/);
  return m?.[1] || null;
};

const extractOfferId = (content) => {
  if (!content || typeof content !== 'string') return null;
  const m = content.match(/\[offer:([a-fA-F0-9]{24})\]/);
  return m?.[1] || null;
};

const Highlight = ({ text = '', query = '' }) => {
  if (!query || !text) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((p, i) =>
    new RegExp(`^${escaped}$`, 'i').test(p)
      ? <mark key={i} className="search-highlight">{p}</mark>
      : p
  );
};

const translateLanguages = [
  { code: 'es', label: 'Spanish' }, { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' }, { code: 'zh', label: 'Chinese' },
  { code: 'ja', label: 'Japanese' }, { code: 'pt', label: 'Portuguese' },
  { code: 'ar', label: 'Arabic' }, { code: 'hi', label: 'Hindi' },
];

// ── Search Result Item ───────────────────────────────────────────
// Separate from ConvoItem: shows highlighted name, job title, and message snippets.
const SearchResultItem = ({ convo, selected, userId, query, onClick }) => {
  const other = convo.participants?.find(p => String(p._id) !== String(userId));
  const name = `${other?.firstName || ''} ${other?.lastName || ''}`.trim();
  return (
    <div className={`convo-item ${selected ? 'selected' : ''}`} onClick={onClick}>
      <div className="convo-avatar">
        {other?.profilePicture
          ? <img src={other.profilePicture} alt="" />
          : <span>{other?.firstName?.[0]}{other?.lastName?.[0]}</span>}
      </div>
      <div className="convo-info">
        <div className="convo-top">
          <span className="convo-name"><Highlight text={name} query={query} /></span>
        </div>
        {convo.job?.title && (
          <div className="convo-job"><Highlight text={`📋 ${convo.job.title}`} query={query} /></div>
        )}
        {convo.matchedMessages?.map((m, i) => {
          const clean = (m.content || '')
            .replace(/\s*\[appt:[0-9a-fA-F-]{10,}\]/g, '')
            .replace(/\s*\[offer:[a-fA-F0-9]{24}\]/g, '')
            .replace(/\s*\[pr:[a-fA-F0-9]{24}\]/g, '')
            .trim();
          const idx = clean.toLowerCase().indexOf(query.toLowerCase());
          const start = Math.max(0, idx - 30);
          const snippet = (start > 0 ? '…' : '') + clean.slice(start, start + 100) + (clean.length > start + 100 ? '…' : '');
          return (
            <div key={i} className="convo-preview">
              <Highlight text={snippet} query={query} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────────
const Messages = () => {
  const { user } = useAuth();
  const { search: locationSearch } = useLocation();
  const navigate = useNavigate();
  const userId = getEntityId(user?._id || user?.id || user?.userId);
  const token = localStorage.getItem('token');

  // Feature flags
  const [userFeatures, setUserFeatures] = useState([]);
  const [featuresLoaded, setFeaturesLoaded] = useState(false);
  const userFeatureList = Array.isArray(userFeatures) ? userFeatures : Object.keys(userFeatures || {});
  const canCall = !featuresLoaded || userFeatureList.includes('audio_calls') || userFeatureList.includes('video_calls');

  // UI state
  const [selectedConvo, setSelectedConvo] = useState(null);
  const [mobileView, setMobileView] = useState('inbox');
  const [showContext, setShowContext] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [deliveryStatus, setDeliveryStatus] = useState(new Map());
  const [onlineUsers, setOnlineUsers] = useState({});
  const [contextProfile, setContextProfile] = useState(null);
  const [contextProfileLoading, setContextProfileLoading] = useState(false);
  const [callGateModal, setCallGateModal] = useState(null);
  const [aiDrafting, setAiDrafting] = useState(false);
  const [disputeRisk, setDisputeRisk] = useState(null);
  const [disputeRiskLoading, setDisputeRiskLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const prevMessagesLenRef = useRef(0);
  const selectedConvoRef = useRef(selectedConvo);
  useEffect(() => { selectedConvoRef.current = selectedConvo; }, [selectedConvo]);
  const userIdRef = useRef(userId);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // ── Hooks ──────────────────────────────────────────────────────
  // Pre-declare socketRef so useMessages and useSocket share the same ref object.
  // useSocket will populate .current once the socket connects.
  const socketRef = useRef(null);

  const convoHook = useConversations(userId);
  const receiptHook = useReceiptSync();

  const msgHook = useMessages({
    userId,
    user,
    selectedConvoRef,
    socketRef,
    lastSeqByConvoRef: receiptHook.lastSeqByConvoRef,
    updateReceiptCursor: receiptHook.updateReceiptCursor,
  });

  const schedHook = useScheduling({
    selectedConvo,
    setMessages: msgHook.setMessages,
  });

  const payHook = usePayments({
    selectedConvo,
    userId,
    setMessages: msgHook.setMessages,
  });

  const otherParticipant = selectedConvo?.participants?.find(
    p => String(getEntityId(p?._id || p)) !== String(userId)
  );

  // ── Socket handler ─────────────────────────────────────────────
  const handleSocketEvent = useCallback((event, data) => {
    const convo = selectedConvoRef.current;
    switch (event) {
      case 'message:receive': {
        const msg = data?.message;
        if (!msg) break;
        if (msg?.conversation && Number.isFinite(Number(msg.seq))) {
          const cid = msg.conversation?.toString?.() || msg.conversation;
          receiptHook.lastSeqByConvoRef.current[cid] = Math.max(
            Number(receiptHook.lastSeqByConvoRef.current[cid] || 0), Number(msg.seq)
          );
        }
        const msgConvoId = msg.conversation?.toString() || msg.conversation;
        const currentConvoId = convo?._id?.toString();
        if (msgConvoId && currentConvoId && msgConvoId === currentConvoId) {
          msgHook.setMessages(prev => {
            if (prev.some(m => m._id === msg._id)) return prev;
            const senderId = msg.sender?._id?.toString() || msg.sender?.toString();
            const me = userIdRef.current?.toString();
            if (senderId === me) {
              if (msg.requestId) {
                const byReq = prev.findIndex((m) => m.requestId && m.requestId === msg.requestId);
                if (byReq !== -1) return prev.map((m, i) => i === byReq ? msg : m);
              }
              const tempIdx = prev.findIndex(m => String(m._id).startsWith('temp-') && m.content === msg.content);
              if (tempIdx !== -1) return prev.map((m, i) => i === tempIdx ? msg : m);
            }
            return [...prev, msg];
          });
        }
        break;
      }
      case 'conversation:update':
        if (data?.conversation) {
          convoHook.updateConversationLocally(data.conversation);
        } else {
          convoHook.fetchConversations();
        }
        break;
      case 'message:read':
        msgHook.setMessages(prev => prev.map(m =>
          data.messageIds?.includes(m._id) ? { ...m, isRead: true } : m
        ));
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
      case 'rcpt:update':
        // Only do a full refetch if the server sends no data — prefer local update
        if (data?.conversation) {
          convoHook.updateConversationLocally(data.conversation);
        } else {
          convoHook.fetchConversations();
        }
        break;
      case 'safety:nudge':
        if (data?.copy) msgHook.setSafetyNudge(data.copy);
        break;
      case 'user:online':
        if (data?.userId) setOnlineUsers(prev => ({ ...prev, [data.userId]: { isOnline: true, lastSeen: null } }));
        break;
      case 'user:offline':
        if (data?.userId) setOnlineUsers(prev => ({ ...prev, [data.userId]: { isOnline: false, lastSeen: data.lastSeen || new Date().toISOString() } }));
        break;
      case 'socket:connect':
        if (convo?._id) receiptHook.syncConversationSinceLastSeq(convo._id, selectedConvoRef, msgHook.setMessages).catch(() => {});
        break;
      default:
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convoHook.fetchConversations, convoHook.updateConversationLocally, receiptHook.syncConversationSinceLastSeq]);

  // Inject the pre-declared socketRef so useMessages gets socket access
  useSocket({ token, onEvent: handleSocketEvent, socketRef });

  // ── Derived callbacks ──────────────────────────────────────────
  const openConversation = useCallback(async (convo) => {
    const updated = await msgHook.fetchMessages(convo);
    if (updated) {
      setSelectedConvo(updated);
      setMobileView('chat');
    }
  }, [msgHook.fetchMessages]);

  const initiateCall = useCallback((recipient, type = 'video') => {
    if (!socketRef.current || !recipient?._id) return;
    socketRef.current.emit('call:initiate', {
      recipientId: recipient._id,
      type,
      conversationId: selectedConvo?._id,
    });

    const socket = socketRef.current;

    const handler = ({ callId }) => {
      window.dispatchEvent(new CustomEvent('fetchwork:start-call', {
        detail: { callId, remoteUser: recipient, type },
      }));
      cleanup();
    };
    const gateHandler = ({ type: callType, message }) => {
      setCallGateModal({ type: callType, message });
      cleanup();
    };
    const errHandler = ({ message }) => {
      alert(message || 'Could not start call');
      cleanup();
    };

    const cleanup = () => {
      socket.off('call:initiated', handler);
      socket.off('call:feature-gated', gateHandler);
      socket.off('call:error', errHandler);
    };

    socket.on('call:initiated', handler);
    socket.on('call:feature-gated', gateHandler);
    socket.on('call:error', errHandler);

    // Hard timeout — remove all listeners if no response within 8s
    setTimeout(cleanup, 8000);
  }, [socketRef, selectedConvo]);

  // ── Side effects ───────────────────────────────────────────────
  useEffect(() => { if (user) convoHook.fetchConversations(); }, [user, convoHook.fetchConversations]);

  useEffect(() => {
    apiRequest('/api/auth/me/features')
      .then(data => {
        const raw = data?.features;
        const normalized = Array.isArray(raw) ? raw : (raw && typeof raw === 'object') ? Object.keys(raw).filter((k) => !!raw[k]) : [];
        setUserFeatures(normalized);
        setFeaturesLoaded(true);
      })
      .catch(() => setFeaturesLoaded(true));
  }, []);

  // Online status for conversation participants
  useEffect(() => {
    if (convoHook.conversations.length === 0) return;
    const ids = [...new Set(
      convoHook.conversations.flatMap(c => (c.participants || []).map(p => getEntityId(p?._id || p)).filter(Boolean))
    )].filter(id => String(id) !== String(userId));
    if (ids.length === 0) return;
    apiRequest(`/api/users/online-status?ids=${ids.join(',')}`)
      .then(data => setOnlineUsers(data.statuses || {}))
      .catch(() => {});
  }, [convoHook.conversations, userId]);

  // Context panel profile
  useEffect(() => {
    if (!showContext || !otherParticipant?._id) { setContextProfile(null); return; }
    setContextProfileLoading(true);
    apiRequest(`/api/freelancers/${getEntityId(otherParticipant._id)}`)
      .then(data => setContextProfile(data))
      .catch(() => setContextProfile(null))
      .finally(() => setContextProfileLoading(false));
  }, [showContext, otherParticipant?._id]);

  // Auto-open from URL
  useEffect(() => {
    const params = new URLSearchParams(locationSearch);
    const targetId = params.get('conversation');
    if (targetId && convoHook.conversations.length > 0 && !selectedConvo) {
      const match = convoHook.conversations.find(c => c._id === targetId);
      if (match) openConversation(match);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationSearch, convoHook.conversations]);

  // Auto-scroll
  useEffect(() => {
    const el = chatMessagesRef.current;
    if (!el) return;
    const prevLen = prevMessagesLenRef.current;
    const currLen = msgHook.messages.length;
    const appended = currLen > prevLen;
    prevMessagesLenRef.current = currLen;
    if (!appended) return;
    const last = msgHook.messages[currLen - 1];
    const lastSenderId = String(getEntityId(last?.sender?._id || last?.sender));
    const isMine = lastSenderId === String(userId);
    if (isMine || shouldAutoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [msgHook.messages, userId]);

  // ── Render ─────────────────────────────────────────────────────
  const combinedError = convoHook.error || msgHook.error;

  return (
    <div className="messages-page">
      <SEO title="Messages" path="/messages" noIndex={true} />
      <div className="messages-header">
        <div className="messages-header-left">
          {mobileView === 'chat' && (
            <button className="mobile-back-btn" onClick={() => setMobileView('inbox')}>← Back</button>
          )}
          <h1>Messages</h1>
        </div>
        <div className="messages-header-right">
          <input
            type="text" value={convoHook.search}
            onChange={e => { convoHook.setSearch(e.target.value); if (!e.target.value.trim()) convoHook.setSearchResults(null); }}
            placeholder="Search messages..." className="messages-search"
          />
        </div>
      </div>

      <SafetyNudge text={msgHook.safetyNudge} onClose={() => msgHook.setSafetyNudge(null)} />
      {combinedError && (
        <div className="messages-error">
          ⚠️ {combinedError}
          <button onClick={() => { convoHook.setError(null); msgHook.setError(null); }}>×</button>
        </div>
      )}

      <div className="messages-layout">
        {/* ── Inbox ── */}
        <div className={`messages-inbox ${mobileView === 'inbox' ? 'mobile-show' : 'mobile-hide'}`}>
          <div className="inbox-filters">
            <button className={`inbox-filter ${convoHook.filter === 'all' ? 'active' : ''}`} onClick={() => convoHook.setFilter('all')}>All</button>
            <button className={`inbox-filter ${convoHook.filter === 'unread' ? 'active' : ''}`} onClick={() => convoHook.setFilter('unread')}>Unread</button>
          </div>
          <div className="inbox-list">
            {convoHook.loading ? (
              <div className="inbox-loading">Loading...</div>
            ) : convoHook.searchResults !== null ? (
              convoHook.searchLoading ? (
                <div className="inbox-loading">Searching…</div>
              ) : convoHook.searchResults.length === 0 ? (
                <div className="inbox-empty"><p>No results for "{convoHook.search}"</p></div>
              ) : (
                convoHook.searchResults.map(c => (
                  <SearchResultItem
                    key={c._id}
                    convo={c}
                    selected={selectedConvo?._id === c._id}
                    userId={userId}
                    query={convoHook.search}
                    onClick={() => openConversation(c)}
                  />
                ))
              )
            ) : convoHook.filtered.length === 0 ? (
              <div className="inbox-empty">
                <p>No conversations yet</p>
                <p className="inbox-empty-sub">Start by applying to a job or posting one</p>
              </div>
            ) : (
              convoHook.filtered.map(c => (
                <ConvoItem
                  key={c._id} convo={c} userId={userId}
                  selected={selectedConvo?._id === c._id}
                  onClick={() => openConversation(c)}
                  onlineStatus={onlineUsers}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Chat Thread ── */}
        <div className={`messages-chat ${mobileView === 'chat' ? 'mobile-show' : 'mobile-hide'}`}>
          {selectedConvo ? (
            <>
              {selectedConvo.service && selectedConvo.serviceOrderId && (
                <OrderStatusBar
                  serviceId={selectedConvo.service._id || selectedConvo.service}
                  orderId={String(selectedConvo.serviceOrderId)}
                  userId={userId}
                  onAction={() => openConversation(selectedConvo)}
                />
              )}
              <div className="chat-header">
                <div className="chat-header-info">
                  <Link to={`/freelancers/${getEntityId(otherParticipant?._id || otherParticipant)}`} style={{ textDecoration: 'none', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <div className="chat-avatar">
                      {otherParticipant?.profilePicture ? (
                        <img src={otherParticipant.profilePicture} alt="" />
                      ) : (
                        <span>{otherParticipant?.firstName?.[0]}{otherParticipant?.lastName?.[0]}</span>
                      )}
                    </div>
                  </Link>
                  <div>
                    <h3>
                      <Link to={`/freelancers/${getEntityId(otherParticipant?._id || otherParticipant)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        {otherParticipant?.firstName} {otherParticipant?.lastName}
                      </Link>
                    </h3>
                    {getEntityId(otherParticipant?._id || otherParticipant) && onlineUsers[getEntityId(otherParticipant?._id || otherParticipant)] !== undefined && (
                      <OnlineStatus
                        isOnline={onlineUsers[getEntityId(otherParticipant?._id || otherParticipant)]?.isOnline ?? false}
                        lastSeen={onlineUsers[getEntityId(otherParticipant?._id || otherParticipant)]?.lastSeen}
                        size="sm"
                      />
                    )}
                    {selectedConvo.job && (
                      <Link
                        to={`/jobs/${selectedConvo.job._id}`}
                        state={{ returnTo: `/messages?conversation=${selectedConvo._id}` }}
                        className="chat-job-link"
                      >
                        📋 {selectedConvo.job.title} →
                      </Link>
                    )}
                  </div>
                </div>
                <div className="chat-header-actions">
                  <button
                    className={`call-btn${!canCall ? ' call-btn--locked' : ''}`}
                    title={canCall ? 'Voice call' : 'Voice call — Plus plan required'}
                    onClick={() => canCall ? initiateCall(otherParticipant, 'audio') : setCallGateModal({ type: 'audio' })}
                  >
                    📞{!canCall && <span className="call-lock">🔒</span>}
                  </button>
                  <button
                    className={`call-btn${!canCall ? ' call-btn--locked' : ''}`}
                    title={canCall ? 'Video call' : 'Video call — Plus plan required'}
                    onClick={() => canCall ? initiateCall(otherParticipant, 'video') : setCallGateModal({ type: 'video' })}
                  >
                    🎥{!canCall && <span className="call-lock">🔒</span>}
                  </button>
                  <button className="context-toggle" onClick={() => setShowContext(!showContext)}>
                    ℹ️
                  </button>
                </div>
              </div>

              <div
                className="chat-messages"
                ref={chatMessagesRef}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
                  shouldAutoScrollRef.current = distanceFromBottom < 48;
                }}
              >
                {msgHook.messages.length === 0 ? (
                  <div className="chat-empty"><p>No messages yet. Start the conversation!</p></div>
                ) : (
                  msgHook.messages.map(msg => {
                    const isMine = idEq(msg.sender?._id || msg.sender, userId);
                    const apptId = extractAppointmentId(msg.content);
                    const appt = apptId ? schedHook.appointmentsById[apptId] : null;
                    const prId = extractPayReqId(msg.content);
                    const pr = prId ? payHook.payRequestsById[prId] : null;
                    return (
                      <div key={msg._id} className="msg-ai-tr-wrap">
                        <MsgBubble
                          msg={msg}
                          isMine={isMine}
                          deliveryStatus={deliveryStatus}
                          userId={userId}
                          onProposalAction={() => openConversation(selectedConvo)}
                        />

                        {apptId && (
                          <div className="appt-card">
                            <div className="appt-card-header">
                              <div className="appt-card-title">Appointment</div>
                              <div className="appt-card-status">{appt?.status ? appt.status.toUpperCase() : '…'}</div>
                            </div>
                            {appt ? (
                              <>
                                <div className="appt-card-body">
                                  <div><strong>When:</strong> {new Date(appt.startAtUtc).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</div>
                                  <div><strong>Duration:</strong> {Math.round((new Date(appt.endAtUtc).getTime() - new Date(appt.startAtUtc).getTime()) / 60000)} min</div>
                                  <div><strong>Type:</strong> {appt.appointmentType}</div>
                                  {appt.notes && <div><strong>Notes:</strong> {appt.notes}</div>}
                                </div>
                                {appt.status === 'proposed' && (
                                  <div className="appt-card-actions">
                                    {String(appt.proposedById) === String(userId) ? (
                                      <div className="appt-card-waiting">Waiting for approval…</div>
                                    ) : (
                                      <>
                                        <button type="button" className="offer-btn-primary" disabled={schedHook.actingApptId === appt.id} onClick={() => schedHook.handleApptApprove(appt.id)}>Approve</button>
                                        <button type="button" className="offer-btn-secondary" disabled={schedHook.actingApptId === appt.id} onClick={() => schedHook.handleApptDecline(appt.id)}>Decline</button>
                                      </>
                                    )}
                                  </div>
                                )}
                                {(appt.status === 'proposed' || appt.status === 'confirmed') && (
                                  <div className="appt-card-edit">
                                    <button type="button" className="offer-btn-secondary" disabled={schedHook.actingApptId === appt.id} onClick={() => { schedHook.setEditingApptId(appt.id); schedHook.setShowScheduleModal(true); }}>✏️ Edit</button>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="appt-card-loading">Loading appointment…</div>
                            )}
                          </div>
                        )}

                        {/* Payment Request Card */}
                        {prId && (
                          <div className="pr-card">
                            <div className="pr-card-header">
                              <div className="pr-card-title">💳 Payment Request</div>
                              <div className={`pr-card-status pr-card-status--${pr?.status || 'pending'}`}>
                                {pr ? pr.status.toUpperCase() : '…'}
                              </div>
                            </div>
                            {pr ? (
                              <>
                                <div className="pr-card-body">
                                  <div className="pr-card-amount">${parseFloat(pr.amount).toFixed(2)}</div>
                                  <div className="pr-card-desc">{pr.description}</div>
                                  <div className="pr-card-type">
                                    {pr.type === 'service_rendered' ? 'Service rendered' : 'Additional funds'}
                                  </div>
                                </div>
                                {pr.status === 'pending' && (
                                  <div className="pr-card-actions">
                                    {String(getEntityId(pr.requestedById)) === String(userId) ? (
                                      <>
                                        <span className="pr-card-awaiting">Awaiting payment…</span>
                                        <button type="button" className="offer-btn-secondary" disabled={payHook.actingPrId === prId} onClick={() => payHook.handlePayCancel(prId)}>Cancel</button>
                                      </>
                                    ) : (
                                      <button type="button" className="offer-btn-primary" disabled={payHook.actingPrId === prId} onClick={() => payHook.handlePayAction(prId, pr.amount)}>Pay ${parseFloat(pr.amount).toFixed(2)}</button>
                                    )}
                                  </div>
                                )}
                                {pr.status === 'paid' && (
                                  <div className="pr-card-paid">✅ Paid {pr.paidAt ? `on ${new Date(pr.paidAt).toLocaleDateString()}` : ''}</div>
                                )}
                              </>
                            ) : (
                              <div className="pr-card-loading">Loading…</div>
                            )}
                          </div>
                        )}

                        {/* Offer Card */}
                        {(() => {
                          const offerId = extractOfferId(msg.content);
                          if (!offerId) return null;
                          if (!payHook.offersById[offerId]) { payHook.fetchOffer(offerId); return null; }
                          const offer = payHook.offersById[offerId];
                          const isSender = String(offer.sender?._id || offer.sender) === String(userId);
                          const isRecipient = String(offer.recipient?._id || offer.recipient) === String(userId);
                          const canAct = isRecipient && ['pending', 'countered'].includes(offer.status);
                          const canWithdraw = isSender && ['pending', 'countered'].includes(offer.status);
                          return (
                            <div className="offer-card">
                              <div className="offer-card-header">
                                <div className="offer-card-title">📋 Custom Offer</div>
                                <div className={`offer-card-badge offer-card-badge--${offer.status || 'pending'}`}>
                                  {offer.status?.toUpperCase()}
                                </div>
                              </div>
                              <div className="offer-card-body">
                                <div className="offer-card-amount">${parseFloat(offer.terms?.amount || 0).toFixed(2)}</div>
                                <div className="offer-card-desc">{offer.terms?.description}</div>
                                <div className="offer-card-meta">
                                  <span>⏱ {offer.terms?.deliveryTime} day{offer.terms?.deliveryTime !== 1 ? 's' : ''}</span>
                                  {offer.terms?.revisions > 0 && <span>✏️ {offer.terms.revisions} revision{offer.terms.revisions !== 1 ? 's' : ''}</span>}
                                  {offer.terms?.deadline && <span>📅 Due {new Date(offer.terms.deadline).toLocaleDateString()}</span>}
                                </div>
                              </div>
                              {(canAct || canWithdraw) && (
                                <div className="offer-card-actions">
                                  {canAct && (
                                    <>
                                      <button className="offer-btn-primary" onClick={() => payHook.handleOfferAccept(offerId)}>Accept</button>
                                      <button className="offer-btn-secondary" onClick={() => payHook.handleOfferDecline(offerId)}>Decline</button>
                                      <button className="offer-btn-secondary" onClick={() => {
                                        payHook.setShowOfferModal(true);
                                        payHook.setOfferModalOpts({ counterId: offerId, recipientId: isSender ? String(offer.recipient?._id || offer.recipient) : String(offer.sender?._id || offer.sender), recipientName: '', prefillTerms: offer.terms || {} });
                                      }}>Counter ↩</button>
                                    </>
                                  )}
                                  {canWithdraw && (
                                    <button className="offer-btn-secondary" onClick={() => payHook.handleOfferWithdraw(offerId)}>Withdraw</button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {!isMine && msg.content && (
                          <div className="msg-ai-tr-row">
                            <button className="msg-ai-tr-btn" title="Translate" onClick={() => msgHook.setShowLangPicker(msgHook.showLangPicker === msg._id ? null : msg._id)}>🌐</button>
                            {msgHook.showLangPicker === msg._id && (
                              <div className="msg-ai-tr-picker">
                                {translateLanguages.map(l => (
                                  <button key={l.code} className="msg-ai-tr-lang" onClick={() => msgHook.handleTranslate(msg._id, msg.content, l.code)}>{l.label}</button>
                                ))}
                              </div>
                            )}
                            {msgHook.translatingId === msg._id && <span className="msg-ai-tr-loading">Translating…</span>}
                          </div>
                        )}
                        {msgHook.translations[msg._id] && (
                          <div className="msg-ai-tr-result">
                            <em>{msgHook.translations[msg._id].translated}</em>
                            <span className="msg-ai-tr-lang-tag">{msgHook.translations[msg._id].detectedLanguage} → {msgHook.translations[msg._id].targetLanguage}</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                {typingUsers.size > 0 && (
                  <div className="typing-indicator">
                    {otherParticipant?.firstName} is typing...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {msgHook.attachFiles.length > 0 && (
                <div className="attach-preview">
                  {msgHook.attachFiles.map((f, i) => (
                    <div key={i} className="attach-preview-item">
                      <span className="attach-preview-name">{f.type?.startsWith('image/') ? '🖼️' : '📄'} {f.name}</span>
                      <span className="attach-preview-size">{(f.size / 1024).toFixed(0)}KB</span>
                      <button type="button" className="attach-preview-remove" onClick={() => msgHook.setAttachFiles(prev => prev.filter((_, idx) => idx !== i))}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {msgHook.offPlatformWarning && (
                <div className="chat-offplatform-warning">
                  <span>⚠️ {msgHook.offPlatformWarning}</span>
                  <button onClick={() => msgHook.setOffPlatformWarning('')}>✕</button>
                </div>
              )}

              {disputeRisk && (
                <div className={`msg-ai-risk-banner ${disputeRisk.riskLevel}`}>
                  <div className="msg-ai-risk-header">
                    <span className="msg-ai-risk-level">
                      {disputeRisk.riskLevel === 'low' ? '✅' : disputeRisk.riskLevel === 'medium' ? '⚠️' : '🚨'} {disputeRisk.riskLevel} risk
                    </span>
                    <button className="msg-ai-risk-close" onClick={() => setDisputeRisk(null)}>✕</button>
                  </div>
                  {disputeRisk.indicators?.length > 0 && (
                    <ul className="msg-ai-risk-indicators">
                      {disputeRisk.indicators.map((ind, i) => <li key={i}>{ind}</li>)}
                    </ul>
                  )}
                  {disputeRisk.recommendation && (
                    <p className="msg-ai-risk-rec">{disputeRisk.recommendation}</p>
                  )}
                </div>
              )}

              <div className="chat-ai-draft-wrap">
                <button
                  type="button"
                  className="chat-ai-draft-btn"
                  disabled={aiDrafting || msgHook.messages.length === 0}
                  onClick={async () => {
                    const lastMsg = [...msgHook.messages].reverse().find(m => m.sender?._id !== (user?._id || user?.id));
                    if (!lastMsg) return;
                    setAiDrafting(true);
                    try {
                      const data = await apiRequest('/api/ai/draft-response', {
                        method: 'POST',
                        body: JSON.stringify({
                          lastMessage: lastMsg.content,
                          senderName: `${otherParticipant?.firstName || ''} ${otherParticipant?.lastName || ''}`.trim(),
                          context: selectedConvo?.job?.title ? `Job: ${selectedConvo.job.title}` : '',
                        }),
                      });
                      if (data.draft) msgHook.setNewMessage(data.draft);
                    } catch (err) {
                      if (err.status === 403) alert('AI Response Drafter is a Plus+ feature.');
                    } finally { setAiDrafting(false); }
                  }}
                >
                  {aiDrafting ? '✨ Drafting…' : '✨ AI Draft'}
                </button>
              </div>

              <form className="chat-composer" onSubmit={(e) => msgHook.sendMessage(e, selectedConvo)}>
                <input
                  type="file" ref={msgHook.fileInputRef} multiple hidden
                  accept="image/*,.pdf,.doc,.docx,.txt"
                  onChange={e => {
                    const files = Array.from(e.target.files || []).slice(0, 5);
                    msgHook.setAttachFiles(prev => [...prev, ...files].slice(0, 5));
                    e.target.value = '';
                  }}
                />
                <button type="button" className="attach-btn" onClick={() => msgHook.fileInputRef.current?.click()} title="Attach file">
                  📎
                </button>
                <input
                  type="text" value={msgHook.newMessage}
                  onChange={(e) => msgHook.handleTyping(e, selectedConvo)}
                  placeholder="Type a message..."
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) msgHook.sendMessage(e, selectedConvo); }}
                  disabled={msgHook.sending}
                  onBlur={() => {
                    socketRef.current?.emit('typing:stop', { conversationId: selectedConvo._id });
                    clearTimeout(msgHook.typingTimeoutRef.current);
                  }}
                />
                <button type="submit" disabled={(!msgHook.newMessage.trim() && msgHook.attachFiles.length === 0) || msgHook.sending} className="send-btn">
                  {msgHook.sending ? '...' : '→'}
                </button>
              </form>

              <div className="chat-quick-actions">
                {selectedConvo.job && (
                  <Link to={`/disputes`} className="quick-act">⚖️ Dispute</Link>
                )}
                <button type="button" className="quick-act" onClick={() => { payHook.setPayAmount(''); payHook.setPayDescription(''); payHook.setPayType('service_rendered'); payHook.setPayError(''); payHook.setShowPayModal(true); }}>
                  💳 Request Payment
                </button>
                <button type="button" className="quick-act" onClick={() => schedHook.setShowScheduleModal(true)}>📅 Schedule</button>
                <button type="button" className="quick-act" onClick={() => {
                  const other = selectedConvo?.participants?.find(p => { const pid = typeof p === 'object' ? (p._id || p.id) : p; return String(pid) !== String(userId); });
                  const otherId = other ? (typeof other === 'object' ? (other._id || other.id) : other) : '';
                  const jobId = selectedConvo?.job?._id || selectedConvo?.job || '';
                  const params = new URLSearchParams();
                  if (otherId) params.set('freelancerId', otherId);
                  if (jobId) params.set('jobId', jobId);
                  window.location.href = `/contracts/new?${params.toString()}`;
                }}>📄 Contract</button>
                <button
                  className="quick-act msg-ai-risk-btn"
                  disabled={disputeRiskLoading || msgHook.messages.length === 0}
                  onClick={async () => {
                    setDisputeRiskLoading(true);
                    try {
                      const last20 = msgHook.messages.slice(-20).map(m => ({
                        content: m.content || '',
                        role: idEq(m.sender?._id || m.sender, userId) ? 'client' : 'freelancer',
                      }));
                      const data = await apiRequest('/api/ai/check-dispute-risk', {
                        method: 'POST',
                        body: JSON.stringify({ messages: last20 }),
                      });
                      setDisputeRisk(data);
                    } catch (err) {
                      if (err.status === 403) alert('Dispute Risk Check is a Pro feature.');
                    } finally { setDisputeRiskLoading(false); }
                  }}
                >
                  {disputeRiskLoading ? '🛡️ Checking…' : '🛡️ Risk Check'}
                </button>
              </div>

              {/* Schedule Modal */}
              {schedHook.showScheduleModal && (
                <div className="offer-modal-overlay" onClick={() => { if (!schedHook.scheduleSaving) { schedHook.setShowScheduleModal(false); schedHook.setEditingApptId(null); } }}>
                  <div className="offer-modal" onClick={e => e.stopPropagation()}>
                    <div className="offer-modal-header">
                      <h2>📅 {schedHook.editingApptId ? 'Edit appointment' : 'Schedule'}</h2>
                      <button className="offer-modal-close" onClick={() => { schedHook.setShowScheduleModal(false); schedHook.setEditingApptId(null); }} disabled={schedHook.scheduleSaving}>✕</button>
                    </div>
                    {schedHook.scheduleError && <div className="offer-error">{schedHook.scheduleError}</div>}
                    <form onSubmit={schedHook.handleScheduleSubmit} className="offer-form">
                      <div className="offer-form-row">
                        <div className="offer-field">
                          <label>Type *</label>
                          <select value={schedHook.scheduleType} onChange={e => schedHook.setScheduleType(e.target.value)} disabled={schedHook.scheduleSaving}>
                            <option value="service">Service session</option>
                            <option value="job">Job-related session</option>
                            <option value="phone">Phone call</option>
                            <option value="video">Video call</option>
                            <option value="consultation">General consultation</option>
                          </select>
                        </div>
                        <div className="offer-field">
                          <label>Date *</label>
                          <input type="date" value={schedHook.scheduleDate} onChange={e => schedHook.setScheduleDate(e.target.value)} required disabled={schedHook.scheduleSaving} />
                        </div>
                      </div>
                      <div className="offer-form-row">
                        <div className="offer-field">
                          <label>Time *</label>
                          <input type="time" step="900" value={schedHook.scheduleTime} onChange={e => schedHook.setScheduleTime(e.target.value)} required disabled={schedHook.scheduleSaving} />
                          <small style={{ color: 'var(--color-text-muted)' }}>15-min increments</small>
                        </div>
                        <div className="offer-field">
                          <label>Duration *</label>
                          <select value={schedHook.scheduleDuration} onChange={e => schedHook.setScheduleDuration(Number(e.target.value))} disabled={schedHook.scheduleSaving}>
                            {Array.from({ length: 16 }, (_, i) => (i + 1) * 15).map(m => (
                              <option key={m} value={m}>{m} min</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="offer-field">
                        <label>Notes</label>
                        <textarea rows={3} value={schedHook.scheduleNotes} onChange={e => schedHook.setScheduleNotes(e.target.value)} placeholder="Optional notes (address, agenda, call link, etc.)" disabled={schedHook.scheduleSaving} />
                      </div>
                      <div className="offer-actions">
                        <button type="button" className="offer-btn-secondary" onClick={() => { schedHook.setShowScheduleModal(false); schedHook.setEditingApptId(null); }} disabled={schedHook.scheduleSaving}>Cancel</button>
                        <button type="submit" className="offer-btn-primary" disabled={schedHook.scheduleSaving || !schedHook.scheduleDate || !schedHook.scheduleTime}>
                          {schedHook.scheduleSaving ? 'Proposing…' : 'Propose'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Payment Request Modal */}
              {payHook.showPayModal && (
                <div className="offer-modal-overlay" onClick={() => !payHook.paySaving && payHook.setShowPayModal(false)}>
                  <div className="offer-modal" onClick={e => e.stopPropagation()}>
                    <div className="offer-modal-header">
                      <h2>💳 Request Payment</h2>
                      <button className="offer-modal-close" onClick={() => payHook.setShowPayModal(false)} disabled={payHook.paySaving}>✕</button>
                    </div>
                    {payHook.payError && <div className="offer-error">{payHook.payError}</div>}
                    <form className="offer-form" onSubmit={payHook.handlePaySubmit}>
                      <div className="offer-form-row">
                        <div className="offer-field">
                          <label>Amount ($) *</label>
                          <input type="number" min="1" step="0.01" value={payHook.payAmount} onChange={e => payHook.setPayAmount(e.target.value)} placeholder="150.00" required disabled={payHook.paySaving} />
                        </div>
                        <div className="offer-field">
                          <label>Type *</label>
                          <select value={payHook.payType} onChange={e => payHook.setPayType(e.target.value)} disabled={payHook.paySaving}>
                            <option value="service_rendered">Service rendered</option>
                            <option value="additional_funds">Additional funds</option>
                          </select>
                        </div>
                      </div>
                      <div className="offer-field">
                        <label>Description *</label>
                        <textarea rows={3} value={payHook.payDescription} onChange={e => payHook.setPayDescription(e.target.value)} placeholder="What is this payment for?" required disabled={payHook.paySaving} />
                      </div>
                      <div className="offer-actions">
                        <button type="button" className="offer-btn-secondary" onClick={() => payHook.setShowPayModal(false)} disabled={payHook.paySaving}>Cancel</button>
                        <button type="submit" className="offer-btn-primary" disabled={payHook.paySaving || !payHook.payAmount || !payHook.payDescription}>
                          {payHook.paySaving ? 'Sending…' : 'Send Request'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="chat-placeholder">
              <div className="chat-placeholder-icon">💬</div>
              <h3>Select a conversation</h3>
              <p>Choose from the left to start messaging</p>
            </div>
          )}
        </div>

        {/* ── Context Panel ── */}
        {selectedConvo && showContext && (
          <div className="messages-context" onClick={() => setShowContext(false)}>
          <div className="context-panel-inner" onClick={e => e.stopPropagation()}>
            <div className="context-header">
              <h3>Details</h3>
              <button onClick={() => setShowContext(false)}>×</button>
            </div>
            <div className="context-profile">
              <Link to={`/freelancers/${getEntityId(otherParticipant?._id || otherParticipant)}`} style={{ textDecoration: 'none' }} onClick={e => e.stopPropagation()}>
                <div className="context-avatar">
                  {otherParticipant?.profilePicture
                    ? <img src={otherParticipant.profilePicture} alt="" />
                    : <span>{otherParticipant?.firstName?.[0]}{otherParticipant?.lastName?.[0]}</span>}
                </div>
              </Link>
              <h4>
                <Link to={`/freelancers/${getEntityId(otherParticipant?._id || otherParticipant)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  {otherParticipant?.firstName} {otherParticipant?.lastName}
                </Link>
              </h4>
              {contextProfileLoading && <div className="ctx-loading">Loading…</div>}
              {contextProfile && (
                <>
                  {contextProfile.stats?.rating > 0 && (
                    <div className="ctx-rating-row">
                      <span className="ctx-stars">{'★'.repeat(Math.round(contextProfile.stats.rating))}{'☆'.repeat(5 - Math.round(contextProfile.stats.rating))}</span>
                      <span className="ctx-rating-val">{contextProfile.stats.rating.toFixed(1)}</span>
                      <span className="ctx-rating-count">({contextProfile.stats.totalReviews})</span>
                    </div>
                  )}
                  <div className="ctx-stats-row">
                    {contextProfile.stats?.completedJobs > 0 && (
                      <div className="ctx-stat">
                        <div className="ctx-stat-val">{contextProfile.stats.completedJobs}</div>
                        <div className="ctx-stat-label">Jobs done</div>
                      </div>
                    )}
                    {contextProfile.freelancer?.memberSince && (
                      <div className="ctx-stat">
                        <div className="ctx-stat-val">{new Date(contextProfile.freelancer.memberSince).getFullYear()}</div>
                        <div className="ctx-stat-label">Member since</div>
                      </div>
                    )}
                  </div>
                  {contextProfile.freelancer?.bio && (
                    <p className="ctx-bio">
                      {contextProfile.freelancer.bio.length > 180
                        ? contextProfile.freelancer.bio.slice(0, 180) + '…'
                        : contextProfile.freelancer.bio}
                    </p>
                  )}
                  {contextProfile.freelancer?.skills?.length > 0 && (
                    <div className="ctx-skills">
                      {contextProfile.freelancer.skills.slice(0, 8).map((s, i) => (
                        <span key={i} className="ctx-skill-tag">{s}</span>
                      ))}
                    </div>
                  )}
                  {contextProfile.reviews?.length > 0 && (
                    <div className="context-section">
                      <h4>Recent Reviews</h4>
                      {contextProfile.reviews.slice(0, 3).map((r, i) => (
                        <div key={i} className="ctx-review-item">
                          <div className="ctx-review-header">
                            <span className="ctx-review-name">{r.reviewer?.firstName} {r.reviewer?.lastName?.slice(0, 1)}.</span>
                            <span className="ctx-review-stars">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                          </div>
                          {r.comment && (
                            <p className="ctx-review-comment">
                              {r.comment.length > 120 ? r.comment.slice(0, 120) + '…' : r.comment}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              <Link to={`/freelancers/${otherParticipant?._id}`} className="context-link">
                View full profile →
              </Link>
            </div>
            {selectedConvo.job && (
              <div className="context-section">
                <h4>Linked Job</h4>
                <Link to={`/jobs/${selectedConvo.job._id}`} state={{ returnTo: `/messages?conversation=${selectedConvo._id}` }} className="context-job-card">
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
          </div>
        )}
      </div>

      {/* Call upgrade gate modal */}
      {callGateModal && (
        <div className="modal-overlay" onClick={() => setCallGateModal(null)}>
          <div className="modal-content call-gate-modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 12 }}>
              {callGateModal.type === 'video' ? '🎥' : '📞'}
            </div>
            <h3 style={{ textAlign: 'center', margin: '0 0 8px' }}>
              {callGateModal.type === 'video' ? 'Video' : 'Voice'} Calls
            </h3>
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 20 }}>
              {callGateModal.type === 'video' ? 'Video' : 'Voice'} calls are available on the <strong>Plus plan</strong> and above.
              Upgrade to connect face-to-face with clients and freelancers.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => { setCallGateModal(null); navigate('/billing'); }}>Upgrade to Plus</button>
              <button className="btn btn-secondary" onClick={() => setCallGateModal(null)}>Maybe later</button>
            </div>
          </div>
        </div>
      )}

      {/* Offer Modal */}
      {payHook.showOfferModal && (
        <CustomOfferModal
          isOpen={payHook.showOfferModal}
          onClose={() => { payHook.setShowOfferModal(false); payHook.setOfferModalOpts({}); }}
          recipientId={payHook.offerModalOpts.recipientId}
          recipientName={payHook.offerModalOpts.recipientName || ''}
          prefillTerms={payHook.offerModalOpts.prefillTerms || {}}
          counterId={payHook.offerModalOpts.counterId}
          onSuccess={() => {
            payHook.setShowOfferModal(false);
            const counterId = payHook.offerModalOpts.counterId;
            payHook.setOfferModalOpts({});
            if (selectedConvo) openConversation(selectedConvo);
            if (counterId) payHook.setOffersById(prev => { const n = {...prev}; delete n[counterId]; return n; });
          }}
        />
      )}
    </div>
  );
};

export default Messages;
