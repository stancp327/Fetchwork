import React, { useState } from 'react';
import { apiRequest } from '../../utils/api';
import './FeedbackWidget.css';

const CATEGORIES = [
  { value: 'bug',        label: '🐛 Bug report' },
  { value: 'suggestion', label: '💡 Suggestion' },
  { value: 'praise',     label: '❤️ I love this' },
  { value: 'question',   label: '❓ Question' },
  { value: 'other',      label: '💬 Other' },
];

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('suggestion');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!message.trim() || loading) return;
    setLoading(true);
    try {
      await apiRequest('/api/feedback', {
        method: 'POST',
        body: JSON.stringify({
          category,
          message: message.trim(),
          email: email.trim() || undefined,
          page: window.location.pathname,
        }),
      });
      setDone(true);
      setTimeout(() => {
        setDone(false);
        setOpen(false);
        setMessage('');
        setEmail('');
        setCategory('suggestion');
      }, 3000);
    } catch {
      alert('Failed to send — please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fbw-root">
      {open && (
        <div className="fbw-panel">
          <div className="fbw-header">
            <span>Share your feedback</span>
            <button className="fbw-close" onClick={() => setOpen(false)}>✕</button>
          </div>

          {done ? (
            <div className="fbw-success">
              <div className="fbw-success-icon">🎉</div>
              <p>Thank you! Your feedback helps us build a better Fetchwork.</p>
            </div>
          ) : (
            <form className="fbw-form" onSubmit={submit}>
              <div className="fbw-categories">
                {CATEGORIES.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    className={`fbw-cat-btn ${category === c.value ? 'active' : ''}`}
                    onClick={() => setCategory(c.value)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <textarea
                className="fbw-textarea"
                placeholder="Tell us what's on your mind — bugs, ideas, anything…"
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
                maxLength={2000}
                required
              />

              <input
                type="email"
                className="fbw-email"
                placeholder="Email (optional — so we can follow up)"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />

              <button type="submit" className="fbw-submit-btn" disabled={!message.trim() || loading}>
                {loading ? 'Sending…' : 'Send Feedback'}
              </button>
              <p className="fbw-privacy">We read every message. Usually respond within 24h.</p>
            </form>
          )}
        </div>
      )}

      <button
        className="fbw-trigger"
        onClick={() => setOpen(o => !o)}
        aria-label="Give feedback"
        title="Share feedback"
      >
        {open ? '✕' : '💬 Feedback'}
      </button>
    </div>
  );
}
