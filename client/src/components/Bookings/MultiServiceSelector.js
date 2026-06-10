import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import './MultiServiceSelector.css';

function fmtDuration(minutes) {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getServicePrice(service) {
  const p = service.pricing;
  if (!p) return 0;
  return Number(p.basic?.price || p.amount || 0);
}

const MultiServiceSelector = ({ services, freelancerId, username, onClose }) => {
  const navigate = useNavigate();

  const [selected,     setSelected]     = useState({});
  const [date,         setDate]         = useState('');
  const [startTime,    setStartTime]    = useState('');
  const [notes,        setNotes]        = useState('');
  const [step,         setStep]         = useState(1); // 1=select services, 2=pick time
  const [booking,      setBooking]      = useState(false);
  const [error,        setError]        = useState('');

  const selectedList = services.filter(s => selected[s._id]);
  const totalPrice   = selectedList.reduce((s, svc) => s + getServicePrice(svc), 0);
  // Duration: each service uses a default 60 min if not known from metadata
  const estimatedDuration = selectedList.length * 60;

  const toggleService = (id) => {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const canProceed = selectedList.length >= 2;

  const today = new Date().toISOString().split('T')[0];

  const handleBook = async () => {
    if (!date || !startTime) { setError('Please select a date and start time'); return; }
    setBooking(true);
    setError('');
    try {
      const data = await apiRequest('/api/bookings/multi', {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          freelancerId,
          serviceIds: selectedList.map(s => s._id),
          date,
          startTime,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          notes,
        }),
      });
      navigate(`/bookings/multi/${data.multiBooking.id}`);
    } catch (err) {
      setError(err.message || 'Booking failed. Please try again.');
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className="mss-overlay" onClick={onClose}>
      <div className="mss-modal" onClick={e => e.stopPropagation()}>
        <div className="mss-header">
          <h2 className="mss-title">Book Multiple Services</h2>
          <button className="mss-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {step === 1 && (
          <>
            <p className="mss-sub">Select 2 or more services to book in one session. They will be scheduled back-to-back.</p>

            <div className="mss-services">
              {services.map(svc => {
                const price = getServicePrice(svc);
                const isSelected = !!selected[svc._id];
                return (
                  <label key={svc._id} className={`mss-service-item ${isSelected ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleService(svc._id)}
                      className="mss-checkbox"
                    />
                    <div className="mss-service-info">
                      <span className="mss-service-name">{svc.title}</span>
                      {svc.description && <span className="mss-service-desc">{svc.description}</span>}
                    </div>
                    {price > 0 && (
                      <span className="mss-service-price">${price}</span>
                    )}
                  </label>
                );
              })}
            </div>

            {canProceed && (
              <div className="mss-summary">
                <div className="mss-summary-row">
                  <span>Services selected:</span>
                  <strong>{selectedList.length}</strong>
                </div>
                <div className="mss-summary-row">
                  <span>Est. duration:</span>
                  <strong>{fmtDuration(estimatedDuration)}</strong>
                </div>
                {totalPrice > 0 && (
                  <div className="mss-summary-row">
                    <span>Total price:</span>
                    <strong>${totalPrice.toFixed(2)}</strong>
                  </div>
                )}
              </div>
            )}

            <div className="mss-actions">
              <button className="mss-btn-secondary" onClick={onClose}>Cancel</button>
              <button
                className="mss-btn-primary"
                disabled={!canProceed}
                onClick={() => setStep(2)}
              >
                Choose Date & Time →
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p className="mss-sub">
              Services: {selectedList.map(s => s.title).join(' → ')}
            </p>

            {error && <div className="mss-error">{error}</div>}

            <div className="mss-time-fields">
              <label className="mss-label">
                Date
                <input
                  type="date"
                  className="mss-input"
                  min={today}
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  required
                />
              </label>
              <label className="mss-label">
                Start Time
                <input
                  type="time"
                  className="mss-input"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  required
                />
              </label>
            </div>

            <label className="mss-label">
              Notes (optional)
              <textarea
                className="mss-input mss-textarea"
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Anything you'd like the freelancer to know"
              />
            </label>

            <div className="mss-actions">
              <button className="mss-btn-secondary" onClick={() => setStep(1)}>← Back</button>
              <button
                className="mss-btn-primary"
                disabled={booking || !date || !startTime}
                onClick={handleBook}
              >
                {booking ? 'Booking…' : 'Book All Services'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MultiServiceSelector;
