/**
 * BookingPayModal — Stripe Elements payment modal for confirming a booking.
 * Usage: <BookingPayModal bookingId={...} amountCents={...} onSuccess={...} onClose={...} />
 */
import React, { useState, useEffect } from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { apiRequest } from '../../utils/api';
import './BookingPayModal.css';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

// ── Inner form (needs to live inside <Elements>) ──────────────────────────────
const PayForm = ({ bookingId, paymentIntentId, amountCents, onSuccess }) => {
  const stripe   = useStripe();
  const elements = useElements();
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError('');

    const { error: stripeErr, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/bookings/${bookingId}` },
      redirect: 'if_required',
    });

    if (stripeErr) {
      setError(stripeErr.message);
      setBusy(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      try {
        await apiRequest(`/api/bookings/${bookingId}/confirm-payment`, {
          method: 'POST',
          body: JSON.stringify({ paymentIntentId: paymentIntent.id }),
        });
        onSuccess();
      } catch (err) {
        setError('Payment succeeded but confirmation failed. Please contact support.');
        setBusy(false);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bpm-form">
      <PaymentElement />
      {error && <p className="bpm-error">{error}</p>}
      <button type="submit" className="bpm-pay-btn" disabled={!stripe || busy}>
        {busy ? '⏳ Processing…' : `Pay $${(amountCents / 100).toFixed(2)} & Confirm`}
      </button>
    </form>
  );
};

// ── Modal wrapper ──────────────────────────────────────────────────────────────
const BookingPayModal = ({ bookingId, onSuccess, onClose }) => {
  const [clientSecret, setClientSecret] = useState('');
  const [amountCents, setAmountCents]   = useState(0);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');

  useEffect(() => {
    apiRequest(`/api/bookings/${bookingId}/payment-intent`, { method: 'POST', body: '{}' })
      .then(data => {
        if (data.free) { onSuccess(); return; }
        if (data.alreadyPaid) { onSuccess(); return; }
        setClientSecret(data.clientSecret);
        setAmountCents(data.amountCents);
      })
      .catch(err => setError(err.message || 'Failed to load payment'))
      .finally(() => setLoading(false));
  }, [bookingId]);

  return (
    <div className="bpm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bpm-modal">
        <div className="bpm-header">
          <h2 className="bpm-title">💳 Pay to Confirm Booking</h2>
          <button className="bpm-close" onClick={onClose}>✕</button>
        </div>

        {loading && <p className="bpm-loading">Loading payment…</p>}
        {error   && <p className="bpm-error">{error}</p>}

        {!loading && !error && clientSecret && (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
            <PayForm
              bookingId={bookingId}
              paymentIntentId={clientSecret.split('_secret_')[0]}
              amountCents={amountCents}
              onSuccess={onSuccess}
            />
          </Elements>
        )}
      </div>
    </div>
  );
};

export default BookingPayModal;
