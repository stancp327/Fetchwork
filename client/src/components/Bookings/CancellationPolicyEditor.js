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

const HOUR_OPTIONS = [1, 2, 3, 4, 5, 6, 12, 24, 48, 72];
const REFUND_OPTIONS = [0, 25, 50, 75, 100];

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

  // Auto-save helper
  const autoSave = async (newType, rules) => {
    setSaving(true);
    try {
      await apiRequest('/api/bookings/cancellation-policy', {
        method: 'PUT',
        body: JSON.stringify({
          type: newType,
          serviceId: serviceId || undefined,
          rulesJson: newType === 'custom' ? rules : undefined,
        }),
      });
      showFlash('✓ Saved');
    } catch (err) {
      showFlash(err.message || 'Failed to save policy.', true);
    } finally {
      setSaving(false);
    }
  };

  const handleTypeChange = (newType) => {
    setType(newType);
    autoSave(newType, newType === 'custom' ? customRules : undefined);
  };

  const updateRule = (i, field, value) => {
    setCustomRules(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: Number(value) };
      autoSave('custom', next);
      return next;
    });
  };

  const addRule = () => {
    setCustomRules(prev => {
      const next = [...prev, { hoursBeforeStart: 0, refundPercent: 0 }];
      autoSave('custom', next);
      return next;
    });
  };

  const removeRule = (i) => {
    setCustomRules(prev => {
      const next = prev.filter((_, idx) => idx !== i);
      autoSave('custom', next);
      return next;
    });
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
              onChange={() => handleTypeChange(pt.value)}
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
                <select
                  className="cpe-rule-select"
                  value={rule.hoursBeforeStart}
                  onChange={e => updateRule(i, 'hoursBeforeStart', e.target.value)}
                  aria-label="Hours before start"
                >
                  <option value={0}>At booking time</option>
                  {HOUR_OPTIONS.map(h => (
                    <option key={h} value={h}>{h} hr{h !== 1 ? 's' : ''} before</option>
                  ))}
                </select>
                <select
                  className="cpe-rule-select"
                  value={rule.refundPercent}
                  onChange={e => updateRule(i, 'refundPercent', e.target.value)}
                  aria-label="Refund percent"
                >
                  {REFUND_OPTIONS.map(p => (
                    <option key={p} value={p}>{p}% refund</option>
                  ))}
                </select>
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

      {saving && <span className="cpe-saving">Saving…</span>}
    </div>
  );
};

export default CancellationPolicyEditor;
