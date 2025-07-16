import React, { useState } from 'react';
import Navigation from './Navigation';

const Messages = () => {
  const [selectedConversation, setSelectedConversation] = useState(0);
  const [newMessage, setNewMessage] = useState('');

  const conversations = [
    {
      id: 1,
      name: 'TechCorp Inc.',
      lastMessage: 'Thanks for your proposal. When can you start?',
      time: '2 hours ago',
      unread: 2,
      avatar: 'T'
    },
    {
      id: 2,
      name: 'StartupXYZ',
      lastMessage: 'The logo designs look great!',
      time: '5 hours ago',
      unread: 0,
      avatar: 'S'
    },
    {
      id: 3,
      name: 'Digital Agency',
      lastMessage: 'Can you send the first draft by Friday?',
      time: '1 day ago',
      unread: 1,
      avatar: 'D'
    }
  ];

  const messages = [
    {
      id: 1,
      sender: 'TechCorp Inc.',
      content: 'Hi! We reviewed your profile and are interested in your React development services.',
      time: '10:30 AM',
      isOwn: false
    },
    {
      id: 2,
      sender: 'You',
      content: 'Thank you for reaching out! I\'d be happy to help with your project. Could you provide more details about the requirements?',
      time: '10:45 AM',
      isOwn: true
    },
    {
      id: 3,
      sender: 'TechCorp Inc.',
      content: 'We need a modern e-commerce platform built with React and Node.js. The timeline is about 6 weeks.',
      time: '11:00 AM',
      isOwn: false
    },
    {
      id: 4,
      sender: 'You',
      content: 'That sounds like a great project! I have extensive experience with React and Node.js. My rate is $50/hour. Would you like to schedule a call to discuss the details?',
      time: '11:15 AM',
      isOwn: true
    },
    {
      id: 5,
      sender: 'TechCorp Inc.',
      content: 'Thanks for your proposal. When can you start?',
      time: '2 hours ago',
      isOwn: false
    }
  ];

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      console.log('Sending message:', newMessage);
      setNewMessage('');
    }
  };

  return (
    <div>
      <Navigation />
      <div className="page-container">
        <div className="messages">
          <h1>Messages</h1>
          
          <div className="messages-container">
            <div className="conversations-list">
              <h3>Conversations</h3>
              {conversations.map((conversation, index) => (
                <div
                  key={conversation.id}
                  className={`conversation-item ${selectedConversation === index ? 'active' : ''}`}
                  onClick={() => setSelectedConversation(index)}
                >
                  <div className="conversation-avatar">
                    {conversation.avatar}
                  </div>
                  <div className="conversation-info">
                    <div className="conversation-header">
                      <span className="conversation-name">{conversation.name}</span>
                      <span className="conversation-time">{conversation.time}</span>
                    </div>
                    <div className="conversation-preview">
                      <span className="last-message">{conversation.lastMessage}</span>
                      {conversation.unread > 0 && (
                        <span className="unread-badge">{conversation.unread}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="chat-area">
              <div className="chat-header">
                <div className="chat-user-info">
                  <div className="chat-avatar">
                    {conversations[selectedConversation]?.avatar}
                  </div>
                  <span className="chat-user-name">
                    {conversations[selectedConversation]?.name}
                  </span>
                </div>
              </div>
              
              <div className="messages-list">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`message ${message.isOwn ? 'own-message' : 'other-message'}`}
                  >
                    <div className="message-content">
                      {message.content}
                    </div>
                    <div className="message-time">
                      {message.time}
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Messages;
