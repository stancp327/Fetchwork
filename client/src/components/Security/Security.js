import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api';
import SEO from '../common/SEO';
import './Security.css';

const Security = () => {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Change password state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' });
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  useEffect(() => {
    apiRequest('/api/auth/security-info')
      .then(d => { setInfo(d); setLoading(false); })
      .catch(() => { setError('Failed to load security info'); setLoading(false); });
  }, []);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwMsg({ type: '', text: '' });

    if (newPw.length < 8) {
      return setPwMsg({ type: 'error', text: 'Password must be at least 8 characters' });
    }
    const pwRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])/;
    if (!pwRegex.test(newPw)) {
      return setPwMsg({ type: 'error', text: 'Must include uppercase, lowercase, number, and special character' });
    }
    if (newPw !== confirmPw) {
      return setPwMsg({ type: 'error', text: 'Passwords do not match' });
    }

    setPwSaving(true);
    try {
      const res = await apiRequest('/api/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });

      // Update token so current session stays alive
      if (res.token) {
        localStorage.setItem('token', res.token);
      }

      setPwMsg({ type: 'success', text: 'Password changed successfully. Other sessions have been logged out.' });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      setPwMsg({ type: 'error', text: err.message || 'Failed to change password' });
    } finally {
      setPwSaving(false);
    }
  };

  // Password strength indicator
  const getPasswordStrength = (pw) => {
    if (!pw) return { label: '', cls: '' };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[@$!%*?&#]/.test(pw)) score++;
    if (score <= 2) return { label: 'Weak', cls: 'sec-strength-weak' };
    if (score <= 3) return { label: 'Fair', cls: 'sec-strength-fair' };
    if (score <= 4) return { label: 'Good', cls: 'sec-strength-good' };
    return { label: 'Strong', cls: 'sec-strength-strong' };
  };

  const strength = getPasswordStrength(newPw);

  if (loading) return <div className="sec-page"><div className="sec-skeleton" /></div>;
  if (error) return <div className="sec-page"><p className="sec-error">{error}</p></div>;

  return (
    <div className="sec-page">
      <SEO title="Security Settings | Fetchwork" noIndex />

      <div className="sec-header">
        <h1 className="sec-title">🔒 Security Settings</h1>
        <p className="sec-subtitle">Manage your password and account security</p>
      </div>

      {/* Account Overview */}
      <div className="sec-section">
        <h2 className="sec-section-title">Account Overview</h2>
        <div className="sec-info-grid">
          <div className="sec-info-item">
            <span className="sec-info-label">Email</span>
            <span className="sec-info-value">{info.email}</span>
          </div>
          <div className="sec-info-item">
            <span className="sec-info-label">Account created</span>
            <span className="sec-info-value">
              {info.createdAt ? new Date(info.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}
            </span>
          </div>
          <div className="sec-info-item">
            <span className="sec-info-label">Last login</span>
            <span className="sec-info-value">
              {info.lastLoginAt
                ? new Date(info.lastLoginAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
                : 'Unknown'}
            </span>
          </div>
          {(info.lastLoginCity || info.lastLoginCountry) && (
            <div className="sec-info-item">
              <span className="sec-info-label">Last login location</span>
              <span className="sec-info-value">
                {[info.lastLoginCity, info.lastLoginCountry].filter(Boolean).join(', ')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Connected Accounts */}
      <div className="sec-section">
        <h2 className="sec-section-title">Sign-in Methods</h2>
        <div className="sec-methods">
          <div className={`sec-method ${info.hasPassword ? 'sec-method-active' : ''}`}>
            <span className="sec-method-icon">🔑</span>
            <div className="sec-method-info">
              <strong>Email & Password</strong>
              <p>{info.hasPassword ? 'Active' : 'Not set — use Forgot Password to create one'}</p>
            </div>
            <span className={`sec-method-badge ${info.hasPassword ? 'active' : 'inactive'}`}>
              {info.hasPassword ? '✓ Connected' : 'Not set'}
            </span>
          </div>

          <div className={`sec-method ${info.hasGoogle ? 'sec-method-active' : ''}`}>
            <span className="sec-method-icon">🟢</span>
            <div className="sec-method-info">
              <strong>Google</strong>
              <p>{info.hasGoogle ? 'Linked to your Google account' : 'Not connected'}</p>
            </div>
            <span className={`sec-method-badge ${info.hasGoogle ? 'active' : 'inactive'}`}>
              {info.hasGoogle ? '✓ Connected' : '—'}
            </span>
          </div>

          <div className={`sec-method ${info.hasFacebook ? 'sec-method-active' : ''}`}>
            <span className="sec-method-icon">🔵</span>
            <div className="sec-method-info">
              <strong>Facebook</strong>
              <p>{info.hasFacebook ? 'Linked to your Facebook account' : 'Not connected'}</p>
            </div>
            <span className={`sec-method-badge ${info.hasFacebook ? 'active' : 'inactive'}`}>
              {info.hasFacebook ? '✓ Connected' : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Change Password */}
      {info.hasPassword && (
        <div className="sec-section">
          <h2 className="sec-section-title">Change Password</h2>
          <form className="sec-pw-form" onSubmit={handleChangePassword}>
            {pwMsg.text && (
              <div className={`sec-msg sec-msg-${pwMsg.type}`}>{pwMsg.text}</div>
            )}

            <div className="sec-field">
              <label>Current password</label>
              <div className="sec-pw-input-wrap">
                <input
                  type={showCurrentPw ? 'text' : 'password'}
                  value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button type="button" className="sec-pw-toggle" onClick={() => setShowCurrentPw(!showCurrentPw)}>
                  {showCurrentPw ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div className="sec-field">
              <label>New password</label>
              <div className="sec-pw-input-wrap">
                <input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={8}
                />
                <button type="button" className="sec-pw-toggle" onClick={() => setShowNewPw(!showNewPw)}>
                  {showNewPw ? '🙈' : '👁️'}
                </button>
              </div>
              {newPw && (
                <div className={`sec-strength ${strength.cls}`}>
                  <div className="sec-strength-bar">
                    <div className="sec-strength-fill" />
                  </div>
                  <span>{strength.label}</span>
                </div>
              )}
            </div>

            <div className="sec-field">
              <label>Confirm new password</label>
              <input
                type="password"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                required
                autoComplete="new-password"
              />
              {confirmPw && newPw !== confirmPw && (
                <p className="sec-field-error">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              className="sec-save-btn"
              disabled={pwSaving || !currentPw || !newPw || newPw !== confirmPw}
            >
              {pwSaving ? 'Changing...' : '🔒 Change Password'}
            </button>
          </form>
        </div>
      )}

      {/* Security Tips */}
      <div className="sec-section sec-tips">
        <h2 className="sec-section-title">Security Tips</h2>
        <ul className="sec-tips-list">
          <li>Use a unique password you don't use on other sites</li>
          <li>Enable Google or Facebook sign-in as a backup login method</li>
          <li>If you notice suspicious activity, change your password immediately</li>
          <li>Never share your password or account credentials with anyone</li>
        </ul>
      </div>
    </div>
  );
};

export default Security;
