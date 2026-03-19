import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../context/RoleContext';
import { apiRequest } from '../../utils/api';
import SEO from '../common/SEO';
import './MyBookings.css';

function formatTime12(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// Normalise booking shape: SQL uses `id`; Mongo uses `_id`.
function bid(b) { return b.id || b._id; }

const STATUS_LABELS = {
  pending:    { label: 'Pending',    cls: 'warning' },
  hold:       { label: 'Hold',       cls: 'warning' },
  confirmed:  { label: 'Confirmed',  cls: 'success' },
  proposed:   { label: 'Proposed',   cls: 'warning' },
  cancelled:  { label: 'Cancelled',  cls: 'danger'  },
  completed:  { label: 'Completed',  cls: 'muted'   },
  no_show:    { label: 'No Show',    cls: 'danger'  },
};

// Normalise an Appointment into a booking-like shape for display
function apptToBooking(appt) {
  const start = new Date(appt.startAtUtc);
  return {
    _appt: true,
    id: appt.id,
    status: appt.status === 'proposed' ? 'pending' : appt.status,
    serviceTitle: appt.appointmentType ? appt.appointmentType.replace(/_/g, ' ') : 'Scheduled Session',
    date: start.toISOString().slice(0, 10),
    startTime: `${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')}`,
    endTime: (() => { const e = new Date(appt.endAtUtc); return `${String(e.getHours()).padStart(2,'0')}:${String(e.getMinutes()).padStart(2,'0')}`; })(),
    timezone: appt.timezone,
    notes: appt.notes,
    _fromMessages: true,
  };
}

const MyBookings = () => {
  const { user } = useAuth();
  const { isFreelancerMode } = useRole();
  const role = isFreelancerMode ? 'freelancer' : 'client';

  const [tab, setTab]                   = useState('upcoming');
  const [bookings, setBookings]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [msg, setMsg]                   = useState({ text: '', ok: true });

  const flash = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg({ text: '', ok: true }), 4500); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bookingData, apptData] = await Promise.allSettled([
        apiRequest(`/api/bookings/me?role=${role}&status=${tab}`),
        apiRequest(`/api/appointments/mine?upcoming=${tab === 'upcoming' ? 'true' : tab === 'past' ? 'false' : 'true'}&${tab === 'cancelled' ? 'status=cancelled' : ''}`),
      ]);

      const sqlBookings = bookingData.status === 'fulfilled' ? (bookingData.value.bookings || []) : [];
      const rawAppts    = apptData.status === 'fulfilled'    ? (apptData.value.appointments || []) : [];

      // Filter appointments to match the tab
      const filteredAppts = rawAppts.filter(a => {
        if (tab === 'cancelled') return a.status === 'cancelled';
        if (tab === 'past')      return a.status !== 'cancelled';
        // upcoming: proposed or confirmed
        return a.status === 'proposed' || a.status === 'confirmed';
      });

      const apptBookings = filteredAppts.map(apptToBooking);

      // Merge: SQL bookings first, then appointments; sort by date
      const merged = [...sqlBookings, ...apptBookings].sort((a, b) => {
        const da = a.date ? new Date(a.date + 'T' + (a.startTime || '00:00')).getTime() : 0;
        const db = b.date ? new Date(b.date + 'T' + (b.startTime || '00:00')).getTime() : 0;
        return da - db;
      });

      setBookings(merged);
    } catch (err) {
      flash('Failed to load bookings: ' + err.message, false);
    } finally {
      setLoading(false);
    }
  }, [role, tab]);

  useEffect(() => { load(); }, [load]);

  const doAction = async (bookingId, action, body = {}) => {
    setActionLoading(`${bookingId}_${action}`);
    try {
      await apiRequest(`/api/bookings/${bookingId}/${action}`, {
        method: 'PATCH',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify(body),
      });
      flash(`Booking ${action}d ✅`);
      load();
    } catch (err) {
      flash('Failed: ' + err.message, false);
    } finally {
      setActionLoading('');
    }
  };

  const handleCancel = async (b) => {
    const reason = window.prompt('Cancellation reason (optional):');
    if (reason === null) return;
    await doAction(bid(b), 'cancel', { reason });
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

      {msg.text && (
        <div className={`mb-msg ${msg.ok ? 'mb-msg-ok' : 'mb-msg-err'}`}>{msg.text}</div>
      )}

      {loading ? (
        <div className="mb-loading">Loading…</div>
      ) : bookings.length === 0 ? (
        <div className="mb-empty">
          <span style={{ fontSize: '2.5rem' }}>📅</span>
          <h3>No {tab} bookings</h3>
          <p>{tab === 'upcoming' ? 'Ready to book? Browse services to get started.' : `You don't have any ${tab} bookings yet.`}</p>
          {tab === 'upcoming' && (
            <Link to="/services" className="mb-action-btn view" style={{ display: 'inline-block', marginTop: '1rem' }}>
              Browse Services →
            </Link>
          )}
        </div>
      ) : (
        <div className="mb-list">
          {bookings.map(b => {
            const id          = bid(b);
            const otherPerson = role === 'client' ? b.freelancer : b.client;
            const dateStr     = b.date
              ? new Date(b.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
              : '—';
            const statusInfo  = STATUS_LABELS[b.status] || { label: b.status, cls: 'muted' };
            const isActive    = ['pending', 'hold', 'confirmed'].includes(b.status);

            return (
              <div key={id} className="mb-card">
                <div className="mb-card-top">
                  <div className="mb-card-info">
                    <h3 className="mb-card-service">
                      {b.service?.title || b.serviceTitle || 'Service'}
                      {b._fromMessages && <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.5rem', fontWeight: 400 }}>(scheduled in messages)</span>}
                    </h3>
                    {otherPerson && (
                      <p className="mb-card-person">
                        {role === 'client' ? 'with' : 'from'}{' '}
                        <strong>{otherPerson.firstName} {otherPerson.lastName}</strong>
                      </p>
                    )}
                    {b.bookingRef && (
                      <p className="mb-card-ref">Ref: {b.bookingRef}</p>
                    )}
                  </div>
                  <span className={`mb-status mb-status-${statusInfo.cls}`}>{statusInfo.label}</span>
                </div>

                <div className="mb-card-details">
                  <span className="mb-card-date">📅 {dateStr}</span>
                  {b.startTime && (
                    <span className="mb-card-time">
                      🕐 {formatTime12(b.startTime)} — {formatTime12(b.endTime)}
                    </span>
                  )}
                  {b.timezone && (
                    <span className="mb-card-tz">{b.timezone.split('/').pop()}</span>
                  )}
                </div>

                {b.notes && <p className="mb-card-notes">💬 {b.notes}</p>}
                {b.cancellationReason && (
                  <p className="mb-card-cancel-reason">Reason: {b.cancellationReason}</p>
                )}

                {/* Occurrences count (recurring / group) */}
                {b.occurrences?.length > 1 && (
                  <p className="mb-card-occurrences">
                    📆 {b.occurrences.length} sessions in this series
                  </p>
                )}

                {/* Actions */}
                <div className="mb-card-actions">
                  {b._fromMessages
                    ? <span className="mb-action-btn view" style={{ cursor: 'default', opacity: 0.7 }}>💬 Via Messages</span>
                    : <Link to={`/bookings/${id}`} className="mb-action-btn view">View Details</Link>
                  }

                  {role === 'freelancer' && b.status === 'pending' && (
                    <button
                      className="mb-action-btn confirm"
                      onClick={() => doAction(id, 'confirm')}
                      disabled={actionLoading === `${id}_confirm`}
                    >
                      {actionLoading === `${id}_confirm` ? '…' : '✅ Confirm'}
                    </button>
                  )}

                  {role === 'freelancer' && b.status === 'confirmed' && (
                    <button
                      className="mb-action-btn complete"
                      onClick={() => doAction(id, 'complete')}
                      disabled={actionLoading === `${id}_complete`}
                    >
                      {actionLoading === `${id}_complete` ? '…' : '✓ Complete'}
                    </button>
                  )}

                  {isActive && (
                    <button
                      className="mb-action-btn cancel"
                      onClick={() => handleCancel(b)}
                      disabled={actionLoading === `${id}_cancel`}
                    >
                      {actionLoading === `${id}_cancel` ? '…' : 'Cancel'}
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
