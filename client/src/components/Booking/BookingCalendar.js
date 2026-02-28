import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import './BookingCalendar.css';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const padZero = (n) => String(n).padStart(2, '0');
const toDateStr = (d) => `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;

const BookingCalendar = ({ freelancerId, serviceId, onBooked }) => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [slots, setSlots]               = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [step, setStep]                 = useState('calendar'); // calendar | confirm | held | done
  const [locationType, setLocationType] = useState('remote');
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [booking, setBooking]           = useState(null);
  const [holdCountdown, setHoldCountdown] = useState(0);

  // Fetch slots when month changes
  const fetchSlots = useCallback(async () => {
    if (!freelancerId) return;
    setLoading(true);
    setError('');
    try {
      const start = toDateStr(currentMonth);
      const end   = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      const endStr = toDateStr(end);
      const data = await apiRequest(`/api/availability/${freelancerId}/slots?start=${start}&end=${endStr}`);
      setSlots(data.slots || {});
    } catch (err) {
      setError('Could not load availability. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [freelancerId, currentMonth]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  // Hold countdown timer
  useEffect(() => {
    if (step !== 'held' || !booking?.holdExpiresAt) return;
    const calc = () => {
      const diff = Math.floor((new Date(booking.holdExpiresAt) - Date.now()) / 1000);
      setHoldCountdown(Math.max(0, diff));
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [step, booking]);

  const prevMonth = () => setCurrentMonth(d => {
    const n = new Date(d);
    n.setMonth(n.getMonth() - 1);
    return n;
  });

  const nextMonth = () => setCurrentMonth(d => {
    const n = new Date(d);
    n.setMonth(n.getMonth() + 1);
    return n;
  });

  // Build calendar grid
  const buildGrid = () => {
    const year  = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const first = new Date(year, month, 1).getDay(); // 0=Sun
    const days  = new Date(year, month + 1, 0).getDate();
    const today = toDateStr(new Date());

    const cells = [];
    // Leading empty cells
    for (let i = 0; i < first; i++) {
      cells.push({ key: `pre-${i}`, empty: true });
    }
    // Days in month
    for (let d = 1; d <= days; d++) {
      const dateStr = `${year}-${padZero(month + 1)}-${padZero(d)}`;
      const daySlots = slots[dateStr] || [];
      const isPast   = dateStr < today;
      cells.push({
        key:       dateStr,
        date:      d,
        dateStr,
        isPast,
        isToday:   dateStr === today,
        available: !isPast && daySlots.length > 0,
        slotCount: daySlots.length,
      });
    }
    return cells;
  };

  const handleDateClick = (cell) => {
    if (!cell.available) return;
    setSelectedDate(cell.dateStr);
    setSelectedSlot(null);
    setStep('calendar');
  };

  const handleSlotClick = (slot) => {
    setSelectedSlot(slot);
    setStep('confirm');
  };

  const handleConfirm = async () => {
    if (!selectedSlot) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          freelancer:   freelancerId,
          startTime:    selectedSlot.startTime,
          endTime:      selectedSlot.endTime,
          service:      serviceId || undefined,
          locationType,
        }),
      });
      setBooking(data.booking);
      if (data.booking.status === 'hold') {
        setStep('held');
      } else {
        setStep('done');
        onBooked?.(data.booking);
      }
    } catch (err) {
      setError(err.message || 'Booking failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('calendar');
    setSelectedDate(null);
    setSelectedSlot(null);
    setBooking(null);
    setError('');
    fetchSlots();
  };

  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const formatCountdown = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${padZero(s)}`;
  };

  const grid = buildGrid();
  const daySlots = selectedDate ? (slots[selectedDate] || []) : [];

  if (step === 'done') {
    return (
      <div className="booking-done-panel">
        <div className="booking-done-icon">✅</div>
        <h3>Booking Confirmed!</h3>
        <p>Your session has been booked successfully.</p>
        <button className="booking-confirm-btn" onClick={handleReset}>Book Another</button>
      </div>
    );
  }

  if (step === 'held') {
    return (
      <div className="booking-hold-panel">
        <div className="booking-hold-icon">⏳</div>
        <h3>Booking Held</h3>
        <p>Your slot is reserved for <strong>{formatCountdown(holdCountdown)}</strong></p>
        <p className="booking-hold-sub">Complete payment to confirm your booking.</p>
        {holdCountdown === 0 && (
          <p className="booking-hold-expired">Your hold has expired. Please book again.</p>
        )}
        <button className="booking-outline-btn" onClick={handleReset} style={{ marginTop: 16 }}>
          Start Over
        </button>
      </div>
    );
  }

  return (
    <div className="booking-cal-wrap">
      {/* Month navigation */}
      <div className="booking-cal-nav">
        <button className="booking-nav-btn" onClick={prevMonth} aria-label="Previous month">‹</button>
        <span className="booking-cal-month">{MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
        <button className="booking-nav-btn" onClick={nextMonth} aria-label="Next month">›</button>
      </div>

      {/* Day headers */}
      <div className="booking-cal-grid">
        {DAYS.map(d => (
          <div key={d} className="booking-cal-day-header">{d}</div>
        ))}

        {/* Calendar cells */}
        {grid.map(cell =>
          cell.empty ? (
            <div key={cell.key} className="booking-cal-day empty" />
          ) : (
            <div
              key={cell.key}
              className={[
                'booking-cal-day',
                cell.isPast   ? 'past'      : '',
                cell.isToday  ? 'today'     : '',
                cell.available ? 'available' : '',
                selectedDate === cell.dateStr ? 'selected' : '',
                cell.slotCount > 0 && !cell.isPast ? 'has-spots' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => handleDateClick(cell)}
              role={cell.available ? 'button' : undefined}
              tabIndex={cell.available ? 0 : undefined}
              onKeyDown={e => e.key === 'Enter' && handleDateClick(cell)}
            >
              {cell.date}
            </div>
          )
        )}
      </div>

      {loading && <div className="booking-loading">Loading availability…</div>}
      {error   && <div className="booking-error">{error}</div>}

      {/* Slot picker */}
      {selectedDate && !loading && step === 'calendar' && (
        <div className="booking-slots-section">
          <div className="booking-slots-title">
            Available times for {new Date(selectedDate + 'T12:00:00').toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          {daySlots.length === 0 ? (
            <p className="booking-no-slots">No slots available for this date.</p>
          ) : (
            <div className="booking-slots-grid">
              {daySlots.map((slot, i) => (
                <button
                  key={i}
                  className={`booking-slot-btn ${selectedSlot === slot ? 'selected' : ''}`}
                  onClick={() => handleSlotClick(slot)}
                >
                  {formatTime(slot.startTime)}
                  {slot.spotsRemaining > 1 && (
                    <span className="booking-spots"> · {slot.spotsRemaining} spots</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirm panel */}
      {step === 'confirm' && selectedSlot && (
        <div className="booking-confirm-panel">
          <h4 className="booking-confirm-title">Confirm Booking</h4>
          <div className="booking-confirm-detail">
            📅 {new Date(selectedDate + 'T12:00:00').toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          <div className="booking-confirm-detail">
            🕐 {formatTime(selectedSlot.startTime)} – {formatTime(selectedSlot.endTime)}
          </div>

          <div className="booking-location-label">Location</div>
          <div className="booking-location-options">
            {['remote', 'in-person'].map(type => (
              <button
                key={type}
                className={`booking-location-opt ${locationType === type ? 'selected' : ''}`}
                onClick={() => setLocationType(type)}
              >
                {type === 'remote' ? '💻 Remote' : '📍 In-Person'}
              </button>
            ))}
          </div>

          {error && <div className="booking-error">{error}</div>}

          <button
            className="booking-confirm-btn"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'Booking…' : 'Confirm Booking'}
          </button>
          <button className="booking-back-btn" onClick={() => setStep('calendar')}>
            ← Back
          </button>
        </div>
      )}
    </div>
  );
};

export default BookingCalendar;
