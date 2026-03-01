import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api';
import SEO from '../common/SEO';
import './MyBookings.css';

const STATUS_LABELS = {
  hold:       'Payment Pending',
  confirmed:  'Confirmed',
  completed:  'Completed',
  cancelled:  'Cancelled',
  no_show:    'No Show',
};

const formatDateTime = (iso) => {
  const d = new Date(iso);
  return d.toLocaleString([], {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
};

const holdTimeLeft = (expiresAt) => {
  const secs = Math.floor((new Date(expiresAt) - Date.now()) / 1000);
  if (secs <= 0) return 'Expired';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')} left`;
};

const MyBookings = () => {
  const [tab, setTab]           = useState('upcoming');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [acting, setActing]     = useState(null); // bookingId being actioned

  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('user')) || {}; } catch { return {}; }
  })();

  const fetchBookings = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest('/api/bookings/my');
      setBookings(data.bookings || []);
    } catch (err) {
      setError('Could not load bookings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBookings(); }, []);

  const upcomingStatuses = ['hold', 'confirmed'];
  const pastStatuses     = ['completed', 'cancelled', 'no_show'];

  const filtered = bookings.filter(b =>
    tab === 'upcoming' ? upcomingStatuses.includes(b.status) : pastStatuses.includes(b.status)
  );

  const handleAction = async (bookingId, action) => {
    setActing(bookingId);
    try {
      const methodMap = { cancel: 'cancel', complete: 'complete', noshow: 'no-show' };
      await apiRequest(`/api/bookings/${bookingId}/${methodMap[action]}`, {
        method: 'PUT',
        body: action === 'cancel' ? JSON.stringify({ reason: 'client_request' }) : undefined,
      });
      await fetchBookings();
    } catch (err) {
      alert(err.message || 'Action failed. Please try again.');
    } finally {
      setActing(null);
    }
  };

  const isFreelancer = (booking) =>
    String(booking.freelancer?._id || booking.freelancer) === String(currentUser._id);

  const renderBookingCard = (booking) => {
    const counterpart = isFreelancer(booking) ? booking.client : booking.freelancer;
    const actioning   = acting === booking._id;

    return (
      <div key={booking._id} className="booking-card">
        {counterpart?.profilePicture ? (
          <img
            className="booking-avatar"
            src={counterpart.profilePicture}
            alt={counterpart.name}
          />
        ) : (
          <div className="booking-avatar booking-avatar-placeholder">
            {(counterpart?.name || '?')[0].toUpperCase()}
          </div>
        )}

        <div className="booking-info">
          <div className="booking-name">{counterpart?.name || 'Unknown'}</div>
          <div className="booking-datetime">{formatDateTime(booking.startTime)}</div>
          {booking.locationType && (
            <div className="booking-location">
              {booking.locationType === 'remote' ? '💻 Remote' : '📍 In-Person'}
            </div>
          )}
          {booking.price > 0 && (
            <div className="booking-price">${booking.price}</div>
          )}
          {booking.status === 'hold' && booking.holdExpiresAt && (
            <div className="booking-hold-timer">⏳ {holdTimeLeft(booking.holdExpiresAt)}</div>
          )}
        </div>

        <div className="booking-right">
          <span className={`booking-status booking-status-${booking.status}`}>
            {STATUS_LABELS[booking.status] || booking.status}
          </span>

          {booking.status === 'confirmed' && (
            <div className="booking-actions">
              {/* Freelancer actions */}
              {isFreelancer(booking) && (
                <>
                  <button
                    className="booking-action-btn booking-action-complete"
                    onClick={() => handleAction(booking._id, 'complete')}
                    disabled={actioning}
                  >
                    {actioning ? '…' : 'Complete'}
                  </button>
                  <button
                    className="booking-action-btn booking-action-noshow"
                    onClick={() => handleAction(booking._id, 'noshow')}
                    disabled={actioning}
                  >
                    No-show
                  </button>
                </>
              )}
              {/* Client actions */}
              {!isFreelancer(booking) && (
                <button
                  className="booking-action-btn booking-action-cancel"
                  onClick={() => handleAction(booking._id, 'cancel')}
                  disabled={actioning}
                >
                  {actioning ? '…' : 'Cancel'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="my-bookings">
      <SEO title="My Bookings" path="/bookings" noIndex={true} />
      <h2 className="my-bookings-title">My Bookings</h2>

      <div className="my-bookings-tabs">
        <button
          className={`my-bookings-tab ${tab === 'upcoming' ? 'active' : ''}`}
          onClick={() => setTab('upcoming')}
        >
          Upcoming
        </button>
        <button
          className={`my-bookings-tab ${tab === 'past' ? 'active' : ''}`}
          onClick={() => setTab('past')}
        >
          Past
        </button>
      </div>

      {loading && <div className="booking-loading">Loading bookings…</div>}
      {error   && <div className="booking-error-msg">{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="booking-empty">
          {tab === 'upcoming'
            ? 'No upcoming bookings yet.'
            : 'No past bookings.'}
        </div>
      )}

      {!loading && filtered.map(renderBookingCard)}
    </div>
  );
};

export default MyBookings;

