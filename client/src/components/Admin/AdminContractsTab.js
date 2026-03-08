import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';

const AdminContractsTab = () => {
  const [contracts, setContracts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);

  const fetchContracts = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (status) params.status = status;
      const data = await apiRequest('/api/admin/contracts', { params });
      setContracts(data.contracts || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to load contracts:', err);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  const viewDetail = async (id) => {
    try {
      const data = await apiRequest(`/api/admin/contracts/${id}`);
      setDetail(data.contract);
    } catch (err) {
      alert('Failed to load contract detail');
    }
  };

  const voidContract = async (id) => {
    if (!window.confirm('⚠️ Void this contract? This cannot be undone.')) return;
    const reason = window.prompt('Reason for voiding (required):');
    if (!reason || !reason.trim()) return;
    try {
      await apiRequest(`/api/admin/contracts/${id}/void`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
      });
      setDetail(null);
      fetchContracts();
    } catch (err) {
      alert('Failed to void contract: ' + (err.message || 'Unknown error'));
    }
  };

  const statusColors = {
    active: '#22c55e', pending: '#eab308', voided: '#ef4444', completed: '#3b82f6', draft: '#6b7280',
  };

  return (
    <div className="admin-tab-content">
      <div className="admin-tab-header">
        <h2>Contract Management</h2>
        <span className="admin-count-badge">{total} total</span>
      </div>

      <div className="admin-filters">
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="voided">Voided</option>
        </select>
        <button onClick={fetchContracts} className="btn btn-ghost btn-sm">Refresh</button>
      </div>

      {detail && (
        <div className="admin-detail-card" style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0 }}>Contract Detail</h3>
            <button onClick={() => setDetail(null)} className="btn btn-ghost btn-sm">✕ Close</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.9rem' }}>
            <div><strong>Creator:</strong> {detail.creator?.firstName} {detail.creator?.lastName} ({detail.creator?.email})</div>
            <div><strong>Recipient:</strong> {detail.recipient?.firstName} {detail.recipient?.lastName} ({detail.recipient?.email})</div>
            <div><strong>Status:</strong> {detail.status}</div>
            <div><strong>Created:</strong> {new Date(detail.createdAt).toLocaleString()}</div>
            {detail.job && <div><strong>Job:</strong> {detail.job.title}</div>}
          </div>
          {!['voided', 'completed'].includes(detail.status) && (
            <button onClick={() => voidContract(detail._id)} className="btn btn-danger btn-sm" style={{ marginTop: '0.75rem' }}>Void Contract</button>
          )}
        </div>
      )}

      {loading ? (
        <div className="admin-loading">Loading contracts…</div>
      ) : contracts.length === 0 ? (
        <div className="admin-empty">No contracts found.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Creator</th>
                <th>Recipient</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map(c => (
                <tr key={c._id}>
                  <td>{c.creator?.firstName} {c.creator?.lastName}</td>
                  <td>{c.recipient?.firstName} {c.recipient?.lastName}</td>
                  <td>
                    <span className="status-badge" style={{ background: statusColors[c.status] || '#6b7280', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>
                      {c.status}
                    </span>
                  </td>
                  <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button onClick={() => viewDetail(c._id)} className="btn btn-ghost btn-sm">View</button>
                    {!['voided', 'completed'].includes(c.status) && (
                      <button onClick={() => voidContract(c._id)} className="btn btn-danger btn-sm" style={{ marginLeft: '0.5rem' }}>Void</button>
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

export default AdminContractsTab;
