import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api';
import './AvailabilitySettings.css';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SLOT_DURATIONS = [{ label: '30 min', value: 30 }, { label: '1 hour', value: 60 },
  { label: '1.5 hours', value: 90 }, { label: '2 hours', value: 120 }, { label: '4 hours', value: 240 }];
const BUFFERS = [{ label: 'None', value: 0 }, { label: '15 min', value: 15 },
  { label: '30 min', value: 30 }, { label: '1 hour', value: 60 }];
const TIMEZONES = [
  'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
  'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Australia/Sydney',
];

const defaultWindow = () => ({ startTime: '09:00', endTime: '17:00' });
const defaultSchedule = () => DAYS.map((_, i) => ({
  dayOfWeek: i,
  enabled:   i >= 1 && i <= 5, // Mon–Fri on by default
  windows:   [defaultWindow()],
}));

const AvailabilitySettings = ({ onSaved }) => {
  const [loading, setSaving] = useState(false);
  const [saved,   setSaved]  = useState(false);
  const [error,   setError]  = useState('');

  const [timezone,      setTimezone]      = useState('America/Los_Angeles');
  const [slotDuration,  setSlotDuration]  = useState(60);
  const [bufferTime,    setBufferTime]    = useState(0);
  const [capacity,      setCapacity]      = useState(1);
  const [minNotice,     setMinNotice]     = useState(24);
  const [maxAdvance,    setMaxAdvance]    = useState(60);
  const [schedule,      setSchedule]      = useState(defaultSchedule());
  const [exceptions,    setExceptions]    = useState([]);
  const [newException,  setNewException]  = useState({ date: '', unavailable: true });

  useEffect(() => {
    apiRequest('/api/availability/me')
      .then(d => {
        if (!d.availability) return;
        const a = d.availability;
        setTimezone(a.timezone     || 'America/Los_Angeles');
        setSlotDuration(a.defaultSlotDuration   || 60);
        setBufferTime(a.bufferTime   || 0);
        setCapacity(a.defaultCapacity || 1);
        setMinNotice(a.minNoticeHours || 24);
        setMaxAdvance(a.maxAdvanceBookingDays || 60);
        setExceptions(a.exceptions   || []);

        // Rebuild schedule with enabled flags
        const built = defaultSchedule().map(day => {
          const existing = (a.weeklySchedule || []).find(d => d.dayOfWeek === day.dayOfWeek);
          return existing
            ? { ...day, enabled: existing.windows?.length > 0, windows: existing.windows?.length > 0 ? existing.windows : [defaultWindow()] }
            : day;
        });
        setSchedule(built);
      })
      .catch(() => {}); // No availability yet — use defaults
  }, []);

  const toggleDay = (idx) => {
    setSchedule(s => s.map((d, i) => i === idx ? { ...d, enabled: !d.enabled } : d));
  };

  const updateWindow = (dayIdx, winIdx, field, value) => {
    setSchedule(s => s.map((d, i) => {
      if (i !== dayIdx) return d;
      const windows = d.windows.map((w, j) => j === winIdx ? { ...w, [field]: value } : w);
      return { ...d, windows };
    }));
  };

  const addWindow = (dayIdx) => {
    setSchedule(s => s.map((d, i) =>
      i === dayIdx ? { ...d, windows: [...d.windows, defaultWindow()] } : d
    ));
  };

  const removeWindow = (dayIdx, winIdx) => {
    setSchedule(s => s.map((d, i) => {
      if (i !== dayIdx) return d;
      const windows = d.windows.filter((_, j) => j !== winIdx);
      return { ...d, windows: windows.length ? windows : [defaultWindow()] };
    }));
  };

  const addException = () => {
    if (!newException.date) return;
    setExceptions(e => [...e.filter(x => x.date !== newException.date), { ...newException }]);
    setNewException({ date: '', unavailable: true });
  };

  const removeException = (date) => setExceptions(e => e.filter(x => x.date !== date));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const weeklySchedule = schedule
        .filter(d => d.enabled)
        .map(d => ({ dayOfWeek: d.dayOfWeek, windows: d.windows }));

      await apiRequest('/api/availability', {
        method: 'PUT',
        body: JSON.stringify({
          timezone, defaultSlotDuration: slotDuration, bufferTime,
          defaultCapacity: capacity, minNoticeHours: minNotice,
          maxAdvanceBookingDays: maxAdvance, weeklySchedule, exceptions,
        }),
      });
      setSaved(true);
      onSaved?.();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="avail-settings">
      <h2 className="avail-title">Availability Settings</h2>
      <p className="avail-subtitle">Set when clients can book sessions with you.</p>

      {/* ── General settings ── */}
      <div className="avail-card">
        <h3>General</h3>
        <div className="avail-row">
          <div className="avail-field">
            <label>Timezone</label>
            <select value={timezone} onChange={e => setTimezone(e.target.value)}>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <div className="avail-field">
            <label>Session Duration</label>
            <select value={slotDuration} onChange={e => setSlotDuration(Number(e.target.value))}>
              {SLOT_DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div className="avail-field">
            <label>Buffer Between Sessions</label>
            <select value={bufferTime} onChange={e => setBufferTime(Number(e.target.value))}>
              {BUFFERS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </div>
        </div>
        <div className="avail-row">
          <div className="avail-field">
            <label>Max Slots Per Session <span className="avail-hint">(1 = individual, &gt;1 = group)</span></label>
            <input type="number" min="1" max="100" value={capacity}
              onChange={e => setCapacity(Number(e.target.value))} />
          </div>
          <div className="avail-field">
            <label>Minimum Notice <span className="avail-hint">(hours)</span></label>
            <input type="number" min="0" max="168" value={minNotice}
              onChange={e => setMinNotice(Number(e.target.value))} />
          </div>
          <div className="avail-field">
            <label>Book Up To <span className="avail-hint">(days in advance)</span></label>
            <input type="number" min="1" max="365" value={maxAdvance}
              onChange={e => setMaxAdvance(Number(e.target.value))} />
          </div>
        </div>
      </div>

      {/* ── Weekly schedule ── */}
      <div className="avail-card">
        <h3>Weekly Schedule</h3>
        <p className="avail-hint-block">Toggle days on/off. Add multiple time windows per day for split availability.</p>
        <div className="avail-days">
          {schedule.map((day, dayIdx) => (
            <div key={day.dayOfWeek} className={`avail-day ${day.enabled ? 'enabled' : ''}`}>
              <div className="avail-day-header">
                <button
                  type="button"
                  className={`avail-day-toggle ${day.enabled ? 'on' : 'off'}`}
                  onClick={() => toggleDay(dayIdx)}
                >
                  <span className="avail-day-toggle-dot" />
                </button>
                <span className="avail-day-name">{DAYS[day.dayOfWeek]}</span>
                {!day.enabled && <span className="avail-unavail">Unavailable</span>}
              </div>

              {day.enabled && (
                <div className="avail-windows">
                  {day.windows.map((win, winIdx) => (
                    <div key={winIdx} className="avail-window-row">
                      <input
                        type="time" value={win.startTime}
                        onChange={e => updateWindow(dayIdx, winIdx, 'startTime', e.target.value)}
                      />
                      <span className="avail-dash">–</span>
                      <input
                        type="time" value={win.endTime}
                        onChange={e => updateWindow(dayIdx, winIdx, 'endTime', e.target.value)}
                      />
                      {day.windows.length > 1 && (
                        <button type="button" className="avail-win-remove"
                          onClick={() => removeWindow(dayIdx, winIdx)}>×</button>
                      )}
                    </div>
                  ))}
                  <button type="button" className="avail-add-window"
                    onClick={() => addWindow(dayIdx)}>
                    + Add hours
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Exceptions / days off ── */}
      <div className="avail-card">
        <h3>Days Off &amp; Exceptions</h3>
        <p className="avail-hint-block">Block out specific dates (vacation, holidays, etc.).</p>

        <div className="avail-exception-add">
          <input type="date" value={newException.date}
            onChange={e => setNewException(x => ({ ...x, date: e.target.value }))} />
          <button type="button" className="avail-add-exc-btn" onClick={addException}
            disabled={!newException.date}>
            Block This Date
          </button>
        </div>

        {exceptions.length > 0 && (
          <div className="avail-exceptions-list">
            {exceptions.sort((a, b) => a.date.localeCompare(b.date)).map(exc => (
              <div key={exc.date} className="avail-exc-row">
                <span>📵 {exc.date}</span>
                <button type="button" onClick={() => removeException(exc.date)}>Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error  && <p className="avail-error">{error}</p>}
      {saved  && <p className="avail-success">✅ Availability saved!</p>}

      <button
        type="button"
        className="avail-save-btn"
        onClick={handleSave}
        disabled={loading}
      >
        {loading ? 'Saving…' : 'Save Availability'}
      </button>
    </div>
  );
};

export default AvailabilitySettings;
