import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/api';
import './AdminVerifications.css';

const DOC_LABELS = {
  drivers_license: "Driver's License",
  passport:        'Passport',
  national_id:     'National ID',
  other:           'Other Gov. ID',
};

const STATUS_FILTERS = ['pending', 'approved', 'rejected'];

const AdminVerifications = () => {
  const [filter,  setFilter]  = useState('pending');
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [expanded, setExpanded] = useState(null); // userId of expanded row
  const [notes,   setNotes]   = useState({});      // { userId: noteText }
  const [working, setWorking] = useState({});      // { userId: true }

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest(`/api/admin/verifications?status=${filter}`);
      setItems(data.users || []);
    } catch (err) {
      setError('Failed to load verifications');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const review = async (userId, action) => {
    setWorking(w => ({ ...w, [userId]: true }));
    try {
      await apiRequest(`/api/admin/verifications/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ action, notes: notes[userId] || '' }),
      });
      setItems(prev => prev.filter(u => u._id !== userId));
      setExpanded(null);
    } catch (err) {
      alert('Action failed: ' + (err.message || 'Unknown error'));
    } finally {
      setWorking(w => ({ ...w, [userId]: false }));
    }
  };

  const pendingCount = filter === 'pending' ? items.length : null;

  return (
    <div className="av-page">
      <div className="av-header">
        <div>
          <h2 className="av-title">
            ID Verifications
            {pendingCount > 0 && <span className="av-badge">{pendingCount}</span>}
          </h2>
          <p className="av-subtitle">Review and approve freelancer identity submissions</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="av-filters">
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            className={`av-filter-btn${filter === s ? ' active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading && <div className="av-loading">Loading…</div>}
      {error   && <div className="av-error">{error}</div>}

      {!loading && !error && items.length === 0 && (
        <div className="av-empty">
          <div className="av-empty-icon">
            {filter === 'pending' ? '🎉' : '📭'}
          </div>
          <p>{filter === 'pending' ? 'No pending verifications — all caught up!' : `No ${filter} verifications.`}</p>
        </div>
      )}

      <div className="av-list">
        {items.map(user => {
          const v   = user.idVerification || {};
          const exp = expanded === user._id;
          return (
            <div key={user._id} className={`av-card${exp ? ' expanded' : ''}`}>
              {/* Summary row */}
              <div className="av-card-summary" onClick={() => setExpanded(exp ? null : user._id)}>
                <div className="av-user-info">
                  {user.profilePicture
                    ? <img src={user.profilePicture} alt="" className="av-avatar" />
                    : <div className="av-avatar-placeholder">{(user.firstName || '?')[0]}</div>
                  }
                  <div>
                    <div className="av-name">{user.firstName} {user.lastName}</div>
                    <div className="av-email">{user.email}</div>
                  </div>
                </div>

                <div className="av-meta">
                  <span className="av-doc-type">{DOC_LABELS[v.documentType] || v.documentType || '—'}</span>
                  {v.submittedAt && (
                    <span className="av-date">
                      Submitted {new Date(v.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  )}
                </div>

                <button className="av-expand-btn" aria-label="Toggle details">
                  {exp ? '▲' : '▼'}
                </button>
              </div>

              {/* Expanded detail */}
              {exp && (
                <div className="av-card-detail">
                  <div className="av-docs">
                    <div className="av-doc-block">
                      <p className="av-doc-label">ID Document</p>
                      {v.documentUrl ? (
                        v.documentUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)
                          ? <a href={v.documentUrl} target="_blank" rel="noreferrer">
                              <img src={v.documentUrl} alt="ID document" className="av-doc-img" />
                            </a>
                          : <a href={v.documentUrl} target="_blank" rel="noreferrer" className="av-doc-link">
                              📄 View Document
                            </a>
                      ) : <p className="av-no-doc">No document uploaded</p>}
                    </div>

                    {v.selfieUrl && (
                      <div className="av-doc-block">
                        <p className="av-doc-label">Selfie</p>
                        <a href={v.selfieUrl} target="_blank" rel="noreferrer">
                          <img src={v.selfieUrl} alt="Selfie" className="av-doc-img" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Notes field + action buttons (pending only) */}
                  {filter === 'pending' && (
                    <>
                      <div className="av-notes-field">
                        <label>Notes (visible to user if rejected)</label>
                        <textarea
                          rows={2}
                          placeholder="e.g. Document was blurry, please resubmit with a clearer photo"
                          value={notes[user._id] || ''}
                          onChange={e => setNotes(n => ({ ...n, [user._id]: e.target.value }))}
                        />
                      </div>
                      <div className="av-actions">
                        <button
                          className="av-btn approve"
                          disabled={working[user._id]}
                          onClick={() => review(user._id, 'approve')}
                        >
                          ✅ Approve
                        </button>
                        <button
                          className="av-btn reject"
                          disabled={working[user._id]}
                          onClick={() => review(user._id, 'reject')}
                        >
                          ❌ Reject
                        </button>
                      </div>
                    </>
                  )}

                  {/* Show review info for already-reviewed items */}
                  {filter !== 'pending' && v.notes && (
                    <div className="av-review-notes">
                      <strong>Notes:</strong> {v.notes}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminVerifications;
