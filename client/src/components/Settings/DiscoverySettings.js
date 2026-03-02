import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import { CATEGORIES } from '../../utils/categories';
import SEO from '../common/SEO';
import './DiscoverySettings.css';

const DiscoverySettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError]     = useState(null);

  // Discovery preferences
  const [enabled, setEnabled]           = useState(false);
  const [notifyJobs, setNotifyJobs]     = useState(true);
  const [notifyServices, setNotifyServices] = useState(true);
  const [notifyClasses, setNotifyClasses]   = useState(true);
  const [categories, setCategories]     = useState([]);
  const [frequency, setFrequency]       = useState('daily');

  // User interests
  const [interests, setInterests]     = useState('');
  const [lookingFor, setLookingFor]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/api/users/me/discovery');
      const d = res.discovery || {};
      setEnabled(d.enabled || false);
      setNotifyJobs(d.notifyJobs ?? true);
      setNotifyServices(d.notifyServices ?? true);
      setNotifyClasses(d.notifyClasses ?? true);
      setCategories(d.categories || []);
      setFrequency(d.frequency || 'daily');
      setInterests((res.interests || []).join(', '));
      setLookingFor((res.lookingFor || []).join(', '));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleCategory = (catId) => {
    setCategories(prev =>
      prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]
    );
  };

  const handleSave = async () => {
    setSaving(true); setError(null); setSuccess('');
    try {
      // Save discovery preferences
      await apiRequest('/api/users/me/discovery', {
        method: 'PUT',
        body: JSON.stringify({ enabled, notifyJobs, notifyServices, notifyClasses, categories, frequency }),
      });

      // Save interests via profile update
      await apiRequest('/api/users/profile', {
        method: 'PUT',
        body: JSON.stringify({
          interests: interests.split(',').map(s => s.trim()).filter(Boolean),
          lookingFor: lookingFor.split(',').map(s => s.trim()).filter(Boolean),
        }),
      });

      setSuccess('Settings saved!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="ds-loading">Loading settings...</div>;

  return (
    <div className="ds-page">
      <SEO title="Discovery Settings | Fetchwork" noIndex />

      <div className="ds-header">
        <h1 className="ds-title">🔔 Discovery & Notifications</h1>
        <p className="ds-subtitle">Control what jobs, services, and classes you get notified about</p>
      </div>

      {error && <div className="ds-error">{error}</div>}
      {success && <div className="ds-success">{success}</div>}

      {/* Master toggle */}
      <div className="ds-section">
        <div className="ds-toggle-row">
          <label className="ds-toggle">
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
            <span className="ds-toggle-slider" />
          </label>
          <div>
            <strong>Enable Discovery Notifications</strong>
            <p className="ds-hint">Get notified about new jobs, services, and classes that match your interests</p>
          </div>
        </div>
      </div>

      {enabled && (
        <>
          {/* What to notify about */}
          <div className="ds-section">
            <h3>What do you want to hear about?</h3>
            <div className="ds-checkbox-group">
              <label className="ds-checkbox">
                <input type="checkbox" checked={notifyJobs} onChange={e => setNotifyJobs(e.target.checked)} />
                💼 New jobs matching my interests
              </label>
              <label className="ds-checkbox">
                <input type="checkbox" checked={notifyServices} onChange={e => setNotifyServices(e.target.checked)} />
                ⭐ New services I might like
              </label>
              <label className="ds-checkbox">
                <input type="checkbox" checked={notifyClasses} onChange={e => setNotifyClasses(e.target.checked)} />
                📚 Classes and workshops
              </label>
            </div>
          </div>

          {/* Frequency */}
          <div className="ds-section">
            <h3>How often?</h3>
            <div className="ds-radio-group">
              {[
                { value: 'realtime', label: 'Real-time', desc: 'Instant notification when something matches' },
                { value: 'daily', label: 'Daily digest', desc: 'One summary per day' },
                { value: 'weekly', label: 'Weekly digest', desc: 'One summary per week' },
              ].map(opt => (
                <label key={opt.value} className={`ds-radio ${frequency === opt.value ? 'selected' : ''}`}>
                  <input type="radio" name="frequency" value={opt.value} checked={frequency === opt.value} onChange={() => setFrequency(opt.value)} />
                  <div>
                    <strong>{opt.label}</strong>
                    <p>{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Category filter */}
          <div className="ds-section">
            <h3>Categories {categories.length > 0 ? `(${categories.length} selected)` : '(all)'}</h3>
            <p className="ds-hint">Leave all unchecked to receive notifications for everything. Select specific categories to filter.</p>
            <div className="ds-cat-grid">
              {CATEGORIES.filter(c => c.id !== 'other').map(cat => (
                <button
                  key={cat.id}
                  className={`ds-cat-btn ${categories.includes(cat.id) ? 'selected' : ''}`}
                  onClick={() => toggleCategory(cat.id)}
                >
                  <span className="ds-cat-icon">{cat.icon}</span>
                  <span className="ds-cat-label">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Interests */}
          <div className="ds-section">
            <h3>Your Interests</h3>
            <p className="ds-hint">Help us match you with relevant content. Separate with commas.</p>
            <div className="ds-field">
              <label>Things I'm interested in</label>
              <input
                type="text"
                value={interests}
                onChange={e => setInterests(e.target.value)}
                placeholder="e.g. cooking, web design, fitness, photography"
              />
            </div>
            <div className="ds-field">
              <label>Skills / services I'm looking for</label>
              <input
                type="text"
                value={lookingFor}
                onChange={e => setLookingFor(e.target.value)}
                placeholder="e.g. personal trainer, house cleaning, logo design"
              />
            </div>
          </div>
        </>
      )}

      <button className="ds-save-btn" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : '💾 Save Settings'}
      </button>
    </div>
  );
};

export default DiscoverySettings;
