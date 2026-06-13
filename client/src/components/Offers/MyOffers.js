import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import './CustomOffer.css';
import './MyOffers.css';
import SEO from '../common/SEO';

const OfferCard = ({ offer, userId }) => {
  const navigate = useNavigate();
  const isSender = offer.sender?._id === userId;
  const otherParty = isSender ? offer.recipient : offer.sender;
  const isMyTurn = offer.awaitingResponseFrom === userId;

  return (
    <div
      className="offer-card offer-card--clickable"
      onClick={() => navigate(`/offers/${offer._id}`)}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/offers/${offer._id}`); }}
    >
      <div className="offer-card-header">
        <div>
          <strong>{isSender ? 'Sent to' : 'From'}: {otherParty?.firstName} {otherParty?.lastName}</strong>
          <div className="offer-card-sub">
            {offer.job && <span>📋 {offer.job.title}</span>}
            {offer.service && <span>🛒 {offer.service.title}</span>}
            {!offer.job && !offer.service && <span>📋 Direct Offer</span>}
            {' • '}{new Date(offer.updatedAt).toLocaleDateString()}
          </div>
        </div>
        <span className={`offer-status ${offer.status}`}>{offer.status}</span>
      </div>

      <div className="offer-card-terms">
        <span className="offer-term"><strong>${offer.terms?.amount}</strong></span>
        <span className="offer-term">⏱️ <strong>{offer.terms?.deliveryTime}</strong> day{offer.terms?.deliveryTime > 1 ? 's' : ''}</span>
        <span className="offer-term">🔄 <strong>{offer.terms?.revisions}</strong> revision{offer.terms?.revisions !== 1 ? 's' : ''}</span>
        {offer.terms?.deadline && <span className="offer-term">⏰ Due {new Date(offer.terms.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
      </div>

      <p className="offer-card-desc">
        {offer.terms?.description?.substring(0, 200)}{offer.terms?.description?.length > 200 ? '...' : ''}
      </p>

      {offer.revisionHistory?.length > 1 && (
        <div className="offer-card-rounds">
          💬 {offer.revisionHistory.length} rounds of negotiation
        </div>
      )}

      {isMyTurn && ['pending', 'countered'].includes(offer.status) && (
        <div className="offer-card-action-hint">🔔 Your turn to respond</div>
      )}

      {isSender && ['pending', 'countered'].includes(offer.status) && !isMyTurn && (
        <div className="offer-card-waiting">
          ⏳ Waiting for {otherParty?.firstName}'s response
        </div>
      )}
    </div>
  );
};

const MyOffers = () => {
  const { user } = useAuth();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetchOffers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('type', filter);
      const data = await apiRequest(`/api/offers?${params}`);
      setOffers(data.offers || []);
    } catch (err) {
      console.error('Failed to fetch offers:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchOffers(); }, [fetchOffers]);

  const actionNeeded = offers.filter(o => 
    o.awaitingResponseFrom === user?._id && ['pending', 'countered'].includes(o.status)
  ).length;

  const FILTERS = [
    { key: 'all',          label: 'All' },
    { key: 'action_needed', label: '🔔 Action Needed' },
    { key: 'sent',         label: 'Sent' },
    { key: 'received',     label: 'Received' },
  ];

  return (
    <div className="my-offers-container">
      <SEO title="My Offers" path="/offers" noIndex={true} />
      <div className="my-offers-header">
        <div>
          <h1>My Offers</h1>
          {actionNeeded > 0 && (
            <p className="my-offers-alert">
              🔔 {actionNeeded} offer{actionNeeded > 1 ? 's' : ''} waiting for your response
            </p>
          )}
        </div>
        <div className="my-offers-filters">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              className={`offer-filter-btn${filter === key ? ' active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="my-offers-loading">Loading offers…</div>
      ) : offers.length === 0 ? (
        <div className="my-offers-empty">
          <div className="empty-icon">📋</div>
          <p><strong>No offers yet</strong></p>
          <p>Custom offers will appear here when you send or receive them</p>
        </div>
      ) : (
        offers.map(offer => (
          <OfferCard key={offer._id} offer={offer} userId={user?._id} />
        ))
      )}
    </div>
  );
};

export default MyOffers;


