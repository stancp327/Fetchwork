import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import SEO from '../common/SEO';
import './MultiBookingDetail.css';

function fmtDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTime(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
}
function fmtCents(cents) {
  if (!cents && cents !== 0) return '';
  return `$${(cents / 100).toFixed(2)}`;
}
function fmtDuration(min) {
  if (!min) return '';
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
}

const STATUS_CLS = {
  pending:              'warning',
  confirmed:            'success',
  partially_completed:  'info',
  completed:            'muted',
  cancelled:            'danger',
};

const MultiBookingDetail = () => {
  const { id }             = useParams();
  const [multi, setMulti]  = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]  = useState(true);
  const [error, setError]      = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [msg, setMsg]            = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`/api/bookings/multi/${id}`);
      setMulti(data.multiBooking);
      setBookings(data.bookings || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async () => {
    if (!window.confirm('Cancel this entire multi-service booking?')) return;
    setCancelling(true);
    try {
      await apiRequest(`/api/bookings/multi/${id}/cancel`, {
        method: 'PATCH',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({}),
      });
      setMsg('Booking cancelled.');
      await load();
    } catch (err) {
      setMsg('Error: ' + err.message);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <div className="mbd-loading">Loading…</div>;
  if (error)   return (
    <div className="mbd-error">
      <p>{error}</p>
      <Link to="/bookings">← My Bookings</Link>
    </div>
  );
  if (!multi) return null;

  const statusCls = STATUS_CLS[multi.status] || 'muted';
  const isActive  = ['pending', 'confirmed'].includes(multi.status);

  return (
    <div className="mbd-page">
      <SEO title="Multi-Service Booking | Fetchwork" path={`/bookings/multi/${id}`} noIndex />

      <div className="mbd-back-bar">
        <Link to="/bookings" className="mbd-back">← My Bookings</Link>
      </div>

      {msg && <div className="mbd-msg">{msg}</div>}

      <div className="mbd-header">
        <h1 className="mbd-title">Multi-Service Session</h1>
        <span className={`mbd-status mbd-status-${statusCls}`}>{multi.status.replace(/_/g, ' ')}</span>
      </div>

      {/* Overview card */}
      <div className="mbd-card">
        <h2 className="mbd-section-title">Session Overview</h2>
        <div className="mbd-grid">
          <div className="mbd-field">
            <span className="mbd-field-label">Date</span>
            <span className="mbd-field-value">{fmtDate(multi.combinedStartAtUtc)}</span>
          </div>
          <div className="mbd-field">
            <span className="mbd-field-label">Start</span>
            <span className="mbd-field-value">{fmtTime(multi.combinedStartAtUtc)} UTC</span>
          </div>
          <div className="mbd-field">
            <span className="mbd-field-label">End</span>
            <span className="mbd-field-value">{fmtTime(multi.combinedEndAtUtc)} UTC</span>
          </div>
          <div className="mbd-field">
            <span className="mbd-field-label">Total Duration</span>
            <span className="mbd-field-value">{fmtDuration(multi.totalDurationMinutes)}</span>
          </div>
          {multi.totalPriceCents > 0 && (
            <div className="mbd-field">
              <span className="mbd-field-label">Total Price</span>
              <span className="mbd-field-value mbd-price">{fmtCents(multi.totalPriceCents)}</span>
            </div>
          )}
          {multi.timezone && (
            <div className="mbd-field">
              <span className="mbd-field-label">Timezone</span>
              <span className="mbd-field-value">{multi.timezone}</span>
            </div>
          )}
          {multi.notes && (
            <div className="mbd-field mbd-field-full">
              <span className="mbd-field-label">Notes</span>
              <span className="mbd-field-value">{multi.notes}</span>
            </div>
          )}
        </div>
      </div>

      {/* Services timeline */}
      <div className="mbd-card">
        <h2 className="mbd-section-title">Services Timeline</h2>
        <div className="mbd-timeline">
          {bookings.map((b, i) => {
            const occ = b.occurrences?.[0];
            const pricing = b.pricingSnapshotJson || {};
            return (
              <div key={b.id} className="mbd-timeline-item">
                <div className="mbd-timeline-dot">{i + 1}</div>
                <div className="mbd-timeline-content">
                  <div className="mbd-timeline-title">
                    {pricing.serviceTitle || `Service ${i + 1}`}
                  </div>
                  {occ && (
                    <div className="mbd-timeline-time">
                      {fmtTime(occ.startAtUtc)} — {fmtTime(occ.endAtUtc)} UTC
                    </div>
                  )}
                  {pricing.amountCents > 0 && (
                    <div className="mbd-timeline-price">{fmtCents(pricing.amountCents)}</div>
                  )}
                  <Link to={`/bookings/${b.id}`} className="mbd-timeline-link">View details</Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cancel button */}
      {isActive && (
        <div className="mbd-actions">
          <button
            className="mbd-btn-cancel"
            onClick={handleCancel}
            disabled={cancelling}
          >
            {cancelling ? 'Cancelling…' : 'Cancel All Bookings'}
          </button>
        </div>
      )}
    </div>
  );
};

export default MultiBookingDetail;
