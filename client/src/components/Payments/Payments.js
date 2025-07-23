import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import PaymentHistory from './PaymentHistory';
import StripeConnect from './StripeConnect';
import EscrowManager from './EscrowManager';
import './Payments.css';

const getApiBaseUrl = () => {
  return process.env.NODE_ENV === 'production' 
    ? 'https://fetchwork-1.onrender.com' 
    : 'http://localhost:10000';
};

const Payments = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('history');
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${getApiBaseUrl()}/api/payments/my-payments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPayments(response.data.payments);
      setError(null);
    } catch (error) {
      console.error('Error fetching payments:', error);
      setError('Failed to load payment history');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectStripe = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${getApiBaseUrl()}/api/payments/connect-account`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      window.location.href = response.data.accountLink;
    } catch (error) {
      console.error('Error connecting Stripe account:', error);
      setError('Failed to connect Stripe account');
    }
  };

  if (loading) {
    return (
      <div className="payments-container">
        <div className="loading-spinner"></div>
        <p>Loading payments...</p>
      </div>
    );
  }

  return (
    <div className="payments-container">
      <div className="payments-header">
        <h1>Payment Management</h1>
        <p>Manage your payments, escrow, and Stripe integration</p>
      </div>

      <div className="payments-tabs">
        <button 
          className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Payment History
        </button>
        <button 
          className={`tab-button ${activeTab === 'escrow' ? 'active' : ''}`}
          onClick={() => setActiveTab('escrow')}
        >
          Escrow Management
        </button>
        <button 
          className={`tab-button ${activeTab === 'connect' ? 'active' : ''}`}
          onClick={() => setActiveTab('connect')}
        >
          Stripe Connect
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="payments-content">
        {activeTab === 'history' && (
          <PaymentHistory payments={payments} onRefresh={fetchPayments} />
        )}
        {activeTab === 'escrow' && (
          <EscrowManager onRefresh={fetchPayments} />
        )}
        {activeTab === 'connect' && (
          <StripeConnect 
            user={user} 
            onConnect={handleConnectStripe}
            onRefresh={fetchPayments}
          />
        )}
      </div>
    </div>
  );
};

export default Payments;
