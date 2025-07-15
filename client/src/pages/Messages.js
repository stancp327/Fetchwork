import React, { useState } from 'react';

function Messages() {
  const [selectedConversation, setSelectedConversation] = useState(1);
  const [newMessage, setNewMessage] = useState('');

  const mockConversations = [
    {
      id: 1,
      name: 'Sarah Johnson',
      lastMessage: 'I\'ve completed the logo design. Please review.',
      timestamp: '2 hours ago',
      unread: 2,
      avatar: '👩‍💼',
      project: 'Logo Design Project'
    },
    {
      id: 2,
      name: 'Mike Chen',
      lastMessage: 'When can we schedule the project kickoff?',
      timestamp: '1 day ago',
      unread: 0,
      avatar: '👨‍💻',
      project: 'Website Development'
    },
    {
      id: 3,
      name: 'Emma Wilson',
      lastMessage: 'Thank you for the feedback!',
      timestamp: '3 days ago',
      unread: 1,
      avatar: '✍️',
      project: 'Content Writing'
    }
  ];

  const mockMessages = {
    1: [
      {
        id: 1,
        sender: 'Sarah Johnson',
        message: 'Hi! I\'m excited to work on your logo design project.',
        timestamp: '10:30 AM',
        isOwn: false
      },
      {
        id: 2,
        sender: 'You',
        message: 'Great! I\'ve attached the brand guidelines and requirements.',
        timestamp: '10:45 AM',
        isOwn: true
      },
      {
        id: 3,
        sender: 'Sarah Johnson',
        message: 'Perfect! I\'ll review these and get started on some initial concepts.',
        timestamp: '11:00 AM',
        isOwn: false
      },
      {
        id: 4,
        sender: 'Sarah Johnson',
        message: 'I\'ve completed the logo design. Please review and let me know your thoughts!',
        timestamp: '2:30 PM',
        isOwn: false
      }
    ],
    2: [
      {
        id: 1,
        sender: 'Mike Chen',
        message: 'Hello! I\'m ready to start on your website project.',
        timestamp: 'Yesterday',
        isOwn: false
      },
      {
        id: 2,
        sender: 'Mike Chen',
        message: 'When can we schedule the project kickoff?',
        timestamp: 'Yesterday',
        isOwn: false
      }
    ],
    3: [
      {
        id: 1,
        sender: 'Emma Wilson',
        message: 'I\'ve submitted the first draft of your content.',
        timestamp: '3 days ago',
        isOwn: false
      },
      {
        id: 2,
        sender: 'You',
        message: 'Looks good! Just a few minor revisions needed.',
        timestamp: '3 days ago',
        isOwn: true
      },
      {
        id: 3,
        sender: 'Emma Wilson',
        message: 'Thank you for the feedback!',
        timestamp: '3 days ago',
        isOwn: false
      }
    ]
  };

  const currentConversation = mockConversations.find(conv => conv.id === selectedConversation);
  const currentMessages = mockMessages[selectedConversation] || [];

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      console.log('Sending message:', newMessage);
      setNewMessage('');
    }
  };

  return (
    <div className="messages-page">
      <div className="messages-container">
        <div className="conversations-sidebar">
          <div className="sidebar-header">
            <h2>Messages</h2>
            <button className="btn btn-secondary">New Message</button>
          </div>
          
          <div className="conversations-list">
            {mockConversations.map(conversation => (
              <div
                key={conversation.id}
                className={`conversation-item ${selectedConversation === conversation.id ? 'active' : ''}`}
                onClick={() => setSelectedConversation(conversation.id)}
              >
                <div className="conversation-avatar">
                  <span>{conversation.avatar}</span>
                </div>
                <div className="conversation-info">
                  <div className="conversation-header">
                    <h4>{conversation.name}</h4>
                    <span className="timestamp">{conversation.timestamp}</span>
                  </div>
                  <p className="project-name">{conversation.project}</p>
                  <p className="last-message">{conversation.lastMessage}</p>
                </div>
                {conversation.unread > 0 && (
                  <div className="unread-badge">{conversation.unread}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="chat-area">
          {currentConversation ? (
            <>
              <div className="chat-header">
                <div className="chat-user-info">
                  <span className="chat-avatar">{currentConversation.avatar}</span>
                  <div>
                    <h3>{currentConversation.name}</h3>
                    <p>{currentConversation.project}</p>
                  </div>
                </div>
                <div className="chat-actions">
                  <button className="btn btn-secondary">📎 Share File</button>
                  <button className="btn btn-secondary">📞 Call</button>
                </div>
              </div>

              <div className="messages-area">
                {currentMessages.map(message => (
                  <div
                    key={message.id}
                    className={`message ${message.isOwn ? 'message-own' : 'message-other'}`}
                  >
                    <div className="message-content">
                      <p>{message.message}</p>
                      <span className="message-timestamp">{message.timestamp}</span>
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
