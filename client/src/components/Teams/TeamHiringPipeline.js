import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import './TeamHiringPipeline.css';

const STAGES = ['sourced', 'reviewing', 'shortlisted', 'interviewing', 'offer', 'hired', 'archived'];

const STAGE_LABELS = {
  sourced: 'Sourced',
  reviewing: 'Reviewing',
  shortlisted: 'Shortlisted',
  interviewing: 'Interviewing',
  offer: 'Offer',
  hired: 'Hired',
  archived: 'Archived',
};

export default function TeamHiringPipeline({ teamId, team }) {
  const [pipeline, setPipeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add modal state
  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);

  // Move/notes state
  const [movingId, setMovingId] = useState(null);
  const [editingNotesId, setEditingNotesId] = useState(null);
  const [editNotesText, setEditNotesText] = useState('');

  const fetchPipeline = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const data = await apiRequest(`/api/teams/${teamId}/pipeline`);
      setPipeline(data.pipeline || []);
    } catch (err) {
      setError(err.message || 'Failed to load pipeline');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { fetchPipeline(); }, [fetchPipeline]);

  // Search freelancers
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const data = await apiRequest(`/api/users/search?q=${encodeURIComponent(searchQuery.trim())}&role=freelancer&limit=10`);
      setSearchResults(data.users || data || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  // Add to pipeline
  const handleAdd = async (freelancerId) => {
    setAdding(true);
    try {
      const data = await apiRequest(`/api/teams/${teamId}/pipeline`, {
        method: 'POST',
        body: JSON.stringify({ freelancerId, stage: 'sourced' }),
      });
      setPipeline(data.pipeline || []);
      setShowAdd(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch (err) {
      alert(err.message || 'Failed to add');
    } finally {
      setAdding(false);
    }
  };

  // Move stage
  const handleMove = async (entryId, newStage) => {
    try {
      const data = await apiRequest(`/api/teams/${teamId}/pipeline/${entryId}`, {
        method: 'PATCH',
        body: JSON.stringify({ stage: newStage }),
      });
      setPipeline(data.pipeline || []);
    } catch (err) {
      alert(err.message || 'Failed to move');
    }
    setMovingId(null);
  };

  // Save notes
  const handleSaveNotes = async (entryId) => {
    try {
      const data = await apiRequest(`/api/teams/${teamId}/pipeline/${entryId}`, {
        method: 'PATCH',
        body: JSON.stringify({ notes: editNotesText }),
      });
      setPipeline(data.pipeline || []);
    } catch (err) {
      alert(err.message || 'Failed to save notes');
    }
    setEditingNotesId(null);
    setEditNotesText('');
  };

  // Remove from pipeline
  const handleRemove = async (entryId) => {
    if (!window.confirm('Remove this freelancer from the pipeline?')) return;
    try {
      await apiRequest(`/api/teams/${teamId}/pipeline/${entryId}`, { method: 'DELETE' });
      setPipeline(prev => prev.filter(e => e._id !== entryId));
    } catch (err) {
      alert(err.message || 'Failed to remove');
    }
  };

  if (loading) {
    return <div className="thp-root"><div className="thp-loading">Loading pipeline...</div></div>;
  }

  if (error) {
    return <div className="thp-root"><div className="thp-error">{error}</div></div>;
  }

  // Group entries by stage
  const byStage = {};
  STAGES.forEach(s => { byStage[s] = []; });
  (pipeline || []).forEach(entry => {
    const stage = entry.stage || 'sourced';
    if (byStage[stage]) byStage[stage].push(entry);
  });

  const freelancerName = (f) => {
    if (!f) return 'Unknown';
    return [f.firstName, f.lastName].filter(Boolean).join(' ') || f.email || 'Unknown';
  };

  return (
    <div className="thp-root">
      <div className="thp-header">
        <h2 className="thp-title">Hiring Pipeline</h2>
        <button className="thp-add-btn" onClick={() => setShowAdd(true)}>
          + Add to Pipeline
        </button>
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="thp-modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="thp-modal" onClick={e => e.stopPropagation()}>
            <div className="thp-modal-header">
              <h3 className="thp-modal-title">Add Freelancer to Pipeline</h3>
              <button className="thp-modal-close" onClick={() => setShowAdd(false)} aria-label="Close">&times;</button>
            </div>
            <div className="thp-search-row">
              <input
                className="thp-search-input"
                type="text"
                placeholder="Search freelancers by name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
              />
              <button className="thp-search-btn" onClick={handleSearch} disabled={searching}>
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>
            <div className="thp-search-results">
              {searchResults.length === 0 && !searching && searchQuery && (
                <div className="thp-search-empty">No freelancers found</div>
              )}
              {searchResults.map(u => {
                const alreadyAdded = pipeline.some(e =>
                  String(e.freelancer?._id || e.freelancer) === String(u._id)
                );
                return (
                  <div className="thp-search-result" key={u._id}>
                    <div className="thp-search-info">
                      {u.profileImage && (
                        <img className="thp-avatar" src={u.profileImage} alt="" />
                      )}
                      <div>
                        <div className="thp-search-name">{freelancerName(u)}</div>
                        {u.skills && u.skills.length > 0 && (
                          <div className="thp-search-skills">
                            {u.skills.slice(0, 3).join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      className="thp-search-add"
                      disabled={alreadyAdded || adding}
                      onClick={() => handleAdd(u._id)}
                    >
                      {alreadyAdded ? 'Added' : 'Add'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Kanban board */}
      <div className="thp-board">
        {STAGES.map(stage => (
          <div className="thp-column" key={stage}>
            <div className="thp-column-header">
              <span className="thp-column-title">{STAGE_LABELS[stage]}</span>
              <span className="thp-column-count">{byStage[stage].length}</span>
            </div>
            <div className="thp-column-body">
              {byStage[stage].map(entry => {
                const f = entry.freelancer || {};
                return (
                  <div className="thp-card" key={entry._id}>
                    <div className="thp-card-top">
                      {f.profileImage && (
                        <img className="thp-avatar" src={f.profileImage} alt="" />
                      )}
                      <div className="thp-card-info">
                        <span className="thp-card-name">{freelancerName(f)}</span>
                        {f.skills && f.skills.length > 0 && (
                          <span className="thp-card-skills">
                            {f.skills.slice(0, 3).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Notes */}
                    {editingNotesId === entry._id ? (
                      <div className="thp-notes-edit">
                        <textarea
                          className="thp-notes-textarea"
                          value={editNotesText}
                          onChange={e => setEditNotesText(e.target.value)}
                          rows={3}
                          placeholder="Add notes..."
                        />
                        <div className="thp-notes-actions">
                          <button className="thp-btn-sm thp-btn-save" onClick={() => handleSaveNotes(entry._id)}>Save</button>
                          <button className="thp-btn-sm thp-btn-cancel" onClick={() => setEditingNotesId(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="thp-notes-toggle"
                        onClick={() => { setEditingNotesId(entry._id); setEditNotesText(entry.notes || ''); }}
                      >
                        {entry.notes ? entry.notes : 'Add notes...'}
                      </button>
                    )}

                    {/* Stage move */}
                    <div className="thp-card-actions">
                      {movingId === entry._id ? (
                        <select
                          className="thp-stage-select"
                          value={entry.stage}
                          onChange={e => handleMove(entry._id, e.target.value)}
                          onBlur={() => setMovingId(null)}
                          autoFocus
                        >
                          {STAGES.map(s => (
                            <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                          ))}
                        </select>
                      ) : (
                        <button className="thp-btn-sm thp-btn-move" onClick={() => setMovingId(entry._id)}>
                          Move
                        </button>
                      )}
                      <button className="thp-btn-sm thp-btn-remove" onClick={() => handleRemove(entry._id)}>
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
              {byStage[stage].length === 0 && (
                <div className="thp-empty-col">No candidates</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
