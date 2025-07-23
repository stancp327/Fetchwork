import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';

const getApiBaseUrl = () => {
  return process.env.NODE_ENV === 'production' 
    ? 'https://fetchwork-1.onrender.com' 
    : 'http://localhost:10000';
};

const EscrowManager = ({ onRefresh }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchEligibleJobs();
  }, []);

  const fetchEligibleJobs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${getApiBaseUrl()}/api/jobs/my-jobs?type=posted`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const eligibleJobs = response.data.jobs.filter(job => 
        job.status === 'in_progress' || job.status === 'completed'
      );
      
      setJobs(eligibleJobs);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setError('Failed to load jobs');
    }
  };

  const handleFundEscrow = async (jobId) => {
    if (!stripe || !elements) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.post(
        `${getApiBaseUrl()}/api/payments/jobs/${jobId}/fund-escrow`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const { clientSecret } = response.data;
      const cardElement = elements.getElement(CardElement);

      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement
        }
      });

      if (result.error) {
        setError(result.error.message);
      } else {
        alert('Escrow funded successfully!');
        onRefresh();
        fetchEligibleJobs();
      }
    } catch (error) {
      console.error('Error funding escrow:', error);
      setError('Failed to fund escrow');
    } finally {
      setLoading(false);
    }
  };

  const handleReleaseEscrow = async (jobId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      await axios.post(
        `${getApiBaseUrl()}/api/payments/jobs/${jobId}/release-escrow`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert('Payment released successfully!');
      onRefresh();
      fetchEligibleJobs();
    } catch (error) {
      console.error('Error releasing payment:', error);
      setError('Failed to release payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="escrow-manager">
      <div className="section-header">
        <h2>Escrow Management</h2>
        <p>Fund escrow for active jobs and release payments when work is completed</p>
      </div>

      {error && (
        <div className="error-message">{error}</div>
      )}

      <div className="card-element-container">
        <label>Payment Method</label>
        <CardElement 
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                  color: '#aab7c4',
                },
              },
            },
          }}
        />
      </div>

      <div className="jobs-list">
        {jobs.length === 0 ? (
          <div className="no-jobs">
            <p>No jobs requiring escrow management</p>
          </div>
        ) : (
          jobs.map((job) => (
            <div key={job._id} className="job-escrow-card">
              <div className="job-info">
                <h3>{job.title}</h3>
                <p>Budget: ${job.budget.amount}</p>
                <p>Status: {job.status}</p>
                <p>Freelancer: {job.freelancer?.firstName} {job.freelancer?.lastName}</p>
              </div>
              
              <div className="escrow-actions">
                {job.status === 'in_progress' && job.escrowAmount === 0 && (
                  <button 
                    onClick={() => handleFundEscrow(job._id)}
                    disabled={loading}
                    className="fund-escrow-btn"
                  >
                    Fund Escrow (${job.budget.amount})
                  </button>
                )}
                
                {job.status === 'completed' && job.escrowAmount > 0 && (
                  <button 
                    onClick={() => handleReleaseEscrow(job._id)}
                    disabled={loading}
                    className="release-payment-btn"
                  >
                    Release Payment (${job.escrowAmount})
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default EscrowManager;
