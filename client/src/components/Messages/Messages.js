import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import './Messages.css';

const Messages = () => {
  const { user } = useAuth();
  const [selectedChat, setSelectedChat] = useState(null);
  const [newMessage, setNewMessage] = useState('');

  const sampleChats = [
    {
      id: 1,
      name: 'Sarah Johnson',
      userType: user?.userType === 'freelancer' ? 'client' : 'freelancer',
      lastMessage: 'Thanks for the quick turnaround on the design!',
      timestamp: '2 hours ago',
      unread: 2,
      avatar: 'SJ',
      online: true
    },
    {
      id: 2,
      name: 'Mike Chen',
      userType: user?.userType === 'freelancer' ? 'client' : 'freelancer',
      lastMessage: 'Can we schedule a call to discuss the project requirements?',
      timestamp: '5 hours ago',
      unread: 0,
      avatar: 'MC',
      online: false
    },
    {
      id: 3,
      name: 'Emma Wilson',
      userType: user?.userType === 'freelancer' ? 'client' : 'freelancer',
      lastMessage: 'The website looks great! Just a few minor changes needed.',
      timestamp: '1 day ago',
      unread: 1,
      avatar: 'EW',
      online: true
    },
    {
      id: 4,
      name: 'David Rodriguez',
      userType: user?.userType === 'freelancer' ? 'client' : 'freelancer',
      lastMessage: 'Payment has been released. Thank you for the excellent work!',
      timestamp: '2 days ago',
      unread: 0,
      avatar: 'DR',
      online: false
    }
  ];

  const sampleMessages = {
    1: [
      {
        id: 1,
        sender: 'Sarah Johnson',
        message: 'Hi! I saw your portfolio and I\'m interested in hiring you for a web design project.',
        timestamp: '10:30 AM',
        isOwn: false
      },
      {
        id: 2,
        sender: 'You',
        message: 'Hello Sarah! Thank you for reaching out. I\'d be happy to help with your project. Could you tell me more about what you\'re looking for?',
        timestamp: '10:45 AM',
        isOwn: true
      },
      {
        id: 3,
        sender: 'Sarah Johnson',
        message: 'I need a modern, responsive website for my consulting business. The design should be clean and professional.',
        timestamp: '11:00 AM',
        isOwn: false
      },
      {
        id: 4,
        sender: 'You',
        message: 'That sounds like a great project! I have experience with modern web design and responsive layouts. What\'s your timeline and budget for this project?',
        timestamp: '11:15 AM',
        isOwn: true
      },
      {
        id: 5,
        sender: 'Sarah Johnson',
        message: 'Thanks for the quick turnaround on the design!',
        timestamp: '2:30 PM',
        isOwn: false
      }
    ]
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim() && selectedChat) {
      setNewMessage('');
    }
  };

  const handleChatSelect = (chat) => {
    setSelectedChat(chat);
  };

  return (
    <div className="messages">
      <div className="messages-sidebar">
        <div className="sidebar-header">
          <h2>Messages</h2>
          <button className="new-message-btn">+ New</button>
        </div>
        
        <div className="chat-list">
          {sampleChats.map(chat => (
            <div
              key={chat.id}
              className={`chat-item ${selectedChat?.id === chat.id ? 'active' : ''}`}
              onClick={() => handleChatSelect(chat)}
            >
              <div className="chat-avatar">
                <div className="avatar-circle">
                  {chat.avatar}
                </div>
                {chat.online && <div className="online-indicator"></div>}
              </div>
              
              <div className="chat-info">
                <div className="chat-header">
                  <h4 className="chat-name">{chat.name}</h4>
                  <span className="chat-timestamp">{chat.timestamp}</span>
                </div>
                <p className="chat-preview">{chat.lastMessage}</p>
                <div className="chat-meta">
                  <span className="user-type-label">
                    {chat.userType === 'client' ? 'Client' : 'Freelancer'}
                  </span>
                  {chat.unread > 0 && (
                    <span className="unread-badge">{chat.unread}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="messages-main">
        {selectedChat ? (
          <>
            <div className="chat-header">
              <div className="chat-user-info">
                <div className="chat-avatar">
                  <div className="avatar-circle">
                    {selectedChat.avatar}
                  </div>
                  {selectedChat.online && <div className="online-indicator"></div>}
                </div>
                <div>
                  <h3>{selectedChat.name}</h3>
                  <p className="user-status">
                    {selectedChat.online ? 'Online' : 'Last seen 2 hours ago'} • {selectedChat.userType}
                  </p>
                </div>
              </div>
              
              <div className="chat-actions">
                <button className="action-btn">📞</button>
                <button className="action-btn">📹</button>
                <button className="action-btn">📎</button>
                <button className="action-btn">⋯</button>
              </div>
            </div>

            <div className="messages-container">
              {(sampleMessages[selectedChat.id] || []).map(message => (
                <div
                  key={message.id}
                  className={`message ${message.isOwn ? 'own-message' : 'other-message'}`}
                >
                  <div className="message-content">
                    <p>{message.message}</p>
                    <span className="message-time">{message.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendMessage} className="message-input-form">
              <div className="input-container">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="message-input"
                />
                <button type="submit" className="send-btn" disabled={!newMessage.trim()}>
                  Send
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="no-chat-selected">
            <div className="no-chat-content">
              <div className="no-chat-icon">💬</div>
              <h3>Select a conversation</h3>
              <p>Choose a chat from the sidebar to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;
