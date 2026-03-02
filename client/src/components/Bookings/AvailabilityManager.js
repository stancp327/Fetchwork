import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import './AvailabilityManager.css';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SLOT_DURATIONS = [30, 45, 60, 90, 120];
const BUFFER_OPTIONS = [0, 15, 30, 45, 60];

const AvailabilityManager = () => {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);
  const [success, setSuccess]   = useState('');
  const [serviceName, setServiceName] = useState('');

  const [enabled, setEnabled]           = useState(false);
  const [windows, setWindows]           = useState([]);
  const [slotDuration, setSlotDuration] = useState(60);
  const [bufferTime, setBufferTime]     = useState(0);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(30);
  const [maxPerSlot, setMaxPerSlot]     = useState(1);
  const [timezone, setTimezone]         = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`/api/bookings/availability/${serviceId}`);
      const a = data.availability || {};
      setEnabled(a.enabled || false);
      setWindows(a.windows || []);
      setSlotDuration(a.slotDuration || 60);
      setBufferTime(a.bufferTime || 0);
      setMaxAdvanceDays(a.maxAdvanceDays || 30);
      setMaxPerSlot(a.maxPerSlot || 1);
      if (a.timezone) setTimezone(a.timezone);

      // Get service name
      const svc = await apiRequest(`/api/services/${serviceId}`);
      setServiceName(svc.title || svc.service?.title || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => { load(); }, [load]);

  const addWindow = (dayOfWeek) => {
    setWindows(prev => [...prev, { dayOfWeek, startTime: '09:00', endTime: '17:00' }]);
  };

  const removeWindow = (index) => {
    setWindows(prev => prev.filter((_, i) => i !== index));
  };

  const updateWindow = (index, field, value) => {
    setWindows(prev => prev.map((w, i) => i === index ? { ...w, [field]: value } : w));
  };

  const handleSave = async () => {
    setSaving(true); setError(null); setSuccess('');
    try {
      await apiRequest(`/api/bookings/availability/${serviceId}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled, windows, slotDuration, bufferTime, maxAdvanceDays, maxPerSlot, timezone }),
      });
      setSuccess('Availability saved!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="am-loading">Loading availability...</div>;

  // Group windows by day
  const windowsByDay = DAYS.map((_, i) => windows
    .map((w, idx) => ({ ...w, _idx: idx }))
    .filter(w => w.dayOfWeek === i)
  );

  return (
    <div className="am-page">
      <div className="am-header">
        <button className="am-back" onClick={() => navigate(-1)}>← Back</button>
        <div>
          <h1 className="am-title">📅 Booking Availability</h1>
          {serviceName && <p className="am-service-name">{serviceName}</p>}
        </div>
      </div>

      {error && <div className="am-error">{error}</div>}
      {success && <div className="am-success">{success}</div>}

      {/* Enable toggle */}
      <div className="am-toggle-row">
        <label className="am-toggle">
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
          <span className="am-toggle-slider" />
        </label>
        <div>
          <strong>Accept Bookings</strong>
          <p className="am-hint">When enabled, clients can book available time slots on your service page</p>
        </div>
      </div>

      {enabled && (
        <>
          {/* Settings row */}
          <div className="am-settings">
            <div className="am-setting">
              <label>Slot Duration</label>
              <select value={slotDuration} onChange={e => setSlotDuration(Number(e.target.value))}>
                {SLOT_DURATIONS.map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
            <div className="am-setting">
              <label>Buffer Between</label>
              <select value={bufferTime} onChange={e => setBufferTime(Number(e.target.value))}>
                {BUFFER_OPTIONS.map(b => <option key={b} value={b}>{b === 0 ? 'None' : `${b} min`}</option>)}
              </select>
            </div>
            <div className="am-setting">
              <label>Max Advance</label>
              <select value={maxAdvanceDays} onChange={e => setMaxAdvanceDays(Number(e.target.value))}>
                {[7, 14, 30, 60, 90].map(d => <option key={d} value={d}>{d} days</option>)}
              </select>
            </div>
            <div className="am-setting">
              <label>Spots Per Slot</label>
              <select value={maxPerSlot} onChange={e => setMaxPerSlot(Number(e.target.value))}>
                {[1, 2, 3, 5, 10, 15, 20, 25, 30, 50].map(n => (
                  <option key={n} value={n}>{n === 1 ? '1 (Private)' : `${n} (Group)`}</option>
                ))}
              </select>
            </div>
          </div>

          <p className="am-tz">Timezone: {timezone}</p>

          {/* Weekly grid */}
          <div className="am-week-grid">
            {DAYS.map((dayName, dayIdx) => (
              <div key={dayIdx} className="am-day-card">
                <div className="am-day-header">
                  <span className="am-day-name">{dayName}</span>
                  <button className="am-add-window" onClick={() => addWindow(dayIdx)} title="Add time window">+</button>
                </div>
                {windowsByDay[dayIdx].length === 0 ? (
                  <p className="am-day-off">No availability</p>
                ) : (
                  windowsByDay[dayIdx].map(w => (
                    <div key={w._idx} className="am-window-row">
                      <input type="time" value={w.startTime} onChange={e => updateWindow(w._idx, 'startTime', e.target.value)} />
                      <span className="am-to">→</span>
                      <input type="time" value={w.endTime} onChange={e => updateWindow(w._idx, 'endTime', e.target.value)} />
                      <button className="am-rm-window" onClick={() => removeWindow(w._idx)}>✕</button>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>

          <button className="am-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : '💾 Save Availability'}
          </button>
        </>
      )}
    </div>
  );
};

export default AvailabilityManager;
