import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import './TeamApprovalQueue.css';

const ACTION_BADGES = {
  payout: { label: 'Payout', cls: 'taq-badge--payout' },
  spend: { label: 'Spend', cls: 'taq-badge--spend' },
  role_change: { label: 'Role Change', cls: 'taq-badge--role' },
  member_remove: { label: 'Remove Member', cls: 'taq-badge--remove' },
};

function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function expiryCountdown(expiresAt) {
  if (!expiresAt) return null;
  const remaining = new Date(expiresAt).getTime() - Date.now();
  if (remaining <= 0) return 'Expired';
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

function formatCurrency(amount) {
  if (amount == null) return '';
  return `$${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function requesterName(req) {
  if (!req) return 'Unknown';
  return `${req.firstName || ''} ${req.lastName || ''}`.trim() || req.email || 'Unknown';
}

export default function TeamApprovalQueue({ teamId }) {
  const [pending, setPending] = useState([]);
  const [resolved, setResolved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [notes, setNotes] = useState({});
  const [reasons, setReasons] = useState({});

  const fetchApprovals = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const data = await apiRequest(`/api/teams/${teamId}/approvals`);
      const all = data.approvals || [];
      setPending(all.filter(a => a.status === 'pending'));
      setResolved(all.filter(a => a.status !== 'pending'));
    } catch {
      setPending([]);
      setResolved([]);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { fetchApprovals(); }, [fetchApprovals]);

  const handleApprove = async (approvalId) => {
    setActionLoading(prev => ({ ...prev, [approvalId]: 'approving' }));
    try {
      await apiRequest(`/api/teams/${teamId}/approvals/${approvalId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ note: notes[approvalId] || '' }),
      });
      await fetchApprovals();
    } catch {
      // error handled silently
    } finally {
      setActionLoading(prev => ({ ...prev, [approvalId]: null }));
    }
  };

  const handleReject = async (approvalId) => {
    setActionLoading(prev => ({ ...prev, [approvalId]: 'rejecting' }));
    try {
      await apiRequest(`/api/teams/${teamId}/approvals/${approvalId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: reasons[approvalId] || '' }),
      });
      await fetchApprovals();
    } catch {
      // error handled silently
    } finally {
      setActionLoading(prev => ({ ...prev, [approvalId]: null }));
    }
  };

  if (loading) {
    return <div className="taq-root"><div className="taq-loading">Loading approvals...</div></div>;
  }

  return (
    <div className="taq-root">
      <h3 className="taq-title">Approval Queue</h3>

      {pending.length === 0 ? (
        <div className="taq-empty">✅ No pending approvals</div>
      ) : (
        <div className="taq-list">
          {pending.map(approval => {
            const badge = ACTION_BADGES[approval.action] || { label: approval.action, cls: '' };
            return (
              <div className="taq-card" key={approval._id}>
                <div className="taq-card-header">
                  <span className={`taq-badge ${badge.cls}`}>{badge.label}</span>
                  {approval.expiresAt && (
                    <span className="taq-expiry">{expiryCountdown(approval.expiresAt)}</span>
                  )}
                </div>
                <div className="taq-card-body">
                  <div className="taq-info">
                    <span className="taq-requester">Requested by {requesterName(approval.requestedBy)}</span>
                    {approval.amount != null && (
                      <span className="taq-amount">{formatCurrency(approval.amount)}</span>
                    )}
                    <span className="taq-time">{relativeTime(approval.createdAt)}</span>
                  </div>
                  {approval.metadata?.description && (
                    <p className="taq-desc">{approval.metadata.description}</p>
                  )}
                </div>
                <div className="taq-card-actions">
                  <div className="taq-input-row">
                    <input
                      type="text"
                      className="taq-input"
                      placeholder="Approval note (optional)"
                      value={notes[approval._id] || ''}
                      onChange={e => setNotes(prev => ({ ...prev, [approval._id]: e.target.value }))}
                    />
                    <button
                      className="taq-btn taq-btn--approve"
                      disabled={!!actionLoading[approval._id]}
                      onClick={() => handleApprove(approval._id)}
                    >
                      {actionLoading[approval._id] === 'approving' ? 'Approving...' : 'Approve'}
                    </button>
                  </div>
                  <div className="taq-input-row">
                    <input
                      type="text"
                      className="taq-input"
                      placeholder="Rejection reason"
                      value={reasons[approval._id] || ''}
                      onChange={e => setReasons(prev => ({ ...prev, [approval._id]: e.target.value }))}
                    />
                    <button
                      className="taq-btn taq-btn--reject"
                      disabled={!!actionLoading[approval._id]}
                      onClick={() => handleReject(approval._id)}
                    >
                      {actionLoading[approval._id] === 'rejecting' ? 'Rejecting...' : 'Reject'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Approval history */}
      <div className="taq-history-section">
        <button
          className="taq-history-toggle"
          onClick={() => setShowHistory(prev => !prev)}
        >
          {showHistory ? 'Hide' : 'Show'} Approval History ({resolved.length})
        </button>
        {showHistory && resolved.length > 0 && (
          <div className="taq-history-list">
            {resolved.map(approval => {
              const badge = ACTION_BADGES[approval.action] || { label: approval.action, cls: '' };
              return (
                <div className="taq-history-card" key={approval._id}>
                  <div className="taq-history-header">
                    <span className={`taq-badge taq-badge--small ${badge.cls}`}>{badge.label}</span>
                    <span className={`taq-status taq-status--${approval.status}`}>{approval.status}</span>
                    <span className="taq-time">{relativeTime(approval.updatedAt || approval.createdAt)}</span>
                  </div>
                  <div className="taq-history-body">
                    <span>By {requesterName(approval.requestedBy)}</span>
                    {approval.amount != null && <span> &middot; {formatCurrency(approval.amount)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
