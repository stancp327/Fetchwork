/**
 * JobFeatureModal
 * Handles two flows via `mode` prop:
 *   'feature'  — Feature this job (standard $9.99/7d, premium $19.99/14d)
 *   'promote'  — Promote a proposal ($2.99 flat)
 */

import React, { useState } from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { apiRequest } from '../../utils/api';
import './JobFeatureModal.css';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

const FEATURE_TIERS = {
  standard: { label: 'Standard',  duration: '7 days',  price: '$9.99',  cents: 999  },
  premium:  { label: 'Premium',   duration: '14 days', price: '$19.99', cents: 1999 },
};

// ── Stripe payment form ───────────────────────────────────────────────────────
const PayForm = ({ amountCents, jobId, proposalId, mode, tier, onSuccess }) => {
  const stripe    = useStripe();
  const elements  = useElements();
  const [paying,  setPaying]  = useState(false);
  const [err,     setErr]     = useState('');

  const handlePay = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setPaying(true);
    setErr('');

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });

    if (error) {
      setErr(error.message);
      setPaying(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      try {
        const verifyPath = mode === 'feature'
          ? `/api/jobs/${jobId}/feature/verify`
          : `/api/jobs/${jobId}/proposals/${proposalId}/promote/verify`;
        await apiRequest(verifyPath, {
          method: 'POST',
          body: JSON.stringify({ paymentIntentId: paymentIntent.id }),
        });
        onSuccess();
      } catch (err2) {
        setErr('Payment went through but verification failed — contact support.');
        setPaying(false);
      }
    } else {
      setErr('Payment incomplete. Please try again.');
      setPaying(false);
    }
  };

  return (
    <form onSubmit={handlePay} className="jfm-pay-form">
      <PaymentElement />
      {err && <div className="jfm-error">{err}</div>}
      <button type="submit" className="jfm-pay-btn" disabled={!stripe || paying}>
        {paying ? 'Processing…' : `Pay $${(amountCents / 100).toFixed(2)}`}
      </button>
    </form>
  );
};

// ── Main Modal ────────────────────────────────────────────────────────────────
const JobFeatureModal = ({ mode = 'feature', jobId, jobTitle, proposalId, freelancerName, onClose, onSuccess }) => {
  const [tier, setTier]               = useState('standard');   // for feature mode
  const [step, setStep]               = useState('choose');      // 'choose' | 'pay' | 'done'
  const [clientSecret, setClientSecret] = useState('');
  const [amountCents, setAmountCents] = useState(0);
  const [loading, setLoading]         = useState(false);
  const [err, setErr]                 = useState('');

  const isFeature = mode === 'feature';
  const isPromote = mode === 'promote';

  const handleProceed = async () => {
    setLoading(true);
    setErr('');
    try {
      let res;
      if (isFeature) {
        res = await apiRequest(`/api/jobs/${jobId}/feature`, {
          method: 'POST',
          body: JSON.stringify({ tier }),
        });
      } else {
        res = await apiRequest(`/api/jobs/${jobId}/proposals/${proposalId}/promote`, {
          method: 'POST',
        });
      }
      setClientSecret(res.clientSecret);
      setAmountCents(res.amount || (isFeature ? FEATURE_TIERS[tier].cents : 299));
      setStep('pay');
    } catch (e) {
      setErr(e.message || 'Failed to create payment. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    setStep('done');
    onSuccess?.();
  };

  return (
    <div className="jfm-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="jfm-modal" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="jfm-header">
          <div className="jfm-header-icon">{isFeature ? '⭐' : '📌'}</div>
          <div>
            <h2 className="jfm-title">
              {isFeature ? 'Feature This Job' : 'Promote Your Proposal'}
            </h2>
            <p className="jfm-subtitle">
              {isFeature
                ? `"${jobTitle || 'this job'}" will appear at the top of search results`
                : `Your proposal on "${jobTitle || 'this job'}" will be pinned to the top`}
            </p>
          </div>
          <button className="jfm-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {/* Body */}
        {step === 'choose' && (
          <div className="jfm-body">
            {isFeature && (
              <div className="jfm-tiers">
                {Object.entries(FEATURE_TIERS).map(([key, t]) => (
                  <button
                    key={key}
                    className={`jfm-tier ${tier === key ? 'jfm-tier--active' : ''}`}
                    onClick={() => setTier(key)}
                  >
                    <div className="jfm-tier-label">{t.label}</div>
                    <div className="jfm-tier-duration">⏱ {t.duration}</div>
                    <div className="jfm-tier-price">{t.price}</div>
                    {key === 'premium' && <div className="jfm-tier-badge">Best Value</div>}
                  </button>
                ))}
              </div>
            )}

            {isPromote && (
              <div className="jfm-promote-info">
                <div className="jfm-promote-price">$2.99</div>
                <p className="jfm-promote-desc">
                  Your proposal from <strong>{freelancerName || 'you'}</strong> will be pinned to the top of the client's proposal list — increasing visibility with no expiry.
                </p>
              </div>
            )}

            <div className="jfm-perks">
              {isFeature ? (
                <>
                  <div className="jfm-perk">✅ Pinned to top of search results</div>
                  <div className="jfm-perk">✅ "⭐ Featured" badge on your listing</div>
                  <div className="jfm-perk">✅ Priority in category browsing</div>
                  <div className="jfm-perk">✅ 2–4× more views on average</div>
                </>
              ) : (
                <>
                  <div className="jfm-perk">✅ Pinned above all non-promoted proposals</div>
                  <div className="jfm-perk">✅ "📌 Promoted" badge visible to client</div>
                  <div className="jfm-perk">✅ No expiry — stays promoted until decision</div>
                </>
              )}
            </div>

            {err && <div className="jfm-error">{err}</div>}

            <div className="jfm-actions">
              <button className="jfm-btn-secondary" onClick={onClose}>Cancel</button>
              <button
                className="jfm-btn-primary"
                onClick={handleProceed}
                disabled={loading}
              >
                {loading
                  ? 'Loading…'
                  : isFeature
                    ? `Continue — ${FEATURE_TIERS[tier].price}`
                    : 'Continue — $2.99'}
              </button>
            </div>
          </div>
        )}

        {step === 'pay' && clientSecret && (
          <div className="jfm-body">
            <div className="jfm-pay-summary">
              <span className="jfm-pay-label">
                {isFeature
                  ? `${FEATURE_TIERS[tier].label} Feature — ${FEATURE_TIERS[tier].duration}`
                  : 'Proposal Promotion'}
              </span>
              <span className="jfm-pay-amount">${(amountCents / 100).toFixed(2)}</span>
            </div>
            <Elements stripePromise={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
              <PayForm
                amountCents={amountCents}
                jobId={jobId}
                proposalId={proposalId}
                mode={mode}
                tier={tier}
                onSuccess={handleSuccess}
              />
            </Elements>
            <button className="jfm-back-link" onClick={() => setStep('choose')}>← Back</button>
          </div>
        )}

        {step === 'done' && (
          <div className="jfm-body jfm-success">
            <div className="jfm-success-icon">{isFeature ? '⭐' : '📌'}</div>
            <h3 className="jfm-success-title">
              {isFeature ? 'Job is now featured!' : 'Proposal promoted!'}
            </h3>
            <p className="jfm-success-desc">
              {isFeature
                ? `Your job will appear at the top of search results for ${FEATURE_TIERS[tier].duration}.`
                : 'Your proposal is now pinned to the top of the list.'}
            </p>
            <button className="jfm-btn-primary" onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default JobFeatureModal;
