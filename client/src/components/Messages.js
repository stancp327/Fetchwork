import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Navigation from './Navigation';

const Messages = () => {
  const { token, user } = useAuth();
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) {
      fetchConversations();
    }
  }, [token]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation._id);
    }
  }, [selectedConversation]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/messages/conversations', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setConversations(data);
        if (data.length > 0 && !selectedConversation) {
          setSelectedConversation(data[0]);
        }
        setError('');
      } else {
        setError(data.message || 'Failed to fetch conversations');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId) => {
    try {
      const response = await fetch(`/api/messages/conversations/${conversationId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setMessages(data);
        setError('');
      } else {
        setError(data.message || 'Failed to fetch messages');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      const response = await fetch(`/api/messages/conversations/${selectedConversation._id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: newMessage.trim()
        })
      });

      const result = await response.json();

      if (response.ok) {
        setNewMessage('');
        fetchMessages(selectedConversation._id);
        fetchConversations();
      } else {
        setError(result.message || 'Failed to send message');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Less than an hour ago';
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  };

  const formatMessageTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getOtherParticipant = (conversation) => {
    return conversation.participants.find(p => p._id !== user._id);
  };

  if (!token) {
    return (
      <div>
        <Navigation />
        <div className="page-container">
          <div className="messages">
            <h1>Messages</h1>
            <p>Please log in to view your messages.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navigation />
      <div className="page-container">
        <div className="messages">
          <h1>Messages</h1>
          
          {error && <div className="error-message">{error}</div>}
          
          {loading ? (
            <div className="loading">Loading conversations...</div>
          ) : conversations.length === 0 ? (
            <div className="no-conversations">
              <p>No conversations yet. Start by applying to jobs or posting your own!</p>
            </div>
          ) : (
            <div className="messages-container"></div>
          )}
            <div className="conversations-list">
              <h3>Conversations</h3>
              {conversations.map((conversation) => {
                const otherParticipant = getOtherParticipant(conversation);
                return (
                  <div
                    key={conversation._id}
                    className={`conversation-item ${selectedConversation?._id === conversation._id ? 'active' : ''}`}
                    onClick={() => setSelectedConversation(conversation)}
                  >
                    <div className="conversation-avatar">
                      {otherParticipant?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="conversation-info">
                      <div className="conversation-header">
                        <span className="conversation-name">{otherParticipant?.name || 'Unknown User'}</span>
                        <span className="conversation-time">{formatTimeAgo(conversation.lastActivity)}</span>
                      </div>
                      <div className="conversation-preview">
                        <span className="last-message">
                          {conversation.lastMessage?.content || 'No messages yet'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="chat-area">
              {selectedConversation ? (
                <>
                  <div className="chat-header">
                    <div className="chat-user-info">
                      <div className="chat-avatar">
                        {getOtherParticipant(selectedConversation)?.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <span className="chat-user-name">
                        {getOtherParticipant(selectedConversation)?.name || 'Unknown User'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="messages-list">
                    {messages.map((message) => (
                      <div
                        key={message._id}
                        className={`message ${message.sender._id === user._id ? 'own-message' : 'other-message'}`}
                      >
                        <div className="message-content">
                          {message.content}
                        </div>
                        <div className="message-time">
                          {formatMessageTime(message.createdAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <form onSubmit={handleSendMessage} className="message-input-form">
                    <div className="message-input-container">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message..."
                        className="message-input"
                      />
                      <button type="submit" className="send-btn">
                        Send
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="no-conversation-selected">
                  <p>Select a conversation to start messaging</p>
                </div>
              )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default Messages;
