import React, { useState, useEffect, useRef } from 'react';
import './ChatBot.css';

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const getApiBaseUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:10000';
    }
    return window.location.origin.replace(/:\d+/, ':10000');
  };

  const API_BASE_URL = getApiBaseUrl();

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startChatSession = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setSessionId('demo-session');
      setMessages([{
        role: 'assistant',
        content: 'Hello! I\'m the FetchWork AI assistant. I\'m here to help you with questions about payments, jobs, account issues, and more. How can I assist you today?',
        timestamp: new Date(),
        metadata: { confidence: 1.0, intent: 'greeting' }
      }]);
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/chatbot/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSessionId(data.sessionId);
        setMessages([data.initialMessage]);
      } else {
        console.error('Failed to start chat session');
      }
    } catch (error) {
      console.error('Error starting chat session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !sessionId || isLoading) return;

    const userMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentMessage = inputMessage;
    setInputMessage('');
    setIsLoading(true);
    setIsTyping(true);

    const token = localStorage.getItem('token');
    
    if (!token || sessionId === 'demo-session') {
      setTimeout(() => {
        const mockResponse = generateMockResponse(currentMessage);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: mockResponse,
          timestamp: new Date(),
          metadata: { confidence: 0.8, intent: 'demo' }
        }]);
        setIsTyping(false);
      }, 1000);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/chatbot/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId,
          message: currentMessage
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        setTimeout(() => {
          setMessages(prev => [...prev, data.message]);
          setIsTyping(false);
          
          if (data.escalated) {
            setTimeout(() => {
              const escalationMessage = {
                role: 'assistant',
                content: 'Your conversation has been escalated to our human support team. A support agent will be with you shortly.',
                timestamp: new Date(),
                metadata: { isEscalation: true }
              };
              setMessages(prev => [...prev, escalationMessage]);
            }, 1000);
          }
        }, 1000);
      } else {
        console.error('Failed to send message');
        setIsTyping(false);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);
    } finally {
      setIsLoading(false);
    }
  };

  const generateMockResponse = (message) => {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('payment')) {
      return 'FetchWork uses an escrow payment system. Clients pay upfront, funds are held securely, and released to freelancers upon job completion. We charge a 5% platform fee plus 2.9% + $0.30 transaction fee.';
    } else if (lowerMessage.includes('job') || lowerMessage.includes('post')) {
      return 'To post a job, go to the "Post Job" page, fill in the job details including title, description, budget, and required skills. Once posted, freelancers can apply or you can browse and invite specific freelancers.';
    } else if (lowerMessage.includes('freelancer') || lowerMessage.includes('find')) {
      return 'You can find freelancers by browsing the "Browse Freelancers" section or using our search feature. Filter by skills, experience level, budget range, and ratings to find the perfect match for your project.';
    } else if (lowerMessage.includes('account') || lowerMessage.includes('verify')) {
      return 'For account verification, go to your Security settings. You can verify your email and phone number there. Verified accounts have higher trust scores and better visibility on the platform.';
    } else if (lowerMessage.includes('human') || lowerMessage.includes('agent')) {
      return 'I understand you\'d like to speak with a human agent. For now, this is a demo version. In the full platform, you would be connected to our support team for complex issues.';
    } else {
      return 'I\'m here to help with questions about FetchWork! I can assist with payments, job posting, finding freelancers, account verification, and more. What specific topic would you like to know about?';
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen && !sessionId) {
      startChatSession();
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getQuickReplies = () => [
    'How do payments work?',
    'How do I post a job?',
    'How do I find freelancers?',
    'Account verification help',
    'Speak to human agent'
  ];

  const handleQuickReply = (reply) => {
    setInputMessage(reply);
  };


  return (
    <>
      {/* Chat Toggle Button */}
      <div className={`chatbot-toggle ${isOpen ? 'open' : ''}`} onClick={toggleChat}>
        {isOpen ? <span role="img" aria-label="multiplication sign">✕</span> : <span role="img" aria-label="speech balloon">💬</span>}
        {!isOpen && <span className="chatbot-badge">AI Support</span>}
      </div>

      {/* Chat Window */}
      {isOpen && (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <div className="chatbot-title">
              <span className="chatbot-icon"><span role="img" aria-label="robot">🤖</span></span>
              <div>
                <h3>FetchWork AI Assistant</h3>
                <p>Online • Ready to help</p>
              </div>
            </div>
            <button className="chatbot-close" onClick={toggleChat}><span role="img" aria-label="multiplication sign">✕</span></button>
          </div>

          <div className="chatbot-messages">
            {messages.map((message, index) => (
              <div key={index} className={`message ${message.role}`}>
                <div className="message-content">
                  {message.role === 'assistant' && (
                    <div className="message-avatar"><span role="img" aria-label="robot">🤖</span></div>
                  )}
                  <div className="message-bubble">
                    <p>{message.content}</p>
                    <span className="message-time">
                      {formatTime(message.timestamp)}
                    </span>
                    {message.metadata?.isEscalation && (
                      <div className="escalation-badge">Escalated to Human</div>
                    )}
                  </div>
                  {message.role === 'user' && (
                    <div className="message-avatar user"><span role="img" aria-label="bust in silhouette">👤</span></div>
                  )}
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="message assistant">
                <div className="message-content">
                  <div className="message-avatar"><span role="img" aria-label="robot">🤖</span></div>
                  <div className="message-bubble typing">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {messages.length === 1 && (
            <div className="quick-replies">
              <p>Quick questions:</p>
              <div className="quick-reply-buttons">
                {getQuickReplies().map((reply, index) => (
                  <button
                    key={index}
                    className="quick-reply-btn"
                    onClick={() => handleQuickReply(reply)}
                  >
                    {reply}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="chatbot-input">
            <div className="input-container">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                disabled={isLoading}
                rows="1"
              />
              <button 
                onClick={sendMessage} 
                disabled={!inputMessage.trim() || isLoading}
                className="send-button"
              >
                {isLoading ? <span role="img" aria-label="hourglass not done">⏳</span> : <span role="img" aria-label="black right-pointing triangle">➤</span>}
              </button>
            </div>
            <div className="chatbot-footer">
              <small>Powered by FetchWork AI • Available 24/7</small>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatBot;
