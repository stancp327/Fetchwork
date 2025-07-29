import React, { useState, useEffect, useRef } from 'react';
import './ChatBot.css';

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showBadge, setShowBadge] = useState(false);
  const widgetRef = useRef(null);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    const chatbaseId = process.env.REACT_APP_CHATBASE_ID;
    
    if (!chatbaseId || chatbaseId === 'your-chatbot-id') {
      console.warn('ChatBot - No valid Chatbase ID configured');
      return;
    }

    const badgeTimer = setTimeout(() => {
      if (!isOpen) {
        setShowBadge(true);
      }
    }, 10000);

    return () => clearTimeout(badgeTimer);
  }, [isOpen]);

  const loadChatbaseScript = () => {
    if (scriptLoadedRef.current) return;

    const chatbaseId = process.env.REACT_APP_CHATBASE_ID;
    if (!chatbaseId || chatbaseId === 'your-chatbot-id') return;

    const script = document.createElement('script');
    script.src = 'https://www.chatbase.co/embed.min.js';
    script.defer = true;
    script.setAttribute('chatbotId', chatbaseId);
    script.setAttribute('domain', window.location.hostname);
    
    script.onload = () => {
      setIsLoaded(true);
      scriptLoadedRef.current = true;
    };

    document.head.appendChild(script);
  };

  const toggleChat = () => {
    if (!isOpen) {
      loadChatbaseScript();
      setShowBadge(false);
    }
    setIsOpen(!isOpen);
  };

  const closeChat = () => {
    setIsOpen(false);
  };

  const ChatIcon = () => (
    <svg 
      className="chatbot-bubble-icon" 
      fill="currentColor" 
      viewBox="0 0 24 24"
    >
      <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
    </svg>
  );

  const CloseIcon = () => (
    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </svg>
  );

  return (
    <div className="chatbot-container">
      {/* Chat Widget */}
      <div className={`chatbot-widget ${isOpen ? 'open' : ''}`}>
        <div className="chatbot-header">
          <h3>AI Assistant</h3>
          <button className="chatbot-close" onClick={closeChat}>
            <CloseIcon />
          </button>
        </div>
        <div className="chatbot-content" ref={widgetRef}>
          {!isLoaded ? (
            <div className="chatbot-loading">
              <div className="chatbot-loading-spinner"></div>
              <p>Loading AI Assistant...</p>
            </div>
          ) : (
            <div id="chatbase-widget" style={{ height: '100%' }}></div>
          )}
        </div>
      </div>

      {/* Floating Chat Bubble */}
      <button 
        className={`chatbot-bubble ${isOpen ? 'open' : ''} ${showBadge ? 'pulse' : ''}`}
        onClick={toggleChat}
        aria-label="Open AI Assistant"
      >
        <ChatIcon />
        {showBadge && <div className="chatbot-badge show">!</div>}
      </button>
    </div>
  );
};

export default ChatBot;
