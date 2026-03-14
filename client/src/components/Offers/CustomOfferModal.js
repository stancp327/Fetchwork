import React, { useState } from 'react';
import { apiRequest } from '../../utils/api';
import './CustomOffer.css';

const CustomOfferModal = ({ 
  isOpen, 
  onClose, 
  recipientId, 
  recipientName,
  jobId, 
  serviceId, 
  proposalId,
  offerType = 'direct_offer',
  prefillTerms = {},
  counterId = null, // if set, this is a counter-offer to an existing offer
  onSuccess 
}) => {
  const [terms, setTerms] = useState({
    amount: prefillTerms.amount || '',
    deliveryTime: prefillTerms.deliveryTime || '',
    deadline: prefillTerms.deadline || '',
    description: prefillTerms.description || '',
    revisions: prefillTerms.revisions || 1,
    currency: prefillTerms.currency || 'USD'
  });
  const [workType, setWorkType] = useState(prefillTerms.workType || 'remote');
  const [scheduledDate, setScheduledDate] = useState(prefillTerms.scheduledDate ? new Date(prefillTerms.scheduledDate).toISOString().split('T')[0] : '');
  const [timePreference, setTimePreference] = useState(prefillTerms.timePreference || 'flexible');
  const [specificTime, setSpecificTime] = useState(prefillTerms.specificTime || '');
  const [flexibleSchedule, setFlexibleSchedule] = useState(!!prefillTerms.flexibleSchedule);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Milestone builder
  const [showMilestones, setShowMilestones] = useState(
    !!(prefillTerms.milestones && prefillTerms.milestones.length > 0)
  );
  const [milestones, setMilestones] = useState(
    prefillTerms.milestones?.length > 0
      ? prefillTerms.milestones
      : [{ title: '', amount: '' }]
  );
  const addMs = () => setMilestones(prev => [...prev, { title: '', amount: '' }]);
  const removeMs = (i) => setMilestones(prev => prev.filter((_, idx) => idx !== i));
  const updateMs = (i, field, val) =>
    setMilestones(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: val } : m));

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!terms.amount || (workType === 'remote' && !terms.deliveryTime) || !terms.description) {
      setError('Amount, delivery time, and description are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const validMilestones = showMilestones
        ? milestones.filter(m => m.title.trim())
        : [];

      const payload = {
        terms: {
          amount: parseFloat(terms.amount),
          deliveryTime: parseInt(terms.deliveryTime),
          deadline: terms.deadline || null,
          description: terms.description,
          revisions: workType === 'local' ? 0 : (parseInt(terms.revisions) || 1),
          currency: terms.currency,
          milestones: validMilestones.length > 0 ? validMilestones : undefined,
          workType,
          scheduledDate: workType === 'local' && scheduledDate ? scheduledDate : null,
          timePreference: workType === 'local' ? timePreference : null,
          specificTime: workType === 'local' && timePreference === 'specific' ? specificTime : null,
          flexibleSchedule: workType === 'local' ? flexibleSchedule : false,
        },
        message
      };

      if (counterId) {
        // Counter an existing offer
        await apiRequest(`/api/offers/${counterId}/counter`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } else {
        // New offer
        await apiRequest('/api/offers', {
          method: 'POST',
          body: JSON.stringify({
            recipientId,
            jobId: jobId || undefined,
            serviceId: serviceId || undefined,
            proposalId: proposalId || undefined,
            offerType,
            ...payload,
          }),
        });
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to send offer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="offer-modal-overlay" onClick={onClose}>
      <div className="offer-modal" onClick={e => e.stopPropagation()}>
        <div className="offer-modal-header">
          <h2>📋 {counterId ? 'Counter Offer' : offerType === 'counter_proposal' || offerType === 'counter_offer' ? 'Counter Offer' : 'Custom Offer'}</h2>
          <button className="offer-modal-close" onClick={onClose}>✕</button>
        </div>

        {recipientName && (
          <p className="offer-recipient">To: <strong>{recipientName}</strong></p>
        )}

        <form onSubmit={handleSubmit} className="offer-form">
          <div className="offer-form-row">
            <div className="offer-field">
              <label>Amount ($) *</label>
              <input
                type="number"
                value={terms.amount}
                onChange={e => setTerms(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="500"
                min="1"
                step="0.01"
                required
              />
            </div>
            {workType === 'remote' && (
              <div className="offer-field">
                <label>Delivery (days) *</label>
                <input type="number" value={terms.deliveryTime} onChange={e => setTerms(prev => ({ ...prev, deliveryTime: e.target.value }))} placeholder="7" min="1" required={workType === 'remote'} />
              </div>
            )}
            {workType === 'remote' && (
              <div className="offer-field">
                <label>Revisions</label>
                <input type="number" value={terms.revisions} onChange={e => setTerms(prev => ({ ...prev, revisions: e.target.value }))} placeholder="1" min="0" />
              </div>
            )}
          </div>

          <div className="offer-field">
            <label>Deadline (optional)</label>
            <input
              type="date"
              value={terms.deadline}
              onChange={e => setTerms(prev => ({ ...prev, deadline: e.target.value }))}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* Work Type */}
          <div className="offer-field">
            <label>Work Type</label>
            <div className="offer-worktype-row">
              <button type="button" className={`offer-worktype-btn ${workType === 'remote' ? 'selected' : ''}`} onClick={() => setWorkType('remote')}>
                💻 Remote
              </button>
              <button type="button" className={`offer-worktype-btn ${workType === 'local' ? 'selected' : ''}`} onClick={() => setWorkType('local')}>
                📍 In-Person / Local
              </button>
            </div>
          </div>

          {workType === 'local' && (
            <div className="offer-field">
              <label>Schedule</label>
              <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
              <div className="offer-time-pref" style={{ marginTop: '0.5rem', display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                {[{v:'morning',l:'🌅 Morning',s:'before noon'},{v:'afternoon',l:'☀️ Afternoon',s:'12–5 PM'},{v:'evening',l:'🌙 Evening',s:'6–11 PM'},{v:'specific',l:'🕐 Specific',s:''},{v:'flexible',l:'🔄 Flexible',s:'any time'}].map(opt => (
                  <button key={opt.v} type="button" className={`offer-time-btn ${timePreference === opt.v ? 'selected' : ''}`} onClick={() => setTimePreference(opt.v)}>
                    {opt.l}{opt.s && <span style={{ fontSize: 10, display: 'block' }}>{opt.s}</span>}
                  </button>
                ))}
              </div>
              {timePreference === 'specific' && <input type="time" value={specificTime} onChange={e => setSpecificTime(e.target.value)} style={{ marginTop: '0.5rem' }} />}
              <label style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                <input type="checkbox" checked={flexibleSchedule} onChange={e => setFlexibleSchedule(e.target.checked)} />
                Flexible on date/time — open to discussion
              </label>
            </div>
          )}

          <div className="offer-field">
            <label>What's included *</label>
            <textarea
              value={terms.description}
              onChange={e => setTerms(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what you're offering or requesting — scope, deliverables, special requirements..."
              rows={4}
              maxLength={3000}
              required
            />
          </div>

          {/* Milestone builder */}
          <div className="offer-field">
            <button
              type="button"
              className="offer-ms-toggle"
              onClick={() => setShowMilestones(v => !v)}
            >
              {showMilestones ? '▾' : '▸'} {showMilestones ? 'Hide milestones' : '+ Propose milestones (optional)'}
            </button>
            {showMilestones && (
              <div className="offer-ms-builder">
                {milestones.map((m, i) => (
                  <div key={i} className="offer-ms-row">
                    <input
                      className="offer-ms-title"
                      placeholder="Milestone title"
                      value={m.title}
                      onChange={e => updateMs(i, 'title', e.target.value)}
                    />
                    <input
                      className="offer-ms-amount"
                      type="number"
                      placeholder="$"
                      min="0"
                      value={m.amount}
                      onChange={e => updateMs(i, 'amount', e.target.value)}
                    />
                    {milestones.length > 1 && (
                      <button type="button" className="offer-ms-remove" onClick={() => removeMs(i)}>✕</button>
                    )}
                  </div>
                ))}
                <button type="button" className="offer-ms-add" onClick={addMs}>+ Add milestone</button>
              </div>
            )}
          </div>

          <div className="offer-field">
            <label>Message (optional)</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Add a personal note..."
              rows={2}
              maxLength={1000}
            />
          </div>

          {error && <div className="offer-error">{error}</div>}

          <div className="offer-actions">
            <button type="button" className="btn-offer-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-offer-send" disabled={loading}>
              {loading ? 'Sending...' : 'Send Offer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomOfferModal;
