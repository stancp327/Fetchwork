import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api';
import './TipModal.css';

const TipModal = ({ job, onClose, onSuccess }) => {
  const [amount, setAmount]     = useState('');
  const [methods, setMethods]   = useState([]);
  const [pmId, setPmId]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState(false);

  useEffect(() => {
    apiRequest('/api/payments/methods')
      .then(data => {
        const list = data.methods || [];
        setMethods(list);
        if (list.length) setPmId(list.find(m => m.isDefault)?.id || list[0].id || '');
      })
      .catch(() => {});
  }, []);

  const presets = [5, 10, 25, 50];

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt < 1) return setError('Minimum tip is $1');
    if (amt > 5000)       return setError('Maximum tip is $5,000');
    setLoading(true); setError('');
    try {
      await apiRequest('/api/payments/tip', {
        method: 'POST',
        body: JSON.stringify({
          jobId:           job._id,
          amount:          amt,
          paymentMethodId: pmId || undefined,
        }),
      });
      setSuccess(true);
      setTimeout(() => { onSuccess?.(); onClose(); }, 1800);
    } catch (err) {
      setError(err.data?.error || err.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tip-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="tip-modal">
        <button className="tip-close" onClick={onClose} aria-label="Close">✕</button>

        {success ? (
          <div className="tip-success">
            <span className="tip-success-icon">🎉</span>
            <h3>Tip sent!</h3>
            <p>Your freelancer will be notified.</p>
          </div>
        ) : (
          <>
            <h2 className="tip-title">Send a Tip</h2>
            <p className="tip-sub">
              Show your appreciation for <strong>{job.title}</strong>. Tips are 100% fee-free.
            </p>

            <form onSubmit={handleSubmit}>
              {/* Quick presets */}
              <div className="tip-presets">
                {presets.map(p => (
                  <button
                    key={p}
                    type="button"
                    className={`tip-preset ${parseFloat(amount) === p ? 'active' : ''}`}
                    onClick={() => setAmount(String(p))}
                  >
                    ${p}
                  </button>
                ))}
              </div>

              {/* Custom amount */}
              <div className="tip-field">
                <label htmlFor="tip-amount">Custom amount</label>
                <div className="tip-input-wrap">
                  <span className="tip-prefix">$</span>
                  <input
                    id="tip-amount"
                    type="number"
                    min="1"
                    max="5000"
                    step="1"
                    placeholder="0"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="tip-input"
                  />
                </div>
              </div>

              {/* Payment method */}
              {methods.length > 0 ? (
                <div className="tip-field">
                  <label>Pay with</label>
                  <select
                    value={pmId}
                    onChange={e => setPmId(e.target.value)}
                    className="tip-select"
                  >
                    {methods.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.brand?.toUpperCase()} ····{m.last4}
                        {m.isDefault ? ' (default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="tip-no-pm">
                  No saved cards. <a href="/settings/payments">Add a payment method</a> first.
                </p>
              )}

              {error && <p className="tip-error">{error}</p>}

              <button
                type="submit"
                className="tip-submit"
                disabled={loading || !amount || methods.length === 0}
              >
                {loading ? 'Processing…' : `Send $${parseFloat(amount) || '0'} Tip`}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default TipModal;
