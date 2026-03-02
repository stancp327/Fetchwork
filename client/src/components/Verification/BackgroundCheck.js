import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import SEO from '../common/SEO';
import './BackgroundCheck.css';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

const PaymentForm = ({ onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  const handlePay = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setPaying(true);
    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements, confirmParams: {}, redirect: 'if_required',
    });
    if (stripeError) { setError(stripeError.message); setPaying(false); }
    else if (paymentIntent?.status === 'succeeded') { onSuccess(); }
    else { setPaying(false); }
  };

  return (
    <form onSubmit={handlePay} className="bgc-payment-form">
      <PaymentElement />
      {error && <div className="bgc-error">{error}</div>}
      <button type="submit" disabled={!stripe || paying} className="bgc-pay-btn">
        {paying ? 'Processing...' : 'Pay & Continue'}
      </button>
    </form>
  );
};

const BackgroundCheckPage = () => {
  const [options, setOptions] = useState([]);
  const [myCheck, setMyCheck] = useState(null);
  const [loading, setLoading] = useState(true);

  const [selectedType, setSelectedType] = useState(null);
  const [step, setStep] = useState('select'); // select, payment, consent, processing, complete
  const [clientSecret, setClientSecret] = useState(null);
  const [checkId, setCheckId] = useState(null);
  const [consenting, setConsenting] = useState(false);

  useEffect(() => {
    Promise.all([
      apiRequest('/api/background-checks/options'),
      apiRequest('/api/background-checks/me'),
    ]).then(([opts, me]) => {
      setOptions(opts.options || []);
      if (me.hasCheck) {
        setMyCheck(me.check);
        if (me.check.status === 'completed') setStep('complete');
        else if (me.check.status === 'processing') setStep('processing');
        else if (me.check.status === 'pending_consent') { setStep('consent'); setCheckId(me.check.id); }
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleInitiate = async (type) => {
    setSelectedType(type);
    try {
      const data = await apiRequest('/api/background-checks', {
        method: 'POST',
        body: JSON.stringify({ type }),
      });
      setCheckId(data.check.id);
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setStep('payment');
      } else {
        setStep('consent');
      }
    } catch (err) {
      alert(err.message || 'Failed to initiate check');
    }
  };

  const handlePaymentSuccess = async () => {
    try {
      await apiRequest(`/api/background-checks/${checkId}/payment-confirm`, { method: 'POST' });
      setStep('consent');
    } catch (err) {
      alert(err.message || 'Payment confirmation failed');
    }
  };

  const handleConsent = async () => {
    setConsenting(true);
    try {
      await apiRequest(`/api/background-checks/${checkId}/consent`, { method: 'POST' });
      setStep('processing');
      // Poll for completion
      const poll = setInterval(async () => {
        const data = await apiRequest('/api/background-checks/me');
        if (data.check?.status === 'completed') {
          setMyCheck(data.check);
          setStep('complete');
          clearInterval(poll);
        }
      }, 3000);
      setTimeout(() => clearInterval(poll), 60000); // stop after 60s
    } catch (err) {
      alert(err.message || 'Failed to submit consent');
    } finally { setConsenting(false); }
  };

  if (loading) return <div className="bgc-container"><p>Loading...</p></div>;

  return (
    <div className="bgc-container">
      <SEO title="Background Check" path="/background-check" />
      <h1>Background Check</h1>
      <p className="bgc-subtitle">
        Build trust with clients by verifying your background. A badge will appear on your profile.
      </p>

      {step === 'complete' && myCheck && (
        <div className={`bgc-result-card ${myCheck.overall}`}>
          <div className="bgc-result-icon">{myCheck.overall === 'clear' ? '✅' : myCheck.overall === 'consider' ? '⚠️' : '❌'}</div>
          <h2>{myCheck.overall === 'clear' ? 'Background Check Passed!' : 'Background Check Complete'}</h2>
          <p>Status: <strong>{myCheck.overall}</strong></p>
          <p>Valid until: {myCheck.validUntil ? new Date(myCheck.validUntil).toLocaleDateString() : 'N/A'}</p>
          <p className="bgc-result-note">Your profile now shows a verified badge 🛡️</p>
        </div>
      )}

      {step === 'processing' && (
        <div className="bgc-processing-card">
          <div className="bgc-spinner" />
          <h2>Processing Your Background Check</h2>
          <p>This usually takes a few minutes. We'll notify you when it's complete.</p>
        </div>
      )}

      {step === 'consent' && (
        <div className="bgc-consent-card">
          <h2>Consent Required</h2>
          <div className="bgc-consent-text">
            <p>By proceeding, you authorize Fetchwork to:</p>
            <ul>
              <li>Verify your identity using the information you provided</li>
              <li>Search public and proprietary databases for criminal records</li>
              <li>Share the results (pass/fail only) with potential clients on the platform</li>
            </ul>
            <p>Your detailed results are never shared. Only a pass/fail badge is visible.</p>
            <p><strong>This consent is valid for this check only.</strong></p>
          </div>
          <button className="bgc-consent-btn" onClick={handleConsent} disabled={consenting}>
            {consenting ? 'Submitting...' : '✅ I Consent — Start Background Check'}
          </button>
        </div>
      )}

      {step === 'payment' && clientSecret && (
        <div className="bgc-payment-card">
          <h2>Payment</h2>
          <p>
            {options.find(o => o.id === selectedType)?.label} — ${options.find(o => o.id === selectedType)?.price?.toFixed(2)}
          </p>
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
            <PaymentForm onSuccess={handlePaymentSuccess} />
          </Elements>
        </div>
      )}

      {step === 'select' && (
        <div className="bgc-options">
          {options.map(opt => (
            <div key={opt.id} className="bgc-option-card">
              <div className="bgc-option-header">
                <h3>{opt.label}</h3>
                <span className="bgc-option-price">${opt.price?.toFixed(2)}</span>
              </div>
              <p className="bgc-option-desc">{opt.description}</p>
              <button className="bgc-option-btn" onClick={() => handleInitiate(opt.id)}>
                Get Verified →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BackgroundCheckPage;
