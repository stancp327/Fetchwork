import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';
import CustomOfferModal from './CustomOfferModal';
import SEO from '../common/SEO';
import './OfferDetail.css';

/* ── Helpers ─────────────────────────────────────────────────── */
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function timeAgo(d) {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const STATUS_META = {
  pending:   { label: 'Pending',   cls: 'warning',   icon: '⏳' },
  countered: { label: 'Countered', cls: 'primary',   icon: '↩'  },
  accepted:  { label: 'Accepted',  cls: 'success',   icon: '✅' },
  declined:  { label: 'Declined',  cls: 'danger',    icon: '✕'  },
  withdrawn: { label: 'Withdrawn', cls: 'muted',     icon: '🚫' },
  expired:   { label: 'Expired',   cls: 'muted',     icon: '⏰' },
};

const OFFER_TYPE_LABELS = {
  custom_order:     'Custom Order',
  counter_proposal: 'Counter Proposal',
  counter_offer:    'Counter Offer',
  direct_offer:     'Direct Offer',
};

const ACTION_LABELS = {
  created:   'Created offer',
  countered: 'Countered',
  accepted:  'Accepted',
  declined:  'Declined',
  withdrawn: 'Withdrawn',
};

/* ── OfferDetail ─────────────────────────────────────────────── */
const OfferDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [offer, setOffer]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [acting, setActing]     = useState(false);
  const [showCounter, setShowCounter] = useState(false);

  const fetchOffer = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiRequest(`/api/offers/${id}`);
      setOffer(data.offer);
    } catch (err) {
      setError(err.message || 'Failed to load offer');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchOffer(); }, [fetchOffer]);

  const handleAction = async (action) => {
    if (acting) return;
    const confirmMsg = action === 'accept'
      ? 'Accept this offer? This will finalize the terms.'
      : action === 'decline'
        ? 'Decline this offer?'
        : 'Withdraw this offer?';
    if (!window.confirm(confirmMsg)) return;

    try {
      setActing(true);
      await apiRequest(`/api/offers/${id}/${action}`, { method: 'POST' });
      fetchOffer();
    } catch (err) {
      alert(err.message || `Failed to ${action} offer`);
    } finally {
      setActing(false);
    }
  };

  /* ── Loading / Error ──────────────────────────────────────── */
  if (loading) {
    return (
      <div className="offer-detail-container">
        <div className="offer-detail-loading">Loading offer…</div>
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="offer-detail-container">
        <div className="offer-detail-error">
          <p>{error || 'Offer not found'}</p>
          <button className="btn-offer-back" onClick={() => navigate('/offers')}>
            ← Back to Offers
          </button>
        </div>
      </div>
    );
  }

  /* ── Derived state ────────────────────────────────────────── */
  const isSender = offer.sender?._id === user?._id;
  const otherParty = isSender ? offer.recipient : offer.sender;
  const isMyTurn = offer.awaitingResponseFrom === user?._id;
  const canAct = isMyTurn && ['pending', 'countered'].includes(offer.status);
  const canWithdraw = isSender && ['pending', 'countered'].includes(offer.status) && !isMyTurn;
  const statusMeta = STATUS_META[offer.status] || { label: offer.status, cls: 'muted', icon: '•' };
  const isExpiringSoon = offer.expiresAt && ['pending', 'countered'].includes(offer.status)
    && (new Date(offer.expiresAt) - Date.now()) < 48 * 60 * 60 * 1000;

  return (
    <div className="offer-detail-container">
      <SEO title={`Offer — ${otherParty?.firstName || 'Details'}`} path={`/offers/${id}`} noIndex />

      {/* ── Breadcrumb ──────────────────────────────────────── */}
      <nav className="offer-detail-breadcrumb">
        <Link to="/offers">← My Offers</Link>
        <span className="offer-detail-sep">/</span>
        <span>Offer Details</span>
      </nav>

      {/* ── Status Banner ───────────────────────────────────── */}
      <div className={`offer-detail-banner offer-detail-banner--${statusMeta.cls}`}>
        <span className="offer-detail-banner-icon">{statusMeta.icon}</span>
        <div className="offer-detail-banner-text">
          <strong>{statusMeta.label}</strong>
          {isMyTurn && <span className="offer-detail-your-turn">Your turn to respond</span>}
          {canWithdraw && <span className="offer-detail-waiting">Waiting for {otherParty?.firstName}</span>}
          {isExpiringSoon && (
            <span className="offer-detail-expiring">
              ⏰ Expires {fmtDate(offer.expiresAt)}
            </span>
          )}
        </div>
      </div>

      {/* ── Main Content Grid ───────────────────────────────── */}
      <div className="offer-detail-grid">

        {/* ── Left: Terms ────────────────────────────────────── */}
        <div className="offer-detail-main">

          {/* Parties */}
          <section className="offer-detail-section">
            <h2>Parties</h2>
            <div className="offer-detail-parties">
              <div className="offer-detail-party">
                <img
                  src={offer.sender?.profilePicture || '/default-avatar.png'}
                  alt=""
                  className="offer-detail-avatar"
                />
                <div>
                  <Link to={`/profile/${offer.sender?._id}`} className="offer-detail-name">
                    {offer.sender?.firstName} {offer.sender?.lastName}
                  </Link>
                  <div className="offer-detail-role">{isSender ? 'You (Sender)' : 'Sender'}</div>
                  {offer.sender?.rating != null && (
                    <div className="offer-detail-rating">⭐ {offer.sender.rating.toFixed(1)}</div>
                  )}
                </div>
              </div>

              <div className="offer-detail-arrow">→</div>

              <div className="offer-detail-party">
                <img
                  src={offer.recipient?.profilePicture || '/default-avatar.png'}
                  alt=""
                  className="offer-detail-avatar"
                />
                <div>
                  <Link to={`/profile/${offer.recipient?._id}`} className="offer-detail-name">
                    {offer.recipient?.firstName} {offer.recipient?.lastName}
                  </Link>
                  <div className="offer-detail-role">{!isSender ? 'You (Recipient)' : 'Recipient'}</div>
                  {offer.recipient?.rating != null && (
                    <div className="offer-detail-rating">⭐ {offer.recipient.rating.toFixed(1)}</div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Current Terms */}
          <section className="offer-detail-section">
            <h2>Current Terms</h2>
            <div className="offer-detail-terms-grid">
              <div className="offer-detail-term-card">
                <div className="offer-detail-term-label">Amount</div>
                <div className="offer-detail-term-value">${offer.terms?.amount?.toLocaleString()}</div>
                <div className="offer-detail-term-sub">{offer.terms?.currency || 'USD'}</div>
              </div>
              <div className="offer-detail-term-card">
                <div className="offer-detail-term-label">Delivery</div>
                <div className="offer-detail-term-value">{offer.terms?.deliveryTime}</div>
                <div className="offer-detail-term-sub">day{offer.terms?.deliveryTime !== 1 ? 's' : ''}</div>
              </div>
              <div className="offer-detail-term-card">
                <div className="offer-detail-term-label">Revisions</div>
                <div className="offer-detail-term-value">{offer.terms?.revisions ?? 1}</div>
                <div className="offer-detail-term-sub">included</div>
              </div>
              {offer.terms?.deadline && (
                <div className="offer-detail-term-card">
                  <div className="offer-detail-term-label">Deadline</div>
                  <div className="offer-detail-term-value">{fmtDate(offer.terms.deadline)}</div>
                </div>
              )}
            </div>

            {offer.terms?.workType === 'local' && (
              <div className="offer-detail-local-info">
                <span className="offer-detail-local-badge">📍 Local / In-Person</span>
                {offer.terms?.scheduledDate && (
                  <span>Scheduled: {fmtDate(offer.terms.scheduledDate)}</span>
                )}
                {offer.terms?.timePreference && (
                  <span>Preferred: {offer.terms.timePreference}</span>
                )}
                {offer.terms?.specificTime && (
                  <span>Time: {offer.terms.specificTime}</span>
                )}
              </div>
            )}
          </section>

          {/* Description */}
          <section className="offer-detail-section">
            <h2>Description</h2>
            <div className="offer-detail-description">{offer.terms?.description || '—'}</div>
          </section>

          {/* Milestones */}
          {offer.terms?.milestones?.length > 0 && (
            <section className="offer-detail-section">
              <h2>Milestones</h2>
              <div className="offer-detail-milestones">
                {offer.terms.milestones.map((ms, i) => (
                  <div key={i} className="offer-detail-ms-row">
                    <span className="offer-detail-ms-num">{i + 1}</span>
                    <span className="offer-detail-ms-title">{ms.title}</span>
                    <span className="offer-detail-ms-amount">${ms.amount?.toLocaleString()}</span>
                  </div>
                ))}
                <div className="offer-detail-ms-total">
                  Total: ${offer.terms.milestones.reduce((s, m) => s + (m.amount || 0), 0).toLocaleString()}
                </div>
              </div>
            </section>
          )}

          {/* Linked Job / Service */}
          {(offer.job || offer.service) && (
            <section className="offer-detail-section">
              <h2>Linked To</h2>
              {offer.job && (
                <Link to={`/jobs/${offer.job._id}`} className="offer-detail-linked-card">
                  <span className="offer-detail-linked-icon">📋</span>
                  <div>
                    <div className="offer-detail-linked-title">{offer.job.title}</div>
                    <div className="offer-detail-linked-sub">
                      {offer.job.category} • Budget: ${offer.job.budget?.min}–${offer.job.budget?.max}
                    </div>
                  </div>
                </Link>
              )}
              {offer.service && (
                <Link to={`/services/${offer.service._id}`} className="offer-detail-linked-card">
                  <span className="offer-detail-linked-icon">🛒</span>
                  <div>
                    <div className="offer-detail-linked-title">{offer.service.title}</div>
                    <div className="offer-detail-linked-sub">{offer.service.category}</div>
                  </div>
                </Link>
              )}
            </section>
          )}
        </div>

        {/* ── Right: Sidebar ─────────────────────────────────── */}
        <aside className="offer-detail-sidebar">

          {/* Actions */}
          {(canAct || canWithdraw) && (
            <div className="offer-detail-actions-card">
              <h3>Actions</h3>
              {canAct && (
                <>
                  <button
                    className="btn-od-action btn-od-accept"
                    onClick={() => handleAction('accept')}
                    disabled={acting}
                  >
                    ✓ Accept Offer
                  </button>
                  <button
                    className="btn-od-action btn-od-counter"
                    onClick={() => setShowCounter(true)}
                    disabled={acting}
                  >
                    ↩ Counter Offer
                  </button>
                  <button
                    className="btn-od-action btn-od-decline"
                    onClick={() => handleAction('decline')}
                    disabled={acting}
                  >
                    ✕ Decline
                  </button>
                </>
              )}
              {canWithdraw && (
                <button
                  className="btn-od-action btn-od-withdraw"
                  onClick={() => handleAction('withdraw')}
                  disabled={acting}
                >
                  🚫 Withdraw Offer
                </button>
              )}
            </div>
          )}

          {/* Meta */}
          <div className="offer-detail-meta-card">
            <h3>Details</h3>
            <div className="offer-detail-meta-row">
              <span>Type</span>
              <span>{OFFER_TYPE_LABELS[offer.offerType] || offer.offerType}</span>
            </div>
            <div className="offer-detail-meta-row">
              <span>Created</span>
              <span>{fmtDateTime(offer.createdAt)}</span>
            </div>
            <div className="offer-detail-meta-row">
              <span>Updated</span>
              <span>{timeAgo(offer.updatedAt)}</span>
            </div>
            {offer.expiresAt && ['pending', 'countered'].includes(offer.status) && (
              <div className={`offer-detail-meta-row ${isExpiringSoon ? 'offer-detail-meta-warn' : ''}`}>
                <span>Expires</span>
                <span>{fmtDate(offer.expiresAt)}</span>
              </div>
            )}
            <div className="offer-detail-meta-row">
              <span>Rounds</span>
              <span>{offer.revisionHistory?.length || 1}</span>
            </div>
          </div>

          {/* Message button */}
          <Link to="/messages" className="btn-od-message">
            💬 Message {otherParty?.firstName}
          </Link>
        </aside>
      </div>

      {/* ── Negotiation Timeline ─────────────────────────────── */}
      {offer.revisionHistory?.length > 0 && (
        <section className="offer-detail-section offer-detail-timeline-section">
          <h2>Negotiation History</h2>
          <div className="offer-detail-timeline">
            {offer.revisionHistory.map((rev, i) => {
              const isMe = rev.by?._id === user?._id || rev.by === user?._id;
              const name = rev.by?.firstName
                ? `${rev.by.firstName} ${rev.by.lastName}`
                : (isMe ? 'You' : 'Other party');
              return (
                <div key={i} className={`offer-detail-tl-item offer-detail-tl-item--${rev.action}`}>
                  <div className="offer-detail-tl-marker" />
                  <div className="offer-detail-tl-content">
                    <div className="offer-detail-tl-header">
                      <strong>{isMe ? 'You' : name}</strong>
                      <span className={`offer-detail-tl-action offer-detail-tl-action--${rev.action}`}>
                        {ACTION_LABELS[rev.action] || rev.action}
                      </span>
                      <span className="offer-detail-tl-time">{fmtDateTime(rev.createdAt)}</span>
                    </div>
                    {rev.message && (
                      <p className="offer-detail-tl-message">"{rev.message}"</p>
                    )}
                    {['created', 'countered'].includes(rev.action) && rev.terms && (
                      <div className="offer-detail-tl-terms">
                        <span>${rev.terms.amount?.toLocaleString()}</span>
                        <span>•</span>
                        <span>{rev.terms.deliveryTime} day{rev.terms.deliveryTime !== 1 ? 's' : ''}</span>
                        <span>•</span>
                        <span>{rev.terms.revisions ?? 1} revision{(rev.terms.revisions ?? 1) !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Counter Modal ────────────────────────────────────── */}
      {showCounter && (
        <CustomOfferModal
          isOpen={true}
          onClose={() => setShowCounter(false)}
          recipientId={otherParty?._id}
          recipientName={`${otherParty?.firstName} ${otherParty?.lastName}`}
          jobId={offer.job?._id}
          serviceId={offer.service?._id}
          offerType="counter_offer"
          prefillTerms={offer.terms}
          onSuccess={() => { setShowCounter(false); fetchOffer(); }}
        />
      )}
    </div>
  );
};

export default OfferDetail;
