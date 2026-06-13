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

const StepBooking = ({ data, onChange }) => {
  const isClass = data.serviceType === 'class';

  return (
    <div className="wizard-step-content">
      <h2>Booking Settings</h2>
      <p className="wizard-tip">
        ⚙️ Configure how clients book this service — session length, group size, and scheduling rules.
      </p>

      {/* Enable Booking */}
      <div className="wiz-field">
        <label className="wiz-toggle-row">
          <input
            type="checkbox"
            checked={data.bookingEnabled || false}
            onChange={e => onChange('bookingEnabled', e.target.checked)}
          />
          <span>Enable online booking for this service</span>
        </label>
        <p className="wiz-hint">When enabled, clients can book time slots directly from your service page.</p>
      </div>

      {data.bookingEnabled && (
        <>
          {/* Session Duration */}
          <div className="wiz-field">
            <label>Session Duration</label>
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

          {/* Individual vs Group */}
          <div className="wiz-field">
            <label>Session Type</label>
            <div className="svc-location-cards">
              <button
                type="button"
                className={`svc-location-card ${(data.bookingMaxPerSlot || 1) === 1 ? 'selected' : ''}`}
                onClick={() => onChange('bookingMaxPerSlot', 1)}
              >
                <span className="svc-loc-icon">👤</span>
                <div>
                  <div className="svc-loc-label">Individual</div>
                  <div className="svc-loc-desc">1-on-1 private sessions</div>
                </div>
              </button>
              <button
                type="button"
                className={`svc-location-card ${(data.bookingMaxPerSlot || 1) > 1 ? 'selected' : ''}`}
                onClick={() => onChange('bookingMaxPerSlot', data.bookingMaxPerSlot > 1 ? data.bookingMaxPerSlot : 5)}
              >
                <span className="svc-loc-icon">👥</span>
                <div>
                  <div className="svc-loc-label">Group{isClass ? ' / Class' : ''}</div>
                  <div className="svc-loc-desc">Multiple clients per time slot</div>
                </div>
              </button>
            </div>
          </div>

          {/* Group size — only if group selected */}
          {(data.bookingMaxPerSlot || 1) > 1 && (
            <div className="wiz-field">
              <label>Max people per session</label>
              <input
                type="number"
                min={2}
                max={100}
                value={data.bookingMaxPerSlot || 5}
                onChange={e => onChange('bookingMaxPerSlot', Math.max(2, parseInt(e.target.value) || 2))}
              />
              <p className="wiz-hint">Maximum number of clients that can book the same time slot.</p>
            </div>
          )}

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

          {/* Minimum Notice */}
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
    </div>
  );
};

export default StepBooking;
