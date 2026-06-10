import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';
import CancellationPolicyDisplay from './CancellationPolicyDisplay';
import MultiServiceSelector from './MultiServiceSelector';
import './PublicBookingPage.css';

/* ─── Helpers ─── */
function formatTime12(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function formatDateFull(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function StarRating({ rating }) {
  const full  = Math.floor(rating || 0);
  const half  = (rating || 0) - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return (
    <span className="pbp-stars" aria-label={`${rating} out of 5 stars`}>
      {'★'.repeat(full)}{'½'.repeat(half)}{'☆'.repeat(empty)}
    </span>
  );
}

function Avatar({ src, name, size = 48 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  if (src) {
    return <img src={src} alt={name} className="pbp-avatar" style={{ width: size, height: size }} />;
  }
  return (
    <div className="pbp-avatar pbp-avatar-initials" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </div>
  );
}

/* ─── Month Calendar ─── */
function MonthCalendar({ onSelectDate, selectedDate, maxAdvanceDays = 60 }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay(); // 0=Sun
  const totalDays = lastDay.getDate();

  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + maxAdvanceDays);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const MONTH_NAMES = ['January','February','March','April','May','June',
    'July','August','September','October','November','December'];
  const DAY_NAMES = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  const isPast = (d) => {
    const date = new Date(year, month, d);
    return date < today;
  };
  const isTooFar = (d) => {
    const date = new Date(year, month, d);
    return date > maxDate;
  };
  const isToday = (d) => {
    return year === today.getFullYear() && month === today.getMonth() && d === today.getDate();
  };
  const isSelected = (d) => {
    if (!selectedDate) return false;
    const [sy, sm, sd] = selectedDate.split('-').map(Number);
    return sy === year && (sm - 1) === month && sd === d;
  };
  const toDateStr = (d) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const canGoPrev = !(year === today.getFullYear() && month === today.getMonth());
  const canGoNext = new Date(year, month + 1, 1) <= maxDate;

  return (
    <div className="pbp-calendar">
      <div className="pbp-cal-header">
        <button
          className="pbp-cal-nav"
          onClick={prevMonth}
          disabled={!canGoPrev}
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="pbp-cal-title">{MONTH_NAMES[month]} {year}</span>
        <button
          className="pbp-cal-nav"
          onClick={nextMonth}
          disabled={!canGoNext}
          aria-label="Next month"
        >
          ›
        </button>
      </div>
      <div className="pbp-cal-grid">
        {DAY_NAMES.map(d => (
          <div key={d} className="pbp-cal-dayname">{d}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`pad-${i}`} className="pbp-cal-cell pbp-cal-pad" />;
          const disabled = isPast(d) || isTooFar(d);
          return (
            <button
              key={d}
              className={[
                'pbp-cal-cell',
                isToday(d)    ? 'pbp-cal-today'    : '',
                isSelected(d) ? 'pbp-cal-selected'  : '',
                disabled      ? 'pbp-cal-disabled'  : 'pbp-cal-available',
              ].join(' ')}
              onClick={() => !disabled && onSelectDate(toDateStr(d))}
              disabled={disabled}
              aria-pressed={isSelected(d)}
              aria-label={`${MONTH_NAMES[month]} ${d}, ${year}`}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Price helpers ─── */
function getServicePrice(service) {
  const p = service.pricing;
  if (!p) return null;
  if (p.basic?.price) return p.basic.price;
  return null;
}

function formatPrice(cents) {
  if (cents == null) return null;
  if (cents < 100) return `$${cents}`;
  return `$${(cents / 100).toFixed(2)}`;
}

/* ─── Main Component ─── */
const PublicBookingPage = () => {
  const { username } = useParams();
  const navigate     = useNavigate();
  const { user }     = useAuth();

  const [freelancer, setFreelancer]   = useState(null);
  const [services,   setServices]     = useState([]);
  const [loading,    setLoading]      = useState(true);
  const [error,      setError]        = useState('');

  // Step state
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate,    setSelectedDate]    = useState('');
  const [slots,           setSlots]           = useState([]);
  const [slotsLoading,    setSlotsLoading]    = useState(false);
  const [slotsError,      setSlotsError]      = useState('');
  const [selectedSlot,    setSelectedSlot]    = useState(null);

  // Multi-service selector state
  const [showMultiSelector, setShowMultiSelector] = useState(false);

  // Confirm modal state
  const [showConfirm,    setShowConfirm]    = useState(false);
  const [showLogin,      setShowLogin]      = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError,   setBookingError]   = useState('');
  const [policy,         setPolicy]         = useState(null);

  // Load freelancer profile + services
  useEffect(() => {
    setLoading(true);
    apiRequest(`/api/bookings/public/${username}`)
      .then(data => {
        setFreelancer(data.freelancer);
        setServices(data.services || []);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [username]);

  // Load slots when date + service are selected
  const loadSlots = useCallback(async (date, service) => {
    if (!date || !service) return;
    setSlotsLoading(true);
    setSlotsError('');
    setSlots([]);
    setSelectedSlot(null);
    try {
      const data = await apiRequest(
        `/api/bookings/public/${username}/${service._id}/slots?date=${date}`
      );
      setSlots(data.slots || []);
    } catch (err) {
      setSlotsError('Could not load available times.');
    } finally {
      setSlotsLoading(false);
    }
  }, [username]);

  useEffect(() => {
    if (selectedDate && selectedService) {
      loadSlots(selectedDate, selectedService);
    }
  }, [selectedDate, selectedService, loadSlots]);

  // Load cancellation policy when confirm modal opens
  useEffect(() => {
    if (!showConfirm || !freelancer?._id) return;
    apiRequest(`/api/bookings/cancellation-policy/${freelancer._id}?serviceId=${selectedService?._id || ''}`)
      .then(data => setPolicy(data.policy))
      .catch(() => setPolicy(null));
  }, [showConfirm, freelancer, selectedService]);

  const handleSelectService = (service) => {
    setSelectedService(service);
    setSelectedDate('');
    setSlots([]);
    setSelectedSlot(null);
  };

  const handleSlotClick = (slot) => {
    if (!user) {
      setSelectedSlot(slot);
      setShowLogin(true);
      return;
    }
    setSelectedSlot(slot);
    setShowConfirm(true);
  };

  const handleConfirmBooking = async () => {
    if (!selectedSlot || !selectedService || !selectedDate) return;
    setBookingLoading(true);
    setBookingError('');
    try {
      const data = await apiRequest(`/api/bookings/public/${selectedService._id}`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          date:      selectedDate,
          startTime: selectedSlot.startTime,
          endTime:   selectedSlot.endTime,
          timezone:  Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      navigate(`/bookings/${data.bookingId}`);
    } catch (err) {
      setBookingError(err.message || 'Could not create booking. Please try again.');
    } finally {
      setBookingLoading(false);
    }
  };

  const price = selectedService ? getServicePrice(selectedService) : null;

  /* ─── Render ─── */
  if (loading) {
    return (
      <div className="pbp-loading">
        <div className="pbp-spinner" />
        <p>Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pbp-error-page">
        <p className="pbp-error-text">{error}</p>
        <Link to="/" className="pbp-link">← Back to Fetchwork</Link>
      </div>
    );
  }

  if (!freelancer) return null;

  const fullName = `${freelancer.firstName} ${freelancer.lastName}`;

  return (
    <div className="pbp-page">
      <Helmet>
        <title>Book {fullName} on Fetchwork</title>
        <meta name="description" content={`Book a session with ${fullName} on Fetchwork.`} />
      </Helmet>

      {/* Freelancer header */}
      <div className="pbp-hero">
        <Avatar src={freelancer.avatar} name={fullName} size={72} />
        <div className="pbp-hero-info">
          <h1 className="pbp-name">{fullName}</h1>
          {freelancer.rating > 0 && (
            <div className="pbp-rating">
              <StarRating rating={freelancer.rating} />
              <span className="pbp-rating-text">
                {Number(freelancer.rating).toFixed(1)}
                {freelancer.reviewCount > 0 && ` (${freelancer.reviewCount} reviews)`}
              </span>
            </div>
          )}
          {freelancer.bio && <p className="pbp-bio">{freelancer.bio}</p>}
        </div>
      </div>

      {/* Step 1 — Service selection */}
      {services.length === 0 ? (
        <div className="pbp-card pbp-empty">
          <p>This freelancer hasn't set up bookable services yet.</p>
        </div>
      ) : (
        <div className="pbp-section">
          <h2 className="pbp-section-title">Choose a Service</h2>
          <div className="pbp-services">
            {services.map(svc => {
              const svcPrice = getServicePrice(svc);
              return (
                <button
                  key={svc._id}
                  className={`pbp-service-card ${selectedService?._id === svc._id ? 'selected' : ''}`}
                  onClick={() => handleSelectService(svc)}
                >
                  <div className="pbp-service-top">
                    <span className="pbp-service-title">{svc.title}</span>
                    {svcPrice != null && (
                      <span className="pbp-service-price">From ${svcPrice}</span>
                    )}
                  </div>
                  {svc.description && (
                    <p className="pbp-service-desc">{svc.description}</p>
                  )}
                </button>
              );
            })}
          </div>
          {services.length >= 2 && (
            <div className="pbp-multi-bar">
              <span className="pbp-multi-label">Need more than one service?</span>
              <button
                className="pbp-multi-btn"
                onClick={() => setShowMultiSelector(true)}
              >
                Book multiple services →
              </button>
            </div>
          )}
        </div>
      )}

      {showMultiSelector && (
        <MultiServiceSelector
          services={services}
          freelancerId={freelancer._id}
          username={username}
          onClose={() => setShowMultiSelector(false)}
        />
      )}

      {/* Step 2 — Date picker */}
      {selectedService && (
        <div className="pbp-section">
          <h2 className="pbp-section-title">Select a Date</h2>
          <MonthCalendar
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </div>
      )}

      {/* Step 3 — Time slots */}
      {selectedService && selectedDate && (
        <div className="pbp-section">
          <h2 className="pbp-section-title">
            Available Times — {formatDateFull(selectedDate)}
          </h2>
          {slotsLoading ? (
            <div className="pbp-slots-loading">
              <div className="pbp-spinner pbp-spinner-sm" />
              <span>Checking availability…</span>
            </div>
          ) : slotsError ? (
            <p className="pbp-slots-error">{slotsError}</p>
          ) : slots.length === 0 ? (
            <p className="pbp-slots-empty">No availability on this date. Try another day.</p>
          ) : (
            <div className="pbp-slots-grid">
              {slots.map(slot => (
                <button
                  key={slot.startTime}
                  className={`pbp-slot ${selectedSlot?.startTime === slot.startTime ? 'selected' : ''}`}
                  onClick={() => handleSlotClick(slot)}
                >
                  {formatTime12(slot.startTime)}
                  {slot.spotsLeft > 1 && (
                    <span className="pbp-slot-spots"> · {slot.spotsLeft} left</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Login prompt overlay */}
      {showLogin && (
        <div className="pbp-overlay" onClick={() => setShowLogin(false)}>
          <div className="pbp-modal" onClick={e => e.stopPropagation()}>
            <button className="pbp-modal-close" onClick={() => setShowLogin(false)}>✕</button>
            <h2 className="pbp-modal-title">Sign in to book</h2>
            <p className="pbp-modal-text">
              You need a Fetchwork account to book with {freelancer.firstName}.
            </p>
            <div className="pbp-modal-actions">
              <Link
                to={`/login?redirect=/book/${username}`}
                className="pbp-btn pbp-btn-primary"
              >
                Sign in
              </Link>
              <Link
                to={`/register?redirect=/book/${username}`}
                className="pbp-btn pbp-btn-secondary"
              >
                Create account
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Confirm booking modal */}
      {showConfirm && selectedSlot && selectedService && (
        <div className="pbp-overlay" onClick={() => { setShowConfirm(false); setBookingError(''); }}>
          <div className="pbp-modal pbp-modal-confirm" onClick={e => e.stopPropagation()}>
            <button
              className="pbp-modal-close"
              onClick={() => { setShowConfirm(false); setBookingError(''); }}
            >
              ✕
            </button>
            <h2 className="pbp-modal-title">Confirm Booking</h2>

            <div className="pbp-confirm-details">
              <div className="pbp-confirm-row">
                <span className="pbp-confirm-label">Service</span>
                <span className="pbp-confirm-value">{selectedService.title}</span>
              </div>
              <div className="pbp-confirm-row">
                <span className="pbp-confirm-label">With</span>
                <span className="pbp-confirm-value">{fullName}</span>
              </div>
              <div className="pbp-confirm-row">
                <span className="pbp-confirm-label">Date</span>
                <span className="pbp-confirm-value">{formatDateFull(selectedDate)}</span>
              </div>
              <div className="pbp-confirm-row">
                <span className="pbp-confirm-label">Time</span>
                <span className="pbp-confirm-value">
                  {formatTime12(selectedSlot.startTime)} – {formatTime12(selectedSlot.endTime)}
                </span>
              </div>
              {price != null && (
                <div className="pbp-confirm-row">
                  <span className="pbp-confirm-label">Price</span>
                  <span className="pbp-confirm-value pbp-confirm-price">From ${price}</span>
                </div>
              )}
            </div>

            {policy && (
              <div className="pbp-confirm-policy">
                <CancellationPolicyDisplay policy={policy} compact />
              </div>
            )}

            {bookingError && (
              <div className="pbp-confirm-error">{bookingError}</div>
            )}

            <p className="pbp-confirm-note">
              A hold will be placed — you'll complete payment on the next page.
            </p>

            <div className="pbp-modal-actions">
              <button
                className="pbp-btn pbp-btn-secondary"
                onClick={() => { setShowConfirm(false); setBookingError(''); }}
                disabled={bookingLoading}
              >
                Back
              </button>
              <button
                className="pbp-btn pbp-btn-primary"
                onClick={handleConfirmBooking}
                disabled={bookingLoading}
              >
                {bookingLoading ? 'Booking…' : 'Confirm & Book'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicBookingPage;
