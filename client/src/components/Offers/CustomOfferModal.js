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
    if (!terms.amount || !terms.deliveryTime || !terms.description) {
      setError('Amount, delivery time, and description are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const validMilestones = showMilestones
        ? milestones.filter(m => m.title.trim())
        : [];

      await apiRequest('/api/offers', {
        method: 'POST',
        body: JSON.stringify({
          recipientId,
          jobId: jobId || undefined,
          serviceId: serviceId || undefined,
          proposalId: proposalId || undefined,
          offerType,
          terms: {
            amount: parseFloat(terms.amount),
            deliveryTime: parseInt(terms.deliveryTime),
            deadline: terms.deadline || null,
            description: terms.description,
            revisions: parseInt(terms.revisions) || 1,
            currency: terms.currency,
            milestones: validMilestones.length > 0 ? validMilestones : undefined
          },
          message
        })
      });
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
          <h2>📋 {offerType === 'counter_proposal' || offerType === 'counter_offer' ? 'Counter Offer' : 'Custom Offer'}</h2>
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
            <div className="offer-field">
              <label>Delivery (days) *</label>
              <input
                type="number"
                value={terms.deliveryTime}
                onChange={e => setTerms(prev => ({ ...prev, deliveryTime: e.target.value }))}
                placeholder="7"
                min="1"
                required
              />
            </div>
            <div className="offer-field">
              <label>Revisions</label>
              <input
                type="number"
                value={terms.revisions}
                onChange={e => setTerms(prev => ({ ...prev, revisions: e.target.value }))}
                placeholder="1"
                min="0"
              />
            </div>
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
