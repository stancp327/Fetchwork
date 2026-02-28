import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import './BillingSettings.css';

const TIER_LABELS = { free: 'Free', plus: 'Plus', pro: 'Pro / Business' };
const TIER_COLORS = { free: 'muted', plus: 'primary', pro: 'gradient' };

const BillingSettings = () => {
  const navigate = useNavigate();
  const [status, setStatus]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError]         = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    // Handle redirect back from Stripe
    const params = new URLSearchParams(window.location.search);
    if (params.get('subscription') === 'success') {
      setSuccessMsg('🎉 Your plan has been activated! Benefits are live now.');
      window.history.replaceState({}, '', '/billing');
    }

    apiRequest('/api/billing/status')
      .then(d => setStatus(d))
      .catch(() => setError('Could not load billing status'))
      .finally(() => setLoading(false));
  }, []);

  const handlePortal = async () => {
    setPortalLoading(true);
    setError('');
    try {
      const data = await apiRequest('/api/billing/portal', { method: 'POST' });
      if (data.portalUrl) window.location.href = data.portalUrl;
    } catch (err) {
      setError(err.message || 'Could not open billing portal');
      setPortalLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancel your subscription? You\'ll keep your benefits until the end of the billing period.')) return;
    setCancelling(true);
    setError('');
    try {
      await apiRequest('/api/billing/cancel', { method: 'POST' });
      setSuccessMsg('Subscription will end at period close. You can still use your plan until then.');
      const d = await apiRequest('/api/billing/status');
      setStatus(d);
    } catch (err) {
      setError(err.message || 'Could not cancel subscription');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <div className="bs-loading">Loading billing info…</div>;

  const plan = status?.plan;
  const sub  = status?.subscription;
  const isFree = !sub || status?.isDefault || plan?.tier === 'free';
  const isPastDue = sub?.status === 'past_due';
  const isCancelling = sub?.cancelAtPeriodEnd;

  return (
    <div className="bs-wrap">
      <div className="bs-header">
        <h1 className="bs-title">Billing & Subscription</h1>
        <Link to="/pricing" className="bs-pricing-link">View all plans →</Link>
      </div>

      {successMsg && <div className="bs-success">{successMsg}</div>}
      {error      && <div className="bs-error">{error}</div>}

      {/* ── Current plan ── */}
      <div className="bs-card">
        <div className="bs-card-title">Current Plan</div>

        <div className="bs-plan-row">
          <div className={`bs-plan-badge bs-plan-${plan?.tier || 'free'}`}>
            {plan?.name || 'Free'}
          </div>
          {sub?.grandfathered && (
            <span className="bs-grandfather-badge">🔒 Grandfathered pricing</span>
          )}
          {isPastDue && (
            <span className="bs-past-due-badge">⚠️ Payment past due</span>
          )}
          {isCancelling && (
            <span className="bs-cancelling-badge">Cancels {new Date(sub.currentPeriodEnd).toLocaleDateString()}</span>
          )}
        </div>

        {!isFree && sub && (
          <div className="bs-detail-rows">
            <div className="bs-detail-row">
              <span>Status</span>
              <strong>{sub.status}</strong>
            </div>
            {sub.currentPeriodEnd && (
              <div className="bs-detail-row">
                <span>{isCancelling ? 'Access until' : 'Next renewal'}</span>
                <strong>{new Date(sub.currentPeriodEnd).toLocaleDateString()}</strong>
              </div>
            )}
            {sub.customPrice != null && (
              <div className="bs-detail-row">
                <span>Your rate</span>
                <strong>${sub.customPrice}/mo (custom)</strong>
              </div>
            )}
          </div>
        )}

        {isFree && (
          <p className="bs-free-note">
            You're on the free plan.{' '}
            <Link to="/pricing" className="bs-upgrade-link">Upgrade to unlock more tools →</Link>
          </p>
        )}
      </div>

      {/* ── Plan actions ── */}
      {!isFree && (
        <div className="bs-card">
          <div className="bs-card-title">Manage Subscription</div>
          <div className="bs-actions">
            <button
              className="bs-btn-portal"
              onClick={handlePortal}
              disabled={portalLoading}
            >
              {portalLoading ? 'Opening…' : '🔗 Manage via Stripe Portal'}
            </button>
            <p className="bs-portal-note">
              Update payment method, download invoices, and view billing history.
            </p>

            {!isCancelling && (
              <button
                className="bs-btn-cancel"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling…' : 'Cancel subscription'}
              </button>
            )}
            {isCancelling && (
              <p className="bs-cancel-note">
                Your plan will not renew. Benefits continue until <strong>{new Date(sub.currentPeriodEnd).toLocaleDateString()}</strong>.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Upgrade CTA (for free users) ── */}
      {isFree && (
        <div className="bs-upgrade-cta">
          <div className="bs-upgrade-cta-text">
            <strong>Ready to grow?</strong>
            <p>Unlock lower fees, scheduling tools, analytics, and more.</p>
          </div>
          <Link to="/pricing" className="bs-btn-upgrade">See plans →</Link>
        </div>
      )}

      {/* ── Past due warning ── */}
      {isPastDue && (
        <div className="bs-past-due-card">
          <strong>⚠️ Payment failed</strong>
          <p>Your last subscription payment didn't go through. Update your payment method to keep your plan benefits.</p>
          <button className="bs-btn-portal" onClick={handlePortal} disabled={portalLoading}>
            {portalLoading ? 'Opening…' : 'Update payment method'}
          </button>
        </div>
      )}
    </div>
  );
};

export default BillingSettings;
