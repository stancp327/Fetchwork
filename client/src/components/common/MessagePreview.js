import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../hooks/useSocket';
import { useAuth } from '../../context/AuthContext';
import './MessagePreview.css';

const MessagePreview = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [preview, setPreview] = useState(null);
  const [visible, setVisible] = useState(false);

  const handleEvent = useCallback((event, data) => {
    if (event === 'message:receive' && data?.sender) {
      // Don't show if we're already on the messages page
      if (window.location.pathname.startsWith('/messages')) return;

      setPreview({
        sender: data.sender,
        content: data.content?.substring(0, 100) + (data.content?.length > 100 ? '...' : ''),
        conversationId: data.conversationId || data.roomId,
        timestamp: new Date()
      });
      setVisible(true);

      // Auto-hide after 6 seconds
      setTimeout(() => setVisible(false), 6000);
    }
  }, []);

  useSocket({ onEvent: handleEvent });

  if (!user || !visible || !preview) return null;

  const initials = `${preview.sender.firstName?.[0] || ''}${preview.sender.lastName?.[0] || ''}`;

  return (
    <div
      className="msg-preview"
      onClick={() => {
        navigate(`/messages${preview.conversationId ? `?conversation=${preview.conversationId}` : ''}`);
        setVisible(false);
      }}
    >
      <div className="msg-preview-avatar">{initials}</div>
      <div className="msg-preview-body">
        <div className="msg-preview-sender">{preview.sender.firstName} {preview.sender.lastName}</div>
        <div className="msg-preview-text">{preview.content}</div>
      </div>
      <button className="msg-preview-close" onClick={e => { e.stopPropagation(); setVisible(false); }}>×</button>
    </div>
  );
};

export default MessagePreview;
