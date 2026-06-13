import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';
import { formatBudget } from '../../utils/formatters';
import './AdminDisputePanel.css';

const STATUS_LABELS = {
  opened: 'Open', open: 'Open', needs_info: 'Info Needed', under_review: 'Under Review',
  escalated: 'Escalated', proposed_resolution: 'Resolution Proposed',
  resolved: 'Resolved', closed: 'Closed'
};

const PER_PAGE_OPTIONS = [10, 25, 50];

// ── Resolve Modal ───────────────────────────────────────────────
const ResolveModal = ({ dispute, onClose, onResolved }) => {
  const [resolutionType, setResolutionType] = useState('refund_to_client');
  const [amountToClient, setAmountToClient] = useState(dispute.escrowAmount || 0);
  const [amountToFreelancer, setAmountToFreelancer] = useState(0);
  const [adminFee, setAdminFee] = useState(0);
  const [summary, setSummary] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const escrow = dispute.escrowAmount || 0;

  useEffect(() => {
    if (resolutionType === 'refund_to_client') {
      setAmountToClient(escrow);
      setAmountToFreelancer(0);
    } else if (resolutionType === 'release_to_freelancer') {
      setAmountToClient(0);
      setAmountToFreelancer(escrow);
    } else if (resolutionType === 'split') {
      const half = Math.round(escrow * 50) / 100;
      setAmountToClient(half);
      setAmountToFreelancer(escrow - half);
    } else {
      setAmountToClient(0);
      setAmountToFreelancer(0);
    }
    setAdminFee(0);
  }, [resolutionType, escrow]);

  const handleSubmit = async () => {
    if (!summary.trim()) { alert('Please provide a resolution summary.'); return; }
    if (!window.confirm(`Resolve dispute:\n• Type: ${resolutionType.replace(/_/g, ' ')}\n• To client: $${amountToClient}\n• To freelancer: $${amountToFreelancer}\n\nThis will execute Stripe refunds/transfers. Continue?`)) return;

    setSubmitting(true);
    try {
      await apiRequest(`/api/disputes/admin/${dispute._id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({
          resolutionType, amountToClient, amountToFreelancer, adminFee, summary,
          idempotencyKey: `resolve_${dispute._id}_${Date.now()}`
        })
      });
      alert('Dispute resolved successfully.');
      onResolved();
    } catch (err) {
      alert('Failed to resolve: ' + (err.message || ''));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="dp-modal-overlay" onClick={onClose}>
      <div className="dp-modal" onClick={e => e.stopPropagation()}>
        <div className="dp-modal-header">
          <h3>Resolve Dispute</h3>
          <button className="dp-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="dp-modal-body">
          <div className="dp-field">
            <label>Job</label>
            <div className="dp-field-value">{dispute.job?.title || 'N/A'} — {formatBudget(dispute.job?.budget)}</div>
          </div>

          <div className="dp-field">
            <label>Escrow Amount</label>
            <div className="dp-field-value dp-escrow">${escrow}</div>
          </div>

          <div className="dp-field">
            <label>Resolution Type</label>
            <select value={resolutionType} onChange={e => setResolutionType(e.target.value)} className="dp-select">
              <option value="refund_to_client">Full Refund to Client</option>
              <option value="release_to_freelancer">Release to Freelancer</option>
              <option value="split">Split Between Parties</option>
              <option value="no_action">No Financial Action</option>
            </select>
          </div>

          {(resolutionType === 'refund_to_client' || resolutionType === 'split') && (
            <div className="dp-field">
              <label>Refund to Client ($)</label>
              <input type="number" min="0" max={escrow} step="0.01" value={amountToClient}
                onChange={e => setAmountToClient(parseFloat(e.target.value) || 0)} className="dp-input" />
            </div>
          )}

          {(resolutionType === 'release_to_freelancer' || resolutionType === 'split') && (
            <div className="dp-field">
              <label>Release to Freelancer ($)</label>
              <input type="number" min="0" max={escrow} step="0.01" value={amountToFreelancer}
                onChange={e => setAmountToFreelancer(parseFloat(e.target.value) || 0)} className="dp-input" />
            </div>
          )}

          <div className="dp-field">
            <label>Admin Fee ($)</label>
            <input type="number" min="0" step="0.01" value={adminFee}
              onChange={e => setAdminFee(parseFloat(e.target.value) || 0)} className="dp-input" />
          </div>

          <div className="dp-field">
            <label>Resolution Summary *</label>
            <textarea value={summary} onChange={e => setSummary(e.target.value)}
              placeholder="Explain the resolution decision..." rows={3} className="dp-textarea" />
          </div>

          {amountToClient + amountToFreelancer + adminFee > escrow && (
            <div className="dp-warning">⚠️ Total exceeds escrow amount (${escrow})</div>
          )}
        </div>

        <div className="dp-modal-footer">
          <button className="dp-btn dp-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="dp-btn dp-btn-resolve" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Processing...' : '✅ Execute Resolution'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Panel ──────────────────────────────────────────────────
const AdminDisputePanel = () => {
  const { user } = useAuth();
  const [disputesData, setDisputesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [perPage, setPerPage] = useState(10);
  const [resolveTarget, setResolveTarget] = useState(null);

  const fetchDisputesData = useCallback(async (page = 1, status = statusFilter, limit = perPage) => {
    try {
      setLoading(true);
      const response = await apiRequest('/api/disputes/admin', {
        params: { page, status, limit }
      });
      setDisputesData(response);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch disputes data:', err);
      setError(err.message || 'Failed to load disputes data');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, perPage]);

  useEffect(() => {
    if (user?.isAdmin) fetchDisputesData();
  }, [user?.isAdmin, fetchDisputesData]);

  const currentPage = disputesData?.pagination?.current || 1;
  const totalPages = disputesData?.pagination?.pages || 1;
  const total = disputesData?.pagination?.total || 0;

  const load = (page, status = statusFilter, limit = perPage) => fetchDisputesData(page, status, limit);

  const handleStatusUpdate = async (disputeId, newStatus) => {
    try {
      await apiRequest(`/api/disputes/admin/${disputeId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      load(currentPage);
    } catch (err) {
      alert('Failed to update status: ' + (err.message || ''));
    }
  };

  if (loading && !disputesData) {
    return <div className="admin-panel-table"><div className="loading-container"><div className="loading-spinner"></div><p>Loading disputes...</p></div></div>;
  }

  if (error && !disputesData) {
    return <div className="admin-panel-table"><div className="error-container"><h3>Error</h3><p>{error}</p><button onClick={() => fetchDisputesData()} className="retry-button">Retry</button></div></div>;
  }

  return (
    <div className="disputes-management">
      {resolveTarget && (
        <ResolveModal
          dispute={resolveTarget}
          onClose={() => setResolveTarget(null)}
          onResolved={() => { setResolveTarget(null); load(currentPage); }}
        />
      )}

      <div className="disputes-controls">
        <select className="status-filter" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); load(1, e.target.value); }}>
          <option value="all">All Disputes</option>
          <option value="opened">Open</option>
          <option value="needs_info">Needs Info</option>
          <option value="under_review">Under Review</option>
          <option value="escalated">Escalated</option>
          <option value="proposed_resolution">Resolution Proposed</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select className="status-filter" value={perPage} onChange={(e) => { const pp = parseInt(e.target.value); setPerPage(pp); load(1, statusFilter, pp); }}>
          {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>Show {n}</option>)}
        </select>
      </div>

      <div style={{ padding: '0.5rem 0', fontSize: '0.85rem', color: '#6b7280' }}>
        Showing {disputesData?.disputes?.length || 0} of {total} disputes
      </div>

      <div className="admin-panel-table">
        <table>
          <thead>
            <tr>
              <th>Job</th>
              <th>Filed By</th>
              <th>Against</th>
              <th>Reason</th>
              <th>Escrow</th>
              <th>Status</th>
              <th>Filed</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {disputesData?.disputes?.length > 0 ? disputesData.disputes.map((dispute) => (
              <tr key={dispute._id}>
                <td>
                  <div className="job-info">
                    <div className="job-title">{dispute.job?.title || 'N/A'}</div>
                    <div className="job-budget">{formatBudget(dispute.job?.budget || 0)}</div>
                  </div>
                </td>
                <td>
                  <div className="user-info">
                    <div className="user-name">{dispute.filedBy ? `${dispute.filedBy.firstName} ${dispute.filedBy.lastName}` : 'N/A'}</div>
                    <div className="user-email">{dispute.filedBy?.email || ''}</div>
                  </div>
                </td>
                <td>
                  <div className="user-info">
                    <div className="user-name">
                      {dispute.filedBy?._id === dispute.client?._id
                        ? `${dispute.freelancer?.firstName || ''} ${dispute.freelancer?.lastName || ''}`
                        : `${dispute.client?.firstName || ''} ${dispute.client?.lastName || ''}`
                      }
                    </div>
                  </div>
                </td>
                <td>
                  <span className="dispute-reason">
                    {(dispute.reason || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                </td>
                <td className="escrow-cell">${dispute.escrowAmount || 0}</td>
                <td>
                  <span className={`status ${dispute.status}`}>
                    {STATUS_LABELS[dispute.status] || dispute.status}
                  </span>
                  {dispute.payoutHold && <span className="hold-indicator" title="Payout held">🔒</span>}
                </td>
                <td>{new Date(dispute.createdAt).toLocaleDateString()}</td>
                <td>
                  <div className="dispute-actions">
                    {(dispute.status === 'opened' || dispute.status === 'open') && (
                      <button className="action-btn review" onClick={() => handleStatusUpdate(dispute._id, 'under_review')}>
                        Review
                      </button>
                    )}
                    {['under_review', 'escalated', 'proposed_resolution'].includes(dispute.status) && (
                      <button className="action-btn resolve" onClick={() => setResolveTarget(dispute)}>
                        Resolve
                      </button>
                    )}
                    {['under_review', 'escalated', 'proposed_resolution'].includes(dispute.status) && dispute.escrowAmount > 0 && (
                      <button className="action-btn refund" onClick={() => {
                        setResolveTarget(dispute);
                        // Pre-select refund type will happen in modal default
                      }}>
                        💸 Refund
                      </button>
                    )}
                    <button className="action-btn view" onClick={() => window.open(`/admin/disputes/${dispute._id}`, '_blank')}>
                      View Details
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="8" className="no-data">No disputes found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="pagination">
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button disabled={currentPage <= 1} onClick={() => load(currentPage - 1)}
            style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}>
            ← Prev
          </button>
          <span style={{ padding: '0.4rem 0.8rem', color: '#374151' }}>
            Page {currentPage} of {totalPages}
          </span>
          <button disabled={currentPage >= totalPages} onClick={() => load(currentPage + 1)}
            style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}>
            Next →
          </button>
        </div>
        <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>Total: {total} disputes</span>
      </div>
    </div>
  );
};

export default AdminDisputePanel;
