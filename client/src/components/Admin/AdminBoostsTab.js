import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';

const AdminBoostsTab = () => {
  const [boosts, setBoosts] = useState([]);
  const [status, setStatus] = useState('active');
  const [loading, setLoading] = useState(true);

  const fetchBoosts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/api/admin/boosts', { params: { status } });
      setBoosts(data.boosts || []);
    } catch (err) {
      console.error('Failed to load boosts:', err);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { fetchBoosts(); }, [fetchBoosts]);

  const cancelBoost = async (type, id) => {
    const reason = window.prompt('Reason for cancellation:');
    if (!reason) return;
    try {
      await apiRequest(`/api/admin/boosts/${type}/${id}/cancel`, {
        method: 'PUT',
        body: JSON.stringify({ reason }),
      });
      fetchBoosts();
    } catch (err) {
      alert('Failed to cancel boost: ' + (err.message || 'Unknown error'));
    }
  };

  const tierColors = { basic: '#3b82f6', standard: '#8b5cf6', premium: '#f59e0b' };

  return (
    <div className="admin-tab-content">
      <div className="admin-tab-header">
        <h2>Boost Management</h2>
        <span className="admin-count-badge">{boosts.length} boosts</span>
      </div>

      <div className="admin-filters">
        <select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="all">All</option>
        </select>
        <button onClick={fetchBoosts} className="btn btn-ghost btn-sm">Refresh</button>
      </div>

      {loading ? (
        <div className="admin-loading">Loading boosts…</div>
      ) : boosts.length === 0 ? (
        <div className="admin-empty">No {status} boosts found.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Owner</th>
                <th>Tier</th>
                <th>Expires</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {boosts.map(b => {
                const owner = b.type === 'service' ? b.freelancer : b.client;
                return (
                  <tr key={b._id}>
                    <td>{b.title}</td>
                    <td style={{ textTransform: 'capitalize' }}>{b.type}</td>
                    <td>{owner?.firstName} {owner?.lastName}</td>
                    <td>
                      <span style={{
                        background: tierColors[b.boost?.tier] || '#6b7280',
                        color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem'
                      }}>
                        {b.boost?.tier || '—'}
                      </span>
                    </td>
                    <td>{b.boost?.expiresAt ? new Date(b.boost.expiresAt).toLocaleDateString() : '—'}</td>
                    <td>
                      {b.boost?.active && (
                        <button onClick={() => cancelBoost(b.type, b._id)} className="btn btn-danger btn-sm">Cancel</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminBoostsTab;
