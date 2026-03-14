import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import './CalendarConnect.css';

const CalendarConnect = () => {
  const [googleStatus, setGoogleStatus]   = useState({ connected: false, email: null });
  const [icalUrl, setIcalUrl]             = useState('');
  const [loadingGoogle, setLoadingGoogle] = useState(true);
  const [loadingIcal, setLoadingIcal]     = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied]               = useState(false);
  const [toast, setToast]                 = useState(null); // { type: 'success'|'error'|'warning', msg }

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // Handle ?calendar= URL param on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const calParam = params.get('calendar');
    if (calParam === 'connected') showToast('success', 'Google Calendar connected!');
    if (calParam === 'error')     showToast('error',   'Could not connect Google Calendar. Please try again.');
    if (calParam === 'denied')    showToast('warning',  'Google Calendar connection was cancelled.');
    if (calParam) {
      params.delete('calendar');
      const newSearch = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (newSearch ? '?' + newSearch : ''));
    }
  }, []);

  const fetchGoogleStatus = useCallback(async () => {
    setLoadingGoogle(true);
    try {
      const data = await apiRequest('/api/calendar/google/status');
      setGoogleStatus({ connected: data.connected, email: data.email });
    } catch {
      // Not connected
    } finally {
      setLoadingGoogle(false);
    }
  }, []);

  const fetchIcalUrl = useCallback(async () => {
    setLoadingIcal(true);
    try {
      const data = await apiRequest('/api/calendar/ical-url');
      setIcalUrl(data.url || '');
    } catch {
      // Not available
    } finally {
      setLoadingIcal(false);
    }
  }, []);

  useEffect(() => {
    fetchGoogleStatus();
    fetchIcalUrl();
  }, [fetchGoogleStatus, fetchIcalUrl]);

  const handleConnectGoogle = async () => {
    setActionLoading(true);
    try {
      const data = await apiRequest('/api/calendar/google/connect');
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (err) {
      showToast('error', err.message || 'Could not start Google auth.');
      setActionLoading(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!window.confirm('Disconnect Google Calendar? Future bookings won\'t sync.')) return;
    setActionLoading(true);
    try {
      await apiRequest('/api/calendar/google/disconnect', { method: 'DELETE' });
      setGoogleStatus({ connected: false, email: null });
      showToast('success', 'Google Calendar disconnected.');
    } catch (err) {
      showToast('error', err.message || 'Could not disconnect.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyIcal = async () => {
    try {
      await navigator.clipboard.writeText(icalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('error', 'Could not copy to clipboard.');
    }
  };

  const handleRotateIcal = async () => {
    if (!window.confirm('Rotate the iCal URL? Your current subscriptions will stop working and you\'ll need to re-subscribe.')) return;
    setActionLoading(true);
    try {
      const data = await apiRequest('/api/calendar/ical-rotate', { method: 'POST' });
      setIcalUrl(data.url || '');
      showToast('success', 'iCal URL rotated. Update your subscriptions.');
    } catch (err) {
      showToast('error', err.message || 'Could not rotate URL.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="cal-connect-wrap">
      <h2 className="cal-connect-title">Calendar Integration</h2>
      <p className="cal-connect-subtitle">Sync your bookings with your preferred calendar app.</p>

      {/* ── Google Calendar ── */}
      <div className="cal-section">
        <div className="cal-section-title">
          <span className="cal-icon">📅</span>
          Google Calendar
        </div>
        <p className="cal-section-desc">
          Automatically add bookings to your Google Calendar as they're confirmed.
        </p>

        {loadingGoogle ? (
          <div className="cal-loading">Checking status…</div>
        ) : googleStatus.connected ? (
          <div className="cal-status-row">
            <span className="cal-connected-badge">✓ Connected</span>
            {googleStatus.email && (
              <span className="cal-connected-email">{googleStatus.email}</span>
            )}
            <button
              className="cal-disconnect-btn"
              onClick={handleDisconnectGoogle}
              disabled={actionLoading}
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className="cal-status-row">
            <button
              className="cal-connect-btn"
              onClick={handleConnectGoogle}
              disabled={actionLoading}
            >
              {actionLoading ? 'Redirecting…' : 'Connect Google Calendar'}
            </button>
          </div>
        )}
      </div>

      {/* ── iCal feed ── */}
      <div className="cal-section">
        <div className="cal-section-title">
          <span className="cal-icon">🗓️</span>
          iCal Feed (Apple, Outlook, others)
        </div>
        <p className="cal-section-desc">
          Subscribe to this URL in any calendar app to see your bookings automatically.
        </p>

        {loadingIcal ? (
          <div className="cal-loading">Loading feed URL…</div>
        ) : icalUrl ? (
          <>
            <div className="cal-ical-url-row">
              <input
                type="text"
                className="cal-ical-input"
                value={icalUrl}
                readOnly
                onFocus={e => e.target.select()}
              />
              <button
                className="cal-copy-btn"
                onClick={handleCopyIcal}
              >
                {copied ? '✓' : 'Copy'}
              </button>
              <button
                className="cal-rotate-btn"
                onClick={handleRotateIcal}
                disabled={actionLoading}
                title="Generate a new URL (invalidates current subscriptions)"
              >
                ↻ Rotate
              </button>
            </div>
            <div className="cal-instructions">
              <strong>How to subscribe:</strong>
              <ul>
                <li><strong>Apple Calendar:</strong> File → New Calendar Subscription → paste URL</li>
                <li><strong>Outlook:</strong> Add Calendar → From Internet → paste URL</li>
                <li><strong>Google Calendar:</strong> Other calendars → From URL → paste URL</li>
              </ul>
              <p className="cal-security-note">
                🔒 Keep this URL private — anyone with it can view your bookings.
              </p>
            </div>
          </>
        ) : (
          <p className="cal-loading">iCal feed not available. Contact support.</p>
        )}
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className={`cal-toast cal-toast-${toast.type}`}>
          {toast.type === 'success' && '✅ '}
          {toast.type === 'error'   && '❌ '}
          {toast.type === 'warning' && '⚠️ '}
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default CalendarConnect;
