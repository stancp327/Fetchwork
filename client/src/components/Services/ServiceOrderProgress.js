import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import './ServiceOrderProgress.css';

const STATUS_STEPS = [
  { key: 'pending',            label: 'Order Placed',  icon: '📋' },
  { key: 'in_progress',        label: 'In Progress',   icon: '🔨' },
  { key: 'delivered',          label: 'Delivered',     icon: '📦' },
  { key: 'revision_requested', label: 'Revision',      icon: '🔄' },
  { key: 'completed',          label: 'Completed',     icon: '✅' },
];

const STEP_ORDER = ['pending', 'in_progress', 'delivered', 'completed'];

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

const timeAgo = (date) => {
  if (!date) return '';
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const ServiceOrderProgress = () => {
  const { serviceId, orderId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?._id || user?.id || user?.userId;

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [acting,  setActing]  = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true);
      const result = await apiRequest(`/api/services/${serviceId}/orders/${orderId}`);
      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [serviceId, orderId]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  const doAction = async (action, body = {}) => {
    setActing(true);
    setActionMsg('');
    try {
      const result = await apiRequest(`/api/services/${serviceId}/orders/${orderId}/${action}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      setActionMsg(result.message || 'Done');
      await fetchOrder();
    } catch (err) {
      setActionMsg('Error: ' + (err.message || 'Action failed'));
    } finally {
      setActing(false);
    }
  };

  if (loading) return <div className="sop-container"><div className="sop-loading">Loading order…</div></div>;
  if (error)   return <div className="sop-container"><div className="sop-error">{error}</div></div>;
  if (!data)   return null;

  const { order, service } = data;
  const isClient     = String(order.client) === String(userId);
  const isFreelancer = !isClient;

  // Build timeline — insert revision if it happened
  const steps = order.revisionCount > 0
    ? STATUS_STEPS
    : STATUS_STEPS.filter(s => s.key !== 'revision_requested');

  // Determine active step index
  const activeKey   = order.status === 'cancelled' ? null : order.status;
  const activeIndex = STEP_ORDER.indexOf(activeKey);

  const stepIsDone = (key) => {
    if (order.status === 'completed') return true;
    const keyIdx    = STEP_ORDER.indexOf(key);
    return keyIdx < activeIndex;
  };
  const stepIsActive = (key) => key === activeKey ||
    (key === 'revision_requested' && order.status === 'revision_requested');

  return (
    <div className="sop-container">
      {/* Back */}
      <Link to="/projects" className="sop-back">← Back to Projects</Link>

      {/* Header */}
      <div className="sop-header">
        <div className="sop-header-info">
          <h1>{service.title}</h1>
          <div className="sop-meta">
            <span>📦 {order.package} package</span>
            <span>💰 {fmt(order.price)}</span>
            {order.escrowAmount > 0 && <span className="sop-secured">🔒 Payment secured</span>}
            <span>🕐 Ordered {timeAgo(order.orderDate)}</span>
          </div>
        </div>
        <Link to={`/services/${serviceId}`} className="sop-btn-view-service">
          View Service
        </Link>
      </div>

      {/* Status timeline */}
      <div className="sop-timeline">
        {steps.map((step, i) => {
          const done   = stepIsDone(step.key);
          const active = stepIsActive(step.key);
          return (
            <React.Fragment key={step.key}>
              <div className={`sop-step ${done ? 'done' : ''} ${active ? 'active' : ''}`}>
                <div className="sop-step-icon">{step.icon}</div>
                <div className="sop-step-label">{step.label}</div>
              </div>
              {i < steps.length - 1 && (
                <div className={`sop-step-line ${done ? 'done' : ''}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {order.status === 'cancelled' && (
        <div className="sop-cancelled-banner">❌ This order has been cancelled.</div>
      )}

      {/* Main content grid */}
      <div className="sop-body">
        {/* Left: details */}
        <div className="sop-details">
          {/* Requirements */}
          {order.requirements && (
            <div className="sop-card">
              <h3>📋 Requirements</h3>
              <p className="sop-text">{order.requirements}</p>
            </div>
          )}

          {/* Delivery note */}
          {order.deliveryNote && (
            <div className="sop-card sop-delivery-card">
              <h3>📦 Delivery Note</h3>
              <p className="sop-text">{order.deliveryNote}</p>
              {order.deliveryDate && (
                <p className="sop-date">Delivered {timeAgo(order.deliveryDate)}</p>
              )}
            </div>
          )}

          {/* Revision count */}
          {order.revisionCount > 0 && (
            <div className="sop-card">
              <h3>🔄 Revisions</h3>
              <p className="sop-text">{order.revisionCount} revision{order.revisionCount !== 1 ? 's' : ''} requested</p>
            </div>
          )}

          {/* Completion */}
          {order.status === 'completed' && order.completedDate && (
            <div className="sop-card sop-complete-card">
              <h3>✅ Completed</h3>
              <p className="sop-text">Order completed {timeAgo(order.completedDate)}</p>
            </div>
          )}
        </div>

        {/* Right: actions */}
        <div className="sop-actions-panel">
          <div className="sop-card">
            <h3>Actions</h3>

            {actionMsg && (
              <div className={`sop-action-msg ${actionMsg.startsWith('Error') ? 'error' : 'success'}`}>
                {actionMsg}
              </div>
            )}

            {/* Freelancer: in progress → Mark Delivered */}
            {isFreelancer && order.status === 'in_progress' && (
              <div className="sop-action-group">
                <p className="sop-action-hint">
                  Complete the work and submit it to the client for review.
                </p>
                <button
                  className="sop-btn sop-btn-deliver"
                  disabled={acting}
                  onClick={() => {
                    const note = window.prompt('Add a delivery note (what did you deliver?):');
                    if (note !== null) doAction('deliver', { deliveryNote: note });
                  }}
                >
                  📦 {acting ? 'Submitting…' : 'Mark as Delivered'}
                </button>
              </div>
            )}

            {/* Freelancer: revision requested → Resubmit */}
            {isFreelancer && order.status === 'revision_requested' && (
              <div className="sop-action-group">
                <p className="sop-action-hint">
                  The client requested changes. Make your revisions and resubmit.
                </p>
                <button
                  className="sop-btn sop-btn-deliver"
                  disabled={acting}
                  onClick={() => {
                    const note = window.prompt('Describe what you changed:');
                    if (note !== null) doAction('deliver', { deliveryNote: note || '' });
                  }}
                >
                  📦 {acting ? 'Submitting…' : 'Resubmit Delivery'}
                </button>
              </div>
            )}

            {/* Client: delivered → Accept or Revision */}
            {isClient && order.status === 'delivered' && (
              <div className="sop-action-group">
                <p className="sop-action-hint">
                  Review the delivered work. Accept to release payment, or request changes.
                </p>
                <button
                  className="sop-btn sop-btn-complete"
                  disabled={acting}
                  onClick={() => {
                    if (window.confirm('Accept delivery and release payment to the freelancer?')) {
                      doAction('complete');
                    }
                  }}
                >
                  ✅ {acting ? 'Releasing…' : `Accept & Release ${fmt(order.price)}`}
                </button>
                <button
                  className="sop-btn sop-btn-revision"
                  disabled={acting}
                  onClick={() => {
                    const note = window.prompt('What needs to be changed?');
                    if (note) doAction('revision', { note });
                  }}
                >
                  🔄 Request Revision
                </button>
              </div>
            )}

            {/* Pending: awaiting payment */}
            {order.status === 'pending' && (
              <div className="sop-action-group">
                <p className="sop-action-hint">
                  {isClient
                    ? 'Complete payment to activate your order and get the freelancer started.'
                    : 'Waiting for the client to complete payment before work can begin.'
                  }
                </p>
                {isFreelancer && (
                  <button
                    className="sop-btn sop-btn-remind"
                    disabled={acting}
                    onClick={() => {
                      const msg = window.prompt('Optional message with reminder:');
                      if (msg !== null) doAction('remind', { message: msg });
                    }}
                  >
                    🔔 {acting ? 'Sending…' : 'Send Payment Reminder'}
                  </button>
                )}
              </div>
            )}

            {/* Completed */}
            {order.status === 'completed' && (
              <div className="sop-action-group">
                <p className="sop-action-hint sop-success-text">
                  ✅ This order is complete. Payment has been released.
                </p>
                <Link to={`/services/${serviceId}`} className="sop-btn sop-btn-review">
                  ⭐ Leave a Review
                </Link>
              </div>
            )}

            {/* Cancel (both parties, not completed/cancelled) */}
            {!['completed', 'cancelled'].includes(order.status) && (
              <button
                className="sop-btn sop-btn-cancel"
                disabled={acting}
                onClick={() => {
                  const reason = window.prompt('Reason for cancellation (optional):');
                  if (reason !== null) {
                    if (window.confirm('Cancel this order?' + (order.escrowAmount > 0 ? ' A refund will be issued.' : ''))) {
                      doAction('cancel', { reason });
                    }
                  }
                }}
              >
                Cancel Order
              </button>
            )}
          </div>

          {/* Messages link */}
          <Link to="/messages" className="sop-messages-link">
            💬 Open Message Thread
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ServiceOrderProgress;
