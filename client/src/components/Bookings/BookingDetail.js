import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../context/RoleContext';
import { apiRequest } from '../../utils/api';
import SEO from '../common/SEO';
import RecurringSeriesPanel from './RecurringSeriesPanel';
import './BookingDetail.css';

/* ─── Helpers ─── */
function formatTime12(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

// Works with both SQL (`id`) and Mongo (`_id`) shapes
function bid(b) { return b?.id || b?._id; }

const STATUS_META = {
  pending:   { label: 'Pending',   cls: 'warning', icon: '⏳' },
  hold:      { label: 'Hold',      cls: 'warning', icon: '🔒' },
  confirmed: { label: 'Confirmed', cls: 'success', icon: '✅' },
  cancelled: { label: 'Cancelled', cls: 'danger',  icon: '✕'  },
  completed: { label: 'Completed', cls: 'muted',   icon: '✓'  },
  no_show:   { label: 'No Show',   cls: 'danger',  icon: '👻' },
};

/* ─── Reschedule Modal ─── */
function RescheduleModal({ booking, onClose, onSuccess }) {
  const [date, setDate]         = useState('');
  const [slots, setSlots]       = useState([]);
  const [slotLoad, setSlotLoad] = useState(false);
  const [selected, setSelected] = useState(null);
  const [reason, setReason]     = useState('');
  const [submitting, setSub]    = useState(false);
  const [error, setError]       = useState('');

  const serviceId = booking.serviceId || booking.service?._id || booking.service;

  const loadSlots = useCallback(async (d) => {
    if (!d || !serviceId) return;
    setSlotLoad(true); setError(''); setSelected(null);
    try {
      const data = await apiRequest(`/api/bookings/slots/${serviceId}?date=${d}`);
      setSlots(data.slots || []);
    } catch (err) {
      setError('Could not load slots: ' + err.message);
      setSlots([]);
    } finally {
      setSlotLoad(false);
    }
  }, [serviceId]);

  useEffect(() => {
    if (date) loadSlots(date);
  }, [date, loadSlots]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date || !selected) return;
    setSub(true); setError('');
    try {
      await apiRequest(`/api/bookings/${bid(booking)}/reschedule`, {
        method: 'PATCH',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          newDate:      date,
          newStartTime: selected.startTime,
          newEndTime:   selected.endTime,
          reason,
        }),
      });
      onSuccess('Booking rescheduled ✅');
    } catch (err) {
      setError(err.message);
    } finally {
      setSub(false);
    }
  };

  // Min date = today
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="bd-modal-overlay" onClick={onClose}>
      <div className="bd-modal" onClick={e => e.stopPropagation()}>
        <div className="bd-modal-header">
          <h2>Reschedule Booking</h2>
          <button className="bd-modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="bd-modal-body">
          {error && <div className="bd-modal-error">{error}</div>}

          <label className="bd-label">
            New Date
            <input
              type="date"
              className="bd-input"
              min={today}
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
          </label>

          {date && (
            <div className="bd-slots-section">
              <p className="bd-label-text">Available Slots</p>
              {slotLoad ? (
                <p className="bd-slots-loading">Loading slots…</p>
              ) : slots.length === 0 ? (
                <p className="bd-slots-empty">No availability on this date.</p>
              ) : (
                <div className="bd-slots-grid">
                  {slots.map(s => (
                    <button
                      key={s.startTime}
                      type="button"
                      className={`bd-slot ${selected?.startTime === s.startTime ? 'selected' : ''}`}
                      onClick={() => setSelected(s)}
                    >
                      {formatTime12(s.startTime)}
                      {s.spotsLeft > 1 && <span className="bd-slot-spots"> ({s.spotsLeft} left)</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <label className="bd-label">
            Reason (optional)
            <input
              type="text"
              className="bd-input"
              placeholder="e.g. scheduling conflict"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </label>

          <div className="bd-modal-actions">
            <button type="button" className="bd-btn-secondary" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="bd-btn-primary"
              disabled={submitting || !date || !selected}
            >
              {submitting ? 'Rescheduling…' : 'Confirm Reschedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Main component ─── */
const BookingDetail = () => {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const { user }     = useAuth();
  const { isFreelancerMode } = useRole();
  const role = isFreelancerMode ? 'freelancer' : 'client';

  const [booking, setBooking]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [flash, setFlash]           = useState('');
  const [actionBusy, setActionBusy] = useState('');
  const [showReschedule, setShowReschedule] = useState(false);

  const showFlash = (text) => { setFlash(text); setTimeout(() => setFlash(''), 4500); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`/api/bookings/${id}`);
      setBooking(data.booking || data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const doAction = async (action, body = {}) => {
    setActionBusy(action);
    try {
      await apiRequest(`/api/bookings/${id}/${action}`, {
        method: 'PATCH',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify(body),
      });
      showFlash(`${action.charAt(0).toUpperCase() + action.slice(1)}d ✅`);
      await load();
    } catch (err) {
      showFlash('Error: ' + err.message);
    } finally {
      setActionBusy('');
    }
  };

  const handleCancel = async () => {
    const reason = window.prompt('Reason for cancellation (optional):');
    if (reason === null) return;
    await doAction('cancel', { reason });
  };

  const handleRescheduleSuccess = async (msg) => {
    setShowReschedule(false);
    showFlash(msg);
    await load();
  };

  if (loading) return <div className="bd-loading">Loading booking…</div>;
  if (error)   return (
    <div className="bd-error-page">
      <p>{error}</p>
      <Link to="/bookings" className="bd-back">← Back to My Bookings</Link>
    </div>
  );
  if (!booking) return null;

  const statusMeta = STATUS_META[booking.status] || { label: booking.status, cls: 'muted', icon: '?' };
  const isActive   = ['pending', 'hold', 'confirmed'].includes(booking.status);
  const isMyBooking = booking.clientId === (user?.userId || user?._id?.toString())
    || booking.client?._id?.toString() === (user?.userId || user?._id?.toString());
  const amFreelancer = role === 'freelancer'
    || booking.freelancerId === (user?.userId || user?._id?.toString())
    || booking.freelancer?._id?.toString() === (user?.userId || user?._id?.toString());

  // Pricing display
  const pricing = booking.pricing || booking.pricingSnapshot || {};
  const totalCents = pricing.totalCents || pricing.total;
  const totalDisplay = totalCents != null
    ? `$${(totalCents / 100).toFixed(2)}`
    : (pricing.total != null ? `$${Number(pricing.total).toFixed(2)}` : null);

  return (
    <div className="bd-page">
      <SEO title="Booking Details | Fetchwork" path={`/bookings/${id}`} noIndex />

      <div className="bd-back-bar">
        <Link to="/bookings" className="bd-back">← My Bookings</Link>
      </div>

      {flash && <div className="bd-flash">{flash}</div>}

      {/* Header */}
      <div className="bd-header">
        <div>
          <h1 className="bd-title">
            {booking.service?.title || booking.serviceTitle || 'Booking'}
          </h1>
          {booking.bookingRef && (
            <p className="bd-ref">Ref #{booking.bookingRef}</p>
          )}
        </div>
        <span className={`bd-status bd-status-${statusMeta.cls}`}>
          {statusMeta.icon} {statusMeta.label}
        </span>
      </div>

      {/* Details grid */}
      <div className="bd-card">
        <div className="bd-grid">
          <div className="bd-field">
            <span className="bd-field-label">Date</span>
            <span className="bd-field-value">{formatDate(booking.date)}</span>
          </div>
          <div className="bd-field">
            <span className="bd-field-label">Time</span>
            <span className="bd-field-value">
              {formatTime12(booking.startTime)} — {formatTime12(booking.endTime)}
              {booking.timezone && <span className="bd-tz"> ({booking.timezone.split('/').pop()})</span>}
            </span>
          </div>

          {(booking.client || booking.clientId) && (
            <div className="bd-field">
              <span className="bd-field-label">Client</span>
              <span className="bd-field-value">
                {booking.client
                  ? `${booking.client.firstName} ${booking.client.lastName}`
                  : booking.clientId}
              </span>
            </div>
          )}

          {(booking.freelancer || booking.freelancerId) && (
            <div className="bd-field">
              <span className="bd-field-label">Freelancer</span>
              <span className="bd-field-value">
                {booking.freelancer
                  ? `${booking.freelancer.firstName} ${booking.freelancer.lastName}`
                  : booking.freelancerId}
              </span>
            </div>
          )}

          {totalDisplay && (
            <div className="bd-field">
              <span className="bd-field-label">Total</span>
              <span className="bd-field-value bd-price">{totalDisplay}</span>
            </div>
          )}

          {booking.notes && (
            <div className="bd-field bd-field-full">
              <span className="bd-field-label">Notes</span>
              <span className="bd-field-value">{booking.notes}</span>
            </div>
          )}

          {booking.cancellationReason && (
            <div className="bd-field bd-field-full">
              <span className="bd-field-label">Cancellation Reason</span>
              <span className="bd-field-value bd-cancel-reason">{booking.cancellationReason}</span>
            </div>
          )}
        </div>
      </div>

      {/* Occurrences (recurring / group) */}
      {booking.occurrences?.length > 1 && (
        <div className="bd-card">
          <h2 className="bd-section-title">📆 All Sessions ({booking.occurrences.length})</h2>
          <div className="bd-occurrences">
            {booking.occurrences.map((o, i) => {
              const oDate = o.startAtUtc
                ? new Date(o.startAtUtc).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                : o.date || '—';
              const oTime = o.localStartWallclock
                ? formatTime12(o.localStartWallclock.split('T')[1]?.slice(0, 5))
                : formatTime12(o.startTime);
              return (
                <div key={o.id || i} className={`bd-occurrence ${o.status === 'cancelled' ? 'cancelled' : ''}`}>
                  <span className="bd-occ-no">#{o.occurrenceNo || i + 1}</span>
                  <span className="bd-occ-date">{oDate}</span>
                  <span className="bd-occ-time">{oTime}</span>
                  <span className={`bd-occ-status bd-status-${STATUS_META[o.status]?.cls || 'muted'}`}>
                    {STATUS_META[o.status]?.label || o.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recurring series panel */}
      {!['cancelled', 'completed'].includes(booking.status) && (
        <RecurringSeriesPanel booking={booking} onRefresh={load} />
      )}

      {/* Policy */}
      {booking.policy && Object.keys(booking.policy).length > 0 && (
        <div className="bd-card bd-policy">
          <h2 className="bd-section-title">📋 Cancellation Policy</h2>
          <p className="bd-policy-text">
            {booking.policy.tier === 'strict'   && 'Strict — no refunds within 48 hours.'}
            {booking.policy.tier === 'moderate' && 'Moderate — 50% refund up to 24 hours before.'}
            {booking.policy.tier === 'flexible' && 'Flexible — full refund up to 1 hour before.'}
            {!booking.policy.tier && JSON.stringify(booking.policy)}
          </p>
        </div>
      )}

      {/* Action buttons */}
      {isActive && (
        <div className="bd-actions">
          {amFreelancer && booking.status === 'pending' && (
            <button
              className="bd-btn bd-btn-confirm"
              onClick={() => doAction('confirm')}
              disabled={!!actionBusy}
            >
              {actionBusy === 'confirm' ? '…' : '✅ Confirm Booking'}
            </button>
          )}

          {amFreelancer && booking.status === 'confirmed' && (
            <button
              className="bd-btn bd-btn-complete"
              onClick={() => doAction('complete')}
              disabled={!!actionBusy}
            >
              {actionBusy === 'complete' ? '…' : '✓ Mark Complete'}
            </button>
          )}

          <button
            className="bd-btn bd-btn-reschedule"
            onClick={() => setShowReschedule(true)}
            disabled={!!actionBusy}
          >
            🗓 Reschedule
          </button>

          <button
            className="bd-btn bd-btn-cancel"
            onClick={handleCancel}
            disabled={!!actionBusy}
          >
            {actionBusy === 'cancel' ? '…' : 'Cancel Booking'}
          </button>
        </div>
      )}

      {/* Reschedule modal */}
      {showReschedule && (
        <RescheduleModal
          booking={booking}
          onClose={() => setShowReschedule(false)}
          onSuccess={handleRescheduleSuccess}
        />
      )}
    </div>
  );
};

export default BookingDetail;
