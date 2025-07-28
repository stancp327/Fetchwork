import React, { useEffect } from 'react';

const ChatBot = () => {
  useEffect(() => {
    const chatbaseId = process.env.REACT_APP_CHATBASE_ID;
    
    if (!chatbaseId || chatbaseId === 'your-chatbot-id') {
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://www.chatbase.co/embed.min.js';
    script.defer = true;
    script.setAttribute('chatbotId', chatbaseId);
    script.setAttribute('domain', window.location.hostname);
    
    document.head.appendChild(script);
    
    return () => {
      const existingScript = document.querySelector('script[src="https://www.chatbase.co/embed.min.js"]');
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, []);

  return (
    <div className="chatbot">
      <div id="chatbase-widget"></div>
    </div>
  );
};

export default ChatBot;
