import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api';
import './BufferTimeSettings.css';

const BUFFER_OPTIONS = [0, 5, 10, 15, 30, 60];

export default function BufferTimeSettings({ freelancerId, serviceId, onSaved }) {
  const [bufferBefore, setBufferBefore] = useState(0);
  const [bufferAfter,  setBufferAfter]  = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [message,  setMessage]  = useState(null);

  useEffect(() => {
    if (!freelancerId) return;
    apiRequest(`/api/availability/buffer/${freelancerId}`)
      .then(data => {
        setBufferBefore(data.bufferBeforeMinutes ?? 0);
        setBufferAfter(data.bufferAfterMinutes   ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [freelancerId]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await apiRequest('/api/availability/buffer', {
        method: 'PUT',
        body:   JSON.stringify({
          bufferBeforeMinutes: bufferBefore,
          bufferAfterMinutes:  bufferAfter,
          ...(serviceId && { serviceId }),
        }),
      });
      setMessage({ type: 'success', text: 'Buffer time saved.' });
      onSaved?.({ bufferBeforeMinutes: bufferBefore, bufferAfterMinutes: bufferAfter });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to save buffer time.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="buffer-loading">Loading buffer settings…</div>;

  return (
    <div className="buffer-settings">
      <h3 className="buffer-title">Buffer Time Between Appointments</h3>
      <p className="buffer-description">
        Buffer time blocks your calendar before and after each booking to give you prep and wrap-up time.
        Clients cannot book during these windows.
      </p>

      {message && (
        <div className={`buffer-message buffer-message--${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="buffer-row">
        <label className="buffer-label" htmlFor="buffer-before">
          Break before appointments
        </label>
        <select
          id="buffer-before"
          className="buffer-select"
          value={bufferBefore}
          onChange={e => setBufferBefore(Number(e.target.value))}
        >
          {BUFFER_OPTIONS.map(v => (
            <option key={v} value={v}>{v === 0 ? 'None' : `${v} minutes`}</option>
          ))}
        </select>
      </div>

      <div className="buffer-row">
        <label className="buffer-label" htmlFor="buffer-after">
          Break after appointments
        </label>
        <select
          id="buffer-after"
          className="buffer-select"
          value={bufferAfter}
          onChange={e => setBufferAfter(Number(e.target.value))}
        >
          {BUFFER_OPTIONS.map(v => (
            <option key={v} value={v}>{v === 0 ? 'None' : `${v} minutes`}</option>
          ))}
        </select>
      </div>

      {(bufferBefore > 0 || bufferAfter > 0) && (
        <p className="buffer-preview">
          Total gap between bookings: <strong>{bufferBefore + bufferAfter} minutes</strong>
          {bufferBefore > 0 && bufferAfter > 0
            ? ` (${bufferBefore} min before + ${bufferAfter} min after)`
            : bufferBefore > 0
              ? ` (${bufferBefore} min before)`
              : ` (${bufferAfter} min after)`}
        </p>
      )}

      <button
        className="buffer-save-btn"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? 'Saving…' : 'Save Buffer Time'}
      </button>

      {serviceId && (
        <p className="buffer-scope-note">
          This setting applies to this service only and overrides your global default.
        </p>
      )}
    </div>
  );
}
