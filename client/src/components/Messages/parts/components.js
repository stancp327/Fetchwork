import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../../utils/api';
import OnlineStatus, { formatLastSeen } from '../../common/OnlineStatus';
import CustomOfferModal from '../../Offers/CustomOfferModal';
// ── Time Formatting ─────────────────────────────────────────────
const formatTime = (ts) => {
  const d = new Date(ts);
  const now = new Date();
  const hrs = (now - d) / 3600000;
  if (hrs < 24) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (hrs < 168) return d.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

// ── Conversation Item ───────────────────────────────────────────
const ConvoItem = ({ convo, selected, userId, onClick, onlineStatus }) => {
  const other = convo.participants?.find(p => p._id !== userId);
  const unread = convo.unreadCount > 0;
  const otherId = other?._id;
  const status = onlineStatus?.[otherId];        // undefined = not yet loaded
  const statusKnown = status !== undefined;      // only show dot when we have data
  const isOnline = status?.isOnline ?? false;

  return (
    <div className={`convo-item ${selected ? 'selected' : ''} ${unread ? 'unread' : ''}`} onClick={onClick}>
      <div className="convo-avatar" style={{ position: 'relative' }}>
        {other?.profilePicture ? (
          <img src={other.profilePicture} alt="" />
        ) : (
          <span>{other?.firstName?.[0]}{other?.lastName?.[0]}</span>
        )}
        {statusKnown && (
          <span className={`avatar-online-badge ${isOnline ? '' : 'offline'}`} />
        )}
      </div>
      <div className="convo-info">
        <div className="convo-top">
          <span className="convo-name">{other?.firstName} {other?.lastName}</span>
          <span className="convo-time">{formatTime(convo.lastActivity)}</span>
        </div>
        {statusKnown && !isOnline && status?.lastSeen && (
          <div className="convo-last-seen">Last seen {formatLastSeen(status.lastSeen)}</div>
        )}
        {convo.job && (
          <Link to={`/jobs/${convo.job._id}`} className="convo-job" onClick={e => e.stopPropagation()}>
            📋 {convo.job.title}
          </Link>
        )}
        {convo.lastMessage && (
          <div className="convo-preview">{convo.lastMessage.content?.substring(0, 60)}{convo.lastMessage.content?.length > 60 ? '...' : ''}</div>
        )}
      </div>
      {unread && <span className="convo-badge">{convo.unreadCount}</span>}
    </div>
  );
};

// ── Proposal Action Card (renders inside system message bubbles) ──
const ProposalActionCard = ({ meta, isMine, userId, onAction }) => {
  const [acting,  setActing]  = useState(false);
  const [status,  setStatus]  = useState('pending'); // optimistic local state
  const [showCounter, setShowCounter] = useState(false);
  const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

  const doAccept = async () => {
    if (!window.confirm(`Accept ${meta.freelancerName}'s proposal for ${fmt(meta.proposedBudget)}? This will hire them for the job.`)) return;
    setActing(true);
    try {
      await apiRequest(`/api/jobs/${meta.jobId}/proposals/${meta.proposalId}/accept`, { method: 'POST' });
      setStatus('accepted');
      if (onAction) onAction();
    } catch (err) {
      alert(err.message || 'Failed to accept proposal');
    } finally { setActing(false); }
  };

  const doDecline = async () => {
    if (!window.confirm('Decline this proposal?')) return;
    setActing(true);
    try {
      await apiRequest(`/api/jobs/${meta.jobId}/proposals/${meta.proposalId}/decline`, { method: 'POST' });
      setStatus('declined');
      if (onAction) onAction();
    } catch (err) {
      alert(err.message || 'Failed to decline proposal');
    } finally { setActing(false); }
  };

  return (
    <div className="msg-proposal-card">
      {/* Summary row */}
      <div className="msg-proposal-header">
        <span className="msg-proposal-title">📋 Proposal</span>
        {meta.jobTitle && <span className="msg-proposal-job">for "{meta.jobTitle}"</span>}
      </div>

      <div className="msg-proposal-terms">
        <span className="msg-proposal-term">
          <span className="term-label">Bid</span>
          <strong>{fmt(meta.proposedBudget)}</strong>
        </span>
        <span className="msg-proposal-term">
          <span className="term-label">Timeline</span>
          <strong>{meta.proposedDuration?.replace(/_/g, ' ') || '—'}</strong>
        </span>
      </div>

      {meta.coverLetter && (
        <div className="msg-proposal-cover">
          {meta.coverLetter.length > 160
            ? meta.coverLetter.substring(0, 160) + '…'
            : meta.coverLetter}
        </div>
      )}

      {/* Status badge (once actioned) */}
      {status !== 'pending' && (
        <div className={`msg-proposal-status ${status}`}>
          {status === 'accepted' ? '✅ Proposal accepted — job is now in progress' : '❌ Proposal declined'}
        </div>
      )}

      {/* Actions — only visible to client (receiver), only when pending */}
      {!isMine && status === 'pending' && meta.proposalId && (
        <div className="msg-proposal-actions">
          <button className="msg-pa-accept" disabled={acting} onClick={doAccept}>
            ✓ Accept
          </button>
          <button className="msg-pa-counter" disabled={acting} onClick={() => setShowCounter(true)}>
            ↩ Counter
          </button>
          <button className="msg-pa-decline" disabled={acting} onClick={doDecline}>
            ✕ Decline
          </button>
          <Link to={`/jobs/${meta.jobId}/proposals`} className="msg-pa-view">
            View All →
          </Link>
        </div>
      )}

      {/* Freelancer view — just shows status */}
      {isMine && (
        <div className="msg-proposal-sent-note">
          Proposal sent · <Link to={`/jobs/${meta.jobId}`} className="msg-pa-view">View Job →</Link>
        </div>
      )}

      {/* Counter offer modal */}
      {showCounter && (
        <CustomOfferModal
          isOpen={true}
          onClose={() => setShowCounter(false)}
          recipientId={isMine ? null : meta.freelancerId}
          recipientName={meta.freelancerName}
          jobId={meta.jobId}
          offerType="counter_offer"
          prefillTerms={{ amount: meta.proposedBudget, deliveryTime: 1, revisions: 1, description: '' }}
          onSuccess={() => { setShowCounter(false); if (onAction) onAction(); }}
        />
      )}
    </div>
  );
};

// ── Milestone Request Card ──────────────────────────────────────
const MilestoneRequestCard = ({ meta, isMine, onAction }) => {
  const [acting, setActing] = useState(false);
  const [status, setStatus] = useState(meta.status || 'pending');
  const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);
  const milestones = meta.proposedMilestones || [];
  const total = milestones.reduce((s, m) => s + (Number(m.amount) || 0), 0);

  const doAccept = async () => {
    if (!window.confirm(`Accept these ${milestones.length} milestone${milestones.length !== 1 ? 's' : ''} (${fmt(total)} total)?`)) return;
    setActing(true);
    try {
      await apiRequest(`/api/jobs/${meta.jobId}/milestones/request/accept`, {
        method: 'POST',
        body: JSON.stringify({ messageId: meta.messageId }),
      });
      setStatus('accepted');
      if (onAction) onAction();
    } catch (err) {
      alert(err.message || 'Failed to accept');
    } finally { setActing(false); }
  };

  const doDecline = async () => {
    const reason = window.prompt('Reason for declining (optional):');
    if (reason === null) return; // cancelled
    setActing(true);
    try {
      await apiRequest(`/api/jobs/${meta.jobId}/milestones/request/decline`, {
        method: 'POST',
        body: JSON.stringify({ messageId: meta.messageId, reason }),
      });
      setStatus('declined');
      if (onAction) onAction();
    } catch (err) {
      alert(err.message || 'Failed to decline');
    } finally { setActing(false); }
  };

  const statusLabel = {
    accepted: '✅ Milestones accepted — job updated',
    declined: '❌ Milestone proposal declined',
  };

  return (
    <div className="msg-proposal-card">
      <div className="msg-proposal-header">
        <span className="msg-proposal-title">📋 Milestone Proposal</span>
        {meta.jobTitle && <span className="msg-proposal-job">for "{meta.jobTitle}"</span>}
      </div>

      {meta.note && (
        <div className="msg-proposal-cover" style={{ marginBottom: '0.5rem' }}>
          {meta.note}
        </div>
      )}

      <div className="msg-milestone-req-list">
        {milestones.map((m, i) => (
          <div key={i} className="msg-milestone-req-row">
            <span className="msg-ms-req-num">{i + 1}</span>
            <span className="msg-ms-req-title">{m.title}</span>
            <span className="msg-ms-req-amount">{fmt(m.amount)}</span>
          </div>
        ))}
        <div className="msg-milestone-req-total">
          <span>Total</span>
          <span>{fmt(total)}</span>
        </div>
      </div>

      {status !== 'pending' && (
        <div className={`msg-proposal-status ${status}`}>
          {statusLabel[status] || status}
        </div>
      )}

      {/* Freelancer: Accept / Decline */}
      {!isMine && status === 'pending' && (
        <div className="msg-proposal-actions">
          <button className="msg-pa-accept" disabled={acting} onClick={doAccept}>
            ✓ Accept
          </button>
          <button className="msg-pa-decline" disabled={acting} onClick={doDecline}>
            ✕ Decline
          </button>
        </div>
      )}

      {/* Client: shows they sent it */}
      {isMine && status === 'pending' && (
        <div className="msg-proposal-sent-note">
          Awaiting freelancer response
        </div>
      )}
    </div>
  );
};

// ── Message Bubble ──────────────────────────────────────────────
const MsgBubble = ({ msg, isMine, deliveryStatus, userId, onProposalAction }) => {
  const meta = msg.metadata;
  const isProposal          = meta?.type === 'job_proposal';
  const isMilestoneRequest  = meta?.type === 'milestone_change_request';

  return (
    <div className={`msg-row ${isMine ? 'mine' : 'theirs'}`}>
      <div className={`msg-bubble ${msg.messageType === 'system' ? 'msg-system' : ''} ${isProposal || isMilestoneRequest ? 'msg-bubble-proposal' : ''}`}>

        {/* Proposal action card */}
        {isProposal ? (
          <ProposalActionCard
            meta={meta}
            isMine={isMine}
            userId={userId}
            onAction={onProposalAction}
          />
        ) : isMilestoneRequest ? (
          <MilestoneRequestCard
            meta={{ ...meta, messageId: msg._id }}
            isMine={isMine}
            onAction={onProposalAction}
          />
        ) : (
          <div className="msg-content" style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
        )}

        {/* Service order link */}
        {meta?.type === 'service_order' && meta.serviceId && (
          <Link to={`/services/${meta.serviceId}`} className="msg-job-link">
            View Service →
          </Link>
        )}

        {/* Legacy job proposal link (old messages without metadata) */}
        {!isProposal && meta?.type === 'job_proposal' && meta.jobId && (
          <Link to={`/jobs/${meta.jobId}`} className="msg-job-link">
            View Job →
          </Link>
        )}

        {msg.attachments?.length > 0 && (
          <div className="msg-attachments">
            {msg.attachments.map((a, i) => {
              const isImage = a.mimeType?.startsWith('image/');
              return (
                <div key={i} className="msg-attach-item">
                  {isImage ? (
                    <div className="msg-attach-image-wrap">
                      <img src={a.url} alt={a.filename} className="msg-attach-image" loading="lazy" />
                      {a.watermarked && <span className="msg-watermark-badge">🔒 Watermarked</span>}
                    </div>
                  ) : (
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="msg-attach-link">
                      📄 {a.filename || 'Attachment'}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="msg-meta">
          <span>{formatTime(msg.createdAt)}</span>
          {isMine && (
            <span className="msg-status">
              {msg.isRead ? '✓✓' : deliveryStatus?.has(msg._id) ? '✓✓' : '✓'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Service Order Status Bar ────────────────────────────────────
const OrderStatusBar = ({ serviceId, orderId, userId, onAction }) => {
  const [order, setOrder] = useState(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!serviceId || !orderId) return;
    apiRequest(`/api/services/${serviceId}/orders/${orderId}`)
      .then(d => setOrder(d.order))
      .catch(() => {});
  }, [serviceId, orderId]);

  if (!order) return null;

  const isClient     = String(order.client) === String(userId);
  const statusLabels = {
    pending:            { label: '⏳ Awaiting Payment',    color: '#f59e0b' },
    in_progress:        { label: '🔨 In Progress',          color: '#2563eb' },
    delivered:          { label: '📦 Delivered — Review!',  color: '#8b5cf6' },
    revision_requested: { label: '🔄 Revision Requested',   color: '#f59e0b' },
    completed:          { label: '✅ Completed',             color: '#10b981' },
    cancelled:          { label: '❌ Cancelled',             color: '#ef4444' },
  };
  const s = statusLabels[order.status] || { label: order.status, color: '#6b7280' };

  const doAction = async (action, body = {}) => {
    setActing(true);
    try {
      await apiRequest(`/api/services/${serviceId}/orders/${orderId}/${action}`, {
        method: 'PUT', body: JSON.stringify(body)
      });
      const d = await apiRequest(`/api/services/${serviceId}/orders/${orderId}`);
      setOrder(d.order);
      if (onAction) onAction();
    } catch (err) {
      alert(err.message || 'Action failed');
    } finally { setActing(false); }
  };

  return (
    <div className="order-status-bar" style={{ borderColor: s.color }}>
      <span className="order-status-label" style={{ color: s.color }}>{s.label}</span>
      <div className="order-status-actions">
        {!isClient && order.status === 'in_progress' && (
          <button className="osb-btn osb-deliver" disabled={acting}
            onClick={() => {
              const note = window.prompt('Add a delivery note (optional):');
              doAction('deliver', { deliveryNote: note || '' });
            }}>
            📦 Mark Delivered
          </button>
        )}
        {!isClient && order.status === 'revision_requested' && (
          <button className="osb-btn osb-deliver" disabled={acting}
            onClick={() => doAction('deliver', {})}>
            📦 Resubmit Delivery
          </button>
        )}
        {isClient && order.status === 'delivered' && (
          <>
            <button className="osb-btn osb-complete" disabled={acting}
              onClick={() => { if (window.confirm('Release payment to the freelancer?')) doAction('complete'); }}>
              ✅ Accept & Release Payment
            </button>
            <button className="osb-btn osb-revision" disabled={acting}
              onClick={() => {
                const note = window.prompt('Describe what needs to change:');
                if (note) doAction('revision', { note });
              }}>
              🔄 Request Revision
            </button>
          </>
        )}
        {order.status === 'completed' && (
          <Link to={`/services/${serviceId}`} className="osb-btn osb-review">
            ⭐ Leave a Review
          </Link>
        )}
      </div>
    </div>
  );
};


export { formatTime, ConvoItem, ProposalActionCard, MilestoneRequestCard, MsgBubble, OrderStatusBar };

