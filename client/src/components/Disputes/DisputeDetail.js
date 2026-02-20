import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';
import DisputeTimeline from './DisputeTimeline';
import './DisputeDetail.css';

// ── Message Bubble ──────────────────────────────────────────────
const MessageBubble = ({ msg, currentUserId }) => {
  const isMine = msg.sender?._id === currentUserId || msg.sender === currentUserId;
  const formatTime = (date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className={`msg-row ${isMine ? 'msg-mine' : 'msg-other'} ${msg.senderRole === 'admin' ? 'msg-admin' : ''}`}>
      {!isMine && (
        <div className="msg-avatar">
          {msg.sender?.profilePicture
            ? <img src={msg.sender.profilePicture} alt="" />
            : <span>{msg.sender?.firstName?.[0] || '?'}</span>
          }
        </div>
      )}
      <div className="msg-bubble">
        <div className="msg-header">
          <span className="msg-sender">
            {isMine ? 'You' : `${msg.sender?.firstName || 'User'} ${msg.sender?.lastName || ''}`}
          </span>
          <span className={`msg-role role-${msg.senderRole}`}>{msg.senderRole}</span>
        </div>
        <p className="msg-text">{msg.message}</p>
        {msg.attachments?.length > 0 && (
          <div className="msg-attachments">
            {msg.attachments.map((att, i) => (
              <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="msg-attachment">
                📎 {att.filename}
              </a>
            ))}
          </div>
        )}
        <span className="msg-time">{formatTime(msg.createdAt)}</span>
      </div>
    </div>
  );
};

// ── Main DisputeDetail ──────────────────────────────────────────
const DisputeDetail = ({ disputeId, onBack, onUpdate }) => {
  const { user } = useContext(AuthContext);
  const currentUserId = user?._id || user?.userId;
  const messagesEndRef = useRef(null);

  const [dispute, setDispute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [escalating, setEscalating] = useState(false);

  const fetchDispute = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest(`/api/disputes/${disputeId}`);
      setDispute(data.dispute);
    } catch (err) {
      setError(err.message || 'Failed to load dispute');
    } finally {
      setLoading(false);
    }
  }, [disputeId]);

  useEffect(() => {
    fetchDispute();
  }, [fetchDispute]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dispute?.messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    try {
      setSending(true);
      await apiRequest(`/api/disputes/${disputeId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: newMessage.trim() })
      });
      setNewMessage('');
      await fetchDispute();
      onUpdate?.();
    } catch (err) {
      alert('Failed to send message: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const handleEscalate = async () => {
    if (!window.confirm('Are you sure you want to escalate this dispute? This will flag it for priority admin review.')) return;

    try {
      setEscalating(true);
      await apiRequest(`/api/disputes/${disputeId}/escalate`, { method: 'POST' });
      await fetchDispute();
      onUpdate?.();
    } catch (err) {
      alert('Failed to escalate: ' + err.message);
    } finally {
      setEscalating(false);
    }
  };

  const isActive = dispute && !['resolved', 'closed'].includes(dispute.status);
  const canEscalate = isActive && dispute.status !== 'escalated' && (
    dispute.client?._id === currentUserId || dispute.freelancer?._id === currentUserId
  );

  const reasonLabels = {
    non_delivery: 'Non-Delivery',
    quality_issues: 'Quality Issues',
    missed_deadline: 'Missed Deadline',
    payment_fraud: 'Payment Fraud',
    abusive_communication: 'Abusive Communication',
    other: 'Other'
  };

  if (loading) {
    return (
      <div className="dispute-detail">
        <div className="dispute-detail-loading">
          <div className="spinner"></div>
          <p>Loading dispute...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dispute-detail">
        <button className="back-btn" onClick={onBack}>← Back to Disputes</button>
        <div className="dispute-detail-error">
          <p>⚠️ {error}</p>
          <button onClick={fetchDispute}>Retry</button>
        </div>
      </div>
    );
  }

  if (!dispute) return null;

  return (
    <div className="dispute-detail">
      {/* Header */}
      <div className="dispute-detail-header">
        <button className="back-btn" onClick={onBack}>← Back to Disputes</button>
        <div className="dispute-detail-title">
          <h2>{dispute.job?.title || 'Untitled Job'}</h2>
          <div className="dispute-detail-meta">
            <span className={`dispute-status-badge status-${dispute.status}`}>
              {dispute.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </span>
            <span className="dispute-reason-tag">{reasonLabels[dispute.reason] || dispute.reason}</span>
            {dispute.job?.budget && <span className="dispute-budget">${dispute.job.budget}</span>}
          </div>
        </div>
        {canEscalate && (
          <button
            className="escalate-btn"
            onClick={handleEscalate}
            disabled={escalating}
          >
            {escalating ? 'Escalating...' : '🚨 Escalate'}
          </button>
        )}
      </div>

      <div className="dispute-detail-content">
        {/* Left: Messages */}
        <div className="dispute-messages-panel">
          <div className="dispute-messages-header">
            <h3>Discussion</h3>
            <span className="msg-count">{dispute.messages?.length || 0} messages</span>
          </div>

          <div className="dispute-messages-list">
            {dispute.messages?.length === 0 ? (
              <div className="no-messages">
                <p>No messages yet. Start the conversation below.</p>
              </div>
            ) : (
              dispute.messages.map((msg, i) => (
                <MessageBubble key={msg._id || i} msg={msg} currentUserId={currentUserId} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          {isActive && (
            <form className="dispute-message-form" onSubmit={handleSendMessage}>
              <textarea
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                rows={2}
                maxLength={2000}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
              />
              <div className="message-form-footer">
                <span className="char-count">{newMessage.length}/2000</span>
                <button type="submit" disabled={!newMessage.trim() || sending}>
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </form>
          )}

          {!isActive && (
            <div className="dispute-closed-banner">
              This dispute has been {dispute.status}. No further messages can be sent.
            </div>
          )}
        </div>

        {/* Right: Sidebar */}
        <div className="dispute-sidebar">
          <DisputeTimeline dispute={dispute} />

          <div className="dispute-info-card">
            <h4>Dispute Details</h4>
            <div className="info-row">
              <span className="info-label">Filed by</span>
              <span className="info-value">
                {dispute.filedBy?.firstName} {dispute.filedBy?.lastName}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Client</span>
              <span className="info-value">
                {dispute.client?.firstName} {dispute.client?.lastName}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Freelancer</span>
              <span className="info-value">
                {dispute.freelancer?.firstName} {dispute.freelancer?.lastName}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Filed</span>
              <span className="info-value">
                {new Date(dispute.createdAt).toLocaleDateString('en-US', {
                  month: 'long', day: 'numeric', year: 'numeric'
                })}
              </span>
            </div>
            {dispute.deadline && (
              <div className="info-row">
                <span className="info-label">Deadline</span>
                <span className={`info-value ${new Date(dispute.deadline) < new Date() ? 'overdue' : ''}`}>
                  {new Date(dispute.deadline).toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric'
                  })}
                </span>
              </div>
            )}
          </div>

          {dispute.description && (
            <div className="dispute-info-card">
              <h4>Original Description</h4>
              <p className="dispute-description-text">{dispute.description}</p>
            </div>
          )}

          {dispute.resolution && (
            <div className="dispute-info-card resolution-card">
              <h4>Resolution</h4>
              <div className="info-row">
                <span className="info-label">Outcome</span>
                <span className="info-value">
                  {dispute.resolution.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
              </div>
              {dispute.resolutionAmount > 0 && (
                <div className="info-row">
                  <span className="info-label">Amount</span>
                  <span className="info-value">${dispute.resolutionAmount}</span>
                </div>
              )}
              {dispute.resolutionSummary && (
                <p className="resolution-summary-text">{dispute.resolutionSummary}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DisputeDetail;
