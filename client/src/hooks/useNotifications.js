import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';

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

  // Real-time: when NotificationListener receives a socket push,
  // immediately update bell count + prepend to items list
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

  return { notifications, loading, refetch: fetchNotifications, markAsRead, markAllRead };
};
