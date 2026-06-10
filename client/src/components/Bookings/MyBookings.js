import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../context/RoleContext';
import { apiRequest } from '../../utils/api';
import SEO from '../common/SEO';
import './MyBookings.css';

function formatTime12(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function smartDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const tomorrow = new Date(today.getTime() + 86400000).toISOString().slice(0, 10);
  const yesterday = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);
  if (dateStr === todayStr) return 'Today';
  if (dateStr === tomorrow) return 'Tomorrow';
  if (dateStr === yesterday) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getInitials(person) {
  if (!person) return '?';
  return [person.firstName?.[0], person.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?';
}

function bid(b) { return b.id || b._id; }

const STATUS_MAP = {
  pending:                { label: 'Pending',    cls: 'warning' },
  pending_payment:        { label: 'Awaiting Pay', cls: 'warning' },
  hold:                   { label: 'Hold',       cls: 'warning' },
  held:                   { label: 'Held',       cls: 'warning' },
  confirmed:              { label: 'Confirmed',  cls: 'success' },
  in_progress:            { label: 'In Progress', cls: 'success' },
  proposed:               { label: 'Proposed',   cls: 'warning' },
  cancelled:              { label: 'Cancelled',  cls: 'danger'  },
  cancelled_by_client:    { label: 'Cancelled',  cls: 'danger'  },
  cancelled_by_freelancer:{ label: 'Cancelled',  cls: 'danger'  },
  completed:              { label: 'Completed',  cls: 'muted'   },
  no_show_client:         { label: 'No Show',    cls: 'danger'  },
  no_show_freelancer:     { label: 'No Show',    cls: 'danger'  },
  no_show:                { label: 'No Show',    cls: 'danger'  },
  disputed:               { label: 'Disputed',   cls: 'danger'  },
  resolved:               { label: 'Resolved',   cls: 'muted'   },
};

function apptToBooking(appt) {
  const start = new Date(appt.startAtUtc);
  return {
    _appt: true,
    id: appt.id,
    status: appt.status === 'proposed' ? 'pending' : appt.status,
    serviceTitle: appt.appointmentType ? appt.appointmentType.replace(/_/g, ' ') : 'Scheduled Session',
    date: start.toISOString().slice(0, 10),
    startTime: `${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')}`,
    endTime: (() => { const e = new Date(appt.endAtUtc); return `${String(e.getHours()).padStart(2,'0')}:${String(e.getMinutes()).padStart(2,'0')}`; })(),
    timezone: appt.timezone,
    notes: appt.notes,
    _fromMessages: true,
  };
}

// ── Skeleton Loading ────────────────────────────────────────────
const SkeletonCards = () => (
  <div className="mb-skeleton-list">
    {[1,2,3].map(i => (
      <div key={i} className="mb-skeleton-card">
        <div className="mb-skeleton-row">
          <div className="mb-skeleton-avatar" />
          <div className="mb-skeleton-lines">
            <div className="mb-skeleton-line w60" />
            <div className="mb-skeleton-line w40" />
          </div>
        </div>
        <div className="mb-skeleton-details" />
      </div>
    ))}
  </div>
);

// ── Main Component ──────────────────────────────────────────────
const MyBookings = () => {
  const { user } = useAuth();
  const { isFreelancerMode } = useRole();
  const role = isFreelancerMode ? 'freelancer' : 'client';

  const [tab, setTab]                       = useState('upcoming');
  const [bookings, setBookings]             = useState([]);
  const [counts, setCounts]                 = useState({ upcoming: 0, past: 0, cancelled: 0 });
  const [bundles, setBundles]               = useState([]);
  const [bundlesLoading, setBundlesLoading] = useState(false);
  const [loading, setLoading]               = useState(true);
  const [actionLoading, setActionLoading]   = useState('');
  const [msg, setMsg]                       = useState({ text: '', ok: true });

  const flash = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg({ text: '', ok: true }), 4500); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bookingData, apptData] = await Promise.allSettled([
        apiRequest(`/api/bookings/me?role=${role}&status=${tab}`),
        apiRequest(`/api/appointments/mine?upcoming=${tab === 'upcoming' ? 'true' : tab === 'past' ? 'false' : 'true'}&${tab === 'cancelled' ? 'status=cancelled' : ''}`),
      ]);

      const sqlBookings = bookingData.status === 'fulfilled' ? (bookingData.value.bookings || []) : [];
      const rawAppts    = apptData.status === 'fulfilled'    ? (apptData.value.appointments || []) : [];

      const filteredAppts = rawAppts.filter(a => {
        if (tab === 'cancelled') return a.status === 'cancelled';
        if (tab === 'past')      return a.status !== 'cancelled';
        return a.status === 'proposed' || a.status === 'confirmed';
      });

      const merged = [...sqlBookings, ...filteredAppts.map(apptToBooking)].sort((a, b) => {
        const da = a.date ? new Date(a.date + 'T' + (a.startTime || '00:00')).getTime() : 0;
        const db = b.date ? new Date(b.date + 'T' + (b.startTime || '00:00')).getTime() : 0;
        return da - db;
      });

      setBookings(merged);

      // Update count for current tab
      setCounts(prev => ({ ...prev, [tab]: merged.length }));
    } catch (err) {
      flash('Failed to load bookings: ' + err.message, false);
    } finally {
      setLoading(false);
    }
  }, [role, tab]);

  useEffect(() => { load(); }, [load]);

  // Load counts for other tabs on mount
  useEffect(() => {
    const otherTabs = ['upcoming', 'past', 'cancelled'].filter(t => t !== tab);
    otherTabs.forEach(t => {
      apiRequest(`/api/bookings/me?role=${role}&status=${t}`)
        .then(d => setCounts(prev => ({ ...prev, [t]: (d.bookings || []).length })))
        .catch(() => {});
    });
  }, [role]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab !== 'bundles') return;
    setBundlesLoading(true);
    apiRequest(`/api/services/bundles/me?role=${role}`)
      .then(d => setBundles(d.bundles || []))
      .catch(() => {})
      .finally(() => setBundlesLoading(false));
  }, [tab, role]);

  const doAction = async (bookingId, action, body = {}) => {
    setActionLoading(`${bookingId}_${action}`);
    try {
      await apiRequest(`/api/bookings/${bookingId}/${action}`, {
        method: 'PATCH',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify(body),
      });
      flash(`Booking ${action}d ✅`);
      load();
    } catch (err) {
      flash('Failed: ' + err.message, false);
    } finally {
      setActionLoading('');
    }
  };

  const handleCancel = async (b) => {
    const reason = window.prompt('Cancellation reason (optional):');
    if (reason === null) return;
    await doAction(bid(b), 'cancel', { reason });
  };

  const TABS = [
    { key: 'upcoming',  label: 'Upcoming' },
    { key: 'past',      label: 'Past' },
    { key: 'cancelled', label: 'Cancelled' },
    { key: 'bundles',   label: '📦 Bundles' },
  ];

  return (
    <div className="mb-page">
      <SEO title="My Bookings | Fetchwork" path="/bookings" noIndex={true} />

      <div className="mb-title-row">
        <h1 className="mb-title">📅 My Bookings</h1>
        {isFreelancerMode && (
          <Link to="/booking-analytics" className="mb-analytics-link">View Analytics →</Link>
        )}
      </div>

      {/* Quick links */}
      <div className="mb-quick-links">
        {isFreelancerMode && (
          <>
            <Link to="/availability" className="mb-quick-link">🕐 Availability</Link>
            <Link to="/intake-forms/builder" className="mb-quick-link">📋 Intake Forms</Link>
            <Link to="/cancellation-policy" className="mb-quick-link">📜 Cancellation Policy</Link>
            <Link to="/settings/calendar" className="mb-quick-link">📆 Calendar Sync</Link>
          </>
        )}
        <Link to="/my-packages" className="mb-quick-link">📦 My Packages</Link>
      </div>

      {/* Tabs with counts */}
      <div className="mb-tabs">
        {TABS.map(t => (
          <button key={t.key} className={`mb-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
            {t.key !== 'bundles' && counts[t.key] > 0 && (
              <span className="mb-tab-count">{counts[t.key]}</span>
            )}
          </button>
        ))}
      </div>

      {msg.text && <div className={`mb-msg ${msg.ok ? 'mb-msg-ok' : 'mb-msg-err'}`}>{msg.text}</div>}

      {/* Booking list or bundles */}
      {tab === 'bundles' ? (
        bundlesLoading ? <SkeletonCards /> : bundles.length === 0 ? (
          <div className="mb-empty">
            <div className="mb-empty-icon">📦</div>
            <h3>No session bundles</h3>
            <p>Purchase a bundle from a service page to see your sessions here.</p>
            <Link to="/services" className="mb-empty-cta">Browse Services →</Link>
          </div>
        ) : (
          <div className="mb-list">
            {bundles.map(b => {
              const pct = b.sessionsTotal > 0 ? Math.round((b.sessionsCompleted / b.sessionsTotal) * 100) : 0;
              const other = role === 'client' ? b.freelancer : b.client;
              const statusInfo = STATUS_MAP[b.status] || { label: b.status, cls: 'muted' };
              return (
                <div key={b._id} className="mb-card" data-status={b.status}>
                  <div className="mb-card-top">
                    <div className="mb-card-avatar">{getInitials(other)}</div>
                    <div className="mb-card-info">
                      <h3 className="mb-card-service">{b.service?.title || 'Service'}</h3>
                      <p className="mb-bundle-person">
                        <strong>{b.bundleName}</strong>
                        {other && <> · {role === 'client' ? 'with' : 'from'} {other.firstName} {other.lastName}</>}
                      </p>
                    </div>
                    <span className={`mb-status mb-status-${statusInfo.cls}`}>{statusInfo.label}</span>
                  </div>
                  <div className="mb-bundle-progress">
                    <div className="mb-bundle-progress-header">
                      <span>Sessions: <strong>{b.sessionsCompleted} / {b.sessionsTotal}</strong></span>
                      <span className={`mb-bundle-remaining ${b.sessionsRemaining <= 0 ? 'depleted' : ''}`}>
                        {b.sessionsRemaining} remaining
                      </span>
                    </div>
                    <div className="mb-bundle-bar">
                      <div className={`mb-bundle-fill ${pct === 100 ? 'done' : ''}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  {b.expiresAt && (
                    <p className="mb-bundle-expires">⏰ Expires {new Date(b.expiresAt).toLocaleDateString()}</p>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : loading ? (
        <SkeletonCards />
      ) : bookings.length === 0 ? (
        <div className="mb-empty">
          <div className="mb-empty-icon">📅</div>
          <h3>No {tab} bookings</h3>
          <p>{tab === 'upcoming' ? 'Ready to book? Browse services to get started.' : `You don't have any ${tab} bookings yet.`}</p>
          {tab === 'upcoming' && (
            <Link to="/services" className="mb-empty-cta">Browse Services →</Link>
          )}
        </div>
      ) : (
        <div className="mb-list">
          {bookings.map(b => {
            const id = bid(b);
            const otherPerson = role === 'client'
              ? (b.freelancer || b.freelancerUser)
              : (b.client || b.clientUser);
            const statusInfo = STATUS_MAP[b.status] || { label: b.status, cls: 'muted' };
            const isActive = ['pending', 'hold', 'held', 'confirmed', 'pending_payment'].includes(b.status);

            return (
              <div key={id} className="mb-card" data-status={b.status}>
                <div className="mb-card-top">
                  <div className="mb-card-avatar">
                    {otherPerson?.profilePicture
                      ? <img src={otherPerson.profilePicture} alt="" />
                      : getInitials(otherPerson)
                    }
                  </div>
                  <div className="mb-card-info">
                    <h3 className="mb-card-service">
                      {b.service?.title || b.serviceTitle || 'Service'}
                      {b._fromMessages && <span className="mb-card-from-msg">(via messages)</span>}
                    </h3>
                    {otherPerson && (
                      <p className="mb-card-person">
                        {role === 'client' ? 'with' : 'from'}{' '}
                        <strong>{otherPerson.firstName} {otherPerson.lastName}</strong>
                      </p>
                    )}
                    {b.bookingRef && <p className="mb-card-ref">Ref: {b.bookingRef}</p>}
                  </div>
                  <span className={`mb-status mb-status-${statusInfo.cls}`}>{statusInfo.label}</span>
                </div>

                <div className="mb-card-details">
                  <span>📅 {smartDate(b.date)}</span>
                  {b.startTime && (
                    <span>🕐 {formatTime12(b.startTime)}{b.endTime ? ` — ${formatTime12(b.endTime)}` : ''}</span>
                  )}
                  {b.timezone && <span className="mb-card-tz">{b.timezone.split('/').pop()}</span>}
                </div>

                {b.notes && <p className="mb-card-notes">💬 {b.notes}</p>}
                {b.cancellationReason && <p className="mb-card-cancel-reason">Reason: {b.cancellationReason}</p>}
                {b.occurrences?.length > 1 && (
                  <p className="mb-card-occurrences">📆 {b.occurrences.length} sessions in this series</p>
                )}

                <div className="mb-card-actions">
                  {b._fromMessages
                    ? <span className="mb-action-btn via-msg">💬 Via Messages</span>
                    : <Link to={`/bookings/${id}`} className="mb-action-btn view">View Details</Link>
                  }
                  {role === 'freelancer' && b.status === 'pending' && (
                    <button className="mb-action-btn confirm" onClick={() => doAction(id, 'confirm')}
                      disabled={actionLoading === `${id}_confirm`}>
                      {actionLoading === `${id}_confirm` ? '…' : '✅ Confirm'}
                    </button>
                  )}
                  {role === 'freelancer' && b.status === 'confirmed' && (
                    <button className="mb-action-btn complete" onClick={() => doAction(id, 'complete')}
                      disabled={actionLoading === `${id}_complete`}>
                      {actionLoading === `${id}_complete` ? '…' : '✓ Complete'}
                    </button>
                  )}
                  {isActive && (
                    <button className="mb-action-btn cancel" onClick={() => handleCancel(b)}
                      disabled={actionLoading === `${id}_cancel`}>
                      {actionLoading === `${id}_cancel` ? '…' : 'Cancel'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyBookings;
