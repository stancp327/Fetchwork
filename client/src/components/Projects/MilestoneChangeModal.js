import React, { useState } from 'react';
import { apiRequest } from '../../utils/api';

const MilestoneChangeModal = ({ job, onClose, onSent }) => {
  const existing = (job.milestones || [])
    .filter(m => m.status !== 'completed' && m.status !== 'approved' && !(m.escrowAmount > 0))
    .map(m => ({
      title:       m.title || '',
      description: m.description || '',
      amount:      m.amount || '',
      dueDate:     m.dueDate ? new Date(m.dueDate).toISOString().substring(0, 10) : '',
    }));

  const lockedCount = (job.milestones || []).filter(
    m => m.status === 'completed' || m.status === 'approved' || m.escrowAmount > 0
  ).length;

  const [milestones, setMilestones] = useState(
    existing.length > 0 ? existing : [{ title: '', description: '', amount: '', dueDate: '' }]
  );
  const [note,    setNote]    = useState('');
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState('');

  const updateMs = (i, field, value) => {
    setMilestones(ms => ms.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
  };

  const addMs = () => setMilestones(ms => [...ms, { title: '', description: '', amount: '', dueDate: '' }]);
  const removeMs = (i) => setMilestones(ms => ms.filter((_, idx) => idx !== i));

  const total = milestones.reduce((s, m) => s + (parseFloat(m.amount) || 0), 0);

  const submit = async () => {
    const valid = milestones.filter(m => m.title.trim() && parseFloat(m.amount) > 0);
    if (valid.length === 0) { setError('Add at least one milestone with a title and amount.'); return; }
    setSending(true);
    setError('');
    try {
      await apiRequest(`/api/jobs/${job._id}/milestones/request`, {
        method: 'POST',
        body: JSON.stringify({
          proposedMilestones: valid.map(m => ({
            title:       m.title.trim(),
            description: m.description.trim(),
            amount:      parseFloat(m.amount),
            dueDate:     m.dueDate || undefined,
          })),
          note: note.trim(),
        }),
      });
      if (onSent) onSent();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to send milestone proposal');
    } finally { setSending(false); }
  };

  return (
    <div className="pm-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="pm-modal">
        <div className="pm-modal-header">
          <h3>Propose Milestone Changes</h3>
          <button className="pm-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="pm-modal-body">
          <p className="pm-modal-hint">
            The freelancer will receive this proposal in Messages and can accept or decline.
            {lockedCount > 0
              ? ` ${lockedCount} milestone${lockedCount !== 1 ? 's' : ''} already funded or completed — those are locked and will be kept.`
              : ' Proposing new milestones replaces any pending ones.'}
          </p>

          <div className="pm-ms-editor">
            {milestones.map((m, i) => (
              <div key={i} className="pm-ms-editor-row">
                <div className="pm-ms-editor-num">#{i + 1}</div>
                <div className="pm-ms-editor-fields">
                  <input
                    type="text"
                    placeholder="Milestone title"
                    value={m.title}
                    onChange={e => updateMs(i, 'title', e.target.value)}
                    className="pm-ms-input"
                  />
                  <div className="pm-ms-editor-row2">
                    <input
                      type="number"
                      placeholder="Amount ($)"
                      value={m.amount}
                      min="1"
                      onChange={e => updateMs(i, 'amount', e.target.value)}
                      className="pm-ms-input pm-ms-amount-input"
                    />
                    <input
                      type="date"
                      value={m.dueDate}
                      onChange={e => updateMs(i, 'dueDate', e.target.value)}
                      className="pm-ms-input pm-ms-date-input"
                    />
                    {milestones.length > 1 && (
                      <button className="pm-ms-remove" onClick={() => removeMs(i)} title="Remove">✕</button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={m.description}
                    onChange={e => updateMs(i, 'description', e.target.value)}
                    className="pm-ms-input pm-ms-desc-input"
                  />
                </div>
              </div>
            ))}

            <button className="pm-ms-add-btn" onClick={addMs}>+ Add Milestone</button>

            {total > 0 && (
              <div className="pm-ms-total-row">
                <span>Total</span>
                <strong>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total)}
                </strong>
              </div>
            )}
          </div>

          <div className="pm-ms-note-section">
            <label className="pm-ms-note-label">Note to freelancer (optional)</label>
            <textarea
              rows={2}
              placeholder="Explain why you're proposing these changes…"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="pm-ms-note-input"
            />
          </div>

          {error && <div className="pm-modal-error">{error}</div>}
        </div>

        <div className="pm-modal-footer">
          <button className="pm-modal-cancel" onClick={onClose}>Cancel</button>
          <button className="pm-modal-submit" disabled={sending} onClick={submit}>
            {sending ? 'Sending…' : 'Send Proposal →'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MilestoneChangeModal;
