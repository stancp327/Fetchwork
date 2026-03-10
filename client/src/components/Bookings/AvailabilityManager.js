import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import { useFeatures } from '../../hooks/useFeatures';
import { usePublicHolidays } from '../../hooks/usePublicHolidays';
import './AvailabilityManager.css';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SLOT_DURATIONS = [30, 45, 60, 90, 120, 240];
const BUFFER_OPTIONS = [0, 15, 30, 45, 60];
const TIMEZONES = [
  'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
  'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Australia/Sydney',
];

const LOCATION_MODES = [
  { value: 'remote',         label: '💻 Remote only',                desc: 'Video call, phone, or online' },
  { value: 'at_freelancer',  label: '📍 At my location',            desc: 'Client comes to you' },
  { value: 'at_client',      label: '🚗 I travel to the client',    desc: 'You go to the client' },
  { value: 'flexible',       label: '🔄 Flexible',                  desc: 'Remote, at your place, or travel — client chooses' },
];

const defaultWindow = () => ({ startTime: '09:00', endTime: '17:00' });

const AvailabilityManager = () => {
  const { serviceId } = useParams();
  const navigate      = useNavigate();
  const { hasFeature } = useFeatures();
  const canGroupBooking = hasFeature('capacity_controls');
  const currentYear = new Date().getFullYear();
  const { holidays } = usePublicHolidays(currentYear);
  const [blockedHolidays, setBlockedHolidays] = useState([]);

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);
  const [success, setSuccess]   = useState('');
  const [serviceName, setServiceName] = useState('');
  const [hasGlobal, setHasGlobal]     = useState(true);

  // Schedule fields (per-service override)
  const [useOverride, setUseOverride] = useState(false);
  const [enabled, setEnabled]           = useState(true);
  const [timezone, setTimezone]         = useState('');
  const [slotDuration, setSlotDuration] = useState(0);
  const [bufferTime, setBufferTime]     = useState(0);
  const [capacity, setCapacity]         = useState(1);
  const [minNotice, setMinNotice]       = useState(24);
  const [maxAdvance, setMaxAdvance]     = useState(60);
  const [schedule, setSchedule]         = useState([]);

  // Location fields
  const [locationMode, setLocationMode]     = useState('remote');
  const [locationAddress, setLocationAddr]  = useState('');
  const [travelRadius, setTravelRadius]     = useState(25);
  const [locationNotes, setLocationNotes]   = useState('');

  // Resolved (from global + override merged)
  const [resolvedInfo, setResolvedInfo] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Load resolved availability for this service
      const data = await apiRequest(`/api/availability/service/${serviceId}`);
      const a = data.availability;
      const loc = data.serviceLocation;

      if (!a) {
        setHasGlobal(false);
      } else {
        setHasGlobal(true);
        setResolvedInfo(a);
        setTimezone(a.timezone || 'America/Los_Angeles');
        setSlotDuration(a.slotDuration || 60);
        setBufferTime(a.bufferTime || 0);
        setCapacity(a.capacity || 1);
        setMinNotice(a.minNoticeHours || 24);
        setMaxAdvance(a.maxAdvanceBookingDays || 60);
        setEnabled(a.isActive !== false);
        setUseOverride(!!a.isOverride);

        // Convert weeklySchedule to day-indexed format
        const ws = a.weeklySchedule || [];
        const daySchedule = DAYS.map((_, i) => {
          const existing = ws.find(d => d.dayOfWeek === i);
          return {
            dayOfWeek: i,
            enabled:   !!existing && existing.windows?.length > 0,
            windows:   existing?.windows?.length > 0 ? existing.windows : [defaultWindow()],
          };
        });
        setSchedule(daySchedule);
      }

      // Location
      if (loc) {
        setLocationMode(loc.mode || 'remote');
        setLocationAddr(loc.address || '');
        setTravelRadius(loc.travelRadius || 25);
        setLocationNotes(loc.notes || '');
      }

      // Service name
      const svc = await apiRequest(`/api/services/${serviceId}`);
      setServiceName(svc.title || svc.service?.title || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => { load(); }, [load]);

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

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess('');
    try {
      // Save location
      await apiRequest(`/api/availability/service/${serviceId}/location`, {
        method: 'PUT',
        body: JSON.stringify({
          mode:         locationMode,
          address:      locationAddress,
          travelRadius: travelRadius,
          notes:        locationNotes,
        }),
      });

      // Save per-service availability override (if customized)
      if (useOverride) {
        const weeklySchedule = schedule
          .filter(d => d.enabled)
          .map(d => ({ dayOfWeek: d.dayOfWeek, windows: d.windows }));

        await apiRequest(`/api/availability/service/${serviceId}`, {
          method: 'PUT',
          body: JSON.stringify({
            timezone,
            slotDuration,
            bufferTime,
            capacity,
            minNoticeHours: minNotice,
            maxAdvanceBookingDays: maxAdvance,
            weeklySchedule,
            isActive: enabled,
            blockedDates: blockedHolidays,
          }),
        });
      }

      setSuccess('Settings saved ✅');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="am-loading">Loading…</div>;

  if (!hasGlobal) {
    return (
      <div className="am-page">
        <div className="am-alert">
          <h3>⚠️ Set up global availability first</h3>
          <p>Before customizing availability for this service, set your default schedule.</p>
          <button className="am-btn" onClick={() => navigate('/settings')}>
            Go to Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="am-page">
      <div className="am-header">
        <button className="am-back" onClick={() => navigate(-1)}>← Back</button>
        <h1 className="am-title">Availability: {serviceName}</h1>
        <p className="am-subtitle">Customize scheduling and location for this service</p>
      </div>

      {error && <div className="am-error">{error}</div>}
      {success && <div className="am-success">{success}</div>}

      {/* ── Location Section ── */}
      <div className="am-card">
        <h2 className="am-section-title">📍 Service Location</h2>
        <p className="am-hint">How and where will you deliver this service?</p>

        <div className="am-location-modes">
          {LOCATION_MODES.map(m => (
            <button
              key={m.value}
              className={`am-location-mode ${locationMode === m.value ? 'active' : ''}`}
              onClick={() => setLocationMode(m.value)}
              type="button"
            >
              <span className="am-location-mode-label">{m.label}</span>
              <span className="am-location-mode-desc">{m.desc}</span>
            </button>
          ))}
        </div>

        {(locationMode === 'at_freelancer' || locationMode === 'flexible') && (
          <div className="am-field">
            <label>Your Service Address</label>
            <input
              type="text"
              placeholder="e.g. 123 Main St, Suite 4, Oakland CA"
              value={locationAddress}
              onChange={e => setLocationAddr(e.target.value)}
            />
          </div>
        )}

        {(locationMode === 'at_client' || locationMode === 'flexible') && (
          <div className="am-field">
            <label>Travel Radius (miles)</label>
            <input
              type="number"
              min="1"
              max="200"
              value={travelRadius}
              onChange={e => setTravelRadius(Number(e.target.value))}
            />
            <span className="am-hint">How far you're willing to travel to the client</span>
          </div>
        )}

        <div className="am-field">
          <label>Location Notes (optional)</label>
          <input
            type="text"
            placeholder="e.g. Free parking, buzzer #4"
            value={locationNotes}
            onChange={e => setLocationNotes(e.target.value)}
            maxLength={300}
          />
        </div>
      </div>

      {/* ── Schedule Override Toggle ── */}
      <div className="am-card">
        <div className="am-override-toggle">
          <div>
            <h2 className="am-section-title">🕐 Custom Schedule</h2>
            <p className="am-hint">
              {useOverride
                ? 'This service has its own schedule (overrides your global defaults).'
                : 'Using your global availability schedule. Toggle to customize for this service only.'}
            </p>
          </div>
          <button
            className={`am-toggle ${useOverride ? 'on' : 'off'}`}
            onClick={() => setUseOverride(!useOverride)}
            type="button"
          >
            <span className="am-toggle-dot" />
          </button>
        </div>

        {!useOverride && resolvedInfo && (
          <div className="am-resolved-summary">
            <p><strong>Current:</strong> {resolvedInfo.timezone}, {resolvedInfo.slotDuration}min sessions,
              {resolvedInfo.bufferTime > 0 ? ` ${resolvedInfo.bufferTime}min buffer,` : ''} up to {resolvedInfo.maxAdvanceBookingDays} days out</p>
          </div>
        )}
      </div>

      {/* ── Custom Schedule Fields (when override is on) ── */}
      {useOverride && (
        <>
          <div className="am-card">
            <h3>General</h3>
            <div className="am-row">
              <div className="am-field">
                <label>Timezone</label>
                <select value={timezone} onChange={e => setTimezone(e.target.value)}>
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
              <div className="am-field">
                <label>Session Duration</label>
                <select value={slotDuration} onChange={e => setSlotDuration(Number(e.target.value))}>
                  {SLOT_DURATIONS.map(d => <option key={d} value={d}>{d} min</option>)}
                </select>
              </div>
              <div className="am-field">
                <label>Buffer Between Sessions</label>
                <select value={bufferTime} onChange={e => setBufferTime(Number(e.target.value))}>
                  {BUFFER_OPTIONS.map(b => <option key={b} value={b}>{b === 0 ? 'None' : `${b} min`}</option>)}
                </select>
              </div>
            </div>
            <div className="am-row">
              {canGroupBooking && (
                <div className="am-field">
                  <label>Max Per Slot <span className="am-hint">(1 = 1:1, &gt;1 = group)</span></label>
                  <input type="number" min="1" max="100" value={capacity}
                    onChange={e => setCapacity(Number(e.target.value))} />
                </div>
              )}
              <div className="am-field">
                <label>Minimum Notice <span className="am-hint">(hours)</span></label>
                <input type="number" min="0" max="168" value={minNotice}
                  onChange={e => setMinNotice(Number(e.target.value))} />
              </div>
              <div className="am-field">
                <label>Book Up To <span className="am-hint">(days ahead)</span></label>
                <input type="number" min="1" max="365" value={maxAdvance}
                  onChange={e => setMaxAdvance(Number(e.target.value))} />
              </div>
            </div>
          </div>

          {/* Weekly Schedule */}
          <div className="am-card">
            <h3>Weekly Schedule</h3>
            <p className="am-hint">Toggle days on/off and set time windows.</p>
            <div className="am-days">
              {schedule.map((day, dayIdx) => (
                <div key={day.dayOfWeek} className={`am-day ${day.enabled ? 'enabled' : ''}`}>
                  <div className="am-day-header">
                    <button
                      type="button"
                      className={`am-day-toggle ${day.enabled ? 'on' : 'off'}`}
                      onClick={() => toggleDay(dayIdx)}
                    >
                      <span className="am-day-toggle-dot" />
                    </button>
                    <span className="am-day-name">{DAYS[day.dayOfWeek]}</span>
                    {!day.enabled && <span className="am-unavail">Unavailable</span>}
                  </div>
                  {day.enabled && (
                    <div className="am-windows">
                      {day.windows.map((win, winIdx) => (
                        <div key={winIdx} className="am-window-row">
                          <input type="time" value={win.startTime}
                            onChange={e => updateWindow(dayIdx, winIdx, 'startTime', e.target.value)} />
                          <span className="am-dash">—</span>
                          <input type="time" value={win.endTime}
                            onChange={e => updateWindow(dayIdx, winIdx, 'endTime', e.target.value)} />
                          {day.windows.length > 1 && (
                            <button type="button" className="am-remove-window"
                              onClick={() => removeWindow(dayIdx, winIdx)}>✕</button>
                          )}
                        </div>
                      ))}
                      <button type="button" className="am-add-window"
                        onClick={() => addWindow(dayIdx)}>+ Add time window</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Public Holidays */}
      {holidays.length > 0 && (
        <div className="am-section am-holidays">
          <h2 className="am-section-title">🎉 Public Holidays</h2>
          <p className="am-section-desc">Toggle holidays off to block bookings on those days. Clients won't see available slots on blocked dates.</p>
          <div className="am-holiday-list">
            {holidays.map(h => {
              const blocked = blockedHolidays.includes(h.date);
              return (
                <label key={h.date} className={`am-holiday-row${blocked ? ' am-holiday-row--blocked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={blocked}
                    onChange={() => setBlockedHolidays(prev =>
                      blocked ? prev.filter(d => d !== h.date) : [...prev, h.date]
                    )}
                  />
                  <span className="am-holiday-date">
                    {new Date(h.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="am-holiday-name">{h.name}</span>
                  {blocked && <span className="am-holiday-badge">Blocked</span>}
                </label>
              );
            })}
          </div>
          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
            Blocked holidays are saved with your availability settings.
          </p>
        </div>
      )}

      {/* Save */}
      <div className="am-actions">
        <button className="am-btn" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : '💾 Save Settings'}
        </button>
      </div>
    </div>
  );
};

export default AvailabilityManager;
