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

  // Re-snapshot action
  const [snapshotReason, setSnapshotReason] = useState('');
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(null); // { type: 'success'|'error', text }

  // Refund action
  const [showRefundConfirm, setShowRefundConfirm] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refundConfirmText, setRefundConfirmText] = useState('');
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundError, setRefundError] = useState('');

  // Release action
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false);
  const [releaseReason, setReleaseReason] = useState('');
  const [releaseConfirmText, setReleaseConfirmText] = useState('');
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [releaseError, setReleaseError] = useState('');

  const TERMINAL_STATUSES = ['released', 'refunded'];
  const REFUND_VALID_STATUSES = ['held', 'release_pending', 'disputed'];
  const canResnapshot = selectedEntry && !TERMINAL_STATUSES.includes(selectedEntry.status);
  const showRefundButton = selectedEntry
    && REFUND_VALID_STATUSES.includes(selectedEntry.status)
    && selectedEntry.sourceType === 'session_booking';
  const refundDisabledReason = selectedEntry && showRefundButton
    ? (!selectedEntry.stripePaymentIntentId
      ? 'No Stripe PaymentIntent on this entry'
      : selectedEntry.stripeTransferId
        ? 'Transfer already exists. Cannot refund after release.'
        : null)
    : null;

  const RELEASE_VALID_STATUSES = ['held', 'release_pending'];
  const showReleaseButton = selectedEntry
    && RELEASE_VALID_STATUSES.includes(selectedEntry.status)
    && selectedEntry.sourceType === 'session_booking';
  const releaseDisabledReason = selectedEntry && showReleaseButton
    ? (!(selectedEntry.metadata?.feeSnapshot?.status === 'ok')
      ? 'Fee snapshot is missing or failed. Run re-snapshot first.'
      : selectedEntry.payoutAmountCents <= 0
        ? 'Payout amount is zero. Run re-snapshot first.'
        : !selectedEntry.stripeConnectedAccountId
          ? 'Freelancer has no Stripe Connect account.'
          : !selectedEntry.stripePaymentIntentId
            ? 'No Stripe PaymentIntent on this entry.'
            : selectedEntry.stripeTransferId
              ? 'Transfer already exists on this entry.'
              : null)
    : null;

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
    setSnapshotReason('');
    setSnapshotLoading(false);
    setActionMessage(null);
    setShowRefundConfirm(false);
    setRefundReason('');
    setRefundConfirmText('');
    setRefundLoading(false);
    setRefundError('');
    setShowReleaseConfirm(false);
    setReleaseReason('');
    setReleaseConfirmText('');
    setReleaseLoading(false);
    setReleaseError('');
  };

  const handleResnapshot = async () => {
    if (!selectedEntry) return;
    setSnapshotLoading(true);
    setActionMessage(null);
    try {
      const response = await apiRequest(`/api/admin/ledger/${selectedEntry.id}/re-snapshot`, {
        method: 'POST',
        body: JSON.stringify({ reason: snapshotReason || 'Admin re-snapshot' }),
      });
      setSelectedEntry(response.entry || selectedEntry);
      setActionMessage({ type: 'success', text: response.ok ? 'Fee snapshot updated successfully.' : `Re-snapshot completed with note: ${response.error || 'unknown'}` });
      setSnapshotReason('');
      fetchEntries(); // refresh list
    } catch (err) {
      const msg = err.message || 'Re-snapshot failed';
      if (msg.includes('ledger_disabled') || (err.status === 503)) {
        setActionMessage({ type: 'error', text: 'Session ledger actions are disabled. The feature flag is off.' });
      } else {
        setActionMessage({ type: 'error', text: msg });
      }
      // Try to refresh detail on error
      try {
        const refreshed = await apiRequest(`/api/admin/ledger/${selectedEntry.id}`);
        setSelectedEntry(refreshed.entry || selectedEntry);
      } catch (_) { /* ignore refresh failure */ }
    } finally {
      setSnapshotLoading(false);
    }
  };

  const openRefundConfirm = () => {
    setRefundReason('');
    setRefundConfirmText('');
    setRefundError('');
    setShowRefundConfirm(true);
  };

  const closeRefundConfirm = () => {
    if (refundLoading) return; // prevent closing during in-flight request
    setShowRefundConfirm(false);
    setRefundReason('');
    setRefundConfirmText('');
    setRefundError('');
  };

  const handleRefund = async () => {
    if (!selectedEntry || refundLoading) return;
    if (refundConfirmText.trim() !== 'REFUND') return;
    if (!refundReason.trim()) return;

    setRefundLoading(true);
    setRefundError('');
    try {
      const response = await apiRequest(`/api/admin/ledger/${selectedEntry.id}/refund`, {
        method: 'POST',
        body: JSON.stringify({ reason: refundReason.trim() }),
      });
      // Success: close confirm modal, show success in detail modal
      setShowRefundConfirm(false);
      setRefundReason('');
      setRefundConfirmText('');
      const amt = centsToUsd(selectedEntry.grossAmountCents);
      setActionMessage({ type: 'success', text: `Refund of ${amt} processed successfully. Booking cancelled.` });
      setSelectedEntry(response.entry || selectedEntry);
      fetchEntries();
    } catch (err) {
      const msg = err.message || 'Refund failed';
      if (msg.includes('ledger_disabled') || (err.status === 503)) {
        setRefundError('Session ledger actions are disabled. The feature flag is off.');
      } else {
        setRefundError(msg);
      }
      // Refresh detail in background
      try {
        const refreshed = await apiRequest(`/api/admin/ledger/${selectedEntry.id}`);
        setSelectedEntry(refreshed.entry || selectedEntry);
      } catch (_) { /* ignore */ }
      fetchEntries();
    } finally {
      setRefundLoading(false);
    }
  };

  const refundConfirmEnabled = refundConfirmText.trim() === 'REFUND'
    && refundReason.trim().length > 0
    && !refundLoading;

  const openReleaseConfirm = () => {
    setReleaseReason('');
    setReleaseConfirmText('');
    setReleaseError('');
    setShowReleaseConfirm(true);
  };

  const closeReleaseConfirm = () => {
    if (releaseLoading) return;
    setShowReleaseConfirm(false);
    setReleaseReason('');
    setReleaseConfirmText('');
    setReleaseError('');
  };

  const handleRelease = async () => {
    if (!selectedEntry || releaseLoading) return;
    if (releaseConfirmText.trim() !== 'RELEASE') return;
    if (!releaseReason.trim()) return;

    setReleaseLoading(true);
    setReleaseError('');
    try {
      const response = await apiRequest(`/api/admin/ledger/${selectedEntry.id}/release`, {
        method: 'POST',
        body: JSON.stringify({ reason: releaseReason.trim() }),
      });
      setShowReleaseConfirm(false);
      setReleaseReason('');
      setReleaseConfirmText('');
      const amt = centsToUsd(selectedEntry.payoutAmountCents);
      setActionMessage({ type: 'success', text: `Release of ${amt} to freelancer processed successfully.` });
      setSelectedEntry(response.entry || selectedEntry);
      fetchEntries();
    } catch (err) {
      const msg = err.message || 'Release failed';
      if (msg.includes('ledger_disabled') || (err.status === 503)) {
        setReleaseError('Session ledger actions are disabled. The feature flag is off.');
      } else {
        setReleaseError(msg);
      }
      try {
        const refreshed = await apiRequest(`/api/admin/ledger/${selectedEntry.id}`);
        setSelectedEntry(refreshed.entry || selectedEntry);
      } catch (_) { /* ignore */ }
      fetchEntries();
    } finally {
      setReleaseLoading(false);
    }
  };

  const releaseConfirmEnabled = releaseConfirmText.trim() === 'RELEASE'
    && releaseReason.trim().length > 0
    && !releaseLoading;

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

                {/* ── Actions ── */}
                {canResnapshot && (
                  <div className="aslt-detail-section aslt-actions-section">
                    <h4>Actions</h4>

                    {/* Action message (success/error) */}
                    {actionMessage && (
                      <div className={`aslt-action-message aslt-action-message--${actionMessage.type}`}>
                        {actionMessage.text}
                      </div>
                    )}

                    <div className="aslt-action-card">
                      <div className="aslt-action-header">
                        <span className="aslt-action-title">Re-snapshot Fees</span>
                        <span className="aslt-action-desc">Recalculate platform fee and payout amounts from current fee engine settings. Does not move money.</span>
                      </div>
                      <div className="aslt-action-controls">
                        <input
                          type="text"
                          className="aslt-action-reason"
                          placeholder="Reason (optional)"
                          value={snapshotReason}
                          onChange={(e) => setSnapshotReason(e.target.value)}
                          disabled={snapshotLoading}
                        />
                        <button
                          className="aslt-action-btn aslt-action-btn--safe"
                          onClick={handleResnapshot}
                          disabled={snapshotLoading}
                        >
                          {snapshotLoading ? 'Snapshotting…' : '↻ Re-snapshot'}
                        </button>
                      </div>
                    </div>

                    {/* Refund action */}
                    {showRefundButton && (
                      <div className="aslt-action-card aslt-action-card--danger">
                        <div className="aslt-action-header">
                          <span className="aslt-action-title">Refund Payment to Client</span>
                          <span className="aslt-action-desc">
                            Refund {centsToUsd(selectedEntry.grossAmountCents)} to the client. Cancels the booking and frees the seat. Cannot be undone.
                          </span>
                        </div>
                        <div className="aslt-action-controls">
                          <button
                            className="aslt-action-btn aslt-action-btn--danger"
                            onClick={openRefundConfirm}
                            disabled={!!refundDisabledReason}
                            title={refundDisabledReason || ''}
                          >
                            Refund {centsToUsd(selectedEntry.grossAmountCents)}
                          </button>
                          {refundDisabledReason && (
                            <span className="aslt-action-disabled-hint">{refundDisabledReason}</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Release action */}
                    {showReleaseButton && (
                      <div className="aslt-action-card aslt-action-card--danger">
                        <div className="aslt-action-header">
                          <span className="aslt-action-title">Release Payment to Freelancer</span>
                          <span className="aslt-action-desc">
                            Transfer {centsToUsd(selectedEntry.payoutAmountCents)} to the freelancer's Stripe Connect account. Cannot be undone.
                          </span>
                        </div>
                        <div className="aslt-action-controls">
                          <button
                            className="aslt-action-btn aslt-action-btn--danger"
                            onClick={openReleaseConfirm}
                            disabled={!!releaseDisabledReason}
                            title={releaseDisabledReason || ''}
                          >
                            Release {centsToUsd(selectedEntry.payoutAmountCents)}
                          </button>
                          {releaseDisabledReason && (
                            <span className="aslt-action-disabled-hint">{releaseDisabledReason}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Refund Confirmation Modal */}
      {showRefundConfirm && selectedEntry && (
        <div className="aslt-confirm-overlay">
          <div className="aslt-confirm-modal">
            <div className="aslt-confirm-header">
              <h3>⚠ Refund Payment to Client</h3>
            </div>
            <div className="aslt-confirm-body">
              <p className="aslt-confirm-desc">
                This will refund <strong>{centsToUsd(selectedEntry.grossAmountCents)}</strong> to the client's original payment method.
              </p>

              <div className="aslt-confirm-details">
                <div className="aslt-confirm-detail-row">
                  <span className="aslt-confirm-label">Ledger ID</span>
                  <span className="aslt-confirm-value aslt-mono">{selectedEntry.id}</span>
                </div>
                <div className="aslt-confirm-detail-row">
                  <span className="aslt-confirm-label">Booking ID</span>
                  <span className="aslt-confirm-value aslt-mono">{selectedEntry.sourceId}</span>
                </div>
                <div className="aslt-confirm-detail-row">
                  <span className="aslt-confirm-label">Client ID</span>
                  <span className="aslt-confirm-value aslt-mono">{selectedEntry.clientId}</span>
                </div>
                <div className="aslt-confirm-detail-row">
                  <span className="aslt-confirm-label">Amount</span>
                  <span className="aslt-confirm-value">{centsToUsd(selectedEntry.grossAmountCents)}</span>
                </div>
              </div>

              <div className="aslt-confirm-warnings">
                <p className="aslt-confirm-warning">⚠ The associated session booking will be cancelled and the booked seat freed.</p>
                <p className="aslt-confirm-warning">⚠ This action cannot be undone.</p>
              </div>

              <div className="aslt-confirm-field">
                <label className="aslt-confirm-field-label">Reason (required)</label>
                <input
                  type="text"
                  className="aslt-confirm-input"
                  placeholder="Why is this being refunded?"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  disabled={refundLoading}
                />
              </div>

              <div className="aslt-confirm-field">
                <label className="aslt-confirm-field-label">Type REFUND to confirm</label>
                <input
                  type="text"
                  className="aslt-confirm-input aslt-confirm-input--mono"
                  placeholder="Type REFUND to confirm"
                  value={refundConfirmText}
                  onChange={(e) => setRefundConfirmText(e.target.value)}
                  disabled={refundLoading}
                  autoComplete="off"
                  spellCheck="false"
                />
              </div>

              {refundError && (
                <div className="aslt-action-message aslt-action-message--error">
                  {refundError}
                </div>
              )}
            </div>

            <div className="aslt-confirm-footer">
              <button
                className="aslt-confirm-cancel"
                onClick={closeRefundConfirm}
                disabled={refundLoading}
              >
                Cancel
              </button>
              <button
                className="aslt-action-btn aslt-action-btn--danger"
                onClick={handleRefund}
                disabled={!refundConfirmEnabled}
              >
                {refundLoading ? 'Processing refund…' : `Refund ${centsToUsd(selectedEntry.grossAmountCents)}`}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Release Confirmation Modal */}
      {showReleaseConfirm && selectedEntry && (
        <div className="aslt-confirm-overlay">
          <div className="aslt-confirm-modal">
            <div className="aslt-confirm-header">
              <h3>⚠ Release Payment to Freelancer</h3>
            </div>
            <div className="aslt-confirm-body">
              <p className="aslt-confirm-desc">
                This will transfer <strong>{centsToUsd(selectedEntry.payoutAmountCents)}</strong> to the freelancer's Stripe Connect account.
              </p>

              <div className="aslt-confirm-details">
                <div className="aslt-confirm-detail-row">
                  <span className="aslt-confirm-label">Ledger ID</span>
                  <span className="aslt-confirm-value aslt-mono">{selectedEntry.id}</span>
                </div>
                <div className="aslt-confirm-detail-row">
                  <span className="aslt-confirm-label">Booking ID</span>
                  <span className="aslt-confirm-value aslt-mono">{selectedEntry.sourceId}</span>
                </div>
                <div className="aslt-confirm-detail-row">
                  <span className="aslt-confirm-label">Gross Amount</span>
                  <span className="aslt-confirm-value">{centsToUsd(selectedEntry.grossAmountCents)}</span>
                </div>
                <div className="aslt-confirm-detail-row">
                  <span className="aslt-confirm-label">Platform Fee</span>
                  <span className="aslt-confirm-value">{centsToUsd(selectedEntry.platformFeeCents)}</span>
                </div>
                <div className="aslt-confirm-detail-row">
                  <span className="aslt-confirm-label">Payout Amount</span>
                  <span className="aslt-confirm-value"><strong>{centsToUsd(selectedEntry.payoutAmountCents)}</strong></span>
                </div>
                <div className="aslt-confirm-detail-row">
                  <span className="aslt-confirm-label">Freelancer ID</span>
                  <span className="aslt-confirm-value aslt-mono">{selectedEntry.freelancerId}</span>
                </div>
                <div className="aslt-confirm-detail-row">
                  <span className="aslt-confirm-label">Connect Account</span>
                  <span className="aslt-confirm-value aslt-mono">{selectedEntry.stripeConnectedAccountId || '—'}</span>
                </div>
              </div>

              <div className="aslt-confirm-warnings">
                <p className="aslt-confirm-warning">⚠ This transfers real money to the freelancer's Stripe Connect account.</p>
                <p className="aslt-confirm-warning">⚠ This action cannot be undone.</p>
              </div>

              <div className="aslt-confirm-field">
                <label className="aslt-confirm-field-label">Reason (required)</label>
                <input
                  type="text"
                  className="aslt-confirm-input"
                  placeholder="Why is this payment being released?"
                  value={releaseReason}
                  onChange={(e) => setReleaseReason(e.target.value)}
                  disabled={releaseLoading}
                />
              </div>

              <div className="aslt-confirm-field">
                <label className="aslt-confirm-field-label">Type RELEASE to confirm</label>
                <input
                  type="text"
                  className="aslt-confirm-input aslt-confirm-input--mono"
                  placeholder="Type RELEASE to confirm"
                  value={releaseConfirmText}
                  onChange={(e) => setReleaseConfirmText(e.target.value)}
                  disabled={releaseLoading}
                  autoComplete="off"
                  spellCheck="false"
                />
              </div>

              {releaseError && (
                <div className="aslt-action-message aslt-action-message--error">
                  {releaseError}
                </div>
              )}
            </div>

            <div className="aslt-confirm-footer">
              <button
                className="aslt-confirm-cancel"
                onClick={closeReleaseConfirm}
                disabled={releaseLoading}
              >
                Cancel
              </button>
              <button
                className="aslt-action-btn aslt-action-btn--danger"
                onClick={handleRelease}
                disabled={!releaseConfirmEnabled}
              >
                {releaseLoading ? 'Processing release…' : `Release ${centsToUsd(selectedEntry.payoutAmountCents)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSessionLedgerTab;
