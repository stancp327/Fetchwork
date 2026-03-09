import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import './AgencyClients.css';

const AgencyClients = ({ teamId }) => {
  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRelationships = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/api/agency-relationships');
      // Filter to relationships for this team (agency-side)
      const forTeam = (res.relationships || []).filter(
        r => r.agency && (r.agency._id === teamId || r.agency === teamId)
      );
      setRelationships(forTeam);
    } catch (err) {
      setError(err.message || 'Failed to load client relationships');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { loadRelationships(); }, [loadRelationships]);

  const handleAccept = async (id) => {
    try {
      await apiRequest(`/api/agency-relationships/${id}/accept`, { method: 'POST' });
      loadRelationships();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDecline = async (id) => {
    try {
      await apiRequest(`/api/agency-relationships/${id}/end`, { method: 'POST' });
      loadRelationships();
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePause = async (id) => {
    try {
      await apiRequest(`/api/agency-relationships/${id}/pause`, { method: 'POST' });
      loadRelationships();
    } catch (err) {
      setError(err.message);
    }
  };

  const pending = relationships.filter(r => r.status === 'pending');
  const active = relationships.filter(r => r.status === 'active');
  const paused = relationships.filter(r => r.status === 'paused');

  if (loading) return <div className="ac-loading">Loading client relationships...</div>;

  return (
    <div className="ac-root">
      <h2 className="ac-title">Client Relationships</h2>

      {error && <div className="ac-error">{error}</div>}

      {pending.length > 0 && (
        <div className="ac-section">
          <h3 className="ac-section-title">Pending Invites ({pending.length})</h3>
          <div className="ac-list">
            {pending.map(r => (
              <ClientCard
                key={r._id}
                rel={r}
                onAccept={() => handleAccept(r._id)}
                onDecline={() => handleDecline(r._id)}
                isPending
              />
            ))}
          </div>
        </div>
      )}

      {active.length > 0 && (
        <div className="ac-section">
          <h3 className="ac-section-title">Active Clients ({active.length})</h3>
          <div className="ac-list">
            {active.map(r => (
              <ClientCard key={r._id} rel={r} onPause={() => handlePause(r._id)} />
            ))}
          </div>
        </div>
      )}

      {paused.length > 0 && (
        <div className="ac-section">
          <h3 className="ac-section-title">Paused ({paused.length})</h3>
          <div className="ac-list">
            {paused.map(r => (
              <ClientCard key={r._id} rel={r} isPaused />
            ))}
          </div>
        </div>
      )}

      {relationships.length === 0 && (
        <div className="ac-empty">
          No client relationships yet. Clients can invite your agency as a preferred partner.
        </div>
      )}
    </div>
  );
};

function ClientCard({ rel, onAccept, onDecline, onPause, isPending, isPaused }) {
  const client = rel.client || {};
  const rt = rel.retainerTerms || {};
  const name = [client.firstName, client.lastName].filter(Boolean).join(' ') || 'Unknown Client';
  const activeSince = rel.updatedAt ? new Date(rel.updatedAt).toLocaleDateString() : '';

  return (
    <div className="ac-card">
      <div className="ac-card-info">
        {client.profilePicture ? (
          <img src={client.profilePicture} alt={name} className="ac-avatar" />
        ) : (
          <div className="ac-avatar-initial">{name[0] || '?'}</div>
        )}
        <div className="ac-card-details">
          <div className="ac-card-name">{name}</div>
          <div className="ac-card-meta">
            <span className={`ac-badge ac-badge-${rel.relationshipType}`}>
              {rel.relationshipType?.replace('_', ' ')}
            </span>
            {isPending && <span className="ac-badge ac-badge-pending">Awaiting Response</span>}
          </div>
          {rel.relationshipType === 'retainer' && rt.monthlyRate && (
            <div className="ac-retainer-summary">
              <span>${rt.monthlyRate}/mo</span>
              <span>{rt.hoursIncluded || 0}h included</span>
              {activeSince && rel.status === 'active' && <span>Active since {activeSince}</span>}
            </div>
          )}
        </div>
      </div>
      <div className="ac-card-actions">
        {isPending && (
          <>
            <button className="ac-btn ac-btn-accept" onClick={onAccept}>Accept</button>
            <button className="ac-btn ac-btn-decline" onClick={onDecline}>Decline</button>
          </>
        )}
        {!isPending && !isPaused && onPause && (
          <button className="ac-btn" onClick={onPause}>Pause</button>
        )}
      </div>
    </div>
  );
}

export default AgencyClients;
