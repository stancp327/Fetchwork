import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';

const FEATURE_LABELS = {
  recurring_services:   { label: 'Recurring Services',     desc: 'Weekly/monthly service offerings', tier: 'Plus+', tierColor: 'blue' },
  bundle_creation:      { label: 'Session Bundles',        desc: 'Prepaid session packages on services', tier: 'Plus+', tierColor: 'blue' },
  bundle_expiration:    { label: 'Bundle Expiration Rules',desc: 'Set expiry on session bundles', tier: 'Pro', tierColor: 'purple' },
  booking_calendar:     { label: 'Booking Calendar',       desc: 'Scheduling & availability management', tier: 'Plus+', tierColor: 'blue' },
  intake_forms:         { label: 'Intake Forms',           desc: 'Custom intake forms on listings', tier: 'Plus+', tierColor: 'blue' },
  deposits:             { label: 'Deposits',               desc: 'Require deposits on bookings', tier: 'Pro', tierColor: 'purple' },
  travel_fees:          { label: 'Travel Fees',            desc: 'Add travel fee to local services', tier: 'Pro', tierColor: 'purple' },
  repeat_client_tools:  { label: 'Repeat Client Tools',    desc: 'Client management & rebooking', tier: 'Free', tierColor: 'gray' },
  capacity_controls:    { label: 'Capacity Controls',      desc: 'Max clients per day/week limits', tier: 'Plus+', tierColor: 'blue' },
  faster_payout:        { label: 'Faster Payout',          desc: 'Priority payout processing', tier: 'Plus+', tierColor: 'blue' },
  advanced_analytics:   { label: 'Advanced Analytics',     desc: 'Full analytics suite & insights', tier: 'Pro', tierColor: 'purple' },
  csv_export:           { label: 'CSV Export',             desc: 'Export earnings & data to CSV', tier: 'Plus+', tierColor: 'blue' },
  saved_providers:      { label: 'Saved Providers',        desc: 'Save favourite freelancers', tier: 'Client Plus+', tierColor: 'blue' },
  job_templates:        { label: 'Job Templates',          desc: 'Reusable job post templates', tier: 'Client Plus+', tierColor: 'blue' },
  proposal_comparison:  { label: 'Proposal Comparison',    desc: 'Side-by-side proposal view', tier: 'Client Plus+', tierColor: 'blue' },
  spend_dashboard:      { label: 'Spend Dashboard',        desc: 'Full spend tracking & reporting', tier: 'Business', tierColor: 'orange' },
  team_accounts:        { label: 'Team Accounts',          desc: 'Multiple logins per organisation', tier: 'Business', tierColor: 'orange' },
  beta_access:          { label: 'Beta Access',            desc: 'Early access to new features', tier: 'Admin grant', tierColor: 'red' },
  unlimited_services:   { label: 'Unlimited Services',     desc: 'No service listing count cap', tier: 'Admin grant', tierColor: 'red' },
  unlimited_jobs:       { label: 'Unlimited Job Posts',    desc: 'No active job count cap', tier: 'Admin grant', tierColor: 'red' },
};

const TIER_COLORS = {
  blue:   { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  purple: { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe' },
  orange: { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
  red:    { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  gray:   { bg: '#f9fafb', text: '#4b5563', border: '#e5e7eb' },
};

function TierBadge({ tier, tierColor = 'gray' }) {
  const c = TIER_COLORS[tierColor] || TIER_COLORS.gray;
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 7px',
      borderRadius: '999px',
      fontSize: '10px',
      fontWeight: 600,
      letterSpacing: '0.02em',
      background: c.bg,
      color: c.text,
      border: `1px solid ${c.border}`,
      whiteSpace: 'nowrap',
    }}>
      {tier}
    </span>
  );
}

export default function FeatureFlagsPanel({ userId }) {
  const [featureData, setFeatureData] = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState('');
  const [msg,         setMsg]         = useState({ text: '', type: 'success' });

  const [grantFeature, setGrantFeature] = useState('');
  const [grantEnabled, setGrantEnabled] = useState(true);
  const [grantReason,  setGrantReason]  = useState('');
  const [grantExpiry,  setGrantExpiry]  = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`/api/admin/users/${userId}/features`);
      setFeatureData(data);
    } catch (err) {
      setMsg({ text: 'Failed to load features: ' + (err.message || 'Unknown'), type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const flash = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: 'success' }), 3500);
  };

  const handleGrant = async () => {
    if (!grantFeature) return;
    setSaving('grant');
    try {
      await apiRequest(`/api/admin/users/${userId}/features`, {
        method: 'POST',
        body: JSON.stringify({ feature: grantFeature, enabled: grantEnabled, reason: grantReason, expiresAt: grantExpiry || null }),
      });
      flash(`${grantEnabled ? '✅ Granted' : '🚫 Revoked'}: ${FEATURE_LABELS[grantFeature]?.label || grantFeature}`);
      setGrantFeature(''); setGrantReason(''); setGrantExpiry('');
      load();
    } catch (err) {
      flash('❌ ' + (err.message || 'Failed'), 'error');
    } finally {
      setSaving('');
    }
  };

  const handleRemove = async (feature) => {
    if (!window.confirm(`Remove override for "${FEATURE_LABELS[feature]?.label || feature}"?\nUser will revert to plan default.`)) return;
    setSaving(feature);
    try {
      await apiRequest(`/api/admin/users/${userId}/features/${feature}`, { method: 'DELETE' });
      flash('Override removed — reverted to plan default');
      load();
    } catch (err) {
      flash('❌ ' + (err.message || 'Failed'), 'error');
    } finally {
      setSaving('');
    }
  };

  if (loading) return <div className="ffp-loading">Loading feature flags…</div>;

  const grants   = featureData?.grants   || [];
  const resolved = featureData?.resolved || {};
  const available = featureData?.availableFeatures || Object.keys(FEATURE_LABELS);
  const grantedFeatures = grants.reduce((acc, g) => { acc[g.feature] = g; return acc; }, {});

  // Group resolved by access
  const hasAccess = Object.entries(resolved).filter(([, v]) => v);
  const noAccess  = Object.entries(resolved).filter(([, v]) => !v);

  return (
    <div className="ffp-root">
      {msg.text && (
        <div className={`ffp-msg ffp-msg-${msg.type}`}>{msg.text}</div>
      )}

      {/* Active overrides */}
      {grants.length > 0 && (
        <div className="ffp-section">
          <div className="ffp-section-header">
            <span className="ffp-section-title">Active Overrides</span>
            <span className="ffp-badge-count">{grants.length}</span>
          </div>
          <div className="ffp-grants-list">
            {grants.map(g => {
              const meta = FEATURE_LABELS[g.feature];
              return (
                <div key={g.feature} className={`ffp-grant-card ${g.enabled ? 'granted' : 'revoked'}`}>
                  <div className="ffp-grant-left">
                    <span className="ffp-grant-icon">{g.enabled ? '✅' : '🚫'}</span>
                    <div>
                      <div className="ffp-grant-name">{meta?.label || g.feature}</div>
                      <div className="ffp-grant-meta">
                        {g.reason && <span>"{g.reason}"</span>}
                        {g.expiresAt && <span>· Expires {new Date(g.expiresAt).toLocaleDateString()}</span>}
                        {g.grantedBy && <span>· by {g.grantedBy.firstName} {g.grantedBy.lastName}</span>}
                      </div>
                    </div>
                  </div>
                  <button
                    className="ffp-remove-btn"
                    onClick={() => handleRemove(g.feature)}
                    disabled={saving === g.feature}
                  >
                    {saving === g.feature ? '…' : 'Remove'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add override form */}
      <div className="ffp-section ffp-add-section">
        <div className="ffp-section-header">
          <span className="ffp-section-title">Add Override</span>
        </div>
        <div className="ffp-form-row">
          <select value={grantFeature} onChange={e => setGrantFeature(e.target.value)} className="ffp-select">
            <option value="">— Select feature —</option>
            {available.map(f => (
              <option key={f} value={f}>{FEATURE_LABELS[f]?.label || f}</option>
            ))}
          </select>
          <select
            value={String(grantEnabled)}
            onChange={e => setGrantEnabled(e.target.value === 'true')}
            className={`ffp-select-type ${grantEnabled ? 'grant' : 'revoke'}`}
          >
            <option value="true">✅ Grant</option>
            <option value="false">🚫 Revoke</option>
          </select>
        </div>
        <div className="ffp-form-row">
          <input
            type="text"
            value={grantReason}
            onChange={e => setGrantReason(e.target.value)}
            placeholder="Reason (e.g. CS goodwill, beta tester)"
            className="ffp-input"
          />
          <input
            type="date"
            value={grantExpiry}
            onChange={e => setGrantExpiry(e.target.value)}
            className="ffp-input-date"
            title="Optional expiry date"
          />
        </div>
        <button
          onClick={handleGrant}
          disabled={!grantFeature || saving === 'grant'}
          className={`ffp-submit-btn ${grantEnabled ? 'grant' : 'revoke'}`}
        >
          {saving === 'grant' ? 'Saving…' : grantEnabled ? '✅ Grant Feature' : '🚫 Revoke Feature'}
        </button>
      </div>

      {/* Resolved access grid */}
      <div className="ffp-section">
        <div className="ffp-section-header">
          <span className="ffp-section-title">Resolved Access</span>
          <span className="ffp-resolved-counts">
            <span className="ffp-count-has">{hasAccess.length} granted</span>
            <span className="ffp-count-no">{noAccess.length} denied</span>
          </span>
        </div>
        <div className="ffp-resolved-grid">
          {[...hasAccess, ...noAccess].map(([feature, access]) => {
            const meta = FEATURE_LABELS[feature];
            const isOverridden = !!grantedFeatures[feature];
            return (
              <div key={feature} className={`ffp-resolved-item ${access ? 'has' : 'no'} ${isOverridden ? 'override' : ''}`}>
                <span className="ffp-resolved-icon">{access ? '✅' : '⬜'}</span>
                <div className="ffp-resolved-body">
                  <div className="ffp-resolved-top">
                    <span className="ffp-resolved-name">{meta?.label || feature}</span>
                    {isOverridden && <span className="ffp-override-pill">override</span>}
                  </div>
                  <div className="ffp-resolved-bottom">
                    <span className="ffp-resolved-desc">{meta?.desc || ''}</span>
                    {meta && <TierBadge tier={meta.tier} tierColor={meta.tierColor} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
