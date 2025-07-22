import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import './Payments.css';

const getApiBaseUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:10000';
  }
  return window.location.origin.replace(':3000', ':10000');
};

const Payments = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showCreateEscrow, setShowCreateEscrow] = useState(false);
  const [userJobs, setUserJobs] = useState([]);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    if (user) {
      fetchPayments();
      fetchUserJobs();
    }
  }, [user]);

  const fetchPayments = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${getApiBaseUrl()}/api/payments/user`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPayments(response.data.payments);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserJobs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${getApiBaseUrl()}/api/jobs/user`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserJobs(response.data.jobs || []);
    } catch (error) {
      console.error('Error fetching user jobs:', error);
    }
  };

  const fetchTransactions = async (paymentId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${getApiBaseUrl()}/api/payments/transactions/${paymentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTransactions(response.data.transactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const handleCreateEscrow = async (formData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${getApiBaseUrl()}/api/payments/create-escrow`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('Escrow payment created successfully! Please complete payment to secure funds.');
      setShowCreateEscrow(false);
      fetchPayments();
      
      return response.data;
    } catch (error) {
      console.error('Error creating escrow:', error);
      alert(error.response?.data?.message || 'Error creating escrow payment');
    }
  };

  const handleConfirmPayment = async (paymentId, paymentData) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${getApiBaseUrl()}/api/payments/confirm-payment/${paymentId}`, paymentData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('Payment confirmed and funds escrowed successfully!');
      fetchPayments();
    } catch (error) {
      console.error('Error confirming payment:', error);
      alert(error.response?.data?.message || 'Error confirming payment');
    }
  };

  const handleReleasePayment = async (paymentId, forceRelease = false, reason = '') => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${getApiBaseUrl()}/api/payments/release/${paymentId}`, {
        forceRelease,
        reason
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('Payment released successfully!');
      fetchPayments();
    } catch (error) {
      console.error('Error releasing payment:', error);
      alert(error.response?.data?.message || 'Error releasing payment');
    }
  };

  const handleRefundPayment = async (paymentId, reason) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${getApiBaseUrl()}/api/payments/refund/${paymentId}`, {
        reason
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('Payment refunded successfully!');
      fetchPayments();
    } catch (error) {
      console.error('Error refunding payment:', error);
      alert(error.response?.data?.message || 'Error refunding payment');
    }
  };

  const handleDisputePayment = async (paymentId, reason) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${getApiBaseUrl()}/api/payments/dispute/${paymentId}`, {
        reason
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('Payment dispute created successfully!');
      fetchPayments();
    } catch (error) {
      console.error('Error creating dispute:', error);
      alert(error.response?.data?.message || 'Error creating dispute');
    }
  };

  const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: '#f39c12',
      escrowed: '#3498db',
      released: '#27ae60',
      refunded: '#e74c3c',
      disputed: '#e67e22',
      cancelled: '#95a5a6'
    };
    return colors[status] || '#95a5a6';
  };

  const canReleasePayment = (payment) => {
    return payment.status === 'escrowed' && 
           (user?.role === 'admin' || 
            (payment.clientId._id === user?.id && 
             (!payment.coolingOffExpiry || new Date() > new Date(payment.coolingOffExpiry))));
  };

  const canRefundPayment = (payment) => {
    return payment.status === 'escrowed' && 
           (user?.role === 'admin' || 
            payment.clientId._id === user?.id || 
            payment.freelancerId._id === user?.id);
  };

  const canDisputePayment = (payment) => {
    return payment.status === 'escrowed' && 
           (payment.clientId._id === user?.id || 
            payment.freelancerId._id === user?.id);
  };

  if (loading) {
    return (
      <div className="payments">
        <div className="loading">Loading payments...</div>
      </div>
    );
  }

  return (
    <div className="payments">
      <div className="payments-header">
        <h1>Payment Management</h1>
        <p>Secure escrow system for safe transactions</p>
        
        {user?.userType === 'client' && (
          <button 
            className="create-escrow-btn"
            onClick={() => setShowCreateEscrow(true)}
          >
            Create Escrow Payment
          </button>
        )}
      </div>

      {showCreateEscrow && (
        <CreateEscrowModal
          userJobs={userJobs}
          onSubmit={handleCreateEscrow}
          onClose={() => setShowCreateEscrow(false)}
        />
      )}

      <div className="payments-content">
        <div className="payments-list">
          <h2>Your Payments</h2>
          
          {payments.length === 0 ? (
            <div className="no-payments">
              <div className="no-payments-icon"><span role="img" aria-label="credit card">💳</span></div>
              <h3>No payments yet</h3>
              <p>
                {user?.userType === 'client' 
                  ? 'Create an escrow payment to secure funds for your projects'
                  : 'Payments from clients will appear here once jobs are assigned'
                }
              </p>
            </div>
          ) : (
            <div className="payments-grid">
              {payments.map(payment => (
                <div 
                  key={payment._id} 
                  className={`payment-card ${selectedPayment?._id === payment._id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedPayment(payment);
                    fetchTransactions(payment._id);
                  }}
                >
                  <div className="payment-header">
                    <h3>{payment.jobId.title}</h3>
                    <span 
                      className="payment-status"
                      style={{ backgroundColor: getStatusColor(payment.status) }}
                    >
                      {payment.status}
                    </span>
                  </div>
                  
                  <div className="payment-amount">
                    {formatCurrency(payment.amount, payment.currency)}
                  </div>
                  
                  <div className="payment-participants">
                    <div className="participant">
                      <span className="label">Client:</span>
                      <span>{payment.clientId.email}</span>
                    </div>
                    <div className="participant">
                      <span className="label">Freelancer:</span>
                      <span>{payment.freelancerId.email}</span>
                    </div>
                  </div>
                  
                  <div className="payment-dates">
                    <div className="date-item">
                      <span className="label">Created:</span>
                      <span>{formatDate(payment.createdAt)}</span>
                    </div>
                    {payment.escrowDate && (
                      <div className="date-item">
                        <span className="label">Escrowed:</span>
                        <span>{formatDate(payment.escrowDate)}</span>
                      </div>
                    )}
                    {payment.coolingOffExpiry && payment.status === 'escrowed' && (
                      <div className="date-item">
                        <span className="label">Cooling-off ends:</span>
                        <span>{formatDate(payment.coolingOffExpiry)}</span>
                      </div>
                    )}
                  </div>
                  
                  {payment.adminOverride.overridden && (
                    <div className="admin-override">
                      <span className="override-label">Admin Override</span>
                      <span>{payment.adminOverride.reason}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedPayment && (
          <div className="payment-details">
            <h2>Payment Details</h2>
            
            <div className="payment-actions">
              {selectedPayment.status === 'pending' && selectedPayment.clientId._id === user?.id && (
                <button 
                  className="action-btn confirm-btn"
                  onClick={() => {
                    const mockPaymentId = `stripe_${Date.now()}`;
                    handleConfirmPayment(selectedPayment._id, { stripePaymentIntentId: mockPaymentId });
                  }}
                >
                  Confirm Payment (Mock)
                </button>
              )}
              
              {canReleasePayment(selectedPayment) && (
                <button 
                  className="action-btn release-btn"
                  onClick={() => handleReleasePayment(selectedPayment._id)}
                >
                  Release Payment
                </button>
              )}
              
              {canRefundPayment(selectedPayment) && (
                <button 
                  className="action-btn refund-btn"
                  onClick={() => {
                    const reason = prompt('Enter refund reason:');
                    if (reason) handleRefundPayment(selectedPayment._id, reason);
                  }}
                >
                  Request Refund
                </button>
              )}
              
              {canDisputePayment(selectedPayment) && (
                <button 
                  className="action-btn dispute-btn"
                  onClick={() => {
                    const reason = prompt('Enter dispute reason:');
                    if (reason) handleDisputePayment(selectedPayment._id, reason);
                  }}
                >
                  Dispute Payment
                </button>
              )}
              
              {user?.role === 'admin' && selectedPayment.status === 'escrowed' && (
                <button 
                  className="action-btn admin-btn"
                  onClick={() => {
                    const reason = prompt('Enter admin override reason:');
                    if (reason) handleReleasePayment(selectedPayment._id, true, reason);
                  }}
                >
                  Admin Force Release
                </button>
              )}
            </div>

            <div className="fee-breakdown">
              <h3>Fee Breakdown</h3>
              <div className="fee-item">
                <span>Payment Amount:</span>
                <span>{formatCurrency(selectedPayment.amount)}</span>
              </div>
              <div className="fee-item">
                <span>Platform Fee (5%):</span>
                <span>{formatCurrency(selectedPayment.platformFee || selectedPayment.amount * 0.05)}</span>
              </div>
              <div className="fee-item">
                <span>Transaction Fee:</span>
                <span>{formatCurrency(selectedPayment.transactionFee || (selectedPayment.amount * 0.029 + 0.30))}</span>
              </div>
              <div className="fee-item total">
                <span>Freelancer Receives:</span>
                <span>{formatCurrency(selectedPayment.amount - (selectedPayment.platformFee || selectedPayment.amount * 0.05) - (selectedPayment.transactionFee || (selectedPayment.amount * 0.029 + 0.30)))}</span>
              </div>
            </div>

            <div className="transaction-history">
              <h3>Transaction History</h3>
              {transactions.length === 0 ? (
                <p>No transactions yet</p>
              ) : (
                <div className="transactions-list">
                  {transactions.map(transaction => (
                    <div key={transaction._id} className="transaction-item">
                      <div className="transaction-type">{transaction.type}</div>
                      <div className="transaction-amount">{formatCurrency(transaction.amount)}</div>
                      <div className="transaction-status">{transaction.status}</div>
                      <div className="transaction-date">{formatDate(transaction.createdAt)}</div>
                      <div className="transaction-description">{transaction.description}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const CreateEscrowModal = ({ userJobs, onSubmit, onClose }) => {
  const [formData, setFormData] = useState({
    jobId: '',
    amount: '',
    paymentMethod: 'stripe'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.jobId || !formData.amount) {
      alert('Please fill in all required fields');
      return;
    }
    
    onSubmit({
      ...formData,
      amount: parseFloat(formData.amount)
    });
  };

  const assignedJobs = userJobs.filter(job => job.assignedTo && job.status !== 'completed');

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Create Escrow Payment</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="escrow-form">
          <div className="form-group">
            <label>Select Job:</label>
            <select
              value={formData.jobId}
              onChange={(e) => setFormData({...formData, jobId: e.target.value})}
              required
            >
              <option value="">Choose a job...</option>
              {assignedJobs.map(job => (
                <option key={job._id} value={job._id}>
                  {job.title} - Assigned to: {job.assignedTo.email}
                </option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label>Payment Amount ($):</label>
            <input
              type="number"
              step="0.01"
              min="1"
              value={formData.amount}
              onChange={(e) => setFormData({...formData, amount: e.target.value})}
              required
            />
          </div>
          
          <div className="form-group">
            <label>Payment Method:</label>
            <select
              value={formData.paymentMethod}
              onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}
            >
              <option value="stripe">Credit Card (Stripe)</option>
              <option value="paypal">PayPal</option>
              <option value="bank_transfer">Bank Transfer</option>
            </select>
          </div>
          
          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" className="submit-btn">
              Create Escrow
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Payments;
