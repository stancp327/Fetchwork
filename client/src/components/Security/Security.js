import React, { useState, useEffect, useCallback } from 'react';
import './Security.css';

const Security = () => {
  const [securityStatus, setSecurityStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);
  const [showFraudReport, setShowFraudReport] = useState(false);
  const [fraudReport, setFraudReport] = useState({
    reportedUserId: '',
    reportType: 'fraud',
    description: ''
  });
  const [message, setMessage] = useState('');

  const getApiBaseUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:10000';
    }
    return window.location.origin.replace(/:\d+/, ':10000');
  };

  const API_BASE_URL = getApiBaseUrl();

  const fetchSecurityStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/auth/security-status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSecurityStatus(data);
      }
    } catch (error) {
      console.error('Error fetching security status:', error);
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL]);

  useEffect(() => {
    fetchSecurityStatus();
  }, [fetchSecurityStatus]);

  const resendEmailVerification = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setMessage('Verification email sent successfully');
      } else {
        const data = await response.json();
        setMessage(data.message || 'Failed to send verification email');
      }
    } catch (error) {
      setMessage('Error sending verification email');
    }
  };

  const sendPhoneVerification = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/auth/send-phone-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ phoneNumber })
      });

      if (response.ok) {
        setShowPhoneVerification(true);
        setMessage('Verification code sent to your phone');
      } else {
        const data = await response.json();
        setMessage(data.message || 'Failed to send verification code');
      }
    } catch (error) {
      setMessage('Error sending verification code');
    }
  };

  const verifyPhone = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-phone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ token: verificationCode })
      });

      if (response.ok) {
        setMessage('Phone number verified successfully');
        setShowPhoneVerification(false);
        fetchSecurityStatus();
      } else {
        const data = await response.json();
        setMessage(data.message || 'Invalid verification code');
      }
    } catch (error) {
      setMessage('Error verifying phone number');
    }
  };

  const submitFraudReport = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/auth/report-fraud`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(fraudReport)
      });

      if (response.ok) {
        setMessage('Fraud report submitted successfully');
        setShowFraudReport(false);
        setFraudReport({
          reportedUserId: '',
          reportType: 'fraud',
          description: ''
        });
      } else {
        const data = await response.json();
        setMessage(data.message || 'Failed to submit report');
      }
    } catch (error) {
      setMessage('Error submitting fraud report');
    }
  };

  const getVerificationLevelColor = (level) => {
    switch (level) {
      case 'fully_verified': return '#4CAF50';
      case 'phone_verified': return '#FF9800';
      case 'email_verified': return '#2196F3';
      default: return '#f44336';
    }
  };

  const getVerificationLevelText = (level) => {
    switch (level) {
      case 'fully_verified': return 'Fully Verified';
      case 'phone_verified': return 'Phone Verified';
      case 'email_verified': return 'Email Verified';
      default: return 'Unverified';
    }
  };

  if (loading) {
    return <div className="security-loading">Loading security settings...</div>;
  }

  return (
    <div className="security-container">
      <div className="security-header">
        <h1>Security & Verification</h1>
        <p>Manage your account security and verification settings</p>
      </div>

      {message && (
        <div className="security-message">
          {message}
          <button onClick={() => setMessage('')} className="close-message">×</button>
        </div>
      )}

      <div className="security-sections">
        <div className="security-section">
          <h2>Account Verification</h2>
          <div className="verification-status">
            <div className="verification-level">
              <span 
                className="verification-badge"
                style={{ backgroundColor: getVerificationLevelColor(securityStatus?.verificationLevel) }}
              >
                {getVerificationLevelText(securityStatus?.verificationLevel)}
              </span>
            </div>
          </div>

          <div className="verification-items">
            <div className="verification-item">
              <div className="verification-info">
                <h3>Email Verification</h3>
                <p>Verify your email address to secure your account</p>
              </div>
              <div className="verification-status">
                {securityStatus?.isEmailVerified ? (
                  <span className="verified">✓ Verified</span>
                ) : (
                  <button onClick={resendEmailVerification} className="verify-button">
                    Send Verification Email
                  </button>
                )}
              </div>
            </div>

            <div className="verification-item">
              <div className="verification-info">
                <h3>Phone Verification</h3>
                <p>Add and verify your phone number for enhanced security</p>
              </div>
              <div className="verification-status">
                {securityStatus?.isPhoneVerified ? (
                  <span className="verified">✓ Verified</span>
                ) : (
                  <div className="phone-verification">
                    {!showPhoneVerification ? (
                      <div className="phone-input">
                        <input
                          type="tel"
                          placeholder="Enter phone number"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="phone-field"
                        />
                        <button onClick={sendPhoneVerification} className="verify-button">
                          Send Code
                        </button>
                      </div>
                    ) : (
                      <div className="code-input">
                        <input
                          type="text"
                          placeholder="Enter verification code"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value)}
                          className="code-field"
                        />
                        <button onClick={verifyPhone} className="verify-button">
                          Verify
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="security-section">
          <h2>Account Security</h2>
          <div className="security-items">
            <div className="security-item">
              <div className="security-info">
                <h3>Last Login</h3>
                <p>{securityStatus?.lastLogin ? new Date(securityStatus.lastLogin).toLocaleString() : 'Never'}</p>
              </div>
            </div>

            <div className="security-item">
              <div className="security-info">
                <h3>Two-Factor Authentication</h3>
                <p>Add an extra layer of security to your account</p>
              </div>
              <div className="security-status">
                {securityStatus?.twoFactorEnabled ? (
                  <span className="enabled">✓ Enabled</span>
                ) : (
                  <button className="enable-button" disabled>
                    Enable 2FA (Coming Soon)
                  </button>
                )}
              </div>
            </div>

            <div className="security-item">
              <div className="security-info">
                <h3>Account Status</h3>
                <p>Your account security status</p>
              </div>
              <div className="security-status">
                {securityStatus?.isLocked ? (
                  <span className="locked"><span role="img" aria-label="locked">🔒</span> Temporarily Locked</span>
                ) : (
                  <span className="active"><span role="img" aria-label="check mark">✓</span> Active</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="security-section">
          <h2>Report Fraud or Abuse</h2>
          <p>Help keep FetchWork safe by reporting suspicious activity</p>
          
          {!showFraudReport ? (
            <button 
              onClick={() => setShowFraudReport(true)} 
              className="report-button"
            >
              Report Fraud or Abuse
            </button>
          ) : (
            <div className="fraud-report-form">
              <div className="form-group">
                <label>User ID to Report:</label>
                <input
                  type="text"
                  placeholder="Enter user ID"
                  value={fraudReport.reportedUserId}
                  onChange={(e) => setFraudReport({...fraudReport, reportedUserId: e.target.value})}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Report Type:</label>
                <select
                  value={fraudReport.reportType}
                  onChange={(e) => setFraudReport({...fraudReport, reportType: e.target.value})}
                  className="form-select"
                >
                  <option value="fraud">Fraud</option>
                  <option value="abuse">Abuse</option>
                  <option value="spam">Spam</option>
                  <option value="fake_profile">Fake Profile</option>
                  <option value="payment_dispute">Payment Dispute</option>
                  <option value="harassment">Harassment</option>
                  <option value="inappropriate_content">Inappropriate Content</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Description:</label>
                <textarea
                  placeholder="Describe the issue in detail..."
                  value={fraudReport.description}
                  onChange={(e) => setFraudReport({...fraudReport, description: e.target.value})}
                  className="form-textarea"
                  rows="4"
                />
              </div>

              <div className="form-actions">
                <button onClick={submitFraudReport} className="submit-button">
                  Submit Report
                </button>
                <button 
                  onClick={() => setShowFraudReport(false)} 
                  className="cancel-button"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Security;
