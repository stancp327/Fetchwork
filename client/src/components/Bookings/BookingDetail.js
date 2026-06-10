import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../context/RoleContext';
import { apiRequest } from '../../utils/api';
import SEO from '../common/SEO';
import RecurringSeriesPanel from './RecurringSeriesPanel';
import BookingPayModal from './BookingPayModal';
import WeatherWidget from '../common/WeatherWidget';
import SessionNotes from './SessionNotes';
import CancellationPolicyDisplay from './CancellationPolicyDisplay';
import IntakeFormFill from './IntakeFormFill';
import IntakeFormView from './IntakeFormView';
import BookingReviewForm from './BookingReviewForm';
import BookingReviewDisplay from './BookingReviewDisplay';
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
  const [showPayModal, setShowPayModal]     = useState(false);

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

  // Check if user already left a review for this booking
  useEffect(() => {
    if (!booking || booking.status !== 'completed') return;
    apiRequest(`/api/booking-reviews/booking/${bid(booking)}`)
      .then(data => {
        const myId = user?.userId || user?._id?.toString();
        const mine = (data.reviews || []).find(r => r.reviewerId === myId);
        setMyReviewExists(!!mine);
      })
      .catch(() => {});
  }, [booking, user]);

  // Load intake form template + response after booking loads
  useEffect(() => {
    if (!booking) return;
    const serviceId = booking.serviceId || booking.serviceOfferingId || booking.service?._id;
    const freelancerId = booking.freelancerId;
    if (!serviceId && !freelancerId) { setIntakeLoaded(true); return; }

    const params = new URLSearchParams();
    if (freelancerId) params.set('freelancerId', freelancerId);
    const templateUrl = serviceId
      ? `/api/intake-forms/${serviceId}?${params}`
      : null;

    const promises = [
      templateUrl ? apiRequest(templateUrl).catch(() => ({ template: null })) : Promise.resolve({ template: null }),
      apiRequest(`/api/intake-forms/responses/${bid(booking)}`).catch(() => ({ response: null })),
    ];

    Promise.all(promises).then(([tData, rData]) => {
      setIntakeTemplate(tData.template || null);
      setIntakeResponse(rData.response || null);
    }).finally(() => setIntakeLoaded(true));
  }, [booking]);

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

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [refundOverride, setRefundOverride] = useState('');
  const [useCustomRefund, setUseCustomRefund] = useState(false);
  const [refundPreview, setRefundPreview] = useState(null);

  // Intake form state
  const [intakeTemplate, setIntakeTemplate] = useState(null);
  const [intakeResponse, setIntakeResponse] = useState(null);
  const [intakeLoaded,   setIntakeLoaded]   = useState(false);

  // Review state
  const [myReviewExists, setMyReviewExists] = useState(false);

  useEffect(() => {
    if (!showCancelModal || !id) return;
    setRefundPreview(null);
    apiRequest(`/api/bookings/${id}/cancellation-preview`)
      .then(data => setRefundPreview(data))
      .catch(() => setRefundPreview(null));
  }, [showCancelModal, id]);

  const handleCancel = async () => {
    const body = { reason: cancelReason };
    if (useCustomRefund && refundOverride !== '') {
      body.refundOverrideCents = Math.round(Number(refundOverride) * 100);
    }
    setShowCancelModal(false);
    setCancelReason('');
    setRefundOverride('');
    setUseCustomRefund(false);
    setRefundPreview(null);
    await doAction('cancel', body);
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

      {/* Weather — only for local/in-person services with a date set */}
      {booking.date && booking.serviceLocation?.coordinates?.coordinates?.length === 2 && (
        <WeatherWidget
          coords={{ lat: booking.serviceLocation.coordinates.coordinates[1], lon: booking.serviceLocation.coordinates.coordinates[0] }}
          targetDate={booking.date}
        />
      )}

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
          <CancellationPolicyDisplay
            policy={{ type: booking.policy.tier || 'moderate', rulesJson: [] }}
          />
        </div>
      )}

      {/* Session Notes */}
      <SessionNotes bookingId={bid(booking)} />

      {/* Intake Form */}
      {intakeLoaded && intakeTemplate && (
        <div className="bd-card">
          <h2 className="bd-section-title">📋 Pre-Session Form</h2>
          {amFreelancer
            ? <IntakeFormView template={intakeTemplate} response={intakeResponse} />
            : intakeResponse
              ? <IntakeFormView template={intakeTemplate} response={intakeResponse} />
              : <IntakeFormFill
                  template={intakeTemplate}
                  bookingId={bid(booking)}
                  onSubmitted={() => {
                    apiRequest(`/api/intake-forms/responses/${bid(booking)}`)
                      .then(d => setIntakeResponse(d.response || null))
                      .catch(() => {});
                  }}
                />
          }
        </div>
      )}

      {/* Reviews — show on completed bookings */}
      {booking.status === 'completed' && (
        <div className="bd-card">
          <h2 className="bd-section-title">⭐ Reviews</h2>
          <BookingReviewDisplay
            userId={amFreelancer ? booking.clientId : booking.freelancerId}
            role={amFreelancer ? 'client' : 'freelancer'}
          />
          {!myReviewExists && (
            <BookingReviewForm
              bookingId={bid(booking)}
              onSubmitted={() => { setMyReviewExists(true); load(); }}
              onCancel={() => {}}
            />
          )}
        </div>
      )}

      {/* Booking payment modal */}
      {showPayModal && (
        <BookingPayModal
          bookingId={bid(booking)}
          onSuccess={() => { setShowPayModal(false); load(); }}
          onClose={() => setShowPayModal(false)}
        />
      )}

      {/* Action buttons */}
      {isActive && (
        <div className="bd-actions">
          {/* Client: pay to confirm when held with a price */}
          {isMyBooking && ['held', 'hold', 'pending_payment'].includes(booking.status) &&
           (booking.pricingSnapshotJson?.amountCents || booking.pricing?.amountCents || 0) > 0 && (
            <button className="bd-btn bd-btn-pay" onClick={() => setShowPayModal(true)}>
              💳 Pay to Confirm
            </button>
          )}

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
            onClick={() => setShowCancelModal(true)}
            disabled={!!actionBusy}
          >
            {actionBusy === 'cancel' ? '…' : 'Cancel Booking'}
          </button>
        </div>
      )}

      {/* Cancel modal */}
      {showCancelModal && (
        <div className="bd-modal-overlay" onClick={() => { setShowCancelModal(false); setRefundPreview(null); }}>
          <div className="bd-modal" onClick={e => e.stopPropagation()}>
            <h3>Cancel Booking</h3>
            <label className="bd-field-label">Reason (optional)</label>
            <textarea
              className="bd-cancel-textarea"
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Why are you cancelling?"
              rows={3}
            />

            {/* Refund preview */}
            {refundPreview && refundPreview.totalCents > 0 && !useCustomRefund && (
              <div className="bd-refund-preview">
                <span className="bd-refund-preview-label">Estimated refund:</span>
                <span className="bd-refund-preview-amount">
                  ${(refundPreview.refundCents / 100).toFixed(2)}
                  <span className="bd-refund-preview-pct"> ({refundPreview.refundPercent}%)</span>
                </span>
              </div>
            )}

            {amFreelancer && totalCents > 0 && (
              <div className="bd-refund-override">
                <label className="bd-checkbox-label">
                  <input
                    type="checkbox"
                    checked={useCustomRefund}
                    onChange={e => setUseCustomRefund(e.target.checked)}
                  />
                  Set custom refund amount
                </label>
                {useCustomRefund && (
                  <div className="bd-refund-input-row">
                    <span className="bd-dollar-sign">$</span>
                    <input
                      type="number"
                      className="bd-refund-input"
                      value={refundOverride}
                      onChange={e => setRefundOverride(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      max={(totalCents / 100).toFixed(2)}
                      step="0.01"
                    />
                    <span className="bd-refund-max">of {totalDisplay} max</span>
                  </div>
                )}
                {!useCustomRefund && booking.policy && (
                  <p className="bd-refund-note">
                    Refund will follow {booking.policy.tier} policy automatically.
                  </p>
                )}
              </div>
            )}

            <div className="bd-modal-actions">
              <button className="bd-btn-secondary" onClick={() => { setShowCancelModal(false); setRefundPreview(null); }}>
                Back
              </button>
              <button className="bd-btn bd-btn-cancel" onClick={handleCancel} disabled={!!actionBusy}>
                {actionBusy === 'cancel' ? '…' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
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
