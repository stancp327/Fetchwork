import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { DateTime } from 'luxon';
import { apiRequest } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import './MyBookings.css';

const STATUS_LABELS = {
  confirmed: { label: 'Confirmed', cls: 'status-confirmed' },
  completed: { label: 'Completed', cls: 'status-completed' },
  cancelled: { label: 'Cancelled', cls: 'status-cancelled' },
  no_show:   { label: 'No Show',   cls: 'status-noshow'    },
  hold:      { label: 'Pending',   cls: 'status-pending'   },
};

const BookingCard = ({ booking, role, onAction }) => {
  const [acting, setActing] = useState('');
  const { user } = useAuth();
  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const freelancerTz = booking.freelancerTimezone || userTz;
  const diffTz = userTz !== freelancerTz;

  const start = DateTime.fromISO(booking.startTime).setZone(role === 'freelancer' ? freelancerTz : userTz);
  const end   = DateTime.fromISO(booking.endTime).setZone(role === 'freelancer' ? freelancerTz : userTz);
  const st    = STATUS_LABELS[booking.status] || { label: booking.status, cls: '' };

  const isUpcoming = new Date(booking.startTime) > new Date();

  const handleCancel = async () => {
    if (!window.confirm('Cancel this booking?')) return;
    setActing('cancel');
    try {
      await apiRequest(`/api/bookings/${booking._id}/cancel`, {
        method: 'PUT',
        body: JSON.stringify({ reason: 'Cancelled by user' }),
      });
      onAction?.();
    } catch (err) {
      alert(err.message || 'Failed to cancel');
    } finally { setActing(''); }
  };

  const handleComplete = async () => {
    setActing('complete');
    try {
      await apiRequest(`/api/bookings/${booking._id}/complete`, { method: 'PUT', body: '{}' });
      onAction?.();
    } catch (err) {
      alert(err.message || 'Failed to mark complete');
    } finally { setActing(''); }
  };

  const handleNoShow = async () => {
    if (!window.confirm('Mark client as no-show?')) return;
    setActing('noshow');
    try {
      await apiRequest(`/api/bookings/${booking._id}/no-show`, { method: 'PUT', body: '{}' });
      onAction?.();
    } catch (err) {
      alert(err.message || 'Failed to mark no-show');
    } finally { setActing(''); }
  };

  const other = role === 'freelancer'
    ? booking.participants?.[0]?.client
    : booking.freelancer;

  return (
    <div className={`booking-card ${st.cls}`}>
      <div className="bk-card-top">
        <div className="bk-time">
          <span className="bk-date">{start.toFormat('EEE, MMM d, yyyy')}</span>
          <span className="bk-hours">
            {start.toFormat('h:mm a')} – {end.toFormat('h:mm a')}
            {' '}<span className="bk-tz">{start.toFormat('z')}</span>
          </span>
          {diffTz && role === 'client' && (
            <span className="bk-their-tz">
              Freelancer's time: {DateTime.fromISO(booking.startTime).setZone(freelancerTz).toFormat('h:mm a z')}
            </span>
          )}
        </div>
        <span className={`bk-status ${st.cls}`}>{st.label}</span>
      </div>

      <div className="bk-card-body">
        {other && (
          <div className="bk-person">
            <img
              src={other.profilePicture || '/default-avatar.png'}
              alt={`${other.firstName} ${other.lastName}`}
              className="bk-avatar"
            />
            <div>
              <strong>{other.firstName} {other.lastName}</strong>
              <span className="bk-role-label">{role === 'freelancer' ? 'Client' : 'Freelancer'}</span>
            </div>
          </div>
        )}

        <div className="bk-meta">
          {booking.locationType && (
            <span className="bk-meta-pill">
              {booking.locationType === 'virtual' ? '💻 Virtual' : booking.locationType === 'in_person' ? '📍 In Person' : '📞 Phone'}
            </span>
          )}
          {booking.service && <span className="bk-meta-pill">🛠 {booking.service.title}</span>}
          {booking.job     && <span className="bk-meta-pill">💼 {booking.job.title}</span>}
          {booking.capacity > 1 && (
            <span className="bk-meta-pill">
              👥 {booking.participants?.filter(p => p.status === 'confirmed').length}/{booking.capacity} spots
            </span>
          )}
        </div>

        {booking.clientNotes && (
          <p className="bk-notes">"{booking.clientNotes}"</p>
        )}
      </div>

      {booking.status === 'confirmed' && isUpcoming && (
        <div className="bk-actions">
          {role === 'freelancer' && (
            <>
              <button className="bk-btn bk-btn-complete" onClick={handleComplete} disabled={!!acting}>
                {acting === 'complete' ? '…' : '✅ Mark Complete'}
              </button>
              <button className="bk-btn bk-btn-noshow" onClick={handleNoShow} disabled={!!acting}>
                {acting === 'noshow' ? '…' : '👻 No Show'}
              </button>
            </>
          )}
          <button className="bk-btn bk-btn-cancel" onClick={handleCancel} disabled={!!acting}>
            {acting === 'cancel' ? '…' : 'Cancel'}
          </button>
        </div>
      )}
    </div>
  );
};

const MyBookings = () => {
  const { user } = useAuth();
  const [tab,       setTab]       = useState('upcoming');
  const [role,      setRole]      = useState('client');
  const [bookings,  setBookings]  = useState([]);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [loading,   setLoading]   = useState(false);

  const fetchBookings = useCallback(() => {
    setLoading(true);
    apiRequest(`/api/bookings/my?role=${role}&status=${tab}&page=${page}`)
      .then(d => { setBookings(d.bookings || []); setTotal(d.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [role, tab, page]);

  useEffect(() => { setPage(1); }, [role, tab]);
  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  return (
    <div className="my-bookings">
      <div className="mb-header">
        <h2>My Bookings</h2>
        <div className="mb-role-toggle">
          <button className={role === 'client' ? 'active' : ''} onClick={() => setRole('client')}>As Client</button>
          <button className={role === 'freelancer' ? 'active' : ''} onClick={() => setRole('freelancer')}>As Freelancer</button>
        </div>
      </div>

      <div className="mb-tabs">
        {['upcoming', 'past'].map(t => (
          <button key={t} className={`mb-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'upcoming' ? '📅 Upcoming' : '🕐 Past'}
          </button>
        ))}
      </div>

      {loading && <div className="mb-loading">Loading bookings…</div>}

      {!loading && bookings.length === 0 && (
        <div className="mb-empty">
          <div className="mb-empty-icon">{tab === 'upcoming' ? '📅' : '🕐'}</div>
          <h3>No {tab} bookings</h3>
          <p>{tab === 'upcoming'
            ? "You don't have any upcoming sessions. Book a session from a freelancer's profile."
            : "Past sessions will appear here."}
          </p>
          {tab === 'upcoming' && role === 'client' && (
            <Link to="/browse-services" className="mb-cta-btn">Browse Services →</Link>
          )}
        </div>
      )}

      <div className="mb-list">
        {bookings.map(b => (
          <BookingCard key={b._id} booking={b} role={role} onAction={fetchBookings} />
        ))}
      </div>

      {total > bookings.length && (
        <button className="mb-load-more" onClick={() => setPage(p => p + 1)} disabled={loading}>
          Load more
        </button>
      )}
    </div>
  );
};

export default MyBookings;
