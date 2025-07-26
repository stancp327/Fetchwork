import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Auth.css';

const VerifyEmail = () => {
  const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'error'
  const [message, setMessage] = useState('');
  const [searchParams] = useSearchParams();
  const { verifyEmail } = useAuth();

  const token = searchParams.get('token');

  useEffect(() => {
    const handleVerification = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Invalid verification link. Please check your email for the correct link.');
        return;
      }

      try {
        const result = await verifyEmail(token);
        
        if (result.success) {
          setStatus('success');
          setMessage('Email verified successfully! You can now log in to your account.');
        } else {
          setStatus('error');
          setMessage(result.error || 'Email verification failed. The link may have expired.');
        }
      } catch (error) {
        setStatus('error');
        setMessage('An unexpected error occurred. Please try again.');
      }
    };

    handleVerification();
  }, [token, verifyEmail]);

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">
            {status === 'verifying' && 'Verifying Email...'}
            {status === 'success' && 'Email Verified!'}
            {status === 'error' && 'Verification Failed'}
          </h1>
          <p className="auth-subtitle">
            {status === 'verifying' && 'Please wait while we verify your email address'}
            {status === 'success' && 'Your account has been successfully verified'}
            {status === 'error' && 'We encountered an issue verifying your email'}
          </p>
        </div>

        {status === 'verifying' && (
          <div className="verification-loading">
            <div className="loading-spinner"></div>
            <p>Verifying your email address...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="success-message">
            {message}
          </div>
        )}

        {status === 'error' && (
          <div className="error-message">
            {message}
          </div>
        )}

        <div className="auth-footer">
          {status === 'success' && (
            <p><Link to="/login" className="auth-link">Sign in to your account</Link></p>
          )}
          {status === 'error' && (
            <p>
              <Link to="/register" className="auth-link">Create a new account</Link> or{' '}
              <Link to="/login" className="auth-link">try signing in</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
