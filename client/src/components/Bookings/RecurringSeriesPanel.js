import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import './RecurringSeriesPanel.css';

function bid(booking) { return booking?.id || booking?._id; }

function fmtDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  return isNaN(d) ? str : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function normaliseOccurrence(o, i) {
  const date = o.date
    || (o.startAtUtc ? new Date(o.startAtUtc).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '—');
  const time = o.startTime
    || (o.localStartWallclock ? fmtTime(o.localStartWallclock.split('T')[1]?.slice(0, 5)) : '');
  return { ...o, _date: date, _time: time, _no: o.occurrenceNo ?? i + 1 };
}

const FREQ_LABELS = { weekly: 'Weekly', biweekly: 'Every 2 weeks', monthly: 'Monthly', custom: 'Custom interval' };
const STATUS_CLS  = { active: 'rsp-badge-green', paused: 'rsp-badge-amber', cancelled: 'rsp-badge-gray' };
const OCC_ACTIVE  = ['upcoming', 'pending', 'confirmed', 'hold'];

/* ─── Create Series Form ─── */
function CreateSeriesForm({ booking, onSuccess, onError }) {
  const bookingId = bid(booking);
  const today     = new Date().toISOString().split('T')[0];

  const [freq, setFreq]             = useState('weekly');
  const [interval, setInterval]     = useState(7);
  const [startDate, setStartDate]   = useState(booking.date || today);
  const [startTime, setStartTime]   = useState(booking.startTime || '09:00');
  const [endTime, setEndTime]       = useState(booking.endTime || '10:00');
  const [timezone, setTimezone]     = useState(booking.timezone || 'America/Los_Angeles');
  const [endMode, setEndMode]       = useState('occurrences');
  const [endDate, setEndDate]       = useState('');
  const [maxOcc, setMaxOcc]         = useState(8);
  const [submitting, setSub]        = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSub(true);
    try {
      const body = {
        frequency:  freq,
        startDate,
        startTime,
        endTime,
        timezone,
        ...(freq === 'custom' && { intervalDays: Number(interval) }),
        ...(endMode === 'date' ? { endDate } : { maxOccurrences: Number(maxOcc) }),
      };
      await apiRequest(`/api/bookings/${bookingId}/series`, {
        method:  'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body:    JSON.stringify(body),
      });
      onSuccess('Recurring series created ✅');
    } catch (err) {
      onError(err.message);
    } finally {
      setSub(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rsp-form">
      <label className="rsp-label">
        Frequency
        <select className="rsp-select" value={freq} onChange={e => setFreq(e.target.value)}>
          <option value="weekly">Weekly</option>
          <option value="biweekly">Every 2 weeks</option>
          <option value="monthly">Monthly</option>
          <option value="custom">Custom interval</option>
        </select>
      </label>

      {freq === 'custom' && (
        <label className="rsp-label">
          Every N days
          <input className="rsp-input" type="number" min="1" value={interval}
            onChange={e => setInterval(e.target.value)} />
        </label>
      )}

      <div className="rsp-row">
        <label className="rsp-label">
          Start Date
          <input className="rsp-input" type="date" min={today} value={startDate}
            onChange={e => setStartDate(e.target.value)} required />
        </label>
        <label className="rsp-label">
          Timezone
          <input className="rsp-input" type="text" value={timezone}
            onChange={e => setTimezone(e.target.value)} required />
        </label>
      </div>

      <div className="rsp-row">
        <label className="rsp-label">
          Start Time
          <input className="rsp-input" type="time" value={startTime}
            onChange={e => setStartTime(e.target.value)} required />
        </label>
        <label className="rsp-label">
          End Time
          <input className="rsp-input" type="time" value={endTime}
            onChange={e => setEndTime(e.target.value)} required />
        </label>
      </div>

      <div className="rsp-label">
        End After
        <div className="rsp-radio-group">
          <label className="rsp-radio">
            <input type="radio" value="occurrences" checked={endMode === 'occurrences'}
              onChange={() => setEndMode('occurrences')} />
            # of sessions
          </label>
          <label className="rsp-radio">
            <input type="radio" value="date" checked={endMode === 'date'}
              onChange={() => setEndMode('date')} />
            By date
          </label>
        </div>
      </div>

      {endMode === 'occurrences' && (
        <label className="rsp-label">
          Sessions
          <input className="rsp-input" type="number" min="2" max="52" value={maxOcc}
            onChange={e => setMaxOcc(e.target.value)} />
        </label>
      )}
      {endMode === 'date' && (
        <label className="rsp-label">
          End Date
          <input className="rsp-input" type="date" min={startDate} value={endDate}
            onChange={e => setEndDate(e.target.value)} required />
        </label>
      )}

      <button type="submit" className="rsp-btn" disabled={submitting}>
        {submitting ? 'Creating…' : '✅ Create Recurring Series'}
      </button>
    </form>
  );
}

/* ─── Manage Series Section ─── */
function ManageSeries({ booking, seriesId, onRefresh, onMessage }) {
  const bookingId = bid(booking);
  const [series, setSeries]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // Skip occurrence state
  const [skipId, setSkipId]   = useState('');

  // Cancel-from state
  const [cancelFrom, setCancelFrom] = useState('');
  const [cancelFromReason, setCancelFromReason] = useState('');

  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await apiRequest(`/api/bookings/${bookingId}/series/${seriesId}`);
      setSeries(data.series);
      // Pre-select first upcoming occurrence for skip
      const first = data.series?.occurrences?.find(o => OCC_ACTIVE.includes(o.status));
      if (first) setSkipId(first.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [bookingId, seriesId]);

  useEffect(() => { load(); }, [load]);

  const mutate = async (route, method, body = {}) => {
    setBusy(route);
    try {
      await apiRequest(`/api/bookings/${bookingId}/series/${seriesId}${route}`, {
        method,
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: method !== 'DELETE' || Object.keys(body).length ? JSON.stringify(body) : undefined,
      });
      await load();
      onRefresh();
      onMessage('Done ✅', true);
    } catch (err) {
      onMessage(err.message, false);
    } finally {
      setBusy('');
    }
  };

  if (loading) return <div className="rsp-loading">Loading series…</div>;
  if (error)   return <div className="rsp-error">{error}</div>;
  if (!series) return null;

  const occurrences  = (series.occurrences || []).map(normaliseOccurrence);
  const upcoming     = occurrences.filter(o => OCC_ACTIVE.includes(o.status));
  const statusCls    = STATUS_CLS[series.status] || 'rsp-badge-gray';

  return (
    <>
      {/* Series header */}
      <div className="rsp-series-header">
        <div>
          <span className="rsp-freq-label">{FREQ_LABELS[series.frequency] || series.frequency}</span>
          {series.startDate && (
            <span className="rsp-date-range"> · {fmtDate(series.startDate)}
              {series.endDate ? ` → ${fmtDate(series.endDate)}` : ''}
            </span>
          )}
        </div>
        <span className={`rsp-badge ${statusCls}`}>{series.status}</span>
      </div>

      {/* Occurrences list */}
      {occurrences.length > 0 && (
        <div className="rsp-occurrences">
          {occurrences.map(o => {
            const inactive = !OCC_ACTIVE.includes(o.status);
            return (
              <div key={o.id || o._no} className={`rsp-occurrence ${inactive ? 'inactive' : ''}`}>
                <span className="rsp-occ-no">#{o._no}</span>
                <span className="rsp-occ-date">{o._date}</span>
                {o._time && <span className="rsp-occ-time">{fmtTime(o._time)}</span>}
                <span className={`rsp-occ-badge ${OCC_ACTIVE.includes(o.status) ? 'rsp-badge-green' : 'rsp-badge-gray'}`}>
                  {o.status}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="rsp-actions">

        {/* Skip */}
        {upcoming.length > 0 && series.status !== 'cancelled' && (
          <div className="rsp-action-group">
            <span className="rsp-action-title">Skip an Occurrence</span>
            <div className="rsp-inline">
              <select className="rsp-select" value={skipId} onChange={e => setSkipId(e.target.value)}>
                {upcoming.map(o => (
                  <option key={o.id} value={o.id}>#{o._no} — {o._date}</option>
                ))}
              </select>
              <button className="rsp-btn-secondary" disabled={!skipId || !!busy}
                onClick={() => mutate('/skip', 'PATCH', { occurrenceId: skipId })}>
                {busy === '/skip' ? '…' : 'Skip'}
              </button>
            </div>
          </div>
        )}

        {/* Cancel from date */}
        {series.status !== 'cancelled' && (
          <div className="rsp-action-group">
            <span className="rsp-action-title">Cancel From Date</span>
            <div className="rsp-inline">
              <input className="rsp-input" type="date" value={cancelFrom}
                onChange={e => setCancelFrom(e.target.value)} />
              <input className="rsp-input" type="text" placeholder="Reason (optional)"
                value={cancelFromReason} onChange={e => setCancelFromReason(e.target.value)} />
              <button className="rsp-btn-secondary" disabled={!cancelFrom || !!busy}
                onClick={() => mutate('/cancel-from', 'PATCH', { fromDate: cancelFrom, reason: cancelFromReason })}>
                {busy === '/cancel-from' ? '…' : 'Cancel From Here'}
              </button>
            </div>
          </div>
        )}

        {/* Pause / Resume */}
        {series.status === 'active' && (
          <button className="rsp-btn-secondary" disabled={!!busy}
            onClick={() => mutate('/pause', 'PATCH')}>
            {busy === '/pause' ? '…' : '⏸ Pause Series'}
          </button>
        )}
        {series.status === 'paused' && (
          <button className="rsp-btn" disabled={!!busy}
            onClick={() => mutate('/resume', 'PATCH')}>
            {busy === '/resume' ? '…' : '▶ Resume Series'}
          </button>
        )}

        {/* Cancel entire */}
        {series.status !== 'cancelled' && (
          <div className="rsp-action-group">
            <span className="rsp-action-title">Danger Zone</span>
            <button className="rsp-btn-danger" disabled={!!busy}
              onClick={() => {
                if (window.confirm('Cancel this entire recurring series? This cannot be undone.')) {
                  mutate('', 'DELETE', { reason: 'User cancelled' });
                }
              }}>
              {busy === '' && busy !== undefined ? '…' : '✕ Cancel Entire Series'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Main Panel ─── */
export default function RecurringSeriesPanel({ booking, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [flash, setFlash]       = useState({ text: '', ok: true });

  const showMsg = (text, ok) => {
    setFlash({ text, ok });
    setTimeout(() => setFlash({ text: '', ok: true }), 4500);
    if (ok) onRefresh();
  };

  const hasSeries = !!booking?.seriesId;

  return (
    <div className="rsp-card">
      {/* Panel header */}
      <div className="rsp-header" onClick={() => setExpanded(x => !x)} role="button" tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && setExpanded(x => !x)}>
        <span className="rsp-title">🔄 Recurring Series</span>
        <span className="rsp-toggle">{expanded ? '▲' : '▼'}</span>
      </div>

      {flash.text && (
        <div className={`rsp-flash ${flash.ok ? 'rsp-flash-ok' : 'rsp-flash-err'}`}>{flash.text}</div>
      )}

      {expanded && (
        <div className="rsp-body">
          {!hasSeries ? (
            <>
              <p className="rsp-hint">Turn this booking into a recurring series.</p>
              <CreateSeriesForm
                booking={booking}
                onSuccess={msg => showMsg(msg, true)}
                onError={msg => showMsg(msg, false)}
              />
            </>
          ) : (
            <ManageSeries
              booking={booking}
              seriesId={booking.seriesId}
              onRefresh={onRefresh}
              onMessage={showMsg}
            />
          )}
        </div>
      )}
    </div>
  );
}
