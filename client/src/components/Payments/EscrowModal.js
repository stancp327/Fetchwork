import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import CheckoutForm from './CheckoutForm';
import { apiRequest } from '../../utils/api';
import './Payments.css';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

const CARD_BRANDS = {
  visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex',
  discover: 'Discover', jcb: 'JCB',
};

/**
 * EscrowModal — Secure Payment modal for jobs AND service orders
 *
 * Props:
 *   job             — { _id, title }
 *   amount          — number
 *   onClose         — fn
 *   onPaid          — fn(paymentIntent) called after successful payment
 *   preloadedSecret — if provided, skips the init step (service order flow)
 *   title           — optional modal title override
 */
const EscrowModal = ({ job, amount, onClose, onPaid, preloadedSecret, title, returnUrl }) => {
  const [clientSecret,  setClientSecret]  = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState('');
  const [savedMethods,  setSavedMethods]  = useState([]);
  const [selectedPmId,  setSelectedPmId]  = useState(null);  // 'wallet', 'new', or pm_xxx
  const [savedLoading,  setSavedLoading]  = useState(true);
  const [walletBalance, setWalletBalance] = useState(null);

  // Fetch saved cards + wallet balance on mount
  useEffect(() => {
    Promise.all([
      apiRequest('/api/payments/methods').catch(() => ({ methods: [] })),
      apiRequest('/api/billing/wallet/balance').catch(() => ({ balance: 0 })),
    ]).then(([cardData, walletData]) => {
      const methods = cardData.methods || [];
      setSavedMethods(methods);
      setWalletBalance(walletData.balance || 0);

      // Default selection: wallet if sufficient, else default card, else new
      if (walletData.balance >= Number(amount)) {
        setSelectedPmId('wallet');
      } else {
        const def = methods.find(m => m.isDefault) || methods[0];
        setSelectedPmId(def ? def.id : 'new');
      }
    }).finally(() => setSavedLoading(false));
  }, [amount]);

  const handleContinue = async () => {
    setLoading(true);
    setError('');

    // ── Wallet path ──
    if (selectedPmId === 'wallet') {
      try {
        const data = await apiRequest('/api/billing/wallet/pay', {
          method: 'POST',
          body: JSON.stringify({
            amount: Number(amount),
            reason: `Payment for ${job.title}`,
            ref:    job._id,
          }),
        });
        if (onPaid) onPaid({ walletPayment: true, paid: data.paid, balance: data.balance });
        onClose();
      } catch (err) {
        setError(err.message || 'Wallet payment failed');
      } finally {
        setLoading(false);
      }
      return;
    }

    // ── Saved card path ──
    if (selectedPmId && selectedPmId !== 'new') {
      try {
        if (preloadedSecret) {
          // Service order flow: confirm the existing PaymentIntent with saved card
          const stripeInstance = await stripePromise;
          const { error: stripeError, paymentIntent } = await stripeInstance.confirmCardPayment(preloadedSecret, {
            payment_method: selectedPmId,
          });
          if (stripeError) throw new Error(stripeError.message);
          if (onPaid) onPaid(paymentIntent);
          onClose();
        } else {
          // Job flow: server creates + confirms in one step
          await apiRequest('/api/payments/fund-escrow', {
            method: 'POST',
            body: JSON.stringify({ jobId: job._id, amount, paymentMethodId: selectedPmId }),
          });
          if (onPaid) onPaid({ paymentMethod: selectedPmId });
          onClose();
        }
      } catch (err) {
        setError(err.message || 'Payment failed. Please try a different card.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // ── New card path: show PaymentElement ──
    if (preloadedSecret) {
      // Service order: already have clientSecret
      setClientSecret(preloadedSecret);
      setLoading(false);
      return;
    }

    try {
      const data = await apiRequest('/api/payments/fund-escrow', {
        method: 'POST',
        body: JSON.stringify({ jobId: job._id, amount }),
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

  const showInit = !clientSecret && !loading;

  return (
    <div className="escrow-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="escrow-modal">
        <div className="escrow-modal-header">
          <h2>{title || 'Secure Payment'}</h2>
          <button className="escrow-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="escrow-modal-body">
          {showInit && !savedLoading && (
            <div className="escrow-init">
              {/* How it works */}
              <div className="escrow-how-it-works">
                <h3>How Secure Payment works</h3>
                <ol>
                  <li>💳 Your card is <strong>charged now</strong> and funds are held by Fetchwork</li>
                  <li>🔒 The freelancer cannot access funds until you approve</li>
                  <li>✅ Once satisfied, release payment with one click</li>
                  <li>💸 Full refund available if there's a dispute before release</li>
                </ol>
              </div>

              <div className="escrow-amount-row">
                <span>Job:</span><span>{job.title}</span>
              </div>
              <div className="escrow-amount-row">
                <span>Total amount:</span><span>${Number(amount).toFixed(2)}</span>
              </div>
              <div className="escrow-amount-row fee">
                <span>Platform fee (10%):</span>
                <span>-${(Number(amount) * 0.10).toFixed(2)}</span>
              </div>
              <div className="escrow-amount-row total">
                <span>Freelancer receives:</span>
                <span>${(Number(amount) * 0.90).toFixed(2)}</span>
              </div>

              {/* Payment methods */}
              {(walletBalance > 0 || savedMethods.length > 0) && (
                <div className="escrow-saved-cards">
                  <p className="escrow-saved-label">Pay with:</p>

                  {/* Wallet option */}
                  {walletBalance > 0 && (
                    <label className={`escrow-card-option ${selectedPmId === 'wallet' ? 'selected' : ''} ${walletBalance < Number(amount) ? 'escrow-card-disabled' : ''}`}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="wallet"
                        checked={selectedPmId === 'wallet'}
                        onChange={() => setSelectedPmId('wallet')}
                        disabled={walletBalance < Number(amount)}
                      />
                      <span className="escrow-card-brand">Wallet</span>
                      <span className="escrow-card-num">${walletBalance.toFixed(2)} available</span>
                      {walletBalance < Number(amount) && (
                        <span className="escrow-card-exp" style={{ color: '#ef4444' }}>Insufficient</span>
                      )}
                    </label>
                  )}

                  {savedMethods.map(m => (
                    <label key={m.id} className={`escrow-card-option ${selectedPmId === m.id ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={m.id}
                        checked={selectedPmId === m.id}
                        onChange={() => setSelectedPmId(m.id)}
                      />
                      <span className="escrow-card-brand">
                        {CARD_BRANDS[m.brand] || m.brand}
                      </span>
                      <span className="escrow-card-num">•••• {m.last4}</span>
                      <span className="escrow-card-exp">
                        {String(m.expMonth).padStart(2, '0')}/{String(m.expYear).slice(-2)}
                      </span>
                      {m.isDefault && <span className="escrow-card-default">Default</span>}
                    </label>
                  ))}
                  <label className={`escrow-card-option new-card ${selectedPmId === 'new' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="new"
                      checked={selectedPmId === 'new'}
                      onChange={() => setSelectedPmId('new')}
                    />
                    <span>+ Use a new card</span>
                  </label>
                </div>
              )}

              {error && <div className="checkout-error">{error}</div>}

              <div className="escrow-init-actions">
                <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                <button className="btn btn-primary" onClick={handleContinue} disabled={loading}>
                  {selectedPmId === 'wallet'
                    ? `Pay $${Number(amount).toFixed(2)} from Wallet →`
                    : selectedPmId && selectedPmId !== 'new'
                      ? `Pay $${Number(amount).toFixed(2)} →`
                      : 'Continue to Payment →'
                  }
                </button>
              </div>
            </div>
          )}

          {(loading || savedLoading) && (
            <div className="escrow-loading">
              {savedLoading ? 'Loading…' : 'Processing payment…'}
            </div>
          )}

          {clientSecret && (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: { theme: 'stripe', variables: { colorPrimary: '#2563eb', borderRadius: '8px' } }
              }}
            >
              <CheckoutForm
                amount={Number(amount)}
                jobTitle={job.title}
                jobId={job._id}
                returnUrl={returnUrl || window.location.href}
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
