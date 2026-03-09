import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import './TeamContracts.css';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'disputed', label: 'Disputed' },
];

const STATUS_CLASSES = {
  draft: 'tc2-status--draft',
  pending: 'tc2-status--pending',
  active: 'tc2-status--active',
  completed: 'tc2-status--completed',
  cancelled: 'tc2-status--cancelled',
  expired: 'tc2-status--expired',
  disputed: 'tc2-status--disputed',
};

function formatCurrency(val) {
  if (val == null) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function counterpartyName(contract, teamMembers) {
  const freelancer = contract.freelancer;
  if (freelancer && (freelancer.firstName || freelancer.lastName)) {
    return `${freelancer.firstName || ''} ${freelancer.lastName || ''}`.trim();
  }
  const client = contract.client;
  if (client && (client.firstName || client.lastName)) {
    return `${client.firstName || ''} ${client.lastName || ''}`.trim();
  }
  return 'Unknown';
}

export default function TeamContracts({ team, currentUserRole }) {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState('');

  const teamId = team?._id;

  const fetchContracts = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ teamId });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await apiRequest(`/api/contracts?${params}`);
      setContracts(res.contracts || []);
    } catch (err) {
      setError(err.message || 'Failed to load contracts');
    } finally {
      setLoading(false);
    }
  }, [teamId, statusFilter]);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  // Stats
  const activeContracts = contracts.filter(c => c.status === 'active');
  const pendingSignatures = contracts.filter(c => c.status === 'pending');
  const totalValue = contracts.reduce((sum, c) => sum + (c.terms?.compensation || 0), 0);

  if (loading) return <div className="tc2-loading">Loading contracts...</div>;

  return (
    <div className="tc2-root">
      <div className="tc2-header">
        <h3 className="tc2-title">Team Contracts</h3>
        <a href={`/contracts/create?teamId=${teamId}`} className="tc2-btn tc2-btn--primary">Create Team Contract</a>
      </div>

      {error && <div className="tc2-error">{error}</div>}

      {/* Stats row */}
      <div className="tc2-stats">
        <div className="tc2-stat">
          <span className="tc2-stat-value">{formatCurrency(totalValue)}</span>
          <span className="tc2-stat-label">Total Value</span>
        </div>
        <div className="tc2-stat">
          <span className="tc2-stat-value">{activeContracts.length}</span>
          <span className="tc2-stat-label">Active</span>
        </div>
        <div className="tc2-stat">
          <span className="tc2-stat-value">{pendingSignatures.length}</span>
          <span className="tc2-stat-label">Pending Signatures</span>
        </div>
      </div>

      {/* Filters */}
      <div className="tc2-filters">
        <div className="tc2-filter-group">
          <label className="tc2-filter-label">Status</label>
          <select className="tc2-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Contract list */}
      {contracts.length === 0 ? (
        <div className="tc2-empty">No contracts found{statusFilter !== 'all' ? ` with status "${statusFilter}"` : ''}.</div>
      ) : (
        <ul className="tc2-list">
          {contracts.map(c => (
            <li key={c._id} className="tc2-card">
              <a href={`/contracts/${c._id}`} className="tc2-card-link">
                <div className="tc2-card-header">
                  <h4 className="tc2-card-title">{c.title}</h4>
                  <span className={`tc2-status ${STATUS_CLASSES[c.status] || ''}`}>{c.status}</span>
                </div>
                <div className="tc2-card-body">
                  <div className="tc2-card-meta">
                    <span className="tc2-meta-item">
                      <span className="tc2-meta-label">Counterparty:</span> {counterpartyName(c)}
                    </span>
                    <span className="tc2-meta-item">
                      <span className="tc2-meta-label">Value:</span> {formatCurrency(c.terms?.compensation)}
                    </span>
                    <span className="tc2-meta-item">
                      <span className="tc2-meta-label">Created:</span> {formatDate(c.createdAt)}
                    </span>
                  </div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
