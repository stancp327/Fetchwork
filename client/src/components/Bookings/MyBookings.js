import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../context/RoleContext';
import { apiRequest } from '../../utils/api';
import SEO from '../common/SEO';
import './MyBookings.css';

function formatTime12(time24) {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

const STATUS_LABELS = {
  pending:   { label: 'Pending',   cls: 'warning' },
  confirmed: { label: 'Confirmed', cls: 'success' },
  cancelled: { label: 'Cancelled', cls: 'danger' },
  completed: { label: 'Completed', cls: 'muted' },
  no_show:   { label: 'No Show',   cls: 'danger' },
};

const MyBookings = () => {
  const { user } = useAuth();
  const { isFreelancerMode } = useRole();
  const role = isFreelancerMode ? 'freelancer' : 'client';

  const [tab, setTab]           = useState('upcoming');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [msg, setMsg]           = useState('');

  const flash = (text) => { setMsg(text); setTimeout(() => setMsg(''), 4000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`/api/bookings/me?role=${role}&status=${tab}`);
      setBookings(data.bookings || []);
    } catch (err) {
      flash('Failed to load bookings: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [role, tab]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (bookingId, action) => {
    setActionLoading(`${bookingId}_${action}`);
    try {
      await apiRequest(`/api/bookings/${bookingId}/${action}`, { method: 'PATCH' });
      flash(`Booking ${action}ed ✅`);
      load();
    } catch (err) {
      flash('Failed: ' + err.message);
    } finally {
      setActionLoading('');
    }
  };

  const handleCancel = async (bookingId) => {
    const reason = window.prompt('Cancellation reason (optional):');
    if (reason === null) return; // user hit Cancel on prompt
    setActionLoading(`${bookingId}_cancel`);
    try {
      await apiRequest(`/api/bookings/${bookingId}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
      });
      flash('Booking cancelled');
      load();
    } catch (err) {
      flash('Failed: ' + err.message);
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div className="mb-page">
      <SEO title="My Bookings | Fetchwork" path="/bookings" noIndex={true} />

      <h1 className="mb-title">📅 My Bookings</h1>

      <div className="mb-tabs">
        {['upcoming', 'past', 'cancelled'].map(t => (
          <button key={t} className={`mb-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {msg && <div className="mb-msg">{msg}</div>}

      {loading ? (
        <div className="mb-loading">Loading...</div>
      ) : bookings.length === 0 ? (
        <div className="mb-empty">
          <span style={{ fontSize: '2.5rem' }}>📅</span>
          <h3>No {tab} bookings</h3>
          <p>{tab === 'upcoming' ? 'Book a service to get started!' : `You don't have any ${tab} bookings yet.`}</p>
        </div>
      ) : (
        <div className="mb-list">
          {bookings.map(b => {
            const otherPerson = role === 'client' ? b.freelancer : b.client;
            const dateStr = new Date(b.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            const statusInfo = STATUS_LABELS[b.status] || { label: b.status, cls: 'muted' };

            return (
              <div key={b._id} className="mb-card">
                <div className="mb-card-top">
                  <div className="mb-card-info">
                    <h3 className="mb-card-service">{b.service?.title || 'Service'}</h3>
                    <p className="mb-card-person">
                      {role === 'client' ? 'with' : 'from'}{' '}
                      <strong>{otherPerson?.firstName} {otherPerson?.lastName}</strong>
                    </p>
                  </div>
                  <span className={`mb-status mb-status-${statusInfo.cls}`}>{statusInfo.label}</span>
                </div>

                <div className="mb-card-details">
                  <span className="mb-card-date">📅 {dateStr}</span>
                  <span className="mb-card-time">🕐 {formatTime12(b.startTime)} — {formatTime12(b.endTime)}</span>
                </div>

                {b.notes && <p className="mb-card-notes">💬 {b.notes}</p>}
                {b.cancellationReason && <p className="mb-card-cancel-reason">Reason: {b.cancellationReason}</p>}

                {/* Actions */}
                <div className="mb-card-actions">
                  {role === 'freelancer' && b.status === 'pending' && (
                    <button className="mb-action-btn confirm" onClick={() => handleAction(b._id, 'confirm')}
                      disabled={actionLoading === `${b._id}_confirm`}>
                      {actionLoading === `${b._id}_confirm` ? '...' : '✅ Confirm'}
                    </button>
                  )}
                  {role === 'freelancer' && b.status === 'confirmed' && (
                    <button className="mb-action-btn complete" onClick={() => handleAction(b._id, 'complete')}
                      disabled={actionLoading === `${b._id}_complete`}>
                      {actionLoading === `${b._id}_complete` ? '...' : '✓ Mark Complete'}
                    </button>
                  )}
                  {['pending', 'confirmed'].includes(b.status) && (
                    <button className="mb-action-btn cancel" onClick={() => handleCancel(b._id)}
                      disabled={actionLoading === `${b._id}_cancel`}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyBookings;
