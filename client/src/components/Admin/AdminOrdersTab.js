import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';

const AdminOrdersTab = () => {
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (status) params.status = status;
      const data = await apiRequest('/api/admin/orders', { params });
      setOrders(data.orders || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const statusColors = {
    pending: '#eab308', active: '#3b82f6', completed: '#22c55e',
    cancelled: '#ef4444', disputed: '#f97316', delivered: '#8b5cf6',
  };

  return (
    <div className="admin-tab-content">
      <div className="admin-tab-header">
        <h2>Service Orders</h2>
        <span className="admin-count-badge">{total} total</span>
      </div>

      <div className="admin-filters">
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="delivered">Delivered</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="disputed">Disputed</option>
        </select>
        <button onClick={fetchOrders} className="btn btn-ghost btn-sm">Refresh</button>
      </div>

      {loading ? (
        <div className="admin-loading">Loading orders…</div>
      ) : orders.length === 0 ? (
        <div className="admin-empty">No orders found.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Client</th>
                <th>Freelancer</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => (
                <tr key={o.orderId || i}>
                  <td>{o.serviceTitle || '—'}</td>
                  <td>{o.client?.firstName ? `${o.client.firstName} ${o.client.lastName}` : '—'}</td>
                  <td>{o.freelancer?.firstName ? `${o.freelancer.firstName} ${o.freelancer.lastName}` : '—'}</td>
                  <td>${Number(o.amount || 0).toFixed(2)}</td>
                  <td>
                    <span className="status-badge" style={{ background: statusColors[o.status] || '#6b7280', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>
                      {o.status}
                    </span>
                  </td>
                  <td>{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '—'}</td>
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

export default AdminOrdersTab;
