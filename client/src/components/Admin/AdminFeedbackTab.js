import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';

const STATUS_COLORS = { new: '#2563eb', read: '#6b7280', actioned: '#10b981', closed: '#9ca3af' };
const CAT_ICONS = { bug: '🐛', suggestion: '💡', praise: '❤️', question: '❓', other: '💬' };

export default function AdminFeedbackTab() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('new');
  const [updating, setUpdating] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 100 });
      if (filter !== 'all') params.set('status', filter);
      const data = await apiRequest(`/api/feedback?${params}`);
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to load feedback', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id, status) => {
    setUpdating(id);
    try {
      await apiRequest(`/api/feedback/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
      setItems(prev => prev.map(i => i._id === id ? { ...i, status } : i));
    } catch { /* silent */ }
    finally { setUpdating(null); }
  };

  return (
    <div style={{ padding: '20px', maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800 }}>💬 User Feedback</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted, #6b7280)' }}>{total} total submissions</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['all', 'new', 'read', 'actioned', 'closed'].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              border: '1px solid var(--color-border, #e5e7eb)', borderRadius: 20,
              padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: filter === s ? 'var(--color-primary, #2563eb)' : 'white',
              color: filter === s ? 'white' : 'var(--color-text-secondary, #374151)',
            }}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--color-text-muted, #6b7280)', fontSize: 13 }}>Loading…</p>
      ) : items.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted, #6b7280)', fontSize: 13 }}>No feedback in this category.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map(item => (
            <div key={item._id} style={{
              border: '1px solid var(--color-border, #e5e7eb)',
              borderRadius: 10, padding: '14px 16px',
              background: item.status === 'new' ? 'var(--color-bg-primary, #fff)' : 'var(--color-bg-secondary, #f9fafb)',
              borderLeft: `4px solid ${STATUS_COLORS[item.status] || '#e5e7eb'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 16 }}>{CAT_ICONS[item.category] || '💬'}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted, #6b7280)' }}>{item.category}</span>
                    {item.page && <span style={{ fontSize: 11, color: 'var(--color-text-muted, #6b7280)', background: 'var(--color-bg-secondary, #f3f4f6)', padding: '2px 7px', borderRadius: 10 }}>📍 {item.page}</span>}
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted, #6b7280)' }}>{new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--color-text-primary, #111827)', lineHeight: 1.5 }}>{item.message}</p>
                  {(item.email || item.userId?.email) && (
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted, #6b7280)' }}>
                      From: {item.userId ? `${item.userId.firstName || ''} ${item.userId.lastName || ''}`.trim() || 'User' : 'Guest'} {item.email || item.userId?.email ? `(${item.email || item.userId?.email})` : ''}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                  {['read', 'actioned', 'closed'].map(s => s !== item.status && (
                    <button key={s} disabled={updating === item._id} onClick={() => updateStatus(item._id, s)} style={{
                      border: '1px solid var(--color-border, #e5e7eb)', borderRadius: 6,
                      padding: '3px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      background: 'white', color: 'var(--color-text-secondary, #374151)',
                    }}>
                      Mark {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
