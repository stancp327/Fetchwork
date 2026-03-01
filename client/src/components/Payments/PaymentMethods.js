import React, { useState, useEffect, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { apiRequest } from '../../utils/api';
import './PaymentMethods.css';
import SEO from '../common/SEO';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

const CARD_BRANDS = {
  visa:       '💳 Visa',
  mastercard: '💳 Mastercard',
  amex:       '💳 Amex',
  discover:   '💳 Discover',
  jcb:        '💳 JCB',
  unionpay:   '💳 UnionPay',
  diners:     '💳 Diners',
};

// ── Add Card Form (inside Stripe Elements) ──────────────────────
const AddCardForm = ({ onSuccess, onCancel }) => {
  const stripe   = useStripe();
  const elements = useElements();
  const [error,  setError]  = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSaving(true);
    setError('');
    try {
      const { error: stripeError } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: window.location.href, // redirect-based methods only
        },
        redirect: 'if_required', // stay on page for cards
      });
      if (stripeError) {
        setError(stripeError.message);
      } else {
        onSuccess();
      }
    } catch (err) {
      setError(err.message || 'Failed to save card');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="pm-add-form" onSubmit={handleSubmit}>
      <div className="pm-add-header">
        <h3>Add Payment Method</h3>
        <button type="button" className="pm-add-close" onClick={onCancel}>✕</button>
      </div>
      <p className="pm-add-note">
        🔒 Card details are handled directly by Stripe — never stored on Fetchwork servers.
      </p>
      <div className="pm-stripe-element">
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>
      {error && <div className="pm-add-error">{error}</div>}
      <div className="pm-add-actions">
        <button type="button" className="pm-btn-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="pm-btn-save" disabled={saving || !stripe}>
          {saving ? 'Saving…' : '🔒 Save Card'}
        </button>
      </div>
    </form>
  );
};

// ── Card Row ────────────────────────────────────────────────────
const CardRow = ({ method, onDelete, onSetDefault, acting }) => (
  <div className={`pm-card-row ${method.isDefault ? 'default' : ''}`}>
    <div className="pm-card-info">
      <span className="pm-card-brand">
        {CARD_BRANDS[method.brand] || `💳 ${method.brand}`}
      </span>
      <span className="pm-card-number">•••• {method.last4}</span>
      <span className="pm-card-expiry">
        {String(method.expMonth).padStart(2, '0')}/{String(method.expYear).slice(-2)}
      </span>
      {method.isDefault && <span className="pm-card-default-badge">Default</span>}
    </div>
    <div className="pm-card-actions">
      {!method.isDefault && (
        <button
          className="pm-btn-set-default"
          disabled={acting}
          onClick={() => onSetDefault(method.id)}
        >
          Set Default
        </button>
      )}
      <button
        className="pm-btn-delete"
        disabled={acting}
        onClick={() => onDelete(method.id)}
        title="Remove card"
      >
        🗑
      </button>
    </div>
  </div>
);

// ── Main PaymentMethods Component ───────────────────────────────
const PaymentMethods = () => {
  const [methods,      setMethods]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [acting,       setActing]       = useState(false);
  const [error,        setError]        = useState('');
  const [showAddForm,  setShowAddForm]  = useState(false);
  const [clientSecret, setClientSecret] = useState(null);
  const [elementsKey,  setElementsKey]  = useState(0);

  const fetchMethods = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/api/payments/methods');
      setMethods(data.methods || []);
    } catch (err) {
      setError(err.message || 'Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMethods(); }, [fetchMethods]);

  const handleAddCard = async () => {
    setError('');
    try {
      const data = await apiRequest('/api/payments/methods/setup', { method: 'POST' });
      setClientSecret(data.clientSecret);
      setElementsKey(k => k + 1); // remount Elements on each open
      setShowAddForm(true);
    } catch (err) {
      setError(err.message || 'Failed to start card setup');
    }
  };

  const handleAddSuccess = () => {
    setShowAddForm(false);
    setClientSecret(null);
    fetchMethods();
  };

  const handleDelete = async (pmId) => {
    if (!window.confirm('Remove this payment method?')) return;
    setActing(true);
    try {
      await apiRequest(`/api/payments/methods/${pmId}`, { method: 'DELETE' });
      setMethods(prev => prev.filter(m => m.id !== pmId));
    } catch (err) {
      setError(err.message);
    } finally {
      setActing(false);
    }
  };

  const handleSetDefault = async (pmId) => {
    setActing(true);
    try {
      await apiRequest(`/api/payments/methods/${pmId}/default`, { method: 'POST' });
      setMethods(prev => prev.map(m => ({ ...m, isDefault: m.id === pmId })));
    } catch (err) {
      setError(err.message);
    } finally {
      setActing(false);
    }
  };

  const appearance = {
    theme: 'stripe',
    variables: { colorPrimary: '#2563eb', borderRadius: '8px' },
  };

  return (
    <div className="payment-methods">
      <SEO title="Payment Methods" path="/payment-methods" noIndex={true} />
      <div className="pm-section-header">
        <div>
          <h2>Payment Methods</h2>
          <p className="pm-section-note">
            Saved cards are used for Secure Payments on jobs and service orders.
            Card data is stored securely with Stripe — never on Fetchwork servers.
          </p>
        </div>
        {!showAddForm && (
          <button className="pm-btn-add" onClick={handleAddCard}>
            + Add Card
          </button>
        )}
      </div>

      {error && <div className="pm-error">{error}</div>}

      {/* Add card form */}
      {showAddForm && clientSecret && (
        <Elements
          key={elementsKey}
          stripe={stripePromise}
          options={{ clientSecret, appearance }}
        >
          <AddCardForm
            onSuccess={handleAddSuccess}
            onCancel={() => { setShowAddForm(false); setClientSecret(null); }}
          />
        </Elements>
      )}

      {/* Saved cards list */}
      {loading ? (
        <div className="pm-loading">Loading…</div>
      ) : methods.length === 0 && !showAddForm ? (
        <div className="pm-empty">
          <div className="pm-empty-icon">💳</div>
          <p>No saved payment methods yet.</p>
          <p className="pm-empty-sub">Add a card to pay faster for jobs and service orders.</p>
          <button className="pm-btn-add-empty" onClick={handleAddCard}>
            + Add Your First Card
          </button>
        </div>
      ) : (
        <div className="pm-card-list">
          {methods.map(m => (
            <CardRow
              key={m.id}
              method={m}
              acting={acting}
              onDelete={handleDelete}
              onSetDefault={handleSetDefault}
            />
          ))}
        </div>
      )}

      <div className="pm-stripe-badge">
        <span>🔒 Secured by</span>
        <strong> Stripe</strong>
        <span> — PCI DSS Level 1 compliant</span>
      </div>
    </div>
  );
};

export default PaymentMethods;


