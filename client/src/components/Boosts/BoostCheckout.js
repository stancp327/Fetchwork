import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { apiRequest } from '../../utils/api';
import SEO from '../common/SEO';
import './BoostCheckout.css';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

const BOOST_TIERS = {
  '7day':  { label: '7 Days',  price: '$4.99' },
  '14day': { label: '14 Days', price: '$8.99' },
  '30day': { label: '30 Days', price: '$14.99' },
};

// ── Payment Form (inside Elements provider) ─────────────────────
const CheckoutForm = ({ amount, type, itemId, onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setPaying(true);
    setError('');

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/boost-success?type=${type}&id=${itemId}` },
      redirect: 'if_required',
    });

    if (stripeError) {
      setError(stripeError.message);
      setPaying(false);
    } else if (paymentIntent?.status === 'succeeded') {
      onSuccess();
    } else {
      setPaying(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="boost-checkout-form">
      <PaymentElement />
      {error && <div className="boost-checkout-error">{error}</div>}
      <button type="submit" disabled={!stripe || paying} className="boost-checkout-pay-btn">
        {paying ? 'Processing…' : `Pay $${(amount / 100).toFixed(2)}`}
      </button>
    </form>
  );
};

// ── Main Checkout Page ──────────────────────────────────────────
const BoostCheckout = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const clientSecret = searchParams.get('secret');
  const amount = parseInt(searchParams.get('amount')) || 0;
  const type = searchParams.get('type') || 'job'; // job or service
  const itemId = searchParams.get('id');
  const plan = searchParams.get('plan') || '7day';

  const [success, setSuccess] = useState(false);
  const [itemTitle, setItemTitle] = useState('');

  // Fetch item title for display
  useEffect(() => {
    if (!itemId) return;
    const endpoint = type === 'service' ? `/api/services/${itemId}` : `/api/jobs/${itemId}`;
    apiRequest(endpoint)
      .then(data => setItemTitle(data.title || data.job?.title || ''))
      .catch(() => {});
  }, [itemId, type]);

  if (!clientSecret || !itemId) {
    return (
      <div className="boost-checkout-container">
        <SEO title="Boost Checkout" noIndex />
        <div className="boost-checkout-card">
          <div className="boost-checkout-error-state">
            <span className="boost-error-icon">⚠️</span>
            <h2>Invalid Checkout Link</h2>
            <p>This boost checkout link is invalid or has expired.</p>
            <Link to="/projects" className="boost-back-link">← Back to Projects</Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="boost-checkout-container">
        <SEO title="Boost Active!" noIndex />
        <div className="boost-checkout-card">
          <div className="boost-success-state">
            <span className="boost-success-icon">🚀</span>
            <h2>Boost Activated!</h2>
            <p>
              Your {type} {itemTitle ? `"${itemTitle}"` : ''} is now boosted for {BOOST_TIERS[plan]?.label || '7 days'}.
              It will appear higher in search results and browse pages.
            </p>
            <button className="boost-back-btn" onClick={() => navigate('/projects')}>
              ← Back to Projects
            </button>
          </div>
        </div>
      </div>
    );
  }

  const tier = BOOST_TIERS[plan] || BOOST_TIERS['7day'];

  return (
    <div className="boost-checkout-container">
      <SEO title="Boost Checkout" noIndex />
      <div className="boost-checkout-card">
        <div className="boost-checkout-header">
          <span className="boost-header-icon">🚀</span>
          <h1>Boost Your {type === 'service' ? 'Service' : 'Job'}</h1>
          {itemTitle && <p className="boost-item-title">"{itemTitle}"</p>}
        </div>

        <div className="boost-checkout-details">
          <div className="boost-detail-row">
            <span>Boost Duration</span>
            <strong>{tier.label}</strong>
          </div>
          <div className="boost-detail-row">
            <span>Price</span>
            <strong>{tier.price}</strong>
          </div>
          <div className="boost-detail-row boost-benefits">
            <span>What you get</span>
            <ul>
              <li>🔝 Priority placement in search & browse</li>
              <li>👀 More visibility to potential {type === 'service' ? 'clients' : 'freelancers'}</li>
              <li>📊 Boost analytics (impressions & clicks)</li>
            </ul>
          </div>
        </div>

        <div className="boost-checkout-payment">
          <h3>Payment Details</h3>
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
            <CheckoutForm amount={amount} type={type} itemId={itemId} onSuccess={() => setSuccess(true)} />
          </Elements>
        </div>

        <div className="boost-checkout-footer">
          <Link to="/projects" className="boost-cancel-link">Cancel</Link>
        </div>
      </div>
    </div>
  );
};

export default BoostCheckout;
