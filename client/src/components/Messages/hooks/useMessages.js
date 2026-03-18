import { useState, useCallback, useRef, useEffect } from 'react';
import { apiRequest } from '../../../utils/api';
import { getEntityId } from '../utils';

export default function useMessages({ userId, user, selectedConvoRef, socketRef, lastSeqByConvoRef, updateReceiptCursor, updateConversationLocally }) {
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [attachFiles, setAttachFiles] = useState([]);
  const [offPlatformWarning, setOffPlatformWarning] = useState('');
  const [safetyNudge, setSafetyNudge] = useState(null);
  const [translations, setTranslations] = useState({});
  const [translatingId, setTranslatingId] = useState(null);
  const [showLangPicker, setShowLangPicker] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Cleanup typing timer on unmount to prevent memory leaks
  useEffect(() => () => clearTimeout(typingTimeoutRef.current), []);

  const fetchMessages = useCallback(async (convo) => {
    try {
      const data = await apiRequest(`/api/messages/conversations/${convo._id}`);
      setMessages(data.messages || []);
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
      return data.conversation || convo;
    } catch (err) {
      setError(err.data?.error || err.message || 'Failed to load messages');
      return null;
    }
  }, [userId, updateReceiptCursor, lastSeqByConvoRef, socketRef]);

  const sendMessage = useCallback(async (e, selectedConvo) => {
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
        const formData = new FormData();
        if (content) formData.append('content', content);
        attachFiles.forEach(f => formData.append('attachments', f));

        const data = await apiRequest(
          `/api/messages/conversations/${selectedConvo._id}/messages/upload`,
          { method: 'POST', body: formData }
        );
        // Update messages locally from response — no fetchMessages needed
        setMessages(prev => prev.map(m => m._id === optimistic._id ? data.data : m));
        if (data.warning) setOffPlatformWarning(data.warning);
      } else {
        const res = await apiRequest(
          `/api/messages/conversations/${selectedConvo._id}/messages`,
          { method: 'POST', body: JSON.stringify({ content }) }
        );
        // Update messages locally from response — no fetchMessages needed
        setMessages(prev => prev.map(m => m._id === optimistic._id ? res.data : m));
        if (res.warning) setOffPlatformWarning(res.warning);
      }
      // Socket echo will handle conversation list update
    } catch (err) {
      if (err?.status === 422 || err?.error === 'off_platform_detected') {
        setOffPlatformWarning(err?.message || '🚫 Message blocked: asking to work or pay outside Fetchwork is not allowed.');
        setMessages(prev => prev.filter(m => m._id !== optimistic._id));
        setNewMessage(content);
      } else {
        setError(err?.data?.error || err?.message || 'Failed to send message');
        setMessages(prev => prev.filter(m => m._id !== optimistic._id));
      }
    } finally {
      setSending(false);
    }
  }, [newMessage, attachFiles, sending, userId, user]);

  const handleTyping = useCallback((e, selectedConvo) => {
    setNewMessage(e.target.value);
    if (socketRef.current && selectedConvo) {
      socketRef.current.emit('typing:start', { conversationId: selectedConvo._id });
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current?.emit('typing:stop', { conversationId: selectedConvo._id });
      }, 2000);
    }
  }, [socketRef]);

  const handleTranslate = useCallback(async (msgId, text, langCode) => {
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
  }, []);

  return {
    messages,
    setMessages,
    sending,
    newMessage,
    setNewMessage,
    attachFiles,
    setAttachFiles,
    offPlatformWarning,
    setOffPlatformWarning,
    safetyNudge,
    setSafetyNudge,
    sendMessage,
    fetchMessages,
    handleTyping,
    translations,
    translatingId,
    showLangPicker,
    setShowLangPicker,
    handleTranslate,
    fileInputRef,
    error,
    setError,
    typingTimeoutRef,
  };
}
