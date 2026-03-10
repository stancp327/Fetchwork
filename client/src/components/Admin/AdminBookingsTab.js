import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';

const AdminBookingsTab = () => {
  const [bookings, setBookings] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

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

  const cancelBooking = async (id) => {
    const reason = window.prompt('Reason for cancellation:');
    if (!reason) return;
    try {
      await apiRequest(`/api/admin/bookings/${id}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
      });
      fetchBookings();
    } catch (err) {
      alert('Failed to cancel: ' + (err.message || 'Unknown error'));
    }
  };

  const statusColors = {
    pending_payment: '#eab308',
    held: '#f97316',
    confirmed: '#22c55e',
    in_progress: '#6366f1',
    completed: '#3b82f6',
    cancelled_by_client: '#ef4444',
    cancelled_by_freelancer: '#ef4444',
    cancelled: '#ef4444',
    disputed: '#a855f7',
    resolved: '#10b981',
  };

  return (
    <div className="admin-tab-content">
      <div className="admin-tab-header">
        <h2>Booking Management</h2>
        <span className="admin-count-badge">{total} total</span>
      </div>

      <div className="admin-filters">
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          <option value="pending_payment">Pending payment</option>
          <option value="held">Held</option>
          <option value="confirmed">Confirmed</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled_by_client">Cancelled (client)</option>
          <option value="cancelled_by_freelancer">Cancelled (freelancer)</option>
          <option value="disputed">Disputed</option>
          <option value="resolved">Resolved</option>
        </select>
        <button onClick={fetchBookings} className="btn btn-ghost btn-sm">Refresh</button>
      </div>

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
              {bookings.map(b => (
                <tr key={b._id}>
                  <td>{b.service?.title || '—'}</td>
                  <td>{b.client?.firstName} {b.client?.lastName}</td>
                  <td>{b.freelancer?.firstName} {b.freelancer?.lastName}</td>
                  <td>
                    <span className="status-badge" style={{ background: statusColors[b.status] || '#6b7280', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>
                      {b.status}
                    </span>
                  </td>
                  <td>{new Date(b.createdAt).toLocaleDateString()}</td>
                  <td>
                    {!['completed', 'cancelled', 'cancelled_by_client', 'cancelled_by_freelancer', 'resolved'].includes(b.status) && (
                      <button onClick={() => cancelBooking(b._id)} className="btn btn-danger btn-sm">Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 20 && (
        <div className="admin-pagination">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn btn-ghost btn-sm">← Prev</button>
          <span>Page {page} of {Math.ceil(total / 20)}</span>
          <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)} className="btn btn-ghost btn-sm">Next →</button>
        </div>
      )}
    </div>
  );
};

export default AdminBookingsTab;
