import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import SEO from '../common/SEO';
import './JobAlertsPage.css';

const FREQ_LABELS = { instant: '⚡ Instant', daily: '📅 Daily' };

const JobAlertsPage = () => {
  const [alerts,  setAlerts]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/api/job-alerts');
      setAlerts(data || []);
    } catch (err) {
      setError('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleAlert = async (id, active) => {
    try {
      const updated = await apiRequest(`/api/job-alerts/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ active }),
      });
      setAlerts(prev => prev.map(a => a._id === id ? updated : a));
    } catch (err) {
      alert(err.data?.error || 'Failed to update alert');
    }
  };

  const deleteAlert = async (id) => {
    if (!window.confirm('Delete this alert?')) return;
    try {
      await apiRequest(`/api/job-alerts/${id}`, { method: 'DELETE' });
      setAlerts(prev => prev.filter(a => a._id !== id));
    } catch (err) {
      alert(err.data?.error || 'Failed to delete alert');
    }
  };

  const renderFilters = (filters = {}) => {
    const parts = [
      filters.category && `Category: ${filters.category}`,
      filters.keywords && `"${filters.keywords}"`,
      (filters.budgetMin || filters.budgetMax) &&
        `$${filters.budgetMin || 0}–$${filters.budgetMax || '∞'}`,
      filters.location && `📍 ${filters.location}`,
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'All new jobs';
  };

  return (
    <div className="ja-page">
      <SEO title="Job Alerts" path="/job-alerts" noIndex={true} />

      <div className="ja-header">
        <div>
          <h1 className="ja-title">Job Alerts</h1>
          <p className="ja-sub">Get notified when new jobs match your criteria.</p>
        </div>
        <Link to="/jobs" className="ja-browse-btn">Browse Jobs →</Link>
      </div>

      {loading && (
        <div className="ja-loading">
          {[...Array(3)].map((_, i) => <div key={i} className="ja-skeleton" />)}
        </div>
      )}

      {!loading && error && <p className="ja-error">{error}</p>}

      {!loading && !error && alerts.length === 0 && (
        <div className="ja-empty">
          <span>🔔</span>
          <h3>No job alerts yet</h3>
          <p>
            Go to <Link to="/jobs">Browse Jobs</Link>, apply filters, and click
            <strong> 🔔 Save Search</strong> to create your first alert.
          </p>
        </div>
      )}

      {!loading && alerts.length > 0 && (
        <div className="ja-list">
          {alerts.map(alert => (
            <div key={alert._id} className={`ja-card ${!alert.active ? 'ja-card-off' : ''}`}>
              <div className="ja-card-main">
                <div className="ja-card-name">{alert.name}</div>
                <div className="ja-card-filters">{renderFilters(alert.filters)}</div>
                <div className="ja-card-meta">
                  {FREQ_LABELS[alert.frequency] || alert.frequency}
                  {alert.lastTriggered && ` · Last triggered ${new Date(alert.lastTriggered).toLocaleDateString()}`}
                </div>
              </div>
              <div className="ja-card-actions">
                <label className="ja-toggle" title={alert.active ? 'Pause alert' : 'Enable alert'}>
                  <input
                    type="checkbox"
                    checked={alert.active}
                    onChange={e => toggleAlert(alert._id, e.target.checked)}
                  />
                  <span className="ja-toggle-track" />
                </label>
                <button className="ja-delete" onClick={() => deleteAlert(alert._id)} aria-label="Delete">🗑</button>
              </div>
            </div>
          ))}
          <p className="ja-count">{alerts.length}/10 alerts used</p>
        </div>
      )}
    </div>
  );
};

export default JobAlertsPage;
