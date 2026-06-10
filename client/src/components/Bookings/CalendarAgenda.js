import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../common/SEO';
import { apiRequest } from '../../utils/api';
import './CalendarAgenda.css';

function fmtDayLabel(dateStr) {
  // dateStr: YYYY-MM-DD
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  if (dateStr === todayStr) return 'Today';
  if (dateStr === tomorrow) return 'Tomorrow';

  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = String(t).split(':').map(n => Number(n));
  if (Number.isNaN(h)) return t;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  return `${hh}:${String(m || 0).padStart(2, '0')} ${ampm}`;
}

function getOtherParty(b, mode) {
  // mode: 'client' or 'freelancer' perspective
  if (mode === 'client') return b.freelancer || b.freelancerUser;
  return b.client || b.clientUser;
}

function getTitle(b) {
  return b.serviceTitle || b.service?.title || b.jobTitle || b.job?.title || 'Booking';
}

function statusLabel(s) {
  const v = String(s || '').replace(/_/g, ' ');
  return v ? v[0].toUpperCase() + v.slice(1) : 'Unknown';
}

export default function CalendarAgenda() {
  const [tab, setTab] = useState('upcoming'); // upcoming | past | cancelled | all
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const roles = ['client', 'freelancer'];
      const results = await Promise.allSettled(
        roles.map(role => apiRequest(`/api/bookings/me?role=${role}&status=${tab === 'all' ? 'all' : tab}`))
      );

      const merged = results.flatMap((r, idx) => {
        if (r.status !== 'fulfilled') return [];
        const role = roles[idx];
        const bookings = r.value.bookings || [];
        return bookings.map(b => ({ ...b, _agendaRole: role }));
      });

      // Sort by start time
      merged.sort((a, b) => {
        const da = a.date ? new Date(a.date + 'T' + (a.startTime || '00:00')).getTime() : 0;
        const db = b.date ? new Date(b.date + 'T' + (b.startTime || '00:00')).getTime() : 0;
        return da - db;
      });

      setItems(merged);
    } catch (e) {
      setError(e.message || 'Failed to load agenda');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const b of items) {
      const day = b.date || 'Unknown';
      if (!map.has(day)) map.set(day, []);
      map.get(day).push(b);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <div className="cal-agenda-page">
      <SEO title="Calendar | Agenda" path="/calendar" noIndex />

      <div className="cal-agenda-header">
        <div>
          <h1>Calendar</h1>
          <p className="cal-agenda-sub">Agenda view (bookings as client + freelancer)</p>
        </div>
        <div className="cal-agenda-actions">
          <Link className="cal-btn cal-btn-secondary" to="/calendar-connect">Calendar Settings</Link>
          <a className="cal-btn cal-btn-primary" href="https://calendar.google.com" target="_blank" rel="noreferrer">Open Google Calendar</a>
        </div>
      </div>

      <div className="cal-tabs">
        {['upcoming', 'past', 'cancelled', 'all'].map(k => (
          <button
            key={k}
            className={`cal-tab ${tab === k ? 'active' : ''}`}
            onClick={() => setTab(k)}
          >
            {k === 'all' ? 'All' : statusLabel(k)}
          </button>
        ))}
        <button className="cal-tab" onClick={load} disabled={loading}>↻</button>
      </div>

      {error && <div className="cal-error">{error}</div>}

      {loading ? (
        <div className="cal-loading">Loading agenda…</div>
      ) : items.length === 0 ? (
        <div className="cal-empty">
          <div className="cal-empty-title">No bookings found</div>
          <div className="cal-empty-sub">When you have bookings, they’ll show up here by day.</div>
          <div className="cal-empty-actions">
            <Link className="cal-btn cal-btn-primary" to="/bookings">Go to Bookings</Link>
          </div>
        </div>
      ) : (
        <div className="cal-days">
          {grouped.map(([day, dayItems]) => (
            <section key={day} className="cal-day">
              <div className="cal-day-header">
                <h2>{day !== 'Unknown' ? fmtDayLabel(day) : 'Unscheduled'}</h2>
                {day !== 'Unknown' && <span className="cal-day-date">{day}</span>}
              </div>

              <div className="cal-cards">
                {dayItems.map(b => {
                  const other = getOtherParty(b, b._agendaRole);
                  const otherName = other ? [other.firstName, other.lastName].filter(Boolean).join(' ') || other.email : '—';
                  const time = b.startTime ? fmtTime(b.startTime) : '';
                  const end = b.endTime ? fmtTime(b.endTime) : '';
                  const bookingId = b.id || b._id;

                  return (
                    <Link key={String(bookingId)} to={`/bookings/${bookingId}`} className="cal-card">
                      <div className="cal-card-top">
                        <div className="cal-card-title">{getTitle(b)}</div>
                        <span className={`cal-badge cal-badge-${String(b.status || 'unknown')}`}>{statusLabel(b.status)}</span>
                      </div>
                      <div className="cal-card-meta">
                        <span className="cal-pill">{b._agendaRole === 'client' ? 'You hired' : 'You provide'}</span>
                        <span className="cal-meta">{otherName}</span>
                      </div>
                      <div className="cal-card-time">
                        {time ? (
                          <>
                            <span>{time}{end ? `–${end}` : ''}</span>
                            {b.timezone && <span className="cal-tz">{b.timezone}</span>}
                          </>
                        ) : (
                          <span className="cal-muted">Time not set</span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
