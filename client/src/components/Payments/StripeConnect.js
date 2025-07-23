import React, { useState, useEffect } from 'react';
import axios from 'axios';

const getApiBaseUrl = () => {
  return process.env.NODE_ENV === 'production' 
    ? 'https://fetchwork-1.onrender.com' 
    : 'http://localhost:10000';
};

const StripeConnect = ({ user, onConnect, onRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [accountStatus, setAccountStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);

  useEffect(() => {
    fetchAccountStatus();
  }, []);

  const fetchAccountStatus = async () => {
    try {
      setStatusLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${getApiBaseUrl()}/api/payments/account-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAccountStatus(response.data);
    } catch (error) {
      console.error('Error fetching account status:', error);
      setAccountStatus({ connected: false });
    } finally {
      setStatusLoading(false);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    try {
      await onConnect();
    } catch (error) {
      console.error('Error connecting:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await fetchAccountStatus();
    onRefresh();
  };

  if (statusLoading) {
    return (
      <div className="stripe-connect">
        <div className="loading-spinner"></div>
        <p>Loading account status...</p>
      </div>
    );
  }

  const isConnected = accountStatus?.connected;
  const isFullySetup = isConnected && accountStatus?.detailsSubmitted && accountStatus?.chargesEnabled;

  return (
    <div className="stripe-connect">
      <div className="section-header">
        <h2>Stripe Connect</h2>
        <p>Connect your Stripe account to receive payments as a freelancer</p>
      </div>

      <div className="connect-status">
        {isFullySetup ? (
          <div className="connected-status">
            <div className="status-icon connected">&#x2713;</div>
            <div className="status-info">
              <h3>Account Connected & Verified</h3>
              <p>Your Stripe account is fully set up and ready to receive payments</p>
              <p><strong>Account ID:</strong> {accountStatus.accountId}</p>
              <div className="status-details">
                <span className="status-item">&#x2713; Details Submitted</span>
                <span className="status-item">&#x2713; Charges Enabled</span>
                <span className="status-item">{accountStatus.payoutsEnabled ? '✓' : '⚠'} Payouts {accountStatus.payoutsEnabled ? 'Enabled' : 'Pending'}</span>
              </div>
            </div>
          </div>
        ) : isConnected ? (
          <div className="partial-status">
            <div className="status-icon partial">&#x26A0;</div>
            <div className="status-info">
              <h3>Account Setup In Progress</h3>
              <p>Your Stripe account needs additional verification to receive payments</p>
              <p><strong>Account ID:</strong> {accountStatus.accountId}</p>
              <div className="status-details">
                <span className={`status-item ${accountStatus.detailsSubmitted ? 'completed' : 'pending'}`}>
                  {accountStatus.detailsSubmitted ? '✓' : '○'} Details Submitted
                </span>
                <span className={`status-item ${accountStatus.chargesEnabled ? 'completed' : 'pending'}`}>
                  {accountStatus.chargesEnabled ? '✓' : '○'} Charges Enabled
                </span>
                <span className={`status-item ${accountStatus.payoutsEnabled ? 'completed' : 'pending'}`}>
                  {accountStatus.payoutsEnabled ? '✓' : '○'} Payouts Enabled
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="disconnected-status">
            <div className="status-icon disconnected">&#x26A0;</div>
            <div className="status-info">
              <h3>Account Not Connected</h3>
              <p>Connect your Stripe account to receive payments for completed work</p>
            </div>
          </div>
        )}
      </div>

      <div className="connect-actions">
        {!isConnected ? (
          <button 
            onClick={handleConnect}
            disabled={loading}
            className="connect-stripe-btn"
          >
            {loading ? 'Connecting...' : 'Connect Stripe Account'}
          </button>
        ) : !isFullySetup ? (
          <div className="setup-actions">
            <button 
              onClick={handleConnect}
              disabled={loading}
              className="connect-stripe-btn"
            >
              {loading ? 'Opening...' : 'Complete Account Setup'}
            </button>
            <p className="help-text">
              Complete your Stripe account verification to start receiving payments
            </p>
          </div>
        ) : (
          <div className="connected-actions">
            <button onClick={handleRefresh} className="refresh-btn">
              Refresh Status
            </button>
            <p className="help-text">
              Need to update your account details? Contact support for assistance.
            </p>
          </div>
        )}
      </div>

      <div className="stripe-info">
        <h3>About Stripe Connect</h3>
        <ul>
          <li>Secure payment processing powered by Stripe</li>
          <li>Direct deposits to your bank account</li>
          <li>Transparent fee structure (2.9% + 30¢ per transaction)</li>
          <li>Full transaction history and reporting</li>
          <li>PCI compliant and secure</li>
          <li>Fraud protection and dispute management</li>
        </ul>
      </div>

      <div className="payment-requirements">
        <h3>Requirements for Receiving Payments</h3>
        <div className="requirements-list">
          <div className={`requirement-item ${isConnected ? 'completed' : 'pending'}`}>
            <span className="requirement-icon">{isConnected ? '✓' : '○'}</span>
            <span>Connect Stripe Account</span>
          </div>
          <div className={`requirement-item ${accountStatus?.detailsSubmitted ? 'completed' : 'pending'}`}>
            <span className="requirement-icon">{accountStatus?.detailsSubmitted ? '✓' : '○'}</span>
            <span>Complete Identity Verification</span>
          </div>
          <div className={`requirement-item ${accountStatus?.chargesEnabled ? 'completed' : 'pending'}`}>
            <span className="requirement-icon">{accountStatus?.chargesEnabled ? '✓' : '○'}</span>
            <span>Enable Payment Processing</span>
          </div>
          <div className={`requirement-item ${accountStatus?.payoutsEnabled ? 'completed' : 'pending'}`}>
            <span className="requirement-icon">{accountStatus?.payoutsEnabled ? '✓' : '○'}</span>
            <span>Enable Bank Transfers</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StripeConnect;
