import React, { useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import './Payments.css';

// PaymentElement automatically renders the best payment method for each user:
// cards, Apple Pay, Google Pay, bank transfers, etc. — no config needed.

const PAYMENT_ELEMENT_OPTIONS = {
  layout: 'tabs',
};

const CheckoutForm = ({ amount, jobTitle, jobId, onSuccess, onCancel }) => {
  const stripe   = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error,      setError]      = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setError('');

    // confirmPayment handles all payment methods — cards charge immediately,
    // redirect-based methods use return_url, wallets confirm in one step.
    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/jobs/${jobId}/progress?payment=success`,
      },
      // Don't redirect for card payments — stay on page and call onSuccess
      redirect: 'if_required',
    });

    if (stripeError) {
      setError(stripeError.message);
      setProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      setProcessing(false);
      if (onSuccess) onSuccess(paymentIntent);
    } else {
      // Payment requires redirect (e.g. bank transfer) — return_url handles it
      setProcessing(false);
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

      <div className="checkout-payment-element">
        <label>Payment Details</label>
        <div className="payment-element-wrapper">
          <PaymentElement options={PAYMENT_ELEMENT_OPTIONS} />
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

      <p className="checkout-secure">🔒 Secured by Stripe. We never store your payment details.</p>
    </form>
  );
};

export default CheckoutForm;
