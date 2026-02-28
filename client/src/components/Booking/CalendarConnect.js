import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import './CalendarConnect.css';

const CalendarConnect = () => {
  const location = useLocation();
  const [googleConnected, setGoogleConnected] = useState(false);
  const [icalUrl,         setIcalUrl]         = useState('');
  const [copied,          setCopied]           = useState(false);
  const [rotating,        setRotating]         = useState(false);
  const [disconnecting,   setDisconnecting]    = useState(false);
  const [toast,           setToast]            = useState('');

  // Check URL params for OAuth callback result
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const calStatus = params.get('calendar');
    if (calStatus === 'connected') showToast('✅ Google Calendar connected!');
    if (calStatus === 'denied')    showToast('Google Calendar access was denied.');
    if (calStatus === 'error')     showToast('Something went wrong. Please try again.');
  }, [location.search]);

  useEffect(() => {
    // Load Google status + iCal URL in parallel
    Promise.all([
      apiRequest('/api/calendar/google/status'),
      apiRequest('/api/calendar/ical-url'),
    ]).then(([gcal, ical]) => {
      setGoogleConnected(gcal.connected);
      setIcalUrl(ical.feedUrl);
    }).catch(() => {});
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const handleGoogleConnect = async () => {
    try {
      const { authUrl } = await apiRequest('/api/calendar/google/connect', { method: 'POST', body: '{}' });
      window.location.href = authUrl;
    } catch (err) {
      showToast(err.message || 'Failed to start Google auth');
    }
  };

  const handleGoogleDisconnect = async () => {
    if (!window.confirm('Disconnect Google Calendar? Future bookings won\'t sync automatically.')) return;
    setDisconnecting(true);
    try {
      await apiRequest('/api/calendar/google/disconnect', { method: 'DELETE' });
      setGoogleConnected(false);
      showToast('Google Calendar disconnected.');
    } catch {
      showToast('Failed to disconnect.');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(icalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const el = document.createElement('input');
      el.value = icalUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRotate = async () => {
    if (!window.confirm('Rotate your iCal URL? Your current subscription will stop updating — you\'ll need to re-add the new URL to your calendar app.')) return;
    setRotating(true);
    try {
      const { feedUrl } = await apiRequest('/api/calendar/ical-rotate', { method: 'POST', body: '{}' });
      setIcalUrl(feedUrl);
      showToast('iCal URL rotated. Re-add the new URL to your calendar app.');
    } catch {
      showToast('Failed to rotate URL.');
    } finally {
      setRotating(false);
    }
  };

  return (
    <div className="cal-connect">
      {toast && <div className="cal-toast">{toast}</div>}

      {/* ── Google Calendar ─────────────────────────────────── */}
      <div className="cal-block">
        <div className="cal-block-header">
          <div className="cal-block-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
              <rect width="22" height="22" rx="3" fill="#4285F4"/>
              <text x="11" y="16" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">G</text>
            </svg>
          </div>
          <div>
            <h4>Google Calendar</h4>
            <p>New bookings appear in your Google Calendar automatically.</p>
          </div>
        </div>

        {googleConnected ? (
          <div className="cal-connected-row">
            <span className="cal-connected-badge">✅ Connected</span>
            <button
              className="cal-disconnect-btn"
              onClick={handleGoogleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </div>
        ) : (
          <button className="cal-connect-btn" onClick={handleGoogleConnect}>
            Connect Google Calendar →
          </button>
        )}
      </div>

      {/* ── iCal Subscription (Apple / Outlook / Any) ───────── */}
      <div className="cal-block">
        <div className="cal-block-header">
          <div className="cal-block-icon cal-block-icon-ical">📅</div>
          <div>
            <h4>Apple Calendar &amp; Others</h4>
            <p>Subscribe to your bookings feed in Apple Calendar, Outlook, or any calendar app that supports iCal.</p>
          </div>
        </div>

        {icalUrl && (
          <>
            <div className="ical-url-row">
              <input
                type="text"
                value={icalUrl}
                readOnly
                className="ical-url-input"
                onClick={e => e.target.select()}
              />
              <button className="ical-copy-btn" onClick={handleCopy}>
                {copied ? '✅ Copied' : 'Copy'}
              </button>
            </div>

            <div className="ical-instructions">
              <details>
                <summary>How to add to Apple Calendar</summary>
                <ol>
                  <li>Open <strong>Calendar</strong> on Mac or iPhone</li>
                  <li>Go to <strong>File → New Calendar Subscription</strong> (Mac) or <strong>Add Account → Other → Add Subscribed Calendar</strong> (iPhone)</li>
                  <li>Paste the URL above and click Subscribe</li>
                  <li>Set refresh interval to <strong>Every hour</strong></li>
                </ol>
              </details>
              <details>
                <summary>How to add to Outlook</summary>
                <ol>
                  <li>Open <strong>Outlook Calendar</strong></li>
                  <li>Click <strong>Add calendar → Subscribe from web</strong></li>
                  <li>Paste the URL above and click Import</li>
                </ol>
              </details>
            </div>

            <div className="ical-rotate-row">
              <span className="ical-rotate-hint">
                ⚠️ If your feed URL is compromised, rotate it to generate a new one.
              </span>
              <button className="ical-rotate-btn" onClick={handleRotate} disabled={rotating}>
                {rotating ? 'Rotating…' : 'Rotate URL'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CalendarConnect;
