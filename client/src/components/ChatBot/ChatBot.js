import React, { useEffect } from 'react';

const ChatBot = () => {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://www.chatbase.co/embed.min.js';
    script.defer = true;
    script.setAttribute('chatbotId', process.env.REACT_APP_CHATBASE_ID || 'your-chatbot-id');
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
