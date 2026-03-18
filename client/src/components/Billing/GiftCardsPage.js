import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { apiRequest } from '../../utils/api';
import SEO from '../common/SEO';
import './GiftCards.css';

const STRIPE_KEY = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
const stripePromise = STRIPE_KEY ? loadStripe(STRIPE_KEY) : null;

const DENOMINATIONS = [10, 25, 50, 100];

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

const STATUS_BADGE = {
  active:          { label: 'Active',    color: '#16a34a', bg: '#dcfce7' },
  redeemed:        { label: 'Redeemed',  color: '#6b7280', bg: '#f3f4f6' },
  expired:         { label: 'Expired',   color: '#dc2626', bg: '#fee2e2' },
  voided:          { label: 'Voided',    color: '#dc2626', bg: '#fee2e2' },
  pending_payment: { label: 'Pending',   color: '#d97706', bg: '#fef3c7' },
};

const ELEMENTS_APPEARANCE = {
  theme: 'stripe',
  variables: { colorPrimary: '#2563eb', borderRadius: '8px' },
};

// ── Payment confirmation (inner, has Stripe context via Elements) ──
function PaymentConfirmForm({ amount, giftCardId, onSuccess, onBack }) {
  const stripe   = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setError('');
    setLoading(true);
    try {
      const { error: stripeErr, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });
      if (stripeErr) throw new Error(stripeErr.message);

      // Confirm + activate the gift card
      const result = await apiRequest('/api/gift-cards/confirm', {
        method: 'POST',
        body: JSON.stringify({ giftCardId, paymentIntentId: paymentIntent.id }),
      });

      onSuccess(result.code);
    } catch (err) {
      setError(err.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="gc-form" onSubmit={handleSubmit}>
      <div className="gc-form-field">
        <label>Payment Details</label>
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>

      {error && <div className="gc-error">{error}</div>}

      <div style={{ display: 'flex', gap: '12px' }}>
        <button type="button" className="gc-btn gc-btn-outline" onClick={onBack} disabled={loading}>
          Back
        </button>
        <button className="gc-btn gc-btn-primary" type="submit" disabled={loading || !stripe}>
          {loading ? 'Processing\u2026' : `Purchase ${fmt(amount)} Gift Card`}
        </button>
      </div>
    </form>
  );
}

// ── Purchase form (outer, manages two-step flow) ─────────────────
function PurchaseForm({ onSuccess }) {
  const [amount,       setAmount]       = useState(25);
  const [message,      setMessage]      = useState('');
  const [recip,        setRecip]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [done,         setDone]         = useState(null); // { code, amount }
  const [clientSecret, setClientSecret] = useState(null);
  const [giftCardId,   setGiftCardId]   = useState(null);

  // Step 1: create PaymentIntent on server
  const handleContinue = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiRequest('/api/gift-cards', {
        method: 'POST',
        body: JSON.stringify({ amount, message, recipientEmail: recip }),
      });
      setClientSecret(data.clientSecret);
      setGiftCardId(data.giftCardId);
    } catch (err) {
      setError(err.message || 'Failed to initialize payment');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = (code) => {
    setDone({ code, amount });
    setClientSecret(null);
    setGiftCardId(null);
    onSuccess?.();
  };

  const handleBack = () => {
    setClientSecret(null);
    setGiftCardId(null);
  };

  if (done) {
    return (
      <div className="gc-success">
        <div className="gc-success-icon">🎁</div>
        <h3>Gift Card Ready!</h3>
        <div className="gc-code-box">
          <span className="gc-code">{done.code}</span>
          <button className="gc-copy-btn" onClick={() => navigator.clipboard.writeText(done.code)}>Copy</button>
        </div>
        <p className="gc-success-sub">Share this code with anyone — they can redeem it in their wallet for {fmt(done.amount)}.</p>
        <button className="gc-btn gc-btn-outline" onClick={() => setDone(null)}>Buy Another</button>
      </div>
    );
  }

  // Step 2: show PaymentElement for confirmation
  if (clientSecret) {
    return (
      <Elements
        stripe={stripePromise}
        options={{ clientSecret, appearance: ELEMENTS_APPEARANCE }}
      >
        <PaymentConfirmForm
          amount={amount}
          giftCardId={giftCardId}
          onSuccess={handlePaymentSuccess}
          onBack={handleBack}
        />
      </Elements>
    );
  }

  // Step 1: amount + details form
  return (
    <form className="gc-form" onSubmit={handleContinue}>
      <div className="gc-form-field">
        <label>Amount</label>
        <div className="gc-denom-row">
          {DENOMINATIONS.map(d => (
            <button key={d} type="button" className={`gc-denom-btn${amount === d ? ' selected' : ''}`} onClick={() => setAmount(d)}>
              ${d}
            </button>
          ))}
        </div>
      </div>

      <div className="gc-form-field">
        <label>Gift Message <span className="gc-opt">(optional)</span></label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          maxLength={300}
          rows={2}
          placeholder="Happy hiring! 🎉"
        />
        <span className="gc-char-count">{message.length}/300</span>
      </div>

      <div className="gc-form-field">
        <label>Recipient Email <span className="gc-opt">(optional — just for your records)</span></label>
        <input
          type="email"
          value={recip}
          onChange={e => setRecip(e.target.value)}
          placeholder="friend@example.com"
        />
      </div>

      {error && <div className="gc-error">{error}</div>}

      <button className="gc-btn gc-btn-primary" type="submit" disabled={loading}>
        {loading ? 'Processing\u2026' : `Continue to Payment — ${fmt(amount)}`}
      </button>
    </form>
  );
}

// ── My Cards list ──────────────────────────────────────────────────
function MyCards() {
  const [cards,   setCards]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied,  setCopied]  = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await apiRequest('/api/gift-cards');
      setCards(data.cards || []);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) return <div className="gc-loading">Loading…</div>;
  if (!cards.length) return <div className="gc-empty-state">You haven't purchased any gift cards yet.</div>;

  return (
    <div className="gc-cards-list">
      {cards.map(card => {
        const badge = STATUS_BADGE[card.status] || STATUS_BADGE.pending_payment;
        return (
          <div key={card._id} className={`gc-card gc-card--${card.status}`}>
            <div className="gc-card-left">
              <span className="gc-card-icon">🎁</span>
              <div>
                <div className="gc-card-amount">{fmt(card.amount)}</div>
                {card.status === 'active' && (
                  <div className="gc-card-code-row">
                    <span className="gc-card-code">{card.code}</span>
                    <button className="gc-copy-btn" onClick={() => copyCode(card.code)}>
                      {copied === card.code ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                )}
                {card.message && <div className="gc-card-message">"{card.message}"</div>}
                {card.recipientEmail && <div className="gc-card-recip">→ {card.recipientEmail}</div>}
              </div>
            </div>
            <div className="gc-card-right">
              <span className="gc-status-badge" style={{ color: badge.color, background: badge.bg }}>
                {badge.label}
              </span>
              <div className="gc-card-date">{new Date(card.createdAt).toLocaleDateString()}</div>
              {card.expiresAt && card.status === 'active' && (
                <div className="gc-card-expires">Expires {new Date(card.expiresAt).toLocaleDateString()}</div>
              )}
              {card.usedBy && (
                <div className="gc-card-used-by">Used by {card.usedBy.firstName || 'someone'}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Page shell ─────────────────────────────────────────────────────
export default function GiftCardsPage() {
  const [tab, setTab] = useState('buy');
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);

  const onPurchaseSuccess = () => {
    setRefreshKey(k => k + 1);
    setTimeout(() => setTab('mine'), 1500);
  };

  return (
    <div className="gc-page">
      <SEO title="Gift Cards — Fetchwork" description="Buy Fetchwork gift cards for freelancers and clients." />

      <div className="gc-page-inner">
        <div className="gc-page-header">
          <h1 className="gc-page-title">🎁 Gift Cards</h1>
          <p className="gc-page-sub">Give someone the gift of getting work done — or getting paid.</p>
        </div>

        <div className="gc-tabs">
          <button className={`gc-tab${tab === 'buy' ? ' active' : ''}`} onClick={() => setTab('buy')}>Buy a Card</button>
          <button className={`gc-tab${tab === 'mine' ? ' active' : ''}`} onClick={() => setTab('mine')}>My Cards</button>
        </div>

        <div className="gc-tab-content">
          {tab === 'buy' && (
            <div className="gc-buy-panel">
              <h2 className="gc-section-title">Purchase a Gift Card</h2>
              <p className="gc-section-sub">Redeemable for wallet credits on any Fetchwork account. Never expires for {365} days.</p>
              {stripePromise ? (
                <PurchaseForm onSuccess={onPurchaseSuccess} />
              ) : (
                <div className="gc-error">Payments not configured.</div>
              )}
            </div>
          )}

          {tab === 'mine' && (
            <div className="gc-mine-panel">
              <h2 className="gc-section-title">My Gift Cards</h2>
              <MyCards key={refreshKey} />
            </div>
          )}
        </div>

        <div className="gc-redeem-link">
          Want to redeem a gift card? Go to your{' '}
          <button className="gc-link-btn" onClick={() => navigate('/wallet')}>Wallet →</button>
        </div>
      </div>
    </div>
  );
}
