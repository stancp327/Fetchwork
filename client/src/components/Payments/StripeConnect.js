import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api';
import './Payments.css';

const StripeConnect = ({ onStatusChange }) => {
  const [status,   setStatus]   = useState(null); // null | loading | { connected, chargesEnabled, payoutsEnabled }
  const [starting, setStarting] = useState(false);
  const [error,    setError]    = useState('');

  const fetchStatus = async () => {
    setStatus('loading');
    try {
      const data = await apiRequest('/api/payments/status');
      setStatus(data);
      if (onStatusChange) onStatusChange(data);
    } catch {
      setStatus({ connected: false });
    }
  };

  useEffect(() => { fetchStatus(); }, []); // eslint-disable-line

  const handleConnect = async () => {
    setStarting(true);
    setError('');
    try {
      const data = await apiRequest('/api/payments/connect-account', { method: 'POST' });
      window.location.href = data.onboardingUrl;
    } catch (err) {
      setError(err.message || 'Failed to start Stripe setup');
      setStarting(false);
    }
  };

  if (status === null || status === 'loading') {
    return <div className="sc-loading">Checking payment status…</div>;
  }

  // Fully connected
  if (status.connected && status.chargesEnabled && status.payoutsEnabled) {
    return (
      <div className="sc-card connected">
        <div className="sc-icon">✅</div>
        <div>
          <strong>Stripe Connected</strong>
          <p>You can receive payments for completed jobs.</p>
        </div>
      </div>
    );
  }

  // Account created but onboarding incomplete
  if (status.connected && !status.detailsSubmitted) {
    return (
      <div className="sc-card incomplete">
        <div className="sc-icon">⚠️</div>
        <div>
          <strong>Finish your bank account setup</strong>
          <p>Your account was created but setup isn't complete. You won't receive payments until you finish.</p>
          <button className="sc-btn" onClick={handleConnect} disabled={starting}>
            {starting ? 'Loading…' : 'Finish Setup →'}
          </button>
        </div>
        {error && <p className="sc-error">{error}</p>}
      </div>
    );
  }

  // Not connected at all
  return (
    <div className="sc-card unconnected">
      <div className="sc-icon">🏦</div>
      <div>
        <strong>Add your bank account to get paid</strong>
        <p>Connect your bank account so Fetchwork can send payments directly when clients release them. Takes about 2 minutes.</p>
        <button className="sc-btn" onClick={handleConnect} disabled={starting}>
          {starting ? 'Loading…' : 'Add Bank Account →'}
        </button>
        <p className="sc-sub">Secured by Stripe. Your bank details are never stored on our servers.</p>
      </div>
      {error && <p className="sc-error">{error}</p>}
    </div>
  );
};

export default StripeConnect;
