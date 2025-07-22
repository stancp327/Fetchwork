import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useMessaging } from '../../context/MessagingContext';
import './Messages.css';

const Messages = () => {
  const { user } = useAuth();
  const {
    conversations,
    messages,
    connected,
    typingUsers,
    onlineUsers,
    fetchConversations,
    fetchMessages,
    sendMessage,
    joinConversation,
    leaveConversation,
    sendTypingIndicator
  } = useMessaging();

  const [selectedChat, setSelectedChat] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      await fetchConversations();
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchConversations]);

  const loadMessages = useCallback(async (conversationId) => {
    try {
      await fetchMessages(conversationId);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }, [fetchMessages]);

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user, loadConversations]);

  useEffect(() => {
    if (selectedChat) {
      joinConversation(selectedChat.id);
      loadMessages(selectedChat.id);
      
      return () => {
        leaveConversation(selectedChat.id);
      };
    }
  }, [selectedChat, joinConversation, loadMessages, leaveConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, selectedChat]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleChatSelect = (conversation) => {
    if (selectedChat) {
      leaveConversation(selectedChat.id);
    }
    setSelectedChat(conversation);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (newMessage.trim() && selectedChat) {
      try {
        await sendMessage(selectedChat.id, newMessage.trim());
        setNewMessage('');
        handleTypingStop();
      } catch (error) {
        console.error('Error sending message:', error);
      }
    }
  };

  const handleTypingStart = () => {
    if (!isTyping && selectedChat) {
      setIsTyping(true);
      sendTypingIndicator(selectedChat.id, true);
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      handleTypingStop();
    }, 3000);
  };

  const handleTypingStop = () => {
    if (isTyping && selectedChat) {
      setIsTyping(false);
      sendTypingIndicator(selectedChat.id, false);
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    handleTypingStart();
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now - date) / (1000 * 60));
      return diffInMinutes <= 1 ? 'Just now' : `${diffInMinutes} min ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hour${Math.floor(diffInHours) > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const currentMessages = selectedChat ? messages.get(selectedChat.id) || [] : [];
  const currentTypingUsers = selectedChat ? Array.from(typingUsers.entries()).filter(([userId]) => userId !== user?.id) : [];

  if (loading) {
    return (
      <div className="messages">
        <div className="loading">Loading conversations...</div>
      </div>
    );
  }

  return (
    <div className="messages">
      <div className="messages-sidebar">
        <div className="sidebar-header">
          <h2>Messages</h2>
          <button 
            className="new-message-btn"
            onClick={() => console.log('New conversation modal not implemented')}
          >
            + New
          </button>
        </div>
        
        <div className="chat-list">
          {conversations.length === 0 ? (
            <div className="no-conversations">
              <p>No conversations yet</p>
              <p>Start a new conversation to begin messaging</p>
            </div>
          ) : (
            conversations.map(chat => {
              const participant = chat.participant;
              const isOnline = onlineUsers.has(participant?._id);
              const initials = getInitials(participant?.profile?.firstName && participant?.profile?.lastName 
                ? `${participant.profile.firstName} ${participant.profile.lastName}` 
                : participant?.email);
              
              return (
                <div 
                  key={chat.id} 
                  className={`chat-item ${selectedChat?.id === chat.id ? 'active' : ''}`}
                  onClick={() => handleChatSelect(chat)}
                >
                  <div className="chat-avatar">
                    <div className="avatar-circle">
                      {initials}
                    </div>
                    {isOnline && <div className="online-indicator"></div>}
                  </div>
                  
                  <div className="chat-info">
                    <div className="chat-header">
                      <h4 className="chat-name">
                        {participant?.profile?.firstName && participant?.profile?.lastName 
                          ? `${participant.profile.firstName} ${participant.profile.lastName}`
                          : participant?.email || 'Unknown User'}
                      </h4>
                      <span className="chat-timestamp">
                        {chat.lastMessage ? formatTimestamp(chat.lastMessage.createdAt) : ''}
                      </span>
                    </div>
                    <p className="chat-preview">
                      {chat.lastMessage?.content || 'No messages yet'}
                    </p>
                    <div className="chat-meta">
                      <span className="user-type-label">{participant?.userType || 'user'}</span>
                      {chat.unreadCount > 0 && (
                        <span className="unread-badge">{chat.unreadCount}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {!connected && (
          <div className="connection-status">
            <p><span role="img" aria-label="warning">⚠️</span> Disconnected from messaging server</p>
          </div>
        )}
      </div>

      <div className="messages-main">
        {selectedChat ? (
          <>
            <div className="chat-header">
              <div className="chat-user-info">
                <div className="avatar-circle">
                  {getInitials(selectedChat.participant?.profile?.firstName && selectedChat.participant?.profile?.lastName 
                    ? `${selectedChat.participant.profile.firstName} ${selectedChat.participant.profile.lastName}` 
                    : selectedChat.participant?.email)}
                </div>
                <div>
                  <h3>
                    {selectedChat.participant?.profile?.firstName && selectedChat.participant?.profile?.lastName 
                      ? `${selectedChat.participant.profile.firstName} ${selectedChat.participant.profile.lastName}`
                      : selectedChat.participant?.email || 'Unknown User'}
                  </h3>
                  <p className="user-status">
                    {onlineUsers.has(selectedChat.participant?._id) ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>
              
              <div className="chat-actions">
                <button className="action-btn"><span role="img" aria-label="phone">📞</span></button>
                <button className="action-btn"><span role="img" aria-label="video camera">📹</span></button>
                <button className="action-btn"><span role="img" aria-label="information">ℹ️</span></button>
              </div>
            </div>

            <div className="messages-container">
              {currentMessages.length === 0 ? (
                <div className="no-messages">
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                currentMessages.map(message => (
                  <div 
                    key={message._id} 
                    className={`message ${message.sender._id === user?.id ? 'own-message' : 'other-message'}`}
                  >
                    <div className="message-content">
                      <p>{message.content}</p>
                      <span className="message-time">
                        {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              )}
              
              {currentTypingUsers.length > 0 && (
                <div className="typing-indicator">
                  <div className="typing-content">
                    <span>{currentTypingUsers.map(([, email]) => email).join(', ')} is typing...</span>
                    <div className="typing-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            <form className="message-input-form" onSubmit={handleSendMessage}>
              <div className="input-container">
                <input
                  type="text"
                  className="message-input"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={handleInputChange}
                  onBlur={handleTypingStop}
                />
                <button type="submit" className="send-btn" disabled={!newMessage.trim() || !connected}>
                  Send
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="no-chat-selected">
            <div className="no-chat-content">
              <div className="no-chat-icon"><span role="img" aria-label="speech bubble">💬</span></div>
              <h3>Select a conversation</h3>
              <p>Choose a conversation from the sidebar to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;
