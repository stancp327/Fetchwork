import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import './AIPreferences.css';

const AUDIENCE_FILTER = { client: ['client', 'both'], freelancer: ['freelancer', 'both'] };

export default function AIPreferences({ userRole = 'both' }) {
  const [features, setFeatures] = useState([]);
  const [aiFeatures, setAiFeatures] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiRequest('/api/ai-settings/me');
      setFeatures(data.features || []);
      setAiFeatures(data.aiFeatures || {});
    } catch (err) {
      console.error('Failed to load AI preferences', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (key) => {
    setAiFeatures(prev => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await apiRequest('/api/ai-settings/me', {
        method: 'PUT',
        body: JSON.stringify({ aiFeatures }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      alert('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  // Filter to features relevant to this user's role
  const relevant = features.filter(f => {
    const allowed = AUDIENCE_FILTER[userRole] || ['client', 'freelancer', 'both'];
    return allowed.includes(f.audience);
  });

  const enabledCount = relevant.filter(f => aiFeatures[f.key] !== false).length;

  if (loading) return <div className="aip-loading">Loading AI preferences…</div>;

  return (
    <div className="aip-root">
      <div className="aip-header">
        <div>
          <h3 className="aip-title">✨ AI Features</h3>
          <p className="aip-subtitle">{enabledCount}/{relevant.length} features enabled for you</p>
        </div>
        <button className="aip-save-btn" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>

      <p className="aip-desc">
        Control which AI features appear in your Fetchwork experience. Disabling a feature just hides it — you can re-enable anytime.
      </p>

      <div className="aip-list">
        {relevant.map(f => {
          const isOn = aiFeatures[f.key] !== false;
          return (
            <div key={f.key} className={`aip-item ${isOn ? 'on' : 'off'}`}>
              <div className="aip-item-info">
                <div className="aip-item-name">{f.name}</div>
                <div className="aip-item-desc">{f.description}</div>
                <div className="aip-item-location">📍 {f.location}</div>
              </div>
              <label className="aip-toggle">
                <input type="checkbox" checked={isOn} onChange={() => toggle(f.key)} />
                <span className="aip-toggle-slider" />
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
