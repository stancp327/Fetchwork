import { useCallback, useRef } from 'react';
import { apiRequest } from '../../../utils/api';

export default function useReceiptSync() {
  const lastSeqByConvoRef = useRef({});

  const updateReceiptCursor = useCallback(async (conversationId, { lastReadSeq, lastDeliveredSeq }) => {
    try {
      await apiRequest(`/api/messages/conversations/${conversationId}/receipts`, {
        method: 'POST',
        body: JSON.stringify({ lastReadSeq, lastDeliveredSeq }),
      });
    } catch (_) {}
  }, []);

  const syncConversationSinceLastSeq = useCallback(async (conversationId, selectedConvoRef, setMessages) => {
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

  return { syncConversationSinceLastSeq, updateReceiptCursor, lastSeqByConvoRef };
}
