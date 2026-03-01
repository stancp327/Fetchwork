import React, { useState } from 'react';
import { apiRequest } from '../../utils/api';
import './SaveSearchModal.css';

const SaveSearchModal = ({ currentFilters = {}, onClose, onSaved }) => {
  const [name,      setName]      = useState('');
  const [frequency, setFrequency] = useState('instant');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [saved,     setSaved]     = useState(false);

  // Build a human-readable summary of active filters
  const filterSummary = [
    currentFilters.category && `Category: ${currentFilters.category}`,
    currentFilters.keywords && `"${currentFilters.keywords}"`,
    (currentFilters.budgetMin || currentFilters.budgetMax) &&
      `Budget: $${currentFilters.budgetMin || 0}–$${currentFilters.budgetMax || '∞'}`,
    currentFilters.location && `📍 ${currentFilters.location}`,
  ].filter(Boolean);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError('Give this alert a name');
    setLoading(true); setError('');
    try {
      await apiRequest('/api/job-alerts', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          filters: currentFilters,
          frequency,
        }),
      });
      setSaved(true);
      setTimeout(() => { onSaved?.(); onClose(); }, 1500);
    } catch (err) {
      setError(err.data?.error || err.message || 'Failed to save alert');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ss-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ss-modal">
        <button className="ss-close" onClick={onClose} aria-label="Close">✕</button>

        {saved ? (
          <div className="ss-success">
            <span>🔔</span>
            <h3>Alert saved!</h3>
            <p>You'll be notified when matching jobs are posted.</p>
          </div>
        ) : (
          <>
            <h2 className="ss-title">Save Job Alert</h2>
            {filterSummary.length > 0 ? (
              <div className="ss-filters">
                <p className="ss-filters-label">Matching:</p>
                <ul className="ss-filter-list">
                  {filterSummary.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
            ) : (
              <p className="ss-no-filters">No filters active — this alert will match all new jobs.</p>
            )}

            <form onSubmit={handleSave}>
              <div className="ss-field">
                <label htmlFor="ss-name">Alert name</label>
                <input
                  id="ss-name"
                  type="text"
                  placeholder="e.g. React dev jobs under $5k"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="ss-input"
                  maxLength={100}
                />
              </div>

              <div className="ss-field">
                <label>Notify me</label>
                <div className="ss-frequency">
                  {[
                    { value: 'instant', label: '⚡ Instantly' },
                    { value: 'daily',   label: '📅 Daily digest' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`ss-freq-btn ${frequency === opt.value ? 'active' : ''}`}
                      onClick={() => setFrequency(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="ss-error">{error}</p>}

              <button type="submit" className="ss-submit" disabled={loading}>
                {loading ? 'Saving…' : '🔔 Save Alert'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default SaveSearchModal;
