import React from 'react';
import { SESSION_DURATIONS } from './constants';

const BUFFER_OPTIONS = [
  { value: 0,  label: 'None' },
  { value: 5,  label: '5 minutes' },
  { value: 10, label: '10 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
];

const DAYS_OF_WEEK = [
  { value: 'Mon', label: 'Mon' },
  { value: 'Tue', label: 'Tue' },
  { value: 'Wed', label: 'Wed' },
  { value: 'Thu', label: 'Thu' },
  { value: 'Fri', label: 'Fri' },
  { value: 'Sat', label: 'Sat' },
  { value: 'Sun', label: 'Sun' },
];

const SCHEDULE_LABELS = {
  DYNAMIC_PRIVATE: { title: 'Session Settings', tip: '📅 Configure your bookable time slots.' },
  FIXED_RECURRING: { title: 'Recurring Schedule', tip: '🔁 Set the days, time, and repeat pattern.' },
  FIXED_ONE_TIME:  { title: 'Event Details', tip: '📌 Set the date, time, and capacity for your event.' },
  REQUEST_BASED:   { title: 'Request Settings', tip: '💬 No calendar needed — clients will reach out directly.' },
};

const StepBooking = ({ data, onChange }) => {
  const scheduleType = data.scheduleType || '';
  const capacityType = data.capacityType || 'ONE_ON_ONE';

  const handleDayToggle = (day) => {
    const current = data.fixedDays || [];
    const updated = current.includes(day)
      ? current.filter(d => d !== day)
      : [...current, day];
    onChange('fixedDays', updated);
  };

  const handleCapacityType = (type) => {
    onChange('capacityType', type);
    if (type === 'ONE_ON_ONE') {
      onChange('maxCapacity', 1);
      onChange('bookingMaxPerSlot', 1);
    } else {
      if ((data.maxCapacity || 1) <= 1) onChange('maxCapacity', 5);
      onChange('bookingMaxPerSlot', data.maxCapacity > 1 ? data.maxCapacity : 5);
    }
  };

  const label = SCHEDULE_LABELS[scheduleType];

  // Deliverable — no booking controls needed
  if (!scheduleType) {
    return (
      <div className="wizard-step-content">
        <h2>Booking & Scheduling</h2>
        <div className="sb-request-info">
          <span className="sb-request-icon">📦</span>
          <div>
            <strong>No scheduling needed</strong>
            <p>For deliverable services, clients order directly from your service listing.
               You can set up availability later from your dashboard if you want to offer bookable slots.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wizard-step-content">
      <h2>{label?.title || 'Booking & Scheduling'}</h2>
      <p className="wizard-tip">{label?.tip || ''}</p>

      {/* ── DYNAMIC_PRIVATE: slot-based booking settings ── */}
      {scheduleType === 'DYNAMIC_PRIVATE' && (
        <>
          {/* Capacity Type */}
          <div className="wiz-field">
            <label>Session Type</label>
            <div className="svc-location-cards">
              <button
                type="button"
                className={`svc-location-card ${capacityType === 'ONE_ON_ONE' ? 'selected' : ''}`}
                onClick={() => handleCapacityType('ONE_ON_ONE')}
              >
                <span className="svc-loc-icon">👤</span>
                <div>
                  <div className="svc-loc-label">Individual</div>
                  <div className="svc-loc-desc">1-on-1 private sessions</div>
                </div>
              </button>
              <button
                type="button"
                className={`svc-location-card ${capacityType === 'GROUP' ? 'selected' : ''}`}
                onClick={() => handleCapacityType('GROUP')}
              >
                <span className="svc-loc-icon">👥</span>
                <div>
                  <div className="svc-loc-label">Group</div>
                  <div className="svc-loc-desc">Multiple clients per time slot</div>
                </div>
              </button>
            </div>
            <p className="wiz-hint">Use Group only if multiple clients can book the same time slot.</p>
          </div>

          {capacityType === 'GROUP' && (
            <div className="wiz-field">
              <label>Max people per session</label>
              <input
                type="number"
                min={2}
                max={100}
                value={data.maxCapacity || 5}
                onChange={e => {
                  const v = Math.max(2, parseInt(e.target.value) || 2);
                  onChange('maxCapacity', v);
                  onChange('bookingMaxPerSlot', v);
                }}
              />
              <p className="wiz-hint">Maximum number of clients that can book the same time slot.</p>
            </div>
          )}

          {/* Session Duration */}
          <div className="wiz-field">
            <label>Session Duration *</label>
            <select
              value={data.bookingSlotDuration || 60}
              onChange={e => onChange('bookingSlotDuration', parseInt(e.target.value))}
              className="wiz-select"
            >
              {SESSION_DURATIONS.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
            <p className="wiz-hint">How long each booking session lasts.</p>
          </div>

          {/* Buffer Between Sessions */}
          <div className="wiz-field">
            <label>Buffer Between Sessions</label>
            <select
              value={data.bookingBuffer || 0}
              onChange={e => onChange('bookingBuffer', parseInt(e.target.value))}
              className="wiz-select"
            >
              {BUFFER_OPTIONS.map(b => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
            <p className="wiz-hint">Break time between back-to-back bookings.</p>
          </div>

          {/* Notice & Advance */}
          <div className="wiz-row">
            <div className="wiz-field">
              <label>Minimum Notice (hours)</label>
              <input
                type="number"
                min={0}
                max={168}
                value={data.bookingMinNotice ?? 1}
                onChange={e => onChange('bookingMinNotice', Math.max(0, parseInt(e.target.value) || 0))}
              />
              <p className="wiz-hint">How far in advance clients must book.</p>
            </div>
            <div className="wiz-field">
              <label>Book Up To (days in advance)</label>
              <input
                type="number"
                min={1}
                max={365}
                value={data.bookingMaxAdvance ?? 60}
                onChange={e => onChange('bookingMaxAdvance', Math.max(1, parseInt(e.target.value) || 30))}
              />
              <p className="wiz-hint">Max days ahead a client can schedule.</p>
            </div>
          </div>
        </>
      )}

      {/* ── FIXED_RECURRING: schedule builder ──────────────────── */}
      {scheduleType === 'FIXED_RECURRING' && (
        <>
          {/* Days of Week */}
          <div className="wiz-field">
            <label>Which days does this repeat? *</label>
            <div className="sb-day-picker">
              {DAYS_OF_WEEK.map(d => (
                <button
                  key={d.value}
                  type="button"
                  className={`sb-day-btn ${(data.fixedDays || []).includes(d.value) ? 'selected' : ''}`}
                  onClick={() => handleDayToggle(d.value)}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="wiz-hint">Select all days this session occurs each week.</p>
          </div>

          {/* Time + Duration */}
          <div className="wiz-row">
            <div className="wiz-field">
              <label>Start Time *</label>
              <input
                type="time"
                value={data.fixedStartTime || ''}
                onChange={e => onChange('fixedStartTime', e.target.value)}
              />
            </div>
            <div className="wiz-field">
              <label>Duration</label>
              <select
                value={data.fixedDuration || 60}
                onChange={e => onChange('fixedDuration', parseInt(e.target.value))}
                className="wiz-select"
              >
                {SESSION_DURATIONS.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Capacity */}
          <div className="wiz-field">
            <label>Session Type</label>
            <div className="svc-location-cards">
              <button
                type="button"
                className={`svc-location-card ${capacityType === 'ONE_ON_ONE' ? 'selected' : ''}`}
                onClick={() => handleCapacityType('ONE_ON_ONE')}
              >
                <span className="svc-loc-icon">👤</span>
                <div>
                  <div className="svc-loc-label">Private (1-on-1)</div>
                  <div className="svc-loc-desc">One client per session</div>
                </div>
              </button>
              <button
                type="button"
                className={`svc-location-card ${capacityType === 'GROUP' ? 'selected' : ''}`}
                onClick={() => handleCapacityType('GROUP')}
              >
                <span className="svc-loc-icon">👥</span>
                <div>
                  <div className="svc-loc-label">Group / Class</div>
                  <div className="svc-loc-desc">Multiple participants per session</div>
                </div>
              </button>
            </div>
          </div>

          {capacityType === 'GROUP' && (
            <div className="wiz-field">
              <label>Seats available per class</label>
              <input
                type="number"
                min={2}
                max={200}
                value={data.maxCapacity || 10}
                onChange={e => onChange('maxCapacity', Math.max(2, parseInt(e.target.value) || 2))}
              />
              <p className="wiz-hint">Seats available per class/session. Each generated session gets its own capacity — filling one doesn't affect others.</p>
            </div>
          )}

          {/* Generation window */}
          <div className="wiz-field">
            <label>Generate schedule for</label>
            <select
              value={data.fixedGenerationWeeks || 8}
              onChange={e => onChange('fixedGenerationWeeks', parseInt(e.target.value))}
              className="wiz-select"
            >
              <option value={4}>4 weeks ahead</option>
              <option value={8}>8 weeks ahead</option>
              <option value={12}>12 weeks ahead</option>
            </select>
            <p className="wiz-hint">Sessions will be automatically created this far in advance.</p>
          </div>
        </>
      )}

      {/* ── FIXED_ONE_TIME: single event builder ───────────────── */}
      {scheduleType === 'FIXED_ONE_TIME' && (
        <>
          <div className="wiz-row">
            <div className="wiz-field">
              <label>Event Date *</label>
              <input
                type="date"
                value={data.fixedEventDate || ''}
                onChange={e => onChange('fixedEventDate', e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="wiz-field">
              <label>Start Time *</label>
              <input
                type="time"
                value={data.fixedStartTime || ''}
                onChange={e => onChange('fixedStartTime', e.target.value)}
              />
            </div>
          </div>

          <div className="wiz-field">
            <label>Duration</label>
            <select
              value={data.fixedDuration || 60}
              onChange={e => onChange('fixedDuration', parseInt(e.target.value))}
              className="wiz-select"
            >
              {SESSION_DURATIONS.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          {/* Capacity */}
          <div className="wiz-field">
            <label>Session Type</label>
            <div className="svc-location-cards">
              <button
                type="button"
                className={`svc-location-card ${capacityType === 'ONE_ON_ONE' ? 'selected' : ''}`}
                onClick={() => handleCapacityType('ONE_ON_ONE')}
              >
                <span className="svc-loc-icon">👤</span>
                <div>
                  <div className="svc-loc-label">Private (1-on-1)</div>
                  <div className="svc-loc-desc">One client</div>
                </div>
              </button>
              <button
                type="button"
                className={`svc-location-card ${capacityType === 'GROUP' ? 'selected' : ''}`}
                onClick={() => handleCapacityType('GROUP')}
              >
                <span className="svc-loc-icon">👥</span>
                <div>
                  <div className="svc-loc-label">Group / Workshop</div>
                  <div className="svc-loc-desc">Multiple attendees</div>
                </div>
              </button>
            </div>
          </div>

          {capacityType === 'GROUP' && (
            <div className="wiz-field">
              <label>Tickets / seats available</label>
              <input
                type="number"
                min={2}
                max={500}
                value={data.maxCapacity || 20}
                onChange={e => onChange('maxCapacity', Math.max(2, parseInt(e.target.value) || 2))}
              />
              <p className="wiz-hint">Total tickets or seats available for this event. Once sold out, the event shows as full.</p>
            </div>
          )}
        </>
      )}

      {/* ── REQUEST_BASED: info only ───────────────────────────── */}
      {scheduleType === 'REQUEST_BASED' && (
        <div className="wiz-field">
          <div className="sb-request-info">
            <span className="sb-request-icon">💬</span>
            <div>
              <strong>No calendar needed</strong>
              <p>Clients will message you to discuss details, pricing, and scheduling.
                 You can send them a custom quote or proposal after discussing their needs.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StepBooking;
