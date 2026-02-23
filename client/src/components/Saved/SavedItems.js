import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import { getLocationDisplay } from '../../utils/location';
import { getCategoryLabel } from '../../utils/categories';
import { formatBudget } from '../../utils/formatters';

const SavedItems = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? `?type=${filter}` : '';
      const data = await apiRequest(`/api/saved${params}`);
      setItems(data.saved || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetch(); }, [fetch]);

  const unsave = async (itemId) => {
    await apiRequest(`/api/saved/${itemId}`, { method: 'DELETE' });
    setItems(prev => prev.filter(s => s.item?._id !== itemId));
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.5rem' }}>
      <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.5rem' }}>❤️ Saved Items</h1>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {['all', 'freelancer', 'job', 'service'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '0.4rem 0.85rem', borderRadius: 20,
            border: '1px solid ' + (filter === f ? '#2563eb' : '#d1d5db'),
            background: filter === f ? '#eff6ff' : 'white',
            color: filter === f ? '#2563eb' : '#374151',
            fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer'
          }}>
            {f === 'all' ? 'All' : f === 'freelancer' ? '👤 Freelancers' : f === 'job' ? '📋 Jobs' : '🛒 Services'}
          </button>
        ))}
      </div>

      {loading ? <p>Loading...</p> : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>❤️</div>
          <p>No saved items yet</p>
          <p style={{ fontSize: '0.85rem' }}>Browse freelancers, jobs, and services to start saving</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {items.map(s => {
            const item = s.item;
            if (!item) return null;
            const link = s.itemType === 'freelancer' ? `/freelancers/${item._id}` :
              s.itemType === 'job' ? `/jobs/${item._id}` : `/services/${item._id}`;

            return (
              <div key={s._id} style={{
                background: 'white', border: '1px solid #e5e7eb', borderRadius: 12,
                padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <Link to={link} style={{ textDecoration: 'none', color: 'inherit', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>
                      {s.itemType === 'freelancer' ? '👤' : s.itemType === 'job' ? '📋' : '🛒'}
                    </span>
                    <div>
                      <strong>{item.title || `${item.firstName} ${item.lastName}`}</strong>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                        {s.itemType === 'freelancer' && item.headline}
                        {s.itemType === 'job' && `${getCategoryLabel(item.category)} • ${formatBudget(item.budget)}`}
                        {s.itemType === 'service' && `From $${item.pricing?.basic?.price || '—'}`}
                        {' • Saved ' + new Date(s.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </Link>
                <button onClick={() => unsave(item._id)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0.5rem'
                }} title="Remove">✕</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SavedItems;
