import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../socket/useSocket';
import '../UserComponents.css';

const getApiBaseUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:10000';
  }
  return 'https://fetchwork-1.onrender.com';
};

const Messages = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState(null);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [deliveryStatus, setDeliveryStatus] = useState(new Map());
  const typingTimeoutRef = useRef(null);

  const apiBaseUrl = getApiBaseUrl();
  const token = localStorage.getItem('token');

  const socketRef = useSocket({
    token,
    onEvent: (event, data) => {
      switch (event) {
        case 'message:receive':
          console.log('[UI] Received new message:', data.message);
          setMessages(prev => {
            const messageExists = prev.some(msg => msg._id === data.message._id);
            if (messageExists) return prev;
            return [...prev, data.message];
          });
          fetchConversations();
          break;
        
        case 'message:read':
          console.log('[UI] Messages marked as read:', data);
          setMessages(prev => prev.map(msg => 
            data.messageIds.includes(msg._id) 
              ? { ...msg, isRead: true, readAt: data.readAt }
              : msg
          ));
          break;
        
        case 'conversation:update':
          console.log('[UI] Conversation updated:', data.conversation);
          fetchConversations();
          break;
        
        case 'typing:start':
          console.log('[UI] User started typing:', data);
          if (data.conversationId === selectedConversation?._id) {
            setTypingUsers(prev => new Set([...prev, data.userId]));
          }
          break;
        
        case 'typing:stop':
          console.log('[UI] User stopped typing:', data);
          if (data.conversationId === selectedConversation?._id) {
            setTypingUsers(prev => {
              const newSet = new Set(prev);
              newSet.delete(data.userId);
              return newSet;
            });
          }
          break;
        
        case 'user:online':
          console.log('[UI] User came online:', data);
          break;
        
        case 'user:offline':
          console.log('[UI] User went offline:', data);
          break;
        
        case 'message:delivered':
          console.log('[UI] Message delivered:', data);
          setDeliveryStatus(prev => new Map([...prev, [data.messageId, data.deliveredAt]]));
          break;
        
        case 'user:online_status':
          console.log('[UI] Online status update:', data);
          break;
        
        default:
          console.warn('[UI] Unhandled socket event:', event);
      }
    }
  });

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${apiBaseUrl}/api/messages/conversations`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setConversations(response.data.conversations);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      setError(error.response?.data?.error || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  const fetchMessages = useCallback(async (conversationId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${apiBaseUrl}/api/messages/conversations/${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setMessages(response.data.messages);
      setSelectedConversation(response.data.conversation);
      
      const unreadMessages = response.data.messages.filter(msg => 
        !msg.isRead && msg.recipient === user?.id
      );
      
      if (unreadMessages.length > 0 && socketRef.current) {
        console.log('[UI] Marking messages as read via socket:', unreadMessages.map(m => m._id));
        socketRef.current.emit('message:read', {
          conversationId,
          messageIds: unreadMessages.map(m => m._id)
        });
      }
      
      if (response.data.conversation && socketRef.current) {
        const otherParticipant = getOtherParticipant(response.data.conversation);
        if (otherParticipant) {
          socketRef.current.emit('user:get_online_status', {
            userIds: [otherParticipant._id]
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      setError(error.response?.data?.error || 'Failed to load messages');
    }
  }, [apiBaseUrl, user?.id]);

  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !selectedConversation) {
      return;
    }

    setSendingMessage(true);
    
    const optimisticMessage = {
      _id: `temp-${Date.now()}`,
      content: newMessage.trim(),
      sender: { _id: user?.id, firstName: user?.firstName, lastName: user?.lastName },
      createdAt: new Date().toISOString(),
      isRead: false,
      conversation: selectedConversation._id
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    const messageContent = newMessage.trim();
    setNewMessage('');
    
    try {
      if (socketRef.current) {
        console.log('[UI] Sending message via socket:', {
          recipientId: getOtherParticipant(selectedConversation)?._id,
          content: messageContent,
          messageType: 'text'
        });
        
        socketRef.current.emit('message:send', {
          recipientId: getOtherParticipant(selectedConversation)?._id,
          content: messageContent,
          messageType: 'text'
        });
      } else {
        console.log('[UI] Socket not available, falling back to REST API');
        const response = await axios.post(
          `${apiBaseUrl}/api/messages/conversations/${selectedConversation._id}/messages`,
          { content: messageContent },
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        setMessages(prev => prev.map(msg => 
          msg._id === optimisticMessage._id ? response.data.data : msg
        ));
        
        await fetchConversations();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setError(error.response?.data?.error || 'Failed to send message');
      setMessages(prev => prev.filter(msg => msg._id !== optimisticMessage._id));
    } finally {
      setSendingMessage(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user, fetchConversations]);

  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) {
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  };

  const getOtherParticipant = (conversation) => {
    return conversation.participants.find(p => p._id !== user?.id);
  };

  if (loading) {
    return (
      <div className="user-container">
        <div className="loading">Loading messages...</div>
      </div>
    );
  }

  return (
    <div className="user-container">
      <div className="user-header">
        <h1>Messages</h1>
        <p>Communicate with clients and freelancers</p>
      </div>

      {error && <div className="error">{error}</div>}

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: window.innerWidth <= 767 ? '1fr' : '1fr 2fr',
        gap: '20px', 
        height: window.innerWidth <= 767 ? 'auto' : '600px',
        minHeight: window.innerWidth <= 767 ? '70vh' : '600px',
        background: 'white',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ 
          borderRight: '1px solid #e9ecef',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ 
            padding: '20px',
            borderBottom: '1px solid #e9ecef',
            background: '#f8f9fa'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Conversations</h3>
          </div>
          
          <div style={{ 
            flex: 1,
            overflowY: 'auto'
          }}>
            {conversations.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 20px' }}>
                <h4>No conversations yet</h4>
                <p>Start a conversation by applying to a job or posting one</p>
              </div>
            ) : (
              conversations.map((conversation) => {
                const otherParticipant = getOtherParticipant(conversation);
                return (
                  <div
                    key={conversation._id}
                    onClick={() => fetchMessages(conversation._id)}
                    style={{
                      padding: '15px 20px',
                      borderBottom: '1px solid #f1f3f4',
                      cursor: 'pointer',
                      background: selectedConversation?._id === conversation._id ? '#e3f2fd' : 'transparent',
                      transition: 'background-color 0.2s ease'
                    }}
                  >
                    <div style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: '#667eea',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: '600',
                        fontSize: '0.9rem'
                      }}>
                        {otherParticipant?.firstName?.[0]}{otherParticipant?.lastName?.[0]}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ 
                          fontWeight: '600',
                          fontSize: '0.9rem',
                          marginBottom: '2px'
                        }}>
                          {otherParticipant?.firstName} {otherParticipant?.lastName}
                        </div>
                        {conversation.job && (
                          <div style={{ 
                            fontSize: '0.8rem',
                            color: '#6c757d',
                            marginBottom: '2px'
                          }}>
                            Re: {conversation.job.title}
                          </div>
                        )}
                        <div style={{ 
                          fontSize: '0.8rem',
                          color: '#6c757d'
                        }}>
                          {formatMessageTime(conversation.lastActivity)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div style={{ 
          display: 'flex',
          flexDirection: 'column'
        }}>
          {selectedConversation ? (
            <>
              <div style={{ 
                padding: '20px',
                borderBottom: '1px solid #e9ecef',
                background: '#f8f9fa'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: '#667eea',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: '600'
                  }}>
                    {getOtherParticipant(selectedConversation)?.firstName?.[0]}
                    {getOtherParticipant(selectedConversation)?.lastName?.[0]}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                      {getOtherParticipant(selectedConversation)?.firstName} {getOtherParticipant(selectedConversation)?.lastName}
                    </h3>
                    {selectedConversation.job && (
                      <div style={{ fontSize: '0.9rem', color: '#6c757d' }}>
                        Re: {selectedConversation.job.title}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ 
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '15px'
              }}>
                {messages.length === 0 ? (
                  <div className="empty-state">
                    <h4>No messages yet</h4>
                    <p>Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message._id}
                      style={{
                        display: 'flex',
                        justifyContent: message.sender._id === user?.id ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <div
                        style={{
                          maxWidth: '70%',
                          padding: '12px 16px',
                          borderRadius: '18px',
                          background: message.sender._id === user?.id ? '#667eea' : '#f1f3f4',
                          color: message.sender._id === user?.id ? 'white' : '#333',
                          fontSize: '0.9rem',
                          lineHeight: '1.4',
                          opacity: message._id.startsWith('temp-') ? 0.7 : 1
                        }}
                      >
                        <div>{message.content}</div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            opacity: 0.7,
                            marginTop: '4px',
                            textAlign: 'right',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '4px'
                          }}
                        >
                          {formatMessageTime(message.createdAt)}
                          {message.sender._id === user?.id && (
                            <span style={{ fontSize: '0.7rem' }}>
                              {message.isRead ? '✓✓' : deliveryStatus.has(message._id) ? '✓✓' : '✓'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                
                {typingUsers.size > 0 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'flex-start',
                    marginTop: '10px'
                  }}>
                    <div style={{
                      padding: '8px 12px',
                      background: '#f1f3f4',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      color: '#6c757d',
                      fontStyle: 'italic'
                    }}>
                      {getOtherParticipant(selectedConversation)?.firstName} is typing...
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={sendMessage} style={{ 
                padding: '20px',
                borderTop: '1px solid #e9ecef',
                display: 'flex',
                gap: '10px'
              }}>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    
                    if (socketRef.current && selectedConversation) {
                      socketRef.current.emit('typing:start', {
                        conversationId: selectedConversation._id
                      });
                      
                      if (typingTimeoutRef.current) {
                        clearTimeout(typingTimeoutRef.current);
                      }
                      
                      typingTimeoutRef.current = setTimeout(() => {
                        socketRef.current.emit('typing:stop', {
                          conversationId: selectedConversation._id
                        });
                      }, 2000);
                    }
                  }}
                  onBlur={() => {
                    if (socketRef.current && selectedConversation) {
                      socketRef.current.emit('typing:stop', {
                        conversationId: selectedConversation._id
                      });
                    }
                    if (typingTimeoutRef.current) {
                      clearTimeout(typingTimeoutRef.current);
                    }
                  }}
                  placeholder="Type your message..."
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    border: '1px solid #ced4da',
                    borderRadius: '24px',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                  disabled={sendingMessage}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sendingMessage}
                  className="btn btn-primary"
                  style={{
                    borderRadius: '24px',
                    padding: '12px 20px'
                  }}
                >
                  {sendingMessage ? 'Sending...' : 'Send'}
                </button>
              </form>
            </>
          ) : (
            <div className="empty-state" style={{ 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%'
            }}>
              <div style={{ textAlign: 'center' }}>
                <h3>Select a conversation</h3>
                <p>Choose a conversation from the left to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messages;
