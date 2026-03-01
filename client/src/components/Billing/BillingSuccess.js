import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import SEO from '../common/SEO';
import './BillingSuccess.css';

const BillingSuccess = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const type      = searchParams.get('type');      // 'subscription' | 'wallet'
  const plan      = searchParams.get('plan');       // planSlug for subscriptions
  const amount    = searchParams.get('amount');     // dollar amount for wallet

  const [session, setSession]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [countdown, setCountdown] = useState(5);

  const redirectPath = type === 'wallet' ? '/wallet' : '/billing';

  useEffect(() => {
    if (!sessionId) {
      setError('Missing session ID.');
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const data = await apiRequest(`/api/billing/sessions/${sessionId}`);
        setSession(data);
      } catch (err) {
        // Non-fatal — we still show a generic success message
        console.warn('Could not load session details:', err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sessionId]);

  // Auto-redirect countdown
  useEffect(() => {
    if (loading) return;
    if (countdown <= 0) {
      window.location.href = redirectPath;
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [loading, countdown, redirectPath]);

  const fmtAmount = (cents) =>
    cents ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100) : null;

  const planLabel = plan
    ? plan.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    : 'your plan';

  return (
    <div className="bs-page">
      <SEO title="Payment Successful" path="/billing/success" noIndex={true} />

      <div className="bs-card">
        {loading ? (
          <div className="bs-loading">
            <div className="bs-spinner" />
            <p>Confirming your payment…</p>
          </div>
        ) : error ? (
          <>
            <div className="bs-icon bs-icon-warn">⚠️</div>
            <h1 className="bs-title">Something went wrong</h1>
            <p className="bs-sub">{error}</p>
            <Link to={redirectPath} className="bs-btn">Go to Billing</Link>
          </>
        ) : (
          <>
            <div className="bs-icon bs-icon-success">✅</div>

            {type === 'subscription' ? (
              <>
                <h1 className="bs-title">You're all set!</h1>
                <p className="bs-sub">
                  Your <strong>{planLabel}</strong> subscription is now active.
                  {session?.customerEmail && ` A receipt was sent to ${session.customerEmail}.`}
                </p>
                <div className="bs-detail-row">
                  <span>Plan</span>
                  <span>{planLabel}</span>
                </div>
                {session?.amountTotal && (
                  <div className="bs-detail-row">
                    <span>Amount</span>
                    <span>{fmtAmount(session.amountTotal)}</span>
                  </div>
                )}
              </>
            ) : type === 'wallet' ? (
              <>
                <h1 className="bs-title">Wallet funded!</h1>
                <p className="bs-sub">
                  {amount ? `$${parseFloat(amount).toFixed(2)}` : 'Funds'} have been added to your Fetchwork wallet.
                  {session?.customerEmail && ` Receipt sent to ${session.customerEmail}.`}
                </p>
                {session?.amountTotal && (
                  <div className="bs-detail-row">
                    <span>Amount added</span>
                    <span>{fmtAmount(session.amountTotal)}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <h1 className="bs-title">Payment successful!</h1>
                <p className="bs-sub">Your payment has been processed.</p>
              </>
            )}

            <div className="bs-redirect-notice">
              Redirecting in {countdown}s…
            </div>

            <Link to={redirectPath} className="bs-btn">
              {type === 'wallet' ? 'Go to Wallet' : 'Go to Billing'} →
            </Link>
          </>
        )}
      </div>
    </div>
  );
};

export default BillingSuccess;
