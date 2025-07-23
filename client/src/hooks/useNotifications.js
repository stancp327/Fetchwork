import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const getApiBaseUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:10000';
  }
  return 'https://fetchwork-1.onrender.com';
};

export const useNotifications = () => {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState({
    unreadMessages: 0,
    pendingProposals: 0
  });
  const [loading, setLoading] = useState(false);

  const apiBaseUrl = getApiBaseUrl();

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${apiBaseUrl}/api/users/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const stats = response.data.stats || {};
      setNotifications({
        unreadMessages: stats.unreadMessages || 0,
        pendingProposals: stats.pendingProposals || 0
      });
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, isAuthenticated]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  return { notifications, loading, refetch: fetchNotifications };
};
