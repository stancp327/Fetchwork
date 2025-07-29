import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api';
import './AdminEmailPanel.css';

const AdminEmailPanel = () => {
  const [emailStatus, setEmailStatus] = useState(null);
  const [broadcastForm, setBroadcastForm] = useState({
    subject: '',
    message: '',
    userType: 'all'
  });
  const [testForm, setTestForm] = useState({
    email: '',
    type: 'welcome'
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchEmailStatus();
  }, []);

  const fetchEmailStatus = async () => {
    try {
      const response = await apiRequest('/api/email/status');
      setEmailStatus(response);
    } catch (error) {
      console.error('Error fetching email status:', error);
    }
  };

  const handleBroadcastSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await apiRequest('/api/email/broadcast', {
        method: 'POST',
        body: JSON.stringify(broadcastForm)
      });
      setMessage(`Broadcast sent successfully! Sent: ${response.sent}, Failed: ${response.failed}`);
      setBroadcastForm({ subject: '', message: '', userType: 'all' });
    } catch (error) {
      setMessage(`Error: ${error.message || 'Failed to send broadcast'}`);
    }finally {
      setLoading(false);
    }
  };

  const handleTestSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      await apiRequest('/api/email/test', {
        method: 'POST',
        body: JSON.stringify(testForm)
      });
      setMessage('Test email sent successfully!');
      setTestForm({ email: '', type: 'welcome' });
    } catch (error) {
      setMessage(`Error: ${error.message || 'Failed to send test email'}`);
    }finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-email-panel">
      <h2>Email Management</h2>

      <div className="email-status">
        <h3>Email Service Status</h3>
        {emailStatus ? (
          <div className={`status-indicator ${emailStatus.configured ? 'configured' : 'not-configured'}`}>
            <p><strong>Service:</strong> {emailStatus.service}</p>
            <p><strong>From Email:</strong> {emailStatus.fromEmail}</p>
            <p><strong>Status:</strong> {emailStatus.configured ? 'Configured' : 'Not Configured'}</p>
          </div>
        ) : (
          <p>Loading status...</p>
        )}
      </div>

      <div className="email-actions">
        <div className="broadcast-section">
          <h3>Send Broadcast Email</h3>
          <form onSubmit={handleBroadcastSubmit}>
            <div className="form-group">
              <label>Recipient Type:</label>
              <select
                value={broadcastForm.userType}
                onChange={(e) => setBroadcastForm({...broadcastForm, userType: e.target.value})}
              >
                <option value="all">All Users</option>
                <option value="clients">Clients Only</option>
                <option value="freelancers">Freelancers Only</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Subject:</label>
              <input
                type="text"
                value={broadcastForm.subject}
                onChange={(e) => setBroadcastForm({...broadcastForm, subject: e.target.value})}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Message:</label>
              <textarea
                value={broadcastForm.message}
                onChange={(e) => setBroadcastForm({...broadcastForm, message: e.target.value})}
                rows="6"
                required
              />
            </div>
            
            <button type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send Broadcast'}
            </button>
          </form>
        </div>

        <div className="test-section">
          <h3>Send Test Email</h3>
          <form onSubmit={handleTestSubmit}>
            <div className="form-group">
              <label>Email Address:</label>
              <input
                type="email"
                value={testForm.email}
                onChange={(e) => setTestForm({...testForm, email: e.target.value})}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Email Type:</label>
              <select
                value={testForm.type}
                onChange={(e) => setTestForm({...testForm, type: e.target.value})}
              >
                <option value="welcome">Welcome Email</option>
                <option value="verification">Email Verification</option>
                <option value="password-reset">Password Reset</option>
              </select>
            </div>
            
            <button type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send Test Email'}
            </button>
          </form>
        </div>
      </div>

      {message && (
        <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}
    </div>
  );
};

export default AdminEmailPanel;
