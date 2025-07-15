import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import messageService from '../services/messageService';

function Messages() {
  const { user } = useAuth();
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      initializeMessaging();
    }
    
    return () => {
      messageService.disconnect();
    };
  }, [user]);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation._id);
      messageService.joinConversation(selectedConversation._id);
    }
  }, [selectedConversation]);

  const initializeMessaging = async () => {
    try {
      setLoading(true);
      
      const socket = messageService.connect();
      
      messageService.onNewMessage((messageData) => {
        if (selectedConversation && messageData.conversationId === selectedConversation._id) {
          setMessages(prev => [...prev, {
            _id: Date.now(),
            content: messageData.content,
            sender: messageData.sender,
            createdAt: messageData.timestamp,
            isOwn: messageData.sender._id === user._id
          }]);
        }
        
        loadConversations();
      });
      
      await loadConversations();
    } catch (error) {
      setError('Failed to initialize messaging');
    } finally {
      setLoading(false);
    }
  };

  const loadConversations = async () => {
    try {
      const response = await messageService.getConversations();
      setConversations(response);
    } catch (error) {
      setError('Failed to load conversations');
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      const response = await messageService.getMessages(conversationId);
      setMessages(response.map(msg => ({
        ...msg,
        isOwn: msg.sender._id === user._id
      })));
    } catch (error) {
      setError('Failed to load messages');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      await messageService.sendMessageAPI(selectedConversation._id, newMessage);
      
      messageService.sendMessage(selectedConversation._id, newMessage);
      
      setMessages(prev => [...prev, {
        _id: Date.now(),
        content: newMessage,
        sender: user,
        createdAt: new Date(),
        isOwn: true
      }]);
      
      setNewMessage('');
    } catch (error) {
      setError('Failed to send message');
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString();
    }
  };

  if (loading) return <div className="loading">Loading messages...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="messages-page">
      <div className="messages-container">
        <div className="conversations-sidebar">
          <div className="sidebar-header">
            <h2>Messages</h2>
            <button className="btn btn-secondary">New Message</button>
          </div>
          
          <div className="conversations-list">
            {conversations.map(conversation => {
              const otherParticipant = conversation.participants.find(p => p.user._id !== user._id);
              return (
                <div
                  key={conversation._id}
                  className={`conversation-item ${selectedConversation?._id === conversation._id ? 'active' : ''}`}
                  onClick={() => setSelectedConversation(conversation)}
                >
                  <div className="conversation-avatar">
                    <span>👤</span>
                  </div>
                  <div className="conversation-info">
                    <div className="conversation-header">
                      <h4>{otherParticipant?.user.firstName} {otherParticipant?.user.lastName}</h4>
                      <span className="timestamp">{formatTimestamp(conversation.updatedAt)}</span>
                    </div>
                    <p className="project-name">{conversation.relatedJob?.title || 'General'}</p>
                    <p className="last-message">{conversation.lastMessage?.content || 'No messages yet'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="chat-area">
          {selectedConversation ? (
            <>
              <div className="chat-header">
                <div className="chat-user-info">
                  <span className="chat-avatar">👤</span>
                  <div>
                    <h3>{selectedConversation.participants.find(p => p.user._id !== user._id)?.user.firstName}</h3>
                    <p>{selectedConversation.relatedJob?.title || 'General Chat'}</p>
                  </div>
                </div>
                <div className="chat-actions">
                  <button className="btn btn-secondary">📎 Share File</button>
                  <button className="btn btn-secondary">📞 Call</button>
                </div>
              </div>

              <div className="messages-area">
                {messages.map(message => (
                  <div
                    key={message._id}
                    className={`message ${message.isOwn ? 'message-own' : 'message-other'}`}
                  >
                    <div className="message-content">
                      <p>{message.content}</p>
                      <span className="message-timestamp">{formatTimestamp(message.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <form className="message-input-area" onSubmit={handleSendMessage}>
                <div className="message-input-container">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="message-input"
                  />
                  <button type="button" className="attachment-btn">📎</button>
                  <button type="submit" className="send-btn">Send</button>
                </div>
              </form>
            </>
          ) : (
            <div className="no-conversation">
              <h3>Select a conversation to start messaging</h3>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Messages;
