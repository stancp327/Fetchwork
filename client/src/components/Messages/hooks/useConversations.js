import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../../utils/api';
import { getEntityId } from '../utils';

export default function useConversations(userId) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/api/messages/conversations');
      const raw = data.conversations || [];
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

  // Update a single conversation in-place (for socket events)
  const updateConversationLocally = useCallback((convoData) => {
    if (!convoData?._id) return;
    setConversations(prev => {
      const idx = prev.findIndex(c => c._id === convoData._id);
      if (idx === -1) {
        // New conversation — prepend
        return [convoData, ...prev];
      }
      const updated = [...prev];
      updated[idx] = { ...updated[idx], ...convoData };
      // Re-sort by lastActivity
      updated.sort((a, b) => new Date(b.lastActivity || 0) - new Date(a.lastActivity || 0));
      return updated;
    });
  }, []);

  // Debounced search
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

  return {
    conversations,
    setConversations,
    loading,
    error,
    setError,
    search,
    setSearch,
    filter,
    setFilter,
    searchResults,
    setSearchResults,
    searchLoading,
    fetchConversations,
    updateConversationLocally,
    filtered,
  };
}
