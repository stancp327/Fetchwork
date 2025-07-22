import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const MessagingContext = createContext();

export const useMessaging = () => {
  const context = useContext(MessagingContext);
  if (!context) {
    throw new Error('useMessaging must be used within a MessagingProvider');
  }
  return context;
};

const getApiBaseUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:10000';
  }
  return 'https://fetchwork-1.onrender.com';
};

export const MessagingProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth();

  const apiBaseUrl = getApiBaseUrl();

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  const fetchConversations = async () => {
    try {
      console.log('Fetching conversations...');
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    }
  };

  const sendMessage = async (conversationId, content) => {
    try {
      console.log('Sending message:', { conversationId, content });
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const markAsRead = async (conversationId) => {
    try {
      console.log('Marking as read:', conversationId);
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const value = {
    messages,
    conversations,
    activeConversation,
    unreadCount,
    setActiveConversation,
    sendMessage,
    markAsRead,
    fetchConversations
  };

  return (
    <MessagingContext.Provider value={value}>
      {children}
    </MessagingContext.Provider>
  );
};
