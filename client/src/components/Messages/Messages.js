import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../socket/useSocket';
import { apiRequest } from '../../utils/api';
import OnlineStatus, { formatLastSeen } from '../common/OnlineStatus';
import CustomOfferModal from '../Offers/CustomOfferModal';
import '../Offers/CustomOffer.css'; // reuse modal base styles for Schedule modal
import './Messages.css';
import SEO from '../common/SEO';

import { formatTime, ConvoItem, ProposalActionCard, MilestoneRequestCard, MsgBubble, OrderStatusBar } from './parts/components';
import SafetyNudge from './parts/SafetyNudge';

// ── Main Messages ───────────────────────────────────────────────
const getEntityId = (v) => (v && typeof v === 'object' ? (v._id || v.id || v.userId || v.toString?.()) : v);
const idEq = (a, b) => String(getEntityId(a)) === String(getEntityId(b));

const pad2 = (n) => String(n).padStart(2, '0');
const extractApptId = (text) => {
  if (!text) return null;
  const m = String(text).match(/\[appt:([0-9a-fA-F-]{20,})\]/);
  return m ? m[1] : null;
};

const nextQuarterLocal = () => {
  const d = new Date();
  d.setSeconds(0, 0);
  const mins = d.getMinutes();
  const next = Math.ceil(mins / 15) * 15;
  d.setMinutes(next);
  if (d <= new Date()) d.setMinutes(d.getMinutes() + 15);
  return d;
};

// Highlight matched text in a string
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

const Messages = () => {
  const { user } = useAuth();
  const { search: locationSearch } = useLocation();
  const navigate = useNavigate();
  const userId = getEntityId(user?._id || user?.id || user?.userId);
  const [userFeatures, setUserFeatures] = useState([]);
  const [featuresLoaded, setFeaturesLoaded] = useState(false);
  const canCall = !featuresLoaded || userFeatures.includes('audio_calls') || userFeatures.includes('video_calls');
  const [conversations, setConversations] = useState([]);
  const [selectedConvo, setSelectedConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [aiDrafting, setAiDrafting] = useState(false);
  const [disputeRisk, setDisputeRisk] = useState(null);
  const [disputeRiskLoading, setDisputeRiskLoading] = useState(false);
  const [offPlatformWarning, setOffPlatformWarning] = useState('');
  const [attachFiles, setAttachFiles] = useState([]);
  const fileInputRef = React.useRef(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [safetyNudge, setSafetyNudge] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [deliveryStatus, setDeliveryStatus] = useState(new Map());
  const [showContext, setShowContext] = useState(false);
  const [mobileView, setMobileView] = useState('inbox');
  const [searchResults, setSearchResults] = useState(null); // null = not searching
  const [searchLoading, setSearchLoading] = useState(false);
  const [contextProfile, setContextProfile] = useState(null);
  const [contextProfileLoading, setContextProfileLoading] = useState(false);
  const [callGateModal, setCallGateModal] = useState(null); // { type: 'video'|'audio', message }

  // Payment Requests
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payDescription, setPayDescription] = useState('');
  const [payType, setPayType] = useState('service_rendered');
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState('');
  const [payRequestsById, setPayRequestsById] = useState({});
  const [actingPrId, setActingPrId] = useState(null);

  // Scheduling (SQL appointments)
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleType, setScheduleType] = useState('consultation');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleDuration, setScheduleDuration] = useState(30);
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [editingApptId, setEditingApptId] = useState(null);
  const [appointmentsById, setAppointmentsById] = useState({});
  const [actingApptId, setActingApptId] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState({}); // userId → { isOnline, lastSeen }
  const [translations, setTranslations] = useState({}); // msgId → { translated, detectedLanguage, targetLanguage }
  const [translatingId, setTranslatingId] = useState(null); // msgId currently translating
  const [showLangPicker, setShowLangPicker] = useState(null); // msgId with lang picker open
  const messagesEndRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const prevMessagesLenRef = useRef(0);
  const typingTimeoutRef = useRef(null);
  const lastSeqByConvoRef = useRef({});

  const token = localStorage.getItem('token');

  // ── Data fetchers (defined first — used by socket handler) ───
  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/api/messages/conversations');
      const raw = data.conversations || [];
      // Deduplicate inbox rows by "other participant" (latest activity wins)
      // to avoid split-thread noise when legacy data created multiple job-linked convos.
      const byOther = new Map();
      raw.forEach((c) => {
        const other = (c.participants || []).find(p => String(getEntityId(p?._id || p)) !== String(userId));
        const otherId = String(getEntityId(other?._id || other) || c._id);
        const prev = byOther.get(otherId);
        if (!prev || new Date(c.lastActivity || 0).getTime() > new Date(prev.lastActivity || 0).getTime()) {
          byOther.set(otherId, c);
        }
      });
      setConversations(Array.from(byOther.values()).sort((a, b) => new Date(b.lastActivity || 0) - new Date(a.lastActivity || 0)));
      setError(null);
    } catch (err) {
      setError(err.data?.error || err.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Fetch online status for all conversation participants
  useEffect(() => {
    if (conversations.length === 0) return;
    const ids = [...new Set(
      conversations.flatMap(c => (c.participants || []).map(p => getEntityId(p?._id || p)).filter(Boolean))
    )].filter(id => String(id) !== String(userId));
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

  const otherParticipant = selectedConvo?.participants?.find(
    p => String(getEntityId(p?._id || p)) !== String(userId)
  );

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
      apiRequest(`/api/messages/conversations/${conversationId}/receipts`, {
        method: 'POST',
        body: JSON.stringify({ lastDeliveredSeq: maxSeq }),
      }).catch(() => {});
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
      case 'rcpt:update':
        // Minimal Day-8 handling: refresh list so unreadSeqCount reflects latest cursor state.
        fetchConversations();
        break;
      case 'safety:nudge':
        if (data?.copy) setSafetyNudge(data.copy);
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

    // Handle feature gate (upgrade required)
    const gateHandler = ({ type: callType, message }) => {
      setCallGateModal({ type: callType, message });
      socketRef.current.off('call:feature-gated', gateHandler);
    };
    socketRef.current.on('call:feature-gated', gateHandler);

    // Handle error
    const errHandler = ({ message }) => {
      alert(message || 'Could not start call');
      socketRef.current.off('call:error', errHandler);
    };
    socketRef.current.on('call:error', errHandler);
    setTimeout(() => {
      socketRef.current.off('call:error', errHandler);
      socketRef.current.off('call:feature-gated', gateHandler);
    }, 5000);
  }, [socketRef, selectedConvo]);

  const updateReceiptCursor = useCallback(async (conversationId, { lastReadSeq, lastDeliveredSeq }) => {
    try {
      await apiRequest(`/api/messages/conversations/${conversationId}/receipts`, {
        method: 'POST',
        body: JSON.stringify({ lastReadSeq, lastDeliveredSeq }),
      });
    } catch (_) {}
  }, []);

  const fetchMessages = useCallback(async (convo) => {
    try {
      const data = await apiRequest(`/api/messages/conversations/${convo._id}`);
      setMessages(data.messages || []);
      setSelectedConvo(data.conversation || convo);
      setMobileView('chat');
      const seqs = (data.messages || []).map((m) => Number(m.seq || 0)).filter((n) => Number.isFinite(n));
      const maxSeq = seqs.length ? Math.max(...seqs) : Number(lastSeqByConvoRef.current[convo._id] || 0);
      lastSeqByConvoRef.current[convo._id] = maxSeq;

      const unread = (data.messages || []).filter(m => !m.isRead && String(getEntityId(m.recipient)) === String(userId));
      if (unread.length > 0 && socketRef.current) {
        socketRef.current.emit('message:read', {
          conversationId: convo._id,
          messageIds: unread.map(m => m._id)
        });
      }

      if (maxSeq > 0) {
        updateReceiptCursor(convo._id, { lastReadSeq: maxSeq, lastDeliveredSeq: maxSeq });
      }
    } catch (err) {
      setError(err.data?.error || err.message || 'Failed to load messages');
    }
  }, [userId, updateReceiptCursor]);

  const fetchAppointments = useCallback(async (conversationId) => {
    if (!conversationId) return;
    try {
      const data = await apiRequest(`/api/appointments?conversationId=${conversationId}&limit=200`);
      const list = data.appointments || [];
      const map = {};
      list.forEach(a => { map[a.id] = a; });
      setAppointmentsById(map);
    } catch {
      // non-blocking
    }
  }, []);

  useEffect(() => {
    if (selectedConvo?._id) fetchAppointments(selectedConvo._id);
  }, [selectedConvo?._id, fetchAppointments]);

  // Fetch user feature flags once on mount
  useEffect(() => {
    apiRequest('/api/auth/me/features')
      .then(data => { setUserFeatures(data.features || []); setFeaturesLoaded(true); })
      .catch(() => setFeaturesLoaded(true));
  }, []);

  // Fetch other participant's profile when Details panel opens
  useEffect(() => {
    if (!showContext || !otherParticipant?._id) { setContextProfile(null); return; }
    setContextProfileLoading(true);
    apiRequest(`/api/freelancers/${getEntityId(otherParticipant._id)}`)
      .then(data => setContextProfile(data))
      .catch(() => setContextProfile(null))
      .finally(() => setContextProfileLoading(false));
  }, [showContext, otherParticipant?._id]);

  const fetchPaymentRequests = useCallback(async (conversationId) => {
    if (!conversationId) return;
    try {
      const data = await apiRequest(`/api/payment-requests?conversationId=${conversationId}`);
      const map = {};
      (data.paymentRequests || []).forEach(pr => { map[pr._id] = pr; });
      setPayRequestsById(map);
    } catch {
      // non-blocking
    }
  }, []);

  useEffect(() => {
    if (selectedConvo?._id) fetchPaymentRequests(selectedConvo._id);
  }, [selectedConvo?._id, fetchPaymentRequests]);

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
      } else {
        // Force REST as source of truth until socket auth/presence path is fully stabilized
        const res = await apiRequest(
          `/api/messages/conversations/${selectedConvo._id}/messages`,
          { method: 'POST', body: JSON.stringify({ content }) }
        );
        setMessages(prev => prev.map(m => m._id === optimistic._id ? res.data : m));
        fetchConversations();
        if (selectedConvo?._id) fetchMessages(selectedConvo);
        // Show non-blocking warning banner if server flagged contact info
        if (res.warning) setOffPlatformWarning(res.warning);
      }
    } catch (err) {
      console.error('[Messages] send failed', err);
      // Hard-blocked message (explicit off-platform solicitation / external payment)
      if (err?.status === 422 || err?.error === 'off_platform_detected') {
        setOffPlatformWarning(err?.message || '🚫 Message blocked: asking to work or pay outside Fetchwork is not allowed.');
        setMessages(prev => prev.filter(m => m._id !== optimistic._id));
        setNewMessage(content); // restore draft so user can edit
      } else {
        setError(err?.data?.error || err?.message || 'Failed to send message');
        setMessages(prev => prev.filter(m => m._id !== optimistic._id));
      }
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
  useEffect(() => {
    const el = chatMessagesRef.current;
    if (!el) return;

    const prevLen = prevMessagesLenRef.current;
    const currLen = messages.length;
    const appended = currLen > prevLen;
    prevMessagesLenRef.current = currLen;

    if (!appended) return;

    const last = messages[currLen - 1];
    const lastSenderId = String(getEntityId(last?.sender?._id || last?.sender));
    const isMine = lastSenderId === String(userId);

    if (isMine || shouldAutoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, userId]);

  // Auto-open conversation from URL ?conversation=ID
  useEffect(() => {
    const params = new URLSearchParams(locationSearch);
    const targetId = params.get('conversation');
    if (targetId && conversations.length > 0 && !selectedConvo) {
      const match = conversations.find(c => c._id === targetId);
      if (match) fetchMessages(match);
    }
  }, [locationSearch, conversations]); // eslint-disable-line react-hooks/exhaustive-deps

  // Init schedule modal defaults (create vs edit)
  useEffect(() => {
    if (!showScheduleModal) return;

    setScheduleError('');
    setScheduleSaving(false);

    const editing = editingApptId ? appointmentsById[editingApptId] : null;
    if (editing) {
      const start = new Date(editing.startAtUtc);
      const localDate = `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`;
      const localTime = `${pad2(start.getHours())}:${pad2(start.getMinutes())}`;
      const mins = Math.round((new Date(editing.endAtUtc).getTime() - new Date(editing.startAtUtc).getTime()) / 60000);

      setScheduleType(editing.appointmentType || 'consultation');
      setScheduleDate(localDate);
      setScheduleTime(localTime);
      setScheduleDuration(mins || 30);
      setScheduleNotes(editing.notes || '');
      return;
    }

    const d = nextQuarterLocal();
    const isoDate = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const isoTime = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

    setScheduleDate(prev => prev || isoDate);
    setScheduleTime(prev => prev || isoTime);
    setScheduleDuration(prev => prev || 30);
    setScheduleNotes('');

    if (selectedConvo?.service) setScheduleType('service');
    else if (selectedConvo?.job) setScheduleType('job');
    else setScheduleType('consultation');
  }, [showScheduleModal, editingApptId, appointmentsById, selectedConvo]);

  const translateLanguages = [
    { code: 'es', label: 'Spanish' }, { code: 'fr', label: 'French' },
    { code: 'de', label: 'German' }, { code: 'zh', label: 'Chinese' },
    { code: 'ja', label: 'Japanese' }, { code: 'pt', label: 'Portuguese' },
    { code: 'ar', label: 'Arabic' }, { code: 'hi', label: 'Hindi' },
  ];

  const handleTranslate = async (msgId, text, langCode) => {
    setShowLangPicker(null);
    setTranslatingId(msgId);
    try {
      const data = await apiRequest('/api/ai/translate-message', {
        method: 'POST',
        body: JSON.stringify({ text, targetLanguage: langCode }),
      });
      setTranslations(prev => ({ ...prev, [msgId]: data }));
    } catch {
      alert('Failed to translate message.');
    } finally { setTranslatingId(null); }
  };

  // Debounced search across conversations + message content
  useEffect(() => {
    if (!search || search.trim().length < 2) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const data = await apiRequest(`/api/messages/search?q=${encodeURIComponent(search.trim())}`);
        setSearchResults(data.results || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Filter conversations (used when not in search mode)
  const filtered = conversations.filter(c => {
    if (filter === 'unread' && !c.unreadCount) return false;
    if (search) {
      const other = c.participants?.find(p => String(getEntityId(p?._id || p)) !== String(userId));
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
          <h1>Messages <span style={{ fontSize: 12, fontWeight: 600, color: '#16a34a', marginLeft: 8 }}>v2 canary</span></h1>
        </div>
        <div className="messages-header-right">
          <input
            type="text" value={search} onChange={e => { setSearch(e.target.value); if (!e.target.value.trim()) setSearchResults(null); }}
            placeholder="Search messages..." className="messages-search"
          />
        </div>
      </div>

      <SafetyNudge text={safetyNudge} onClose={() => setSafetyNudge(null)} />
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
            ) : searchResults !== null ? (
              /* ── Search results mode ── */
              searchLoading ? (
                <div className="inbox-loading">Searching…</div>
              ) : searchResults.length === 0 ? (
                <div className="inbox-empty"><p>No results for "{search}"</p></div>
              ) : (
                searchResults.map(c => {
                  const other = c.participants?.find(p => String(p._id) !== String(userId));
                  const name = `${other?.firstName || ''} ${other?.lastName || ''}`.trim();
                  return (
                    <div
                      key={c._id}
                      className={`convo-item ${selectedConvo?._id === c._id ? 'selected' : ''}`}
                      onClick={() => fetchMessages(c)}
                    >
                      <div className="convo-avatar">
                        {other?.profilePicture
                          ? <img src={other.profilePicture} alt="" />
                          : <span>{other?.firstName?.[0]}{other?.lastName?.[0]}</span>}
                      </div>
                      <div className="convo-info">
                        <div className="convo-top">
                          <span className="convo-name"><Highlight text={name} query={search} /></span>
                        </div>
                        {c.job?.title && (
                          <div className="convo-job"><Highlight text={`📋 ${c.job.title}`} query={search} /></div>
                        )}
                        {/* Show matched message snippets */}
                        {c.matchedMessages?.map((m, i) => {
                          const clean = (m.content || '')
                            .replace(/\s*\[appt:[0-9a-fA-F-]{10,}\]/g, '')
                            .replace(/\s*\[pr:[a-fA-F0-9]{24}\]/g, '')
                            .trim();
                          const idx = clean.toLowerCase().indexOf(search.toLowerCase());
                          const start = Math.max(0, idx - 30);
                          const snippet = (start > 0 ? '…' : '') + clean.slice(start, start + 100) + (clean.length > start + 100 ? '…' : '');
                          return (
                            <div key={i} className="convo-preview" style={{ marginTop: 2 }}>
                              <Highlight text={snippet} query={search} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )
            ) : filtered.length === 0 ? (
              <div className="inbox-empty">
                <p>No conversations yet</p>
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
                {messages.length === 0 ? (
                  <div className="chat-empty"><p>No messages yet. Start the conversation!</p></div>
                ) : (
                  messages.map(msg => {
                    const isMine = idEq(msg.sender?._id || msg.sender, userId);
                    const apptId = extractAppointmentId(msg.content);
                    const appt = apptId ? appointmentsById[apptId] : null;
                    const prId = extractPayReqId(msg.content);
                    const pr = prId ? payRequestsById[prId] : null;
                    return (
                      <div key={msg._id} className="msg-ai-tr-wrap">
                        <MsgBubble
                          msg={msg}
                          isMine={isMine}
                          deliveryStatus={deliveryStatus}
                          userId={userId}
                          onProposalAction={() => fetchMessages(selectedConvo)}
                        />

                        {apptId && (
                          <div
                            style={{
                              border: '1px solid var(--color-border)',
                              borderRadius: 10,
                              padding: 12,
                              marginTop: 6,
                              background: 'var(--color-bg-primary)',
                              maxWidth: 520,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                              <div style={{ fontWeight: 700 }}>Appointment</div>
                              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                                {appt?.status ? appt.status.toUpperCase() : '…'}
                              </div>
                            </div>

                            {appt ? (
                              <>
                                <div style={{ marginTop: 6, fontSize: 14 }}>
                                  <div><strong>When:</strong> {new Date(appt.startAtUtc).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</div>
                                  <div><strong>Duration:</strong> {Math.round((new Date(appt.endAtUtc).getTime() - new Date(appt.startAtUtc).getTime()) / 60000)} min</div>
                                  <div><strong>Type:</strong> {appt.appointmentType}</div>
                                  {appt.notes && <div style={{ marginTop: 4 }}><strong>Notes:</strong> {appt.notes}</div>}
                                </div>

                                {appt.status === 'proposed' && (
                                  <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                                    {String(appt.proposedById) === String(userId) ? (
                                      <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Waiting for approval…</div>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          className="offer-btn-primary"
                                          disabled={actingApptId === appt.id}
                                          onClick={async () => {
                                            setActingApptId(appt.id);
                                            try {
                                              await apiRequest(`/api/appointments/${appt.id}/approve`, { method: 'POST' });
                                              await fetchAppointments(selectedConvo._id);
                                              await apiRequest(`/api/messages/conversations/${selectedConvo._id}/messages`, {
                                                method: 'POST',
                                                body: JSON.stringify({ content: `✅ Appointment confirmed [appt:${appt.id}]` })
                                              });
                                              fetchMessages(selectedConvo);
                                            } catch (e) {
                                              alert(e?.message || 'Failed to approve appointment');
                                            } finally {
                                              setActingApptId(null);
                                            }
                                          }}
                                        >Approve</button>
                                        <button
                                          type="button"
                                          className="offer-btn-secondary"
                                          disabled={actingApptId === appt.id}
                                          onClick={async () => {
                                            setActingApptId(appt.id);
                                            try {
                                              await apiRequest(`/api/appointments/${appt.id}/cancel`, { method: 'POST' });
                                              await fetchAppointments(selectedConvo._id);
                                              await apiRequest(`/api/messages/conversations/${selectedConvo._id}/messages`, {
                                                method: 'POST',
                                                body: JSON.stringify({ content: `❌ Appointment declined [appt:${appt.id}]` })
                                              });
                                              fetchMessages(selectedConvo);
                                            } catch (e) {
                                              alert(e?.message || 'Failed to decline appointment');
                                            } finally {
                                              setActingApptId(null);
                                            }
                                          }}
                                        >Decline</button>
                                      </>
                                    )}
                                  </div>
                                )}

                                {/* Edit — available on proposed (by proposer) and confirmed (both parties) */}
                                {(appt.status === 'proposed' || appt.status === 'confirmed') && (
                                  <div style={{ marginTop: appt.status === 'confirmed' ? 10 : 0 }}>
                                    <button
                                      type="button"
                                      className="offer-btn-secondary"
                                      disabled={actingApptId === appt.id}
                                      onClick={() => {
                                        setEditingApptId(appt.id);
                                        setShowScheduleModal(true);
                                      }}
                                    >✏️ Edit</button>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--color-text-muted)' }}>Loading appointment…</div>
                            )}
                          </div>
                        )}
                        {/* Payment Request Card */}
                        {prId && (
                          <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 12, marginTop: 8, background: 'var(--color-bg-primary)', maxWidth: 480 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                              <div style={{ fontWeight: 700 }}>💳 Payment Request</div>
                              <div style={{ fontSize: 12, color: pr?.status === 'paid' ? 'var(--color-success)' : pr?.status === 'cancelled' ? 'var(--color-text-muted)' : 'var(--color-warning)', fontWeight: 600 }}>
                                {pr ? pr.status.toUpperCase() : '…'}
                              </div>
                            </div>

                            {pr ? (
                              <>
                                <div style={{ marginTop: 6, fontSize: 14 }}>
                                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text-darker)' }}>${parseFloat(pr.amount).toFixed(2)}</div>
                                  <div style={{ color: 'var(--color-text-secondary)', marginTop: 2 }}>{pr.description}</div>
                                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                                    {pr.type === 'service_rendered' ? 'Service rendered' : 'Additional funds'}
                                  </div>
                                </div>

                                {pr.status === 'pending' && (
                                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                                    {String(getEntityId(pr.requestedById)) === String(userId) ? (
                                      <>
                                        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', alignSelf: 'center' }}>Awaiting payment…</div>
                                        <button
                                          type="button"
                                          className="offer-btn-secondary"
                                          disabled={actingPrId === prId}
                                          onClick={async () => {
                                            setActingPrId(prId);
                                            try {
                                              await apiRequest(`/api/payment-requests/${prId}/cancel`, { method: 'POST' });
                                              await fetchPaymentRequests(selectedConvo._id);
                                              await apiRequest(`/api/messages/conversations/${selectedConvo._id}/messages`, {
                                                method: 'POST',
                                                body: JSON.stringify({ content: `❌ Payment request cancelled [pr:${prId}]` }),
                                              });
                                              fetchMessages(selectedConvo);
                                            } catch (err) { alert(err?.message || 'Failed to cancel'); }
                                            finally { setActingPrId(null); }
                                          }}
                                        >Cancel</button>
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        className="offer-btn-primary"
                                        disabled={actingPrId === prId}
                                        onClick={async () => {
                                          setActingPrId(prId);
                                          try {
                                            const { clientSecret } = await apiRequest(`/api/payment-requests/${prId}/pay`, { method: 'POST' });
                                            // Redirect to Stripe-hosted page for now (simple, no Stripe Elements needed)
                                            // A full Elements integration can be added later.
                                            if (clientSecret) {
                                              const piId = clientSecret.split('_secret_')[0];
                                              const confirmUrl = `https://checkout.stripe.com/pay/${piId}?client_secret=${encodeURIComponent(clientSecret)}`;
                                              window.open(confirmUrl, '_blank');
                                            }
                                          } catch (err) { alert(err?.message || 'Failed to initiate payment'); }
                                          finally { setActingPrId(null); }
                                        }}
                                      >Pay ${parseFloat(pr.amount).toFixed(2)}</button>
                                    )}
                                  </div>
                                )}

                                {pr.status === 'paid' && (
                                  <div style={{ marginTop: 8, color: 'var(--color-success)', fontSize: 13, fontWeight: 600 }}>✅ Paid {pr.paidAt ? `on ${new Date(pr.paidAt).toLocaleDateString()}` : ''}</div>
                                )}
                              </>
                            ) : (
                              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--color-text-muted)' }}>Loading…</div>
                            )}
                          </div>
                        )}

                        {!isMine && msg.content && (
                          <div className="msg-ai-tr-row">
                            <button
                              className="msg-ai-tr-btn"
                              title="Translate"
                              onClick={() => setShowLangPicker(showLangPicker === msg._id ? null : msg._id)}
                            >🌐</button>
                            {showLangPicker === msg._id && (
                              <div className="msg-ai-tr-picker">
                                {translateLanguages.map(l => (
                                  <button key={l.code} className="msg-ai-tr-lang" onClick={() => handleTranslate(msg._id, msg.content, l.code)}>{l.label}</button>
                                ))}
                              </div>
                            )}
                            {translatingId === msg._id && <span className="msg-ai-tr-loading">Translating…</span>}
                          </div>
                        )}
                        {translations[msg._id] && (
                          <div className="msg-ai-tr-result">
                            <em>{translations[msg._id].translated}</em>
                            <span className="msg-ai-tr-lang-tag">{translations[msg._id].detectedLanguage} → {translations[msg._id].targetLanguage}</span>
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
              {/* Off-platform warning banner */}
              {offPlatformWarning && (
                <div className="chat-offplatform-warning">
                  <span>⚠️ {offPlatformWarning}</span>
                  <button onClick={() => setOffPlatformWarning('')}>✕</button>
                </div>
              )}

              {/* Dispute risk result banner */}
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

              {/* AI Draft Response */}
              <div className="chat-ai-draft-wrap">
                <button
                  type="button"
                  className="chat-ai-draft-btn"
                  disabled={aiDrafting || messages.length === 0}
                  onClick={async () => {
                    const lastMsg = [...messages].reverse().find(m => m.sender?._id !== (user?._id || user?.id));
                    if (!lastMsg) return;
                    setAiDrafting(true);
                    try {
                      const otherParty = selectedConvo?.otherParty;
                      const data = await apiRequest('/api/ai/draft-response', {
                        method: 'POST',
                        body: JSON.stringify({
                          lastMessage: lastMsg.content,
                          senderName: `${otherParty?.firstName || ''} ${otherParty?.lastName || ''}`.trim(),
                          context: selectedConvo?.job?.title ? `Job: ${selectedConvo.job.title}` : '',
                        }),
                      });
                      if (data.draft) setNewMessage(data.draft);
                    } catch (err) {
                      if (err.status === 403) alert('AI Response Drafter is a Plus+ feature.');
                    } finally { setAiDrafting(false); }
                  }}
                >
                  {aiDrafting ? '✨ Drafting…' : '✨ AI Draft'}
                </button>
              </div>
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
                <button
                  type="button"
                  className="quick-act"
                  onClick={() => {
                    setPayAmount('');
                    setPayDescription('');
                    setPayType('service_rendered');
                    setPayError('');
                    setShowPayModal(true);
                  }}
                >💳 Request Payment</button>
                <button
                  type="button"
                  className="quick-act"
                  onClick={() => setShowScheduleModal(true)}
                >📅 Schedule</button>
                <button
                  className="quick-act msg-ai-risk-btn"
                  disabled={disputeRiskLoading || messages.length === 0}
                  onClick={async () => {
                    setDisputeRiskLoading(true);
                    try {
                      const last20 = messages.slice(-20).map(m => ({
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
              {showScheduleModal && (
                <div className="offer-modal-overlay" onClick={() => { if (!scheduleSaving) { setShowScheduleModal(false); setEditingApptId(null); } }}>
                  <div className="offer-modal" onClick={e => e.stopPropagation()}>
                    <div className="offer-modal-header">
                      <h2>📅 {editingApptId ? 'Edit appointment' : 'Schedule'}</h2>
                      <button className="offer-modal-close" onClick={() => { setShowScheduleModal(false); setEditingApptId(null); }} disabled={scheduleSaving}>✕</button>
                    </div>

                    {scheduleError && (
                      <div className="offer-error" style={{ marginBottom: '12px' }}>{scheduleError}</div>
                    )}

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!selectedConvo?._id) return;

                        setScheduleSaving(true);
                        setScheduleError('');
                        try {
                          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
                          const startLocal = new Date(`${scheduleDate}T${scheduleTime}:00`);
                          if (Number.isNaN(startLocal.getTime())) throw new Error('Invalid date/time');

                          const payload = {
                            appointmentType: scheduleType,
                            startAtUtc: startLocal.toISOString(),
                            durationMinutes: Number(scheduleDuration),
                            timezone: tz,
                            notes: scheduleNotes,
                          };

                          let appt;
                          if (editingApptId) {
                            const resp = await apiRequest(`/api/appointments/${editingApptId}`, {
                              method: 'PUT',
                              body: JSON.stringify(payload),
                            });
                            appt = resp.appointment;
                          } else {
                            const resp = await apiRequest('/api/appointments', {
                              method: 'POST',
                              body: JSON.stringify({
                                conversationId: selectedConvo._id,
                                ...payload,
                                jobId: selectedConvo?.job?._id || selectedConvo?.job || undefined,
                                serviceId: selectedConvo?.service?._id || selectedConvo?.service || undefined,
                              }),
                            });
                            appt = resp.appointment;
                          }

                          await fetchAppointments(selectedConvo._id);
                          const startStr = new Date(appt.startAtUtc).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
                          const mins = Math.round((new Date(appt.endAtUtc).getTime() - new Date(appt.startAtUtc).getTime()) / 60000);

                          await apiRequest(`/api/messages/conversations/${selectedConvo._id}/messages`, {
                            method: 'POST',
                            body: JSON.stringify({
                              content: `${editingApptId ? '✏️ Appointment update proposed' : '📅 Appointment proposed'} [appt:${appt.id}]: ${startStr} (${mins} min) — ${appt.appointmentType}${scheduleNotes ? `\nNotes: ${scheduleNotes}` : ''}`
                            })
                          });

                          setShowScheduleModal(false);
                          setEditingApptId(null);
                          fetchConversations();
                          if (selectedConvo?._id) fetchMessages(selectedConvo);
                        } catch (err) {
                          setScheduleError(err?.message || 'Failed to schedule');
                        } finally {
                          setScheduleSaving(false);
                        }
                      }}
                      className="offer-form"
                    >
                      <div className="offer-form-row">
                        <div className="offer-field">
                          <label>Type *</label>
                          <select value={scheduleType} onChange={e => setScheduleType(e.target.value)} disabled={scheduleSaving}>
                            <option value="service">Service session</option>
                            <option value="job">Job-related session</option>
                            <option value="phone">Phone call</option>
                            <option value="video">Video call</option>
                            <option value="consultation">General consultation</option>
                          </select>
                        </div>
                        <div className="offer-field">
                          <label>Date *</label>
                          <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} required disabled={scheduleSaving} />
                        </div>
                      </div>

                      <div className="offer-form-row">
                        <div className="offer-field">
                          <label>Time *</label>
                          <input type="time" step="900" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} required disabled={scheduleSaving} />
                          <small style={{ color: 'var(--color-text-muted)' }}>15-min increments</small>
                        </div>
                        <div className="offer-field">
                          <label>Duration *</label>
                          <select value={scheduleDuration} onChange={e => setScheduleDuration(Number(e.target.value))} disabled={scheduleSaving}>
                            {Array.from({ length: 16 }, (_, i) => (i + 1) * 15).map(m => (
                              <option key={m} value={m}>{m} min</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="offer-field" style={{ marginTop: '8px' }}>
                        <label>Notes</label>
                        <textarea
                          rows={3}
                          value={scheduleNotes}
                          onChange={e => setScheduleNotes(e.target.value)}
                          placeholder="Optional notes (address, agenda, call link, etc.)"
                          disabled={scheduleSaving}
                        />
                      </div>

                      <div className="offer-actions">
                        <button type="button" className="offer-btn-secondary" onClick={() => { setShowScheduleModal(false); setEditingApptId(null); }} disabled={scheduleSaving}>Cancel</button>
                        <button type="submit" className="offer-btn-primary" disabled={scheduleSaving || !scheduleDate || !scheduleTime}>
                          {scheduleSaving ? 'Proposing…' : 'Propose'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Payment Request Modal */}
              {showPayModal && (
                <div className="offer-modal-overlay" onClick={() => !paySaving && setShowPayModal(false)}>
                  <div className="offer-modal" onClick={e => e.stopPropagation()}>
                    <div className="offer-modal-header">
                      <h2>💳 Request Payment</h2>
                      <button className="offer-modal-close" onClick={() => setShowPayModal(false)} disabled={paySaving}>✕</button>
                    </div>

                    {payError && <div className="offer-error" style={{ marginBottom: 12 }}>{payError}</div>}

                    <form
                      className="offer-form"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!selectedConvo?._id) return;
                        setPaySaving(true);
                        setPayError('');
                        try {
                          const resp = await apiRequest('/api/payment-requests', {
                            method: 'POST',
                            body: JSON.stringify({
                              conversationId: selectedConvo._id,
                              amount: parseFloat(payAmount),
                              description: payDescription,
                              type: payType,
                              jobId: selectedConvo?.job?._id || selectedConvo?.job || undefined,
                              serviceId: selectedConvo?.service?._id || selectedConvo?.service || undefined,
                            }),
                          });
                          const pr = resp.paymentRequest;
                          await fetchPaymentRequests(selectedConvo._id);
                          await apiRequest(`/api/messages/conversations/${selectedConvo._id}/messages`, {
                            method: 'POST',
                            body: JSON.stringify({
                              content: `💳 Payment requested [pr:${pr._id}]: $${parseFloat(payAmount).toFixed(2)} — ${payType === 'service_rendered' ? 'Service rendered' : 'Additional funds'}${payDescription ? `\n${payDescription}` : ''}`,
                            }),
                          });
                          setShowPayModal(false);
                          fetchConversations();
                          fetchMessages(selectedConvo);
                        } catch (err) {
                          setPayError(err?.message || 'Failed to create payment request');
                        } finally {
                          setPaySaving(false);
                        }
                      }}
                    >
                      <div className="offer-form-row">
                        <div className="offer-field">
                          <label>Amount ($) *</label>
                          <input
                            type="number" min="1" step="0.01"
                            value={payAmount}
                            onChange={e => setPayAmount(e.target.value)}
                            placeholder="150.00"
                            required
                            disabled={paySaving}
                          />
                        </div>
                        <div className="offer-field">
                          <label>Type *</label>
                          <select value={payType} onChange={e => setPayType(e.target.value)} disabled={paySaving}>
                            <option value="service_rendered">Service rendered</option>
                            <option value="additional_funds">Additional funds</option>
                          </select>
                        </div>
                      </div>
                      <div className="offer-field">
                        <label>Description *</label>
                        <textarea
                          rows={3}
                          value={payDescription}
                          onChange={e => setPayDescription(e.target.value)}
                          placeholder="What is this payment for?"
                          required
                          disabled={paySaving}
                        />
                      </div>
                      <div className="offer-actions">
                        <button type="button" className="offer-btn-secondary" onClick={() => setShowPayModal(false)} disabled={paySaving}>Cancel</button>
                        <button type="submit" className="offer-btn-primary" disabled={paySaving || !payAmount || !payDescription}>
                          {paySaving ? 'Sending…' : 'Send Request'}
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

        {/* ── Context Panel (drawer on mobile, inline on desktop) ── */}
        {selectedConvo && showContext && (
          <div className="messages-context" onClick={() => setShowContext(false)}>
          <div className="context-panel-inner" onClick={e => e.stopPropagation()}>
            <div className="context-header">
              <h3>Details</h3>
              <button onClick={() => setShowContext(false)}>×</button>
            </div>

            {/* Profile summary */}
            <div className="context-profile">
              <div className="context-avatar">
                {otherParticipant?.profilePicture
                  ? <img src={otherParticipant.profilePicture} alt="" />
                  : <span>{otherParticipant?.firstName?.[0]}{otherParticipant?.lastName?.[0]}</span>}
              </div>
              <h4>{otherParticipant?.firstName} {otherParticipant?.lastName}</h4>
              {contextProfileLoading && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>Loading…</div>}

              {contextProfile && (
                <>
                  {/* Rating */}
                  {contextProfile.stats?.rating > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, justifyContent: 'center' }}>
                      <span style={{ color: '#f59e0b', fontSize: 14 }}>{'★'.repeat(Math.round(contextProfile.stats.rating))}{'☆'.repeat(5 - Math.round(contextProfile.stats.rating))}</span>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{contextProfile.stats.rating.toFixed(1)}</span>
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>({contextProfile.stats.totalReviews})</span>
                    </div>
                  )}

                  {/* Stats row */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                    {contextProfile.stats?.completedJobs > 0 && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{contextProfile.stats.completedJobs}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Jobs done</div>
                      </div>
                    )}
                    {contextProfile.freelancer?.memberSince && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{new Date(contextProfile.freelancer.memberSince).getFullYear()}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Member since</div>
                      </div>
                    )}
                  </div>

                  {/* Bio */}
                  {contextProfile.freelancer?.bio && (
                    <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 10, lineHeight: 1.5, textAlign: 'left' }}>
                      {contextProfile.freelancer.bio.length > 180
                        ? contextProfile.freelancer.bio.slice(0, 180) + '…'
                        : contextProfile.freelancer.bio}
                    </p>
                  )}

                  {/* Skills */}
                  {contextProfile.freelancer?.skills?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                      {contextProfile.freelancer.skills.slice(0, 8).map((s, i) => (
                        <span key={i} style={{ fontSize: 11, background: 'var(--color-bg-muted)', border: '1px solid var(--color-border)', borderRadius: 20, padding: '2px 8px', color: 'var(--color-text-medium)' }}>{s}</span>
                      ))}
                    </div>
                  )}

                  {/* Recent reviews */}
                  {contextProfile.reviews?.length > 0 && (
                    <div className="context-section" style={{ marginTop: 16 }}>
                      <h4>Recent Reviews</h4>
                      {contextProfile.reviews.slice(0, 3).map((r, i) => (
                        <div key={i} style={{ borderTop: i > 0 ? '1px solid var(--color-border)' : 'none', paddingTop: i > 0 ? 10 : 0, marginTop: i > 0 ? 10 : 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-darker)' }}>
                              {r.reviewer?.firstName} {r.reviewer?.lastName?.slice(0, 1)}.
                            </span>
                            <span style={{ color: '#f59e0b', fontSize: 12 }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                          </div>
                          {r.comment && (
                            <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3, lineHeight: 1.4 }}>
                              {r.comment.length > 120 ? r.comment.slice(0, 120) + '…' : r.comment}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              <Link to={`/freelancers/${otherParticipant?._id}`} className="context-link" style={{ marginTop: 12, display: 'inline-block' }}>
                View full profile →
              </Link>
            </div>

            {/* Linked job */}
            {selectedConvo.job && (
              <div className="context-section">
                <h4>Linked Job</h4>
                <Link to={`/jobs/${selectedConvo.job._id}`} state={{ returnTo: `/messages?conversation=${selectedConvo._id}` }} className="context-job-card">
                  <span>{selectedConvo.job.title}</span>
                  <span className="context-job-budget">{selectedConvo.job.budget?.amount ? `$${selectedConvo.job.budget.amount}` : ''}</span>
                </Link>
              </div>
            )}

            {/* Linked service */}
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

      {/* ── Call upgrade gate modal ── */}
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
              <button
                className="btn btn-primary"
                onClick={() => { setCallGateModal(null); navigate('/billing'); }}
              >
                Upgrade to Plus
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setCallGateModal(null)}
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages;


