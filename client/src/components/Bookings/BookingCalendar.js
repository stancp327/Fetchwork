import React, { useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';
import './BookingCalendar.css';

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTime12(time24) {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

const BookingCalendar = ({ serviceId, availability }) => {
  const { isAuthenticated } = useAuth();
  const [selectedDate, setSelectedDate]   = useState(null);
  const [slots, setSlots]                 = useState([]);
  const [slotsLoading, setSlotsLoading]   = useState(false);
  const [selectedSlot, setSelectedSlot]   = useState(null);
  const [notes, setNotes]                 = useState('');
  const [booking, setBooking]             = useState(false);
  const [bookingResult, setBookingResult] = useState(null);
  const [error, setError]                 = useState('');

  const maxDays = availability?.maxAdvanceDays || 30;

  // Generate calendar dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates = [];
  for (let i = 0; i < maxDays; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }

  // Check which days have availability windows
  const activeDays = new Set((availability?.windows || []).map(w => w.dayOfWeek));

  const loadSlots = useCallback(async (date) => {
    const dateStr = date.toISOString().split('T')[0];
    setSelectedDate(date);
    setSelectedSlot(null);
    setSlotsLoading(true);
    setError('');
    try {
      const data = await apiRequest(`/api/bookings/slots/${serviceId}?date=${dateStr}`);
      setSlots(data.slots || []);
    } catch (err) {
      setError(err.message);
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [serviceId]);

  const handleBook = async () => {
    if (!selectedDate || !selectedSlot) return;
    setBooking(true); setError('');
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const data = await apiRequest(`/api/bookings/${serviceId}`, {
        method: 'POST',
        body: JSON.stringify({
          date:      dateStr,
          startTime: selectedSlot.startTime,
          endTime:   selectedSlot.endTime,
          notes,
        }),
      });
      setBookingResult(data);
      setSelectedSlot(null);
      setNotes('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBooking(false);
    }
  };

  if (bookingResult) {
    return (
      <div className="bc-success">
        <span className="bc-success-icon">✅</span>
        <h3>Booking Requested!</h3>
        <p>Your booking for {selectedDate?.toLocaleDateString()} has been submitted. The freelancer will confirm shortly.</p>
        <button className="bc-reset-btn" onClick={() => { setBookingResult(null); setSelectedDate(null); }}>
          Book Another Time
        </button>
      </div>
    );
  }

  // Group dates by week for calendar display
  const firstDayOfWeek = dates[0]?.getDay() || 0;

  return (
    <div className="bc-root">
      <h3 className="bc-title">📅 Book a Time</h3>

      {/* Date picker — horizontal scroll on mobile */}
      <div className="bc-date-strip">
        {dates.map((d, i) => {
          const dayNum = d.getDay();
          const hasSlots = activeDays.has(dayNum);
          const isSelected = selectedDate && d.toDateString() === selectedDate.toDateString();
          const isToday = d.toDateString() === today.toDateString();
          return (
            <button
              key={i}
              className={`bc-date-btn ${isSelected ? 'selected' : ''} ${!hasSlots ? 'no-slots' : ''} ${isToday ? 'today' : ''}`}
              onClick={() => hasSlots && loadSlots(d)}
              disabled={!hasSlots}
            >
              <span className="bc-date-day">{DAYS_SHORT[dayNum]}</span>
              <span className="bc-date-num">{d.getDate()}</span>
              <span className="bc-date-month">{d.toLocaleDateString('en-US', { month: 'short' })}</span>
            </button>
          );
        })}
      </div>

      {/* Slots */}
      {selectedDate && (
        <div className="bc-slots-section">
          <h4 className="bc-slots-title">
            Available times — {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h4>

          {slotsLoading ? (
            <p className="bc-loading">Loading available times...</p>
          ) : slots.length === 0 ? (
            <p className="bc-no-slots">No available times for this date</p>
          ) : (
            <div className="bc-slots-grid">
              {slots.map((s, i) => (
                <button
                  key={i}
                  className={`bc-slot-btn ${selectedSlot?.startTime === s.startTime ? 'selected' : ''}`}
                  onClick={() => setSelectedSlot(s)}
                >
                  <span>{formatTime12(s.startTime)}</span>
                  {s.totalSpots > 1 && (
                    <span className="bc-slot-spots">
                      {s.spotsLeft}/{s.totalSpots} spots
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Booking form */}
      {selectedSlot && (
        <div className="bc-book-section">
          <div className="bc-selected-summary">
            <strong>{selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</strong>
            <span>{formatTime12(selectedSlot.startTime)} — {formatTime12(selectedSlot.endTime)}</span>
          </div>
          <textarea
            className="bc-notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any notes for the freelancer (optional)"
            rows={2}
          />
          {!isAuthenticated ? (
            <p className="bc-login-prompt">Please <a href="/login">log in</a> to book</p>
          ) : (
            <button className="bc-book-btn" onClick={handleBook} disabled={booking}>
              {booking ? 'Booking...' : '📅 Book This Time'}
            </button>
          )}
        </div>
      )}

      {error && <div className="bc-error">{error}</div>}
    </div>
  );
};

export default BookingCalendar;
