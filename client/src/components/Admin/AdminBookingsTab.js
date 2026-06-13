import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import './AdminBookingsTab.css';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending_payment', label: 'Pending payment' },
  { value: 'held', label: 'Held' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled_by_client', label: 'Cancelled (client)' },
  { value: 'cancelled_by_freelancer', label: 'Cancelled (freelancer)' },
  { value: 'no_show_client', label: 'No-show (client)' },
  { value: 'no_show_freelancer', label: 'No-show (freelancer)' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'resolved', label: 'Resolved' },
];

const STATUS_COLORS = {
  pending_payment: '#eab308',
  held: '#f97316',
  confirmed: '#22c55e',
  in_progress: '#6366f1',
  completed: '#3b82f6',
  cancelled_by_client: '#ef4444',
  cancelled_by_freelancer: '#ef4444',
  no_show_client: '#ef4444',
  no_show_freelancer: '#ef4444',
  disputed: '#a855f7',
  resolved: '#10b981',
};

function formatStatus(s) {
  const opt = STATUS_OPTIONS.find(o => o.value === s);
  return opt?.label || s || '—';
}

function safeName(u) {
  if (!u) return '—';
  const name = `${u.firstName || ''} ${u.lastName || ''}`.trim();
  return name || u.email || '—';
}

const TERMINAL_STATUSES = ['completed', 'cancelled_by_client', 'cancelled_by_freelancer', 'resolved'];

const AdminBookingsTab = () => {
  const [bookings, setBookings] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: perPage };
      if (status) params.status = status;
      const data = await apiRequest('/api/admin/bookings', { params });
      setBookings(data.bookings || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to load bookings:', err);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, status]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const fetchBookingDetail = useCallback(async (id) => {
    if (!id) return;
    try {
      setDetailLoading(true);
      setDetailError('');
      const data = await apiRequest(`/api/admin/bookings/${id}`);
      setSelected(data.booking || null);
    } catch (err) {
      console.error('Failed to load booking detail:', err);
      setSelected(null);
      setDetailError(err?.message || 'Failed to load booking detail');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    setSelected(null);
    if (selectedId) fetchBookingDetail(selectedId);
  }, [selectedId, fetchBookingDetail]);

  const cancelBooking = async (id) => {
    const reason = window.prompt('Reason for cancellation:');
    if (!reason) return;
    try {
      await apiRequest(`/api/admin/bookings/${id}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
      });
      await fetchBookings();
      if (selectedId === id) await fetchBookingDetail(id);
    } catch (err) {
      alert('Failed to cancel: ' + (err.message || 'Unknown error'));
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="admin-tab-content">
      <div className="admin-tab-header">
        <h2>Booking Management</h2>
        <span className="admin-count-badge">{total} total</span>
      </div>

      <div className="admin-filters abt-filters">
        <select
          className="abt-select"
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1); }}
        >
          {STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div className="abt-filter-actions">
          <select
            className="abt-per-page"
            value={perPage}
            onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
            aria-label="Results per page"
          >
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
          <button onClick={fetchBookings} className="btn btn-ghost btn-sm">Refresh</button>
          {selectedId && (
            <button onClick={() => setSelectedId(null)} className="btn btn-ghost btn-sm">Close details</button>
          )}
        </div>
      </div>

      <div className="abt-layout">
        <div className="abt-list-panel">
          {loading ? (
            <div className="admin-loading">Loading bookings…</div>
          ) : bookings.length === 0 ? (
            <div className="admin-empty">No bookings found.</div>
          ) : (
            <div className="abt-table-wrap">
              <table className="abt-table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Client</th>
                    <th>Freelancer</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map(b => (
                    <tr
                      key={b._id}
                      className={selectedId === b._id ? 'is-selected' : ''}
                    >
                      <td data-label="Service">{b.service?.title || '—'}</td>
                      <td data-label="Client">{safeName(b.client)}</td>
                      <td data-label="Freelancer">{safeName(b.freelancer)}</td>
                      <td data-label="Status">
                        <span
                          className="abt-status-badge"
                          data-status={b.status}
                          title={b.status}
                        >
                          {formatStatus(b.status)}
                        </span>
                      </td>
                      <td data-label="Date">
                        {b.createdAt ? new Date(b.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="abt-actions-cell">
                        <div className="abt-row-actions">
                          <button onClick={() => setSelectedId(b._id)} className="btn btn-ghost btn-sm">View</button>
                          {!TERMINAL_STATUSES.includes(b.status) && (
                            <button onClick={() => cancelBooking(b._id)} className="btn btn-danger btn-sm">Cancel</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {total > perPage && (
            <div className="admin-pagination">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="btn btn-ghost btn-sm"
              >
                ← Prev
              </button>
              <span className="abt-page-info">Page {page} of {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="btn btn-ghost btn-sm"
              >
                Next →
              </button>
            </div>
          )}
        </div>

        {selectedId && (
          <div className="abt-detail-panel">
            <div className="abt-detail-header">
              <div>
                <div className="abt-detail-title">Booking Details</div>
                <div className="abt-detail-id">{selectedId}</div>
              </div>
              <button onClick={() => setSelectedId(null)} className="btn btn-ghost btn-sm">✕</button>
            </div>

            {detailLoading ? (
              <div className="admin-loading">Loading detail…</div>
            ) : detailError ? (
              <div className="abt-detail-error">{detailError}</div>
            ) : !selected ? (
              <div className="admin-empty">No detail found.</div>
            ) : (
              <div className="abt-detail-body">
                <dl className="abt-detail-fields">
                  <div className="abt-field-row">
                    <dt>Ref</dt>
                    <dd>{selected.bookingRef || '—'}</dd>
                  </div>
                  <div className="abt-field-row">
                    <dt>Status</dt>
                    <dd>
                      <span
                        className="abt-status-badge"
                        data-status={selected.status}
                      >
                        {formatStatus(selected.status)}
                      </span>
                    </dd>
                  </div>
                  <div className="abt-field-row">
                    <dt>Client</dt>
                    <dd>{safeName(selected.client)}</dd>
                  </div>
                  <div className="abt-field-row">
                    <dt>Freelancer</dt>
                    <dd>{safeName(selected.freelancer)}</dd>
                  </div>
                  <div className="abt-field-row">
                    <dt>Service</dt>
                    <dd>{selected.service?.title || selected.policySnapshotJson?.serviceTitle || '—'}</dd>
                  </div>
                </dl>

                {Array.isArray(selected.occurrences) && selected.occurrences.length > 0 && (
                  <div className="abt-occurrences">
                    <div className="abt-occurrences-title">Occurrences</div>
                    <div className="abt-occurrences-list">
                      {selected.occurrences.slice(0, 10).map(o => (
                        <div key={o.id} className="abt-occurrence-item">
                          <div className="abt-occurrence-no">
                            <strong>#{o.occurrenceNo}</strong> · {formatStatus(o.status)}
                          </div>
                          <div className="abt-occurrence-time">
                            {o.localStartWallclock} → {o.localEndWallclock} ({o.timezone})
                          </div>
                        </div>
                      ))}
                      {selected.occurrences.length > 10 && (
                        <div className="abt-occurrences-more">Showing first 10 occurrences…</div>
                      )}
                    </div>
                  </div>
                )}

                {!TERMINAL_STATUSES.includes(selected.status) && (
                  <button
                    onClick={() => cancelBooking(selected.id)}
                    className="btn btn-danger btn-sm abt-cancel-btn"
                  >
                    Cancel booking
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminBookingsTab;
