import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import './AdminAISettingsTab.css';

const TIER_COLORS = { free: '#10b981', plus: '#2563eb', pro: '#7c3aed' };
const AUDIENCE_ICONS = { client: '🏢', freelancer: '👤', both: '👥' };

export default function AdminAISettingsTab() {
  const [features, setFeatures] = useState([]);
  const [platformState, setPlatformState] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [masterOn, setMasterOn] = useState(true);
  const [filter, setFilter] = useState('all'); // all | free | plus | pro

  const load = useCallback(async () => {
    try {
      const data = await apiRequest('/api/ai-settings/platform');
      setFeatures(data.features || []);
      setPlatformState(data.platformState || {});
      const allOn = Object.values(data.platformState || {}).every(v => v === true);
      setMasterOn(allOn);
    } catch (err) {
      console.error('Failed to load AI settings', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (key) => {
    setPlatformState(prev => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  };

  const toggleMaster = (on) => {
    setMasterOn(on);
    setPlatformState(prev => Object.fromEntries(Object.keys(prev).map(k => [k, on])));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await apiRequest('/api/ai-settings/platform', {
        method: 'PUT',
        body: JSON.stringify({ platformState }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      alert('Failed to save: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const filtered = features.filter(f => filter === 'all' || f.tier === filter);
  const enabledCount = Object.values(platformState).filter(Boolean).length;

  if (loading) return <div className="ais-loading">Loading AI settings…</div>;

  return (
    <div className="ais-root">
      {/* Header */}
      <div className="ais-header">
        <div className="ais-header-left">
          <h2 className="ais-title">✨ AI Features</h2>
          <p className="ais-subtitle">{enabledCount}/{features.length} features enabled platform-wide</p>
        </div>
        <div className="ais-header-right">
          <div className="ais-master-toggle">
            <span className="ais-master-label">Master switch</span>
            <button
              className={`ais-master-btn ${masterOn ? 'on' : 'off'}`}
              onClick={() => toggleMaster(!masterOn)}
            >
              {masterOn ? '✅ All ON' : '❌ All OFF'}
            </button>
          </div>
          <button className="ais-save-btn" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Cost notice */}
      <div className="ais-notice">
        💡 All AI features use your <strong>OPENAI_API_KEY</strong> (gpt-4o-mini). Disabling features here hides the UI and skips the API call entirely — reducing cost.
      </div>

      {/* Filter */}
      <div className="ais-filter-bar">
        {['all', 'free', 'plus', 'pro'].map(t => (
          <button
            key={t}
            className={`ais-filter-btn ${filter === t ? 'active' : ''}`}
            onClick={() => setFilter(t)}
          >
            {t === 'all' ? 'All tiers' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Feature grid */}
      <div className="ais-grid">
        {filtered.map(f => {
          const isOn = platformState[f.key] !== false;
          return (
            <div key={f.key} className={`ais-card ${isOn ? 'on' : 'off'}`}>
              <div className="ais-card-top">
                <div className="ais-card-name">{f.name}</div>
                <label className="ais-toggle">
                  <input
                    type="checkbox"
                    checked={isOn}
                    onChange={() => toggle(f.key)}
                  />
                  <span className="ais-toggle-slider" />
                </label>
              </div>
              <div className="ais-card-desc">{f.description}</div>
              <div className="ais-card-meta">
                <span className="ais-tier-badge" style={{ background: TIER_COLORS[f.tier] }}>{f.tier}</span>
                <span className="ais-audience">{AUDIENCE_ICONS[f.audience]} {f.audience}</span>
                <span className="ais-location">📍 {f.location}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
