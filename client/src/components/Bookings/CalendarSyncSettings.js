import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import './CalendarSyncSettings.css';

export default function CalendarSyncSettings() {
  const [status, setStatus]   = useState({ connected: false, email: null });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState(null);

  const loadStatus = useCallback(async () => {
    try {
      const data = await apiRequest('/api/calendar/status');
      setStatus(data);
    } catch {
      // not fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();

    // Handle OAuth callback query params
    const params = new URLSearchParams(window.location.search);
    const result = params.get('calendar');
    if (result === 'connected') setMessage({ type: 'success', text: 'Google Calendar connected!' });
    if (result === 'denied')    setMessage({ type: 'error',   text: 'Calendar connection cancelled.' });
    if (result === 'error')     setMessage({ type: 'error',   text: 'Calendar connection failed. Please try again.' });
    if (result) {
      // Clean up query string
      window.history.replaceState({}, '', window.location.pathname);
      if (result === 'connected') loadStatus();
    }
  }, [loadStatus]);

  const handleConnect = () => {
    // Redirect to backend auth URL which redirects to Google
    const base = process.env.REACT_APP_API_URL || 'http://localhost:10000';
    const token = localStorage.getItem('token');
    // Open auth URL — backend reads JWT from state/session
    window.location.href = `${base}/api/calendar/auth?token=${token}`;
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Google Calendar? Synced events will remain in your calendar but new bookings won\'t be added.')) return;
    try {
      await apiRequest('/api/calendar/disconnect', { method: 'DELETE' });
      setStatus({ connected: false, email: null });
      setMessage({ type: 'success', text: 'Google Calendar disconnected.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to disconnect.' });
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const data = await apiRequest('/api/calendar/sync-all', { method: 'POST' });
      setMessage({ type: 'success', text: data.message || 'Sync complete.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Sync failed.' });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <div className="cal-sync-settings"><div className="cal-sync-loading">Loading...</div></div>;

  return (
    <div className="cal-sync-settings">
      <h2 className="cal-sync-title">Google Calendar Sync</h2>
      <p className="cal-sync-description">
        Keep your Google Calendar up to date automatically. Confirmed bookings are pushed to your calendar when they're created, updated, or cancelled.
      </p>

      {message && (
        <div className={`cal-sync-message cal-sync-message--${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="cal-sync-card">
        <div className="cal-sync-status">
          <span className={`cal-sync-dot ${status.connected ? 'cal-sync-dot--green' : 'cal-sync-dot--grey'}`} />
          <span className="cal-sync-status-text">
            {status.connected
              ? <>Connected as <strong>{status.email}</strong></>
              : 'Not connected'}
          </span>
        </div>

        <div className="cal-sync-actions">
          {status.connected ? (
            <>
              <button
                className="cal-sync-btn cal-sync-btn--primary"
                onClick={handleSyncAll}
                disabled={syncing}
              >
                {syncing ? 'Syncing…' : 'Sync All Upcoming Bookings'}
              </button>
              <button
                className="cal-sync-btn cal-sync-btn--danger"
                onClick={handleDisconnect}
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              className="cal-sync-btn cal-sync-btn--primary"
              onClick={handleConnect}
            >
              Connect Google Calendar
            </button>
          )}
        </div>

        <ul className="cal-sync-features">
          <li>Confirmed bookings are automatically added to your calendar</li>
          <li>Cancellations remove the event</li>
          <li>Reschedules update the event time</li>
          <li>One-way sync only: FetchWork → Google Calendar</li>
        </ul>
      </div>
    </div>
  );
}
