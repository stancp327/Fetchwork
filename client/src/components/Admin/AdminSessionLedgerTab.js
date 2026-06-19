import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import './AdminSessionLedgerTab.css';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'held', label: 'Held' },
  { value: 'released', label: 'Released' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'expired', label: 'Expired' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const SOURCE_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'session_booking', label: 'Session Booking' },
];

const LIMIT_OPTIONS = [
  { value: 25, label: '25' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
  { value: 200, label: '200' },
];

const STATUS_COLORS = {
  unpaid: '#eab308',
  held: '#f97316',
  released: '#22c55e',
  refunded: '#3b82f6',
  expired: '#6b7280',
  disputed: '#a855f7',
  failed: '#ef4444',
  cancelled: '#6b7280',
};

function centsToUsd(cents) {
  if (cents == null) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

function truncateId(id) {
  if (!id) return '—';
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatStatus(s) {
  const opt = STATUS_OPTIONS.find(o => o.value === s);
  return opt?.label || s || '—';
}

const AdminSessionLedgerTab = () => {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [status, setStatus] = useState('');
  const [sourceType, setSourceType] = useState('');
  const [limit, setLimit] = useState(50);

  // Detail modal
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (sourceType) params.set('sourceType', sourceType);
      params.set('limit', limit.toString());
      const qs = params.toString();
      const response = await apiRequest(`/api/admin/ledger${qs ? '?' + qs : ''}`);
      setEntries(response.entries || []);
      setTotal(response.total || 0);
    } catch (err) {
      console.error('Failed to fetch ledger entries:', err);
      setError(err.message || 'Failed to load ledger entries');
      setEntries([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [status, sourceType, limit]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const openDetail = async (entry) => {
    setDetailLoading(true);
    setSelectedEntry(entry);
    try {
      const response = await apiRequest(`/api/admin/ledger/${entry.id}`);
      setSelectedEntry(response.entry || entry);
    } catch (err) {
      console.error('Failed to fetch ledger detail:', err);
      // Keep the list-level entry data if detail fetch fails
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedEntry(null);
    setDetailLoading(false);
  };

  return (
    <div className="admin-tab-content aslt">
      <div className="admin-tab-header">
        <h2>Session Ledger</h2>
        <span className="admin-count-badge">{total} entries</span>
        <button className="aslt-refresh-btn" onClick={fetchEntries} disabled={loading}>
          {loading ? 'Loading…' : '↻ Refresh'}
        </button>
      </div>

      {/* Filters */}
      <div className="admin-filters aslt-filters">
        <select
          className="aslt-filter-select"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          className="aslt-filter-select"
          value={sourceType}
          onChange={(e) => setSourceType(e.target.value)}
        >
          {SOURCE_TYPE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          className="aslt-filter-select"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
        >
          {LIMIT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>Show {opt.label}</option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="aslt-error">
          <span>⚠ {error}</span>
          <button onClick={fetchEntries}>Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && <div className="admin-loading">Loading ledger entries…</div>}

      {/* Empty */}
      {!loading && !error && entries.length === 0 && (
        <div className="admin-empty">No ledger entries found.</div>
      )}

      {/* Table — cards on mobile, table on desktop */}
      {!loading && entries.length > 0 && (
        <>
          {/* Mobile cards */}
          <div className="aslt-cards">
            {entries.map(entry => (
              <div
                key={entry.id}
                className="aslt-card"
                onClick={() => openDetail(entry)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && openDetail(entry)}
              >
                <div className="aslt-card-header">
                  <span
                    className="aslt-status-badge"
                    style={{ background: STATUS_COLORS[entry.status] || '#6b7280' }}
                  >
                    {formatStatus(entry.status)}
                  </span>
                  <span className="aslt-card-id" title={entry.id}>{truncateId(entry.id)}</span>
                </div>
                <div className="aslt-card-amounts">
                  <div className="aslt-card-amount">
                    <span className="aslt-label">Gross</span>
                    <span className="aslt-value">{centsToUsd(entry.grossAmountCents)}</span>
                  </div>
                  <div className="aslt-card-amount">
                    <span className="aslt-label">Fee</span>
                    <span className="aslt-value">{centsToUsd(entry.platformFeeCents)}</span>
                  </div>
                  <div className="aslt-card-amount">
                    <span className="aslt-label">Payout</span>
                    <span className="aslt-value">{centsToUsd(entry.payoutAmountCents)}</span>
                  </div>
                </div>
                <div className="aslt-card-meta">
                  <span>{entry.sourceType || '—'}</span>
                  <span>{formatDate(entry.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="aslt-table-wrap">
            <table className="aslt-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Gross</th>
                  <th>Fee</th>
                  <th>Payout</th>
                  <th>Status</th>
                  <th>Type</th>
                  <th>Source ID</th>
                  <th>Client</th>
                  <th>Freelancer</th>
                  <th>Created</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => (
                  <tr
                    key={entry.id}
                    className="aslt-row"
                    onClick={() => openDetail(entry)}
                  >
                    <td className="aslt-cell-id" title={entry.id}>{truncateId(entry.id)}</td>
                    <td>{centsToUsd(entry.grossAmountCents)}</td>
                    <td>{centsToUsd(entry.platformFeeCents)}</td>
                    <td>{centsToUsd(entry.payoutAmountCents)}</td>
                    <td>
                      <span
                        className="aslt-status-badge"
                        style={{ background: STATUS_COLORS[entry.status] || '#6b7280' }}
                      >
                        {formatStatus(entry.status)}
                      </span>
                    </td>
                    <td>{entry.sourceType || '—'}</td>
                    <td className="aslt-cell-id" title={entry.sourceId}>{truncateId(entry.sourceId)}</td>
                    <td className="aslt-cell-id" title={entry.clientId}>{truncateId(entry.clientId)}</td>
                    <td className="aslt-cell-id" title={entry.freelancerId}>{truncateId(entry.freelancerId)}</td>
                    <td>{formatDate(entry.createdAt)}</td>
                    <td>{formatDate(entry.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="admin-pagination">
            <span>Showing {entries.length} of {total} entries</span>
          </div>
        </>
      )}

      {/* Detail Modal */}
      {selectedEntry && (
        <div className="aslt-modal-overlay" onClick={closeDetail}>
          <div className="aslt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="aslt-modal-header">
              <h3>Ledger Entry Detail</h3>
              <button className="aslt-modal-close" onClick={closeDetail}>✕</button>
            </div>

            {detailLoading ? (
              <div className="admin-loading">Loading detail…</div>
            ) : (
              <div className="aslt-modal-body">
                <div className="aslt-detail-section">
                  <h4>Identification</h4>
                  <div className="aslt-detail-grid">
                    <div className="aslt-detail-row">
                      <span className="aslt-detail-label">Ledger ID</span>
                      <span className="aslt-detail-value aslt-mono">{selectedEntry.id}</span>
                    </div>
                    <div className="aslt-detail-row">
                      <span className="aslt-detail-label">Source Type</span>
                      <span className="aslt-detail-value">{selectedEntry.sourceType}</span>
                    </div>
                    <div className="aslt-detail-row">
                      <span className="aslt-detail-label">Source ID</span>
                      <span className="aslt-detail-value aslt-mono">{selectedEntry.sourceId}</span>
                    </div>
                    <div className="aslt-detail-row">
                      <span className="aslt-detail-label">Idempotency Key</span>
                      <span className="aslt-detail-value aslt-mono">{selectedEntry.idempotencyKey || '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="aslt-detail-section">
                  <h4>Parties</h4>
                  <div className="aslt-detail-grid">
                    <div className="aslt-detail-row">
                      <span className="aslt-detail-label">Client ID</span>
                      <span className="aslt-detail-value aslt-mono">{selectedEntry.clientId}</span>
                    </div>
                    <div className="aslt-detail-row">
                      <span className="aslt-detail-label">Freelancer ID</span>
                      <span className="aslt-detail-value aslt-mono">{selectedEntry.freelancerId}</span>
                    </div>
                    {selectedEntry.stripeConnectedAccountId && (
                      <div className="aslt-detail-row">
                        <span className="aslt-detail-label">Stripe Connect Acct</span>
                        <span className="aslt-detail-value aslt-mono">{selectedEntry.stripeConnectedAccountId}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="aslt-detail-section">
                  <h4>Amounts</h4>
                  <div className="aslt-detail-grid">
                    <div className="aslt-detail-row">
                      <span className="aslt-detail-label">Gross</span>
                      <span className="aslt-detail-value">{centsToUsd(selectedEntry.grossAmountCents)}</span>
                    </div>
                    <div className="aslt-detail-row">
                      <span className="aslt-detail-label">Platform Fee</span>
                      <span className="aslt-detail-value">{centsToUsd(selectedEntry.platformFeeCents)}</span>
                    </div>
                    <div className="aslt-detail-row">
                      <span className="aslt-detail-label">Payout</span>
                      <span className="aslt-detail-value">{centsToUsd(selectedEntry.payoutAmountCents)}</span>
                    </div>
                    <div className="aslt-detail-row">
                      <span className="aslt-detail-label">Released</span>
                      <span className="aslt-detail-value">{centsToUsd(selectedEntry.releasedAmountCents)}</span>
                    </div>
                    <div className="aslt-detail-row">
                      <span className="aslt-detail-label">Refunded</span>
                      <span className="aslt-detail-value">{centsToUsd(selectedEntry.refundedAmountCents)}</span>
                    </div>
                    <div className="aslt-detail-row">
                      <span className="aslt-detail-label">Currency</span>
                      <span className="aslt-detail-value">{(selectedEntry.currency || 'usd').toUpperCase()}</span>
                    </div>
                  </div>
                </div>

                <div className="aslt-detail-section">
                  <h4>Status &amp; Timing</h4>
                  <div className="aslt-detail-grid">
                    <div className="aslt-detail-row">
                      <span className="aslt-detail-label">Status</span>
                      <span className="aslt-detail-value">
                        <span
                          className="aslt-status-badge"
                          style={{ background: STATUS_COLORS[selectedEntry.status] || '#6b7280' }}
                        >
                          {formatStatus(selectedEntry.status)}
                        </span>
                      </span>
                    </div>
                    <div className="aslt-detail-row">
                      <span className="aslt-detail-label">Created</span>
                      <span className="aslt-detail-value">{formatDate(selectedEntry.createdAt)}</span>
                    </div>
                    <div className="aslt-detail-row">
                      <span className="aslt-detail-label">Updated</span>
                      <span className="aslt-detail-value">{formatDate(selectedEntry.updatedAt)}</span>
                    </div>
                    {selectedEntry.chargedAt && (
                      <div className="aslt-detail-row">
                        <span className="aslt-detail-label">Charged At</span>
                        <span className="aslt-detail-value">{formatDate(selectedEntry.chargedAt)}</span>
                      </div>
                    )}
                    {selectedEntry.heldAt && (
                      <div className="aslt-detail-row">
                        <span className="aslt-detail-label">Held At</span>
                        <span className="aslt-detail-value">{formatDate(selectedEntry.heldAt)}</span>
                      </div>
                    )}
                    {selectedEntry.releaseAt && (
                      <div className="aslt-detail-row">
                        <span className="aslt-detail-label">Scheduled Release</span>
                        <span className="aslt-detail-value">{formatDate(selectedEntry.releaseAt)}</span>
                      </div>
                    )}
                    {selectedEntry.releasedAt && (
                      <div className="aslt-detail-row">
                        <span className="aslt-detail-label">Released At</span>
                        <span className="aslt-detail-value">{formatDate(selectedEntry.releasedAt)}</span>
                      </div>
                    )}
                    {selectedEntry.refundedAt && (
                      <div className="aslt-detail-row">
                        <span className="aslt-detail-label">Refunded At</span>
                        <span className="aslt-detail-value">{formatDate(selectedEntry.refundedAt)}</span>
                      </div>
                    )}
                    {selectedEntry.disputedAt && (
                      <div className="aslt-detail-row">
                        <span className="aslt-detail-label">Disputed At</span>
                        <span className="aslt-detail-value">{formatDate(selectedEntry.disputedAt)}</span>
                      </div>
                    )}
                    {selectedEntry.cancelledAt && (
                      <div className="aslt-detail-row">
                        <span className="aslt-detail-label">Cancelled At</span>
                        <span className="aslt-detail-value">{formatDate(selectedEntry.cancelledAt)}</span>
                      </div>
                    )}
                    {selectedEntry.failedAt && (
                      <div className="aslt-detail-row">
                        <span className="aslt-detail-label">Failed At</span>
                        <span className="aslt-detail-value">{formatDate(selectedEntry.failedAt)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stripe refs */}
                {(selectedEntry.stripePaymentIntentId || selectedEntry.stripeChargeId || selectedEntry.stripeTransferId || selectedEntry.stripeRefundId) && (
                  <div className="aslt-detail-section">
                    <h4>Stripe References</h4>
                    <div className="aslt-detail-grid">
                      {selectedEntry.stripePaymentIntentId && (
                        <div className="aslt-detail-row">
                          <span className="aslt-detail-label">Payment Intent</span>
                          <span className="aslt-detail-value aslt-mono">{selectedEntry.stripePaymentIntentId}</span>
                        </div>
                      )}
                      {selectedEntry.stripeChargeId && (
                        <div className="aslt-detail-row">
                          <span className="aslt-detail-label">Charge</span>
                          <span className="aslt-detail-value aslt-mono">{selectedEntry.stripeChargeId}</span>
                        </div>
                      )}
                      {selectedEntry.stripeTransferId && (
                        <div className="aslt-detail-row">
                          <span className="aslt-detail-label">Transfer</span>
                          <span className="aslt-detail-value aslt-mono">{selectedEntry.stripeTransferId}</span>
                        </div>
                      )}
                      {selectedEntry.stripeRefundId && (
                        <div className="aslt-detail-row">
                          <span className="aslt-detail-label">Refund</span>
                          <span className="aslt-detail-value aslt-mono">{selectedEntry.stripeRefundId}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes / reasons */}
                {(selectedEntry.releaseNote || selectedEntry.releaseEvent || selectedEntry.failureReason || selectedEntry.cancelReason) && (
                  <div className="aslt-detail-section">
                    <h4>Notes</h4>
                    <div className="aslt-detail-grid">
                      {selectedEntry.releaseEvent && (
                        <div className="aslt-detail-row">
                          <span className="aslt-detail-label">Release Event</span>
                          <span className="aslt-detail-value">{selectedEntry.releaseEvent}</span>
                        </div>
                      )}
                      {selectedEntry.releaseNote && (
                        <div className="aslt-detail-row">
                          <span className="aslt-detail-label">Release Note</span>
                          <span className="aslt-detail-value">{selectedEntry.releaseNote}</span>
                        </div>
                      )}
                      {selectedEntry.failureReason && (
                        <div className="aslt-detail-row">
                          <span className="aslt-detail-label">Failure Reason</span>
                          <span className="aslt-detail-value aslt-error-text">{selectedEntry.failureReason}</span>
                        </div>
                      )}
                      {selectedEntry.cancelReason && (
                        <div className="aslt-detail-row">
                          <span className="aslt-detail-label">Cancel Reason</span>
                          <span className="aslt-detail-value">{selectedEntry.cancelReason}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Metadata (raw JSON) */}
                {selectedEntry.metadata && Object.keys(selectedEntry.metadata).length > 0 && (
                  <div className="aslt-detail-section">
                    <h4>Metadata</h4>
                    <pre className="aslt-metadata-pre">
                      {JSON.stringify(selectedEntry.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSessionLedgerTab;
