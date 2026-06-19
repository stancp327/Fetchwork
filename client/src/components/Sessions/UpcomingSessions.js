import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { formatDate, formatTimeRange, locationLabel } from '../../utils/sessionFormatters';
import EscrowModal from '../Payments/EscrowModal';
import './UpcomingSessions.css';

/**
 * UpcomingSessions — Reusable component for session display + booking.
 *
 * Props:
 *   serviceId    — MongoDB service _id (required)
 *   limit        — max occurrences to show (default 10)
 *   allowBooking — enable Book buttons (default false; set true on ServiceDetails)
 */
const UpcomingSessions = ({ serviceId, limit = 10, allowBooking = false }) => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bookingId, setBookingId] = useState(null);   // occurrence being booked
  const [bookMsg, setBookMsg] = useState(null);        // { type: 'success'|'error'|'info', text }
  const [sessionPayment, setSessionPayment] = useState(null); // { bookingId, clientSecret, amount, title, currency, occurrenceId }
  const [paymentLoading, setPaymentLoading] = useState(false);

  useEffect(() => {
    if (!serviceId) return;
    let cancelled = false;

    const fetchSessions = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiRequest(`/api/sessions/occurrences/service/${serviceId}?limit=${limit}`);
        if (!cancelled) setSessions(data || []);
      } catch (err) {
        if (!cancelled) setError('Unable to load sessions right now.');
        console.error('[UpcomingSessions] fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchSessions();
    return () => { cancelled = true; };
  }, [serviceId, limit]);

  const handleBook = useCallback(async (session) => {
    // Auth check
    if (!isAuthenticated || !user) {
      setBookMsg({ type: 'info', text: 'Please log in to book a session.', loginLink: true });
      return;
    }

    setBookingId(session.id);
    setBookMsg(null);

    try {
      const result = await apiRequest('/api/sessions/book', {
        method: 'POST',
        body: JSON.stringify({ occurrenceId: session.id, seats: 1 }),
      });

      // Free session booked successfully
      setBookMsg({ type: 'success', text: '✅ Seat booked! You\'re confirmed for this session.' });
      // Update seat count locally
      setSessions(prev => prev.map(s =>
        s.id === session.id
          ? { ...s, bookedCount: s.bookedCount + 1, spotsLeft: (s.spotsLeft ?? (s.maxCapacity - s.bookedCount)) - 1 }
          : s
      ));
    } catch (err) {
      const data = err.data || {};
      const status = err.status || 0;

      if (status === 402 && data.paymentRequired) {
        // Paid session — initiate paid hold + Stripe checkout
        try {
          setPaymentLoading(true);
          const paidResult = await apiRequest('/api/sessions/book-paid', {
            method: 'POST',
            body: JSON.stringify({ occurrenceId: session.id, seats: 1 }),
          });
          // Open payment modal
          setSessionPayment({
            bookingId: paidResult.bookingId,
            clientSecret: paidResult.clientSecret,
            amount: paidResult.totalAmount,
            title: data.title || 'Session',
            currency: paidResult.currency || 'usd',
            occurrenceId: session.id,
            feeBreakdown: paidResult.feeBreakdown || null,
          });
          setBookMsg(null);
        } catch (paidErr) {
          const paidStatus = paidErr.status || 0;
          if (paidStatus === 409) {
            setBookMsg({ type: 'error', text: paidErr.data?.error || 'You already have a booking for this session.' });
          } else {
            setBookMsg({ type: 'error', text: paidErr.data?.error || 'Failed to start checkout. Please try again.' });
          }
        } finally {
          setPaymentLoading(false);
        }
      } else if (status === 401) {
        setBookMsg({ type: 'info', text: 'Please log in to book a session.', loginLink: true });
      } else if (status === 409) {
        // Full or already booked
        setBookMsg({ type: 'error', text: err.data?.error || 'This session is no longer available.' });
      } else if (status === 410) {
        // Past or cutoff
        setBookMsg({ type: 'error', text: err.data?.error || 'Booking is closed for this session.' });
      } else {
        setBookMsg({ type: 'error', text: err.data?.error || err.message || 'Booking failed. Please try again.' });
      }
    } finally {
      setBookingId(null);
    }
  }, [isAuthenticated, user]);

  // ── Paid session: payment succeeded ──
  const handleSessionPaymentSuccess = useCallback(async (paymentIntent) => {
    if (!sessionPayment) return;

    // Wallet payments don't have a paymentIntentId — not supported for session checkout
    if (paymentIntent.walletPayment || !paymentIntent.id) {
      setBookMsg({ type: 'error', text: 'Wallet payments are not supported for session bookings yet. Please use a card.' });
      setSessionPayment(null);
      return;
    }

    try {
      await apiRequest(`/api/sessions/bookings/${sessionPayment.bookingId}/confirm-payment`, {
        method: 'POST',
        body: JSON.stringify({ paymentIntentId: paymentIntent.id }),
      });

      setSessionPayment(null);
      setBookMsg({ type: 'success', text: '✅ Payment confirmed! You\'re booked for this session.' });
      // Update seat count locally
      setSessions(prev => prev.map(s =>
        s.id === sessionPayment.occurrenceId
          ? { ...s, bookedCount: s.bookedCount + 1, spotsLeft: (s.spotsLeft ?? (s.maxCapacity - s.bookedCount)) - 1 }
          : s
      ));
    } catch (err) {
      // Payment went through on Stripe but confirm failed — rare edge case
      setSessionPayment(null);
      setBookMsg({
        type: 'error',
        text: 'Payment was received but booking confirmation failed. Please contact support.',
      });
      console.error('[UpcomingSessions] confirm-payment failed after Stripe success:', err);
    }
  }, [sessionPayment]);

  // ── Paid session: modal closed without completing payment ──
  const handleSessionPaymentClose = useCallback(() => {
    setSessionPayment(null);
    setBookMsg({ type: 'info', text: 'Payment cancelled. Your held seat will be released shortly.' });
  }, []);

  if (loading) {
    return (
      <div className="us-container">
        <h3 className="us-title">Upcoming Sessions</h3>
        <div className="us-loading">Loading sessions…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="us-container">
        <h3 className="us-title">Upcoming Sessions</h3>
        <div className="us-error">{error}</div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="us-container">
        <h3 className="us-title">Upcoming Sessions</h3>
        <div className="us-empty">No upcoming sessions are currently available.</div>
      </div>
    );
  }

  return (
    <div className="us-container">
      <h3 className="us-title">Upcoming Sessions</h3>

      {/* Booking feedback message */}
      {bookMsg && (
        <div className={`us-msg us-msg-${bookMsg.type}`}>
          <span>{bookMsg.text}</span>
          {bookMsg.loginLink && (
            <button className="us-msg-link" onClick={() => navigate('/login')}>Log in →</button>
          )}
          <button className="us-msg-dismiss" onClick={() => setBookMsg(null)} aria-label="Dismiss">✕</button>
        </div>
      )}

      <div className="us-list">
        {sessions.map(s => (
          <SessionCard
            key={s.id}
            session={s}
            allowBooking={allowBooking}
            isBooking={bookingId === s.id}
            onBook={handleBook}
          />
        ))}
      </div>

      {/* Paid session payment modal */}
      {sessionPayment && (
        <EscrowModal
          job={{ _id: sessionPayment.bookingId, title: sessionPayment.title }}
          amount={sessionPayment.amount}
          preloadedSecret={sessionPayment.clientSecret}
          title="Session Payment"
          feeBreakdown={sessionPayment.feeBreakdown}
          onClose={handleSessionPaymentClose}
          onPaid={handleSessionPaymentSuccess}
        />
      )}
    </div>
  );
};


const SessionCard = ({ session, allowBooking, isBooking, onBook }) => {
  const spotsLeft = session.spotsLeft ?? (session.maxCapacity - session.bookedCount);
  const isFull = spotsLeft <= 0 || session.status === 'full';
  const isPast = new Date(session.startTime) <= new Date();
  const isCancelled = session.status === 'cancelled';
  const isCompleted = session.status === 'completed';
  const isBookable = allowBooking && !isFull && !isPast && !isCancelled && !isCompleted;
  const loc = locationLabel(session.locationMode);

  return (
    <div className={`us-card ${isFull ? 'us-card-full' : ''} ${isPast || isCancelled || isCompleted ? 'us-card-past' : ''}`}>
      <div className="us-card-date">
        <span className="us-card-day">{formatDate(session.startTime)}</span>
        <span className="us-card-time">{formatTimeRange(session.startTime, session.endTime)}</span>
      </div>

      <div className="us-card-details">
        {session.title && <span className="us-card-title">{session.title}</span>}

        <div className="us-card-meta">
          {session.durationMinutes && (
            <span className="us-meta-item">⏱ {session.durationMinutes} min</span>
          )}
          {loc && <span className="us-meta-item">{loc}</span>}
          {session.price != null && session.price > 0 && (
            <span className="us-meta-item us-meta-price">
              ${session.price}{session.currency && session.currency !== 'usd' ? ` ${session.currency.toUpperCase()}` : ''}
            </span>
          )}
          {session.price === 0 && (
            <span className="us-meta-item us-meta-free">Free</span>
          )}
        </div>
      </div>

      <div className="us-card-capacity">
        {isCancelled ? (
          <span className="us-badge us-badge-cancelled">Cancelled</span>
        ) : isFull ? (
          <span className="us-badge us-badge-full">Full</span>
        ) : (
          <span className="us-badge us-badge-open">
            {spotsLeft} {spotsLeft === 1 ? 'spot' : 'spots'} left
          </span>
        )}

        {isBookable && (
          <button
            className="us-book-btn"
            onClick={() => onBook(session)}
            disabled={isBooking}
          >
            {isBooking ? 'Booking…' : 'Book'}
          </button>
        )}
      </div>
    </div>
  );
};

export default UpcomingSessions;
