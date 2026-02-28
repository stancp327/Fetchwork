import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import CheckoutForm from './CheckoutForm';
import { apiRequest } from '../../utils/api';
import './Payments.css';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

/**
 * EscrowModal — Secure Payment modal for jobs AND service orders
 *
 * Props:
 *   job               — { _id, title, budget }  (job flow)
 *   amount            — number
 *   onClose           — fn
 *   onPaid            — fn(paymentIntent) called after successful payment
 *   preloadedSecret   — if provided, skips the init step (service order flow)
 *   title             — optional override for the modal title
 */
const EscrowModal = ({ job, amount, onClose, onPaid, preloadedSecret, title }) => {
  const [clientSecret, setClientSecret] = useState(preloadedSecret || null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');

  const initEscrow = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest('/api/payments/fund-escrow', {
        method: 'POST',
        body: JSON.stringify({ jobId: job._id, amount })
      });
      setClientSecret(data.clientSecret);
    } catch (err) {
      setError(err.message || 'Failed to initialize payment');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = (paymentIntent) => {
    if (onPaid) onPaid(paymentIntent);
    onClose();
  };

  return (
    <div className="escrow-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="escrow-modal">
        <div className="escrow-modal-header">
          <h2>{title || 'Secure Payment'}</h2>
          <button className="escrow-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="escrow-modal-body">
          {!clientSecret && !loading && (
            <div className="escrow-init">
              <div className="escrow-how-it-works">
                <h3>How Secure Payment works</h3>
                <ol>
                  <li>💳 Your card is <strong>charged now</strong> and funds are held by Fetchwork</li>
                  <li>🔒 The freelancer cannot access the funds until you approve</li>
                  <li>✅ Once you're happy with the work, release payment with one click</li>
                  <li>💸 Freelancer is paid instantly — you can request a refund if there's a dispute</li>
                </ol>
              </div>

              <div className="escrow-amount-row">
                <span>Job:</span><span>{job.title}</span>
              </div>
              <div className="escrow-amount-row total">
                <span>Secured amount:</span><span>${Number(amount).toFixed(2)}</span>
              </div>

              {error && <div className="checkout-error">{error}</div>}

              <div className="escrow-init-actions">
                <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                <button className="btn btn-primary" onClick={initEscrow}>
                  Continue to Payment →
                </button>
              </div>
            </div>
          )}

          {loading && <div className="escrow-loading">Setting up payment…</div>}

          {clientSecret && (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'stripe',
                  variables: { colorPrimary: '#2563eb', borderRadius: '8px' }
                }
              }}
            >
              <CheckoutForm
                amount={Number(amount)}
                jobTitle={job.title}
                jobId={job._id}
                onSuccess={handleSuccess}
                onCancel={onClose}
              />
            </Elements>
          )}
        </div>
      </div>
    </div>
  );
};

export default EscrowModal;
