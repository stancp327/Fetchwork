import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';

const AdminWalletsTab = () => {
  const [wallets, setWallets] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [adjustUserId, setAdjustUserId] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustType, setAdjustType] = useState('credit');
  const [adjusting, setAdjusting] = useState(false);

  const fetchWallets = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (search) params.search = search;
      const data = await apiRequest('/api/admin/wallets', { params });
      setWallets(data.wallets || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to load wallets:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchWallets(); }, [fetchWallets]);

  const handleAdjust = async () => {
    const amt = parseFloat(adjustAmount);
    if (!amt || amt <= 0) return alert('Enter a valid amount');
    if (!adjustReason.trim()) return alert('Reason is required');
    setAdjusting(true);
    try {
      await apiRequest(`/api/admin/wallets/${adjustUserId}/adjust`, {
        method: 'POST',
        body: JSON.stringify({
          amount: adjustType === 'debit' ? -amt : amt,
          reason: adjustReason.trim(),
        }),
      });
      setAdjustUserId(null);
      setAdjustAmount('');
      setAdjustReason('');
      fetchWallets();
    } catch (err) {
      alert('Adjustment failed: ' + (err.message || 'Unknown error'));
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div className="admin-tab-content">
      <div className="admin-tab-header">
        <h2>Wallet Management</h2>
        <span className="admin-count-badge">{total} users with balance</span>
      </div>

      <div className="admin-filters">
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', minWidth: '250px' }}
        />
        <button onClick={fetchWallets} className="btn btn-ghost btn-sm">Refresh</button>
      </div>

      {/* Adjust modal */}
      {adjustUserId && (
        <div style={{ background: '#f0f9ff', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #bae6fd' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0 }}>Adjust Wallet Balance</h3>
            <button onClick={() => setAdjustUserId(null)} className="btn btn-ghost btn-sm">✕ Cancel</button>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Type</label>
              <select value={adjustType} onChange={e => setAdjustType(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                <option value="credit">Credit (add funds)</option>
                <option value="debit">Debit (remove funds)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Amount ($)</label>
              <input type="number" min="0.01" step="0.01" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', width: '120px' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Reason</label>
              <input type="text" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="Admin credit / correction / etc."
                style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', width: '100%' }} />
            </div>
            <button onClick={handleAdjust} disabled={adjusting} className="btn btn-primary btn-sm">
              {adjusting ? 'Applying…' : 'Apply'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="admin-loading">Loading wallets…</div>
      ) : wallets.length === 0 ? (
        <div className="admin-empty">No wallets with balance found.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Balance</th>
                <th>Credits</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {wallets.map(w => (
                <tr key={w._id}>
                  <td>{w.firstName} {w.lastName}</td>
                  <td>{w.email}</td>
                  <td style={{ fontWeight: 600, color: w.balance > 0 ? '#16a34a' : '#6b7280' }}>
                    ${w.balance?.toFixed(2)}
                  </td>
                  <td>{w.creditCount}</td>
                  <td>
                    <button onClick={() => { setAdjustUserId(w._id); setAdjustAmount(''); setAdjustReason(''); }} className="btn btn-ghost btn-sm">
                      Adjust
                    </button>
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

export default AdminWalletsTab;
