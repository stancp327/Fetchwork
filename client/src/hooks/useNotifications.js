import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';

export const useNotifications = () => {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState({
    unreadMessages: 0,
    pendingProposals: 0
  });
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      setLoading(true);
      const response = await apiRequest('/api/users/dashboard');
      
      const stats = response.stats || {};
      setNotifications({
        unreadMessages: stats.unreadMessages || 0,
        pendingProposals: stats.pendingProposals || 0
      });
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  return { notifications, loading, refetch: fetchNotifications };
};
