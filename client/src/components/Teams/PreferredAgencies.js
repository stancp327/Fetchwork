import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import './PreferredAgencies.css';

const PreferredAgencies = () => {
  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showInvite, setShowInvite] = useState(false);

  const loadRelationships = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/api/agency-relationships');
      // Filter to only those where current user is the client
      setRelationships(res.relationships || []);
    } catch (err) {
      setError(err.message || 'Failed to load relationships');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRelationships(); }, [loadRelationships]);

  const handleAction = async (id, action) => {
    try {
      await apiRequest(`/api/agency-relationships/${id}/${action}`, { method: 'POST' });
      loadRelationships();
    } catch (err) {
      setError(err.message);
    }
  };

  // Split relationships: client-side ones are where user initiated or is the client
  const active = relationships.filter(r => r.status === 'active' && r.client);
  const pending = relationships.filter(r => r.status === 'pending' && r.initiatedBy === 'client');
  const paused = relationships.filter(r => r.status === 'paused');

  if (loading) return <div className="pa-loading">Loading preferred agencies...</div>;

  return (
    <div className="pa-root">
      <div className="pa-header">
        <h2 className="pa-title">Preferred Agencies</h2>
        <button className="pa-invite-btn" onClick={() => setShowInvite(true)}>
          + Invite Agency
        </button>
      </div>

      {error && <div className="pa-error">{error}</div>}

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvited={() => { setShowInvite(false); loadRelationships(); }}
        />
      )}

      {pending.length > 0 && (
        <div>
          <h3 className="pa-section-title">Pending Invites</h3>
          <div className="pa-list">
            {pending.map(r => (
              <RelationshipCard key={r._id} rel={r} onAction={handleAction} isPending />
            ))}
          </div>
        </div>
      )}

      {active.length > 0 && (
        <div>
          <h3 className="pa-section-title">Active Agencies</h3>
          <div className="pa-list">
            {active.map(r => (
              <RelationshipCard key={r._id} rel={r} onAction={handleAction} />
            ))}
          </div>
        </div>
      )}

      {paused.length > 0 && (
        <div>
          <h3 className="pa-section-title">Paused</h3>
          <div className="pa-list">
            {paused.map(r => (
              <RelationshipCard key={r._id} rel={r} onAction={handleAction} />
            ))}
          </div>
        </div>
      )}

      {active.length === 0 && pending.length === 0 && paused.length === 0 && (
        <div className="pa-empty">
          No preferred agencies yet. Invite an agency to get started.
        </div>
      )}
    </div>
  );
};

function RelationshipCard({ rel, onAction, isPending }) {
  const agency = rel.agency || {};
  const rt = rel.retainerTerms || {};

  return (
    <div className="pa-card">
      <div className="pa-card-info">
        {agency.logo ? (
          <img src={agency.logo} alt={agency.name} className="pa-card-logo" />
        ) : (
          <div className="pa-card-initial">{agency.name?.[0] || 'A'}</div>
        )}
        <div className="pa-card-details">
          <div className="pa-card-name">{agency.name}</div>
          <div className="pa-card-meta">
            <span className={`pa-badge pa-badge-${rel.relationshipType}`}>
              {rel.relationshipType?.replace('_', ' ')}
            </span>
            {isPending && <span className="pa-badge pa-badge-pending">Pending</span>}
            {rel.status === 'paused' && <span className="pa-badge pa-badge-paused">Paused</span>}
          </div>
          {rel.relationshipType === 'retainer' && rt.monthlyRate && (
            <div className="pa-retainer-info">
              ${rt.monthlyRate}/mo &middot; {rt.hoursIncluded || 0}h included
            </div>
          )}
        </div>
      </div>
      <div className="pa-card-actions">
        {agency.slug && (
          <Link to={`/agency/${agency.slug}`} className="pa-action-btn">View Profile</Link>
        )}
        {rel.status === 'active' && (
          <>
            <button className="pa-action-btn" onClick={() => onAction(rel._id, 'pause')}>
              Pause
            </button>
            <button className="pa-action-btn pa-action-btn-danger" onClick={() => onAction(rel._id, 'end')}>
              End
            </button>
          </>
        )}
        {rel.status === 'paused' && (
          <button className="pa-action-btn" onClick={() => onAction(rel._id, 'end')}>
            End
          </button>
        )}
      </div>
    </div>
  );
}

function InviteModal({ onClose, onInvited }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [relType, setRelType] = useState('preferred');
  const [retainerRate, setRetainerRate] = useState('');
  const [retainerHours, setRetainerHours] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await apiRequest(`/api/teams/agencies/directory?search=${encodeURIComponent(search)}&limit=5`);
        setResults(res.agencies || []);
      } catch { setResults([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleSend = async () => {
    if (!selected) return;
    setSending(true);
    setError('');
    try {
      const body = { agencyId: selected._id, relationshipType: relType };
      if (relType === 'retainer') {
        body.retainerTerms = {
          monthlyRate: parseFloat(retainerRate) || 0,
          hoursIncluded: parseInt(retainerHours, 10) || 0,
          startDate: new Date().toISOString(),
        };
      }
      await apiRequest('/api/agency-relationships', { method: 'POST', body });
      onInvited();
    } catch (err) {
      setError(err.message || 'Failed to send invite');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="pa-modal-overlay" onClick={onClose}>
      <div className="pa-modal" onClick={e => e.stopPropagation()}>
        <h3 className="pa-modal-title">Invite Agency</h3>

        {!selected ? (
          <>
            <input
              className="pa-search-input"
              placeholder="Search agencies by name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
            {results.length > 0 && (
              <div className="pa-search-results">
                {results.map(a => (
                  <div key={a._id} className="pa-search-item" onClick={() => { setSelected(a); setSearch(''); }}>
                    {a.logo ? (
                      <img src={a.logo} alt={a.name} className="pa-search-item-logo" />
                    ) : (
                      <div className="pa-search-item-initial">{a.name?.[0] || 'A'}</div>
                    )}
                    <span>{a.name}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="pa-search-item" style={{ cursor: 'default' }}>
              {selected.logo ? (
                <img src={selected.logo} alt={selected.name} className="pa-search-item-logo" />
              ) : (
                <div className="pa-search-item-initial">{selected.name?.[0] || 'A'}</div>
              )}
              <span>{selected.name}</span>
              <button
                className="pa-action-btn"
                onClick={() => setSelected(null)}
                style={{ marginLeft: 'auto' }}
              >Change</button>
            </div>

            <div>
              <div className="pa-field-label">Relationship Type</div>
              <select className="pa-select" value={relType} onChange={e => setRelType(e.target.value)}>
                <option value="preferred">Preferred</option>
                <option value="retainer">Retainer</option>
                <option value="one_time">One-Time</option>
              </select>
            </div>

            {relType === 'retainer' && (
              <div className="pa-retainer-fields">
                <div>
                  <div className="pa-field-label">Monthly Rate ($)</div>
                  <input
                    className="pa-input"
                    type="number"
                    placeholder="0"
                    value={retainerRate}
                    onChange={e => setRetainerRate(e.target.value)}
                  />
                </div>
                <div>
                  <div className="pa-field-label">Hours Included</div>
                  <input
                    className="pa-input"
                    type="number"
                    placeholder="0"
                    value={retainerHours}
                    onChange={e => setRetainerHours(e.target.value)}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {error && <div className="pa-error">{error}</div>}

        <div className="pa-modal-actions">
          <button className="pa-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="pa-btn-send" disabled={!selected || sending} onClick={handleSend}>
            {sending ? 'Sending...' : 'Send Invite'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PreferredAgencies;
