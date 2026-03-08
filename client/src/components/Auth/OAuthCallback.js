import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import './Auth.css';

const OAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAuthFromOAuth } = useAuth();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      const error = searchParams.get('error');
      if (error) {
        navigate('/login?error=oauth_failed');
        return;
      }

      // New flow: exchange short-lived code for token (token never in URL)
      const code = searchParams.get('code');
      if (code) {
        try {
          const { data } = await axios.get(
            `${process.env.REACT_APP_API_URL || ''}/api/auth/oauth/exchange`,
            { params: { code } }
          );
          const { token, user } = data;
          localStorage.setItem('token', token);
          setAuthFromOAuth(token, user);
          navigate('/dashboard');
        } catch (err) {
          console.error('OAuth exchange error:', err);
          navigate('/login?error=oauth_failed');
        }
        return;
      }

      // Fallback: legacy token-in-URL (remove after confirming new flow works)
      const token = searchParams.get('token');
      const userParam = searchParams.get('user');
      if (token && userParam) {
        try {
          const user = JSON.parse(decodeURIComponent(userParam));
          localStorage.setItem('token', token);
          setAuthFromOAuth(token, user);
          navigate('/dashboard');
        } catch (err) {
          console.error('OAuth callback error:', err);
          navigate('/login?error=oauth_failed');
        }
        return;
      }

      navigate('/login?error=oauth_failed');
    };

    handleOAuthCallback();
  }, [searchParams, navigate, setAuthFromOAuth]);

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Completing Sign In...</h1>
          <p className="auth-subtitle">Please wait while we finish setting up your account</p>
        </div>
        <div className="verification-loading">
          <div className="loading-spinner"></div>
          <p>Processing your authentication...</p>
        </div>
      </div>
    </div>
  );
};

export default OAuthCallback;
