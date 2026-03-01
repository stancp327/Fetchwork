import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';

const FEATURE_LABELS = {
  recurring_services:   { label: 'Recurring Services',     desc: 'Create weekly/monthly service offerings', tier: 'Plus+' },
  bundle_creation:      { label: 'Session Bundles',        desc: 'Add prepaid session packages to services', tier: 'Plus+' },
  bundle_expiration:    { label: 'Bundle Expiration Rules',desc: 'Set expiry on session bundles', tier: 'Pro' },
  booking_calendar:     { label: 'Booking Calendar',       desc: 'Scheduling & availability management', tier: 'Plus+' },
  intake_forms:         { label: 'Intake Forms',           desc: 'Custom intake forms on service listings', tier: 'Plus+' },
  deposits:             { label: 'Deposits',               desc: 'Require deposits on service bookings', tier: 'Pro' },
  travel_fees:          { label: 'Travel Fees',            desc: 'Add travel fee to local services', tier: 'Pro' },
  repeat_client_tools:  { label: 'Repeat Client Tools',    desc: 'Client management & rebooking tools', tier: 'Free' },
  capacity_controls:    { label: 'Capacity Controls',      desc: 'Max clients per day/week limits', tier: 'Plus+' },
  faster_payout:        { label: 'Faster Payout',          desc: 'Priority payout processing', tier: 'Plus+' },
  advanced_analytics:   { label: 'Advanced Analytics',     desc: 'Full analytics suite & insights', tier: 'Pro' },
  csv_export:           { label: 'CSV Export',             desc: 'Export earnings & data to CSV', tier: 'Plus+' },
  saved_providers:      { label: 'Saved Providers',        desc: 'Save and manage favourite freelancers', tier: 'Client Plus+' },
  job_templates:        { label: 'Job Templates',          desc: 'Reusable job post templates', tier: 'Client Plus+' },
  proposal_comparison:  { label: 'Proposal Comparison',    desc: 'Side-by-side proposal view', tier: 'Client Plus+' },
  spend_dashboard:      { label: 'Spend Dashboard',        desc: 'Full spend tracking & reporting', tier: 'Business' },
  team_accounts:        { label: 'Team Accounts',          desc: 'Multiple logins per organisation', tier: 'Business' },
  beta_access:          { label: 'Beta Access',            desc: 'Early access to new features', tier: 'Admin grant' },
  unlimited_services:   { label: 'Unlimited Services',     desc: 'No service listing count cap', tier: 'Admin grant' },
  unlimited_jobs:       { label: 'Unlimited Job Posts',    desc: 'No active job count cap', tier: 'Admin grant' },
};

export default function FeatureFlagsPanel({ userId }) {
  const [featureData, setFeatureData] = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState('');
  const [msg,         setMsg]         = useState('');

  // Form for adding/editing a grant
  const [grantFeature,   setGrantFeature]   = useState('');
  const [grantEnabled,   setGrantEnabled]   = useState(true);
  const [grantReason,    setGrantReason]    = useState('');
  const [grantExpiry,    setGrantExpiry]    = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`/api/admin/users/${userId}/features`);
      setFeatureData(data);
    } catch (err) {
      setMsg('Failed to load features: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const flash = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3500); };

  const handleGrant = async () => {
    if (!grantFeature) return;
    setSaving('grant');
    try {
      await apiRequest(`/api/admin/users/${userId}/features`, {
        method: 'POST',
        body: JSON.stringify({
          feature:   grantFeature,
          enabled:   grantEnabled,
          reason:    grantReason,
          expiresAt: grantExpiry || null,
        }),
      });
      flash(`${grantEnabled ? '✅ Granted' : '🚫 Revoked'}: ${FEATURE_LABELS[grantFeature]?.label || grantFeature}`);
      setGrantFeature(''); setGrantReason(''); setGrantExpiry('');
      load();
    } catch (err) {
      flash('❌ ' + (err.message || 'Failed'));
    } finally {
      setSaving('');
    }
  };

  const handleRemove = async (feature) => {
    if (!window.confirm(`Remove override for "${FEATURE_LABELS[feature]?.label || feature}"? User will revert to plan default.`)) return;
    setSaving(feature);
    try {
      await apiRequest(`/api/admin/users/${userId}/features/${feature}`, { method: 'DELETE' });
      flash(`🗑 Override removed — reverted to plan default`);
      load();
    } catch (err) {
      flash('❌ ' + (err.message || 'Failed'));
    } finally {
      setSaving('');
    }
  };

  if (loading) return <div className="ffp-loading">Loading feature flags...</div>;

  const grants   = featureData?.grants   || [];
  const resolved = featureData?.resolved || {};
  const available = featureData?.availableFeatures || Object.keys(FEATURE_LABELS);

  // Group features by active grant vs plan-resolved
  const grantedFeatures = grants.reduce((acc, g) => { acc[g.feature] = g; return acc; }, {});

  return (
    <div className="ffp-root">
      <h3 className="ffp-title">🚩 Feature Flags</h3>
      <p className="ffp-subtitle">
        Override plan-based feature access for this user. Individual grants take priority over group grants and plan defaults.
      </p>

      {msg && <div className="ffp-msg">{msg}</div>}

      {/* ── Active grants ─────────────────────────────────────── */}
      {grants.length > 0 && (
        <div className="ffp-grants-section">
          <h4>Active Overrides ({grants.length})</h4>
          {grants.map(g => (
            <div key={g.feature} className={`ffp-grant-row ${g.enabled ? 'enabled' : 'revoked'}`}>
              <div className="ffp-grant-info">
                <span className="ffp-grant-badge">{g.enabled ? '✅' : '🚫'}</span>
                <div>
                  <strong>{FEATURE_LABELS[g.feature]?.label || g.feature}</strong>
                  {g.reason && <span className="ffp-grant-reason"> — {g.reason}</span>}
                  {g.expiresAt && (
                    <span className="ffp-grant-expiry"> · Expires {new Date(g.expiresAt).toLocaleDateString()}</span>
                  )}
                  {g.grantedBy && (
                    <span className="ffp-grant-by"> · by {g.grantedBy.firstName} {g.grantedBy.lastName}</span>
                  )}
                </div>
              </div>
              <button
                className="ffp-remove-btn"
                onClick={() => handleRemove(g.feature)}
                disabled={saving === g.feature}
              >
                {saving === g.feature ? '...' : 'Remove'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Add / edit grant ──────────────────────────────────── */}
      <div className="ffp-add-section">
        <h4>Add Override</h4>
        <div className="ffp-add-row">
          <select value={grantFeature} onChange={e => setGrantFeature(e.target.value)} className="ffp-select">
            <option value="">— Select feature —</option>
            {available.map(f => (
              <option key={f} value={f}>{FEATURE_LABELS[f]?.label || f} ({FEATURE_LABELS[f]?.tier || ''})</option>
            ))}
          </select>
          <select value={String(grantEnabled)} onChange={e => setGrantEnabled(e.target.value === 'true')} className="ffp-select-sm">
            <option value="true">✅ Grant</option>
            <option value="false">🚫 Revoke</option>
          </select>
        </div>
        <div className="ffp-add-row">
          <input type="text" value={grantReason} onChange={e => setGrantReason(e.target.value)}
            placeholder="Reason (e.g. CS goodwill, beta tester)" className="ffp-input" />
          <input type="date" value={grantExpiry} onChange={e => setGrantExpiry(e.target.value)}
            className="ffp-input-sm" title="Optional expiry date" />
        </div>
        <button onClick={handleGrant} disabled={!grantFeature || saving === 'grant'} className="ffp-grant-btn">
          {saving === 'grant' ? 'Saving...' : grantEnabled ? '✅ Grant Feature' : '🚫 Revoke Feature'}
        </button>
      </div>

      {/* ── Resolved access (all features, current state) ───── */}
      <div className="ffp-resolved-section">
        <h4>Resolved Access (current plan + overrides)</h4>
        <div className="ffp-resolved-grid">
          {Object.entries(resolved).map(([feature, hasAccess]) => {
            const isOverridden = !!grantedFeatures[feature];
            const meta = FEATURE_LABELS[feature];
            return (
              <div key={feature} className={`ffp-resolved-item ${hasAccess ? 'has' : 'no'} ${isOverridden ? 'overridden' : ''}`}>
                <span className="ffp-resolved-icon">{hasAccess ? '✅' : '⬜'}</span>
                <div className="ffp-resolved-info">
                  <span className="ffp-resolved-name">{meta?.label || feature}</span>
                  <span className="ffp-resolved-tier">{meta?.tier || ''}{isOverridden ? ' 🔧' : ''}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
