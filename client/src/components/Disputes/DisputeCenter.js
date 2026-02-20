import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';
import DisputeDetail from './DisputeDetail';
import DisputeTimeline from './DisputeTimeline';
import './DisputeCenter.css';

// ── Status Badge ────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const labels = {
    open: 'Open',
    under_review: 'Under Review',
    awaiting_response: 'Awaiting Response',
    resolved: 'Resolved',
    closed: 'Closed',
    escalated: 'Escalated'
  };
  return (
    <span className={`dispute-status-badge status-${status}`}>
      {labels[status] || status}
    </span>
  );
};

// ── Reason Label ────────────────────────────────────────────────
const reasonLabels = {
  non_delivery: 'Non-Delivery',
  quality_issues: 'Quality Issues',
  missed_deadline: 'Missed Deadline',
  payment_fraud: 'Payment Fraud',
  abusive_communication: 'Abusive Communication',
  other: 'Other'
};

// ── Empty State ─────────────────────────────────────────────────
const EmptyState = ({ filter }) => (
  <div className="disputes-empty">
    <div className="empty-icon">⚖️</div>
    <h3>{filter === 'all' ? 'No Disputes Yet' : `No ${filter.replace('_', ' ')} Disputes`}</h3>
    <p>
      {filter === 'all'
        ? "You haven't filed or received any disputes. That's a good thing!"
        : `No disputes with status "${filter.replace('_', ' ')}" found.`}
    </p>
  </div>
);

// ── Dispute Card ────────────────────────────────────────────────
const DisputeCard = ({ dispute, currentUserId, onClick }) => {
  const isClient = dispute.client?._id === currentUserId;
  const otherParty = isClient ? dispute.freelancer : dispute.client;
  const timeAgo = (date) => {
    const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
    if (seconds < 60) return 'just now';
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="dispute-card" onClick={() => onClick(dispute._id)}>
      <div className="dispute-card-header">
        <div className="dispute-card-title">
          <h4>{dispute.job?.title || 'Untitled Job'}</h4>
          <StatusBadge status={dispute.status} />
        </div>
        <span className="dispute-card-time">{timeAgo(dispute.updatedAt || dispute.createdAt)}</span>
      </div>
      <div className="dispute-card-body">
        <div className="dispute-card-meta">
          <span className="dispute-reason-tag">{reasonLabels[dispute.reason] || dispute.reason}</span>
          <span className="dispute-card-party">
            {isClient ? 'vs' : 'from'} {otherParty?.firstName} {otherParty?.lastName}
          </span>
        </div>
        <p className="dispute-card-desc">
          {dispute.description?.substring(0, 120)}{dispute.description?.length > 120 ? '...' : ''}
        </p>
      </div>
      <div className="dispute-card-footer">
        <span className="dispute-card-role">{isClient ? 'Client' : 'Freelancer'}</span>
        {dispute.messages?.length > 0 && (
          <span className="dispute-card-messages">
            💬 {dispute.messages.length} message{dispute.messages.length !== 1 ? 's' : ''}
          </span>
        )}
        {dispute.deadline && (
          <span className={`dispute-card-deadline ${new Date(dispute.deadline) < new Date() ? 'overdue' : ''}`}>
            ⏰ {new Date(dispute.deadline).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
};

// ── Main DisputeCenter ──────────────────────────────────────────
const DisputeCenter = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(searchParams.get('id') || null);

  const statusFilter = searchParams.get('status') || 'all';
  const sortBy = searchParams.get('sort') || 'newest';

  const fetchDisputes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest('/api/disputes/user');
      setDisputes(data.disputes || []);
    } catch (err) {
      setError(err.message || 'Failed to load disputes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  // Sync selected dispute with URL
  useEffect(() => {
    const id = searchParams.get('id');
    if (id !== selectedId) setSelectedId(id);
  }, [searchParams]);

  const handleSelectDispute = (id) => {
    setSelectedId(id);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('id', id);
      return next;
    });
  };

  const handleBack = () => {
    setSelectedId(null);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('id');
      return next;
    });
  };

  const setFilter = (status) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (status === 'all') next.delete('status');
      else next.set('status', status);
      next.delete('id');
      return next;
    });
    setSelectedId(null);
  };

  const setSort = (sort) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('sort', sort);
      return next;
    });
  };

  // Filter & sort
  const filtered = disputes
    .filter(d => statusFilter === 'all' || d.status === statusFilter)
    .sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt);
      const dateB = new Date(b.updatedAt || b.createdAt);
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });

  const statusCounts = disputes.reduce((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1;
    acc.all = (acc.all || 0) + 1;
    return acc;
  }, { all: 0 });

  // Detail view
  if (selectedId) {
    return (
      <DisputeDetail
        disputeId={selectedId}
        onBack={handleBack}
        onUpdate={fetchDisputes}
      />
    );
  }

  return (
    <div className="dispute-center">
      <div className="dispute-center-header">
        <div>
          <h1>Dispute Center</h1>
          <p className="dispute-center-subtitle">Manage and track your disputes</p>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="dispute-filters">
        <div className="dispute-filter-tabs">
          {['all', 'open', 'under_review', 'awaiting_response', 'escalated', 'resolved', 'closed'].map(status => (
            <button
              key={status}
              className={`filter-tab ${statusFilter === status ? 'active' : ''}`}
              onClick={() => setFilter(status)}
            >
              {status === 'all' ? 'All' : (status.charAt(0).toUpperCase() + status.slice(1)).replace(/_/g, ' ')}
              {statusCounts[status] > 0 && (
                <span className="filter-count">{statusCounts[status]}</span>
              )}
            </button>
          ))}
        </div>
        <div className="dispute-sort">
          <select value={sortBy} onChange={e => setSort(e.target.value)}>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="disputes-loading">
          <div className="spinner"></div>
          <p>Loading disputes...</p>
        </div>
      ) : error ? (
        <div className="disputes-error">
          <p>⚠️ {error}</p>
          <button onClick={fetchDisputes}>Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState filter={statusFilter} />
      ) : (
        <div className="dispute-list">
          {filtered.map(dispute => (
            <DisputeCard
              key={dispute._id}
              dispute={dispute}
              currentUserId={user?._id || user?.userId}
              onClick={handleSelectDispute}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default DisputeCenter;
