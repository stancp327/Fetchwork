import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';
import axios from 'axios';

const MessagingContext = createContext();

const getApiBaseUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:10000';
  }
  return 'https://user:a0a9957baad8780d910f195376205e4b@fetchwork-verification-app-tunnel-c8wwvhm2.devinapps.com';
};

export const useMessaging = () => {
  const context = useContext(MessagingContext);
  if (!context) {
    throw new Error('useMessaging must be used within a MessagingProvider');
  }
  return context;
};

export const MessagingProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState(new Map());
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState(new Map());
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (user) {
      const token = localStorage.getItem('token');
      if (token) {
        const newSocket = io(getApiBaseUrl(), {
          auth: { token }
        });

        newSocket.on('connect', () => {
          console.log('Connected to messaging server');
          setConnected(true);
        });

        newSocket.on('disconnect', () => {
          console.log('Disconnected from messaging server');
          setConnected(false);
        });

        newSocket.on('newMessage', ({ conversationId, message }) => {
          setMessages(prev => {
            const conversationMessages = prev.get(conversationId) || [];
            return new Map(prev.set(conversationId, [...conversationMessages, message]));
          });
        });

        newSocket.on('userTyping', ({ userId, userEmail, isTyping }) => {
          setTypingUsers(prev => {
            const newTyping = new Map(prev);
            if (isTyping) {
              newTyping.set(userId, userEmail);
            } else {
              newTyping.delete(userId);
            }
            return newTyping;
          });
        });

        newSocket.on('userStatusUpdate', ({ userId, status }) => {
          setOnlineUsers(prev => {
            const newOnline = new Set(prev);
            if (status === 'offline') {
              newOnline.delete(userId);
            } else {
              newOnline.add(userId);
            }
            return newOnline;
          });
        });

        setSocket(newSocket);

        return () => {
          newSocket.close();
          setSocket(null);
          setConnected(false);
        };
      }
    }
  }, [user]);

  const fetchConversations = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${getApiBaseUrl()}/api/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConversations(response.data.conversations);
      return response.data.conversations;
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return [];
    }
  }, []);

  const fetchMessages = useCallback(async (conversationId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${getApiBaseUrl()}/api/messages/conversations/${conversationId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(prev => new Map(prev.set(conversationId, response.data.messages)));
      return response.data.messages;
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  }, []);

  const sendMessage = useCallback(async (conversationId, content) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${getApiBaseUrl()}/api/messages/conversations/${conversationId}/messages`, {
        content
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const newMessage = response.data.message;
      setMessages(prev => {
        const conversationMessages = prev.get(conversationId) || [];
        return new Map(prev.set(conversationId, [...conversationMessages, newMessage]));
      });

      return newMessage;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }, []);

  const createConversation = useCallback(async (participantId, jobId = null) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${getApiBaseUrl()}/api/messages/conversations`, {
        participantId,
        jobId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const newConversation = response.data.conversation;
      setConversations(prev => [newConversation, ...prev]);
      return newConversation;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }, []);

  const joinConversation = useCallback((conversationId) => {
    if (socket) {
      socket.emit('joinConversation', conversationId);
    }
  }, [socket]);

  const leaveConversation = useCallback((conversationId) => {
    if (socket) {
      socket.emit('leaveConversation', conversationId);
    }
  }, [socket]);

  const sendTypingIndicator = useCallback((conversationId, isTyping) => {
    if (socket) {
      socket.emit('typing', { conversationId, isTyping });
    }
  }, [socket]);

  const value = {
    socket,
    connected,
    conversations,
    messages,
    onlineUsers,
    typingUsers,
    fetchConversations,
    fetchMessages,
    sendMessage,
    createConversation,
    joinConversation,
    leaveConversation,
    sendTypingIndicator
  };

  return (
    <MessagingContext.Provider value={value}>
      {children}
    </MessagingContext.Provider>
  );
};
