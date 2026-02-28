import React, { useState, useEffect, useCallback } from 'react';
import { DateTime } from 'luxon';
import { apiRequest } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import './BookingCalendar.css';

const BookingCalendar = ({ freelancerId, freelancerName, onBooked }) => {
  const { user, isAuthenticated } = useAuth();
  const [viewDate,      setViewDate]      = useState(DateTime.now().startOf('month'));
  const [slotsByDate,   setSlotsByDate]   = useState({});
  const [selectedDate,  setSelectedDate]  = useState(null);
  const [selectedSlot,  setSelectedSlot]  = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [booking,       setBooking]       = useState(false);
  const [bookingDone,   setBookingDone]   = useState(null);
  const [holdExpiry,    setHoldExpiry]    = useState(null);
  const [countdown,     setCountdown]     = useState('');
  const [notes,         setNotes]         = useState('');
  const [locationType,  setLocationType]  = useState('virtual');
  const [location,      setLocation]      = useState('');
  const [error,         setError]         = useState('');
  const [freelancerTz,  setFreelancerTz]  = useState('America/Los_Angeles');

  // Fetch slots for the current month view
  const fetchSlots = useCallback(() => {
    const from = viewDate.toFormat('yyyy-MM-dd');
    const to   = viewDate.endOf('month').toFormat('yyyy-MM-dd');
    setLoading(true);
    apiRequest(`/api/availability/${freelancerId}/slots?from=${from}&to=${to}`)
      .then(d => {
        setFreelancerTz(d.freelancerTimezone || 'America/Los_Angeles');
        const byDate = {};
        (d.slots || []).forEach(day => { byDate[day.date] = day; });
        setSlotsByDate(byDate);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [freelancerId, viewDate]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  // Countdown timer for hold
  useEffect(() => {
    if (!holdExpiry) return;
    const id = setInterval(() => {
      const remaining = Math.max(0, new Date(holdExpiry) - Date.now());
      if (remaining === 0) {
        setCountdown('');
        setHoldExpiry(null);
        setSelectedSlot(null);
        setError('Your hold expired. Please select a new time.');
        clearInterval(id);
        return;
      }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setCountdown(`${mins}:${secs.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(id);
  }, [holdExpiry]);

  const handleSelectSlot = (slot) => {
    setSelectedSlot(slot);
    setError('');
  };

  const handleBook = async () => {
    if (!selectedSlot || !isAuthenticated) return;
    setBooking(true);
    setError('');
    try {
      const res = await apiRequest('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          freelancerId,
          startUTC:         selectedSlot.startUTC,
          endUTC:           selectedSlot.endUTC,
          notes,
          locationType,
          location:         locationType !== 'virtual' ? location : undefined,
        }),
      });

      setHoldExpiry(res.holdExpiresAt);

      // Auto-confirm (free booking) — or trigger payment flow if price > 0
      await apiRequest(`/api/bookings/${res.bookingId}/confirm`, { method: 'POST', body: '{}' });

      setBookingDone({
        bookingId:   res.bookingId,
        startUTC:    selectedSlot.startUTC,
        displayTime: selectedSlot.displayTime,
        date:        selectedDate,
        freelancerTz,
      });
      onBooked?.();
    } catch (err) {
      setError(err.message === 'slot_full' ? 'This slot is now full. Please choose another time.' : (err.message || 'Failed to create booking'));
      setSelectedSlot(null);
    } finally {
      setBooking(false);
    }
  };

  // ── Calendar grid ──────────────────────────────────────────────────────
  const daysInMonth = viewDate.daysInMonth;
  const firstDow    = viewDate.startOf('month').weekday % 7; // 0=Sun
  const calDays     = [];
  for (let i = 0; i < firstDow; i++) calDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calDays.push(d);

  const userTz   = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const diffTz   = userTz !== freelancerTz;

  // ── Confirmation screen ─────────────────────────────────────────────
  if (bookingDone) {
    const dtFreelancer = DateTime.fromISO(bookingDone.startUTC, { zone: freelancerTz });
    const dtClient     = DateTime.fromISO(bookingDone.startUTC, { zone: userTz });
    return (
      <div className="bc-confirm">
        <div className="bc-confirm-icon">🎉</div>
        <h3>Booking Confirmed!</h3>
        <p className="bc-confirm-time">
          {dtFreelancer.toFormat('EEEE, MMMM d, yyyy')}<br />
          {dtFreelancer.toFormat('h:mm a')} {freelancerTz.split('/')[1]?.replace('_', ' ')}
          {diffTz && <span className="bc-your-time"> ({dtClient.toFormat('h:mm a')} your time)</span>}
        </p>
        <p className="bc-confirm-sub">
          You'll receive a notification with details. Add to your calendar using the link in your profile.
        </p>
        <button className="bc-confirm-btn" onClick={() => {
          setBookingDone(null); setSelectedSlot(null); setSelectedDate(null);
          fetchSlots();
        }}>
          Book Another
        </button>
      </div>
    );
  }

  return (
    <div className="booking-calendar">
      <div className="bc-header">
        <h3>Book a session with <strong>{freelancerName}</strong></h3>
        {loading && <span className="bc-loading-dot" />}
      </div>

      {/* Month navigation */}
      <div className="bc-month-nav">
        <button onClick={() => { setViewDate(v => v.minus({ months: 1 })); setSelectedDate(null); setSelectedSlot(null); }}>‹</button>
        <span>{viewDate.toFormat('MMMM yyyy')}</span>
        <button onClick={() => { setViewDate(v => v.plus({ months: 1 })); setSelectedDate(null); setSelectedSlot(null); }}>›</button>
      </div>

      {/* Day-of-week headers */}
      <div className="bc-dow-row">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <span key={d}>{d}</span>)}
      </div>

      {/* Calendar grid */}
      <div className="bc-grid">
        {calDays.map((day, i) => {
          if (!day) return <div key={`e${i}`} className="bc-cell empty" />;
          const dateStr = viewDate.set({ day }).toFormat('yyyy-MM-dd');
          const dayData = slotsByDate[dateStr];
          const isPast  = viewDate.set({ day }) < DateTime.now().startOf('day');
          const isSelected = dateStr === selectedDate;
          const hasSlots = !isPast && dayData?.available;

          return (
            <button
              key={dateStr}
              className={`bc-cell ${hasSlots ? 'available' : ''} ${isPast ? 'past' : ''} ${isSelected ? 'selected' : ''}`}
              onClick={() => { if (hasSlots) { setSelectedDate(dateStr); setSelectedSlot(null); }}}
              disabled={!hasSlots}
            >
              <span className="bc-day-num">{day}</span>
              {hasSlots && <span className="bc-dot" />}
            </button>
          );
        })}
      </div>

      {/* Time slot picker */}
      {selectedDate && slotsByDate[selectedDate] && (
        <div className="bc-slots">
          <h4>{DateTime.fromISO(selectedDate).toFormat('EEEE, MMMM d')}</h4>
          <div className="bc-slots-grid">
            {slotsByDate[selectedDate].times.map((slot, i) => {
              const dtClient = DateTime.fromISO(slot.startUTC, { zone: userTz });
              return (
                <button
                  key={i}
                  className={`bc-slot-btn ${selectedSlot?.startUTC === slot.startUTC ? 'selected' : ''} ${!slot.available ? 'full' : ''}`}
                  onClick={() => handleSelectSlot(slot)}
                  disabled={!slot.available}
                >
                  <span className="bc-slot-time">{slot.displayTime}</span>
                  {diffTz && (
                    <span className="bc-slot-your-time">{dtClient.toFormat('h:mm a')} your time</span>
                  )}
                  {slot.capacity > 1 && (
                    <span className="bc-slot-spots">
                      {slot.available ? `${slot.spotsRemaining}/${slot.capacity} spots` : 'Full'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Booking form */}
      {selectedSlot && (
        <div className="bc-book-form">
          <h4>Confirm your session</h4>

          <div className="bc-selected-summary">
            📅 {DateTime.fromISO(selectedDate).toFormat('EEE, MMM d')} at {selectedSlot.displayTime}
            {diffTz && (
              <span className="bc-summary-your-tz">
                {' '}({DateTime.fromISO(selectedSlot.startUTC, { zone: userTz }).toFormat('h:mm a')} your time)
              </span>
            )}
          </div>

          <div className="bc-form-field">
            <label>Session Type</label>
            <select value={locationType} onChange={e => setLocationType(e.target.value)}>
              <option value="virtual">Virtual / Video Call</option>
              <option value="in_person">In Person</option>
              <option value="phone">Phone</option>
            </select>
          </div>

          {locationType === 'in_person' && (
            <div className="bc-form-field">
              <label>Location / Address</label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)}
                placeholder="Enter address or meeting point" />
            </div>
          )}

          <div className="bc-form-field">
            <label>Notes for {freelancerName} <span className="bc-optional">(optional)</span></label>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Any details about what you need..." />
          </div>

          {holdExpiry && countdown && (
            <div className="bc-hold-timer">
              ⏱ Slot reserved for <strong>{countdown}</strong>
            </div>
          )}

          {error && <p className="bc-error">{error}</p>}

          {!isAuthenticated ? (
            <p className="bc-login-note">Please <a href="/login">sign in</a> to complete your booking.</p>
          ) : (
            <button className="bc-confirm-book-btn" onClick={handleBook} disabled={booking}>
              {booking ? 'Confirming…' : 'Confirm Booking'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default BookingCalendar;
