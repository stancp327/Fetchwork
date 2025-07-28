import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import LoadingSkeleton from '../common/LoadingSkeleton';
import { getApiBaseUrl } from '../../utils/api';
import './Payments.css';

const Payments = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stripeStatus, setStripeStatus] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});

  const API_BASE_URL = getApiBaseUrl();

  useEffect(() => {
    fetchPaymentHistory();
    fetchStripeStatus();
  }, [page]);

  const fetchPaymentHistory = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/payments/history?page=${page}&limit=10`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch payment history');
      }

      const data = await response.json();
      setPayments(data.payments);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching payment history:', error);
      setError('Failed to load payment history');
    } finally {
      setLoading(false);
    }
  };

  const fetchStripeStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/payments/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStripeStatus(data);
      }
    } catch (error) {
      console.error('Error fetching Stripe status:', error);
    }
  };

  const handleConnectStripe = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/payments/connect-account`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to create Stripe account');
      }

      const data = await response.json();
      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      } else {
        fetchStripeStatus();
      }
    } catch (error) {
      console.error('Error connecting Stripe:', error);
      setError('Failed to connect Stripe account');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getPaymentStatusBadge = (status) => {
    const statusClasses = {
      pending: 'status-pending',
      processing: 'status-processing',
      completed: 'status-completed',
      failed: 'status-failed',
      cancelled: 'status-cancelled'
    };

    return (
      <span className={`payment-status-badge ${statusClasses[status] || ''}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getPaymentTypeIcon = (type) => {
    const icons = {
      escrow: '🔒',
      release: '💰',
      refund: '↩️',
      bonus: '🎁',
      dispute_resolution: '⚖️'
    };
    return icons[type] || '💳';
  };

  if (loading && payments.length === 0) {
    return (
      <div className="user-container">
        <div className="payments-header">
          <h1>Payment Management</h1>
          <LoadingSkeleton height="20px" width="200px" />
        </div>
        <div className="payments-content">
          <LoadingSkeleton count={5} height="80px" />
        </div>
      </div>
    );
  }

  return (
    <div className="user-container">
      <div className="payments-header">
        <h1>Payment Management</h1>
        <p>Manage your payments, earnings, and Stripe account</p>
      </div>

      <div className="stripe-status-card">
        <h2>Payment Account Status</h2>
        {stripeStatus ? (
          <div className="stripe-status-content">
            {stripeStatus.connected ? (
              <div className="status-connected">
                <span className="status-icon">✅</span>
                <div className="status-details">
                  <h3>Stripe Account Connected</h3>
                  <p>
                    Charges: {stripeStatus.chargesEnabled ? 'Enabled' : 'Disabled'} | 
                    Payouts: {stripeStatus.payoutsEnabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="status-disconnected">
                <span className="status-icon">⚠️</span>
                <div className="status-details">
                  <h3>Connect Your Payment Account</h3>
                  <p>Connect your Stripe account to receive payments from clients.</p>
                  <button 
                    className="btn btn-primary"
                    onClick={handleConnectStripe}
                  >
                    Connect Stripe Account
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="status-disconnected">
            <span className="status-icon">⚠️</span>
            <div className="status-details">
              <h3>Connect Your Payment Account</h3>
              <p>Connect your Stripe account to receive payments from clients.</p>
              <button 
                className="btn btn-primary"
                onClick={handleConnectStripe}
              >
                Connect Stripe Account
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="payments-history">
        <h2>Payment History</h2>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {payments.length === 0 && !loading ? (
          <div className="empty-state">
            <h3>No payments yet</h3>
            <p>Your payment history will appear here once you start working on projects.</p>
          </div>
        ) : (
          <>
            <div className="payments-list">
              {payments.map((payment) => (
                <div key={payment._id} className="payment-item">
                  <div className="payment-icon">
                    {getPaymentTypeIcon(payment.type)}
                  </div>
                  <div className="payment-details">
                    <div className="payment-main">
                      <h3>{payment.job?.title || 'Unknown Job'}</h3>
                      <p className="payment-description">{payment.description}</p>
                    </div>
                    <div className="payment-meta">
                      <span className="payment-date">{formatDate(payment.createdAt)}</span>
                      <span className="payment-type">{payment.type.replace('_', ' ')}</span>
                    </div>
                  </div>
                  <div className="payment-amount">
                    <div className="amount-value">
                      {formatAmount(payment.amount)}
                    </div>
                    {getPaymentStatusBadge(payment.status)}
                  </div>
                </div>
              ))}
            </div>

            {pagination.pages > 1 && (
              <div className="pagination">
                <button 
                  className="btn btn-secondary"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <span className="page-info">
                  Page {page} of {pagination.pages}
                </span>
                <button 
                  className="btn btn-secondary"
                  disabled={page === pagination.pages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Payments;
