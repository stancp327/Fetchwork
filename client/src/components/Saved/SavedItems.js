import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import { getCategoryLabel } from '../../utils/categories';
import { formatBudget } from '../../utils/formatters';
import './SavedItems.css';

const FILTERS = [
  { key: 'all',        label: 'All' },
  { key: 'freelancer', label: '👤 Freelancers' },
  { key: 'job',        label: '📋 Jobs' },
  { key: 'service',    label: '🛒 Services' },
];

const ICONS = { freelancer: '👤', job: '📋', service: '🛒' };

const SavedItems = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetchItems = useCallback(async () => {
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

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const unsave = async (itemId) => {
    await apiRequest(`/api/saved/${itemId}`, { method: 'DELETE' });
    setItems(prev => prev.filter(s => s.item?._id !== itemId));
  };

  const getItemLink = (s) => {
    if (s.itemType === 'freelancer') return `/freelancers/${s.item._id}`;
    if (s.itemType === 'job') return `/jobs/${s.item._id}`;
    return `/services/${s.item._id}`;
  };

  const getItemMeta = (s) => {
    const item = s.item;
    let detail = '';
    if (s.itemType === 'freelancer') detail = item.headline || '';
    if (s.itemType === 'job') detail = `${getCategoryLabel(item.category)} • ${formatBudget(item.budget)}`;
    if (s.itemType === 'service') detail = `From $${item.pricing?.basic?.price || '—'}`;
    const saved = new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${detail}${detail ? ' • ' : ''}Saved ${saved}`;
  };

  return (
    <div className="si-saved-page">
      <h1>❤️ Saved Items</h1>

      <div className="si-saved-filters">
        {FILTERS.map(f => (
          <button
            key={f.key}
            className={`si-saved-filter-btn${filter === f.key ? ' active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: '#6b7280' }}>Loading...</p>
      ) : items.length === 0 ? (
        <div className="si-saved-empty">
          <div className="si-saved-empty-icon">❤️</div>
          <p>No saved items yet</p>
          <p className="si-saved-empty-sub">Browse freelancers, jobs, and services to start saving</p>
        </div>
      ) : (
        <div className="si-saved-list">
          {items.map(s => {
            const item = s.item;
            if (!item) return null;
            return (
              <div key={s._id} className="si-saved-item">
                <Link to={getItemLink(s)} className="si-saved-item-link">
                  <span className="si-saved-item-icon">{ICONS[s.itemType] || '📌'}</span>
                  <div className="si-saved-item-body">
                    <div className="si-saved-item-title">
                      {item.title || `${item.firstName} ${item.lastName}`}
                    </div>
                    <div className="si-saved-item-meta">{getItemMeta(s)}</div>
                  </div>
                </Link>
                <button
                  className="si-saved-item-remove"
                  onClick={() => unsave(item._id)}
                  title="Remove from saved"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SavedItems;
