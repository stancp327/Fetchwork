import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Auth.css';

const OAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAuthFromOAuth } = useAuth();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      const token = searchParams.get('token');
      const userParam = searchParams.get('user');
      const error = searchParams.get('error');

      if (error) {
        navigate('/login?error=oauth_failed');
        return;
      }

      if (token && userParam) {
        try {
          const user = JSON.parse(decodeURIComponent(userParam));
          
          localStorage.setItem('token', token);
          setAuthFromOAuth(token, user);
          
          navigate('/dashboard');
        } catch (error) {
          console.error('OAuth callback error:', error);
          navigate('/login?error=oauth_failed');
        }
      } else {
        navigate('/login?error=oauth_failed');
      }
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
