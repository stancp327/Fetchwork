import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import { fmt, timeAgo } from './helpers';

const SERVICE_ORDER_STATUS = {
  pending:            { label: '⏳ Awaiting Payment', color: '#f59e0b', bg: '#fef3c7' },
  in_progress:        { label: '🔨 In Progress',       color: '#2563eb', bg: '#dbeafe' },
  delivered:          { label: '📦 Delivered',          color: '#8b5cf6', bg: '#ede9fe' },
  revision_requested: { label: '🔄 Revision Requested', color: '#f59e0b', bg: '#fef3c7' },
  completed:          { label: '✅ Completed',           color: '#10b981', bg: '#d1fae5' },
  cancelled:          { label: '❌ Cancelled',           color: '#ef4444', bg: '#fee2e2' },
};

const ServiceOrderCard = ({ item, onAction }) => {
  const { service, order } = item;
  const [acting, setActing] = useState(false);
  const sm = SERVICE_ORDER_STATUS[order.status] || { label: order.status, color: '#6b7280', bg: '#f3f4f6' };

  const doAction = async (action, body = {}) => {
    setActing(true);
    try {
      await apiRequest(`/api/services/${service._id}/orders/${order._id}/${action}`, {
        method: 'PUT', body: JSON.stringify(body)
      });
      onAction();
    } catch (err) { alert(err.message || 'Action failed'); }
    finally { setActing(false); }
  };

  return (
    <div className="pm-project-card freelancer-card">
      <div className="pm-project-title-row">
        <Link
          to={order._id ? `/services/${service._id}/orders/${order._id}` : `/services/${service._id}`}
          className="pm-project-title"
          style={{ textDecoration: 'none' }}
        >
          {service.title}
        </Link>
        <span className="pm-ms-badge" style={{ color: sm.color, background: sm.bg, fontSize: '0.78rem', padding: '3px 10px' }}>
          {sm.label}
        </span>
      </div>
      <div className="pm-project-meta">
        <span className="meta-item">📦 {order.package}</span>
        <span className="meta-item">💰 {fmt(order.price)}</span>
        {order.escrowAmount > 0 && <span className="meta-item" style={{ color: '#10b981' }}>🔒 Secured</span>}
      </div>
      {order.requirements && (
        <div style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: '0.5rem' }}>
          📋 {order.requirements.slice(0, 120)}{order.requirements.length > 120 ? '…' : ''}
        </div>
      )}

      {order.status === 'pending' && (
        <div className="pm-payment-pill unfunded" style={{ marginBottom: '0.5rem' }}>
          ⏳ Waiting for client to complete payment before you can start work.
        </div>
      )}

      <div className="pm-card-actions">
        {order.status === 'in_progress' && (
          <button className="pm-btn-complete" disabled={acting}
            onClick={() => {
              const note = window.prompt('Add a delivery note (optional):');
              doAction('deliver', { deliveryNote: note || '' });
            }}>
            📦 Mark Delivered
          </button>
        )}
        {order.status === 'revision_requested' && (
          <button className="pm-btn-complete" disabled={acting}
            onClick={() => doAction('deliver', {})}>
            📦 Resubmit Delivery
          </button>
        )}
        {order.status === 'completed' && (
          <Link to={`/services/${service._id}/orders/${order._id}`} className="pm-btn-track">✅ View Order</Link>
        )}
        {order.status === 'pending' && (
          <button className="pm-btn-complete" disabled={acting}
            style={{ background: '#f59e0b' }}
            onClick={() => {
              const msg = window.prompt("Send a reminder to the client (optional message):");
              if (msg !== null) doAction('remind', { message: msg });
            }}>
            🔔 Remind Client
          </button>
        )}
        <Link to="/messages" className="pm-btn-track">💬 Messages</Link>
      </div>
      <div className="pm-project-footer">Ordered {timeAgo(order.orderDate)}</div>
    </div>
  );
};

export default ServiceOrderCard;
