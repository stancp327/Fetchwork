import React, { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import './Payments.css';

const CARD_STYLE = {
  style: {
    base: {
      fontSize: '16px',
      color: '#111827',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      '::placeholder': { color: '#9ca3af' },
    },
    invalid: { color: '#dc2626' },
  }
};

const CheckoutForm = ({ clientSecret, amount, jobTitle, onSuccess, onCancel }) => {
  const stripe   = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error,      setError]      = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setError('');

    const card = elements.getElement(CardElement);
    const result = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card }
    });

    if (result.error) {
      setError(result.error.message);
      setProcessing(false);
    } else {
      // payment_intent.status === 'requires_capture' (manual hold — not charged yet)
      setProcessing(false);
      if (onSuccess) onSuccess(result.paymentIntent);
    }
  };

  return (
    <form className="checkout-form" onSubmit={handleSubmit}>
      <div className="checkout-summary">
        <p className="checkout-job-title">{jobTitle}</p>
        <p className="checkout-amount">${amount?.toFixed(2)}</p>
        <p className="checkout-note">
          🔒 You'll be charged now. Funds are held by Fetchwork and only sent to the freelancer once you approve the work.
        </p>
      </div>

      <div className="checkout-card-field">
        <label>Card Details</label>
        <div className="card-element-wrapper">
          <CardElement options={CARD_STYLE} />
        </div>
      </div>

      {error && <div className="checkout-error">{error}</div>}

      <div className="checkout-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={processing}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={processing || !stripe}>
          {processing ? 'Processing…' : `Pay & Protect $${amount?.toFixed(2)} →`}
        </button>
      </div>

      <p className="checkout-secure">🔒 Secured by Stripe. Card details never touch our servers.</p>
    </form>
  );
};

export default CheckoutForm;
