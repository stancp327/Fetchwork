import { useEffect, useCallback } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { useToast } from './Toast';
import { useAuth } from '../../context/AuthContext';

const NotificationListener = () => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const handleEvent = useCallback((event, data) => {
    switch (event) {
      case 'message:receive':
        if (data?.sender?.firstName) {
          addToast(`💬 New message from ${data.sender.firstName}`, 'info');
        }
        break;
      case 'proposal:received':
        addToast(`📩 New proposal on "${data?.jobTitle || 'your job'}"`, 'success');
        break;
      case 'job:accepted':
        addToast(`🎉 Your proposal was accepted!`, 'success', 6000);
        break;
      case 'job:completed':
        addToast(`✅ Job "${data?.jobTitle || ''}" marked as complete`, 'success');
        break;
      case 'payment:received':
        addToast(`💰 Payment of $${data?.amount || ''} received`, 'success', 6000);
        break;
      case 'review:received':
        addToast(`⭐ You received a new review`, 'info');
        break;
      default:
        break;
    }
  }, [addToast]);

  useSocket({ onEvent: handleEvent });

  return null; // Invisible component — just listens
};

export default NotificationListener;
