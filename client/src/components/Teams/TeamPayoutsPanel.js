import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import './TeamTasks.css';

function formatMember(user) {
  if (!user) return '—';
  if (user.firstName || user.lastName) {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim();
  }
  return user.email || user.username || String(user._id || user);
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function PayoutTypeChip({ type }) {
  return (
    <span className={`tp-type-chip${type === 'per_hour' ? ' tp-type-chip--per_hour' : ''}`}>
      {type === 'per_hour' ? 'Per Hour' : 'Fixed'}
    </span>
  );
}

function PayoutStatusChip({ status }) {
  const s = (status || 'pending').toLowerCase();
  return (
    <span className={`tp-status-chip tp-status-chip--${s}`}>
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}

export default function TeamPayoutsPanel({ teamId }) {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPayouts = useCallback(async () => {
    setError('');
    try {
      const data = await apiRequest(`/api/teams/${teamId}/payouts`);
      setPayouts(data.payouts || []);
    } catch (err) {
      setError(err.message || 'Failed to load payouts');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { fetchPayouts(); }, [fetchPayouts]);

  // Summary stats
  const totalPaid = payouts
    .filter(p => (p.status || '').toLowerCase() === 'paid' || (p.status || '').toLowerCase() === 'completed')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const totalPending = payouts
    .filter(p => (p.status || '').toLowerCase() === 'pending')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  if (loading) {
    return (
      <div className="tt-skeleton">
        <div className="tt-skeleton-card" />
        <div className="tt-skeleton-card" />
      </div>
    );
  }

  return (
    <div className="tp-container">
      {/* Summary stats */}
      <div className="tp-stats-row">
        <div className="tp-stat-card">
          <div className="tp-stat-label">Total Paid Out</div>
          <div className="tp-stat-value tp-stat-value--green">
            ${totalPaid.toFixed(2)}
          </div>
        </div>
        <div className="tp-stat-card">
          <div className="tp-stat-label">Pending</div>
          <div className="tp-stat-value">
            ${totalPending.toFixed(2)}
          </div>
        </div>
        <div className="tp-stat-card">
          <div className="tp-stat-label">Total Payouts</div>
          <div className="tp-stat-value">{payouts.length}</div>
        </div>
      </div>

      {error && <div className="tt-error">{error}</div>}

      {/* Payout list */}
      {payouts.length === 0 ? (
        <div className="tt-empty">
          <div className="tt-empty-icon">💸</div>
          <p className="tt-empty-text">No payouts recorded yet.</p>
        </div>
      ) : (
        <>
          {/* Table for wider viewports */}
          <div>
            <h3 className="tp-section-title">Payout History</h3>
            <div className="tp-table-wrap">
              <table className="tp-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Member</th>
                    <th>Task</th>
                    <th>Amount</th>
                    <th>Type</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map(p => (
                    <tr key={p._id}>
                      <td>{formatDate(p.createdAt)}</td>
                      <td>{formatMember(p.recipientUser)}</td>
                      <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.task?.title || p.job?.title || '—'}
                      </td>
                      <td className="tp-amount">${(p.amount || 0).toFixed(2)}</td>
                      <td>
                        <PayoutTypeChip type={p.task?.payoutType || p.payType || 'per_job'} />
                      </td>
                      <td>
                        <PayoutStatusChip status={p.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
