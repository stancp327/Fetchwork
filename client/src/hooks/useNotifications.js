import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';

// ── Original hook (used by Navigation, etc.) ────────────────────
export const useNotifications = () => {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState({
    unreadMessages: 0,
    pendingProposals: 0,
    unreadNotifications: 0,
    items: []
  });
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      setLoading(true);

      // Fetch both dashboard stats and notification count
      const [dashResponse, notifResponse] = await Promise.allSettled([
        apiRequest('/api/users/dashboard'),
        apiRequest('/api/notifications?limit=10&unreadOnly=true')
      ]);

      const stats = dashResponse.status === 'fulfilled' ? (dashResponse.value.stats || {}) : {};
      const notifData = notifResponse.status === 'fulfilled' ? notifResponse.value : { unreadCount: 0, notifications: [] };

      setNotifications({
        unreadMessages: stats.unreadMessages || 0,
        pendingProposals: stats.pendingProposals || 0,
        unreadNotifications: notifData.unreadCount || 0,
        items: notifData.notifications || []
      });
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const markAsRead = useCallback(async (notificationId) => {
    try {
      await apiRequest(`/api/notifications/${notificationId}/read`, { method: 'PATCH' });
      setNotifications(prev => ({
        ...prev,
        unreadNotifications: Math.max(0, prev.unreadNotifications - 1),
        items: prev.items.map(n => n._id === notificationId ? { ...n, read: true } : n)
      }));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await apiRequest('/api/notifications/read-all', { method: 'PATCH' });
      setNotifications(prev => ({
        ...prev,
        unreadNotifications: 0,
        items: prev.items.map(n => ({ ...n, read: true }))
      }));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Real-time: new in-app notification pushed via socket
  useEffect(() => {
    const onNew = (e) => {
      const notif = e.detail;
      if (!notif) return;
      setNotifications(prev => ({
        ...prev,
        unreadNotifications: prev.unreadNotifications + 1,
        items: [{ ...notif, read: false }, ...prev.items].slice(0, 10)
      }));
    };
    window.addEventListener('fetchwork:notification', onNew);
    return () => window.removeEventListener('fetchwork:notification', onNew);
  }, []);

  // Real-time: new message received (updates the Messages nav badge instantly)
  useEffect(() => {
    const onMsg = () => {
      setNotifications(prev => ({
        ...prev,
        unreadMessages: prev.unreadMessages + 1
      }));
    };
    window.addEventListener('fetchwork:unread-message', onMsg);
    return () => window.removeEventListener('fetchwork:unread-message', onMsg);
  }, []);

  return { notifications, loading, refetch: fetchNotifications, markAsRead, markAllRead };
};

// ── React Query hooks (for new features) ────────────────────────

export function useNotificationCount() {
  return useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: () => apiRequest('/api/notifications/count'),
    refetchInterval: 30 * 1000,
    staleTime: 10 * 1000,
  });
}

export function useNotificationsList(page = 1) {
  return useQuery({
    queryKey: ['notifications', 'list', page],
    queryFn: () => apiRequest(`/api/notifications?page=${page}&limit=20`),
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids) => apiRequest('/api/notifications/read', {
      method: 'PUT',
      body: JSON.stringify({ ids }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
