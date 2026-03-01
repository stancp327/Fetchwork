import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import CustomOfferModal from './CustomOfferModal';
import './CustomOffer.css';
import './MyOffers.css';
import SEO from '../common/SEO';

const OfferCard = ({ offer, userId, onAction }) => {
  const [showCounter, setShowCounter] = useState(false);
  const isSender = offer.sender?._id === userId;
  const otherParty = isSender ? offer.recipient : offer.sender;
  const isMyTurn = offer.awaitingResponseFrom === userId;
  const canAct = isMyTurn && ['pending', 'countered'].includes(offer.status);

  const handleAction = async (action) => {
    try {
      await apiRequest(`/api/offers/${offer._id}/${action}`, { method: 'POST' });
      onAction();
    } catch (err) {
      alert(err.message || `Failed to ${action} offer`);
    }
  };

  return (
    <div className="offer-card">
      <div className="offer-card-header">
        <div>
          <strong>{isSender ? 'Sent to' : 'From'}: {otherParty?.firstName} {otherParty?.lastName}</strong>
          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem' }}>
            {offer.job && <Link to={`/jobs/${offer.job._id}`}>📋 {offer.job.title}</Link>}
            {offer.service && <Link to={`/services/${offer.service._id}`}>🛒 {offer.service.title}</Link>}
            {!offer.job && !offer.service && '📋 Direct Offer'}
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

      <p style={{ fontSize: '0.85rem', color: '#374151', margin: '0 0 0.75rem' }}>
        {offer.terms?.description?.substring(0, 200)}{offer.terms?.description?.length > 200 ? '...' : ''}
      </p>

      {offer.revisionHistory?.length > 1 && (
        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.75rem' }}>
          💬 {offer.revisionHistory.length} rounds of negotiation
        </div>
      )}

      {canAct && (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-offer-action accept" onClick={() => handleAction('accept')}>✓ Accept</button>
          <button className="btn-offer-action counter" onClick={() => setShowCounter(true)}>↩ Counter</button>
          <button className="btn-offer-action decline" onClick={() => handleAction('decline')}>✕ Decline</button>
        </div>
      )}

      {isSender && ['pending', 'countered'].includes(offer.status) && !isMyTurn && (
        <div style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 500 }}>
          ⏳ Waiting for {otherParty?.firstName}'s response
        </div>
      )}

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
          onSuccess={onAction}
        />
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
          <OfferCard key={offer._id} offer={offer} userId={user?._id} onAction={fetchOffers} />
        ))
      )}
    </div>
  );
};

export default MyOffers;


