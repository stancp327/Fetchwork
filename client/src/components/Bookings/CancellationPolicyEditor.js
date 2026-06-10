import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';
import './CancellationPolicyEditor.css';

const PRESET_TYPES = [
  {
    value:   'flexible',
    label:   'Flexible',
    desc:    'Full refund up to 2 hours before · 50% refund after that',
    color:   'green',
  },
  {
    value:   'moderate',
    label:   'Moderate',
    desc:    'Full refund 24h+ before · 50% refund 12–24h · No refund within 12h',
    color:   'yellow',
  },
  {
    value:   'strict',
    label:   'Strict',
    desc:    'Full refund 48h+ before · 50% refund 24–48h · No refund within 24h',
    color:   'red',
  },
  {
    value:   'custom',
    label:   'Custom',
    desc:    'Define your own refund tiers',
    color:   'gray',
  },
];

const DEFAULT_CUSTOM_RULES = [
  { hoursBeforeStart: 24, refundPercent: 100 },
  { hoursBeforeStart: 0,  refundPercent: 0   },
];

const CancellationPolicyEditor = ({ serviceId }) => {
  const { user } = useAuth();
  const [type,        setType]        = useState('moderate');
  const [customRules, setCustomRules] = useState(DEFAULT_CUSTOM_RULES);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [flash,       setFlash]       = useState('');
  const [error,       setError]       = useState('');

  // Load existing policy on mount
  useEffect(() => {
    if (!user) return;
    const qs = serviceId ? `?serviceId=${serviceId}` : '';
    apiRequest(`/api/bookings/cancellation-policy/${user._id || user.userId}${qs}`)
      .then(data => {
        const p = data.policy;
        setType(p.type || 'moderate');
        if (p.type === 'custom' && Array.isArray(p.rulesJson) && p.rulesJson.length) {
          setCustomRules(p.rulesJson);
        }
      })
      .catch(() => {}) // fall back to defaults
      .finally(() => setLoading(false));
  }, [user, serviceId]);

  const showFlash = (msg, isError = false) => {
    isError ? setError(msg) : setFlash(msg);
    setTimeout(() => { setFlash(''); setError(''); }, 4000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiRequest('/api/bookings/cancellation-policy', {
        method: 'PUT',
        body: JSON.stringify({
          type,
          serviceId: serviceId || undefined,
          rulesJson: type === 'custom' ? customRules : undefined,
        }),
      });
      showFlash('Policy saved.');
    } catch (err) {
      showFlash(err.message || 'Failed to save policy.', true);
    } finally {
      setSaving(false);
    }
  };

  const updateRule = (i, field, value) => {
    setCustomRules(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: Number(value) };
      return next;
    });
  };

  const addRule = () => {
    setCustomRules(prev => [...prev, { hoursBeforeStart: 0, refundPercent: 0 }]);
  };

  const removeRule = (i) => {
    setCustomRules(prev => prev.filter((_, idx) => idx !== i));
  };

  if (loading) {
    return <div className="cpe-loading">Loading policy…</div>;
  }

  return (
    <div className="cpe">
      <h3 className="cpe-title">Cancellation Policy</h3>
      <p className="cpe-desc">
        Set how much clients receive when they cancel a booking with you.
        {serviceId ? ' This applies to this service only.' : ' This applies to all your services.'}
      </p>

      {flash && <div className="cpe-flash">{flash}</div>}
      {error && <div className="cpe-error">{error}</div>}

      <div className="cpe-types">
        {PRESET_TYPES.map(pt => (
          <label
            key={pt.value}
            className={`cpe-type-card ${type === pt.value ? 'selected' : ''} cpe-color-${pt.color}`}
          >
            <input
              type="radio"
              name="policyType"
              value={pt.value}
              checked={type === pt.value}
              onChange={() => setType(pt.value)}
              className="cpe-radio"
            />
            <div className="cpe-type-body">
              <span className="cpe-type-label">{pt.label}</span>
              <span className="cpe-type-desc">{pt.desc}</span>
            </div>
          </label>
        ))}
      </div>

      {type === 'custom' && (
        <div className="cpe-custom">
          <p className="cpe-custom-hint">
            Rules are checked in order. Each rule applies when hours until start ≥ the threshold.
          </p>
          <div className="cpe-rules-table">
            <div className="cpe-rules-head">
              <span>Hours before start</span>
              <span>Refund %</span>
              <span />
            </div>
            {customRules.map((rule, i) => (
              <div key={i} className="cpe-rule-row">
                <input
                  type="number"
                  className="cpe-rule-input"
                  value={rule.hoursBeforeStart}
                  min="0"
                  max="720"
                  onChange={e => updateRule(i, 'hoursBeforeStart', e.target.value)}
                  aria-label="Hours before start"
                />
                <input
                  type="number"
                  className="cpe-rule-input"
                  value={rule.refundPercent}
                  min="0"
                  max="100"
                  onChange={e => updateRule(i, 'refundPercent', e.target.value)}
                  aria-label="Refund percent"
                />
                <button
                  className="cpe-rule-remove"
                  onClick={() => removeRule(i)}
                  aria-label="Remove rule"
                  disabled={customRules.length <= 1}
                >
                  ✕
                </button>
              </div>
            ))}
            <button className="cpe-add-rule" onClick={addRule}>
              + Add rule
            </button>
          </div>
        </div>
      )}

      <button
        className="cpe-save"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? 'Saving…' : 'Save Policy'}
      </button>
    </div>
  );
};

export default CancellationPolicyEditor;
