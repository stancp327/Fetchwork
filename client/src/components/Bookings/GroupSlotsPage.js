import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';
import SEO from '../common/SEO';
import './GroupSlotsPage.css';

/* ─── Helpers ─── */
function formatTime12(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function formatDate(d) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function isoDate(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

/* ─── Seat Booking Modal ─── */
function BookSeatsModal({ slot, onClose, onSuccess }) {
  const [seats, setSeats]       = useState(1);
  const [submitting, setSub]    = useState(false);
  const [error, setError]       = useState('');
  const available = slot.spotsLeft ?? (slot.totalCapacity - slot.bookedCount);

  const handleBook = async (e) => {
    e.preventDefault();
    setSub(true); setError('');
    try {
      const res = await apiRequest(`/api/bookings/group/slots/${slot.id}/book`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ seatCount: seats }),
      });
      onSuccess(res);
    } catch (err) {
      if (err.status === 409) {
        setError('Slot is full — join the waitlist instead?');
      } else {
        setError(err.message);
      }
    } finally {
      setSub(false);
    }
  };

  return (
    <div className="gs-modal-overlay" onClick={onClose}>
      <div className="gs-modal" onClick={e => e.stopPropagation()}>
        <div className="gs-modal-header">
          <div>
            <h2>Book Seats</h2>
            <p className="gs-modal-sub">{formatDate(slot.date)} · {formatTime12(slot.startTime)} — {formatTime12(slot.endTime)}</p>
          </div>
          <button className="gs-modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleBook} className="gs-modal-body">
          {error && <div className="gs-modal-error">{error}</div>}

          <div className="gs-modal-info">
            <span>💺 {available} spot{available !== 1 ? 's' : ''} remaining</span>
            {slot.pricePerPersonCents != null && (
              <span>💰 ${(slot.pricePerPersonCents / 100).toFixed(2)} / person</span>
            )}
          </div>

          <label className="gs-label">
            How many seats?
            <div className="gs-seat-picker">
              <button type="button" className="gs-seat-btn" onClick={() => setSeats(s => Math.max(1, s - 1))}>−</button>
              <span className="gs-seat-count">{seats}</span>
              <button type="button" className="gs-seat-btn" onClick={() => setSeats(s => Math.min(available, s + 1))}>+</button>
            </div>
          </label>

          {slot.pricePerPersonCents != null && (
            <p className="gs-modal-total">
              Total: <strong>${((slot.pricePerPersonCents * seats) / 100).toFixed(2)}</strong>
            </p>
          )}

          <div className="gs-modal-actions">
            <button type="button" className="gs-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="gs-btn-primary" disabled={submitting}>
              {submitting ? 'Booking…' : `Book ${seats} Seat${seats > 1 ? 's' : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Success Panel ─── */
function BookingSuccess({ result, slotDate, onDismiss }) {
  return (
    <div className="gs-success">
      <div className="gs-success-icon">🎉</div>
      <h3>You're booked!</h3>
      <p>
        {result.waitlisted
          ? 'You've been added to the waitlist. We'll notify you if a spot opens up.'
          : `Your seat${result.seatCount > 1 ? 's are' : ' is'} confirmed for ${formatDate(slotDate)}.`
        }
      </p>
      <div className="gs-success-actions">
        <Link to="/bookings" className="gs-btn-primary">View My Bookings</Link>
        <button onClick={onDismiss} className="gs-btn-secondary">Browse More</button>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
const GroupSlotsPage = () => {
  const [searchParams] = useSearchParams();
  const serviceId = searchParams.get('serviceId');
  const { isAuthenticated } = useAuth();

  const [fromDate, setFromDate] = useState(isoDate(0));
  const [toDate, setToDate]     = useState(isoDate(30));
  const [slots, setSlots]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const [selectedSlot, setSelectedSlot]   = useState(null);
  const [bookingResult, setBookingResult] = useState(null);
  const [waitlistSlot, setWaitlistSlot]   = useState(null);
  const [waitlistBusy, setWaitlistBusy]   = useState('');

  const loadSlots = useCallback(async () => {
    if (!serviceId) { setError('No serviceId in URL — append ?serviceId=<id>'); return; }
    setLoading(true); setError('');
    try {
      const data = await apiRequest(
        `/api/bookings/group/slots/${serviceId}?fromDate=${fromDate}&toDate=${toDate}`
      );
      setSlots(data.slots || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [serviceId, fromDate, toDate]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  const handleBookSuccess = (result) => {
    setSelectedSlot(null);
    setBookingResult({ result, slotDate: slots.find(s => s.id === selectedSlot?.id)?.date });
    loadSlots();
  };

  const handleWaitlist = async (slot) => {
    if (!isAuthenticated) return;
    setWaitlistBusy(slot.id);
    try {
      await apiRequest(`/api/bookings/group/slots/${slot.id}/waitlist`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ seatCount: 1 }),
      });
      setWaitlistSlot(slot.id);
    } catch (err) {
      alert('Could not join waitlist: ' + err.message);
    } finally {
      setWaitlistBusy('');
    }
  };

  const today = isoDate(0);
  const maxDate = isoDate(90);

  if (bookingResult) {
    return (
      <div className="gs-page">
        <BookingSuccess
          result={bookingResult.result}
          slotDate={bookingResult.slotDate}
          onDismiss={() => { setBookingResult(null); setSlots([]); loadSlots(); }}
        />
      </div>
    );
  }

  return (
    <div className="gs-page">
      <SEO title="Group Classes | Fetchwork" path="/bookings/group" noIndex />

      <div className="gs-header">
        <h1 className="gs-title">📚 Available Sessions</h1>

        <div className="gs-filters">
          <label className="gs-filter-label">
            From
            <input type="date" className="gs-date-input" min={today} max={toDate}
              value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </label>
          <label className="gs-filter-label">
            To
            <input type="date" className="gs-date-input" min={fromDate} max={maxDate}
              value={toDate} onChange={e => setToDate(e.target.value)} />
          </label>
          <button className="gs-search-btn" onClick={loadSlots}>Search</button>
        </div>
      </div>

      {error && <div className="gs-error">{error}</div>}

      {loading ? (
        <div className="gs-loading">Loading sessions…</div>
      ) : slots.length === 0 ? (
        <div className="gs-empty">
          <span className="gs-empty-icon">📅</span>
          <h3>No sessions found</h3>
          <p>Try expanding your date range.</p>
        </div>
      ) : (
        <div className="gs-list">
          {slots.map(slot => {
            const spotsLeft = slot.spotsLeft ?? (slot.totalCapacity - slot.bookedCount);
            const full = spotsLeft <= 0;
            const onWaitlist = waitlistSlot === slot.id;

            return (
              <div key={slot.id} className={`gs-card ${full ? 'full' : ''}`}>
                <div className="gs-card-top">
                  <div>
                    <p className="gs-card-date">{formatDate(slot.date)}</p>
                    <p className="gs-card-time">
                      🕐 {formatTime12(slot.startTime)} — {formatTime12(slot.endTime)}
                    </p>
                  </div>
                  <div className="gs-card-meta">
                    {slot.pricePerPersonCents != null && (
                      <span className="gs-card-price">
                        ${(slot.pricePerPersonCents / 100).toFixed(2)}<span className="gs-per-person"> /person</span>
                      </span>
                    )}
                    <div className={`gs-spots ${full ? 'full' : spotsLeft <= 3 ? 'low' : ''}`}>
                      {full ? 'Full' : `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left`}
                    </div>
                  </div>
                </div>

                {/* Capacity bar */}
                {slot.totalCapacity > 0 && (
                  <div className="gs-capacity-bar">
                    <div
                      className="gs-capacity-fill"
                      style={{ width: `${Math.min(100, ((slot.totalCapacity - spotsLeft) / slot.totalCapacity) * 100)}%` }}
                    />
                  </div>
                )}

                <div className="gs-card-actions">
                  {!full ? (
                    <button
                      className="gs-btn-book"
                      onClick={() => isAuthenticated ? setSelectedSlot(slot) : alert('Please log in to book')}
                    >
                      Book Seats
                    </button>
                  ) : onWaitlist ? (
                    <span className="gs-waitlist-joined">✓ On Waitlist</span>
                  ) : (
                    <button
                      className="gs-btn-waitlist"
                      onClick={() => handleWaitlist(slot)}
                      disabled={waitlistBusy === slot.id}
                    >
                      {waitlistBusy === slot.id ? 'Joining…' : 'Join Waitlist'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedSlot && (
        <BookSeatsModal
          slot={selectedSlot}
          onClose={() => setSelectedSlot(null)}
          onSuccess={handleBookSuccess}
        />
      )}
    </div>
  );
};

export default GroupSlotsPage;
