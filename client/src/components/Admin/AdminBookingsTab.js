import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';

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

const AdminBookingsTab = () => {
  const [bookings, setBookings] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (status) params.status = status;
      const data = await apiRequest('/api/admin/bookings', { params });
      setBookings(data.bookings || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to load bookings:', err);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

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

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="admin-tab-content">
      <div className="admin-tab-header">
        <h2>Booking Management</h2>
        <span className="admin-count-badge">{total} total</span>
      </div>

      <div className="admin-filters" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          {STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button onClick={fetchBookings} className="btn btn-ghost btn-sm">Refresh</button>
        {selectedId && (
          <button onClick={() => setSelectedId(null)} className="btn btn-ghost btn-sm">Close details</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', minHeight: 420, marginTop: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 520px', minWidth: 0 }}>
          {loading ? (
            <div className="admin-loading">Loading bookings…</div>
          ) : bookings.length === 0 ? (
            <div className="admin-empty">No bookings found.</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
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
                  {bookings.map(b => {
                    const isSelected = selectedId === b._id;
                    return (
                      <tr key={b._id} style={{ background: isSelected ? '#eff6ff' : undefined }}>
                        <td>{b.service?.title || '—'}</td>
                        <td>{safeName(b.client)}</td>
                        <td>{safeName(b.freelancer)}</td>
                        <td>
                          <span
                            className="status-badge"
                            style={{
                              background: STATUS_COLORS[b.status] || '#6b7280',
                              color: '#fff',
                              padding: '2px 8px',
                              borderRadius: 12,
                              fontSize: '0.8rem',
                              display: 'inline-block',
                              maxWidth: 220,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={b.status}
                          >
                            {formatStatus(b.status)}
                          </span>
                        </td>
                        <td>{b.createdAt ? new Date(b.createdAt).toLocaleDateString() : '—'}</td>
                        <td style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button onClick={() => setSelectedId(b._id)} className="btn btn-ghost btn-sm">View</button>
                          {!['completed', 'cancelled_by_client', 'cancelled_by_freelancer', 'resolved'].includes(b.status) && (
                            <button onClick={() => cancelBooking(b._id)} className="btn btn-danger btn-sm">Cancel</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {total > 20 && (
            <div className="admin-pagination" style={{ marginTop: '0.75rem' }}>
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn btn-ghost btn-sm">← Prev</button>
              <span>Page {page} of {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn btn-ghost btn-sm">Next →</button>
            </div>
          )}
        </div>

        {selectedId && (
          <div style={{ flex: '0 1 420px', minWidth: 320, border: '1px solid #e5e7eb', borderRadius: 12, padding: '0.75rem', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div>
                <div style={{ fontWeight: 700 }}>Booking Details</div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{selectedId}</div>
              </div>
              <button onClick={() => setSelectedId(null)} className="btn btn-ghost btn-sm">✕</button>
            </div>

            {detailLoading ? (
              <div style={{ color: '#6b7280' }}>Loading detail…</div>
            ) : detailError ? (
              <div style={{ color: '#ef4444' }}>{detailError}</div>
            ) : !selected ? (
              <div style={{ color: '#6b7280' }}>No detail found.</div>
            ) : (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <div><strong>Ref:</strong> {selected.bookingRef || '—'}</div>
                <div><strong>Status:</strong> {formatStatus(selected.status)}</div>
                <div><strong>Client:</strong> {safeName(selected.client)}</div>
                <div><strong>Freelancer:</strong> {safeName(selected.freelancer)}</div>
                <div><strong>Service:</strong> {selected.service?.title || selected.policySnapshotJson?.serviceTitle || '—'}</div>

                {Array.isArray(selected.occurrences) && (
                  <div style={{ marginTop: '0.25rem' }}>
                    <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Occurrences</div>
                    <div style={{ display: 'grid', gap: '0.25rem' }}>
                      {selected.occurrences.slice(0, 10).map(o => (
                        <div key={o.id} style={{ fontSize: '0.85rem', padding: '0.4rem 0.5rem', border: '1px solid #e5e7eb', borderRadius: 10, background: '#f9fafb' }}>
                          <div><strong>#{o.occurrenceNo}</strong> · {formatStatus(o.status)}</div>
                          <div style={{ color: '#6b7280' }}>{o.localStartWallclock} → {o.localEndWallclock} ({o.timezone})</div>
                        </div>
                      ))}
                      {selected.occurrences.length > 10 && (
                        <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Showing first 10 occurrences…</div>
                      )}
                    </div>
                  </div>
                )}

                {!['completed', 'cancelled_by_client', 'cancelled_by_freelancer', 'resolved'].includes(selected.status) && (
                  <button onClick={() => cancelBooking(selected.id)} className="btn btn-danger btn-sm" style={{ marginTop: '0.5rem' }}>Cancel booking</button>
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
