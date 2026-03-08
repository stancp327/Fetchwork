import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import './PresentationView.css';

export default function PresentationView() {
  const { slug } = useParams();
  const [presentation, setPresentation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [responded, setResponded] = useState(false);
  const [responding, setResponding] = useState(false);
  const [clientNote, setClientNote] = useState('');
  const [showDeclineForm, setShowDeclineForm] = useState(false);

  const fetchPresentation = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiRequest(`/api/presentations/view/${slug}`);
      setPresentation(data.presentation);
      if (['accepted', 'declined'].includes(data.presentation?.status)) {
        setResponded(true);
      }
    } catch (err) {
      setError(err.message || 'Presentation not found');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { fetchPresentation(); }, [fetchPresentation]);

  const handleRespond = async (action) => {
    try {
      setResponding(true);
      await apiRequest(`/api/presentations/view/${slug}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action, clientNote: clientNote || undefined }),
      });
      setResponded(true);
      setPresentation(prev => ({ ...prev, status: action }));
    } catch (err) {
      setError(err.message || 'Failed to respond');
    } finally {
      setResponding(false);
    }
  };

  if (loading) {
    return (
      <div className="pv-loading">
        <div className="pv-loading-spinner"></div>
        <p>Loading presentation...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pv-error-page">
        <div className="pv-error-card">
          <h1>Oops</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!presentation) return null;

  const { team } = presentation;
  const isExpired = presentation.validUntil && new Date(presentation.validUntil) < new Date();

  // ── Thank-you state ────────────────────────────────────────────
  if (responded) {
    const accepted = presentation.status === 'accepted';
    return (
      <div className="pv-page">
        <div className="pv-thank-you">
          <div className="pv-thank-you-icon">{accepted ? '✓' : '—'}</div>
          <h1>{accepted ? 'Proposal Accepted!' : 'Proposal Declined'}</h1>
          <p className="pv-thank-you-sub">
            {accepted
              ? `Thank you! ${team?.name || 'The team'} will be in touch shortly to get started.`
              : `Thank you for your response. ${team?.name || 'The team'} has been notified.`
            }
          </p>
        </div>
      </div>
    );
  }

  // ── Full presentation view ─────────────────────────────────────
  return (
    <div className="pv-page">
      {/* Hero header */}
      <header className="pv-hero">
        <div className="pv-hero-inner">
          {team?.logo ? (
            <img src={team.logo} alt={team.name} className="pv-logo" />
          ) : (
            <div className="pv-logo-placeholder">
              {(team?.name || 'T').charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="pv-hero-title">{presentation.title}</h1>
          {presentation.clientName && (
            <p className="pv-hero-subtitle">Prepared for <strong>{presentation.clientName}</strong></p>
          )}
          <div className="pv-hero-meta">
            <span>By {team?.name || 'Our Team'}</span>
            {presentation.validUntil && (
              <span className={isExpired ? 'pv-expired' : ''}>
                {isExpired ? 'Expired' : `Valid until ${new Date(presentation.validUntil).toLocaleDateString()}`}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Sections */}
      <div className="pv-body">
        {presentation.sections?.map((section, i) => (
          <section key={i} className={`pv-section pv-section--${section.type}`}>
            <div className="pv-section-accent"></div>
            <h2 className="pv-section-title">{section.title}</h2>

            {section.content && (
              <div className="pv-section-content">{section.content}</div>
            )}

            {/* Team / Services / Portfolio items */}
            {(section.type === 'team' || section.type === 'services') && Array.isArray(section.items) && section.items.length > 0 && (
              <ul className="pv-item-list">
                {section.items.map((item, j) => (
                  <li key={j} className="pv-item">
                    <span className="pv-item-dot"></span>
                    {typeof item === 'string' ? item : item.name || item.title || JSON.stringify(item)}
                  </li>
                ))}
              </ul>
            )}

            {section.type === 'portfolio' && Array.isArray(section.items) && section.items.length > 0 && (
              <div className="pv-portfolio-grid">
                {section.items.map((item, j) => (
                  <div key={j} className="pv-portfolio-card">
                    <div className="pv-portfolio-card-body">
                      {typeof item === 'string' ? item : item.title || item.name || JSON.stringify(item)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}

        {/* Milestones as timeline */}
        {presentation.proposedMilestones?.length > 0 && (
          <section className="pv-section pv-section--milestones">
            <div className="pv-section-accent"></div>
            <h2 className="pv-section-title">Project Milestones</h2>
            <div className="pv-timeline">
              {presentation.proposedMilestones.map((m, i) => (
                <div key={i} className="pv-timeline-item">
                  <div className="pv-timeline-marker">
                    <span className="pv-timeline-number">{i + 1}</span>
                  </div>
                  <div className="pv-timeline-content">
                    <h3 className="pv-timeline-title">{m.title}</h3>
                    {m.description && <p className="pv-timeline-desc">{m.description}</p>}
                    <div className="pv-timeline-meta">
                      {m.amount != null && m.amount !== '' && (
                        <span className="pv-timeline-amount">${Number(m.amount).toLocaleString()}</span>
                      )}
                      {m.dueDate && (
                        <span className="pv-timeline-date">{new Date(m.dueDate).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Pricing summary card */}
        {presentation.totalAmount != null && presentation.totalAmount !== '' && (
          <div className="pv-pricing-card">
            <div className="pv-pricing-label">Total Investment</div>
            <div className="pv-pricing-amount">${Number(presentation.totalAmount).toLocaleString()}</div>
            {presentation.proposedMilestones?.length > 0 && (
              <div className="pv-pricing-breakdown">
                Across {presentation.proposedMilestones.length} milestone{presentation.proposedMilestones.length > 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}

        {/* CTA */}
        {!isExpired && (
          <div className="pv-cta">
            {!showDeclineForm ? (
              <>
                <button
                  className="pv-cta-accept"
                  onClick={() => handleRespond('accepted')}
                  disabled={responding}
                >
                  {responding ? 'Submitting...' : 'Accept Proposal'}
                </button>
                <button
                  className="pv-cta-decline"
                  onClick={() => setShowDeclineForm(true)}
                  disabled={responding}
                >
                  Decline
                </button>
              </>
            ) : (
              <div className="pv-decline-form">
                <textarea
                  className="pv-decline-note"
                  value={clientNote}
                  onChange={e => setClientNote(e.target.value)}
                  placeholder="Optional: let the team know why (feedback is appreciated)..."
                  rows={3}
                />
                <div className="pv-decline-actions">
                  <button
                    className="pv-cta-decline"
                    onClick={() => handleRespond('declined')}
                    disabled={responding}
                  >
                    {responding ? 'Submitting...' : 'Confirm Decline'}
                  </button>
                  <button
                    className="pv-cta-cancel"
                    onClick={() => { setShowDeclineForm(false); setClientNote(''); }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {isExpired && (
          <div className="pv-expired-banner">
            This proposal has expired. Please contact the team for an updated proposal.
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="pv-footer">
        <p>Powered by <strong>Fetchwork</strong></p>
      </footer>
    </div>
  );
}
