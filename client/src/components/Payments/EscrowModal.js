import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import CheckoutForm from './CheckoutForm';
import { apiRequest } from '../../utils/api';
import './Payments.css';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

/**
 * EscrowModal
 * Props:
 *   job     — { _id, title, budget }
 *   amount  — number (agreed amount from proposal)
 *   onClose — fn
 *   onPaid  — fn called after successful escrow hold
 */
const EscrowModal = ({ job, amount, onClose, onPaid }) => {
  const [clientSecret, setClientSecret] = useState(null);
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
          <h2>Fund Escrow</h2>
          <button className="escrow-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="escrow-modal-body">
          {!clientSecret && !loading && (
            <div className="escrow-init">
              <div className="escrow-how-it-works">
                <h3>How escrow works</h3>
                <ol>
                  <li>💳 Your card is authorized but <strong>not charged yet</strong></li>
                  <li>🔒 Funds are held securely while work is in progress</li>
                  <li>✅ You release payment when the job is done to your satisfaction</li>
                  <li>💸 Freelancer gets paid instantly on release</li>
                </ol>
              </div>

              <div className="escrow-amount-row">
                <span>Job:</span><span>{job.title}</span>
              </div>
              <div className="escrow-amount-row total">
                <span>Amount to hold:</span><span>${Number(amount).toFixed(2)}</span>
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
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CheckoutForm
                clientSecret={clientSecret}
                amount={Number(amount)}
                jobTitle={job.title}
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
