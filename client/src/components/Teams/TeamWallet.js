import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import './TeamWallet.css';

const TeamWallet = ({ teamId, canManageBilling }) => {
  const [billing, setBilling] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [fundAmount, setFundAmount] = useState('');
  const [fundLoading, setFundLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  const fetchData = useCallback(async () => {
    try {
      const [billingData, approvalsData] = await Promise.all([
        apiRequest(`/api/teams/${teamId}/billing`),
        apiRequest(`/api/teams/${teamId}/approvals`).catch(() => ({ approvals: [] })),
      ]);
      setBilling(billingData);
      setApprovals((approvalsData.approvals || []).filter(a => a.status === 'pending'));
    } catch {
      setBilling(null);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddFunds = async () => {
    const amount = parseFloat(fundAmount);
    if (!amount || amount < 5 || amount > 500) return;
    setFundLoading(true);
    try {
      const res = await apiRequest(`/api/teams/${teamId}/billing/add-funds`, {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });
      if (res.url) window.location.href = res.url;
    } catch {
      // handled
    } finally {
      setFundLoading(false);
    }
  };

  const handleApproval = async (approvalId, action) => {
    setActionLoading(prev => ({ ...prev, [approvalId]: action }));
    try {
      await apiRequest(`/api/teams/${teamId}/approvals/${approvalId}/${action}`, { method: 'POST' });
      setApprovals(prev => prev.filter(a => a._id !== approvalId));
    } catch {
      // handled
    } finally {
      setActionLoading(prev => ({ ...prev, [approvalId]: null }));
    }
  };

  if (loading) return <div className="tw-empty">Loading wallet...</div>;
  if (!billing) return <div className="tw-empty">Unable to load billing data</div>;

  const { balance, credits } = billing;
  const history = credits || [];

  // Derive spend by member this month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthCredits = history.filter(c =>
    c.amount < 0 || c.status === 'used' ? new Date(c.createdAt) >= monthStart : false
  );
  const memberSpend = {};
  thisMonthCredits.forEach(c => {
    const key = c.appliedBy || c.user || 'unknown';
    memberSpend[key] = (memberSpend[key] || 0) + Math.abs(c.amount || 0);
  });

  // Monthly spend total
  const monthlySpend = Object.values(memberSpend).reduce((s, v) => s + v, 0);

  // Classify transactions
  const getAmountClass = (credit) => {
    if (credit.status === 'used' || credit.amount < 0) return 'tw-negative';
    return 'tw-positive';
  };

  const getAmountDisplay = (credit) => {
    const abs = Math.abs(credit.remaining ?? credit.amount);
    if (credit.status === 'used' || credit.amount < 0) return `-$${abs.toFixed(2)}`;
    return `+$${abs.toFixed(2)}`;
  };

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="tw-container">
      {/* Balance Card */}
      <div className="tw-balance-card">
        <div className="tw-balance-label">Team Wallet Balance</div>
        <div className="tw-balance-amount">${balance.toFixed(2)}</div>
        {canManageBilling && (
          <div className="tw-balance-actions">
            <button className="btn btn-primary" onClick={() => setShowAddFunds(true)}>
              Add Funds
            </button>
          </div>
        )}
      </div>

      {/* Monthly Spend Summary */}
      <div className="tw-spend-summary">
        <div className="tw-spend-header">
          <span className="tw-spend-title">Monthly Spend</span>
          <span className="tw-spend-values">${monthlySpend.toFixed(2)}</span>
        </div>
        <div className="tw-progress-bar">
          <div
            className={`tw-progress-fill${monthlySpend > 0 ? '' : ''}`}
            style={{ width: '0%' }}
          />
        </div>
      </div>

      {/* Pending Approvals */}
      {approvals.length > 0 && (
        <div className="tw-section">
          <h3 className="tw-section-title">Pending Approvals</h3>
          <div className="tw-approval-list">
            {approvals.map(a => (
              <div key={a._id} className="tw-approval-item">
                <div className="tw-approval-top">
                  <div>
                    <div className="tw-approval-title">{a.description || a.type || 'Approval Request'}</div>
                    <div className="tw-approval-meta">
                      {a.requestedBy?.firstName} {a.requestedBy?.lastName} — {formatDate(a.createdAt)}
                    </div>
                  </div>
                  {a.amount != null && (
                    <div className="tw-approval-amount">${Number(a.amount).toFixed(2)}</div>
                  )}
                </div>
                <div className="tw-approval-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleApproval(a._id, 'approve')}
                    disabled={!!actionLoading[a._id]}
                  >
                    {actionLoading[a._id] === 'approve' ? '...' : 'Approve'}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleApproval(a._id, 'reject')}
                    disabled={!!actionLoading[a._id]}
                  >
                    {actionLoading[a._id] === 'reject' ? '...' : 'Reject'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spend by Member */}
      {Object.keys(memberSpend).length > 0 && (
        <div className="tw-section">
          <h3 className="tw-section-title">Spend by Member (This Month)</h3>
          <table className="tw-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Spent</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(memberSpend).map(([id, amount]) => (
                <tr key={id}>
                  <td>{id}</td>
                  <td>${amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Transaction History */}
      <div className="tw-section">
        <h3 className="tw-section-title">Transaction History</h3>
        {history.length === 0 ? (
          <div className="tw-empty">No transactions yet</div>
        ) : (
          <ul className="tw-tx-list">
            {history.slice(0, 30).map(tx => (
              <li key={tx._id} className="tw-tx-item">
                <div className="tw-tx-info">
                  <span className="tw-tx-desc">{tx.reason || tx.status}</span>
                  <span className="tw-tx-meta">{formatDate(tx.createdAt)}</span>
                </div>
                <span className={`tw-tx-amount ${getAmountClass(tx)}`}>
                  {getAmountDisplay(tx)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add Funds Modal */}
      {showAddFunds && (
        <div className="tw-modal-overlay" onClick={() => setShowAddFunds(false)}>
          <div className="tw-modal" onClick={e => e.stopPropagation()}>
            <h3 className="tw-modal-title">Add Funds to Team Wallet</h3>
            <input
              type="number"
              className="tw-modal-input"
              placeholder="Amount ($5 - $500)"
              value={fundAmount}
              onChange={e => setFundAmount(e.target.value)}
              min="5"
              max="500"
              step="1"
              autoFocus
            />
            <div className="tw-modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowAddFunds(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAddFunds}
                disabled={fundLoading || !fundAmount || parseFloat(fundAmount) < 5}
              >
                {fundLoading ? 'Processing...' : 'Continue to Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamWallet;
